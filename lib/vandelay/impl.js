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

    if (enumerated) {
        return enumerated && enumerated.length === 1;
    }

    return true;
};

const getValidFieldValue = (value, fieldDescriptor, fieldName) => {
    let {
        name,
        isNumeric,
        enumerated,
        validLength,
        constraints,
        isMandatory,
        segmentName,
        record_code,
        isValidDate,
        customMessage,
        validationRequired
    } = fieldDescriptor;

    let validationResult = [];

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
                let reg = new RegExp(constraint);

                if (!reg.test(value)) {
                    if (validationRequired) {
                        validationResult.push({
                            segmentID: record_code,
                            segmentName,
                            fieldName: name || fieldName,
                            message:`${name} ${customMessage || 'does not follow pattern.'}`
                        });
                    } else {
                        throw new Error(`Field ${fieldName} uses constrained values (${constraints}) but the value specified ("${value}") is insufficient.`);
                    }
                }
            });
        }
    }

    if(isValidDate && !moment(value).isValid()){
        validationResult.push({
            segmentID: record_code,
            segmentName,
            fieldName: name || fieldName,
            message: `${name} does not uses valid date`
        });
    }

    if( validLength && value && value.length !=  validLength){
        validationResult.push({
            segmentID: record_code,
            segmentName,
            fieldName: name || fieldName,
            message: `${name} is not ${validLength} character length`
        });
    }

    if(isNumeric && isNaN(parseInt(value))){
        validationResult.push({
            segmentID: record_code,
            segmentName,
            fieldName: name || fieldName,
            message: `${name} is not numeric`
        });
    }

    if (isMandatory && !value) {
        validationResult.push({
            segmentID: record_code,
            segmentName,
            fieldName: name || fieldName,
            message: `${name} is missing`
        });
    }

    if (validationResult.length) {
        return { validationResult };
    }

    return { data: value };
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
 * @param  {String} alphanumericVal    a value to use for the field
 * @param  {Object} fieldDescriptor    an object that contains information about
 *                                     the field and its possible values
 * @param  {String} fieldName          field name
 * @param  {Object} validationRequired Validation object
 * @return {String}                    description
 */
const encodeAlphanumeric = (alphanumericVal, fieldDescriptor, fieldName, validationRequired) => {
    let {
        name,
        segmentName,
        isUppercase,
        record_code,
        formatString
    } = fieldDescriptor;

    let validatorResult = [];

    if (typeof (alphanumericVal) !== 'string' && validationRequired) {
        validatorResult.push({
            segmentID: record_code,
            segmentName,
            fieldName: name || fieldName,
            message: `${name} is not a string`
        });
    } else if (typeof (alphanumericVal) !== 'string' && !isConstant(fieldDescriptor)) {
        const f = `alphanumericVal ${fieldName} (${alphanumericVal}) is not a string`;
        throw new Error(f);
    }

    const validAlphanumericVal = getValidFieldValue(alphanumericVal, fieldDescriptor, fieldName);

    let {
        validationResult = [],
        data
    } = validAlphanumericVal;

    validatorResult = validatorResult.concat(validationResult);

    if (validatorResult.length) {
        return { error: validatorResult };
    }

    const encodedVal = sprintf(formatString, (data || ''));

    return {
        result: isUppercase ? encodedVal.toUpperCase() : encodedVal
    };
};

/**
 * const encodeNumeric - uses the specified field-descriptor to convert the
 * specified number object into a valid string representation of a field value.
 *
 * @param  {Number} numericVal         a value to use for the field
 * @param  {Object} fieldDescriptor    an object that contains information about
 *                                     the field and its possible values
 * @param  {String} fieldName          field name
 * @return {String}                    description
 */
const encodeNumeric = (numericVal, fieldDescriptor, fieldName) => {

    let {
        name,
        segmentName,
        record_code,
        formatString,
        validationRequired
    } = fieldDescriptor;

    let validatorResult = [];

    if (isNaN(parseInt(numericVal)) && validationRequired) {
        validatorResult.push({
            segmentID: record_code,
            segmentName,
            fieldName: name || fieldName,
            message: `${name} is not numeric`
        });
    } else if (typeof (numericVal) !== 'number' && !isConstant(fieldDescriptor)) {
        throw new Error(`numericVal ${fieldName} (${numericVal}) is not a number`);
    }

    const validNumericVal = getValidFieldValue(numericVal, fieldDescriptor, fieldName);

    let {
        validationResult = [],
        data
    } = validNumericVal;

    validatorResult = validatorResult.concat(validationResult);

    if (validatorResult.length) {
        return { error: validatorResult };
    }

    return { result: sprintf(formatString, data || 0) };
};

/**
 * const encodeDate - uses the specified field-descriptor to convert the
 * specified Date object into a valid string representation of a field value.
 *
 * @param  {Date}   dateVal            a value to use for the field
 * @param  {Object} fieldDescriptor    an object that contains information about
 *                                     the field and its possible values
 * @param  {String} fieldName          field name
 * @return {String}                    description
 */
const encodeDate = (dateVal, fieldDescriptor, fieldName) => {
    let {
        name,
        segmentName,
        record_code,
        validationRequired
    } = fieldDescriptor;
    let validatorResult = [];

    if (!(dateVal instanceof Date)) {
        if (validationRequired) {
            validatorResult.push({
                segmentID: record_code,
                segmentName,
                fieldName: name || fieldName,
                message: `${name} is not a valid date`
            });
        } else {
            throw new Error(`dateVal ${fieldName} (${dateVal}) is not a Date object`);
        }
    }

    if (validatorResult.length) {
        return { error: validatorResult };
    }

    const dateStr = moment(dateVal).format(fieldDescriptor.dateFormat);

    return{result: sprintf(fieldDescriptor.formatString, dateStr)};
};


/**
 * encodeAlphanumericLoose - uses the specified field-descriptor to convert the
 * specified string into a valid string representation of a field value.
 * Will coerce falsy value to empty string to handle nulls from DB
 *
 * @param  {string} alphanumericVal    a value to use for the field
 * @param  {Object} fieldDescriptor    an object that contains information about
 *                                     the field and its possible values
 * @param  {String} fieldName          field name
 * @return {string}                    description
 */
const encodeAlphanumericLoose = (alphanumericVal, fieldDescriptor, fieldName) => {
    let {
        name,
        segmentName,
        isUppercase,
        record_code,
        formatString,
        validationRequired
    } = fieldDescriptor;

    let validatorResult = [];
    let value = alphanumericVal || ``;

    if (typeof value !== 'string' && validationRequired) {
        if (typeof value === 'number') {
            value = String(alphanumericVal);
        } else {
            validatorResult.push({
                segmentID: record_code,
                segmentName,
                fieldName: name || fieldName,
                message: `${name} is not a string`
            });
        }
    } else if (typeof value !== 'string' && !isConstant(fieldDescriptor)) {
        if (typeof value === 'number') {
            value = String(alphanumericVal);
        } else {
            const f = `alphanumericVal ${fieldName} (${value}) is not a string`;
            throw new Error(f);
        }
    }


    const validAlphanumericVal = getValidFieldValue(value, fieldDescriptor, fieldName);
    let {
        validationResult = [],
        data
    } = validAlphanumericVal;

    validatorResult = validatorResult.concat(validationResult);

    if (validatorResult.length) {
        return { error: validatorResult };
    }

    const encodedVal = sprintf(formatString, (data || ''));

    return {
        result: isUppercase ? encodedVal.toUpperCase() : encodedVal
    };
};

/**
 * const encodeNumericLoose - uses the specified field-descriptor to convert the
 * specified number object into a valid string representation of a field value.
 *
 * @param  {Number} dateVal            a value to use for the field
 * @param  {Object} fieldDescriptor    an object that contains information about
 *                                     the field and its possible values
 * @param  {String} fieldName          field name
 * @return {String}                    description
 */
const encodeNumericLoose = (numericVal, fieldDescriptor, fieldName) => {

    let {
        name,
        segmentName,
        record_code,
        formatString,
        validationRequired
    } = fieldDescriptor;

    let validatorResult = [];
    let value = numericVal || null;

    if (value !== null && (typeof value !== 'number' && value != numericVal) && validationRequired) {
        validatorResult.push({
            segmentID: record_code,
            segmentName,
            fieldName: name || fieldName,
            message: `${name} is not a number`
        });
    } else if (value !== '' && (typeof value !== 'number' && value != numericVal) && !isConstant(fieldDescriptor)) {
        throw new Error(`numericVal ${fieldName} (${value}) is not a number`);
    }

    const validNumericVal = getValidFieldValue(value, fieldDescriptor, fieldName);

    let {
        validationResult = [],
        data
    } = validNumericVal;
    validatorResult = validatorResult.concat(validationResult);

    if (validatorResult.length) {
        return { error: validatorResult };
    }

    return { result: sprintf(formatString, data || 0) };
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
