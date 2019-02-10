const {
    getFileType,
} = require('./parser/utils');

const {
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


};
