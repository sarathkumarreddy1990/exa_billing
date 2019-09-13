'use strict';

const constants = require('../../../constants');

const getClaimType = () => {
    // field length: 4
    // format: alpha
    return `RGLR`;    // always RGLR for in-province
};

const getServiceProviderPRID = ( context ) => {
    // field length: 9
    // format: numeric

    // Docs say there is a check digit in the 5th position but not clear what
    // that means here...
    return String(context.serviceProviderPRID).padStart(9, `0`);
};

const getSkillCode = ( context ) => {
    // field length: 4
    // format: alpha
    return constants.encoder.skillCodes[ context.specialtyCode ];
};

const getFill = () => {
    // field length: 9
    // format: space
    return ``.padEnd(9, ` `);
};

const encoder = ( batchData, context ) => {
    let segment = ``;

    segment += getClaimType();
    segment += getServiceProviderPRID(context);

    segment += getFill();

    return segment;
};

module.exports = encoder;
