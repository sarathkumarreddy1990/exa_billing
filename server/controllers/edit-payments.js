const data = require('../data/edit-payments');

module.exports = {
    getPendingPayments: function (params) {
        return params.customArgs.gridFlag == 'pendingPayments' ? data.getPendingPayments(params) : data.getAppliedPayments(params);
    },

    getClaimBasedCharges: function (params) {
        return data.getClaimBasedCharges(params);
    },

    getGroupCodesAndReasonCodes: function (params) {
        return data.getGroupCodesAndReasonCodes(params);
    }
};
