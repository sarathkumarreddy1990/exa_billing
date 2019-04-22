const {
    getValue,
} = require('../fields');

const fixedPaymentFields = require('./fixedPaymentFields');
const conversionDetailFields = require('./conversionDetailFields');
const totalConversionPaymentFields = require('./totalConversionPaymentFields');
const totalPaymentFields = require('./totalPaymentFields');

const GenericGovernanceReport = function(options) {

    this.options = options || {};

    const parseGovernanceFixedPayment = (recordStr) => {
        
    };

    const parseConversionDetail = (recordStr) => {
        const parseObj = {};
        // NOTE it's okay to do a 'for-in' here, for now
        for (field in conversionDetailFields) {
            parseObj[field] = getValue(conversionDetailFields[field], recordStr);
        }
        return parseObj;
    };

    const parseTotalConversionPayment = (recordStr) => {
        const parseObj = {};
        // NOTE it's okay to do a 'for-in' here, for now
        for (field in totalConversionPaymentFields) {
            parseObj[field] = getValue(totalConversionPaymentFields[field], recordStr);
        }
        return parseObj;
    };

    const parseTotalPayment = (recordStr) => {
        const parseObj = {};
        // NOTE it's okay to do a 'for-in' here, for now
        for (field in conversionPaymentFields) {
            parseObj[field] = getValue(conversionPaymentFields[field], recordStr);
        }
        return parseObj;
    };



    return {
        parse: (dataStr) => {
            const records = dataStr.split('\n');
            return {
                // the Claim File Reject Message is very simple:
                // there is one of each type of record per message
                governanceFixedPayment: parseGovernanceFixedPayment(records[0]),
            };
        },
    };
};

module.exports = GenericGovernanceReport;
