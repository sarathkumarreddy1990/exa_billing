'use strict';

module.exports = (fieldID, fieldValue) => {
    const query = fieldValue.split(/,/g).map(field =>
        ` COALESCE(${fieldID}->'${field}', 'false') != 'false' `
    ).join(' AND ');
    return ` ( ${query} ) `;
};
