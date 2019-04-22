const FORMATS = {
    ALPHABETIC: '[a-zA-Z]',
    NUMERIC: '[0-9]',
    ALPHANUMERIC: '[a-zA-Z0-9]',
    DATE: '[0-9]{8}',  // YYYYMMDD
    TIME: '[0-9]{6}',  //HHMMSS
    SPACES: ' '
};

const getDate = (dateStr) => {
    return new Date(
        `${dateStr.substr(0, 4)}-${dateStr.substr(4, 2)}-${dateStr.substr(6, 2)}`
    );
};

const getNumeric = (numericStr) => {
    return parseInt(numericStr);
};

const getText = (alphanumericStr) => {
    return `${alphanumericStr}`.trim();
};


const fieldParsers = {
    'N': getNumeric,
    'D': getDate,
    'generic': getText,
};

module.exports = {

    FORMATS,


    /**
     * createFieldValidator - description
     *
     * @param  {type} fieldDescriptor description
     * @return {type}                 description
     */
    // createFieldValidator: (fieldDescriptor) => {
    //     let pattern = new RegExp(`^${fieldDescriptor.format}{${fieldDescriptor.fieldLength}}$`);
    //     return (value) => {
    //         return pattern.test(value);
    //     };
    // },

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
        // TODO: field validation, logging, etc
        return fieldParsers[field.format || 'generic'](fieldStr);
    },
};
