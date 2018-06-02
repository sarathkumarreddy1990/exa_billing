'use strict';

module.exports = ( fieldID, fieldValue ) =>
    ` COALESCE(${fieldID}->'${fieldValue}', 'false') != 'false' `;
