const data = require('../data/payments');

module.exports = {

    getPayments: function (params) {
        return params && params.id ? data.getPayment(params) : data.getPayments();
    },

    createOrUpdatePayment: function (params) {
        return data.createOrUpdatePayment(params);
    }
};
