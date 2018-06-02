'use strict';

module.exports = ( fieldID, fieldValue ) =>
    ` CAST(${fieldID} AS VARCHAR) ILIKE '%${fieldValue}%'`;
