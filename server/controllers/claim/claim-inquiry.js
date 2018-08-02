const data = require('../../data/claim/claim-inquiry');

module.exports = {
    getData: (params) => {
        return data.getData(params);
    },

    getClaimComments: (params) => {
        params.claim_id = params.customArgs.claim_id;
        return data.getClaimComments(params);
    },

    getClaimComment: (params) => {
        return data.getClaimComment(params);
    },

    saveClaimComment: (params) => {
        return data.saveClaimComment(params);
    },

    deleteClaimComment: (params) => {
        return data.deleteClaimComment(params);
    },

    updateClaimComment: (params) => {
        return data.updateClaimComment(params);
    },

    getFollowupDate: (params) => {
        return data.getFollowupDate(params);
    },

    viewPaymentDetails: (params) => {
        return data.viewPaymentDetails(params);
    },

    viewChargePaymentDetails: (params) => {
        return data.viewChargePaymentDetails(params);
    },

    getclaimPatient: (params) => {
        return data.getclaimPatient(params);
    },

    getInvoicePayments: (params) => {
        return data.getInvoicePayments(params);
    },

    getInvoicePaymentsAge: (params) => {
        return data.getInvoicePaymentsAge(params);
    },

    getclaimPatientLog: (params) => {
        return data.getclaimPatientLog(params);
    }
};
