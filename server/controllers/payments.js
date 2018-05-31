const data = require('../data/payments');

module.exports = {

    getPayments: function (params) {
        return params && params.id ? data.getPayment(params) : data.getPayments();
    },

    updatePayment: function (params) {
        if (parseInt(params.amount) == parseInt(params.applied)) {
            params.current_status = 'Applied';
        }
        else if (parseInt(params.applied) == 0) {
            params.current_status = 'UnApplied';
        }
        else if (parseInt(params.amount) > parseInt(params.applied)) {
            params.current_status = 'PartialApplied';
        }
        else if (parseInt(params.amount) < parseInt(params.applied)) {
            params.current_status = 'OverApplied';
        }
        return data.updatePayment(params);
    }
};
