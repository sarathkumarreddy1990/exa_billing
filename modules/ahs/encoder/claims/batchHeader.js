'use strict';

const {
    encoder: constants,
} = require('../../constants');

const config = require('../../../../server/config');
const submitterPrefix = config.get(config.keys.ahsSubmitterPrefix);

const getRecordType = () => {
    // field length: 1
    // format: numeric
    return `2`;    // always
};

const getSubmitterPrefix = () => {
    // field length: 3
    // format: alpha
    return submitterPrefix;
};

const getBatchNumber = ( batchData ) => {
    // field length: 6
    // format: numeric
    return String(batchData.batchNumber).padStart(6, `0`);
};

const getFill = ( batchData ) => {
    // field length: 244
    // format: space
    return ``.padEnd(244, ` `);
};

const encoder = ( batchData, context ) => {
    let batchHeaderRecord = ``;

    batchHeaderRecord += getRecordType();
    batchHeaderRecord += getSubmitterPrefix();
    batchHeaderRecord += getBatchNumber(batchData);
    batchHeaderRecord += getFill();

    batchHeaderRecord += constants.endOfRecord;

    return batchHeaderRecord;
};

module.exports = encoder;

