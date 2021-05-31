const moment = require('moment');

const getText = (alphanumericStr) => {
    return `${alphanumericStr}`.trim();
};

const getNumeric = (numericStr) => {
    return parseInt(numericStr);
};

const getMoney = (moneyStr) => {
    return getNumeric(moneyStr) / 100;
};

const getDate = (dateStr) => {
    const dateVal = dateStr && moment(dateStr).format('YYYY-MM-DD') || 'Invalid date';
    return dateVal === 'Invalid date' ? null : dateVal;
};

const getFormattedValue = (code, regExp) => {
    let trimmedCode = `${code}`.trim();

    if (regExp && regExp.pattern && regExp.replaceChar) {
        return `${trimmedCode.replace(new RegExp(`${regExp.pattern}`, 'g'), regExp.replaceChar)}`;
    }

    return trimmedCode;
};

const fieldParsers = {
    'generic': getText,
    'M': getMoney,
    'N': getNumeric,
    'D': getDate
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
        let value = fieldParsers[field.format || 'generic'](fieldStr);
        return getFormattedValue(value, field.regExp);
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
