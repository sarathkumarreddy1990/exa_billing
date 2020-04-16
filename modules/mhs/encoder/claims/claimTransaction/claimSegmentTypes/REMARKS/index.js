'use strict';
/**
 * Remarks processing based on record
 * @param {Object} row
 * @param {Object} index
 * @returns {Object}
 */

const processResults = ( row, string) => {
    let {
        practitioner,
        sequence_number,
        claim_number
    } = row;
    return {
        'record_type': 5,
        'practitioner_number': practitioner.prid,
        'remarks': string,
        'remarks_sequence_number': sequence_number,
        'claim_number': claim_number,
    };
};

module.exports = processResults;
