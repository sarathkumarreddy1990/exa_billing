'use strict';

const constants = require('../../../constants');

const getClaimType = () => {
    // field length: 4
    // format: alpha
    return `RGLR`;    // always for in-province -
};

const getServiceProviderPRID = ( context ) => {
    // field length: 9
    // format: numeric
    return String(context.serviceProviderPRID).padStart(9, `0`);
};

const getSkillCode = ( context ) => {
    // field length: 4
    // format: alpha
    return constants.encoder.skillCodes[ context.specialtyCode ];
}

const getFill = ( batchData ) => {
    // field length: <= 244
    // format: space
    return ``.padEnd(219, ` `);
};

const encoder = ( batchData, context ) => {
    let segment = ``;

    segment += getClaimType();
    segment += getServiceProviderPRID(context);


    segment += getFill();
    segment += constants.encoder.endOfRecord;

    return segment;
};

module.exports = encoder;

