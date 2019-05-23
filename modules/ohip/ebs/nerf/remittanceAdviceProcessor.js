const fs = require('fs');
const _ = require('lodash');

const {
    formatDate,
    formatAlphanumeric,
} = require('./../../encoder/util');

const {
    getMonthCode,
    getResourceFilename,
} = require('./../../utils');

const {
    resourceTypes: {
        CLAIMS,
        REMITTANCE_ADVICE,
    },

} = require('./../constants');

// NOTE to generate only one HR4 segment per claim, set this to zero (0)
//      to generate an 10941 HR4 segments, set to 10941
const TARGET_SIZE = 0;

const claims = [];

const fileHeaderFields = require('./../../parser/remittanceAdvice/fileHeaderFields');
const addressOneFields = require('./../../parser/remittanceAdvice/addressOneFields');
const addressTwoFields = require('./../../parser/remittanceAdvice/addressTwoFields');
const claimHeaderFields = require('./../../parser/remittanceAdvice/claimHeaderFields');
const claimItemFields = require('./../../parser/remittanceAdvice/claimItemFields');
const balanceForwardFields = require('./../../parser/remittanceAdvice/balanceForwardFields');
const accountingTransactionFields = require('./../../parser/remittanceAdvice/accountingTransactionFields');
const messageFacilityFields = require('./../../parser/remittanceAdvice/messageFacilityFields');

let claimNumber = 1234567;
let nextRemittanceAdviceSequenceNumber = 0;

module.exports = (resources) => {

    const processDate = new Date();

    const acceptedBatches = resources.reduce((acceptedBatchResults, resource) => {

        if (resource.resourceType !== CLAIMS) {
            return acceptedBatchResults;
        }

        const cfi = resource.claimFileInfo;

        if (cfi.shouldReject) {
            return acceptedBatchResults;
        }

        acceptedBatchResults[cfi.groupNumber] = (acceptedBatchResults[cfi.groupNumber] || []).concat(cfi.acceptBatches);
        return acceptedBatchResults;
    }, {});

    const raFilesByGroupNumber = Object.keys(acceptedBatches).reduce((raFiles, groupNumber) => {

        // this loop produces HR1, HR2, HR3, and HR7 records

        let currentRAFile = [];

        const batches = acceptedBatches[groupNumber]

        currentRAFile.push('<<THIS IS A PLACEHOLDER>>');

        const hr2Record = 'HR2                              632 Thistle Cres                              ';
        currentRAFile.push(hr2Record);

        const hr3Record = 'HR3THUNDER BAY     ON P7A4Z5                                                   ';
        currentRAFile.push(hr3Record);

        let totalAmountPayable = 0;

        currentRAFile = batches.reduce((currentRAFileResults, batch) => {

            // this loop does not produce any records itself so much as it
            // preserves context and drives the HR4 loop

            const {
                groupNumber,
                providerNumber,
                specialty,
            } = batch;

            return batch.acceptClaims.reduce((currentBatchResults, claim) => {

                const hr4Data = {

                    claimNumber: 'U712' + claimNumber,    //ministry reference number (based on real world sample)
                    transactionType: "1",

                    providerNumber, // corresponds to real world sample
                    specialty,          // from claim header - 1
                    groupIdentifier: groupNumber,

                    ...claim,
                };
                claimNumber++;

                const hr4Record = Object.keys(claimHeaderFields).map((key) => {
                    const fieldDescriptor = claimHeaderFields[key];
                    return formatAlphanumeric((fieldDescriptor.constant || hr4Data[key]), fieldDescriptor.fieldLength);
                }).join('');
                currentBatchResults.push(hr4Record);

                claim.items.forEach((item) => {
                    const feeSubmitted = parseInt(item.feeSubmitted) / 100;
                    const feeSubmittedStr = formatAlphanumeric(/([0-9]*)[.]?/.exec(feeSubmitted)[1], 6, '0');

                    totalAmountPayable += feeSubmitted;

                    const hr5Data = {
                        claimNumber: 'U712' + claimNumber,
                        transactionType: "1",
                        amountSubmitted: feeSubmittedStr,
                        amountPaid: feeSubmittedStr,     // NOTE could divide feeSubmitted by claimMultiplier ...
                        amountPaidSign: " ",
                        explanatoryCode: "  ",

                        ...item,
                    };
                    claimNumber++;  // NOTE this is the second place this is incremented

                    const hr5Record = Object.keys(claimItemFields).map((key) => {
                        const fieldDescriptor = claimItemFields[key];
                        return formatAlphanumeric((fieldDescriptor.constant || hr5Data[key]), fieldDescriptor.fieldLength);
                    }).join('');
                    currentRAFile.push(hr5Record);
                });

                return currentBatchResults;

            }, currentRAFileResults);

        }, currentRAFile);

        // NOTE skipping HR6 record (an edge case that transcends the scope of this fixture engine)

        const hr7Data = [
            {
                transactionCode: '20',
                chequeIndicator: ' ',   // based on real world sample
                transactionDate: formatDate(new Date()),
                transactionAmount: formatAlphanumeric('350', 8, '0'),
                transactionAmountSign: '-',
                transactionMessage: 'PAYMENT REDUCTION-OPTED-IN', //50
            },
            {
                transactionCode: '40',
                chequeIndicator: ' ',   // based on real world sample
                transactionDate: formatDate(new Date()),
                transactionAmount: formatAlphanumeric('350', 8, '0'),
                transactionAmountSign: ' ',
                transactionMessage: 'GROUP MANAGEMENT LEADERSHIP PAYMENT', //50
            },
        ];

        hr7Data.forEach((data) => {

            const hr7Record = Object.keys(accountingTransactionFields).map((key) => {
                const fieldDescriptor = accountingTransactionFields[key];
                return formatAlphanumeric((fieldDescriptor.constant || data[key]), fieldDescriptor.fieldLength, fieldDescriptor.padding || ' ', fieldDescriptor.leftJustified);
            }).join('');
            currentRAFile.push(hr7Record);
        });


        const hr1Data = {
            groupNumber,
            providerNumber: '000000',   // this is all 0s in the real world sample
            specialty: '33',
            officeCode: " ",
            dataSequence: "4",
            paymentDate: formatDate(new Date()),
            payeeName: 'Skippertech Radiology, Ltd.',
            totalAmountPayable: Math.round(totalAmountPayable * 100),
            totalAmountPayableSign: ' ',
            chequeNumber: "99999999",
        };

        const hr1Record = Object.keys(fileHeaderFields).map((key) => {
            const fieldDescriptor = fileHeaderFields[key];
            return formatAlphanumeric((fieldDescriptor.constant || hr1Data[key]), fieldDescriptor.fieldLength, fieldDescriptor.padding || ' ', fieldDescriptor.leftJustified);
        }).join('');
        currentRAFile[0] = hr1Record;

        raFiles[groupNumber] = currentRAFile;
        return raFiles;
    }, {});


    const allKeys = Object.keys(raFilesByGroupNumber);
    const matchersByKey = allKeys.reduce((results, key) => {
        results[key] = RegExp(`^P[A-M]${key}\.000$`);
        return results;
    }, {});

    // update existing RA files and determine which keys belong
    // to resources that have yet to be created
    const newKeys = resources.reduce((remainingKeys, resource) => {

        const {
            description,
        } = resource;

        if (resource.resourceType != REMITTANCE_ADVICE) {
            return remainingKeys;
        }

        return remainingKeys.reduce((results, key) => {

            // this loop returns keys that don't identify the current resource
            // or it updates the resource in place
            if (matchersByKey[key].test(description)) {
                resource.content = raFilesByGroupNumber[key].join('\n');
                resource.modifyTimestamp = processDate;
            }
            else {
                results.push(key);
            }

            return results;

        }, []);

    }, allKeys);

    // create resources for any Group Numbers that don't already have an RA resource
    return newKeys.map((key) => {

        const raFile = raFilesByGroupNumber[key];

        return {
            status: 'DOWNLOADABLE',
            content: raFile.join('\n'),
            description: `P${getMonthCode(processDate)}${key}.${formatAlphanumeric(nextRemittanceAdviceSequenceNumber++, 3, '0')}`,
            resourceType: REMITTANCE_ADVICE,
            createTimestamp: processDate,
            modifyTimestamp: processDate,
        };
    });
};
