'use strict';

const processRow = ( row, header, segmentData ) => {
    return {
        ...row,
        'claimed_amount': row.claimed_amount_indicator
            ? row.claimed_amount
            : ``,
        // 'empty': ``,
    };
};

module.exports = processRow;
