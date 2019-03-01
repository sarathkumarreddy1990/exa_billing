// TODO - parse audit-log stuff into each result instead of separately

const pki = require('node-forge').pki;
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const dom = require('xmldom').DOMParser;
const {
    select,
} = require('xpath');


// TODO: EXA-12673
// TODO remember to refactor this into shared library with EBSConnector
const PEMFILE = fs.readFileSync(path.join(__dirname, 'certs/bar-mash.pem')).toString();

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

const parseAuditID = (doc) => {
    return select("*[local-name(.)='auditID']/text()", doc)[0].nodeValue;
};

const parseStatus = (doc) => {
    return select("*[local-name(.)='status']/text()", doc)[0].nodeValue;
};

const parseResourceID = (doc) => {
    return select("*[local-name(.)='resourceID']/text()", doc)[0].nodeValue;
};

const parseOptionalValue = (doc, name) => {
    const optionalNode = select(`*[local-name(.)='${name}']/text()`, doc);
    return optionalNode.length ? optionalNode[0].nodeValue : '';
};

const parseCommonResult = (doc) => {
    return {
        code: select("//*[local-name(.)='code']/text()", doc)[0].nodeValue,
        msg:  select("//*[local-name(.)='msg']/text()", doc)[0].nodeValue,
    };
};


const parseDetailData = (doc) => {
    const detailData = {
        createTimestamp: select("*[local-name(.)='createTimestamp']/text()", doc)[0].nodeValue,
        resourceID: parseResourceID(doc),
        status: parseStatus(doc),

        description: parseOptionalValue(doc, 'description'),
        resourceType: parseOptionalValue(doc, 'resourceType'),
        modifyTimestamp: parseOptionalValue(doc, 'modifyTimestamp'),

        ...parseCommonResult(select("*[local-name(.)='result']", doc)[0])
    };

    return detailData;
};

const parseCSNData = (doc) => {
    return {
        soloCsn: parseOptionalValue(doc, 'soloCsn'),
        groupCsn: parseOptionalValue(doc, 'groupCsn')
    };
};

const parseTypeListData = (doc) => {

    return {
        access: select("*[local-name(.)='access']/text()", doc)[0].nodeValue,
        descriptionEn: select("*[local-name(.)='descriptionEn']/text()", doc)[0].nodeValue,
        descriptionFr: select("*[local-name(.)='descriptionFr']/text()", doc)[0].nodeValue,
        groupRequired: select("*[local-name(.)='groupRequired']/text()", doc)[0].nodeValue,
        resourceType: select("*[local-name(.)='resourceType']/text()", doc)[0].nodeValue,

        csns: select("*[local-name(.)='csns']/text()", doc).map((csnDataNode) => {
            return parseCSNData(csnDataNode);
        }),

        ...parseCommonResult(select("*[local-name(.)='result']", doc)[0])
    };
};

const parseDownloadData = (doc) => {

    return {
        content: select("*[local-name(.)='content']/text()", doc)[0].nodeValue.toString('base64'),
        resourceID: select("*[local-name(.)='resourceID']/text()", doc)[0].nodeValue,
        resourceType: select("*[local-name(.)='resourceType']/text()", doc)[0].nodeValue,
        description: select("*[local-name(.)='description']/text()", doc)[0].nodeValue,

        ...parseCommonResult(select("*[local-name(.)='result']", doc)[0])
    };

};

module.exports = {
    decrypt,

    parseResourceResult: (doc) => {

        // see uploadResponse.xml for an example of a successful response
        let resourceResultNode = select("//*[local-name(.)='return']", doc)[0];

        return {
            auditID: parseAuditID(resourceResultNode),

            response: select("//*[local-name(.)='response']", resourceResultNode).map((responseNode) => {

                return {
                    description: parseOptionalValue(responseNode, 'description'),
                    resourceID: parseResourceID(responseNode),
                    status: parseStatus(responseNode),
                    ...parseCommonResult(select("//*[local-name(.)='result']", responseNode)[0])
                };
            }),
        };
    },

    parseDetail: (doc) => {

        let detailNode = select("//*[local-name(.)='return']", doc)[0];

        return {
            auditID: parseAuditID(detailNode),
            // resultSize: select("*[local-name(.)='resultSize']/text()", detailNode)[0].nodeValue,
            data: select("//*[local-name(.)='data']", detailNode).map((dataNode) => {
                return parseDetailData(dataNode);
            }),
            // resultSize: select("//*[local-name(.)='resultSize']/text()", detailNode)[0].nodeValue,
        };
    },

    parseInfoDetail: (doc) => {

        let detailNode = select("//*[local-name(.)='return']", doc)[0];

        return {
            auditID: parseAuditID(detailNode),
            // resultSize: select("//*[local-name(.)='resultSize']/text()", detailNode)[0].nodeValue,
            data: select("//*[local-name(.)='data']", detailNode).map((dataNode) => {
                return parseDetailData(dataNode);
            }),
            // resultSize: select("//*[local-name(.)='resultSize']/text()", detailNode)[0].nodeValue,
        };
    },

    parseTypeListResult: (doc) => {
        let typeListResultNode = select("//*[local-name(.)='return']", doc)[0];

        return {
            auditID: parseAuditID(typeListResultNode),

            data: select("//*[local-name(.)='data']", typeListResultNode).map((typeListDataNode) => {
                return parseTypeListData(typeListDataNode);
            }),
        };
    },

    parseDownloadResult: (doc) => {
        let downloadResultNode = select("//*[local-name(.)='return']", doc)[0];

        return {
            auditID: parseAuditID(downloadResultNode),

            data: select("//*[local-name(.)='data']", downloadResultNode).map((downloadDataNode) => {
                return parseDownloadData(downloadDataNode);
            }),
        };
    },

    parseAuditLogDetails: (doc) => {

        let resultNode = select("//*[local-name(.)='return']", doc)[0];

        const commonResult = parseCommonResult(resultNode);
        return {
            auditID: parseAuditID(resultNode),
            ...commonResult

        };

    },
};
