'use strict';

const processRow = ( row, context, segmentData ) => {
    return {
        'transactionData': context,
        ...segmentData
    };
};

module.exports = processRow;
