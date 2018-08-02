'use strict';

module.exports = (fieldID, fieldValue) =>
    ` CAST("${fieldID}" AS CHAR(32)) ILIKE '%${fieldValue}%'`;
