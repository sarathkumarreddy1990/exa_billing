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
        province_code,
        city,
        registration_number_details
    } = row.service_reception_details;
  
    let registration_number = (registration_number_details && registration_number_details.alt_account_no && registration_number_details.alt_account_no.padStart(6, '0')) || '';
    let phin;

    if (phn_details) {
        phin = (phn_details.country_alpha_3_code === 'can' && phn_details.province_alpha_2_code === 'MB') ? phn_details.alt_account_no : '';
    }

    let addressLine2;

    if (!postal_code) {
        addressLine2 = `${address2} ${city} ${province_code}`;
    }

    return {
        'record_type': 4,
        'practitioner_number': row.practitioner.prid,
        'mhsal_registration_number': registration_number,
        'registrant_address_one': address1,
        'registrant_address_two': addressLine2,
        'postal_code': postal_code.replace(/\s/g, ''),
        'phin': phin,
        'claim_number': row.claim_number,
    };
};

module.exports = processResults;