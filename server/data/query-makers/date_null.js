'use strict';

const moment = require('moment');

module.exports = (fieldID, fieldValue) => {
    const date = moment(fieldValue);
    return date.isValid() ?
        ` (${fieldID} IS NULL OR TO_CHAR("${fieldID}",'YYYY-MM-DD') = '${date.format('YYYY-MM-DD')}')` :
        ` ${fieldID} IS NULL`;
};
