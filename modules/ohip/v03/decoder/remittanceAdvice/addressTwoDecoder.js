const constants = require('../constants').records.remittanceAdvice;

const addressTwoDecoder = function(options) {

    const getTransactionIdentifier = () => {
        return 'HR';    // Always 'HR'
    };
    const getRecordType = () => {
        return constants.types.ADDRESS_TWO;      // Always ''
    };

    const getAddressLineTwo = (data) => {
        return data.substr(3, 25);
    };

    const getAddressLineThree = (data) => {
        return data.substr(28, 25);
    };

    const getReservedForMOHUse = (data) => {
        return data.substr(58, 21);
    };

    return {
        decode: (addressTwoStr, parser) => {
            return parser.parseAddressTwo({
                addressLineTwo: getAddressLineTwo(addressTwoStr),
                addressLineThree: getAddressLineThree(addressTwoStr),
            });
        }
    };
};

module.exports = addressTwoDecoder;
