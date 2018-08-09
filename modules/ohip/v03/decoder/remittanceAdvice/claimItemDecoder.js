const constants = require('../constants').records.remittanceAdvice;

const claimItemDecoder = function(options) {

    const getTransactionIdentifier = () => {
        return 'HR';    // Always 'HR'
    };
    const getRecordType = () => {
        return constants.types.CLAIM_ITEM;      // Always ''
    };

    const getClaimNumber = (data) => {
        return data.substr(3, 11);
    };

    const getTransactionType = (data) => {
        return data.substr(14, 1);
    };

    const getServiceDate = (data) => {
        return data.substr(15, 8);
    };

    const getNumberOfServices = (data) => {
        return data.substr(23, 2);
    };

    const getServiceCode = (data) => {
        return data.substr(25, 5);
    };

    const getReservedForMOHUse = (data) => {
        return data.substr(30, 1);
    };

    const getAmountSubmitted = (data) => {
        return data.substr(31, 6);
    };

    const getAmountPaid = (data) => {
        return data.substr(37, 6);
    };

    const getAmountPaidSign = (data) => {
        return data.substr(43, 1);
    };

    const getExplanatoryCode = (data) => {
        return data.substr(44, 2);
    };

    const getReservedForMOHUse2 = (data) => {
        return data.substr(46, 33);
    };

    return {
        decode: (record, parser) => {
            return parser.parseClaimItem({
                claimNumber: getClaimNumber(record),
                transactionType: getTransactionType(record),
                serviceDate: getServiceDate(record),
                numberOfServices: getNumberOfServices(record),
                serviceCode: getServiceCode(record),
                amountSubmitted: getAmountSubmitted(record),
                amountPaid: getAmountPaid(record),
                amountPaidSign: getAmountPaidSign(record),
                explanatoryCode: getExplanatoryCode(record),
            });
        }
    };
};

module.exports = claimItemDecoder;
