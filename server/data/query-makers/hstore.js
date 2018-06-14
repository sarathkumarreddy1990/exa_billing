'use strict';

module.exports = (fieldID, fieldValue) => {   
    return ` ${fieldID} ILIKE '${(fieldValue.length > 3 ? '%' : '') + fieldValue}%'`;
};