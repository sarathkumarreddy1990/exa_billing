'use strict';

const processRow = ( row, headerContext ) => {
    return {
        ...headerContext,
        'segmentType': context.segment_type,
        'segmentSequence': ++context.segment_sequence,
        'actionCode': row.action_code,
        'empty': ``,
    };
};

module.exports = processRow;
