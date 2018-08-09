const constants = require('../constants').records.remittanceAdvice;

const fileHeaderDecoder = function(options) {

    const getTransactionIdentifier = (record) => {
        return 'HR';    // Always 'HR'
    };

    const getRecordType = () => {
        return constants.types.FILE_HEADER;      // Always ''
    };

    const getTechSpecReleaseIdentifier = () => {
        return 'V03';   // Always 'V03'
    };

    const getReservedForMOHUse = () => {
        return '0';
    };

    const getGroupNumber = (data) => {
        return data.substr(7, 4);
    };
    const getProviderNumber = (data) => {
        return data.substr(11, 6);
    };

    const getSpecialty = (data) => {
        return data.substr(17, 2);
    };

    const getMOHOfficeCode = (data) => {
        return data.substr(19, 1);
    };

    const getDataSequence = (data) => {
        return data.substr(20, 1);
    };

    const getPaymentDate = (data) => {
        return data.substr(21, 8);
    };

    const getPayeeName = (data) => {
        return data.substr(29, 30);
    };

    const getTotalAmountPayable = (data) => {
        return data.substr(59, 9);
    };

    const getTotalAmountPayableSign = (data) => {
        return data.substr(68, 1);
    };

    const getChequeNumber = (data) => {
        return data.substr(69, 8);
    };

    const getReservedForMOHUse2 = (data) => {
        return data.substr(77, 2);
    };

    return {
        decode: (fileHeaderStr, parser) => {
            return parser.parseFileHeader({
                // getTransactionIdentifier(),
                // getRecordType(),
                // getTechSpecReleaseIdentifier(),
                // getReservedForMOHUse(),
                groupNumber: getGroupNumber(fileHeaderStr),
                providerNumber: getProviderNumber(fileHeaderStr),
                specialty: getSpecialty(fileHeaderStr),
                // getMOHOfficeCode(fileHeaderStr),
                dataSequence: getDataSequence(fileHeaderStr),
                paymentDate: getPaymentDate(fileHeaderStr),
                payeeName: getPayeeName(fileHeaderStr),
                totalAmountPayable: getTotalAmountPayable(fileHeaderStr),
                totalAmountPayableSign: getTotalAmountPayableSign(fileHeaderStr),
                chequeNumber: getChequeNumber(fileHeaderStr),
                // getReservedForMOHUse2(fileHeaderStr),
            });
        }

    };
};

module.exports = fileHeaderDecoder;
