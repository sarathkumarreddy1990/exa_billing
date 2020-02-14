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
    'SOCIOLOGICAL': require('./claimSegmentTypes/SOCIOLOGICAL'),
    'REGISTRANT': require('./claimSegmentTypes/REGISTRANT'),
    'REMARKS': require('./claimSegmentTypes/REMARKS'),
    'SERVICE': require('./claimSegmentTypes/SERVICE'),
    'NONRESIDENCE': require('./claimSegmentTypes/NONRESIDENCE'),
};

const descriptors = {
    'SOCIOLOGICAL': require('./claimSegmentTypes/SOCIOLOGICAL/recordDescriptor'),
    'REGISTRANT': require('./claimSegmentTypes/REGISTRANT/recordDescriptor'),
    'REMARKS': require('./claimSegmentTypes/REMARKS/recordDescriptor'),
    'SERVICE': require('./claimSegmentTypes/SERVICE/recordDescriptor'),
    'NONRESIDENCE': require('./claimSegmentTypes/NONRESIDENCE/recordDescriptor')
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

const processRow = (tracker, batch_tracker) => row => {

    const segments = [];
    let {
        claim_total_bill_fee,
        referring_provider_remarks,
        remarks,
        health_services,
        service_reception_details
    } = row;

    tracker.total_fee += parseFloat(claim_total_bill_fee); 
    batch_tracker.total_fee += parseFloat(claim_total_bill_fee);
    let segmentKeys =  Object.keys(segmentProcessors);
    let isOutOfProvince = false;

    if (service_reception_details.phn_details && service_reception_details.phn_details.province_alpha_2_code !== 'MB') {
        isOutOfProvince = true;
        service_reception_details.registration_number_details = {};
    }

    segmentKeys.forEach(key => {
        
        row.sequence_number = 1;

        switch (key) {
            case 'REMARKS': {
                let providerRemarks = referring_provider_remarks && referring_provider_remarks.remarks;

                if (row.remarks.length) {
                    let remarksArray = remarks.match(/\S+/g) || [];
                    let currentString = '';
                    
                    // Logic to build the remarks 
                    for (let i = 0; i < remarksArray.length; i++) {

                        if(row.sequence_number > 66){
                            break;
                        }

                        currentString = currentString ? currentString + ' ' + remarksArray[i] : remarksArray[i];
                        let currentLegth = currentString.length;
                        let nextString = remarksArray[i + 1] || '';

                        if (currentLegth + nextString.length > 63) {
                            segments.push(
                                encodeRecord(
                                    segmentProcessors[key](row, currentString),
                                    descriptors[key]
                                )
                            );

                            row.sequence_number++;
                            currentString = '';
                            tracker[key]++;
                            batch_tracker[key]++;
                        } else if (i == remarksArray.length - 1) {
                            segments.push(
                                encodeRecord(
                                    segmentProcessors[key](row, currentString),
                                    descriptors[key]
                                )
                            );

                            row.sequence_number++;
                            tracker[key]++;
                            batch_tracker[key]++;
                        }
                    }
                } 

                if (providerRemarks && providerRemarks.length && (row.sequence_number < 67)) {
                    segments.push(
                        encodeRecord(
                            segmentProcessors[key](row, providerRemarks),
                            descriptors[key]
                        )
                    );

                    tracker[key]++;
                    batch_tracker[key]++;
                }  

                break;
            }

            case 'SERVICE': {

                if (referring_provider_remarks) {
                    row.referring_provider.prid = referring_provider_remarks.prid || '';
                }

                health_services.forEach(service => {
                    if (service.code !== 'I001') {
                        segments.push(
                            encodeRecord(
                                segmentProcessors[key](row, service),
                                descriptors[key]
                            )
                        );

                        tracker[key]++;
                        batch_tracker[key]++;
                    }
                });

                break;
            }

            case 'NONRESIDENCE': {
                if (isOutOfProvince) {
                    segments.push(
                        encodeRecord(
                            segmentProcessors[key](row),
                            descriptors[key]
                        )
                    );

                    tracker[key]++;
                    batch_tracker[key]++;
                }

                break;
            }

            default: {
                tracker[key]++;
                batch_tracker[key]++;

                segments.push(
                    encodeRecord(
                        segmentProcessors[key](row),
                        descriptors[key]
                    )
                );

                break;
            }
        }
    });

    return segments.join('\r\n');
};

module.exports = processRow;
