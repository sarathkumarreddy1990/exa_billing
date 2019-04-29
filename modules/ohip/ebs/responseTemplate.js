
const uuid = require('uuid/v1');
const fs = require('fs');

const {
    formatDate,
    formatAlphanumeric,
} = require('../encoder/util');


const remittanceAdviceEncoder = require('./remittanceAdviceEncoder');

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

const _ = require('lodash');

const batchEditTemplate = _.template(`HB1V0300001000000<%=batchId%>J207315781257822HCP/WCBBGAA170332<%=numClaims%><%=numRecords%><%=batchProcessDate%>     ***  BATCH TOTALS  ***`);
const rejectMessageTemplate = _.template(
``
);


const errorReportTemplate = _.template(`
HX1V03J          00000000001021520035220120229
HXH1003100755  20000210CST-PRIMHCPP                             VH5
HXT                                                             VJ5V40V42V41
HXT                                                             VJ5V40V42V41
HXTA003A  0054100120020807780
HXTK023A  0054100120020807780
HX90000001000000000000040000000
`);



const getClaimFileStats = (resource) => {

    const claimFileData = fs.readFileSync(resource.filename, 'ascii');
    const claimFileRecords = claimFileData.split('\r');

    const batchFile = claimFileRecords.reduce((results, record, index) => {
        if (/^HEBV03/.test(record)) {
            const batch = {
                batchId: record.substr(7, 12),  // for Batch Edit reports
                providerNumber: record.substr(29, 6),
                groupNumber: record.substr(25, 4),
                specialty: record.substr(35, 2),
                claims: [],
            };
            if (!index) {
                // the recordImage of a Reject Message corresponds to the
                // first 37 characters of the first record of a claims file
                batch.recordImage = record.substr(0, 37);
            }
            results.push(batch);
        }
        else if (/^HEH/.test(record)) {
            results[results.length-1].claims.push({
                healthRegistrationNumber: record.substr(3, 10), // this or use Registration Number from header-2 record.substr(3,12)
                versionCode: record.substr(13, 2),    // from claim header - 1
                accountingNumber: record.substr(23, 8),   // from claim header - 1
                paymentProgram: record.substr(31, 3),
                serviceLocationIndicator: record.substr(58, 4), // from claim header - 1

                items: [],
            });

        }
        else if (/^HER/.test(record)) {
            results[results.length-1].claims.push({
                patientLastName: record.substr(15, 9),    // "spaces except for RMB claims" (from claim header - 2)
                patientFirstName: record.substr(24, 5),   // "spaces except for RMB claims" (from claim header - 2)
                provinceCode: record.substr(30, 2),   // from claim header - 1
                items: [],
            });
        }

        else if (/^HET/.test(record)) {
            const currentBatch = results[results.length - 1];
            currentBatch.claims[currentBatch.claims.length - 1].items.push({
                serviceCode: record.substr(3, 5),
                feeSubmitted: record.substr(10, 6),
                numberOfServices: record.substr(16, 2),
                serviceDate: record.substr(18, 8),
            });
        }
        else if (/^HEE/.test(record)) {

            const currentBatch = results[results.length - 1];

            currentBatch.numClaims = parseInt(record.substr(3, 4));
            currentBatch.numRecords = currentBatch.numClaims
                                    + parseInt(record.substr(7, 4))
                                    + parseInt(record.substr(11, 5))
                                    + 2; // batch header and batch trailer

        }

        return results;
    }, []);

    return batchFile;
};



const messagesByResultCode = {
    [SUCCESS]: 'Success',
    [FILE_UPLOAD_FAILED]: 'File Upload Failed',
    [NO_DATA_FOR_PROCESSING]: 'No Data for Processing',
    [DATA_PROCESSING_FAILED]: 'Data Processing failed',
    [DATA_NOT_PROCESSED]: 'Data Not Processed',

};

const getServiceName = (ctx) => {
    return Object.keys(ctx.eventDetail)[0];
};

const getServiceParams = (ctx, serviceName) => {
    return ctx.eventDetail[serviceName || getServiceName(ctx)];
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

    [EDT_UPDATE]: ({resourceID, status}) => {
        // TODO
    },

    [EDT_SUBMIT]: (resourceID) => {
        const resource = resources.find((r) => {
            return parseInt(resourceID) === r.resourceID;
        });
        resource.status = 'SUBMITTED';

        resource.claimFileStats = getClaimFileStats(resource);
        const batchEditReports = resource.claimFileStats.forEach((batch) => {
            resources.push({
                resourceID: nextResourceID,
                status: 'DOWNLOADABLE',
                content: batchEditTemplate({
                    batchId: batch.batchId,
                    numClaims: formatAlphanumeric(batch.numClaims, 5, '0'),
                    numRecords: formatAlphanumeric(batch.numRecords, 6, '0'),
                    batchProcessDate: formatDate(new Date()),
                }),
                description: `BE${nextResourceID}.000`,
                resourceType: 'BE',
                createTimestamp: new Date(),
                modifyTimestamp: new Date(),

            });
            nextResourceID++;

        });

        // console.log('RESOURCES: ', resources);
        remittanceAdviceEncoder(resources).forEach((remittanceAdvice) => {
            resources.push({
                resourceID: nextResourceID++,
                status: 'DOWNLOADABLE',
                ...remittanceAdvice,
                resourceType: 'RA',
                createTimestamp: new Date(),
                modifyTimestamp: new Date(),
            });
        });

        return resource;
    },
    [EDT_DOWNLOAD]: (resourceID) => {

        const resource = resources.find((r) => {
            return parseInt(resourceID) === parseInt(r.resourceID);
        });

        return resource;
    },

    [EDT_DELETE]: () => {
        //TODO
    },

    [EDT_INFO]: (resourceIDs) => {
        return resources.filter((resource) => {
            return resourceIDs.includes(resource.resourceID);
        });
    },
    [EDT_LIST]: ({resourceType, status}) => {
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
        params: ['resourceIDs'],
    },

    // results in detail responses
    [EDT_LIST]: {
        // successfulResourceStatus: [''],
        params: ['pageNo', 'resourceType', 'status'],
    },
    [EDT_INFO]: {
        // successfulResourceStatus: ['UPLOADED'],

        params: ['resourceIDs'],
    },

    // results in downloadResult responses
    [EDT_DOWNLOAD]: {
        // validResourceStatuses: [''],
        params: ['resourceIDs'],
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

    const serviceName = getServiceName(ctx);
    // console.log(`serviceName: ${JSON.stringify(serviceName)}`);

    const serviceParams = getServiceParams(ctx, serviceName);
    // console.log(`serviceParams: ${JSON.stringify(serviceParams)}`);

    const innerDetailFixture = responseFixturesByService[serviceName];
    // console.log(`innerDetailFixture: ${JSON.stringify(innerDetailFixture)}`);

    const resources = OHIPretendo[serviceName](serviceParams);
    // console.log('LIST RESOURCE: ', resources);

    if (!resources.length) {
        return '';
    }
    const innerDetailXML = resources.map((resource) => {
        return `
            <data>
                <createTimestamp>${resource.createTimestamp}</createTimestamp>
                <resourceID>${resource.resourceID}</resourceID>
                <status>${resource.status}</status>
                <description>${resource.description}</description>
                <resourceType>${resource.resourceType}</resourceType>
                <modifyTimestamp>${resource.modifyTimestamp}</modifyTimestamp>
                <result>
                    <code>${SUCCESS}</code>
                    <msg>${messagesByResultCode[SUCCESS]}</msg>
                </result>

            </data>
        `;
    }).join('\n');

    return `
        <return>
            <auditID>${uuid()}</auditID>
            ${innerDetailXML}
            <resultSize>1</resultSize>
        </return>
    `;
};

const generateDownloadResult = (ctx) => {

    const serviceName = getServiceName(ctx);
    // console.log(`serviceName: ${JSON.stringify(serviceName)}`);

    const serviceParams = getServiceParams(ctx, serviceName);
    // console.log(`serviceParams: ${JSON.stringify(serviceParams)}`);

    const innerDetailFixture = responseFixturesByService[serviceName];
    // console.log(`innerDetailFixture: ${JSON.stringify(innerDetailFixture)}`);

    const innerXML = getServiceParams(ctx, serviceName)[innerDetailFixture['params'][0]].map((resourceID) => {

        const resource = OHIPretendo[serviceName](resourceID);
        // console.log('generateDownloadResult() resource: ', resource);

        return `
            <data>
                <content>${resource.content}</content>
                <resourceID>${resource.resourceID}</resourceID>
                <resourceType>${resource.resourceType}</resourceType>
                <description>${resource.description}</description>
                <result>
                    <code>${SUCCESS}</code>
                    <msg>${messagesByResultCode[SUCCESS]}</msg>
                </result>
            </data>
        `;

    });

    // console.log()


    return `
        <return>
            <auditID>${uuid()}</auditID>
            ${innerXML}
        </return>
    `;
};

const generateTypeListResult = (ctx) => {
    return 'TODO';
};

const generateResourceResult = (ctx) => {

    const serviceName = getServiceName(ctx);
    // console.log('service name: ', serviceName);

    // NOTE in the context of generateResourceResult, this will always
    // correspond to EDT_UPLOAD, EDT_UPDATE, EDT_DELETE, or EDT_SUBMIT
    const responseFixture = responseFixturesByService[serviceName];
    // console.log('params: ', responseFixture['params'][0]);

    const arrayParam = getServiceParams(ctx, serviceName)[responseFixture['params'][0]];
    const numErrors = Math.min(responseFixture.errorCodes.length, arrayParam.length - 1);
    // console.log('array params: ', arrayParam);

    // console.log('numErrors: ', numErrors);
    // const responses = arrayParam.slice(0, (numErrors * -1)).map((arg) => {
    const responses = arrayParam.reduce((results, arg, index) => {
        if (index < arrayParam.length - numErrors) {
            // console.log('feeding args: ', arg);

            const resource = OHIPretendo[serviceName](arg);
            console.log('generateResourceResult() resource: ', resource);

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

        // console.log('RESPONSES 3: ', response);

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

    // console.log(`innerResponseXML: ${innerResponseXML}`);

    return `
        <return>
            <auditID>${uuid()}</auditID>
            ${innerResponseXML}
        </return>
    `;
};

module.exports = {

    [EDT_UPLOAD]: (ctx) => {
        console.log('NERF upload: ', ctx.eventDetail);
        return `
            <uploadResponse>
                ${generateResourceResult(ctx)}
            </uploadResponse>
        `;
    },

    [EDT_UPDATE]: (ctx) => {
        console.log('NERF update: ', ctx.eventDetail);
        return `
            <updateResponse>
                ${generateResourceResult(ctx)}
            </updateResponse>
        `;
    },

    [EDT_DELETE]: (ctx) => {
        console.log('NERF delete: ', ctx.eventDetail);
        return `
            <deleteResponse>
                ${generateResourceResult(ctx)}
            </deleteResponse>
        `;
    },

    [EDT_SUBMIT]: (ctx) => {
        console.log('NERF submit: ', ctx.eventDetail);
        return `
            <submitResponse>
                ${generateResourceResult(ctx)}
            </submitResponse>
        `;
    },

    [EDT_LIST]: (ctx) => {
        console.log('NERF list: ', ctx.eventDetail);
        return `
            <listResponse>
                ${generateDetailResult(ctx)}
            </listResponse>
        `;
    },

    [EDT_INFO]: (ctx) => {
        console.log('NERF info: ', ctx.eventDetail);
        return `
            <infoResponse>
                ${generateDetailResult(ctx)}
            </infoResponse>
        `;
    },

    [EDT_GET_TYPE_LIST]: (ctx) => {
        console.log('NERF getTypeList: ', ctx.eventDetail);
        return `
            <getTypeListResponse>
                ${generateTypeListResult(ctx)}
            </getTypeListResponse>
        `;
    },

    [EDT_DOWNLOAD]: (ctx) => {
        console.log('NERF dowload: ', ctx.eventDetail);
        return `
            <downloadResponse>
                ${generateDownloadResult(ctx)}
            </downloadResponse>
        `;
    },

    [HCV_REAL_TIME]: (ctx) => {
        console.log('NERF validate: ', ctx.eventDetail);
        return `
            <Response>
                ${generateResourceResult(ctx)}
            </Response>
        `;
    },


}
