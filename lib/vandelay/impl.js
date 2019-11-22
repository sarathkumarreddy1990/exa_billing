'use strict';

const sprintf = require('sprintf');
const moment = require('moment');

const trim = (fieldValue, fieldDescriptor, fieldName) => {
    return fieldValue.replace(fieldDescriptor.paddingChar, '');
};

const isConstant = (fieldDescriptor) => {
    const {
        enumerated,
    } = fieldDescriptor;
    return enumerated && enumerated.length === 1;
};

const getValidFieldValue = (value, fieldDescriptor, fieldName) => {
    const {
        enumerated,
        constraints,
    } = fieldDescriptor;

    if (enumerated) {
        if (enumerated.length === 1) {
            return enumerated[0];
        }
        else if (!enumerated.includes(value)) {
            throw new Error(`Field ${fieldName} uses enumerated values (${enumerated}) but the value specified ("${value}") isn't one of them.`);
        }
    }

    if (constraints) {
        if (constraints.length) {
            constraints.forEach((constraint) => {
                if (!constraint.test(value)) {
                    throw new Error(`Field ${fieldName} uses constrained values (${constraints}) but the value specified ("${value}") is insufficient.`);
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
const decodeNumeric = (fieldValue, fieldDescriptor, fieldName) => {
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
const decodeAlphanumeric = (fieldValue, fieldDescriptor, fieldName) => {
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
const decodeDate = (dateStr, fieldDescriptor, fieldName) => {
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
const encodeAlphanumeric = (alphanumericVal, fieldDescriptor, fieldName) => {

    if (typeof (alphanumericVal) !== 'string' && !isConstant(fieldDescriptor)) {
        const f = `alphanumericVal ${fieldName} (${alphanumericVal}) is not a String object`;
        throw new Error(f);
    }

    const validAlphanumericVal = getValidFieldValue(alphanumericVal, fieldDescriptor);

    // console.log('validAlphanumericVal: ', validAlphanumericVal);
    const {
        isUppercase,
        formatString,
    } = fieldDescriptor;

    const encodedVal = sprintf(formatString, (validAlphanumericVal || ''));

    return isUppercase
        ? encodedVal.toUpperCase()
        : encodedVal;
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
const encodeNumeric = (numericVal, fieldDescriptor, fieldName) => {
    if (typeof (numericVal) !== 'number' && !isConstant(fieldDescriptor)) {
        throw new Error(`numericVal ${fieldName} (${numericVal}) is not a Number object`);
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
const encodeDate = (dateVal, fieldDescriptor, fieldName) => {
    if (!(dateVal instanceof Date)) {
        throw new Error(`dateVal ${fieldName} (${dateVal}) is not a Date object`);
    }
    const dateStr = moment(dateVal).format(fieldDescriptor.dateFormat);

    return sprintf(fieldDescriptor.formatString, dateStr);
};


/**
 * encodeAlphanumericLoose - uses the specified field-descriptor to convert the
 * specified string into a valid string representation of a field value.
 * Will coerce falsy value to empty string to handle nulls from DB
 *
 * @param  {string} alphanumericVal   a value to use for the field
 * @param  {Object} fieldDescriptor   an object that contains information about
 *                                    the field and its possible values
 * @return {string}                   description
 */
const encodeAlphanumericLoose = (alphanumericVal, fieldDescriptor, fieldName) => {
    let value = alphanumericVal || ``;

    if ( typeof value !== 'string' && !isConstant(fieldDescriptor) ) {
        if ( typeof value === `number` ) {
            value = String(alphanumericVal);
        }
        else {
            const f = `alphanumericVal ${fieldName} (${value}) is not a string`;
            throw new Error(f);
        }
    }

    const validAlphanumericVal = getValidFieldValue(value, fieldDescriptor);

    const {
        isUppercase,
        formatString,
    } = fieldDescriptor;

    const encodedVal = sprintf(formatString, (validAlphanumericVal || ''));

    return isUppercase
        ? encodedVal.toUpperCase()
        : encodedVal;
};

/**
 * const encodeNumericLoose - uses the specified field-descriptor to convert the
 * specified number object into a valid string representation of a field value.
 *
 * @param  {Number} dateVal           a value to use for the field
 * @param  {Object} fieldDescriptor   an object that contains information about
 *                                    the field and its possible values
 * @return {String}                   description
 */
const encodeNumericLoose = ( numericVal, fieldDescriptor, fieldName ) => {
    let value = numericVal || ``;

    if ( value !== `` && ( typeof value !== 'number' && value != numericVal ) && !isConstant(fieldDescriptor) ) {
        throw new Error(`numericVal ${fieldName} (${value}) is not a number`);
    }

    const validNumericVal = getValidFieldValue(value, fieldDescriptor);

    const {
        formatString,
    } = fieldDescriptor;

    return sprintf(formatString, validNumericVal || 0);
};

module.exports = {
    encodeAlphanumeric,
    decodeAlphanumeric,

    encodeNumeric,
    decodeNumeric,

    encodeDate,
    decodeDate,

    encodeAlphanumericLoose,
    encodeNumericLoose,
};
