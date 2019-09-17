'use strict';

const encoder = {
    'endOfLine': `\n`,
    'endOfRecord': `\n`,
    'endOfFile': ``,
    'actionCodes': {
        'add': `A`,
        'change': `C`,
        'delete': `D`,
        'reassess': `R`,
    },
    /**
     * Alberta's version of Specialty Code
     */
    'skillCodes': {},
};

const decoder = {
    'endOfLine': `\n`,
    'endOfRecord': `\n`,
    'endOfFile': ``,
};

const constants = {
    encoder,
    decoder,
};

module.exports = constants;
