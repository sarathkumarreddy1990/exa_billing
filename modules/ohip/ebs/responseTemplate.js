
const uuid = require('uuid/v1');

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
} = require('./constants');

const messagesByResultCode = {
    [SUCCESS]: 'Success',
    [FILE_UPLOAD_FAILED]: 'File Upload Failed',
    [NO_DATA_FOR_PROCESSING]: 'No Data for Processing',
    [DATA_PROCESSING_FAILED]: 'Data Processing failed',
    [DATA_NOT_PROCESSED]: 'Data Not Processed',

};

let nextResourceID = 60000;
const resources = [];

const OHIPretendo = {
    [EDT_UPLOAD]: ({filename, description, resourceType}) => {
        const resource = {
            resourceID: nextResourceID++,
            status: 'UPLOADED',
            filename,
            description,
            resourceType,
        }
        resources.push(resource);
        return resource;
    },
    update: ({resourceID, status}) => {
        // TODO
    },
    submit: (resourceID) => {
        const resource = resources.find((r) => {
            return parseInt(resourceID) === r.resourceID;
        });
        resource.status = 'SUBMITTED';
        // TODO: trigger creation of a BATCH EDIT REPORT
        return resource;
    },

    delete: () => {

    },

    info: ({resourceType, status, resourceIDs}) => {
        return resources.filter((resource) => {
            return resourceIDs.includes(resource.resourceID);
        });
    },
    list: ({resourceType, status, resourceIDs}) => {
        return resources.filter((resource) => {
            return (!resourceType || resource.resourceType === resourceType)
                && (!status || resource.status === status);
        });
    },
};

const responseFixturesByService = {

    // results in resourceResults responses
    [EDT_UPLOAD]: {
        errorCodes: [FILE_UPLOAD_FAILED,],    // <---- TODO
        params: ['uploads'],
    },
    [EDT_SUBMIT]: {
        errorCodes: [NO_DATA_FOR_PROCESSING, DATA_PROCESSING_FAILED],
        params: ['resourceIDs'],
    },
    [EDT_UPDATE]: {
        errorCodes: [NO_DATA_FOR_PROCESSING, DATA_PROCESSING_FAILED, DATA_NOT_PROCESSED],
        params: ['updates'],
    },
    [EDT_DELETE]: {
        errorCodes: [],    // TODO support other exit codes
        params: ['resourceIDs'],
    },

    // results in detail responses
    [EDT_LIST]: {
        // successfulResourceStatus: [''],
        params: ['pageNo', 'resourceType', 'status'],
    },
    [EDT_INFO]: {
        // successfulResourceStatus: ['UPLOADED'],
        errorCodes: [,],    // TODO support other exit codes

        params: ['resourceIDs'],
    },

    // results in downloadResult responses
    [EDT_DOWNLOAD]: {
        // validResourceStatuses: [''],
        arrayName: 'resourceIDs'
    },

    // results in typeListResult responses
    [EDT_GET_TYPE_LIST]: {
        successfulResourceStatus: [''],
        arrayName: null
    },

    [HCV_REAL_TIME]: {
        successfulResourceStatus: '',
        arrayName: 'hcvRequests'
    },
};

const generateDetailResult = (ctx) => {
    return '';
};

const generateDownloadResult = (ctx) => {
    return '';
};

const generateTypeListResult = (ctx) => {
    return 'TODO';
};

const generateResourceResult = (ctx) => {

    const serviceName = Object.keys(ctx.eventDetail)[0];
    console.log('service name: ', serviceName);

    // NOTE in the context of generateResourceResult, this will always
    // correspond to EDT_UPLOAD, EDT_UPDATE, EDT_DELETE, or EDT_SUBMIT
    const responseFixture = responseFixturesByService[serviceName];
    // console.log('params: ', responseFixture['params'][0]);

    const arrayParam = ctx.eventDetail[serviceName][responseFixture['params'][0]];
    const numErrors = Math.min(responseFixture.errorCodes.length, arrayParam.length - 1);
    console.log('array params: ', arrayParam);

    console.log('numErrors: ', numErrors);
    // const responses = arrayParam.slice(0, (numErrors * -1)).map((arg) => {
    const responses = arrayParam.reduce((results, arg, index) => {
        if (index < arrayParam.length - numErrors) {
            console.log('feeding args: ', arg);

            const resource = OHIPretendo[serviceName](arg);

            return results.concat({
                description: resource.description,
                status: resource.status,
                resourceID: resource.resourceID,
                resultCode: SUCCESS,
                resultMessage: messagesByResultCode[SUCCESS],
            });
        }
        else {
            return results.concat({
                resultCode: responseFixture.errorCodes[i],
                resultMessage: messagesByResultCode[responseFixture.errorCodes[i]],
            });
        }
    }, []);

    let innerResponseXML = responses.map((response) => {

        console.log('RESPONSES 3: ', response);

        const descriptionStr = response.description ? `<description>${response.description}</description>` : '';
        const statusStr = response.status ? `<status>${response.status}</status>` : '';
        const resourceIDStr = response.resourceID ? `<resourceID>${response.resourceID}</resourceID>` : '';

        return `
            <response>
                ${descriptionStr}
                ${statusStr}
                ${resourceIDStr}
                <result>
                    <code>${response.resultCode}</code>
                    <msg>${response.resultMessage}</msg>
                </result>
            </response>
        `;
    });

    return `
        <return>
            <auditID>${uuid()}</auditID>
            ${innerResponseXML}
        </return>
    `;
};

module.exports = {

    [EDT_UPLOAD]: (ctx) => {
        return `
            <uploadResponse>
                ${generateResourceResult(ctx)}
            </uploadResponse>
        `;
    },

    [EDT_UPDATE]: (ctx) => {
        return `
            <updateResponse>
                ${generateResourceResult(ctx)}
            </updateResponse>
        `;
    },

    [EDT_DELETE]: (ctx) => {
        return `
            <deleteResponse>
                ${generateResourceResult(ctx)}
            </deleteResponse>
        `;
    },

    [EDT_SUBMIT]: (ctx) => {
        return `
            <submitResponse>
                ${generateResourceResult(ctx)}
            </submitResponse>
        `;
    },

    [EDT_LIST]: (ctx) => {
        return `
            <listResponse>
                ${generateDetailResult(ctx)}
            </listResponse>
        `;
    },

    [EDT_INFO]: (ctx) => {
        return `
            <infoResponse>
                ${generateDetailResult(ctx)}
            </infoResponse>
        `;
    },

    [EDT_GET_TYPE_LIST]: (ctx) => {
        return `
            <getTypeListResponse>
                ${generateTypeListResult(ctx)}
            </getTypeListResponse>
        `;
    },

    [EDT_DOWNLOAD]: (ctx) => {
        return `
            <Response>
                ${generateDownloadResult(ctx)}
            </Response>
        `;
    },

    [HCV_REAL_TIME]: (ctx) => {
        return `
            <Response>
                ${generateResourceResult(ctx)}
            </Response>
        `;
    },


}
