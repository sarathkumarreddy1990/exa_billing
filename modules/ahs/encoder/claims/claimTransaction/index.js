'use strict';

const formatters = require('../formatters');
const initCodec = require('../../../../../lib/vandelay/lendel');

const {
    validateRecordDescriptor,
    hydrateRecordDescriptor,
} = require('../../../../../lib/vandelay/util');

const {
    encodeRecord,
} = initCodec(formatters);

const segmentProcessors = {
    'CIB1': require('./claimSegmentTypes/CIB1'),
    'CPD1': require('./claimSegmentTypes/CPD1'),
    'CST1': require('./claimSegmentTypes/CST1'),
    'CTX1': require('./claimSegmentTypes/CTX1'),
};

const descriptors = {
    'claimTransactionHeader': require('./claimTransactionHeader/recordDescriptor'),
    'CIB1': require('./claimSegmentTypes/CIB1/recordDescriptor'),
    'CPD1': require('./claimSegmentTypes/CPD1/recordDescriptor'),
    'CST1': require('./claimSegmentTypes/CST1/recordDescriptor'),
    'CTX1': require('./claimSegmentTypes/CTX1/recordDescriptor'),
};

/**
 * Validate all descriptors first
 * - if even one fails we don't want project to run - files are static and should always pass
 */

for ( const key in descriptors ) {
    const descriptor = descriptors[ key ];
    const failures = validateRecordDescriptor(descriptor, formatters);

    if ( failures.length > 0 ) {
        failures.forEach(console.error);
        throw new Error(`Failed validation of claim descriptor '${key}'`);
    }

    hydrateRecordDescriptor(descriptor, fieldDesc => ({
        'isLeftJustified': fieldDesc.format.toLowerCase() === `a`
    }));
}

const claimTransactionHeader = ( row ) => {
    const headerContext = {
        'record_type': 3,
        'submitter_prefix': row.submitter_prefix,
        'year_source_code': row.year_source_code,
        'sequence_number': row.sequence_number,
        'check_digit': row.check_digit,
        'transaction_type': row.transaction_type,
        'action_code': row.action_code,
        'segment_sequence': 1,
    };

    return ( segmentType, segmentData ) => {
        const headerRecord = {
            ...headerContext,
            'segment_sequence': headerContext.segment_sequence++,
            'segment_type': segmentType,
            'empty': ``,
        };

        const encodedHeader = encodeRecord(headerRecord, descriptors.claimTransactionHeader).encodedData;

        if ( segmentType ) {
            const segmentProcessor = segmentProcessors[ segmentType ];
            const segmentDescriptor = descriptors[ segmentType ];
            const segmentRecord = segmentProcessor(row, headerRecord, segmentData);
            const encodedSegment = encodeRecord(segmentRecord, segmentDescriptor).encodedData;

            return `${encodedHeader}${encodedSegment}`;
        }

        return encodedHeader;
    };
};

function* processSupportingText ( text ) {
    while ( text.length > 0 ) {
        yield {
            'supporting_text_1': text.slice(0, 73),
            'supporting_text_2': text.slice(73, 146),
            'supporting_text_3': text.slice(146, 219),
        };

        text = text.slice(219);
    }
}

const processRow = tracker => row => {

    const makeSegment = claimTransactionHeader(row);

    if ( row.action_code.toLowerCase() === `d` ) {
        /*
         Passing no args here will return just the header info but we still have
         to count this as a "segment" so increase tracker amount to 1
         */
        tracker.segments = 1;
        return makeSegment();
    }

    const segments = [
        makeSegment(`CIB1`),
    ];

    /**
     * OOP patient or newborn needs person data segment to describe who they are
     * CPD1
     */

    if ( row.service_recipient_details ) {
        segments.push(makeSegment(`CPD1`, row.service_recipient_details));
    }

    /**
     * OOP referring provider needs person data segment to describe who they are
     * CPD1
     */

    if ( row.referring_provider_details ) {
        segments.push(makeSegment(`CPD1`, row.referring_provider_details));
    }

    /**
     * Payee is OTHR and no ULI exists so it needs a person data segment to describe
     * who they are
     * CPD1
     */

    if ( row.pay_to_details ) {
        segments.push(makeSegment(`CPD1`, row.pay_to_details));
    }

    if ( row.supporting_text ) {
        const textGen = processSupportingText(row.supporting_text);
        let textMap = textGen.next();
        while ( !textMap.done ) {
            segments.push(makeSegment(`CST1`, textMap.value));
            textMap = textGen.next();
        }

        if ( Array.isArray(row.cross_reference_claim_numbers) && row.cross_reference_claim_numbers.length > 0 ) {
            segments.push(makeSegment(`CTX1`));
        }
    }

    if ( row.emsaf_reason ) {
        const textGen = processSupportingText(row.emsaf_reason);
        let textMap = textGen.next();
        while ( !textMap.done ) {
            segments.push(makeSegment(`CST1`, textMap.value));
            textMap = textGen.next();
        }
    }

    tracker.segments += segments.length;

    return segments.join(`\n`);
};

module.exports = processRow;
