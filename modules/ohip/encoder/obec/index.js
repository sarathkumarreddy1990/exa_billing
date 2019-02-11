const constants = require('../constants').encoder;
const util = require('./util');

const OBEC_BATCH_SIZE_DEFAULT = 100;    // this seems like a sane starting point

/**
 * const OBECEncoder - Encodes a batch of health card numbers (Health
 * Number + Version Code).
 *
 * @param  {type} options encoder options
 * @return {type}         an encoder with an encode(data)
 */
const OBECEncoder = function(options) {

    options = options || {};
    options.batchSize = options.batchSize || OBEC_BATCH_SIZE_DEFAULT;

    const getTransactionCode = () => {
        return "OBEC01";
    };

    const getHealthNumber = (data) => {
        return data.healthNumber;
    };

    const getVersionCode = (data) => {
        return util.formatAlphanumeric(data.versionCode, 2, ' ');
    };


    //
    // NOTE the following are optional fields
    //

    const getSubmissionIdentifier = (data) => {
        return util.formatAlphanumeric(data.submissionId, 4, " ");
    };

    const getPostalCode = (data) => {
        return util.formatAlphanumeric(data.postalCode, 6, " ");
    };

    const getMunicipality = (data) => {
        return util.formatAlphanumeric(data.municipality, 30, " ");
    };

    const getStreetAddress1 = (data) => {
        return util.formatAlphanumeric(data.streetAddress1, 32, " ");
    };

    const getStreetAddress2 = (data) => {
        return util.formatAlphanumeric(data.streetAddress2, 32, " ");
    };

    const encodeRecord = (data) => {

        let obecRecord = '';

        obecRecord += getTransactionCode(data);
        obecRecord += getHealthNumber(data);
        obecRecord += getVersionCode(data);

        // optional
        obecRecord += getSubmissionIdentifier(data);
        obecRecord += getPostalCode(data);
        obecRecord += getMunicipality(data);
        obecRecord += getStreetAddress1(data);
        obecRecord += getStreetAddress2(data);

        return obecRecord + constants.endOfRecord;
    };

    return {

        encode: (batchData) => {

            let batchStr = '';
            let recordNumber = 0;

            return batchData.reduce((result, data) => {

                batchStr += encodeRecord(data);
                recordNumber++;

                if (recordNumber == options.batchSize) {
                    batchStr += constants.endOfBatch;
                    result.push(batchStr);
                    batchStr = '';
                    recordNumber = 0;
                }

                return result;

            }, []);
        }
    };
};

module.exports = OBECEncoder;
