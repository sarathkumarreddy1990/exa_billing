const {
    getFileType,
} = require('./parser/utils');

// const MONEY_MATCHER = /[0-9]+(\.[0-9]{1,2})?$/;


const {
    MONTH_CODE_JANUARY,
    resourceTypes,
    resourceDescriptions,
} = require('./constants');

const resourceTypesByFileType = {
    'H': resourceTypes.CLAIMS,

    'P': resourceTypes.REMITTANCE_ADVICE,
    'X': resourceTypes.CLAIMS_MAIL_FILE_REJECT_MESSAGE,
    'B': resourceTypes.BATCH_EDIT,
    'E': resourceTypes.ERROR_REPORTS,
    'F': resourceTypes.ERROR_REPORT_EXTRACT,
};

const getResourceType = (filename) => {
    return resourceTypesByFileType[getFileType(filename)];
};

module.exports = {

    getFileType,    // forwarded from ./parser/utils

    getResourceType,

    getResourceDescription: (filename) => {
        return resourceDescriptions[getResourceType(filename)];
    },

    /**
     * Returns the alpha representation for the date of a processing cycle,
     * letters A through L (January through December).
     *
     * @param  {Date} value date of processing cycle
     * @return {string}     single uppercase letter representation of the
     *                      processing cycle month
     */
    getMonthCode: (value) => {
        return String.fromCharCode(MONTH_CODE_JANUARY + value.getMonth());
    },
    //
    // getNumberFromMoney: (value) => {
    //     return value.match(MONEY_MATCHER)[0];
    // },
};
