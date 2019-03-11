const fs = require('fs');
const path = require('path');
const {
    select,
} = require('xpath');
const dom = require('xmldom').DOMParser;
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
    HCV_BASIC_VALIDATE,
} = require('./service');
const xml = require('./xml');
const ebsRequestTemplate = require('./ebsRequest');

const {
    UPLOAD_MAX,
    UPDATE_MAX,
    DELETE_MAX,
    SUBMIT_MAX,
    DOWNLOAD_MAX,
    INFO_MAX,
} = require('./constants');

const edtApiUrl = 'https://ws.conf.ebs.health.gov.on.ca:1443/EDTService/EDTService';
const hcvApiUrl = 'https://ws.conf.ebs.health.gov.on.ca:1444/HCVService/HCValidationService';



const EBSConnector = function(config) {

    const ebsRequestData = {
        softwareConformanceKey: config.softwareConformanceKey,
        auditID: config.auditID,
        serviceUserMUID: config.serviceUserMUID,
    };

    const auth = new UsernameToken({
        username: config.username,
        password: config.password,
    });


    const x509 = new X509BinarySecurityToken({
        // TODO: EXA-12673
        // TODO experiment using just the keys or certificates (no "mash")
        // TODO experiment using simple signed certificates (this is made from )
        "key": fs.readFileSync(path.join(__dirname, 'certs/exa-ebs.pem')).toString(),
    });

    const signature = new ws.Signature(x509);
    signature.addReference("//*[local-name(.)='EBS']");
    signature.addReference("//*[local-name(.)='IDP']");
    signature.addReference("//*[local-name(.)='UsernameToken']");
    signature.addReference("//*[local-name(.)='Timestamp']");
    signature.addReference("//*[local-name(.)='Body']");

    const handlers =  [
        new Audit(config),    // NOTE order in list affects duration
        new Xenc(),
        new Security({}, [x509, auth, signature]),
        new Mtom(),
        new Http(),
    ];

    /**
     * const getContext - description
     *
     * @param  {type} serviceXML description
     * @param  {type} apiUrl     description
     * @return {type}            description
     */
    const getContext = (service, serviceParams, apiUrl) => {

        return {
            request: ebsRequestTemplate({
                serviceXML: (service(serviceParams) || ''),
                ...ebsRequestData
            }),
            url: (apiUrl || edtApiUrl),
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

            const auditInfo = [];
            let results = [];

            const chunkSize = unsafe ? uploads.length : UPLOAD_MAX;

            chunk(uploads, chunkSize).forEach((chunk, index, chunks) => {

                const ctx = getContext(EDT_UPLOAD, {uploads: chunk});

                chunk.forEach((upload, index) => {
                    ws.addAttachment(
                        ctx,
                        "request",
                        "//*[local-name(.)='content']",
                        upload.filename,
                         "text/plain",
                         index
                     );
                });

                ws.send(handlers, ctx, (ctx) => {

                    const doc = new dom().parseFromString(ctx.response);

                    try {
                        return callback(null, {
                            faults: [],
                            auditInfo: [ctx.audit],
                            results: [xml.parseUploadResponse(doc)],
                        });
                    }
                    catch (e) {
                        return callback(null, {
                            faults: [xml.parseEBSFault(doc)],
                            auditInfo: [ctx.audit],
                            results: [],
                        });
                    }
                });
            });
        },

        submit: (args, callback) => {

            const {
                resourceIDs,
            } = args;

            const auditInfo = [];
            let results = [];
            let faults = [];

            chunk(resourceIDs, SUBMIT_MAX).forEach((chunk, index, chunks) => {

                const ctx = getContext(EDT_SUBMIT, {resourceIDs: chunk});

                return ws.send(handlers, ctx, (ctx) => {

                    const doc = new dom().parseFromString(ctx.response);

                    try {
                        auditInfo.push(ctx.audit);
                        results = results.concat(xml.parseSubmitResponse(doc));
                    }
                    catch (e) {

                        faults.push(xml.parseEBSFault(doc))
                    }

                    if (index === (chunks.length - 1)) {
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
            let results = [];

            chunk(resourceIDs, INFO_MAX).forEach((chunk, index, chunks) => {

                const ctx = getContext(EDT_INFO, {resourceIDs: chunk});

                return ws.send(handlers, ctx, (ctx) => {

                    const doc = new dom().parseFromString(ctx.response);

                    try {
                        auditInfo.push(ctx.audit);
                        results = results.concat(xml.parseInfoResponse(doc));
                    }
                    catch (e) {
                        faults.push(xml.parseEBSFault(doc))
                    }

                    if (index === (chunks.length - 1)) {
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

            const ctx = getContext(EDT_LIST, args);

            return ws.send(handlers, ctx, (ctx) => {

                const doc = new dom().parseFromString(ctx.response);

                try {
                    return callback(null, {
                        faults: [],
                        auditInfo: [ctx.audit],
                        results: [xml.parseListResponse(doc)],
                    });
                }
                catch (e) {
                    console.log('caught exception: ', e);
                    return callback(null, {
                        faults: [xml.parseEBSFault(doc)],
                        auditInfo: [],
                        results: [],
                    });
                }
            });
        },

        download: (args, callback) => {
            const {
                resourceIDs,
                unsafe,
            } = args;

            const auditInfo = [];
            let results = [];


            const chunkSize = unsafe ? resourceIDs.length : DOWNLOAD_MAX;

            chunk(resourceIDs, chunkSize).forEach((chunk, index, chunks) => {

                const ctx = getContext(EDT_DOWNLOAD, {resourceIDs: chunk});

                return ws.send(handlers, ctx, (ctx) => {

                    const doc = new dom().parseFromString(ctx.response);
                    // console.log(ctx.response);
                    try {
                        return callback(null, {
                            faults: [],
                            auditInfo: [ctx.audit],
                            results: [xml.parseDownloadResponse(doc)],
                        });
                    }
                    catch (e) {
                        console.log('caught exception: ', e);

                        return callback(null, {
                            faults: [xml.parseEBSFault(doc)],
                            auditInfo: [],
                            results: [],
                        });
                    }
                });
            });
        },


        delete: (args, callback) => {

            const {
                resourceIDs,
            } = args;

            const auditInfo = [];
            let results = [];

            chunk(resourceIDs, DELETE_MAX).forEach((chunk, index, chunks) => {

                const ctx = getContext(EDT_DELETE, {resourceIDs: chunk});

                return ws.send(handlers, ctx, (ctx) => {
                    const doc = new dom().parseFromString(ctx.response);
                    try {
                        const auditInfo = [ctx.audit];
                        return callback(null, {
                            faults: [],
                            auditInfo: [ctx.audit],
                            results: [xml.parseDeleteResponse(doc)],
                        });
                    }
                    catch (e) {
                        return callback(null, {
                            faults: [xml.parseEBSFault(doc)],
                            auditInfo: [],
                            results: [],
                        });
                    }

                });
            });
        },

        update: (args, callback) => {

            const {
                updates,
                unsafe,
            } = args;

            const auditInfo = [];
            let results = [];


            const chunkSize = unsafe ? updates.length : UPDATE_MAX;
            chunk(updates, chunkSize).forEach((chunk, index, chunks) => {

                const ctx = getContext(EDT_UPDATE, {updates:chunk});

                updates.forEach((update, index) => {
                    ws.addAttachment(
                        ctx,
                        "request",
                        "//*[local-name(.)='content']",
                         update.filename,
                         "text/plain",
                         index
                     );
                });

                return ws.send(handlers, ctx, (ctx) => {

                    const doc = new dom().parseFromString(ctx.response);
                    try {
                        return callback(null, {
                            faults: [],
                            auditInfo: [ctx.audit],
                            results: [xml.parseUpdateResponse(doc)],
                        });
                    }
                    catch (e) {
                        return callback(null, {
                            faults: [xml.parseEBSFault(doc)],
                            auditInfo: [],
                            results: [],
                        });
                    }
                });
            });
        },

        getTypeList: (args, callback) => {

            const ctx = getContext(EDT_GET_TYPE_LIST, args);

            return ws.send(handlers, ctx, (ctx) => {

                const doc = new dom().parseFromString(ctx.response);
                try {
                    return callback(null, {
                        faults: [],
                        auditInfo: [ctx.audit],
                        results: [xml.parseTypeListResponse(doc)],
                    });
                }
                catch (e) {
                    return callback(null, {
                        faults: [xml.parseEBSFault(doc)],
                        auditInfo: [],
                        results: [],
                    });
                }
            });
        },

        hcvValidation: (args, callback) => {
            const ctx = getContext(HCV_BASIC_VALIDATE, args, hcvApiUrl);

            return ws.send(handlers, ctx, (ctx) => {
                const doc = new dom().parseFromString(ctx.response);
                return callback(null, xml.parseTypeListResult(doc));
            });
        }

    };
};

module.exports = EBSConnector;
