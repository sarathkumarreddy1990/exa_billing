'use strict';

const processRow = ( row ) => {
    return {
        ...row,
        'claimed_amount': row.claimed_amount_indicator
            ? row.claimed_amount
            : ``,
        // 'empty': ``,
    };
};

module.exports = processRow;
