'use strict';

module.exports = (fieldID, fieldValue) =>
    parseFloat(fieldValue) ?
        ` CAST(${fieldID} AS DECIMAL) = CAST(${fieldValue} AS DECIMAL)` :
        ` ${fieldID} IS NULL`;
