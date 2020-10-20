'use strict';
const defaultValues = require('../../../resx/default.json');

/**
 * N01 segment processing based on result
 * @param {Object} args
 * @returns {Object}
 */

const processResults = (args) => {
    let {
        rendering_provider,
        can_supporting_text,
        can_bc_payee_number,
        can_bc_data_centre_number,
        submission_code
    } = args;

    return {
        record_code: defaultValues.record_code_N01,
        data_centre_number: can_bc_data_centre_number,
        data_center_sequence: '',
        payee_number: can_bc_payee_number,
        practitioner_number: rendering_provider,
        note_data_type: submission_code === 'W' ? 'W' : 'A',
        note_data: can_supporting_text
    };
};

module.exports = processResults;
