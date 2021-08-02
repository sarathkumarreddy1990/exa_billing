const fs = require('fs');
const path = require('path');
const uuid = require('uuid/v1');
const logger = require('../../../logger');
const {
    chunk,
    padStart,
    groupBy
} = require('lodash');

const ws = require('./ws'); // NOTE this is the local adapter for ws.js
const {
    Http,
    Security,
    UsernameToken,
    X509BinarySecurityToken,
    // NOTE do not use the ws.js implementation of Mtom,
    // read the notes in local ws.js for an explanation,
    Mtom,
    Xenc,
    Audit,
    Nerf,
} = ws;

const {
    UPLOAD_MAX,
    UPDATE_MAX,
    DELETE_MAX,
    SUBMIT_MAX,
    DOWNLOAD_MAX,
    INFO_MAX,

    services: {
        EDT_GET_TYPE_LIST,
        EDT_UPLOAD,
        EDT_SUBMIT,
        EDT_INFO,
        EDT_LIST,
        EDT_DOWNLOAD,
        EDT_DELETE,
        EDT_UPDATE,
        HCV_REAL_TIME,
    },
} = require('./constants');

const xml = require('./xml');
const requestTemplate = require('./requestTemplate');
const serviceTemplate = require('./serviceTemplate');

const DEFAULT_SERVICE_XML = '';
const DEFAULT_EDT_SERVICE_ENDPOINT = 'https://ws.conf.ebs.health.gov.on.ca:1443/EDTService/EDTService';
const DEFAULT_HCV_SERVICE_ENDPOINT = 'https://ws.conf.ebs.health.gov.on.ca:1444/HCVService/HCValidationService';


const EBSConnector = function(config) {

    const edtServiceEndpoint = config.edtServiceEndpoint || DEFAULT_EDT_SERVICE_ENDPOINT;
    const hcvServiceEndpoint = config.hcvServiceEndpoint || DEFAULT_HCV_SERVICE_ENDPOINT;

    const auth = new UsernameToken({
        username: config.username,
        password: config.password,
    });
    const pemfile = fs.readFileSync(config.ebsCertPath);

    const x509 = new X509BinarySecurityToken({
        // TODO experiment using just the keys or certificates (no "mash")
        "key": pemfile.toString(),
    });

    const signature = new ws.Signature(x509);
    signature.addReference("//*[local-name(.)='EBS']");
    signature.addReference("//*[local-name(.)='IDP']");
    signature.addReference("//*[local-name(.)='UsernameToken']");
    signature.addReference("//*[local-name(.)='Timestamp']");
    signature.addReference("//*[local-name(.)='Body']");

    const handlers =  [
        new Audit(config),    // NOTE order in list affects duration
    ].concat(config.isProduction
        ? [
            new Xenc({
                pemfile,
            }),
            new Security(
                {}
                , [x509, auth, signature]
            ),
            new Mtom(),
            new Http(),
        ]
        : [
            new Nerf()
        ]);

    // TODO this is an unnacceptable workaround and absolutely nothing further must depend upon this
    const hcvHandlers =  [
        new Audit(config),    // NOTE order in list affects duration
    ].concat(config.isProduction
        ? [
            new Xenc({
                pemfile,
            }),
            new Security(
                {}
                , [x509, auth, signature]
            ),
            // new Mtom(),
            new Http(),
        ]
        : [
            new Nerf()
        ]);
    /**
     * const createContext - description
     *
     * @param  {type} serviceXML description
     * @param  {type} apiUrl     description
     * @return {type}            description
     */
    const createContext = (service, serviceParams) => {

        const isHCV = (service === HCV_REAL_TIME);

        let serviceUserMUID = serviceParams.providerNumber || config.serviceUserMUID;

        if (!serviceUserMUID) {
            return {
                error: `Service User MUID ${serviceUserMUID} is not valid`
            };
        }

        let padCount = serviceUserMUID && serviceUserMUID.length == 4 ? 5 : 6;
        serviceUserMUID = padStart(serviceUserMUID, padCount, 0);
        logger.debug(`Service User MUID passed: ${serviceUserMUID}`);

        const url = isHCV ? hcvServiceEndpoint : edtServiceEndpoint;
        logger.debug(`EBS request context url ${url}`, url);

        const auditID = uuid();
        logger.debug(`EBS request context auditID ${auditID}`, auditID);

        const serviceXML = (serviceTemplate[service](serviceParams));
        logger.debug(`EBS request XML`, serviceXML);

        return {
            // these are required by ws.js
            request: requestTemplate({
                    serviceXML,
                    softwareConformanceKey: isHCV ? config.hcvSoftwareConformanceKey : config.edtSoftwareConformanceKey,
                    auditID,
                    serviceUserMUID,
                }),
            contentType: 'text/xml',
            url,

            // these are specifically for the audit log
            auditID,
            endUser: config.username,
            serviceUserMUID,
            eventDetail: {
                [service]: serviceParams,
            },
        };
    };

    return {

        /**
         * upload - description
         *
         * @param  {type} args     description
         * @param  {type} callback description
         * @return {type}          description
         */
        [EDT_UPLOAD]: (args, callback) => {

            const {
                uploads,
                unsafe,
                MOHId
            } = args;

            const faults = [];
            const auditInfo = [];
            const results = [];

            const chunkSize = unsafe ? uploads.length : UPLOAD_MAX;

            chunk(uploads, chunkSize).forEach((chunk, chunkIndex, chunks) => {

                const ctx = createContext(EDT_UPLOAD, {uploads: chunk, providerNumber: MOHId});

                if (ctx && ctx.error) {
                    return callback(ctx, {
                        faults,
                        results,
                        auditInfo
                    });
                }

                chunk.forEach((upload, uploadIndex) => {
                    ws.addAttachment(
                        ctx,
                        "request",
                        "//*[local-name(.)='content']",
                        upload.filename,
                         "text/plain",
                         uploadIndex
                     );
                });

                ws.send(handlers, ctx, (ctx) => {
                    const {
                        response,
                    } = ctx;

                    try {
                        results.push(xml.parseUploadResponse(response));
                    }
                    catch (e) {
                        faults.push(xml.parseEBSFault(response));
                    }
                    auditInfo.push(ctx.auditInfo);

                    if (auditInfo.length === chunks.length) {
                        // TODO pass errors
                        return callback(null, {
                            faults,
                            auditInfo,
                            results,
                        });
                    };
                });
            });
        },

        [EDT_SUBMIT]: (args, callback) => {

            const {
                resourceIDs,
                providerNumber
            } = args;

            const auditInfo = [];
            const results = [];
            const faults = [];

            chunk(resourceIDs, SUBMIT_MAX).forEach((chunk, index, chunks) => {

                const ctx = createContext(EDT_SUBMIT, {resourceIDs: chunk, providerNumber});

                if (ctx && ctx.error) {
                    return callback(ctx, {
                        faults,
                        auditInfo,
                        results
                    });
                }

                return ws.send(handlers, ctx, (ctx) => {

                    const {
                        response,
                    } = ctx;

                    try {
                        results.push(xml.parseSubmitResponse(response));
                    }
                    catch (e) {
                        faults.push(xml.parseEBSFault(response));
                    }
                    auditInfo.push(ctx.auditInfo);

                    if (auditInfo.length === chunks.length) {
                        // TODO pass errors
                        return callback(null, {
                            faults,
                            auditInfo,
                            results,
                        });
                    };
                });
            });
        },

        [EDT_INFO]: (args, callback) => {
            const {
                resourceIDs,
                providerNumber,
            } = args;

            const faults = [];
            const auditInfo = [];
            const results = [];

            chunk(resourceIDs, INFO_MAX).forEach((chunk, index, chunks) => {

                // TODO remove this cludgy hack after Conformance Testing is over

                const ctx = createContext(EDT_INFO, {resourceIDs: (chunk[0] === '-1') ? [] : chunk, providerNumber});

                if (ctx && ctx.error) {
                    faults.push(ctx);
                    return callback(ctx, {
                        faults,
                        auditInfo,
                        results
                    });
                }

                return ws.send(handlers, ctx, (ctx) => {

                    const {
                        response,
                    } = ctx;

                    if (response) {
                        try {
                            results.push(xml.parseInfoResponse(response));
                        }
                        catch (e) {
                            faults.push(xml.parseEBSFault(response));
                        }
                    }

                    auditInfo.push(ctx.auditInfo);

                    if (auditInfo.length === chunks.length) {
                        // TODO pass errors
                        return callback(null, {
                            faults,
                            auditInfo,
                            results,
                        });
                    };
                });
            });
        },

        [EDT_LIST]: (args, callback) => {
            let {
                resourceType,
                status,
                pageNo,
                providerNumber,
            } = args;
            const ctx = createContext(EDT_LIST, {resourceType, status, pageNo, providerNumber});

            const auditInfo = [];
            const results = [];
            const faults = [];

            if (ctx && ctx.error) {
                return callback(null, {
                    faults,
                    auditInfo,
                    results
                });
            }

            return ws.send(handlers, ctx, (ctx) => {

                const {
                    response,
                } = ctx;

                if (response) {
                    try {
                        results.push(xml.parseListResponse(response));
                    }
                    catch (e) {
                        faults.push(xml.parseEBSFault(response));
                    }
                }

                auditInfo.push(ctx.auditInfo);

                return callback(null, {
                    faults,
                    auditInfo,
                    results,
                });
            });
        },

        [EDT_DOWNLOAD]: (args, callback) => {
            let {
                resourceIDs,
                unsafe,
                providerNumber,
            } = args;

            const auditInfo = [];
            const results = [];
            const faults = [];

            const chunkSize = unsafe ? resourceIDs.length : DOWNLOAD_MAX;

            chunk(resourceIDs, chunkSize).forEach((chunk, chunkIndex, chunks) => {

                const ctx = createContext(EDT_DOWNLOAD, {resourceIDs: chunk, providerNumber});

                if (ctx && ctx.error) {
                    return callback(ctx, {
                        faults,
                        auditInfo,
                        results
                    });
                }

                return ws.send(handlers, ctx, (ctx) => {

                    const {
                        response,
                    } = ctx;

                    if (response) {
                        try {
                            results.push(xml.parseDownloadResponse(response));
                        }
                        catch (e) {
                            faults.push(xml.parseEBSFault(response));
                        }
                    }

                    auditInfo.push(ctx.auditInfo);

                    if (auditInfo.length === chunks.length) {
                        // TODO pass errors
                        return callback(null, {
                            faults,
                            auditInfo,
                            results,
                        });
                    };
                });
            });
        },


        [EDT_DELETE]: (args, callback) => {

            const {
                resourceIDs,
            } = args;

            const auditInfo = [];
            const results = [];
            const faults = [];

            chunk(resourceIDs, DELETE_MAX).forEach((chunk, chunkIndex, chunks) => {

                const ctx = createContext(EDT_DELETE, {resourceIDs: chunk});

                if (ctx && ctx.error) {
                    return callback(ctx, {
                        faults,
                        auditInfo,
                        results
                    });
                }

                return ws.send(handlers, ctx, (ctx) => {

                    const {
                        response,
                    } = ctx;

                    try {
                        results.push(xml.parseDeleteResponse(response));
                    }
                    catch (e) {
                        faults.push(xml.parseEBSFault(response));
                    }

                    auditInfo.push(ctx.auditInfo);

                    if (auditInfo.length === chunks.length) {
                        // TODO pass errors
                        return callback(ctx, {
                            faults,
                            auditInfo,
                            results,
                        });
                    };
                });
            });
        },

        [EDT_UPDATE]: (args, callback) => {

            const {
                updates,
                unsafe,
            } = args;

            const auditInfo = [];
            const results = [];
            const faults = [];

            const chunkSize = unsafe ? updates.length : UPDATE_MAX;
            chunk(updates, chunkSize).forEach((chunk, chunkIndex, chunks) => {

                const ctx = createContext(EDT_UPDATE, {updates:chunk});

                if (ctx && ctx.error) {
                    return callback(ctx, {
                        faults,
                        auditInfo,
                        results
                    });
                }

                chunk.forEach((update, updateIndex) => {

                    ws.addAttachment(
                        ctx,
                        "request",
                        "//*[local-name(.)='content']",
                         update.filename,
                         "text/plain",
                         updateIndex
                     );
                });

                return ws.send(handlers, ctx, (ctx) => {

                    const {
                        response,
                    } = ctx;

                    try {
                        results.push(xml.parseUpdateResponse(response));
                    }
                    catch (e) {
                        faults.push(xml.parseEBSFault(response));
                    }
                    auditInfo.push(ctx.auditInfo);

                    if (auditInfo.length === chunks.length) {
                        // TODO pass errors
                        return callback(null, {
                            faults,
                            auditInfo,
                            results,
                        });
                    };
                });
            });
        },

        [EDT_GET_TYPE_LIST]: (args, callback) => {

            const ctx = createContext(EDT_GET_TYPE_LIST, {});

            const auditInfo = [];
            const results = [];
            const faults = [];

            if (ctx && ctx.error) {
                return callback(ctx, {
                    faults,
                    auditInfo,
                    results
                });
            }

            return ws.send(handlers, ctx, (ctx) => {

                const {
                    response,
                } = ctx;

                try {
                    results.push(xml.parseTypeListResponse(response));
                }
                catch (e) {
                    faults.push(xml.parseEBSFault(response));
                }

                auditInfo.push(ctx.auditInfo);

                return callback(null, {
                    faults,
                    auditInfo,
                    results,
                });
            });
        },

        [HCV_REAL_TIME]: (args, callback) => {
            const ctx = createContext(HCV_REAL_TIME, args);

            const auditInfo = [];
            let results = [];
            const faults = [];

            return ws.send(hcvHandlers, ctx, (ctx) => {
                const {
                    response,
                } = ctx;

                try {
                    results = results.concat(xml.parseHCVResponse(response));
                }
                catch (e) {
                    faults.push(xml.parseEBSFault(response));
                }

                auditInfo.push(ctx.auditInfo);

                return callback(null, {
                    faults,
                    auditInfo,
                    results,
                });
            });
        }

    };
};

module.exports = EBSConnector;
