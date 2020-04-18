'use strict';

const processRow = ( row, context, segmentData ) => {
    const {
        cross_reference_claim_numbers,
    } = row;

    return {
        'cross_reference_claim_numbers': cross_reference_claim_numbers.join(``),
    };
};

module.exports = processRow;
