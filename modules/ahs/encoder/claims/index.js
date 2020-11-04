'use strict';

const {
    finalizeText,
} = require('../util');

const formatters = require('./formatters');
const initCodec = require('../../../../lib/vandelay/lendel');

const {
    validateRecordDescriptor,
    hydrateRecordDescriptor,
} = require('../../../../lib/vandelay/util');

const {
    encodeRecord,
} = initCodec(formatters);

const descriptors = {
    'batchHeader': require('./batchHeader/recordDescriptor'),
    'batchTrailer': require('./batchTrailer/recordDescriptor'),
};

const processors = {
    'batchHeader': require('./batchHeader'),
    'batchTrailer': require('./batchTrailer'),
    'claimTransaction': require('./claimTransaction'),
};

/**
 * Validate all descriptors first
 * - if even one fails we don't want project to run - files are static and should always pass
 */

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
};

/**
 *
 * @param rows
 * @return {Array<{ patient_uli: string }>}
 */
const encode = ( rows ) => {
    // Encode rows as formatted text

    const tracker = {
        'segments': 0,
        'transactions': rows.length,
    };

    const encodedArray = [
        /**
         * BATCH HEADER RECORD
         */
        encodeRecord(
            processors.batchHeader(rows),
            descriptors.batchHeader,
        ).encodedData,

        /**
         * TRANSACTIONS / CLAIMS
         */
        ...rows.map(processors.claimTransaction(tracker)),

        /**
         * BATCH TRAILER RECORD
         */
        encodeRecord(
            processors.batchTrailer(rows, tracker),
            descriptors.batchTrailer,
        ).encodedData,
    ];

    return finalizeText(encodedArray.join(`\r\n`));
};

module.exports = {
    encode,
};
