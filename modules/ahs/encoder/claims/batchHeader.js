'use strict';

const {
    encoder: constants,
} = require('../../constants');

const config = require('../../../../server/config');

const getRecordType = () => {
    // field length: 1
    // format: numeric
    return `2`;    // always
};

const getSubmitterPrefix = (data) => {
    // field length: 3
    // format: alpha
    return data.submitter_prefix;
};

const getBatchNumber = ( data ) => {
    // field length: 6
    // format: numeric
    return String(~~data.batch_number).padStart(6, `0`);
};

const getFill = () => {
    // field length: 244
    // format: space
    return ``.padEnd(244, ` `);
};

const encoder = ( data ) => {
    let batchHeaderRecord = ``;

    batchHeaderRecord += getRecordType();
    batchHeaderRecord += getSubmitterPrefix();
    batchHeaderRecord += getBatchNumber(batchData);
    batchHeaderRecord += getFill();

    batchHeaderRecord += constants.endOfRecord;

    return batchHeaderRecord;
};

module.exports = encoder;

