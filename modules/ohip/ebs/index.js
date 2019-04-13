const fs = require('fs');
const path = require('path');
const uuid = require('uuid/v1');

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
    EDT_GET_TYPE_LIST,
    EDT_UPLOAD,
    EDT_SUBMIT,
    EDT_INFO,
    EDT_LIST,
    EDT_DOWNLOAD,
    EDT_DELETE,
    EDT_UPDATE,
    HCV,

} = require('./service');
const xml = require('./xml');
const requestTemplate = require('./requestTemplate');

// const hcvRequestTemplate = require('./hcvRequest');

const {
    UPLOAD_MAX,
    UPDATE_MAX,
    DELETE_MAX,
    SUBMIT_MAX,
    DOWNLOAD_MAX,
    INFO_MAX,
} = require('./constants');

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

        const isHCV = (service === HCV);

        return {
            request: requestTemplate({
                    serviceXML: (service(serviceParams) || DEFAULT_SERVICE_XML),
                    softwareConformanceKey: isHCV ? config.hcvSoftwareConformanceKey : config.edtSoftwareConformanceKey,
                    auditID: uuid(),
                    serviceUserMUID: config.serviceUserMUID,
                }),

            url: isHCV ? hcvServiceEndpoint : edtServiceEndpoint,
            contentType: 'text/xml',
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
        upload: (args, callback) => {

            const {
                uploads,
                unsafe,
            } = args;

            const faults = [];
            const auditInfo = [];
            const results = [];

            const chunkSize = unsafe ? uploads.length : UPLOAD_MAX;

            chunk(uploads, chunkSize).forEach((chunk, chunkIndex, chunks) => {

                const uploadStr = chunk.map((upload) => {
                    const filename = path.basename(upload.filename);
                    const description = (upload.description === filename) ? '' : (upload.description || '');
                    return `${upload.resourceType} ${filename} ${description}`.trim();
                }).join('|');

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
                        audit,
                        response,
                    } = ctx;

                    let resourceIDs = [];
                    try {
                        const result = xml.parseUploadResponse(response);
                        audit.successful = true;
                        resourceIDs = result.response.map((response) => {
                            return response.resourceID;
                        });
                        results.push(result);
                    }
                    catch (e) {
                        faults.push(xml.parseEBSFault(response));
                    }
                    audit.actionDetail = `upload [${uploadStr}]: [${resourceIDs.join(',')}]`;
                    auditInfo.push(audit);

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

        submit: (args, callback) => {

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
                        audit,
                        response,
                    } = ctx;

                    const rids = chunk.map((resourceID) => {
                        return parseInt(resourceID);
                    }).join(',');

                    try {
                        results.push(xml.parseSubmitResponse(response));
                        audit.successful = true;
                    }
                    catch (e) {
                        faults.push(xml.parseEBSFault(response));
                    }
                    audit.actionDetail = `submit: [${rids}]`;
                    auditInfo.push(audit);

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

        info: (args, callback) => {
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
                        audit,
                        response,
                    } = ctx;

                    const rids = chunk.map((resourceID) => {
                        return parseInt(resourceID);
                    }).join(',');

                    try {
                        results.push(xml.parseInfoResponse(response));
                        audit.successful = true;
                    }
                    catch (e) {
                        faults.push(xml.parseEBSFault(response));
                    }

                    audit.actionDetail = `info: [${rids}]`;
                    auditInfo.push(audit);

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

        list: (args, callback) => {
            const ctx = createContext(EDT_LIST, args);

            const auditInfo = [];
            const results = [];
            const faults = [];

            return ws.send(handlers, ctx, (ctx) => {

                const {
                    audit,
                    response,
                } = ctx;

                try {
                    const listResponse = xml.parseListResponse(response);
                    // if (listResponse) {
                        results.push(listResponse);
                        audit.successful = true;
                    // }
                }
                catch (e) {
                    faults.push(xml.parseEBSFault(response));
                }

                audit.actionDetail = `list: [${args.resourceType || ''} ${args.status || ''}]`;
                auditInfo.push(audit);

                return callback(null, {
                    faults,
                    auditInfo,
                    results,
                });
            });
        },

        download: (args, callback) => {
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
                        audit,
                        response,
                    } = ctx;

                    const rids = chunk.map((resourceID) => {
                        return parseInt(resourceID);
                    }).join(',');

                    try {
                        const r = xml.parseDownloadResponse(response);
                        results.push(r);
                        audit.successful = true;
                    }
                    catch (e) {
                        faults.push(xml.parseEBSFault(response));
                    }

                    audit.actionDetail = `download: [${rids}]`;
                    auditInfo.push(audit);

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


        delete: (args, callback) => {

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
                        audit,
                        response,
                    } = ctx;

                    const rids = chunk.map((resourceID) => {
                        return parseInt(resourceID);
                    }).join(',');
                    audit.actionDetail = `delete: [${rids}]`;

                    try {
                        results.push(xml.parseDeleteResponse(response));
                        audit.successful = true;
                    }
                    catch (e) {
                        faults.push(xml.parseEBSFault(response));
                    }

                    auditInfo.push(audit);

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

        update: (args, callback) => {

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
                        audit,
                        response,
                    } = ctx;

                    const updateStr = chunk.map((update) => {
                        return `${path.basename(update.filename)} ${update.resourceID}`;
                    }).join('|');

                    audit.actionDetail = `update: [${updateStr}]`;

                    try {
                        results.push(xml.parseUpdateResponse(response));
                        audit.successful = true;
                    }
                    catch (e) {
                        faults.push(xml.parseEBSFault(response));
                    }
                    auditInfo.push(audit);

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

        getTypeList: (args, callback) => {

            const ctx = createContext(EDT_GET_TYPE_LIST, args);

            const auditInfo = [];
            const results = [];
            const faults = [];

            return ws.send(handlers, ctx, (ctx) => {

                const {
                    audit,
                    response,
                } = ctx;

                audit.actionDetail = `getTypeList`;

                try {
                    results.push(xml.parseTypeListResponse(response));
                    audit.successful = true;
                }
                catch (e) {
                    faults.push(xml.parseEBSFault(response));
                }

                auditInfo.push(audit);

                return callback(null, {
                    faults,
                    auditInfo,
                    results,
                });
            });
        },

        validateHealthCard: (args, callback) => {
            const ctx = createContext(HCV, args);

            const auditInfo = [];
            let results = [];
            const faults = [];

            return ws.send(hcvHandlers, ctx, (ctx) => {
                const {
                    audit,
                    response,
                } = ctx;

                audit.actionDetail = `validateHealthCard`;

                try {
                    results = results.concat(xml.parseHCVResponse(response));
                    audit.successful = true;
                }
                catch (e) {
                    faults.push(xml.parseEBSFault(response));
                }

                auditInfo.push(audit);

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
