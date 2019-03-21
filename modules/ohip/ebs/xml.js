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
        code: select("*[local-name(.)='code']/text()", doc)[0].nodeValue,
        msg:  select("*[local-name(.)='msg']/text()", doc)[0].nodeValue,
    };
};



const parseDetailData = (doc) => {
    try {
        return {
           createTimestamp: select("*[local-name(.)='createTimestamp']/text()", doc)[0].nodeValue,
           resourceID: parseResourceID(doc),
           status: parseStatus(doc),

           description: parseOptionalValue(doc, 'description'),
           resourceType: parseOptionalValue(doc, 'resourceType'),
           modifyTimestamp: parseOptionalValue(doc, 'modifyTimestamp'),

           ...parseCommonResult(select("*[local-name(.)='result']", doc)[0])
       };
    }
    catch (e) {
        return {
            ...parseCommonResult(select("*[local-name(.)='result']", doc)[0])
        };
    }
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

    try {
        return {
            content: select("*[local-name(.)='content']/text()", doc)[0].nodeValue.toString('base64'),
            resourceID: select("*[local-name(.)='resourceID']/text()", doc)[0].nodeValue,
            resourceType: select("*[local-name(.)='resourceType']/text()", doc)[0].nodeValue,
            description: select("*[local-name(.)='description']/text()", doc)[0].nodeValue,

            ...parseCommonResult(select("*[local-name(.)='result']", doc)[0])
        };
    }
    catch (e) {
        const r = {
            // the Conformance Testing environment doesn't conform to
            // the specifications, so this is the only thing we can
            // really expect if the response isn't an EBS Fault :(
            ...parseCommonResult(select("*[local-name(.)='result']", doc)[0]),
        };
        return r;
    }

};

const parseResourceResult = (doc) => {

    const resourceResultNode = select("*[local-name(.)='return']", doc)[0];

    return {
        auditID: parseAuditID(resourceResultNode),

        response: select("*[local-name(.)='response']", resourceResultNode).map((responseNode) => {

            const resultNode = select("*[local-name(.)='result']", responseNode)[0];

            try {
                return {
                    description: parseOptionalValue(responseNode, 'description'),
                    resourceID: parseResourceID(responseNode),
                    status: parseStatus(responseNode),
                    ...parseCommonResult(resultNode),
                };
            }
            catch (e) {
                const r = {
                    // the Conformance Testing environment doesn't conform to
                    // the specifications, so this is the only thing we can
                    // really expect if the response isn't an EBS Fault :(
                    ...parseCommonResult(resultNode),
                };
                return r;
            }
        }),
    };
};


const parseDetail = (doc) => {

    const detailNode = select("*[local-name(.)='return']", doc)[0];
    if (!detailNode) {
        return {};
    }

    const resultSize = select("*[local-name(.)='resultSize']/text()", detailNode);
    return {
        auditID: parseAuditID(detailNode),
        data: select("*[local-name(.)='data']", detailNode).map((dataNode) => {
            return parseDetailData(dataNode);
        }),
        resultSize: resultSize.length ? resultSize[0].nodeValue: '',
    };
};

module.exports = {

    parseUploadResponse: (doc) => {
        return parseResourceResult(select("//*[local-name(.)='uploadResponse']", doc)[0]);
    },

    parseUpdateResponse: (doc) => {
        return parseResourceResult(select("//*[local-name(.)='updateResponse']", doc)[0]);
    },

    parseSubmitResponse: (doc) => {
        return parseResourceResult(select("//*[local-name(.)='submitResponse']", doc)[0]);
    },

    parseDeleteResponse: (doc) => {
        return parseResourceResult(select("//*[local-name(.)='deleteResponse']", doc)[0]);
    },




    parseDownloadResponse: (doc) => {
        const downloadResponseNode = select("//*[local-name(.)='downloadResponse']", doc)[0];

        const downloadResultNode = select("//*[local-name(.)='return']", doc)[0];

        return {
            auditID: parseAuditID(downloadResultNode),

            data: select("//*[local-name(.)='data']", downloadResultNode).map((downloadDataNode) => {
                return parseDownloadData(downloadDataNode);
            }),
        };
    },

    parseInfoResponse: (doc) => {
        return parseDetail(select("//*[local-name(.)='infoResponse']", doc)[0]);
    },


    parseListResponse: (doc) => {
        return parseDetail(select("//*[local-name(.)='listResponse']", doc)[0]);

    },

    parseTypeListResponse: (doc) => {
        const getTypeListResponseNode = select("//*[local-name(.)='getTypeListResponse']", doc)[0];
        const typeListResultNode = select("//*[local-name(.)='return']", getTypeListResponseNode)[0];

        return {
            auditID: parseAuditID(typeListResultNode),

            data: select("//*[local-name(.)='data']", typeListResultNode).map((typeListDataNode) => {
                return parseTypeListData(typeListDataNode);
            }),
        };
    },

    parseHCVResponse: (doc) => {
        return {
            responseCode: "ST001",
            responseID: "62312",
            healthNumber: '1234567890',
            versionCode: 'OK',
            firstName: 'Gaius',
            secondName: 'Fracking',
            lastName: 'Baltar',
            gender: 'M',
            dateOfBirth: new Date(),
            expiryDate: new Date(),
        };
    },

    parseAuditLogDetails: (doc) => {
        const returnNode = select("//*[local-name(.)='return']", doc)[0];

        // empty results don't come with audit IDs or common results :(
        if (returnNode) {

            return {
                auditID: parseAuditID(returnNode),
            };
        }
        return {};
    },

    parseEBSFault: (doc) => {
        // because why wouldn't OHIP use two fault-schemas and only document one?
        try {
            const ebsFaultNode = select("//*[local-name(.)='EBSFault']", doc)[0];

            return {
                code: select("//*[local-name(.)='code']/text()", ebsFaultNode)[0].nodeValue,
                message: select("//*[local-name(.)='message']/text()", ebsFaultNode)[0].nodeValue,
            };
        }
        catch(err) {
            const faultNode = select("//*[local-name(.)='Fault']", doc)[0];

            return {
                code: select("//*[local-name(.)='faultcode']/text()", faultNode)[0].nodeValue,
                message: select("//*[local-name(.)='faultstring']/text()", faultNode)[0].nodeValue,
            };
        }
    },
};
