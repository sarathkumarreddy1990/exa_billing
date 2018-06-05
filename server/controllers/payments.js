const data = require('../data/payments');

module.exports = {

    getPayments: function (params) {
        return params && params.id ? data.getPayment(params) : data.getPayments();
    },

    createOrUPdatePayment: function (params) {
        return data.createOrUPdatePayment(params);
    }
};
