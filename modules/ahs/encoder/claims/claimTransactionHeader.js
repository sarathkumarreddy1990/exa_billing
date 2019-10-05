'use strict';

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

