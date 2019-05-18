const uuid = require('uuid/v1');

// const logger = require('../../../../logger');

const {
    services: {
        EDT_UPLOAD,
        EDT_SUBMIT,
        EDT_LIST,
        EDT_DOWNLOAD,
        EDT_INFO,
        EDT_UPDATE,
        EDT_DELETE,
        EDT_GET_TYPE_LIST,
        HCV_REAL_TIME,
    },
    responseCodes: {
        SUCCESS,
        FILE_UPLOAD_FAILED,
        NO_DATA_FOR_PROCESSING,
        DATA_PROCESSING_FAILED,
        DATA_NOT_PROCESSED,

    }
} = require('../constants');

const messagesByResultCode = {
    [SUCCESS]: 'Success',
    [FILE_UPLOAD_FAILED]: 'File Upload Failed',
    [NO_DATA_FOR_PROCESSING]: 'No Data for Processing',
    [DATA_PROCESSING_FAILED]: 'Data Processing failed',
    [DATA_NOT_PROCESSED]: 'Data Not Processed',
};

const generateCommonResultXML = (responseCode) => {
    return `
        <result>
            <code>${responseCode}</code>
            <msg>${messagesByResultCode[responseCode]}</msg>
        </result>`;
};

const generateResponseResultXML = (resource, responseCode) => {

    const descriptionStr = resource.description ? `<description>${resource.description}</description>` : '';
    const statusStr = resource.status ? `<status>${resource.status}</status>` : '';
    const resourceIDStr = resource.resourceID ? `<resourceID>${resource.resourceID}</resourceID>` : '';

    return `
        <response>
            ${descriptionStr}
            ${statusStr}
            ${resourceIDStr}</resourceID>
            ${generateCommonResultXML(responseCode)}
        </response>`;
};

const generateDownloadDataXML = (resource, responseCode) => {

    return `
        <data>
            <content>${resource.content}</content>
            <resourceID>${resource.resourceID}</resourceID>
            <resourceType>${resource.resourceType}</resourceType>
            <description>${resource.description}</description>
            ${generateCommonResultXML(responseCode)}
        </data>`;
};

const generateDetailDataXML = (resource, responseCode) => {
    return `
        <data>
            <createTimestamp>${resource.createTimestamp}</createTimestamp>
            <resourceID>${resource.resourceID}</resourceID>
            <status>${resource.status}</status>
            <description>${resource.description}</description>
            <resourceType>${resource.resourceType}</resourceType>
            <modifyTimestamp>${resource.modifyTimestamp}</modifyTimestamp>
            ${generateCommonResultXML(responseCode)}
        </data>
    `;
};

const generateResourceResultsXML = (results) => {
    console.log('RESULTS: ', results);

    const innerXML = results.map((result) => {
        return generateResponseResultXML(result.resource, result.responseCode);
    }).join('\n');

    return `
        <return>
            <auditID>${uuid()}</auditID>
            ${innerXML}
        </return>
    `;
};

const generateDownloadResultsXML = (results) => {
    const innerXML = results.map((result) => {
        return generateDownloadDataXML(result.resource, result.responseCode);
    }).join('\n');

    return `
        <return>
            <auditID>${uuid()}</auditID>
            ${innerXML}
        </return>
    `;
};

const generateDetailResultsXML = (results) => {

    // TODO this will need to become very clever about paging in order to support
    // testing of improvements to file housekeeping

    const innerDetailXML = results.map((result) => {
        return generateDetailDataXML(result.resource, result.responseCode);
    }).join('\n');

    return `
        <return>
            <auditID>${uuid()}</auditID>
            ${innerDetailXML}
            <resultSize>1</resultSize>
        </return>
    `;
};

const generateValidationResultsXML = (results) => {
    return `
        <results>
            <auditID>${uuid()}</auditID>
            <results>
                ...
            </results>
            <results>
                ...
            </results>
        </results>
    `;
};

module.exports = {
    // results in resourceResults responses
    [EDT_UPLOAD]: (results) => {
        return `
            <uploadResponse>
                ${generateResourceResultsXML(results)}
            </uploadResponse>`;
    },
    [EDT_SUBMIT]: (results) => {
        return `
            <submitResponse>
                ${generateResourceResultsXML(results)}
            </submitResponse>`;
    },
    [EDT_UPDATE]: (results) => {
        return `
            <updateResponse>
                ${generateResourceResultsXML(results)}
            </updateResponse>`;
    },
    [EDT_DELETE]: (results) => {
        return `
            <deleteResponse>
                ${generateResourceResultsXML(results)}
            </deleteResponse>`;
    },

    // results in downloadResult responses
    [EDT_DOWNLOAD]: (results) => {
        return `
            <downloadResponse>
                ${generateDownloadResultsXML(results)}
            </downloadResponse>`;
    },

    // results in detail responses
    [EDT_LIST]: (results) => {
        return `
            <listResponse>
                ${generateDetailResultsXML(results)}
            </listResponse>`;
    },
    [EDT_INFO]: (results) => {
        return `
            <infoResponse>
                ${generateDetailResultsXML(results)}
            </infoResponse>`;

    },

    // results in typeListResult responses
    [EDT_GET_TYPE_LIST]: (results) => {
        return `
            <getTypeListResponse>
                ${generateTypeListResultsXML(results)}
            <getTypeListResponse>`;
    },

    [HCV_REAL_TIME]: (results) => {
        return `
            <validateResponse>
                ${generateValidationResultsXML(results)}
            <validateResponse>`;
    },
};
