'use strict';
/**
 * Registrant processing based on record
 * @param {Object} row
 * @returns {Object}
 */

const processResults = ( row ) => {
    let {
        address1,
        address2,
        postal_code,
        phn_details,
        registration_number_details
    } = row.service_reception_details;
  
    let registration_number = (registration_number_details && registration_number_details.alt_account_no && registration_number_details.alt_account_no.padStart(6, '0')) || '';
    let phin;

    if(phn_details && phn_details.length){
        phin = (phn_details.province_alpha_2_code === 'MB') ? phn_details.alt_account_no : '';
    }

    return {
        'record_type': 4,
        'practitioner_number': row.practitioner.prid,
        'mhsal_registration_number': registration_number,
        'registrant_address_one': address1,
        'registrant_address_two': address2,
        'postal_code': postal_code.replace(/\s/g, ''),
        'phin': phin,
        'claim_number': row.claim_number,
    };
};

module.exports = processResults;
