'use strict';

module.exports = (fieldID, fieldValue) =>
    !isNaN(fieldValue) ?
        ` ${fieldID} = ${fieldValue}` :
        ` ${fieldID} IS NULL`;
