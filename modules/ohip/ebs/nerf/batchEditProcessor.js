
const {
    resourceTypes: {
        BATCH_EDIT,
    },
} = require('./../constants');

const {
    formatDate,
    formatAlphanumeric,
    formatTime,
} = require('./../../encoder/util');

const {
    getMonthCode,
    getResourceFilename,
} = require('./../../utils');

const batchEditFields = require('../../parser/batchClaimsEditReport/batchEditReportFields');


let nextBatchEditFileSequenceNumber = 0;

module.exports = (resource, processDate) => {

    return resource.claimFileInfo.acceptBatches.reduce((results, batch) => {

        const batchEditRecord = {
            batchNumber: '00001',
            operatorNumber: batch.operatorNumber,
            batchCreateDate: batch.batchId.substr(0, 8),
            batchSequenceNumber: batch.batchId.substr(8, 4),
            microStart: 'J2073157812',  // from real world sample
            microEnd: '57822',  // from real world sample
            microtype: 'HCP/WCB',
            groupNumber: batch.groupNumber,
            providerNumber: batch.providerNumber,
            numberOfClaims: batch.numClaims,
            numberOfRecords: batch.numRecords,
            batchProcessDate: formatDate(processDate),
            editMessage: '     ***  BATCH TOTALS  ***                        ',
        };

        const record1 = Object.keys(batchEditFields).map((key) => {
            const fieldDescriptor = batchEditFields[key];
            return formatAlphanumeric((fieldDescriptor.constant || batchEditRecord[key]), fieldDescriptor.fieldLength);
        }).join('');


        return results.concat({
            status: 'DOWNLOADABLE',
            content: record1,
            description: `B${getMonthCode(processDate)}${resource.claimFileInfo.groupNumber}.${formatAlphanumeric(nextBatchEditFileSequenceNumber++, 3, '0')}`,
            resourceType: BATCH_EDIT,
            createTimestamp: processDate,
            modifyTimestamp: processDate,
        })
    }, []);
};
