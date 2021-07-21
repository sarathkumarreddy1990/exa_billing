'use strict';

module.exports = (fieldID, fieldValue) =>
    parseInt(fieldValue) ?
        ` ${fieldID} = ${fieldValue}` :
        ` ${fieldID} IS NULL`;
