'use strict';

const impl = require('../../../../lib/vandelay/impl');

module.exports = {
    'A': {
        'decode': impl.decodeAlphanumeric,
        'encode': impl.encodeAlphanumeric,
    },
    'N': {
        'decode': impl.decodeNumeric,
        'encode': impl.encodeNumeric,
    },
    'D': {
        'decode': impl.decodeDate,
        'encode': impl.encodeDate,
    },
};
