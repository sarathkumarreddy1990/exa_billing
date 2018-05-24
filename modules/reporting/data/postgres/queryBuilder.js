const _ = require('lodash');

const OPERATOR = {
    NOT: 'NOT',
    EQ: '=',
    NEQ: '!=',
    LT: '<',
    LTE: '<=',
    GT: '>',
    GTE: '>='
}


isValidOperator = (operator) => {
    return _.values(OPERATOR).indexOf(operator) > -1;
}

isNumberArray = (arry) => {
    return !_.some(arry, isNaN);
}


const api = {

    // ------------------------------------------------------------------------
    where: (column, op, paramNum) => {
        return `( ${column} ${op} $${paramNum} )`;
    },

    // ------------------------------------------------------------------------

    // https://github.com/brianc/node-postgres/wiki/FAQ#11-how-do-i-build-a-where-foo-in--query-to-find-rows-matching-an-array-of-values
    whereIn: (column, paramNum) => {
        return `( ${column} = ANY ($${paramNum}) )`;   // column IN ()
    },
    whereBetween: (column, paramPos) => {
        return `( ${column} BETWEEN $${paramPos[0]} AND $${paramPos[1]} )`;
    },

    whereNotIn: (column, paramNum) => {
        return `( ${column} <> ALL ($${paramNum}) )`; // column NOT IN ()
    },

    // ------------------------------------------------------------------------
    // WHERE (date & time)
    whereDate: (column, op, paramPos) => {
        return `( ${column}::date ${op} $${paramPos[0]}::date )`;
    },

    whereDateInTz: (column, op, paramPos, timeZone) => {
        return `( (timezone(${timeZone}, ${column}))::date ${op} $${paramPos[0]}::date )`;
    },

    whereDateTime: (column, op, paramPos) => {
        return `( ${column} ${op} $${paramPos[0]} )`;
    },

    whereDateTimeInTz: (column, op, paramPos, timeZone) => {
        return `( (timezone(${timeZone}, ${column})) ${op} $${paramPos[0]})`;
    },

    // ------------------------------------------------------------------------
    // BETWEEN (date & time)
    whereDateBetween: (column, paramPos) => {
        return `( ${column}::date BETWEEN $${paramPos[0]}::date AND $${paramPos[1]}::date )`;
    },

    // whereDateInTzBetween('s.study_dt', [1, 2], 'f.time_zone')
    whereDateInTzBetween: (column, paramPos, timeZone) => {
        return `( (timezone(${timeZone}, ${column}))::date BETWEEN $${paramPos[0]}::date AND $${paramPos[1]}::date )`
    },

    whereDateInTzBetweenDates: (column, paramPos, timeZone) => {
        return `( (timezone(${timeZone}, ${column}))::date BETWEEN ${paramPos[0]} AND ${paramPos[1]})`
    },

    whereDateTimeBetween: (column, paramPos) => {
        return `( ${column} BETWEEN $${paramPos[0]} AND $${paramPos[1]} )`;
    },

    whereDateTimeInTzBetween: (column, paramPos, timeZone) => {
        return `( (timezone(${timeZone}, ${column})) BETWEEN $${paramPos[0]} AND $${paramPos[1]} )`;
    },

    // ------------------------------------------------------------------------
    // utility and convenience methods

    // whereDateRange: (column, paramPos, range) => {
    //     if (range && range.length === 2 && range[0] === range[1]) {
    //         return api.whereDate(column, OPERATOR.EQ, paramPos);
    //     }
    //     return api.whereDateBetween(column, paramPos);;
    // },

    // whereDateRangeTz: (column, paramPos, timeZone, range) => {
    //     if (range && range.length === 2 && range[0] === range[1]) {
    //         return api.whereDateInTz(column, OPERATOR.EQ, paramPos, timeZone);
    //     }
    //     return api.whereDateInTzBetween(column, paramPos, timeZone);;
    // }

}


module.exports = api;
