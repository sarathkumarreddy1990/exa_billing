const constants = require('../constants').records.remittanceAdvice;

const AccountingTransactionDecoder = function(options) {
    const getTransactionIdentifier = () => {
        return 'HR';    // Always 'HR'
    };

    const getRecordType = () => {
        return constants.types.ACCOUNTING_TRANSACTION;      // Always '7'
    };

    const getTransactionCode = (data) => {
        return data.substr(3, 2);
    };

    const getChequeIndicator = (data) => {
        return data.substr(5, 1);
    };

    const getTransactionDate = (data) => {
        return data.substr(6, 8);
    };

    const getTransactionAmount = (data) => {
        return data.substr(14, 8);
    };

    const getTransactionAmountSign = (data) => {
        return data.substr(22, 1);
    };

    const getTransactionMessage = (data) => {
        return data.substr(23, 50);
    };

    const getReservedForMOHUse = (data) => {
        return data.substr(73, 6);
    };


    return {
        decode: (record, parser) => {
            return parser.parseAccountingTransaction({
                transactionCode: getTransactionCode(record),
                chequeIndicator: getChequeIndicator(record),
                transactionDate: getTransactionDate(record),
                transactionAmount: getTransactionAmount(record),
                transactionAmountSign: getTransactionAmountSign(record),
                transactionMessage: getTransactionMessage(record),
            });
        }
    };
};

module.exports = AccountingTransactionDecoder;
