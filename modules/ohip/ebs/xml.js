// TODO - parse audit-log stuff into each result instead of separately

const dom = require('xmldom').DOMParser;
const {
    select,
} = require('xpath');


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

        let detailNode = select("//*[local-name(.)='return']", doc);

        if (detailNode && detailNode.length) {
            console.log('good');
            return {
                auditID: parseAuditID(detailNode[0]),
                // resultSize: select("*[local-name(.)='resultSize']/text()", detailNode)[0].nodeValue,
                data: select("//*[local-name(.)='data']", detailNode[0]).map((dataNode) => {
                    return parseDetailData(dataNode);
                }),
                // resultSize: select("//*[local-name(.)='resultSize']/text()", detailNode)[0].nodeValue,
            };
        }
        return {};
    },

    parseListResponse: (doc) => {

        const listResponseNode = select("//*[local-name(.)='listResponse']", doc)[0];

        let retNode = select("//*[local-name(.)='return']", listResponseNode);

        if (retNode.length) {
            // console.log('good');
            return {
                auditID: parseAuditID(retNode[0]),
                // resultSize: select("*[local-name(.)='resultSize']/text()", detailNode)[0].nodeValue,
                data: select("//*[local-name(.)='data']", retNode[0]).map((dataNode) => {
                    return parseDetailData(dataNode);
                }),
                // resultSize: select("//*[local-name(.)='resultSize']/text()", detailNode)[0].nodeValue,
            };
        }
        return {};
    },

    parseInfoDetail: (doc) => {


        const infoResponseNode = select("//*[local-name(.)='infoResponse']", doc)[0];

        let retNode = select("//*[local-name(.)='return']", infoResponseNode);

        if (retNode.length) {
            return {
                auditID: parseAuditID(retNode[0]),
                // resultSize: select("//*[local-name(.)='resultSize']/text()", detailNode)[0].nodeValue,
                data: select("//*[local-name(.)='data']", retNode[0]).map((dataNode) => {
                    return parseDetailData(dataNode);
                }),
                // resultSize: select("//*[local-name(.)='resultSize']/text()", detailNode)[0].nodeValue,
            };
        }
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

        let resultNode = select("//*[local-name(.)='return']", doc);
        if (resultNode && resultNode.length) {
            // empty results don't come with audit IDs or common results
            const commonResult = parseCommonResult(resultNode[0]);
            return {
                auditID: parseAuditID(resultNode[0]),
                ...commonResult
            };
        }
        return {};
    },

    parseEBSFault: (doc) => {
        const ebsFaultNode = select("//*[local-name(.)='EBSFault']", doc)[0];

        return {
            code: select("*[local-name(.)='code']/text()", ebsFaultNode)[0],
            message: select("*[local-name(.)='message']/text()", ebsFaultNode)[0],
        }
    },
};
