'use strict';

const {
    processRow: claimTransactionHeader,
} = require('./claimTransactionHeader');

const {
    processRow: claimTransactionSegment,
} = require('./claimSegmentTypes');

const processRow = tracker => row => {

    const headerContext = claimTransactionHeader(row);
    
    const segmentContext = claimTransactionSegment(row, headerContext);

    // const segments = get
};

module.exports = processRow;
