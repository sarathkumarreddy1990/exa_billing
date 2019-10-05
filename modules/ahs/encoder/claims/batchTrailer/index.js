'use strict';

const {
    encoder: constants,
} = require('../../../constants');

const processResults = ( results, tracker ) => {
    const [
        data,
    ] = results;

    return {
        'recordType': 4,
        'submitterPrefix': data.submitter_prefix,
        'batchNumber': data.batch_number,
        'totalTransactions': tracker.transactions,
        'totalSegments': tracker.segments,
        'empty': ``,
    };
};

module.exports = processResults;
