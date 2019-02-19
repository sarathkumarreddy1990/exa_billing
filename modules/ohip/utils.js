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

    /**
     * chunk - breaks a large array up into smaller arrays. If the input array
     * is smaller than the chunk size, then an array with only one array
     * containing all of the elements in the input array is returned.
     *
     * @param  {array}  array description
     * @param  {number} size  description
     * @returns {array}       description
     */
    chunk: (array, size) => {
        const chunks = [];
        array = array.slice(0, array.length);   // NOTE working on a copy since ...
        while (array.length){
            chunks.push(array.splice(0, size)); // ... splice actually changes array
        }
        return chunks;
    }

};
