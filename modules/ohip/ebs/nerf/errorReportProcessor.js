const _ = require('lodash');

const {
    resourceTypes: {
        ERROR_REPORTS,

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

const headerFields = require('./../../parser/errorReport/headerFields');
const claimHeader1Fields = require('./../../parser/errorReport/claimHeader1Fields');
const claimHeader2Fields = require('./../../parser/errorReport/claimHeader2Fields');
const itemFields = require('./../../parser/errorReport/itemFields');
const explanationCodeMessageFields = require('./../../parser/errorReport/explanationCodeMessageFields');
const trailerRecordFields = require('./../../parser/errorReport/trailerRecordFields');

let nextErrorReportFileSequenceNumber = 0;


// returns an array of resources -- may be multiple resources per input resource
module.exports = (resource, processDate) => {

    // console.log(`resource.claimFileInfo: `, resource.claimFileInfo)
    const errorReportRecords = _.reduce(_.groupBy(resource.claimFileInfo.acceptBatches, ({groupNumber, providerNumber}) => {
        return `${groupNumber}-${providerNumber}`;
    }), (errorReport, gpnBatches, gpnKey) => {

        const gpnParts = gpnKey.split('-');
        const groupNumber = gpnParts[0];
        const providerNumber = gpnParts[1];

        const hx9Data = {
            header1Count: 0,
            header2Count: 0,
            itemCount: 0,
            messageCount: 0,
        };

        const specialtyRecords = _.reduce(_.groupBy(gpnBatches, ({specialty}) => {
            return specialty;
        }), (results, specialtyBatches, specialty) => {

            const hx1Data = {
                groupNumber,
                providerNumber,
                specialtyCode: specialty,

                claimProcessDate: processDate,

                mohOfficeCode: 'U', // from real world sample
                stationNumber: 473, // from real world sample
            };

            const hx1Record = Object.keys(headerFields).map((key) => {
                const fieldDescriptor = headerFields[key];
                return formatAlphanumeric((fieldDescriptor.constant || hx1Data[key]), fieldDescriptor.fieldLength);
            }).join('');
            results.push(hx1Record);

            const batchRecords = specialtyBatches.reduce((results, batch) => {

                return batch.rejectClaims.reduce((results, claim) => {

                    hx9Data.header1Count++;

                    const hxhRecord = Object.keys(claimHeader1Fields).map((key) => {
                        const fieldDescriptor = claimHeader1Fields[key];
                        return formatAlphanumeric((fieldDescriptor.constant || claim[key]), fieldDescriptor.fieldLength);
                    }).join('');
                    results.push(hxhRecord);


                    if (claim.paymentProgram === 'RMB') {

                        hx9Data.header2Count++;

                        const hxrRecord = Object.keys(claimHeader2Fields).map((key) => {
                            const fieldDescriptor = claimHeader2Fields[key];
                            return formatAlphanumeric((fieldDescriptor.constant || claim[key]), fieldDescriptor.fieldLength);
                        }).join('');
                        results.push(hxrRecord);
                    }

                    return claim.items.reduce((results, item) => {

                        hx9Data.itemCount++;

                        const hxtRecord = Object.keys(itemFields).map((key) => {
                            const fieldDescriptor = itemFields[key];
                            return formatAlphanumeric((fieldDescriptor.constant || item[key]), fieldDescriptor.fieldLength);
                        }).join('');
                        return results.concat(hxtRecord);

                        // TODO add HX8 records
                    }, results);

                }, results);

            }, []);

            return results.concat(batchRecords);    // under same H1
        }, []);

        const hx9Record = Object.keys(trailerRecordFields).map((key) => {
            const fieldDescriptor = trailerRecordFields[key];
            return formatAlphanumeric((fieldDescriptor.constant || hx9Data[key]), fieldDescriptor.fieldLength);
        }).join('');

        return errorReport.concat(specialtyRecords.concat(hx9Record));

    }, []);

    return [{
        status: 'DOWNLOADABLE',
        content: errorReportRecords.join('\n'),
        description: `E${getMonthCode(processDate)}${resource.claimFileInfo.groupNumber}.${formatAlphanumeric(nextErrorReportFileSequenceNumber++, 3, '0')}`,
        resourceType: ERROR_REPORTS,
        createTimestamp: processDate,
        modifyTimestamp: processDate,
    }];
};
