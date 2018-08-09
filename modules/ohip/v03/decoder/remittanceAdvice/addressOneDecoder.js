const constants = require('../constants').records.remittanceAdvice;

const addressOneDecoder = function(options) {

    const getTransactionIdentifier = () => {
        return 'HR';    // Always 'HR'
    };
    const getRecordType = () => {
        return constants.types.ADDRESS_ONE;      // Always '2'
    };

    const getNameOfBillingAgent = (data) => {
        return data.substr(3, 30);
    };
    const getAddressLineOne = (data) => {
        return data.substr(33, 25);
    };

    const getReservedForMOHUse = (data) => {
        return data.substr(59, 21);
    };

    return {
        decode: (addressOneStr, parser) => {
            return parser.parseAddressOne({
                // transactionIdentifier = getTransactionIdentifier(addressOneStr),
                // recordType: getRecordType(addressOneStr),
                nameOfBillingAgent: getNameOfBillingAgent(addressOneStr),
                addressLineOne: getAddressLineOne(addressOneStr),
                reservedForMOHUse: getReservedForMOHUse(addressOneStr),
            });
        }
    };
};

module.exports = addressOneDecoder;
