'use strict';

const segmentTypes = {
    'CIB1': require('./claimSegmentTypes/CIB1'),
    'CPD1': require('./claimSegmentTypes/CPD1'),
    'CST1': require('./claimSegmentTypes/CST1'),
    'CTX1': require('./claimSegmentTypes/CTX1'),
};

const claimTransactionHeader = ( row ) => {
    const headerContext = {
        'recordType': 3,
        'submitterPrefix': row.submitter_prefix,
        'year': row.year,
        'sourceCode': row.source_code,
        'sequenceNumber': row.sequence_number,
        'checkDigit': row.check_digit,
        'transactionType': row.transaction_type,
        'actionCode': row.action_code,
    };

    return ( segmentType, segmentData ) => {
        const segmentHeader = {
            ...headerContext,
            'segmentSequence': ++headerContext.segment_sequence,
            segmentType,
            'empty': ``,
        };

        const makeSegmentProcessor = segmentTypes[ segmentType ];
        return makeSegmentProcessor(row, segmentHeader, segmentData);
    };
};

const processRow = tracker => row => {

    const makeSegment = claimTransactionHeader(row);
    const makeSegmentContext = makeSegment(headerContext);

    const segments = [
        makeSegment(`CIB1`),
    ];

    /**
     * OOP patient or newborn needs person data segment to describe who they are
     * CPD1
     */

    if ( !row.service_recipient_uli ) {
        if (
            !row.service_recipient_registration_number &&
            ( row.newborn_code || row.good_faith_indicator)
        ) {
            segments.push(makeSegment(`CPD1`, row.service_recipient_details));
        }
    }



    if ( !row.referral_id || row.oop_referral_indicator ) {
        segments.push(makeSegment(`CPD1`, row.referring_provider_details));
    }

    if ( row.pay_to_code === `OTHR` && !row.pay_to_uli ) {
        segments.push(makeSegment(`CPD1`, row.pay_to_details));
    }

    tracker.segments += segments.length;

    return segments.join(`\n`);
};

module.exports = processRow;
