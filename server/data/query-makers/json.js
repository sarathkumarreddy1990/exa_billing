'use strict';

module.exports = (fieldID, fieldValue) =>
    ` ${fieldID} ILIKE '%${fieldValue}%'`;
