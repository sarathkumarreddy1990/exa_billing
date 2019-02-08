const { query, SQL } = require('./../index');
const fs = require('fs');

// TODO get rid of these
const JSONExtractor = require('.//jsonExtractor');
const data = require('./data.json');

const OHIPDataAPI = {

    auditTransaction: (info) => {
        console.log(info);
        /* Sample input info object:
        {
            transactionID:              // TODO need clarification from MoH
            serviceUser:                // MoH User ID
            endUserID:                  // TODO need clarification from MoH
            dateTime: Date,             // date and time of the transaction
            duration: Number,           // milliseconds
            action: String              // "upload"/"download" etc
            eventDetail: String,        // TODO need clarification from MoH
            Simple success or failure   // "success" or "failure"
            exitStatus: Number,         // STD001
            messages: Array             // array of strings
            errorMessages: Array        // array of strings
        }
        */
    },

    getClaimData: (claimIds) => {
        // TODO, run a query to get the claim data
        // use synchronous call to query ('await query(...)')
        return new JSONExtractor(data).getMappedData();
    },

    handlePayment: (payment) => {
        /* Sample input payment object:
        {
            paymentDate: Date,
            totalAmountPayable: Number,
            chequeNumber: String,
        }

        Sample return value:
        {
            paymentId: Number
        }
        */
    },

    handleBalanceForward: (balanceForward) => {
        /* Sample input balanceForward object
        {
            claimsAdjustment: Number,
            advances: Number,
            reductions: Number,
            deductions: Number,
        }
        */
    },



    handleAccountingTransaction: (accountingTransaction) => {
        /* Sample input accountingTransaction object
        {
            transactionCode: String,
            chequeNumber: String,
            transactionDate: Date
            transactionAmount: Number,
            transactionMessage: String
        }

        */
    },

    handleMessage: (message) => {
        // message is just a String
    },


    handleInputClaimSubmissionFile: (fileDescriptor) => {
    },

    handleRemittanceAdviceFile: (fileDescriptor) => {

    },
    handleGovernanceReportFile: (fileDescriptor) => {

    },
    handleClaimFileRejectMessageFile: (fileDescriptor) => {

    },
    handleBatchEditReportFile: (fileDescriptor) => {
        // console.log("Hello, from Billing API:", fileDescriptor);
        
    },
    handleClaimsErrorReportFile: (fileDescriptor) => {

    },

};

module.exports = OHIPDataAPI;
