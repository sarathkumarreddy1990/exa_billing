const {
    parseRecord,
} = require('../utils');

const responseFields = require('./responseFields');

const OBECResponseParser = function(options) {

    return {
        parse: (fileStr) => {
            const records = fileStr.split('\n');
            return records.reduce((result, recordStr) => {
                if (recordStr){
                    result.push(parseRecord(recordStr, responseFields));
                }
                return result;
            }, []);
        },
    };

};

module.exports = OBECResponseParser;
