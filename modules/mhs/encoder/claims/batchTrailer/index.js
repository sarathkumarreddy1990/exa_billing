'use strict';
const shared = require('../../../../../server/shared');
/**
 * Batch trailer processing based on result
 * @param {Object} results
 * @param {Object} tracker
 * @returns {Object}
 */

const processResults = ( results, tracker ) => {
    const [
        data,
    ] = results;

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
        'record_type': 8,
        'practitioner_number': data.practitioner.prid,
        'total_sociological': SOCIOLOGICAL,
        'total_address': REGISTRANT,
        'total_remarks': REMARKS,
        'total_services': SERVICE,
        'total_fee': total_bill_fee && total_bill_fee.replace(/[, .]/g, ''), // By default last 2 digit is piase or cent hence removing decimal 
        'total_non_residence': NONRESIDENCE
    };
};

module.exports = processResults;
