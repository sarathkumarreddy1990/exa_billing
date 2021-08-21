'use strict';

const regGenders = /[MFOUmfou]/;

module.exports = (fieldID, fieldValue) => {
    const firstChar = fieldValue.charAt(0);
    const value = fieldID === `patients.gender` && regGenders.test(firstChar)
        ? firstChar
        : fieldValue;
    return ` (
        ${fieldID} ILIKE '${value}'
        OR ${fieldID} ILIKE '${value}%' 
    ) `;
};
