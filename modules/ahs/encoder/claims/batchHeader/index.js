'use strict';

const {
    encoder: constants,
} = require('../../../constants');

const processResults = ( results, tracker ) => {
    const [
        data,
    ] = results;

    return {
        'recordType': 2,
        'submitterPrefix': data.submitter_prefix,
        'batchNumber': data.batch_number,
        'empty': ``,
    };
};

module.exports = processResults;
