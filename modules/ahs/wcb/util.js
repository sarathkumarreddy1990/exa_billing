'use strict';

const { base64Encode } = require('../../../server/shared');
const {
    COUNTRY_CODES
} = require ('./encoder/constants');

const { body_parts } = require('../../../app/resx/body_parts.json');
const { orientation } = require('../../../app/resx/orientation.json');

const isArray = (obj) => obj && typeof (obj) === 'object' && Array.isArray(obj);

const formatCountryCode = (str) => {

    return COUNTRY_CODES[str] || str;
};

const formatPostalCode = (str) => {
    let postal = new RegExp(/^(?!.*[DFIOQU])[A-VXY][0-9][A-Z] ?[0-9][A-Z][0-9]$/);
    let zipLength = str && str.trim().length || 0;

    if (zipLength === 7 && postal.test(str)) {
        return str;
    } else {
        return str.replace(/\s/g, '');
    }
};

const formatPhoneFax = (phnNum) => {
    let phoneNumberPattern = /^\(?(\d{3})\)?[- ]?(\d{3})[- ]?(\d{4})$/;
    let isValidPhoneNumber = phoneNumberPattern.test(phnNum);
    let cleaned = phnNum && (phnNum).replace(/\D/g, '') || '';

    if (isValidPhoneNumber && cleaned) {
        return cleaned.substring(3, 10) || '';
    }

    return null;
};

const formatAttachment = (content) => {
    return content && base64Encode(content) || '';
};

const formatGender = (code) => {
    let gender = code && code.toUpperCase() || '';
    return gender && ['M', 'F'].indexOf(gender) == -1
        ? 'X'
        : gender;
};

const getBPDescription = (code) => {
    let bp = body_parts.find((bp) => bp.code === code) || {};
    return bp.description || '';
};

const getOrientationDescription = (code) => {
    let orObj = orientation.find((or) => or.code === code) || {};
    return orObj.description || '';
};

const formatters = {
    "country_code": formatCountryCode,
    "postal_code": formatPostalCode,
    "fax_number": formatPhoneFax,
    "phone_number": formatPhoneFax,
    "attachment_content": formatAttachment,
    "gender": formatGender,
    "body_part_description": getBPDescription,
    "side_of_body_description": getOrientationDescription
};

const getFormattedValue = (key, inputObj) => {

    if (key in formatters && typeof formatters[key] === "function") {
        return formatters[key](inputObj[key], key) || '';
    } else {
        return inputObj[key] || '';
    }
};

module.exports = {
    formatters,
    isArray,
    getFormattedValue
};
