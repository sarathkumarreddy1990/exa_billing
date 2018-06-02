'use strict';

module.exports = (fieldID, fieldValue) =>
    fieldValue.toLowerCase() === `pending` ?
        ` (${fieldID} ILIKE '%${fieldValue}%' OR (COALESCE(${fieldID}, '') = ''))` :
        ` ${fieldID} ILIKE '%${fieldValue}%'`;
