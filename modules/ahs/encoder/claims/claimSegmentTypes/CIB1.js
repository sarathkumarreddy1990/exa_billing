'use strict';

const moment = require('moment');
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
    // @TODO - defer to Drew - he seems to know the formula here
    return String(context.serviceProviderPRID).padStart(9, `0`);
};

const getSkillCode = ( context ) => {
    // field length: 4
    // format: alpha
    return constants.encoder.skillCodes[ context.specialtyCode ];
};

const getServiceRecipient = ( context ) => {
    // field length: 9
    // format: numeric OR blanks (only blanks if good-faith claim)
    return context.patientInfo.uli || ``.padEnd(9, ` `);
};

const getServiceRecipientRegistrationNumber = ( context ) => {
    // field length: 12
    // format: alpha

    return `` // @TODO - not sure what this is - waiting on consultant response
    // return context.patientInfo.uli || ``.padEnd(12, ` `);
};

const getHealthServiceCode = ( context ) => {
    // field length: 7
    // format: alpha
    // @TODO - needs frontend validation/restriction based on tons of caveats in spec
    return context.cpt_code;
};

const getServiceStartDate = ( context ) => {
    // field length: 8
    // format: numeric
    return moment(context.study_dt).format(`YYYYMMDD`);
};

const getEncounterNumber = ( context ) => {
    // field length: 1
    // format: numeric
    // @TODO - use `row_number()` in PG for this - visit # for patient to provider in same day
    return context.encounter_number;
};

const getPrimaryICD = ( context ) => {
    // field length: 6
    // format: alpha
    // @TODO - use patient_icds.order_no as ORDER BY and array_agg this
    return context.icds[ 0 ] || ``;
};

const getSecondaryICD = ( context ) => {
    // field length: 6
    // format: alpha
    // @TODO - use patient_icds.order_no as ORDER BY and array_agg this
    return context.icds[ 1 ] || ``.padEnd(6, ` `);
};

const getTertiaryICD = ( context ) => {
    // field length: 6
    // format: alpha
    // @TODO - use patient_icds.order_no as ORDER BY and array_agg this
    return context.icds[ 2 ] || ``.padEnd(6, ` `);
};

const getCalls = ( context ) => {
    // field length: 3
    // format: numeric
    // @TODO - use study_cpt.units (or the hstore or whatever)

    return context.units;
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
    segment += getServiceRecipient(context);
    segment += getServiceRecipientRegistrationNumber(context);
    segment += getHealthServiceCode(context);
    segment += getServiceStartDate(context);
    segment += getEncounterNumber(context);
    segment += getPrimaryICD(context);
    segment += getSecondaryICD(context);
    segment += getTertiaryICD(context);
    segment += getCalls(context);

    segment += getFill();

    return segment;
};

module.exports = encoder;
