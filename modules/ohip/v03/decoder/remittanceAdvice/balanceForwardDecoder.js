const constants = require('../constants').records.remittanceAdvice;

const balanceForwardDecoder = function(options) {
    const getTransactionIdentifier = () => {
        return 'HR';    // Always 'HR'
    };

    const getRecordType = () => {
        return constants.types.BALANCE_FORWARD;      // Always ''
    };

    const getClaimsAdjustment = (data) => {
        return data.substr(3, 9);
    };

    const getClaimsAdjustmentSign = (data) => {
        return data.substr(12, 1);
    };

    const getAdvances = (data) => {
        return data.substr(13, 9);
    };

    const getAdvancesSign = (data) => {
        return data.substr(22, 1);
    };

    const getReductions = (data) => {
        return data.substr(23, 9);
    };

    const getReductionsSign = (data) => {
        return data.substr(32, 1);
    };

    const getOtherDeductions = (data) => {
        return data.substr(33, 9);
    };

    const getOtherDeductionsSign = (data) => {
        return data.substr(42, 1);
    };

    const getReservedForMOHUse = (data) => {
        return data.substr(43, 36);
    };

    return {
        decode: (record, parser) => {
            return parser.parseBalanceForward({
                claimsAdjustment: getClaimsAdjustment(record),
                claimsAdjustmentSign: getClaimsAdjustmentSign(record),

                advances: getAdvances(record),
                advancesSign: getAdvancesSign(record),

                reductions: getReductions(record),
                reductionsSign: getReductionsSign(record),

                otherDeductions: getOtherDeductions(record),
                otherDeductionsSign: getOtherDeductionsSign(record),
            });
        }
    };
};

module.exports = balanceForwardDecoder;
