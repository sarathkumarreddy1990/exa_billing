'use strict';

const processResults = ( results, tracker ) => {
    const [
        data,
    ] = results;

    return {
        'record_type': 4,
        'submitter_prefix': data.submitter_prefix,
        'batch_number': data.batch_number,
        'total_transactions': tracker.transactions,
        'total_segments': tracker.segments,
        // 'empty': ``,
    };
};

module.exports = processResults;
