'use strict';
/**
 * Sociological processing based on record
 * @param {Object} row
 * @returns {Object}
 */

const processResults = ( row ) => {

    let {
        practitioner,
        service_reception_details: {
            registration_number_details = {},
            last_name = '',
            first_name = '',
            gender = '',
            birth_date = '',
            account_number = ''
        },
        claim_total_bill_fee,
        can_wcb_rejected,
        claim_number
    } = row;
    
    return {
        'record_type': 3,
        'practitioner_number': practitioner.prid ? practitioner.prid.padStart(5, '0') : '',
        'mhsal_registration_number': (registration_number_details && registration_number_details.alt_account_no && registration_number_details.alt_account_no.padStart(6, '0')) || '',
        'sur_name': last_name,
        'given_name': first_name,
        'birth_date': birth_date && birth_date.slice(2, 6),
        'gender': gender,
        'mrn': account_number,
        'total_amount_bill': claim_total_bill_fee.replace(/[.]/g, ''),
        'pre_auth_indicator': '', // EXA-18985
        'on_call_indicator': '', // EXA-18990
        'wcb_indicator': can_wcb_rejected ? 'W': '', // EXA-18991
        'claim_number': claim_number,
    };
};

module.exports = processResults;
