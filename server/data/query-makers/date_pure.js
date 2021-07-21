'use strict';

const moment = require('moment');

module.exports = (fieldID, fieldValue) => {
    const date = moment(fieldValue);
    return date.isValid() ?
        ` ${fieldID} = '${date.format('YYYY-MM-DD')}'` :
        ` ${fieldID} IS NULL`;
};
