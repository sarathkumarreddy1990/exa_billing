const data = require('../data/payments');
const _ = require('lodash');

module.exports = {

    getPayments: function (params) {
        return params && params.id ? data.getPayment(params) : data.getPayments(params);
    },

    createOrUpdatePayment: function (params) {
        return data.createOrUpdatePayment(params);
    },

    createPaymentapplications: function (params) {
        let appliedPaymets = [];
        let { paymentId, line_items, user_id } = params;
        line_items = JSON.parse(line_items);

        _.each(line_items, function (value) {
            if (value.payment > 0) {
                appliedPaymets.push({
                    payment_id: paymentId,
                    charge_id: value.chargeId,
                    amount: value.payment,
                    amount_type: 'payment',
                    created_by: user_id
                });
            }

            if (value.payment > 0) {
                appliedPaymets.push({
                    payment_id: paymentId,
                    charge_id: value.chargeId,
                    amount: value.payment,
                    amount_type: 'adjustment',
                    created_by: user_id
                });
            }

        });

        params.appliedPaymets = appliedPaymets;
        return data.createPaymentapplications(params);
    }

};
