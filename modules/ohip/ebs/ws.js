const ws = require('ws.js');
const utils = require('ws.js/lib/utils');
const writer = require('ws.js/lib/handlers/client/mtom/mime-writer.js');
const reader = require('ws.js/lib/handlers/client/mtom/mime-reader.js');
const {
    select,
} = require('xpath');
const dom = require('xmldom').DOMParser;

const pki = require('node-forge').pki;
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const {
    parseAuditLogDetails,
} = require('./xml');

/*
 This needed to be overriden, too, since the base ws.js couldn't handle multiple
 attachments. The difference here is that instead of using 'file.xpath' to refer
 to a node, we're passing the node itself as 'file.elem'
*/
ws.Mtom.prototype.send = function(ctx, callback) {

    const self = this
    boundary = "exa_ebs_boundary"
    const parts = [
        {
            id: "part0",
            contentType: `application/xop+xml;charset=utf-8;type="${ctx.contentType}"`,
            encoding: '8bit',
        },
    ];
    const doc = new dom().parseFromString(ctx.request);

    for (let i in ctx.base64Elements) {
        const file = ctx.base64Elements[i];
		// var elem = select(doc, file.xpath)[0];

        const binary = new Buffer(file.content, 'base64');
		const id = `part${parseInt(i) + 1}`;

        parts.push({
            id,
            contentType: file.contentType,
            body: binary,
            encoding: 'binary',
            attachment: true,
        });

        file.elem.removeChild(file.elem.firstChild);
        utils.appendElement(doc, file.elem, 'http://www.w3.org/2004/08/xop/include', 'xop:Include');
        file.elem.firstChild.setAttribute('xmlns:xop', 'http://www.w3.org/2004/08/xop/include');
        file.elem.firstChild.setAttribute('href', `cid: ${id}`);
    }

    parts[0].body = new Buffer(doc.toString());
    ctx.contentType = `multipart/related; type="application/xop+xml"; start="<part0>"; boundary="${boundary}"; start-info="${ctx.contentType}"; action="${ctx.action}"`;

    ctx.request = writer.build_multipart_body(parts, boundary);

    this.next.send(ctx, function(ctx) {
        self.receive(ctx, callback)
    })
};

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



ws.addAttachment = (ctx, property, xpath, file, contentType, index) => {
    const prop = ctx[property];
    const doc = new dom().parseFromString(prop);
    const elem = select(xpath, doc)[index];
    const content = fs.readFileSync(file).toString("base64");

    utils.setElementValue(doc, elem, content);
    ctx[property] = doc.toString();
    if (!ctx.base64Elements) {
        ctx.base64Elements = [];
    }
    ctx.base64Elements.push({
        // xpath: xpath,
        elem,
        contentType,
        content,
    });
};

// TODO: EXA-12673
// TODO remember to refactor this into shared library with EBSConnector
const PEMFILE = fs.readFileSync(path.join(__dirname, 'certs/exa-ebs.pem')).toString();

const decrypt = (encryptedKey, encryptedContent) => {

    encryptedKey = new Buffer(encryptedKey, 'base64').toString('binary');

    const private_key = pki.privateKeyFromPem(PEMFILE);

    const decryptedKey = new Buffer(private_key.decrypt(encryptedKey, 'RSAES-PKCS1-V1_5'), 'binary');

    encryptedContent = new Buffer(encryptedContent, 'base64');

    const decipher = crypto.createDecipheriv('aes-128-cbc', decryptedKey, encryptedContent.slice(0,16));
    decipher.setAutoPadding(false);

    let decryptedContent = decipher.update(encryptedContent.slice(16), null, 'binary') + decipher.final('binary');

    // Remove padding bytes equal to the value of the last byte of the returned data.
    const padding = decryptedContent.charCodeAt(decryptedContent.length - 1);
    if (1 <= padding && padding <= 16) {
        decryptedContent = decryptedContent.substr(0, decryptedContent.length - padding);
    } else {
        throw new Error('padding length invalid');
    }

    return new Buffer(decryptedContent, 'binary').toString('utf8');
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

            bodyNode.firstChild.replaceChild(
                newNode,
                bodyNode.firstChild.firstChild
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


        } catch(e) {
            console.log(`error: ${e}`);
        }

        ctx.response = doc.toString();

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

        const doc = new dom().parseFromString(ctx.response);
        const parseObj = parseAuditLogDetails(doc);
        ctx.audit = {
            // Simple success or failure
            result: parseObj.msg,

            // Exit status / messages
            status: parseObj.code,

            auditID: parseObj.auditID,

            // TODO
            // Error messages

            ...ctx.audit,
        };
        callback(ctx);
    });
};



module.exports = ws;
