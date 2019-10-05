'use strict';

const processRow = ( row, context ) => {
    
    return {
        'recordType': 3,
        'submitterPrefix': row.submitter_prefix,
        'year': row.year,
        'sourceCode': row.source_code,
        'sequenceNumber': row.sequence_number,
        'checkDigit': row.check_digit,
        'transactionType': row.transaction_type,
    };
};

module.exports = {
    processRow,
};
