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
            const encryptedKeyNode = select("//*[local-name(.)='EncryptedKey']/*[local-name(.)='CipherData']/*[local-name(.)='CipherValue']/text()", doc);
            const encryptedDataNode = select("//*[local-name(.)='EncryptedData']/*[local-name(.)='CipherData']/*[local-name(.)='CipherValue']/text()", doc)[0];
            const decryptedData = decrypt(encryptedKeyNode[0].nodeValue, encryptedDataNode.nodeValue);

            const newNode = new dom().parseFromString(decryptedData);
            bodyNode.replaceChild(
                newNode,
                select("//*[local-name(.)='downloadResponse']", doc)[0]
            );

            // NOTE collaboration with Mtom
            if (encryptedKeyNode.length == 2) {

                for (let key in ctx.data) {
                    const xpath = "//*[@href='cid:" + key + "']//parent::*";
                    const contentNode = select(xpath, bodyNode)[0];

                    if (!contentNode) {
                        continue;
                    }

                    const decryptedContent = decrypt(encryptedKeyNode[1].nodeValue, ctx.data[key]).toString('binary');

                    contentNode.removeChild(contentNode.firstChild);
                    utils.setElementValue(doc, contentNode, decryptedContent);
                }
            }

            ctx.response = doc.toString();
        } catch(e) {
            console.log(`error: ${e}`);
        }
        callback(ctx);
    });
};


module.exports = ws;
