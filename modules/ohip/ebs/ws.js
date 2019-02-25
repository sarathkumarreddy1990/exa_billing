const ws = require('ws.js');
const utils = require('ws.js/lib/utils');
const writer = require('ws.js/lib/handlers/client/mtom/mime-writer.js');
const reader = require('ws.js/lib/handlers/client/mtom/mime-reader.js');
const {
    select,
} = require('xpath');
const dom = require('xmldom').DOMParser;

const {
    decrypt,
    parseAuditLogDetails,
} = require('./xml');


ws.Mtom.prototype.receive = (ctx, callback) => {

    if (!ctx.resp_contentType) {
        // TODO not a big deal ... we could probably silence this
        console.log("warning: no content type in response");
        callback(ctx);
        return;
    }

    const boundary = utils.parseBoundary(ctx.resp_contentType);
    if (!boundary) {
        // TODO not a big deal ... we could probably silence this
        console.log("warning: no boundary in response");
        callback(ctx);
        return;
    }

    //use slice() since in http multipart response the first chars are #13#10 which the parser does not expect
    const parts = reader.parse_multipart(ctx.response.slice(2), boundary);

    if (parts.length==0) {
        // TODO not a big deal ... we could probably silence this
        console.log("warning: no mime parts in response");
        callback(ctx);
        return;
    }

    const doc = new dom().parseFromString(parts[0].data.toString());

    ctx.data = {};  // NOTE

    for (let i in parts) {
        const part = parts[i];
        const id = utils.extractContentId(part.headers["content-id"] );
        ctx.data[id] = part.data.toString("base64"); // NOTE
    }

    ctx.response = doc.toString();
    callback(ctx);
};


ws.Xenc = function() {};

ws.Xenc.prototype.send = function(ctx, callback) {

    this.next.send(ctx, function(ctx) {

        const doc = new dom().parseFromString(ctx.response.toString());
        const bodyNode = select("//*[local-name(.)='Body']", doc)[0];

        try {
            const encryptedKeyNodes = select("//*[local-name(.)='EncryptedKey']", doc);
            const encryptedKeyValueNodes = select("//*[local-name(.)='CipherData']/*[local-name(.)='CipherValue']/text()", encryptedKeyNodes[0]);
            const encryptedBodyDataNode = select("//*[local-name(.)='EncryptedData']/*[local-name(.)='CipherData']/*[local-name(.)='CipherValue']/text()", bodyNode)[0];
            const decryptedData = decrypt(encryptedKeyValueNodes[0].nodeValue, encryptedBodyDataNode.nodeValue);

            encryptedKeyNodes.splice(0, 1);

            const newNode = new dom().parseFromString(decryptedData);
            bodyNode.replaceChild(
                newNode,
                select("//*[local-name(.)='downloadResponse']", bodyNode)[0]
            );

            // NOTE collaboration with Mtom
            for (let i = 0; i < encryptedKeyNodes.length; i++) {
                const encryptedKeyNode = encryptedKeyNodes[i];
                const dataURI = select("*[local-name(.)='ReferenceList']/*[local-name(.)='DataReference']/@URI", encryptedKeyNode)[0].nodeValue;

                // dataURI has an annoying'#' at the beginning so we pop it off
                const cipherRefNode = select(`//*[@Id='${dataURI.slice(1)}']/*[local-name(.)='CipherData']/*[local-name(.)='CipherReference']/@URI`, doc);

                const contentURI = decodeURIComponent(cipherRefNode[0].nodeValue);

                const encryptedKeyValue = select("*[local-name(.)='CipherData']/*[local-name(.)='CipherValue']/text()", encryptedKeyNode)[0].nodeValue;

                // contentURI has 'cid:' at the beginning so pop it off
                const decryptedContent = decrypt(encryptedKeyValue, ctx.data[contentURI.slice(4)]).toString('binary');

                const contentNode = select(`//*[@href='${contentURI}']//parent::*`, bodyNode)[0];
                contentNode.removeChild(contentNode.firstChild);
                utils.setElementValue(doc, contentNode, decryptedContent);
            }

            ctx.response = doc.toString();

        } catch(e) {
            console.log(`error: ${e}`);
        }
        callback(ctx);
    });
};


ws.Audit = function(config) {
    this.config = config;
};
ws.Audit.prototype.send = function(ctx, callback) {

    ctx.audit = {

        // date / time
        dateTime: new Date(),

        // Service User
        serviceUserMUID: this.config.serviceUserMUID,

        // End User identifier
        // TODO

        // Action / event detail
        // TODO
    };

    this.next.send(ctx, (ctx) => {

        // duration
        ctx.audit.duration = (new Date()).getTime() - ctx.audit.dateTime.getTime();

        const doc = new dom().parseFromString(ctx.response)
        const parseObj = parseAuditLogDetails(doc);

        ctx.audit = {
            // Simple success or failure
            result: parseObj.msg,

            // Exit status / messages
            status: parseObj.code,

            // TODO
            // Error messages

            ...ctx.audit,
        };
        callback(ctx);
    });
};



module.exports = ws;
