'use strict';

const { base64Encode } = require('../../../server/shared');
const {
    COUNTRY_CODES
} = require ('./encoder/constants');

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

const formatPhoneFax = (phnNum, key) => {
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

const formatters = {
    "country_code": formatCountryCode,
    "postal_code": formatPostalCode,
    "fax_number": formatPhoneFax,
    "phone_number": formatPhoneFax,
    "attachment_content": formatAttachment,
    "gender": formatGender 
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