'use strict';

module.exports = (fieldID, fieldValue) =>
    ` (CAST(COALESCE(nullif(${fieldID}, 'null'),'0') AS DECIMAL) = CAST(${fieldValue} AS DECIMAL))`;
