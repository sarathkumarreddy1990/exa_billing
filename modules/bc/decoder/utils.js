const {
    insurerCodes,
    positiveValues,
    negativeValues
} = require('./formatters');

const getText = (alphanumericStr) => {
    return `${alphanumericStr}`.trim();
};

const getNumeric = (numericStr) => {
    return parseInt(numericStr);
};

const getMoney = (moneyStr) => {
    let char = moneyStr.charAt(moneyStr.length - 1);

    if (!/^[0-9]/.test(char)) {
        let isNegative = negativeValues.indexOf(char) > -1;
        let values = isNegative && negativeValues || positiveValues;
        moneyStr = `${isNegative ? '-' : ''}` + moneyStr.replace(char, values.indexOf(char).toString());
    }

    return getNumeric(moneyStr) / 100;
};

const getDate = (dateStr) => {
    const dateVal = `${dateStr.substr(0, 4)}-${dateStr.substr(4, 2)}-${dateStr.substr(6, 2)}`;
    return dateVal === '0000-00-00' ? null : dateVal;
};

const getInsurerCode = (str)=>{
    return insurerCodes.validCodes[str] || insurerCodes.reciprocalProvinces[str];
};

const fieldParsers = {
    'generic': getText,
    'M': getMoney,
    'N': getNumeric,
    'D': getDate,
    'DT': getText,
    'insurerCode': getInsurerCode,
};

const utils = {

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
        return fieldStr.trim() !== '' && fieldParsers[field.format || 'generic'](fieldStr) || null;
    },

    /**
     * @param recordData - Each line data sending to parse
     * @param recordFields - Configuration Info for parsing data
     * @return JSON - Parsed Data
     */
    parseRecord: (recordData, recordFields) => {
        let parsedData = {};

        for (let fieldName in recordFields) {
            parsedData[fieldName] = utils.getValue(recordFields[fieldName], recordData);
        }

        return parsedData;
    },


};

module.exports = utils;
