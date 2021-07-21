'use strict';

module.exports = (fieldID, fieldValue) =>
    ` (${fieldID} ILIKE '${fieldValue}%' OR ${fieldID} ILIKE '${fieldValue.charAt(0)}')`;
