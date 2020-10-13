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
    'CO2': require('./CO2/recordDescription')
};

const processors = {
    'VS1': require('./VS1'),
    'CO2': require('./CO2')
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
 * Encode the claim data 
 * @param {Object} rows
 * @returns {String}
 */
const encoder = (rows) => {

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
            encoderBatchArray.push(encodedData);
        }

        batchRow.forEach(row => {
            let claimEncodedArray = [];

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


