const getText = (alphanumericStr) => {
    return `${alphanumericStr}`.trim();
};

const getNumeric = (numericStr) => {
    return parseInt(numericStr);
};

const getMoney = (moneyStr) => {
    return getNumeric(moneyStr) / 100;
};

const fieldParsers = {
    'generic': getText,
    'M': getMoney,
    'N': getNumeric
};

const util = {

    /**
     * getValue - Uses the specified field descriptor to retrieve the data from
     * the specified record string.
     *
     * @param  {object} field {
     *                            startPos: <number:required>,
     *                            fieldLength: <number:required>,
     *                            constant: <string:optional>,
     *                            format: <string:optional>,
     *                            i18n: <string:optional>
     *                        }
     * @param  {string} recordStr an entire record
     * @return {string}           the field value of the record
     */
    getValue: (field, recordStr) => {
        let fieldStr = field.constant || recordStr.substr(field.startPos - 1, field.fieldLength);
        return fieldParsers[field.format || 'generic'](fieldStr);
    },

    /**
     * {param} recordStr - Each line data sending to parse
     * {param} recordFields - Configuration Info for parsing data
     * {return} JSON - Parsed Data
     */
    parseRecord: (recordStr, recordFields) => {

        const parseObj = {};

        for (let fieldName in recordFields) {
            parseObj[fieldName] = util.getValue(recordFields[fieldName], recordStr);
        }

        return parseObj;
    }
};

module.exports = util;
