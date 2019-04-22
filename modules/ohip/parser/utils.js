const {
    getValue,
} = require('./fields');

module.exports = {

    /**
     * getType - returns the 'Type' portion of the filename. In
     * example, if the filename is 'TAAU73.789, then the Type
     * is 'T'
     *
     * @param  {string} filename a filename (the basename)
     * @return {string}          the file type
     */
    getFileType: (filename) => {
        return filename.charAt(0);
    },

    /**
     * getProcessingCycle - returns the 'Processing Cycle'
     * portion of the filename. In example, if the filename
     * is 'TKAU73.789, then the Processing Cycle is 'K'.
     *
     * NOTE this corresponds to the constant 'JANUARY_MONTH_CODE'
     *
     * @param  {string} filename a filename (the basename)
     * @return {string}          description
     */
    getProcessingCycle: (filename) => {
        return filename.charAt(1);
    },

    /**
     * getProviderNumber - returns the Health Care Provider's
     * 'Solo Provider Number' or 'Registered Group Number'
     * portion of the filename. This will be everything
     * between the Processing Cycle and the Sequence Number,
     * excluding the dot. In example, if the filename is
     * 'TAAU73.789, then the Group Number would be 'AU73'.
     *
     * @param  {string} filename a filename (the basename)
     * @return {string}          description
     */
    getGroupNumber: (filename) => {
        return filename.split('.')[0].substr(2);
    },

    /**
     * getSequenceNumber - returns the 'Sequence Number' portion
     * of the filename. In example, if the filename is 'TAAU73.789,
     * then the Sequence Number would be '789'.
     *
     * @param  {string} filename a filename (the basename)
     * @return {string}          description
     */
    getSequenceNumber: (filename) => {
        return filename.split('.')[1].substr(0, 3);
    },

    /**
     * parseRecord - description
     *
     * @param  {string} recordStr    description
     * @param  {object} recordFields
     * @return {object}              description
     */
    parseRecord: (recordStr, recordFields) => {

        const parseObj = {};
        // NOTE it's okay to do a 'for-in' here, for now
        for (fieldName in recordFields) {

            // this is the efficient way of including only relevant
            // information in the generic parse object. it's better
            // to customize the data from within each parser, though,
            // for signed numbers, dates, and monetary amounts.
            //
            // if (recordFields[field].exclude) {
            //     continue;
            // }
            parseObj[fieldName] = getValue(recordFields[fieldName], recordStr);
        }
        return parseObj;
    },



    getOrCreateArray: (obj, arrayName) => {
        return obj[arrayName] || (obj[arrayName] = []);
    },
};
