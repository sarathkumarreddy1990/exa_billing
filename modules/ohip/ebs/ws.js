const ws = require('ws.js');
const _ = require('lodash');
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
    promisify,
} = require('util');

const logger = require('../../../logger');

const xml = require('./xml');
const responseTemplates = require('./responseTemplate');

/*
 This needed to be overriden, too, since the base ws.js couldn't handle multiple
 attachments. The difference here is that instead of using 'file.xpath' to refer
 to a node, we're passing the node itself as 'file.elem'
*/
ws.Mtom.prototype.send = function(ctx, callback) {

    const self = this;
    const boundary = "exa_ebs_boundary";
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

        const binary = Buffer.from(file.content, 'base64');
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

    parts[0].body = Buffer.from(doc.toString());
    ctx.contentType = `multipart/related; type="application/xop+xml"; start="<part0>"; boundary="${boundary}"; start-info="${ctx.contentType}"; action="${ctx.action}"`;

    ctx.request = writer.build_multipart_body(parts, boundary);

    this.next.send(ctx, function(ctx) {
        self.receive(ctx, callback)
    })
};

ws.Mtom.prototype.receive = (ctx, callback) => {

    if (!ctx.resp_contentType) {
        // TODO not a big deal ... we could probably silence this
        logger.debug("warning: no content type in response");
        callback(ctx);
        return;
    }

    const boundary = utils.parseBoundary(ctx.resp_contentType);
    if (!boundary) {
        // TODO not a big deal ... we could probably silence this
        logger.debug("warning: no boundary in response");
        callback(ctx);
        return;
    }

    //use slice() since in http multipart response the first chars are #13#10 which the parser does not expect
    const parts = reader.parse_multipart(ctx.response.slice(2), boundary);

    if (parts.length==0) {
        // TODO not a big deal ... we could probably silence this
        logger.debug("warning: no mime parts in response");
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
        // xpath: xpath,    // NOTE upstream implementation uses xpath
        elem,               // it would be nice to know enough xpath to
                            // target specific element indexes :P
        contentType,
        content,
    });

};

const decrypt = (encryptedKey, encryptedContent, pemfile) => {

    encryptedKey = Buffer.from(encryptedKey, 'base64').toString('binary');

    const private_key = pki.privateKeyFromPem(pemfile.toString());

    const decryptedKey = Buffer.from(private_key.decrypt(encryptedKey, 'RSAES-PKCS1-V1_5'), 'binary');

    encryptedContent = Buffer.from(encryptedContent, 'base64');

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

    return Buffer.from(decryptedContent, 'binary').toString('utf8');
};


ws.Xenc = function(config) {
    this.config = config;
};

ws.Xenc.prototype.send = function(ctx, callback) {
    const pemfile = this.config.pemfile;
    this.next.send(ctx, function(ctx) {

        const doc = new dom().parseFromString(ctx.response.toString());
        const bodyNode = select("//*[local-name(.)='Body']", doc)[0];

        try {
            const encryptedKeyNodes = select("//*[local-name(.)='EncryptedKey']", doc);
            const encryptedKeyValueNodes = select("//*[local-name(.)='CipherData']/*[local-name(.)='CipherValue']/text()", encryptedKeyNodes[0]);
            const encryptedBodyDataNode = select("//*[local-name(.)='EncryptedData']/*[local-name(.)='CipherData']/*[local-name(.)='CipherValue']/text()", bodyNode)[0];
            const decryptedData = decrypt(encryptedKeyValueNodes[0].nodeValue, encryptedBodyDataNode.nodeValue, pemfile);

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
                const decryptedContent = decrypt(encryptedKeyValue, ctx.data[contentURI.slice(4)], pemfile).toString('binary');

                const contentNode = select(`//*[@href='${contentURI}']//parent::*`, bodyNode)[0];
                contentNode.removeChild(contentNode.firstChild);
                utils.setElementValue(doc, contentNode, decryptedContent);

            }


        } catch(e) {
            logger.warn(`Xenc ${e}`);
        }

        ctx.response = doc.toString();

        callback(ctx);
    });
};


ws.Audit = function(config) {
    this.config = config;
};
ws.Audit.prototype.send = function(ctx, callback) {

    const requestDoc = new dom().parseFromString(ctx.request);

    const auditInfo = {

        requestAuditID: ctx.auditID,

        // date / time
        dateTime: new Date(),

        // Service User
        serviceUserMUID: ctx.serviceUserMUID,

        // End User identifier
        endUser: ctx.endUser,

        eventDetail: ctx.eventDetail,
    };

    this.next.send(ctx, (ctx) => {

        // duration
        auditInfo.duration = (new Date()).getTime() - auditInfo.dateTime.getTime();

        const doc = new dom().parseFromString(ctx.response);
        const auditIDNode = select("//*[local-name(.)='auditID']/text()", doc)[0];
        const auditUIDNode = select("//*[local-name(.)='auditUID']/text()", doc)[0];
        const parseObj = auditIDNode || auditUIDNode;

        auditInfo.responseAuditID = parseObj ? parseObj.nodeValue : '';

        auditInfo.successful = true;   // assume true ...
        auditInfo.exitInfo = [];
        auditInfo.errorMessages = [];

        const faultNode = select("//*[local-name(.)='Fault']", doc)[0];
        if (faultNode) {
            auditInfo.successful = false;   // ... until proven otherwise
            const fault = xml.parseEBSFault(ctx.response);

            auditInfo.exitInfo.push(`${fault.faultcode}/${fault.code}`);
            auditInfo.errorMessages.push(`${fault.faultstring}/${fault.message}`);
        }
        else {
            const commonResultNode = select("//*[local-name(.)='result']", doc);
            auditInfo.exitInfo = _.uniqBy(commonResultNode.map((resultNode) => {
                return {
                    code: select("*[local-name(.)='code']/text()", resultNode)[0].nodeValue,
                    message: select("*[local-name(.)='msg']/text()", resultNode)[0].nodeValue,
                };
            }), 'code').reduce((exitInfo, info) => {
                exitInfo.push(`${info.code}/${info.message}`);
                return exitInfo;
            }, []);
        }

        ctx.auditInfo = auditInfo;
        logger.info(`EBS audit info`, auditInfo);

        callback(ctx);
    });
};


ws.Nerf = function(config) {
    this.config = config;
};

ws.Nerf.prototype.send = function(ctx, callback) {
    ctx.response = responseTemplates[Object.keys(ctx.eventDetail)[0]](ctx);
    logger.debug('NERF request', ctx.request);
    logger.debug('NERF response', ctx.response);
    callback(ctx);
};


module.exports = ws;
