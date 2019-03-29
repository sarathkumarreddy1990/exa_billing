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
        return {
            auditId: '',
            data: [],
            resultSize: 0,
        };
    }

    return {
        auditID: parseOptionalValue(detailNode, 'auditID'),
        data: select("*[local-name(.)='data']", detailNode).map((dataNode) => {
            return parseDetailData(dataNode);
        }),
        resultSize: parseOptionalValue(detailNode, 'resultSize'),
    };
};

const parseHCVCategory1Response = (doc) => {
    //      <results>
    //          ...
    //          <dateOfBirth>1995-06-26T00:00:00.000-04:00</dateOfBirth>
    //          <expiryDate>2024-01-16T00:00:00.000-05:00</expiryDate>
    //          <secondName>test second name6</secondName>
    //          <firstName>test first name6</firstName>
    //          <lastName>test last name6</lastName>
    //          <gender>M</gender>
    //      </result>
    return {
        firstName: select("*[local-name(.)='firstName']/text()", doc)[0].nodeValue,
        secondName: select("*[local-name(.)='secondName']/text()", doc)[0].nodeValue,
        lastName: select("*[local-name(.)='lastName']/text()", doc)[0].nodeValue,
        gender: select("*[local-name(.)='gender']/text()", doc)[0].nodeValue,
        dateOfBirth: select("*[local-name(.)='dateOfBirth']/text()", doc)[0].nodeValue,
        expiryDate: select("*[local-name(.)='expiryDate']/text()", doc)[0].nodeValue,
    }
};


const parseHCVFeeServiceDetails = (doc) => {

    return {
        feeServiceCode: select("*[local-name(.)='feeServiceCode']/text()", doc)[0].nodeValue,
        feeServiceDate: parseOptionalValue(doc, 'feeServiceDate'),
        feeServiceResponseCode: select("*[local-name(.)='feeServiceResponseCode']/text()", doc)[0].nodeValue,
        feeServiceResponseDescription: select("*[local-name(.)='feeServiceResponseDescription']/text()", doc)[0].nodeValue,
    };
}

module.exports = {

    parseUploadResponse: (docStr) => {
        const doc = new dom().parseFromString(docStr);
        return parseResourceResult(select("//*[local-name(.)='uploadResponse']", doc)[0]);
    },

    parseUpdateResponse: (docStr) => {
        const doc = new dom().parseFromString(docStr);
        return parseResourceResult(select("//*[local-name(.)='updateResponse']", doc)[0]);
    },

    parseSubmitResponse: (docStr) => {
        const doc = new dom().parseFromString(docStr);
        return parseResourceResult(select("//*[local-name(.)='submitResponse']", doc)[0]);
    },

    parseDeleteResponse: (docStr) => {
        const doc = new dom().parseFromString(docStr);
        return parseResourceResult(select("//*[local-name(.)='deleteResponse']", doc)[0]);
    },




    parseDownloadResponse: (docStr) => {
        const doc = new dom().parseFromString(docStr);
        const downloadResponseNode = select("//*[local-name(.)='downloadResponse']", doc)[0];

        const downloadResultNode = select("//*[local-name(.)='return']", doc)[0];

        return {
            auditID: parseAuditID(downloadResultNode),

            data: select("//*[local-name(.)='data']", downloadResultNode).map((downloadDataNode) => {
                return parseDownloadData(downloadDataNode);
            }),
        };
    },

    parseInfoResponse: (docStr) => {
        const doc = new dom().parseFromString(docStr);
        return parseDetail(select("//*[local-name(.)='infoResponse']", doc)[0]);
    },


    parseListResponse: (docStr) => {

        const doc = new dom().parseFromString(docStr);
        return parseDetail(select("//*[local-name(.)='listResponse']", doc)[0]);

    },

    parseTypeListResponse: (docStr) => {
        const doc = new dom().parseFromString(docStr);
        const getTypeListResponseNode = select("//*[local-name(.)='getTypeListResponse']", doc)[0];
        const typeListResultNode = select("//*[local-name(.)='return']", getTypeListResponseNode)[0];

        return {
            auditID: parseAuditID(typeListResultNode),

            data: select("//*[local-name(.)='data']", typeListResultNode).map((typeListDataNode) => {
                return parseTypeListData(typeListDataNode);
            }),
        };
    },

    parseHCVResponse: (docStr) => {

        const doc = new dom().parseFromString(docStr);
        const validateResponseNode = select("//*[local-name(.)='validateResponse']", doc)[0];

        const outerResults = select("*[local-name(.)='results']", validateResponseNode)[0];
        const auditID = select("*[local-name(.)='auditUID']/text()", outerResults)[0].nodeValue;
        const innerResults = select("*[local-name(.)='results']", outerResults);

        return innerResults.map((result) => {
            const feeServiceDetailsNode = select("*[local-name(.)='feeServiceDetails']", result)[0];

            return {
                healthNumber: select("*[local-name(.)='healthNumber']/text()", result)[0].nodeValue,
                responseAction: select("*[local-name(.)='responseAction']/text()", result)[0].nodeValue,
                responseCode: select("*[local-name(.)='responseCode']/text()", result)[0].nodeValue,
                responseDescription: select("*[local-name(.)='responseDescription']/text()", result)[0].nodeValue,
                responseID: select("*[local-name(.)='responseID']/text()", result)[0].nodeValue,
                versionCode: parseOptionalValue(result, 'versionCode'),

                dateOfBirth: parseOptionalValue(result, 'dateOfBirth'),
                expiryDate: parseOptionalValue(result, 'expiryDate'),
                secondName: parseOptionalValue(result, 'secondName'),
                firstName: parseOptionalValue(result, 'firstName'),
                lastName: parseOptionalValue(result, 'lastName'),
                gender: parseOptionalValue(result, 'gender'),

                ...(feeServiceDetailsNode ? parseHCVFeeServiceDetails(feeServiceDetailsNode) : {}),
            };
        });
    },

    parseAuditLogDetails: (docStr) => {
        const doc = new dom().parseFromString(docStr);
        const returnNode = select("//*[local-name(.)='return']", doc)[0];

        // empty results don't come with audit IDs or common results :(
        if (returnNode) {

            return {
                auditID: parseAuditID(returnNode),
            };
        }
        return {};
    },

    parseEBSFault: (docStr) => {

        const doc = new dom().parseFromString(docStr);
        const faultNode = select("//*[local-name(.)='Fault']", doc)[0];

        const basicFault = {
            faultcode: select("*[local-name(.)='faultcode']/text()", faultNode)[0].nodeValue,
            faultstring: parseOptionalValue(faultNode, 'faultstring'),
        };

        try {
            const ebsFaultNode = select("*[local-name(.)='detail']/*[local-name(.)='EBSFault']", faultNode)[0];

            return {
                code: select("*[local-name(.)='code']/text()", ebsFaultNode)[0].nodeValue,
                message: select("*[local-name(.)='message']/text()", ebsFaultNode)[0].nodeValue,
                ...basicFault,
            };
        }
        catch(err) {
            return basicFault;
        }
    },
};
