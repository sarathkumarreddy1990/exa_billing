'use strict';
/**
 * Non residence processing based on record
 * @param {Object} row
 * @returns {Object}
 */

const processResults = (row) => {

    let {
        phn_details,
        birth_date,
        century
    } = row.service_reception_details;

    return {
        'record_type': 7,
        'practitioner_number': row.practitioner.prid,
        'health_identification_number': phn_details && phn_details.alt_account_no,
        'province_code': phn_details && phn_details.province_alpha_2_code,
        'patient_birth_date': century + birth_date.slice(2),
        'claim_number': row.claim_number
    };
};

module.exports = processResults;
