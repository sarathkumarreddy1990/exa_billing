'use strict';

const processRow = ( row, header, segmentData ) => {
    return {
        ...row,
        'claimed_amount': row.claimed_amount_indicator
            ? row.claimed_amount
            : ``,
        'emsaf_indicator': row.emsaf_reason
            ? `Y`
            : ``,
        // 'empty': ``,
    };
};

module.exports = processRow;
