'use strict';

const {
    encoder: constants,
} = require('../../../constants');

const processResults = ( results, tracker ) => {
    const [
        row,
    ] = results;

    return {
        'record_type': 2,
        'submitter_prefix': row.submitter_prefix,
        'batch_number': row.batch_number,
        'empty': ``,
    };
};

module.exports = processResults;
