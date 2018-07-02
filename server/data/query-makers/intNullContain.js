'use strict';

module.exports = (fieldID, fieldValue) =>
    parseInt(fieldValue) ?` CAST(${fieldID} AS TEXT) LIKE '%${fieldValue}%'` : ` ${fieldID} IS NULL`;
