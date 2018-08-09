const sprintf = require('sprintf');
const constants = require('../constants').encoder;
const util = require('./util');


const ClaimHeader2Encoder = function(options) {

    const getTransactionIdentifier = () => {
        // mandatory
        // field length: 2
        // format: alpha
        return 'HE';    // always
    };

    const getRecordIdentification = () => {
        // mandatory
        // field length: 1
        // format: alpha
        return 'R';     // always
    };

    const getRegistrationNumber = (claimData) => {
        // required: mandatory
        // field length: 12
        // format: alphanumeric
        return util.formatAlphanumeric(claimData.registrationNumber, 12);
    };

    const getPatientLastName = (claimData) => {
        // required: mandatory
        // field length: 9
        // format: ALPHA
        return util.formatAlphanumeric(claimData.patientLastName, 9, ' ', true);
    };

    const getPatientFirstName = (claimData) => {
        // required: mandatory
        // field length: 5
        // format: ALPHA
        return util.formatAlphanumeric(claimData.patientFirstName, 5, ' ', true);
    };
    const getPatientSex = (claimData) => {
        // required: mandatory
        // field length: 1
        // format: numeric
        return util.formatAlphanumeric(claimData.patientSex, 1);
    };

    const getProvinceCode = (claimData) => {
        // required: mandatory
        // field length: 2
        // format: ALPHA
        return util.formatAlphanumeric(claimData.provinceCode, 2);
    };

    const getReservedForMOHUse = () => {
        // required: must be spaces
        // field length: 47
        // format: spaces
        return sprintf('%47.47s', ' ');
    };



    return {
        encode: (claimData, context) => {
            let claimHeader2Record = '';

            claimHeader2Record += getTransactionIdentifier();
            claimHeader2Record += getRecordIdentification();
            claimHeader2Record += getRegistrationNumber(claimData);
            claimHeader2Record += getPatientLastName(claimData);
            claimHeader2Record += getPatientFirstName(claimData);
            claimHeader2Record += getPatientSex(claimData);
            claimHeader2Record += getProvinceCode(claimData);
            claimHeader2Record += getReservedForMOHUse();

            return claimHeader2Record + constants.endOfRecord;
        }
    };
}

module.exports = ClaimHeader2Encoder;
