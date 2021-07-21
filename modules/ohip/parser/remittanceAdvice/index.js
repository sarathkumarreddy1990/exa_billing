const {
    parseRecord,
    getOrCreateArray
} = require('../utils');

const accountingTransactionFields = require('./accountingTransactionFields');
const addressOneFields = require('./addressOneFields');
const addressTwoFields = require('./addressTwoFields');
const balanceForwardFields = require('./balanceForwardFields');
const claimHeaderFields = require('./claimHeaderFields');
const claimItemFields = require('./claimItemFields');
const fileHeaderFields = require('./fileHeaderFields');
const messageFacilityFields = require('./messageFacilityFields');

const RemittanceAdviceParser = function(options) {

    this.options = options || {};

    let remittanceAdvice = null;
    let currentClaim = null;

    const parsersByRecordType = {

        // creates a new Remittance Advice
        [fileHeaderFields.recordType.constant]: (recordStr) => {
            // NOTE this method changes the state of the parser
            remittanceAdvice = parseRecord(recordStr, fileHeaderFields);
        },

        // sets the addressOne property of the Remittance Advice
        [addressOneFields.recordType.constant]: (recordStr) => {
            remittanceAdvice.addressOne = parseRecord(recordStr, addressOneFields);
        },

        // sets the addressTwo property of the Remittance Advice
        [addressTwoFields.recordType.constant]: (recordStr) => {
            remittanceAdvice.addressTwo = parseRecord(recordStr, addressTwoFields);
        },

        // add a new Claim to the Remittance Advice
        [claimHeaderFields.recordType.constant]: (recordStr) => {
            // NOTE this method changes the state of the parser
            // by starting a new Claim context for Claim Item records
            currentClaim = parseRecord(recordStr, claimHeaderFields);
            getOrCreateArray(remittanceAdvice, 'claims').push(currentClaim);
        },

        // add a new Claim Item to the current Claim context
        [claimItemFields.recordType.constant]: (recordStr) => {
            let claimItem = parseRecord(recordStr, claimItemFields);
            getOrCreateArray(currentClaim, 'items').push(claimItem);
        },

        // set the balanceForward property of the Remittance Advice
        [balanceForwardFields.recordType.constant]: (recordStr) => {
            remittanceAdvice.balanceForward = parseRecord(recordStr, balanceForwardFields);
        },

        // adds an Accounting Transaction to the Remittance Advice
        [accountingTransactionFields.recordType.constant]: (recordStr) => {
            let accountingTransaction = parseRecord(recordStr, accountingTransactionFields);
            getOrCreateArray(remittanceAdvice, 'accountingTransactions').push(accountingTransaction);
        },

        // appends the message facility message to the messageText property
        // of the Remittance Advice
        [messageFacilityFields.recordType.constant]: (recordStr) => {
            let messageFacility = parseRecord(recordStr, messageFacilityFields);
            remittanceAdvice.messageText = (remittanceAdvice.messageText || '') + messageFacility.messageText;
        }
    };

    return {

        parse: (dataStr) => {

            const records = dataStr.split('\n');

            records.forEach((recordStr) => {

                let recordType = recordStr.charAt(2);
                let parser = parsersByRecordType[recordType];

                if (parser) {
                    parser(recordStr);
                }
                else {
                    // TODO remove this branch
                    console.log(`could not figure out fields for record type '${recordType}'`);
                }
            });
            return remittanceAdvice;
        },
    };
};

module.exports = RemittanceAdviceParser;
