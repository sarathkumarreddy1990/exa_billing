const data = require('../data/edit-payments');

module.exports = {
    getpendingPayments: function (params) {
        return data.getpendingPayments(params);
    }
};
