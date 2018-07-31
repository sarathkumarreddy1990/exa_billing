'use strict';

module.exports = (fieldID, fieldValue, { defaultValue }) =>
    ` ${fieldID}->'${defaultValue}' ILIKE '%${fieldValue}%'`;
