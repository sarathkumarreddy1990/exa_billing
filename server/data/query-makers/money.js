'use strict';

module.exports = ( fieldID, fieldValue ) =>
    ` (${fieldID}) = '${fieldValue}'::money`;
