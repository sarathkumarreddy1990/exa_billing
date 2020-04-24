'use strict';
/**
 * File header processing based on result
 * @param {Object} row
 * @returns {Object}
 */

const processResults = (row, companyInfo) => {

    return {
        'record_type': 1,
        'user_site_number': companyInfo.can_submitter_prefix,
        'user_site_name': companyInfo.company_name,
        'first_claim_number': row.claim_number
    };
};

module.exports = processResults;
