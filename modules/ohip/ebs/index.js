const fs = require('fs');
const path = require('path');
const uuid = require('uuid/v1');
const logger = require('../../../logger');
const {
    chunk,
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
        new Xenc({
            pemfile,
        }),
        new Security(
            {}
            , [x509, auth, signature]
        ),
        new Mtom(),
        new Http(),
    ];

    // TODO this is an unnacceptable workaround and absolutely nothing further must depend upon this
    const hcvHandlers =  [
        new Audit(config),    // NOTE order in list affects duration
        new Xenc({
            pemfile,
        }),
        new Security(
            {}
            , [x509, auth, signature]
        ),
        // new Mtom(),
        new Http(),
    ];
    /**
     * const createContext - description
     *
     * @param  {type} serviceXML description
     * @param  {type} apiUrl     description
     * @return {type}            description
     */
    const createContext = (service, serviceParams) => {

        const isHCV = (service === HCV_REAL_TIME);

        const serviceUserMUID = config.serviceUserMUID;

        const url = isHCV ? hcvServiceEndpoint : edtServiceEndpoint;
        logger.debug('EBS request context url', url);

        const auditID = uuid();
        logger.debug('EBS request context auditID', auditID);

        const serviceXML = (serviceTemplate[service](serviceParams));
        logger.debug('EBS request XML', serviceXML);

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
            } = args;

            const faults = [];
            const auditInfo = [];
            const results = [];

            const chunkSize = unsafe ? uploads.length : UPLOAD_MAX;

            chunk(uploads, chunkSize).forEach((chunk, chunkIndex, chunks) => {

                const ctx = createContext(EDT_UPLOAD, {uploads: chunk});

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
            } = args;

            const auditInfo = [];
            const results = [];
            const faults = [];

            chunk(resourceIDs, SUBMIT_MAX).forEach((chunk, index, chunks) => {

                const ctx = createContext(EDT_SUBMIT, {resourceIDs: chunk});

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
            } = args;

            const faults = [];
            const auditInfo = [];
            const results = [];

            chunk(resourceIDs, INFO_MAX).forEach((chunk, index, chunks) => {

                // TODO remove this cludgy hack after Conformance Testing is over

                const ctx = createContext(EDT_INFO, {resourceIDs: (chunk[0] === '-1') ? [] : chunk});

                return ws.send(handlers, ctx, (ctx) => {

                    const {
                        response,
                    } = ctx;

                    try {
                        results.push(xml.parseInfoResponse(response));
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

        [EDT_LIST]: (args, callback) => {
            const {
                resourceType,
                status,
                pageNo,
            } = args;
            const ctx = createContext(EDT_LIST, {resourceType, status, pageNo});

            const auditInfo = [];
            const results = [];
            const faults = [];

            return ws.send(handlers, ctx, (ctx) => {

                const {
                    response,
                } = ctx;

                try {
                    results.push(xml.parseListResponse(response));
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

        [EDT_DOWNLOAD]: (args, callback) => {
            const {
                resourceIDs,
                unsafe,
            } = args;

            const auditInfo = [];
            const results = [];
            const faults = [];

            const chunkSize = unsafe ? resourceIDs.length : DOWNLOAD_MAX;

            chunk(resourceIDs, chunkSize).forEach((chunk, chunkIndex, chunks) => {

                const ctx = createContext(EDT_DOWNLOAD, {resourceIDs: chunk});

                return ws.send(handlers, ctx, (ctx) => {

                    const {
                        response,
                    } = ctx;

                    try {
                        results.push(xml.parseDownloadResponse(response));
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


        [EDT_DELETE]: (args, callback) => {

            const {
                resourceIDs,
            } = args;

            const auditInfo = [];
            const results = [];
            const faults = [];

            chunk(resourceIDs, DELETE_MAX).forEach((chunk, chunkIndex, chunks) => {

                const ctx = createContext(EDT_DELETE, {resourceIDs: chunk});

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
                        return callback(null, {
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
