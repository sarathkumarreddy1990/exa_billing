'use strict';
const shared = require('../../../../../../../server/shared');

/**
 * Service processing based on record
 * @param {Object} row
 * @param {Object} service
 * @returns {Object}
 */

const processResults = (row, service) => {
    let {
        practitioner,
        referring_provider,
        facility_number,
        can_confidential,
        icds,
        interpreting_provider,
        can_location_service,
        claim_number
    } = row;

    let bill_fee = shared.roundFee(service.bill_fee);
    let serviceCode = service.code || "";
    
    return {
        'record_type': 6,
        'incorporated_indicator': 0,
        'practitioner_number': practitioner.prid && practitioner.prid.slice(1),
        'referring_practitioner_number': referring_provider.prid,
        'facility_number': facility_number,
        'hospital_code': '000',
        'service_date': service.service_start_dt,
        'prefix': serviceCode && serviceCode[0],
        'tariff': serviceCode && serviceCode.slice(1),
        'services': service.units,
        'anesthesia_units': '00',
        'fee_submitted':  bill_fee && bill_fee.replace(/[, .]/g, ''), // By default last 2 digit is piase or cent hence removing decimal 
        'confidentail_code': can_confidential ? 'C' : '',
        'icd_9_cm': icds && service.pointer1 && icds[service.pointer1 - 1] && (icds[service.pointer1 - 1].replace(/[.]/g, '')).padStart(5, '0'),
        'optometric_reason_code': '00',
        'special_circumstance_indicator': ' ',
        'interpreting_radiologist_number': interpreting_provider.prid,
        'location_of_service': can_location_service,
        'number_of_patients': 1,
        'bilateral': service.modifers.modifier_ids.includes('50') ? 'b' : '',
        'claim_number': claim_number,
    };
};

module.exports = processResults;
