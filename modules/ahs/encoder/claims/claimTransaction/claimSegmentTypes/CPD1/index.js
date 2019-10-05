'use strict';

const processRow = ( row, context, segmentData ) => {
    console.log(JSON.stringify(segmentData, null, 2));
    return JSON.parse(segmentData);
};

module.exports = processRow;
