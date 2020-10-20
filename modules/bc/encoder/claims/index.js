'use strict';
const formatters = require('../formatters');
const initCodec = require('../../../../lib/vandelay/lendel');
const {
    encodeRecord,
} = initCodec(formatters);
const {
    finalizeText,
} = require('../util');

const {
    validateRecordDescriptor,
    hydrateRecordDescriptor,
} = require('../../../../lib/vandelay/util');

const descriptors = {
    'VS1': require('./VS1/recordDescription'),
    'CO2': require('./CO2/recordDescription'),
    'NO1': require('./NO1/recordDescription')
};

const processors = {
    'VS1': require('./VS1'),
    'CO2': require('./CO2'),
    'NO1': require('./NO1')
};

for (const key in descriptors) {
    const descriptor = descriptors[key];
    const failures = validateRecordDescriptor(descriptor, formatters);

    if (failures.length > 0) {
        failures.forEach(console.error);
        throw new Error(`Failed validation of claim descriptor '${key}'`);
    }

    hydrateRecordDescriptor(descriptor, fieldDesc => ({
        'isLeftJustified': fieldDesc.format.toLowerCase() === `a`
    }));
}

/**
 * checkFileLimit - Checks the File has less than 9000 lines and $9,999,999.99
 * @param {BigInt} rowCount - file row count
 * @param {BigInt} billFee - bill fee
 */
const checkFileLimit = (rowCount, billFee) => {
    let fileError = [];

    if (rowCount > 9000) {
        fileError.push({
            fieldName: 'File type error',
            message: 'File consist more than 9000 lines',
            segmentID: '',
            segmentName: ''
        });
    } else if (billFee > 9999999.99) {
        fileError.push({
            fieldName: 'File type error',
            message: 'File total bill fee exceeds $9,999,999.99',
            segmentID: '',
            segmentName: ''
        });
    }

    return { fileError };
};

/**
 * Encode the claim data 
 * @param {Object} rows
 * @param {Boolean} isCron
 * @returns {String}
 */
const encoder = (rows, isCron) => {

    let {
        claimData
    } = rows;

    let batches = Object.keys(claimData);
    let encoderErrorArray = {};
    let reciprocalErrorArray = {};
    let commonError = [];
    let submittedClaim = [];
    let totalClaimIdsSubmitted = [];

    batches.forEach(batch => {
        let encoderBatchArray = [];
        let batchRow = claimData[batch];
        let rowCount = 0;
        let totalFileBillFee = 0;
        let submittedClaimIds = [];
        let isError = false;

        // VS1 Record 
        let encodedResult = encodeRecord(
            processors.VS1(batchRow[0]),
            descriptors.VS1
        );

        let {
            encodedData,
            error
        } = encodedResult;


        if (error) {
            commonError = commonError.concat(error);
            isError = true;
        } else {
            rowCount++;
            encoderBatchArray.push(encodedData);
        }

        batchRow.forEach(row => {
            let claimEncodedArray = [];
            let isN01 = row.can_supporting_text && row.can_supporting_text.length > 20;

            row.health_services.forEach(service => {

                if ((row.is_employed || row.submission_code == 'W') && !(row.phn && row.phn.country_alpha_3_code === 'can' && row.phn.province_alpha_2_code === 'BC')) {
                    let rcpError = [{
                        fieldName: 'Insurer code',
                        message: 'Other province/reciprocal claims are not eligible for WSBC.',
                        segmentID: 'C02',
                        segmentName: 'P100'
                    }];

                    if (!reciprocalErrorArray[`${row.claim_number}`]) {
                        reciprocalErrorArray[`${row.claim_number}`] = [];
                    }

                    reciprocalErrorArray[`${row.claim_number}`] = reciprocalErrorArray[`${row.claim_number}`].concat(rcpError);
                } else {

                    //C02 Record
                    let CO2encodedText = encodeRecord(
                        processors.CO2(row, service),
                        descriptors.CO2
                    );

                    if (CO2encodedText.error) {
                        isError = true;

                        if (!encoderErrorArray[`${row.claim_number}`]) {
                            encoderErrorArray[`${row.claim_number}`] = [];
                        }

                        encoderErrorArray[`${row.claim_number}`] = encoderErrorArray[`${row.claim_number}`].concat(CO2encodedText.error);
                    } else if (!isError) {
                        claimEncodedArray.push(CO2encodedText.encodedData);
                    }
                }
            });

            if (row.submission_code === 'C' && !isN01) {
                isError = true;
                let noteError = [{
                    fieldName: 'Note record(N01)',
                    message: 'Submission code C required N01 record note information',
                    segmentID: 'N01',
                    segmentName: 'P22'
                }];

                if (!encoderErrorArray[`${row.claim_number}`]) {
                    encoderErrorArray[`${row.claim_number}`] = [];
                }

                encoderErrorArray[`${row.claim_number}`] = encoderErrorArray[`${row.claim_number}`].concat(noteError);
            } else if (isN01 && !isError) {

                //N01 Record
                let N01encodedText = encodeRecord(
                    processors.NO1(row),
                    descriptors.NO1
                );

                if (N01encodedText.error) {
                    isError = true;

                    if (!encoderErrorArray[`${row.claim_number}`]) {
                        encoderErrorArray[`${row.claim_number}`] = [];
                    }

                    encoderErrorArray[`${row.claim_number}`] = encoderErrorArray[`${row.claim_number}`].concat(N01encodedText.error);
                } else if (!isError) {
                    rowCount++;
                    claimEncodedArray.push(N01encodedText.encodedData);
                }
            }

            // Check for File Limit 
            let { fileError = [] } = checkFileLimit(rowCount + claimEncodedArray.length, (parseFloat(totalFileBillFee) + parseFloat(row.claim_total_bill_fee)));

            // split claims into mulitple file when it is cron and with only file limit error  
            if (fileError.length && isCron && !isError && rowCount > 1) {

                submittedClaim.push({
                    encodedText: finalizeText(encoderBatchArray.join('\r\n')),
                    submittedClaimIds,
                    dataCentreNumber: batch
                });

                totalClaimIdsSubmitted = totalClaimIdsSubmitted.concat(submittedClaimIds);

                encoderBatchArray = [];
                submittedClaimIds = [];
                isError = error ? true : false;
                rowCount = claimEncodedArray.length + 1;
                totalFileBillFee = row.claim_total_bill_fee;
                encoderBatchArray.push(encodedData);
                encoderBatchArray = encoderBatchArray.concat(claimEncodedArray);
                submittedClaimIds.push(row.claim_number);
            } else if (fileError.length) {
                commonError = commonError.concat(fileError);
            } else if (!isError && claimEncodedArray.length) {
                encoderBatchArray = encoderBatchArray.concat(claimEncodedArray);
                rowCount += claimEncodedArray.length;
                totalFileBillFee += row.claim_total_bill_fee;
                submittedClaimIds.push(row.claim_number);
            }

        });

        if (!isError && encoderBatchArray.length) {
            submittedClaim.push({
                encodedText: finalizeText(encoderBatchArray.join('\r\n')),
                submittedClaimIds,
                dataCentreNumber: batch
            });

            totalClaimIdsSubmitted = totalClaimIdsSubmitted.concat(submittedClaimIds);
        }
    });

   

    return {
        submittedClaim,
        totalClaimIdsSubmitted,
        errorData: {
            commonError,
            encoderErrorArray,
            reciprocalErrorArray
        }
    };

};

module.exports = {
    encoder
};


