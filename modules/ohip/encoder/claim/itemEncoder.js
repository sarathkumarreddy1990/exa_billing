const sprintf = require('sprintf');
const constants = require('./../../constants').encoder;
const util = require('./../util');

const ItemEncoder = function(options) {

    const getTransactionIdentifier = (itemData) => {
        // mandatory
        // field length: 2
        // format: alpha
        return 'HE';    // always
    };

    const getRecordIdentification = (itemData) => {
        // mandatory
        // field length: 1
        // format: alpha
        return 'T';     // always
    };
    const getServiceCode = (itemData) => {
        // required: mandatory
        // field length: 5
        // format: alphanumeric
        return util.formatAlphanumeric(itemData.serviceCode, 5);
    };
    const getReservedForMOHUse = () => {
        // required: mandatory
        // field length: 2
        // format: spaces
        return sprintf('%2.2s', ' ');
    };
    const getFeeSubmitted = (itemData) => {
        // required: mandatory
        // field length: 6
        // format: numeric
        let feeSubmitted = Math.round(itemData.feeSubmitted * 100);
        return util.formatAlphanumeric(feeSubmitted, 6, '0');
    };
    const getNumberOfServices = (itemData) => {
        // required: mandatory
        // field length: 2
        // format: numeric
        return util.formatAlphanumeric(itemData.numberOfServices, 2, '0');
    };
    const getServiceDate = (itemData) => {
        // required: mandatory
        // field length: 8
        // format: date (YYYYMMDD)
        return util.formatDate(itemData.serviceDate);
    };
    const getDiagnosticCode = (itemData) => {
        // required: conditionally
        // field length: 4
        // format: alphanumeric
        return util.formatAlphanumeric(itemData.diagnosticCode, 4);
    };
    const getReservedForOOC = () => {
        // required: MUST BE SPACES unless authorized
        // field length: 10
        // format: spaces
        return sprintf('%10.10s', ' ');
    };
    const getReservedForMOHUse2 = () => {
        // required: MUST BE SPACES
        // field length: 1
        // format: spaces
        return sprintf('%1.1s', ' ');
    };

    const getItem = (itemData) => {
        let itemRecord = '';

        itemRecord += getServiceCode(itemData);
        itemRecord += getReservedForMOHUse();
        itemRecord += getFeeSubmitted(itemData);
        itemRecord += getNumberOfServices(itemData);
        itemRecord += getServiceDate(itemData);
        itemRecord += getDiagnosticCode(itemData);
        itemRecord += getReservedForOOC(itemData);
        itemRecord += getReservedForMOHUse2();

        return itemRecord;
    };

    return {
        encode: (itemData, itemData2) => {
            let itemRecord = '';

            itemRecord += getTransactionIdentifier();
            itemRecord += getRecordIdentification();

            itemRecord += getItem(itemData);

            if (itemData2) {
                itemRecord += getItem(itemData2);
            }
            else {
                itemRecord += util.formatFill(' ', 38);
            }

            return itemRecord += constants.endOfRecord;
        }
    };
}

module.exports = ItemEncoder;
