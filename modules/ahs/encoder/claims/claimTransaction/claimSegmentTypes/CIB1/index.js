'use strict';

const processRow = ( row, context, segmentData ) => {
    return {
        ...row,
        'emsaf_indicator': row.emsaf_reason
            ? `Y`
            : ``,
    };
};

module.exports = processRow;
