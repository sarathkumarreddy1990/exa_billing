const sprintf = require('sprintf');
const util = require('./../util');
const constants = require('./../../constants').encoder;

/**
 * const BatchHeader - Responsible for encoding a batch header record
 * (section 4.7 of the OHIP v03 Technical Specifications document)
 *
 * @param  {type} options an encoder for the batch header record
 * @return {type}         description
 */
const BatchHeaderEncoder = function(options) {

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
        return 'B';     // always
    };

    const getTechSpecReleaseIdentifier = () => {
        // mandatory
        // field length: 3
        // format: alphanumeric
        return 'V03';   // always
    };

    const getMOHOfficeCode = () => {
        // not required
        // field length: 1
        // format: alpha or space
        // always a space; "a value will be ignored"
        return ' ';
    };
    const getBatchIdentification = (context) => {
        // mandatory
        // field length: 12
        // format: numeric
        return util.formatDate(context.batchDate) + util.formatAlphanumeric(context.batchSequenceNumber, 4, '0');
    };
    const getOperatorNumber = () => {
        // not required
        // field length: 6
        // format: nothing specific; "zero fill"
        return util.formatFill(' ', 6);
    };

    const getGroupNumber = (data) => {
        // mandatory
        // field length: 4
        // format: alphanumeric
        // returns the Group, Laboratory Licence, or Independent Health Facility Number
        // '0000' for solo Health Care Provider/Private Physiotherapy Facility
        return util.formatAlphanumeric(data.groupNumber, 4);
    };
    const getProviderNumber = (data) => {
        // mandatory
        // field length: 6
        // format: numeric
        return util.formatAlphanumeric(data.providerNumber, 6);
    };
    const getSpecialtyCode = (data) => {
        // mandatory
        // field length: 2
        // format: numeric
        // TODO what to do with '10', '11', '14', '21', '25', '32', '36-40',
        // '42, '43', '45', '65-69', '72-74', '77-79', '82-84', '86-89', '90-99'
        return util.formatAlphanumeric(data.specialtyCode, 2);
    };
    const getReservedForMOHUse = () => {
        // mandatory
        // field length: 42
        // format: spaces
        return util.formatFill(' ', 42);
    };


    return {
        encode: (batchData, context) => {
            let batchHeaderRecord = '';

            batchHeaderRecord += getTransactionIdentifier();
            batchHeaderRecord += getRecordIdentification();
            batchHeaderRecord += getTechSpecReleaseIdentifier();
            batchHeaderRecord += getMOHOfficeCode('U');
            batchHeaderRecord += getBatchIdentification(context);
            batchHeaderRecord += getOperatorNumber();
            batchHeaderRecord += getGroupNumber(batchData);
            batchHeaderRecord += getProviderNumber(batchData);
            batchHeaderRecord += getSpecialtyCode(batchData);
            batchHeaderRecord += getReservedForMOHUse();

            return batchHeaderRecord + constants.endOfRecord;
        }
    };
}

module.exports = BatchHeaderEncoder;
