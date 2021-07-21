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
    'B04': require('./B04/recordDescription'),
    'VS1': require('../claims/VS1/recordDescription')
};

const processors = {
    'B04': require('./B04'),
    'VS1': require('../claims/VS1')
};

for ( const key in descriptors ) {
    const descriptor = descriptors[ key ];
    const failures = validateRecordDescriptor(descriptor, formatters);

    if ( failures.length > 0 ) {
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
const encoder = (rows, isBatchEligibilityFile) => {
    let submittedClaim = [];
    let batches = Object.keys(rows);

    batches.forEach((row)=> {
        let encoderBatchArray = [];
        let batch = rows[row];

        let encodedResult = encodeRecord(
            processors.VS1(batch[0], isBatchEligibilityFile),
            descriptors.VS1
        );

        encoderBatchArray.push(encodedResult.encodedData);

        batch.forEach((batchRow) => {
            let encodeResponse = encodeRecord(
                processors.B04(batchRow),
                descriptors.B04
            );

            encoderBatchArray.push(encodeResponse.encodedData);
        });

        if (encoderBatchArray.length > 1) {
            submittedClaim.push({
                encodedText: finalizeText(encoderBatchArray.join('\r\n')),
                isBatchEligibilityFile: true,
                dataCentreNumber: row
            });
        }
    });

    return {
        submittedClaim
    };

};

module.exports = {
    encoder
};
