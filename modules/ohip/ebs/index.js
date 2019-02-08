const fs = require('fs');
const path = require('path');
const {
    select,
} = require('xpath');
const dom = require('xmldom').DOMParser;

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
const {
    decrypt,
    parseResourceResult,
    parseTypeListResult,
    parseDetail,
    parseDownloadResult,
} = require('./xml');
const ebsRequestTemplate = require('./ebsRequest');

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
        "key": fs.readFileSync(path.join(__dirname, 'certs/bar-mash.pem')).toString(),
    });

    const signature = new ws.Signature(x509);
    signature.addReference("//*[local-name(.)='EBS']");
    signature.addReference("//*[local-name(.)='IDP']");
    signature.addReference("//*[local-name(.)='UsernameToken']");
    signature.addReference("//*[local-name(.)='Timestamp']");
    signature.addReference("//*[local-name(.)='Body']");

    const handlers =  [
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
    const getContext = (serviceXML, apiUrl) => {

        return {
            request: ebsRequestTemplate({
                serviceXML: (serviceXML || ''),
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
            } = args;

            const ctx = getContext(EDT_UPLOAD(args));

            // TODO handle multiple attachments *correctly*
            // TODO this should probably be moved to getContext
            uploads.forEach((upload) => {
                ws.addAttachment(
                    ctx,
                    "request",
                    "//*[local-name(.)='content']",
                    upload.filename,
                     "text/plain"
                 );
            });

            ws.send(handlers, ctx, (ctx) => {

                const doc = new dom().parseFromString(ctx.response);
                return callback(null, parseResourceResult(doc));
            });
        },

        submit: (args, callback) => {

            const ctx = getContext(EDT_SUBMIT(args));

            return ws.send(handlers, ctx, (ctx) => {

                const doc = new dom().parseFromString(ctx.response);
                return callback(null, parseResourceResult(doc));
            });
        },

        info: (args, callback) => {

            const ctx = getContext(EDT_INFO(args));

            return ws.send(handlers, ctx, (ctx) => {

                const doc = new dom().parseFromString(ctx.response);
                return callback(null, parseDetail(doc));
            });
        },

        list: (args, callback) => {

            const ctx = getContext(EDT_LIST(args));

            return ws.send(handlers, ctx, (ctx) => {

                const doc = new dom().parseFromString(ctx.response);
                return callback(null, parseDetail(doc));
            });
        },

        download: (args, callback) => {
            const ctx = getContext(EDT_DOWNLOAD(args));

            return ws.send(handlers, ctx, (ctx) => {
                // const file = ws.getAttachment(ctx, "response", "//*[local-name(.)='content']");
                // console.log(ctx.response);
                const doc = new dom().parseFromString(ctx.response);
                return callback(null, parseDownloadResult(doc));
            });
        },


        delete: (args, callback) => {

            const ctx = getContext(EDT_DELETE(args));

            return ws.send(handlers, ctx, (ctx) => {

                const doc = new dom().parseFromString(ctx.response);
                return callback(null, parseResourceResult(doc));
            });
        },

        update: (args, callback) => {

            const {
                updates,
            } = args;

            const ctx = getContext(EDT_UPDATE(args));


            // TODO handle multiple attachments *correctly*
            // TODO this should probably be moved to getContext
            updates.forEach((update) => {
                ws.addAttachment(
                    ctx,
                    "request",
                    "//*[local-name(.)='content']",
                     update.filename,
                     "text/plain"
                 );
            });

            return ws.send(handlers, ctx, (ctx) => {

                const doc = new dom().parseFromString(ctx.response);
                return callback(null, parseResourceResult(doc));
            });
        },

        getTypeList: (args, callback) => {

            const ctx = getContext(EDT_GET_TYPE_LIST(args));

            return ws.send(handlers, ctx, (ctx) => {

                const doc = new dom().parseFromString(ctx.response);
                return callback(null, parseTypeListResult(doc));
            });
        },


    };
};

module.exports = EBSConnector;
