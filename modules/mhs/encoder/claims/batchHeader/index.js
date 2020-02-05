'use strict';

/**
 * Batch header processing based on result
 * @param {Object} results
 * @returns {Object}
 */

const processResults = ( results) => {
    const [
        row,
    ] = results;
    let {
        prid,
        full_name
    } = row.practitioner;

    return {
        'record_type': 2,
        'practitioner_number': prid,
        'practitioner_name': full_name,
    };
};

module.exports = processResults;
