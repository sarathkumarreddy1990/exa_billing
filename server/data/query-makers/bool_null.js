'use strict';

module.exports = (fieldID, fieldValue) =>
    fieldValue.toLowerCase() === 'false' ?
        ` (${fieldID} IS NULL OR ${fieldID} = ${fieldValue} )` :
        ` ${fieldID} = ${fieldValue}`;
