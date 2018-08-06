const sprintf = require('sprintf');
const constants = require('../constants').encoder;
const util = require('./util');

/**
 * const ClaimHeader1 - Responsible for encoding a claim header-1 record
 * (section 4.7 of the OHIP v03 Technical Specifications document)
 *
 * @param  {type} options description
 * @return {type}         description
 */
const ClaimHeader1Encoder = function(options) {

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
        return 'H';     // always
    };

    const getHealthNumber = (claimData) => {
        // mandatory for all claims except for RMB (TODO)
        // not required for RMB claims
        // field length: 10
        // format: numeric or spaces
        return util.formatAlphanumeric(claimData.healthNumber, 10);
    };

    const getVersionCode = (claimData) => {
        // mandatory for all claims except for RMB (TODO)
        // not required for RMB claims
        // field length: 2
        // format: Alpha or spaces
        return util.formatAlphanumeric(claimData.versionCode, 2);
    };


    const getPatientDateOfBirth = (claimData) => {
        // mandatory
        // field length: 8
        // format: Date or Spaces
        return util.formatDate(claimData.dateOfBirth);
    };
    const getAccountingNumber = (claimData) => {
        // optional
        // field length: 8
        // format: alphanumeric
        return util.formatAlphanumeric(claimData.accountingNumber, 8);
    };
    const getPaymentProgram = (claimData) => {
        // mandatory
        // field length: 3
        // format: ALPHA
        return util.formatAlphanumeric(claimData.paymentProgram, 3);
    };
    const getPayee = (claimData) => {
        // mandatory
        // field length: 1
        // format: ALPHA
        return util.formatAlphanumeric(claimData.payee, 1);
    };
    const getReferringProviderNumber = (claimData) => {
        // conditional (TODO)
        // field length: 6
        // format: numeric
        return util.formatAlphanumeric(claimData.referringProviderNumber, 6);
    };
    const getMasterNumber = (claimData) => {
        // conditional
        // format: alphanumeric or numeric
        // field length: 4
        return util.formatAlphanumeric(claimData.masterNumber, 4);
    };
    const getInpatientAdmissionDate = (claimData) => {
        // conditional (TODO)
        // field length: 8
        // format: date (YYYYMMDD)
        return util.formatDate(claimData.inpatientAdmissionDate);
    };
    const getReferringLabLicenseNumber = (claimData) => {
        // conditional
        // field length: 4
        // format: numeric
        return util.formatAlphanumeric(claimData.referringLabLicenseNumber, 4);
    };
    const getManualReviewIndicator = (claimData) => {
        // conditional
        // field length: 1
        // format: ALPHA (blank or 'Y')
        return util.formatAlphanumeric(claimData.manualReviewIndicator, 1);
    };
    const getServiceLocationIndicator = (claimData) => {
        // conditional
        // field length: 4
        // format: alphanumeric or spaces
        return util.formatAlphanumeric(claimData.serviceLocationIndicator, 4);
    };
    const getReservedForOOC = () => {
        // must be spaces UNLESS authorized by the ministry
        // field length: 11
        // format: spaces
        return sprintf('%11.11s', ' ');
    };
    const getReservedForMOHUse = () => {
        // must be spaces
        // field length: 6
        // format: spaces
        return sprintf('%6.6s', ' ');
    };

    return {
        encode: (claimData, context) => {
            let claimHeader1Record = '';

            claimHeader1Record += getTransactionIdentifier();
            claimHeader1Record += getRecordIdentification();
            claimHeader1Record += getHealthNumber(claimData);
            claimHeader1Record += getVersionCode(claimData);
            claimHeader1Record += getPatientDateOfBirth(claimData);
            claimHeader1Record += getAccountingNumber(claimData);
            claimHeader1Record += getPaymentProgram(claimData);
            claimHeader1Record += getPayee(claimData);
            claimHeader1Record += getReferringProviderNumber(claimData);
            claimHeader1Record += getMasterNumber(claimData);
            claimHeader1Record += getInpatientAdmissionDate(claimData);
            claimHeader1Record += getReferringLabLicenseNumber(claimData);
            claimHeader1Record += getManualReviewIndicator(claimData);
            claimHeader1Record += getServiceLocationIndicator(claimData);
            claimHeader1Record += getReservedForOOC();
            claimHeader1Record += getReservedForMOHUse();
            
            return claimHeader1Record + constants.endOfRecord;
        }
    };
}

module.exports = ClaimHeader1Encoder;
