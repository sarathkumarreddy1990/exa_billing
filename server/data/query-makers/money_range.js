'use strict';

module.exports = (fieldID, fieldValue) =>
    ` ${fieldID} > '0'  AND ${fieldID} <= '${fieldValue}'`;
