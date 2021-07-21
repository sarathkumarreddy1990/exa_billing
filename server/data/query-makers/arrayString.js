'use strict';

module.exports = (fieldID, fieldValue) =>
    ` array_to_string(${fieldID},',') ILIKE '%${fieldValue}%'`;
