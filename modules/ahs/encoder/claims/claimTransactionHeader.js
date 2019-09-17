'use strict';

const constants = require('../../constants');
const config = require('../../../../server/config');
const submitterPrefix = config.get(config.keys.ahsSubmitterPrefix);

const getRecordType = () => {
    // field length: 1
    // format: numeric
    return `3`;    // always
};

const getSubmitterPrefix = () => {
    // field length: 3
    // format: alpha
    return submitterPrefix;
};

const getCurrentYear = () => {
    // field length: 2
    // format: numeric
    const date = new Date();
    const year = date.getFullYear();
    return year.toString().slice(-2);
};

const getSourceCode = ( context ) => {
    // field length: 2
    // format: alpha
    return `SS`;  // "SS" is the default example in the docs but it's not very specific on what this should be
};

const getSequenceNumber = ( context ) => {
    // field length: 7
    // format: numeric
    return String(context.claimSequenceNumber).padStart(7, `0`);
};

const getCheckDigit = ( context ) => {
    // field length: 1
    // format: numeric
    return String(context.claimSequenceNumber % 10);
};

const getTransactionType = ( context ) => {
    // field length: 4
    // format: alpha
    return context.claimTransactionType;     // Currently only CIP1 is supported for in- and out-of-province transactions
};

/**
 * One of [CIB1, CPD1, CST1, CTX1]
 * @param   context
 * @return  {string}
 */
const getSegmentType = ( context ) => {
    // field length: 4
    // format: alpha
    return context.segmentType;
};

const getSegmentSequence = ( context ) => {
    // field length: 4
    // format: numeric
    return String(context.segmentSequence).padStart(4, `0`);
};

const getActionCode = ( context ) => {
    // field length: 1
    // format: alpha
    return constants.encoder.actionCodes[ context.claimAction ];
};

const getFill = () => {
    // field length: 6
    // format: space
    return ``.padEnd(6, ` `);
};

const encoder = ( batchData, context ) => {
    let claimTransactionHeader = ``;

    claimTransactionHeader += getRecordType();
    claimTransactionHeader += getSubmitterPrefix();
    claimTransactionHeader += getCurrentYear();
    claimTransactionHeader += getSourceCode(context);
    claimTransactionHeader += getSequenceNumber(context);
    claimTransactionHeader += getCheckDigit(context);
    claimTransactionHeader += getTransactionType(context);
    claimTransactionHeader += getSegmentType(context);
    claimTransactionHeader += getSegmentSequence(context);
    claimTransactionHeader += getActionCode(context);
    claimTransactionHeader += getFill();

    return claimTransactionHeader;
};

module.exports = encoder;

