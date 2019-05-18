const fs = require('fs');
const _ = require('lodash');

const {
    formatDate,
    formatAlphanumeric,
} = require('./../../encoder/util');

const {
    resourceTypes: {
        CLAIMS,
    },

} = require('./../constants');

// NOTE to generate only one HR4 segment per claim, set this to zero (0)
//      to generate an 10941 HR4 segments, set to 10941
const TARGET_SIZE = 0;

const claims = [];
const getClaimFileInfo = (resource) => {

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
            const currentBatch = results[results.length - 1];
            const currentClaim = currentBatch.claims[currentBatch.claims.length - 1];

            currentClaim.patientLastName = record.substr(15, 9);    // "spaces except for RMB claims" (from claim header - 2)
            currentClaim.patientFirstName = record.substr(24, 5);   // "spaces except for RMB claims" (from claim header - 2)
            currentClaim.provinceCode = record.substr(30, 2);   // from claim header - 1
            currentClaim.items = [];
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


const fileHeaderFields = require('./../../parser/remittanceAdvice/fileHeaderFields');
const addressOneFields = require('./../../parser/remittanceAdvice/addressOneFields');
const addressTwoFields = require('./../../parser/remittanceAdvice/addressTwoFields');
const claimHeaderFields = require('./../../parser/remittanceAdvice/claimHeaderFields');
const claimItemFields = require('./../../parser/remittanceAdvice/claimItemFields');
const balanceForwardFields = require('./../../parser/remittanceAdvice/balanceForwardFields');
const accountingTransactionFields = require('./../../parser/remittanceAdvice/accountingTransactionFields');
const messageFacilityFields = require('./../../parser/remittanceAdvice/messageFacilityFields');

let claimNumber = 1234567;

module.exports = (resources) => {

    // produce a keyed object suitable for generating RA files (each key
    // will result in a separate RA file):
    //  {
    //      "AU74-123321-33" : [claimInfo, claimInfo, claimInfo, ...]
    //      "AU75-123321-33" : [claimInfo, claimInfo, claimInfo, ...]
    //  }
    const claimInfoByBillingNumber = resources.filter((resource) => {

        return (resource.resourceType === CLAIMS)
            && (resource.status === 'SUBMITTED');

    }).reduce((groupedClaimInfo, resource) => {

        const claimInfo = getClaimFileInfo(resource);

        const billingNumber = `${claimInfo[0].groupNumber}-${claimInfo[0].providerNumber}-${claimInfo[0].specialty}`;

        groupedClaimInfo[billingNumber] = claimInfo.reduce((result, ci) => {
            return result.concat(ci.claims);
        }, (groupedClaimInfo[billingNumber] || []));

        return groupedClaimInfo;
    }, {});

    const raFilesByBillingNumber = Object.keys(claimInfoByBillingNumber).reduce((raFiles, billingNumber) => {

        const billingNumberParts = billingNumber.split('-');
        const groupNumber = billingNumberParts[0];
        const providerNumber = billingNumberParts[1];
        const specialty = billingNumberParts[2];

        raFiles[billingNumber] = [];
        const currentRAFile = raFiles[billingNumber];

        const claimInfo = claimInfoByBillingNumber[billingNumber];

        const remittanceAdviceStr = '';


        currentRAFile.push('<<THIS IS A PLACEHOLDER>>');

        const hr2Record = 'HR2                              632 Thistle Cres                              ';
        currentRAFile.push(hr2Record);

        const hr3Record = 'HR3THUNDER BAY     ON P7A4Z5                                                   ';
        currentRAFile.push(hr3Record);

        let totalAmountPayable = 0;
        let claimMultiplier = TARGET_SIZE && (TARGET_SIZE / claimInfo.length) || claimInfo.length;
        claimInfo.forEach((claim) => {

            for (let i=0; i<claimMultiplier; i++) {

                const hr4Data = {

                    claimNumber: 'U712' + claimNumber,    //ministry reference number (based on real world sample)
                    transactionType: "1",

                    providerNumber, // corresponds to real world sample
                    specialty,          // from claim header - 1
                    groupIdentifier: groupNumber,

                    ...claim,
                };
                claimNumber++;  // NOTE this gets incremented in two places (this is the first)

                const hr4Record = Object.keys(claimHeaderFields).map((key) => {
                    const fieldDescriptor = claimHeaderFields[key];
                    return formatAlphanumeric((fieldDescriptor.constant || hr4Data[key]), fieldDescriptor.fieldLength);
                }).join('');
                currentRAFile.push(hr4Record);

                claim.items.forEach((item) => {
                    const feeSubmitted = parseInt(item.feeSubmitted) / 100 / claimMultiplier;
                    console.log('feeSubmitted: ', feeSubmitted);
                    totalAmountPayable += feeSubmitted;
                    console.log('totalAmountPayable: ', totalAmountPayable);

                    // const amountSubmitted = ;

                    const hr5Data = {
                        claimNumber: 'U712' + claimNumber,
                        transactionType: "1",
                        amountSubmitted: formatAlphanumeric(/([0-9]*)[.]/.exec(feeSubmitted * claimMultiplier)[1], 6, '0'),
                        amountPaid: formatAlphanumeric(/([0-9]*)[.]/.exec(feeSubmitted)[1], 6, '0'),     // NOTE could divide feeSubmitted by claimMultiplier ...
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
            }
        });

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
            specialty,
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

        return raFiles;
    }, {});

    return Object.keys(raFilesByBillingNumber).map((key) => {

        const billingNumberParts = key.split('-');
        const raFile = raFilesByBillingNumber[key];

        return {
            content: raFile.join('\n'),
            description: `PD${billingNumberParts[0]}.000`,
        };
    });
};
