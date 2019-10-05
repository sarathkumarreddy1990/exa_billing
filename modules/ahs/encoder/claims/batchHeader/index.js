'use strict';

const {
    encoder: constants,
} = require('../../../constants');

const processResults = ( results, tracker ) => {
    const [
        row,
    ] = results;

    return {
        'recordType': 2,
        'submitterPrefix': row.submitter_prefix,
        'batchNumber': row.batch_number,
        'empty': ``,
    };
};

module.exports = processResults;
