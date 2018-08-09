const constants = require('../constants').records.remittanceAdvice;

const claimHeaderDecoder = function(options) {

    const getTransactionIdentifier = () => {
        return 'HR';    // Always 'HR'
    };

    const getRecordType = () => {
        return constants.types.CLAIM_HEADER;      // Always ''
    };

    const getClaimNumber = (data) => {
        return data.substr(3, 11);
    };

    const getTransactionType = (data) => {
        return data.substr(14, 1);
    };

    const getProviderNumber = (data) => {
        return data.substr(15, 6);
    };

    const getSpecialty = (data) => {
        return data.substr(21, 2);
    };

    const getAccountingNumber = (data) => {
        return data.substr(23, 8);
    };

    const getPatientLastName = (data) => {
        return data.substr(31, 14);
    };

    const getPatientFirstName = (data) => {
        return data.substr(45, 5);
    };

    const getProvinceCode = (data) => {
        return data.substr(50, 2);
    };

    const getHealthRegistrationNumber = (data) => {
        return data.substr(52, 12);
    };

    const getVersionCode = (data) => {
        return data.substr(64, 2);
    };


    const getPaymentProgram = (data) => {
        return data.substr(66, 3);
    };

    const getServiceLocationIndicator = (data) => {
        return data.substr(69, 4);
    };

    const getMOHGroupIdentifier = (data) => {
        return data.substr(73, 4);
    };

    const getReservedForMOHUse = (data) => {
        return data.substr(77, 2);
    };

    return {
        decode: (record, parser) => {
            return parser.parseClaimHeader({
                claimNumber: getClaimNumber(record),
                transactionType: getTransactionType(record),
                providerNumber: getProviderNumber(record),
                specialty: getSpecialty(record),
                accountingNumber: getAccountingNumber(record),
                patientLastName: getPatientLastName(record),
                patientFirstName: getPatientFirstName(record),
                provinceCode: getProvinceCode(record),
                healthRegistrationNumber: getHealthRegistrationNumber(record),
                versionCode: getVersionCode(record),
                paymentProgram: getPaymentProgram(record),
                serviceLocationIndicator: getServiceLocationIndicator(record),
            });
        },
    };
};

module.exports = claimHeaderDecoder;
