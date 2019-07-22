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


// matches service codes beginning with 'E' -- used to determine if a claim (within a batch) should be rejected

const errorCodes = [
    'AC1', 'VHA', 'ET1', 'TM3', 'VH9'
];

const explanatoryCodes = {
    '11': 'No. of services exceed maximum allowed',
};

const getExplanatoryCodeMessage = (item) => {
    return {
        explanatoryCode: item.explanatoryCode,
        explanatoryDescription: explanatoryCodes[item.explanatoryCode],
    };
};

// an array of arrays of error code indices -- these are the "templates"
const errorTemplates = [
    /* (yes this could just as well have been done algorithmically, but then
        the larger algorithm would be much harder to understand) */
    [],
    [0],
    [0, 1],
    [0, 1, 2],
    [0, 1, 2, 3],
    [0, 1, 2, 3, 4],
];

const addErrors = (errorKey, obj) => {
    errorTemplates[errorKey % 6].forEach((errorCodeIndex, errorTemplateIndex) => {
        obj[`errorCode${errorTemplateIndex + 1}`] = errorCodes[errorCodeIndex];
    });
};

let nextErrorReportFileSequenceNumber = 0;

// returns an array of resources -- may be multiple resources per input resource
module.exports = (resource, processDate) => {

    const {
        claimFileInfo,
    } = resource;

    let hasClaimRejects = false;

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

                claimProcessDate: formatDate(processDate),

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

                    hasClaimRejects = true;

                    if (claim.errorKey % 6) {
                        addErrors(claim.errorKey, claim);
                    }

                    const hxhRecord = Object.keys(claimHeader1Fields).map((key) => {
                        const fieldDescriptor = claimHeader1Fields[key];
                        return formatAlphanumeric((fieldDescriptor.constant || claim[key]), fieldDescriptor.fieldLength);
                    }).join('');
                    results.push(hxhRecord);
                    hx9Data.header1Count++;

                    if (claim.paymentProgram === 'RMB') {


                        const hxrRecord = Object.keys(claimHeader2Fields).map((key) => {
                            const fieldDescriptor = claimHeader2Fields[key];
                            return formatAlphanumeric((fieldDescriptor.constant || claim[key]), fieldDescriptor.fieldLength);
                        }).join('');
                        results.push(hxrRecord);
                        hx9Data.header2Count++;
                    }

                    // TODO only add item-level errors for service codes matching item-correction-flag
                    return claim.rejectItems.reduce((results, item) => {


                        if (item.errorKey % 6) {
                            addErrors(item.errorKey, item);
                        }

                        if (parseInt(item.explanatoryKey)) {
                            // TODO hardcoding this to an arbitrary explanatory code sucks
                            item.explanatoryCode = 11;
                        }


                        const hxtRecord = Object.keys(itemFields).map((key) => {
                            const fieldDescriptor = itemFields[key];
                            return formatAlphanumeric((fieldDescriptor.constant || item[key]), fieldDescriptor.fieldLength);
                        }).join('');

                        results.push(hxtRecord);
                        hx9Data.itemCount++;

                        if (item.explanatoryCode) {

                            const message = getExplanatoryCodeMessage(item);


                            const hx8Record = Object.keys(explanationCodeMessageFields).map((key) => {
                                const fieldDescriptor = explanationCodeMessageFields[key];
                                // some of these should be left justified but it matters not
                                return formatAlphanumeric((fieldDescriptor.constant || message[key]), fieldDescriptor.fieldLength);
                            }).join('');

                            results.push(hx8Record);
                            hx9Data.messageCount++;
                        }

                        return results;

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

    if (hasClaimRejects) {
        return [{
            status: 'DOWNLOADABLE',
            content: errorReportRecords.join('\n'),
            description: `E${getMonthCode(processDate)}${resource.claimFileInfo.groupNumber}.${formatAlphanumeric(nextErrorReportFileSequenceNumber++, 3, '0')}`,
            resourceType: ERROR_REPORTS,
            createTimestamp: processDate,
            modifyTimestamp: processDate,
        }];
    }
    return [];
};
