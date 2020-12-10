'use strict';
const moment = require('moment-timezone');
const defaultValues = require('../../../resx/default.json');


const getShortName = (first_name, middle_name, last_name) => {
    let name = '';
    name += first_name ? first_name.slice(0, 1) : ' ';
    name += middle_name ? middle_name.slice(0, 1) : ' ';
    name += last_name ? last_name.slice(0, 2).padEnd(2, ' ') : '  ';

    return name;
};

/**
 * N01 segment processing based on result
 * @param {Object} args
 * @returns {Object}
 */

const processResults = (args) => {
    let {
        phn_alt_account_no,
        can_bc_payee_number,
        birth_date,
        date_of_service,
        gender,
        can_bc_data_centre_number,
        study_id,
        first_name,
        middle_name,
        last_name,
        time_zone
    } = args;

    return {
        record_code: defaultValues.record_code_B04,
        data_centre_number: can_bc_data_centre_number,
        data_center_sequence: '',
        payee_number: can_bc_payee_number,
        phn: phn_alt_account_no,
        dependent_number: defaultValues.service_to_day,
        name_verify: getShortName(first_name, middle_name, last_name),
        birth_date,
        date_of_service: date_of_service || moment().tz(time_zone).format('YYYYMMDD'),
        sex: gender,
        patient_status: '',
        office_folio_number: study_id
    };
};

module.exports = processResults;
