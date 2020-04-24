'use strict';
const shared = require('../../../../../server/shared');
/**
 * File trailer processing based on result
 * @param {Object} row
 * @returns {Object}
 */

const processResults = (row, tracker, companyInfo) => {
    let {
        SOCIOLOGICAL,
        REGISTRANT,
        REMARKS,
        SERVICE,
        total_fee,
        NONRESIDENCE
    } = tracker;
    let total_bill_fee = shared.roundFee(total_fee);
    return {
        'record_type': 9,
        'user_site_number': companyInfo.can_submitter_prefix,
        'number_of_sociological': SOCIOLOGICAL,
        'number_of_address': REGISTRANT,
        'number_of_remarks': REMARKS,
        'number_of_service': SERVICE,
        'total_fee': total_bill_fee && total_bill_fee.replace(/[, .]/g, ''), // By default last 2 digit is piase or cent hence removing decimal 
        'number_of_non_residence': NONRESIDENCE,
        'last_claim_number': row.claim_number
    };
};

module.exports = processResults;
