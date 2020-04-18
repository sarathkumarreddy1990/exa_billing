const impl = require('./../impl');

module.exports = {
    'A': {
        decode: impl.decodeAlphanumeric,
        encode: impl.encodeAlphanumeric,
    },
    'N': {
        decode: impl.decodeNumeric,
        encode: impl.encodeNumeric,
    },
    'D': {
        decode: impl.decodeDate,
        encode: impl.encodeDate,
    },
};
