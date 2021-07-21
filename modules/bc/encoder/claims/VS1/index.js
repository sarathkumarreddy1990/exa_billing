'use strict';
const defaultValues = require('../../../resx/default.json');
const { version } = require('../../../../../package.json');
const VS1recordDescription = require('./recordDescription.json');


let {
    contact,
    company_name,
    software_name,
    record_code_VS1,
    vender_MSP_DC_number
} = defaultValues;

/**
 * VS1 segment processing based on result
 * @param {Object} args
 * @returns {Object}
 */
const processResults = (args, isBatchEligibilityFile) => {
    let {
        can_bc_data_centre_number,
        installation_date
    } = args;


    VS1recordDescription.installation_date = {
        ...VS1recordDescription.installation_date,
        validationRequired: !isBatchEligibilityFile,
        isMandatory: !isBatchEligibilityFile,
    };

    VS1recordDescription.software_version = {
        ...VS1recordDescription.software_version,
        validationRequired: !isBatchEligibilityFile,
        isMandatory: !isBatchEligibilityFile,
    };

    return {
        record_code: record_code_VS1,
        data_centre_number: can_bc_data_centre_number,
        data_center_sequence: '',
        vender_MSP_DC_number,
        software_name,
        software_version: version,
        installation_date,
        company_name,
        contact,
        contact_name: '',
    };
};

module.exports = processResults;
