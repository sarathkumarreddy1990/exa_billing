'use strict';
const shared = require('../../../../../server/shared');
const CO2recordDescription = require('./recordDescription.json');
const defaultValues = require('../../../resx/default.json');
const moment = require('moment');

/**
 * Return valid icd code if exist
 * @param {Array} icds - icd array
 * @param {Int} pointer - pointer index
 * @returns {string}
 */
const checkVaildICD = (icds, pointer) => {
    return icds && pointer && icds[pointer - 1] && (icds[pointer - 1].replace(/[. / -]/g, '')).padStart(5, '0');
};

/**
 * get patient short name
 * @param {string} first_name - first name
 * @param {string} middle_name - middle name
 * @param {string} last_name - last name
 * @param {Int} phin -phin number
 * @returns {string}
 */
const getShortName = (first_name, middle_name, last_name) => {
    let name = '';
    name += first_name ? first_name.slice(0, 1) : ' ';
    name += middle_name ? middle_name.slice(0, 1) : ' ';
    name += last_name ? last_name.slice(0, 2).padEnd(2, ' ') : '  ';

    CO2recordDescription.patient_name = {
        ...CO2recordDescription.patient_name,
        validationRequired: true,
        name: 'Patient name',
        customMessage:'not follow pattern',
        constraints: [`^[A-Za-z][A-Za-z\\s][A-Za-z][A-Za-z\\s.'-]$`]
    };

    return name;

};

/**
 * initializeValidation -  To initialize validation Object
 *
 */
const initializeValidation = () => {
    let validation = [
        'postal_code',
        'first_name',
        'middle_name',
        'last_name',
        'insurer_code',
        'file_number',
        'add4_wsbc_claim_number',
        'add1_wsbc_data',
        'patient_name',
        'comments',
        'add3_wsbc_nature_of_injury',
        'add2_wsbc_area_of_injury_anatomical_position',
        'gender'
    ];

    validation.forEach((instance) => {
        CO2recordDescription[instance].validationRequired = false;
        CO2recordDescription[instance].constraints = [];
        CO2recordDescription[instance].isMandatory = false;
        CO2recordDescription[instance].validLength = null;
        CO2recordDescription[instance].isNumeric = false;
        CO2recordDescription[instance].isValidDate = false;
    });
};

/**
 * convertToFacilityDate -  Converting facility date 
 *
 * @param {string} value - current date
 * @param {string} timeZone - time zone
 */
const convertToFacilityDate = (value, timeZone) => {
    if (!value) {
        return '';
    }

    let convertedDate = moment(value).tz(timeZone);

    if (!convertedDate.isValid()) {
        throw new Error('otherDateTimeWithTimeZone does not seem to be valid date time!');
    }

    return convertedDate;
};

/**
 * C02 segment processing based on result
 * @param {Object} args
 * @returns {Object}
 */

const processResults = (args, service) => {
    let {
        phn,
        icds,
        city,
        gender,
        province,
        last_name,
        first_name,
        is_employed,
        middle_name,
        patient_dob,
        postal_code,
        claim_number,
        address_line1,
        address_line2,
        area_of_injury,
        submission_code,
        is_auto_accident,
        nature_of_injury,
        place_of_service,
        can_bc_is_newborn,
        original_reference,
        rendering_provider,
        referring_provider,
        facility_time_zone,
        can_supporting_text,
        can_bc_payee_number,
        can_facility_number,
        current_illness_date,
        can_bc_service_clr_code,
        can_bc_data_centre_number,
        can_bc_is_alt_payment_program
    } = args;

    let {
        end_time,
        start_time,
        service_to_day,
        record_code_C02,
        service_indicator,
        ref_practitioner_2,
        facility_sub_number,
        ref_practitioner_2_cd,
        dob_icbc_claim_number
    } = defaultValues;

    let phin = '';
    let dependent_number = '00';
    let add1_wsbc_data = '';
    let patient_name;
    let add4_wsbc_claim_number = '';
    let add2_wsbc_area_of_injury_anatomical_position = '';
    let registration_number;
    let oin_birthday = '';
    let add3_wsbc_nature_of_injury = '';
    let insurer_code = '';
    let address_line3 = `${city} ${province}`;
    let isNO1required = (can_supporting_text && can_supporting_text.length) > 20;
    let isWsbc = is_employed || submission_code == 'W';

    initializeValidation();

    if (phn && phn.country_alpha_3_code === 'can' && phn.province_alpha_2_code === 'BC') {
        phin = phn.alt_account_no;
        dependent_number = can_bc_is_newborn ? '66' : '00';
    }

    // Mandatory field constrains for WSBC type claim
    if (isWsbc) {
        CO2recordDescription.add3_wsbc_nature_of_injury = {
            ...CO2recordDescription.add3_wsbc_nature_of_injury,
            isMandatory: true,
            validationRequired: true,
            isNumeric: true,
            validLength: 5,
            name: 'WSBC nature of injury'
        };

        CO2recordDescription.add2_wsbc_area_of_injury_anatomical_position = {
            ...CO2recordDescription.add2_wsbc_area_of_injury_anatomical_position,
            isMandatory: true,
            validationRequired: true,
            isNumeric: true,
            validLength: 5,
            name: 'WSBC area of injury'
        };

        CO2recordDescription.add4_wsbc_claim_number = {
            ...CO2recordDescription.add4_wsbc_claim_number,
            isMandatory: true,
            validationRequired: true,
            validLength: 8,
            name: 'WSBC claim number'
        };

        CO2recordDescription.add1_wsbc_data = {
            ...CO2recordDescription.add1_wsbc_data,
            validationRequired: true,
            isValidDate: true,
            name: 'WSBC date of injury'
        };

        is_auto_accident = false;
    }

    // Unique submission code constrains
    switch (submission_code) {
        case 'E': {
            CO2recordDescription.file_number = {
                ...CO2recordDescription.file_number,
                validationRequired: true,
                isMandatory: true,
                name: 'File number'
            };

            break;
        }

        case 'R': {
            if (!(can_supporting_text && can_supporting_text.length)) {
                CO2recordDescription.comments = {
                    ...CO2recordDescription.comments,
                    validationRequired: true,
                    isMandatory: true,
                    name: 'Claim short comment'
                };
            }

            break;
        }

        default: {
            CO2recordDescription.file_number = {
                ...CO2recordDescription.file_number,
                'paddingChar': '0',
                'isLeftJustified': false
            };
        }
    }

    if (submission_code != 'I' && !is_auto_accident && ((phn && phn.province_alpha_2_code !== 'BC') || isWsbc)) {
        let wsbcDate = convertToFacilityDate(current_illness_date, facility_time_zone);
        postal_code = postal_code.replace(/[' ']/g, '');
        add1_wsbc_data = !isWsbc ? address_line1 : wsbcDate && wsbcDate.format('YYYYMMDD');
        add2_wsbc_area_of_injury_anatomical_position = !isWsbc ? address_line2 : area_of_injury;
        add3_wsbc_nature_of_injury = !isWsbc ? address_line3 : nature_of_injury;
        add4_wsbc_claim_number = !isWsbc ? '' : original_reference && original_reference.padStart(8, '0');
        registration_number = phn ? `${phn.alt_account_no.padStart(10, '0')}${dependent_number}` : '';
        phin = '0';

        CO2recordDescription.first_name = {
            ...CO2recordDescription.first_name,
            validationRequired: true,
            constraints: ['^[A-Za-z]{1}'],
            name: 'RCP First Name',
            customMessage: '(char 1 out of 12) must be A to Z'
        };

        CO2recordDescription.middle_name = {
            ...CO2recordDescription.middle_name,
            validationRequired:  true,
            constraints: ['^[A-Za-z\\s]{1}$|^$'],
            name: 'RCP Initial',
            customMessage: 'must be blank or A-Z'
        };

        CO2recordDescription.last_name = {
            ...CO2recordDescription.last_name,
            validationRequired: true,
            constraints: ['^[A-Za-z]{2}|[\\s]{2}'],
            name: 'RCP Last Name',
            customMessage: '(character 2 out of 12) must be A-Z or blank'
        };

        CO2recordDescription.insurer_code = {
            ...CO2recordDescription.insurer_code,
            validationRequired: true,
            constraints: ['AB|SK|MB|ON|NB|NS|PE|NF|NT|YT|NU|WC'],
            name: 'Insurer Code',
            customMessage: 'is invalid'
        };

        CO2recordDescription.gender = {
            ...CO2recordDescription.gender,
            validationRequired: true,
            constraints: ['^[M|F|m|f]$'],
            name: 'RCP Sex Code',
            customMessage: 'must be M or F'
        };

        patient_name = '0000';
        oin_birthday = patient_dob;
        insurer_code = (!isWsbc) ? (phn && phn.province_alpha_2_code) : 'WC';
    } else {
        postal_code = '';
        patient_name = getShortName(first_name, middle_name, last_name);
        first_name = '';
        middle_name = '';
        last_name = '';
        gender = '';
    }

    let bill_fee = shared.roundFee(service.bill_fee);
    let service_date = convertToFacilityDate(service.service_start_dt, facility_time_zone);

    return {
        record_code: record_code_C02,
        data_centre_number: can_bc_data_centre_number,
        data_center_sequence: service.charge_id,
        payee_number: can_bc_payee_number,
        pratitioner_number: rendering_provider,
        phn: phin,
        patient_name,
        dependent_number: dependent_number,
        billed_units: service.units,
        SCC: can_bc_service_clr_code,
        service_anatomical_area: ' ',
        service_indicator,
        new_indicator: service.modality === 'MG' ? '02' : '00',
        billed_fee_item: service.code,
        billed_amount: bill_fee && bill_fee.replace(/[, .]/g, ''),
        payment_mode: can_bc_is_alt_payment_program ? 'E' : '0',
        service_date: service_date && service_date.format('YYYYMMDD'),
        service_to_day,
        submission_code: submission_code || '0',
        extension_submission_code: '',
        icd_1: checkVaildICD(icds, service.pointer1) || ' ',
        icd_2: checkVaildICD(icds, service.pointer2) || ' ',
        icd_3: checkVaildICD(icds, service.pointer3) || ' ',
        diagnostic_expansion: '',
        service_location: place_of_service,
        ref_practitioner_1_cd: referring_provider ? 'B' : '0',
        ref_practitioner_1: referring_provider || '0',
        ref_practitioner_2_cd,
        ref_practitioner_2,
        time_call: '',
        start_time,
        end_time,
        dob: (dependent_number === '66') ? patient_dob : dob_icbc_claim_number,
        foloi_number: claim_number,
        corresponding_code: isNO1required ? 'N' : '0',
        comments: !isNO1required ? can_supporting_text : '',
        mva_claim_code: is_auto_accident ? 'Y' : 'N',
        icbc_claim_number: submission_code === 'I' ? original_reference : dob_icbc_claim_number,
        file_number: submission_code === 'E' ? `${can_bc_data_centre_number}${(((service.last_sequence && service.last_sequence.toString()) || '').padStart(7, '0')).slice(0, 7)}` : '0',
        facility_number: can_facility_number,
        insurer_code,
        facility_sub_number,
        registration_number,
        oin_birthday,
        first_name,
        middle_name,
        last_name,
        gender,
        add1_wsbc_data,
        add2_wsbc_area_of_injury_anatomical_position,
        add3_wsbc_nature_of_injury,
        add4_wsbc_claim_number,
        postal_code
    };
};

module.exports = processResults;
