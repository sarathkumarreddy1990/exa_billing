const sprintf = require('sprintf');
const util = require('./../util');
const constants = require('./../../constants').encoder;

const BatchTrailerEncoder = function() {

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
        return 'E';     // always
    };

    const getHCount = (data) => {
        // required: mandatory
        // field length: 4
        // format: numeric
        return util.formatAlphanumeric(data.hCount, 4, '0');
    };
    const getRCount = (data) => {
        // required: mandatory
        // field length: 4
        // format: numeric
        return util.formatAlphanumeric(data.rCount, 4, '0');
    };
    const getTCount = (data) => {
        // required: mandatory
        // field length: 5
        // format: numeric
        return util.formatAlphanumeric(data.tCount, 5, '0');
    };
    const getReservedForMOHUse = () => {
        // required: must be spaces
        // field length: 63
        // format: spaces
        return util.formatFill(' ', 63);
    };

    return {
        encode: (context) => {
            let batchTrailerRecord = '';

            batchTrailerRecord += getTransactionIdentifier();
            batchTrailerRecord += getRecordIdentification();
            batchTrailerRecord += getHCount(context);
            batchTrailerRecord += getRCount(context);
            batchTrailerRecord += getTCount(context);
            batchTrailerRecord += getReservedForMOHUse();

            return batchTrailerRecord += constants.endOfRecord;
        }
    };
}

module.exports = BatchTrailerEncoder;
