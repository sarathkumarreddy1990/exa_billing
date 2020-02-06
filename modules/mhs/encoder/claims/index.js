'use strict';
const formatters = require('./formatters');
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
    'batchHeader': require('./batchHeader/recordDescription'),
    'batchTrailer': require('./batchTrailer/recordDescription'),
    'fileHeader': require('./fileHeader/recordDescription'),
    'fileTrailer': require('./fileTrailer/recordDescription')
};

const processors = {
    'batchHeader': require('./batchHeader'),
    'batchTrailer': require('./batchTrailer'),
    'claimTransaction': require('./claimTransaction'),
    'fileHeader': require('./fileHeader'),
    'fileTrailer': require('./fileTrailer')
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
const encoder = (rows) => {

    let {
        claimData,
        companyInfo
    } = rows;
    
    let tracker = {
        'SOCIOLOGICAL': 0,
        'REGISTRANT':0,
        'REMARKS': 0,
        'SERVICE': 0,
        'NONRESIDENCE': 0,
        'total_fee': 0
    };

    let batches = Object.keys(claimData);
    const  encoderArray = [];

    /** 
     * File Header
     */
    encoderArray.push(encodeRecord(
        processors.fileHeader(claimData[batches[0]][0], companyInfo),
        descriptors.fileHeader,
    ));

    batches.forEach(batch =>{
        let batch_tracker = {
            'SOCIOLOGICAL': 0,
            'REGISTRANT': 0,
            'REMARKS': 0,
            'SERVICE': 0,
            'NONRESIDENCE': 0,
            'total_fee': 0
        };
        let row = claimData[batch];

        /** 
         * Batch Header
         */
        encoderArray.push(encodeRecord(
            processors.batchHeader(row),
            descriptors.batchHeader
        ));

        /**
         * TRANSACTIONS / CLAIMS
         */
        encoderArray.push(row.map(processors.claimTransaction(tracker, batch_tracker)).join('\n'));

        /**
         * BATCH TRAILER RECORD
         */
        encoderArray.push(encodeRecord(
            processors.batchTrailer(row, batch_tracker),
            descriptors.batchTrailer,
        ));

    });

    let lastBach = claimData[batches[batches.length-1]];
  
    /** 
     * File Trailer
     */
    encoderArray.push(encodeRecord(
        processors.fileTrailer(lastBach[lastBach.length - 1], tracker, companyInfo),
        descriptors.fileTrailer,
    ));
    
    return {
        encodedText: finalizeText(encoderArray.join('\n'))
    };

};

module.exports = {
    encoder
};


