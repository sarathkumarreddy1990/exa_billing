'use strict';

const constants = require('../../../../constants');

const getClaimType = () => {
    // field length: 4
    // format: alpha
    return `RGLR`;    // always for in-province -
};

const getFill = ( batchData ) => {
    // field length: <= 244
    // format: space
    return ``.padEnd(219, ` `);
};

const encoder = ( batchData, context ) => {
    let segment = ``;

    segment += getClaimType();

    segment += getFill();
    segment += constants.encoder.endOfRecord;

    return segment;
};

module.exports = encoder;
