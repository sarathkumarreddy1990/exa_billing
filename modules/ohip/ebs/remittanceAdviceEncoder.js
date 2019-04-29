const fs = require('fs');
const _ = require('lodash');

const {
    formatDate,
    formatAlphanumeric,
} = require('../encoder/util');

const {
    resourceTypes: {
        CLAIMS,
    },

} = require('./constants');

const claims = [];

const resources = [
    {
        resourceID: 60000,
        status: 'SUBMITTED',
        filename: '/home/drew/projects/exa-sandbox/Filestores/OHIP/2019/04/29/HDAU73.000',
        description: 'HDAU73.000',
        resourceType: 'CL'
    },
    {
        resourceID: 60001,
        status: 'SUBMITTED',
        filename: '/home/drew/projects/exa-sandbox/Filestores/OHIP/2019/04/29/HDAU74.000',
        description: 'HDAU74.000',
        resourceType: 'CL'
    },
    {
        resourceID: 60002,
        status: 'SUBMITTED',
        filename: '/home/drew/projects/exa-sandbox/Filestores/OHIP/2019/04/29/HDAU73.001',
        description: 'HDAU73.001',
        resourceType: 'CL'
    },

];


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


const fileHeaderFields = require('../parser/remittanceAdvice/fileHeaderFields');
const addressOneFields = require('../parser/remittanceAdvice/addressOneFields');
const addressTwoFields = require('../parser/remittanceAdvice/addressTwoFields');
const claimHeaderFields = require('../parser/remittanceAdvice/claimHeaderFields');
const claimItemFields = require('../parser/remittanceAdvice/claimItemFields');
const balanceForwardFields = require('../parser/remittanceAdvice/balanceForwardFields');
const accountingTransactionFields = require('../parser/remittanceAdvice/accountingTransactionFields');
const messageFacilityFields = require('../parser/remittanceAdvice/messageFacilityFields');

let claimNumber = 1234567;

module.exports = () => {

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

    // console.log(`claimInfoByBillingNumber: ${JSON.stringify(claimInfoByBillingNumber)}`);


    const raFilesByBillingNumber = Object.keys(claimInfoByBillingNumber).reduce((raFiles, billingNumber) => {

        const billingNumberParts = billingNumber.split('-');
        const groupNumber = billingNumberParts[0];
        const providerNumber = billingNumberParts[1];
        const specialty = billingNumberParts[2];

        raFiles[billingNumber] = [];
        const currentRAFile = raFiles[billingNumber];

        const claimInfo = claimInfoByBillingNumber[billingNumber];
        // console.log('claimInfo: ', claimInfo);

        const remittanceAdviceStr = '';
        // console.log('claimsFile: ', claimInfoBySpecialty);


        currentRAFile.push('<<THIS IS A PLACEHOLDER>>');
        console.log('hr1Record: ', currentRAFile[0]);

        const hr2Record = 'HR2                              632 Thistle Cres                              ';
        currentRAFile.push(hr2Record);
        console.log('hr2Record: ', hr2Record);

        const hr3Record = 'HR3THUNDER BAY     ON P7A4Z5                                                   ';
        currentRAFile.push(hr3Record);
        console.log('hr3Record: ', hr3Record);

        let totalAmountPayable = 0;
        claimInfo.forEach((claim) => {

            // console.log('CLAIM: ', claim);
            const hr4Data = {

                claimNumber: 'U712' + claimNumber,    //ministry reference number (based on real world sample)
                transactionType: "1",    //1

                providerNumber, // corresponds to real world sample
                specialty,          // from claim header - 1
                groupIdentifier: groupNumber,

                ...claim,

                // accountingNumber: "",   // from claim header - 1
                // patientLastName: "",    // "spaces except for RMB claims" (from claim header - 2)
                // patientFirstName: "",   // "spaces except for RMB claims" (from claim header - 2)
                // provinceCode: "",   // from claim header - 1
                // healthRegistrationNumber: "",
                // versionCode: "",    // from claim header - 1
                // paymentProgram: "", // from claim header - 1
                // serviceLocationIndicator: "", // from claim header - 1
            };
            claimNumber++;  // NOTE this gets incremented in two places (this is the first)

            const hr4Record = Object.keys(claimHeaderFields).map((key) => {
                const fieldDescriptor = claimHeaderFields[key];
                return formatAlphanumeric((fieldDescriptor.constant || hr4Data[key]), fieldDescriptor.fieldLength);
            }).join('');
            currentRAFile.push(hr4Record);
            console.log('hr4Record: ', hr4Record);


            claim.items.forEach((item) => {
                // console.log('ITEM: ', item);
                const feeSubmitted = parseInt(item.feeSubmitted);
                totalAmountPayable += feeSubmitted;

                const hr5Data = {
                    claimNumber: 'U712' + claimNumber,    // 11 chars
                    transactionType: "1",    // 1 char
                    amountSubmitted: formatAlphanumeric(feeSubmitted, 6, '0'),     // 6
                    amountPaid: formatAlphanumeric(feeSubmitted, 6, '0'),     // 6
                    amountPaidSign: " ", // 1
                    explanatoryCode: "  ", //2

                    ...item,
                };
                // console.log('hr5Data: ', hr5Data);
                claimNumber++;  // NOTE this is the second place this is incremented

                const hr5Record = Object.keys(claimItemFields).map((key) => {
                    const fieldDescriptor = claimItemFields[key];
                    return formatAlphanumeric((fieldDescriptor.constant || hr5Data[key]), fieldDescriptor.fieldLength);
                }).join('');
                currentRAFile.push(hr5Record);
                console.log('hr5Record: ', hr5Record);
                // HR5U712131411912017121101X091B 002358002358
                // HR5U712123457412019042201 X179   5678  5678 34
            });

            // console.log('Total Amount Payable: ', totalAmountPayable);
            // "serviceDate": "",    // 8 chars,
            // "numberOfServices": "",   // 2
            // "amountSubmitted": "",    //6
            // "serviceCode": "",    // 5
        });

        // NOTE skipping HR6 record (an edge case that transcends the scope of this fixture engine)

        const hr7Data = [
            {
                transactionCode: '20',
                chequeIndicator: ' ',   // based on real world sample
                transactionDate: formatDate(new Date()),
                transactionAmount: formatAlphanumeric('250', 8, '0'),
                transactionAmountSign: '-',
                transactionMessage: 'PAYMENT REDUCTION-OPTED-IN', //50
            },
            {
                transactionCode: '40',
                chequeIndicator: ' ',   // based on real world sample
                transactionDate: formatDate(new Date()),
                transactionAmount: formatAlphanumeric('250', 8, '0'),
                transactionAmountSign: ' ',
                transactionMessage: 'GROUP MANAGEMENT LEADERSHIP PAYMENT', //50
            },
        ];

        hr7Data.forEach((data) => {

            const hr7Record = Object.keys(accountingTransactionFields).map((key) => {
                const fieldDescriptor = accountingTransactionFields[key];
                // console.log('claimInfoBySpecialty: ', claimInfoBySpecialty);
                return formatAlphanumeric((fieldDescriptor.constant || data[key]), fieldDescriptor.fieldLength, fieldDescriptor.padding || ' ', fieldDescriptor.leftJustified);
            }).join('');
            currentRAFile.push(hr7Record);
            console.log('hr7Record: ', hr7Record);
        });


        const hr1Data = {
            groupNumber,
            providerNumber: '000000',   // this is all 0s in the real world sample
            specialty,
            officeCode: " ",
            dataSequence: "4",
            paymentDate: formatDate(new Date()),
            payeeName: 'Skippertech Radiology, Ltd.',
            totalAmountPayable,
            totalAmountPayableSign: ' ',
            chequeNumber: "99999999",
        };

        const hr1Record = Object.keys(fileHeaderFields).map((key) => {
            const fieldDescriptor = fileHeaderFields[key];
            // console.log('claimInfoBySpecialty: ', claimInfoBySpecialty);
            return formatAlphanumeric((fieldDescriptor.constant || hr1Data[key]), fieldDescriptor.fieldLength, fieldDescriptor.padding || ' ', fieldDescriptor.leftJustified);
        }).join('');
        currentRAFile[0] = hr1Record;
        console.log('hr1Record: ', hr1Record);


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
