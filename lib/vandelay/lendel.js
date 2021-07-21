
module.exports = (config) => {

    return {

        /**
         * decodeRecord -
         *
         * @param  {String} recordData       a string of length-delimited data corresponding to one record
         * @param  {Object} recordDescriptor an object that holds field descriptors
         * @return {Object}                  an object corresponding to the data within the record
         */
        decodeRecord: (recordData, recordDescriptor) => {
            return Object.keys(recordDescriptor).reduce((parseObj, fieldName) => {

                const fieldDescriptor = recordDescriptor[fieldName];

                const {
                    format,
                    startPos,
                    length,
                } = fieldDescriptor;

                const fieldData = recordData.substr(startPos - 1, length);

                parseObj[fieldName] = config[format].decode(fieldData, fieldDescriptor, fieldName);

                return parseObj;
            }, {});
        },

        /**
         * decodeRecord - description
         *
         * @param  {Object} recordData       a string of length-delimited data corresponding to one record
         * @param  {Object} recordDescriptor an object that holds field descriptors
         * @return {String}                  an object corresponding to the data within the record
         */
        encodeRecord: (recordData, recordDescriptor) => {
            let errorList = [];
            let encodedData =  Object.keys(recordDescriptor).reduce((results, fieldName) => {
                const fieldDescriptor = recordDescriptor[fieldName];

                const {
                    format,
                    validationRequired,
                } = fieldDescriptor;
                const fieldData = recordData[fieldName];

                fieldDescriptor.record_code = recordData['record_code'];
                let encoded = config[format].encode(fieldData, fieldDescriptor, fieldName);

                let {
                    result,
                    error
                } = encoded;

                if (error && validationRequired) {
                    errorList = errorList.concat(error);
                } else {
                    results.push(result);
                }

                return results;

            }, []).join('');

            if (errorList.length) {
                return { error: errorList };
            }
            
            return { encodedData };

        },
    };
};
