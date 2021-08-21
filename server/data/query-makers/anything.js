'use strict';
const regSomething = /[,+^*!@#$%&()\\|/ ]/g;

module.exports = (fieldID, fieldValue) =>
    ` ${fieldID} ~* '.*${(['users.first_name', 'users.last_name'].indexOf(fieldID) > -1 && fieldValue.length <= 3 ? '^' : '') + fieldValue.replace(regSomething, '.?.?')}.*'`;
