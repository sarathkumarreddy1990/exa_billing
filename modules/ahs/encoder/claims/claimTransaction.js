'use strict';

const constants = require('../../constants');
const headerEncoder = require('./claimTransactionHeader');
const segmentEncoder = require('./claimTransactionSegment');

const encoder = ( batchData, context ) => {
    const header = headerEncoder(batchData, context);
    const segment = segmentEncoder(batchData, context);

    let claimTransaction = ``;

    claimTransaction += header;
    claimTransaction += segment;
    claimTransaction += constants.encoder.endOfRecord;

    return claimTransaction;
};

module.exports = encoder;
