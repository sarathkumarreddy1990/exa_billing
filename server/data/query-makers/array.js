'use strict';

module.exports = (fieldID, fieldValue) =>
    ` '${fieldValue}' = ANY(${fieldID})`;
