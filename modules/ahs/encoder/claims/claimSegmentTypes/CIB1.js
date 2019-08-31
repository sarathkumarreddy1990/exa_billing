'use strict';

const constants = require('../../../constants');

const getClaimType = () => {
    // field length: 4
    // format: alpha
    return `RGLR`;    // always RGLR for in-province
};

const getFill = () => {
    // field length: 9
    // format: space
    return ``.padEnd(9, ` `);
};

const encoder = ( batchData, context ) => {
    let segment = ``;

    segment += getClaimType();
    segment += getFill();

    return segment;
};

module.exports = encoder;
