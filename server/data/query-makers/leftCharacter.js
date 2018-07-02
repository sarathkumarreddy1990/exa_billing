'use strict';

const regGenders = /[MFOUmfou]/;

module.exports = (fieldID, fieldValue) => {
    const firstChar = fieldValue.charAt(0);
    const value = regGenders.test(firstChar) ? firstChar : fieldValue;
    return ` (${fieldID} ILIKE '${fieldValue}%' OR ${fieldID} ILIKE '${value}')`;
};
