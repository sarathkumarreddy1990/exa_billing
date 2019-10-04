const sprintf = require('sprintf');
const moment = require('moment');

const trim = (fieldValue, fieldDescriptor) => {
    return fieldValue.replace(fieldDescriptor.paddingChar, '');
};

const isConstant = (fieldDescriptor) => {
    const {
        enumerated,
    } = fieldDescriptor;
    return enumerated && enumerated.length === 1;
};

const getValidFieldValue = (value, fieldDescriptor) => {
    const {
        enumerated,
        constraints,
    } = fieldDescriptor;

    if (enumerated) {
        if (enumerated.length === 1) {
            return enumerated[0];
        }
        else if (!enumerated.includes(value)) {
            throw new Error(`Field uses enumerated values (${enumerated}) but the value specified ("${value}") isn't one of them.`);
        }
    }

    if (constraints) {
        if (constraints.length) {
            constraints.forEach((constraint) => {
                if (!constraint.test(value)) {
                    throw new Error(`Field uses constrained values (${constraints}) but the value specified ("${value}") is insufficient.`);
                }
            });
        }
    }
    return value;
};

/**
 * const decodeNumeric - takes a field-value with its corresponding
 * field-descriptor and converts the string value of the field to a native
 * JavaScript Number object, or returns null if the field doesn't contain
 * a valid numeric value.
 *
 * @param  {String} fieldValue        the string value of some field
 * @param  {Object} fieldDescriptor   an object that contains information about
 *                                    the field and its possible values
 * @return {Number}                   a sane value for the field
 */
const decodeNumeric = (fieldValue, fieldDescriptor) => {
    return typeof (fieldValue) === 'string'
        ? Number(trim(fieldValue, fieldDescriptor))
        : null;
};

/**
 * const decodeAlphanumeric - takes a field-value with its corresponding
 * field-descriptor and converts the string value of the field to a native
 * JavaScript String object, or returns null if the field doesn't contain
 * a valid alphanumeric value.
 *
 * @param  {String} fieldValue        the string value of some field
 * @param  {Object} fieldDescriptor   an object that contains information about
 *                                    the field and its possible values
 * @return {String}                   a sane value for the field
 */
const decodeAlphanumeric = (fieldValue, fieldDescriptor) => {
    return typeof (fieldValue) === 'string'
        ? trim(fieldValue, fieldDescriptor)
        : null;
};

/**
 * const decodeDate - takes a field-value with its corresponding
 * field-descriptor and converts the string value of the field to a native
 * JavaScript Date object,or returns null if the field doesn't contain
 * a valid date value.
 *
 * @param  {String} fieldValue        the string value of some field
 * @param  {Object} fieldDescriptor   an object that contains information about
 *                                    the field and its possible values
 * @return {String}                   a sane value for the field
 */
const decodeDate = (dateStr, fieldDescriptor) => {
    return typeof (dateStr) === 'string'
        ? moment(trim(dateStr, fieldDescriptor), fieldDescriptor.dateFormat).toDate()
        : null;
};


/**
 * const encodeAlphanumeric - uses the specified field-descriptor to convert the
 * specified string into a valid string representation of a field value.
 *
 * @param  {String} dateVal           a value to use for the field
 * @param  {Object} fieldDescriptor   an object that contains information about
 *                                    the field and its possible values
 * @return {String}                   description
 */
const encodeAlphanumeric = (alphanumericVal, fieldDescriptor) => {

    if (typeof (alphanumericVal) !== 'string' && !isConstant(fieldDescriptor)) {
        const f = `alphanumericVal (${alphanumericVal}) is not a String object`;
        throw new Error(f);
    }

    const validAlphanumericVal = getValidFieldValue(alphanumericVal, fieldDescriptor);

    // console.log('validAlphanumericVal: ', validAlphanumericVal);
    const {
        isUppercase,
        formatString,
    } = fieldDescriptor;

    encodedVal = sprintf(formatString, (validAlphanumericVal || ''));

    return isUppercase ? encodedVal.toUpperCase() : encodedVal;
};

/**
 * const encodeNumeric - uses the specified field-descriptor to convert the
 * specified number object into a valid string representation of a field value.
 *
 * @param  {Number} dateVal           a value to use for the field
 * @param  {Object} fieldDescriptor   an object that contains information about
 *                                    the field and its possible values
 * @return {String}                   description
 */
const encodeNumeric = (numericVal, fieldDescriptor) => {
    if (typeof (numericVal) !== 'number' && !isConstant(fieldDescriptor)) {
        throw new Error(`numericVal (${numericVal}) is not a Number object`);
    }

    const validNumericVal = getValidFieldValue(numericVal, fieldDescriptor);

    const {
        formatString,
    } = fieldDescriptor;

    return sprintf(formatString, validNumericVal || 0);
};

/**
 * const encodeDate - uses the specified field-descriptor to convert the
 * specified Date object into a valid string representation of a field value.
 *
 * @param  {Date}   dateVal           a value to use for the field
 * @param  {Object} fieldDescriptor   an object that contains information about
 *                                    the field and its possible values
 * @return {String}                   description
 */
const encodeDate = (dateVal, fieldDescriptor) => {
    if (!(dateVal instanceof Date)) {
        throw new Error(`dateVal (${dateVal}) is not a Date object`);
    }
    const dateStr = moment(dateVal).format(fieldDescriptor.dateFormat);

    return sprintf(fieldDescriptor.formatString, dateStr);
};


module.exports = {
    encodeAlphanumeric,
    decodeAlphanumeric,

    encodeNumeric,
    decodeNumeric,

    encodeDate,
    decodeDate,
};
