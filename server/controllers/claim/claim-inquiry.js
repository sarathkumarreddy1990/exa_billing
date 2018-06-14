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

    saveFollowUpDate: (params) => {
        return data.saveFollowUpDate(params);
    },

    getFollowupDate: (params) => {
        return data.getFollowupDate(params);
    },

    updateBillingNotes: (params) => {
        return data.updateBillingNotes(params);
    },

    viewPaymentDetails: (params) => {
        return data.viewPaymentDetails(params); 
    },

    viewChargePaymentDetails: (params) => {
        return data.viewChargePaymentDetails(params); 
    }
};
