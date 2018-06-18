const data = require('../../data/payments/edit-payments');

module.exports = {
    getPendingPayments: function (params) {
        return params.customArgs.gridFlag == 'pendingPayments' ? data.getPendingPayments(params) : data.getAppliedPayments(params);
    },

    getClaimBasedCharges: function (params) {
        return data.getClaimBasedCharges(params);
    },

    getGroupCodesAndReasonCodes: function (params) {
        return data.getGroupCodesAndReasonCodes(params);
    },

    getPayemntApplications: function (params) {
        return data.getPayemntApplications(params);
    },

    getAllPatients: function (params) {
        return data.getAll(params);
    },

    getTotalPatients: function (params) {
        return data.getTotalPatients(params);
    }
};
