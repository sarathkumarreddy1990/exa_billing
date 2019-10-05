'use strict';

const processRow = ( row, context ) => starterData => {
    return {
        'transactionData': context.header,
        'claimType': row.action_code === `a` || row.action_code === `c`
            ? `RGLR`
            : ``,
    };
};

module.exports = {
    processRow,
};
