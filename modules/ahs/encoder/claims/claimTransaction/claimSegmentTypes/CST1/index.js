'use strict';

const processRow = ( row, context, segmentData ) => {
    const {
        supporting_text_1,
        supporting_text_2,
        supporting_text_3,
    } = segmentData;

    return {
        supporting_text_1,
        supporting_text_2,
        supporting_text_3,
    };
};

module.exports = processRow;
