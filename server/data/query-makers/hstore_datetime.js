'use strict';

const moment = require('moment');
const FORMAT_STYLE = 'YYYY-MM-DD';

module.exports = (fieldID, fieldValue) => {

    if (!fieldValue) {
        return ` "${fieldID}" IS NULL`;
    }

    const fromToDates = fieldValue.split('-');

    if (fromToDates.length === 1) {
        const date = moment(fromToDates[0]);

        if (date.isValid()) {
            return ` ${fieldID} ILIKE '%${moment(fieldValue).format(FORMAT_STYLE)}%'`;
        }
    } else if (fromToDates.length === 2) {
        const from = moment(fromToDates[0]);
        const to = moment(fromToDates[1]);

        if (from.isValid() && to.isValid()) {
            return ` ((${fieldID})::date BETWEEN ('${from.format(FORMAT_STYLE)}')::date AND ('${to.format(FORMAT_STYLE)}')::date)`;
        }
    } else {
        //console.log("filtervalidator error");
    }

    return '';
};
