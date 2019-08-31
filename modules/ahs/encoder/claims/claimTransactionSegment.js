'use strict';

const constants = require('../../constants');
const segmentTypes = require('./claimSegmentTypes');

const encoder = ( batchData, context ) => {
    const segmentEncoder = segmentTypes[ context.segmentType ];

    const claimTransactionSegment = segmentEncoder(batchData, context);

    return claimTransactionSegment.padEnd(219, ` `);;
};

module.exports = encoder;
