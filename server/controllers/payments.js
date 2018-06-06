const data = require('../data/payments');
const _ = require('lodash');

module.exports = {

    getPayments: function (params) {
        return params && params.id ? data.getPayment(params) : data.getPayments();
    },

    createOrUpdatePayment: function (params) {
        return data.createOrUpdatePayment(params);
    },

    createPaymentapplications: function (params) {
        let appliedPaymets = [];
        let coPaycoInsDeductdetails = [];
        let { paymentId, line_items, user_id, coPay, coInsurance, deductible, claimId } = params;
        line_items = JSON.parse(line_items);

        _.each(line_items, function (value) {
            if (value.payment != 0) {
                appliedPaymets.push({
                    payment_id: paymentId,
                    charge_id: value.chargeId,
                    amount: value.payment,
                    amount_type: 'payment',
                    created_by: user_id
                });
            }

            if (value.payment != 0) {
                appliedPaymets.push({
                    payment_id: paymentId,
                    charge_id: value.chargeId,
                    amount: value.adjustment,
                    amount_type: 'adjustment',
                    created_by: user_id
                });
            }

        });

        if (coInsurance > 0) {
            coPaycoInsDeductdetails.push({
                claim_id: claimId,
                note: 'Co-Insurance of'+ coInsurance +'is due',
                type: 'co_insurance',
                created_by: user_id
            });
        }

        if (coPay > 0) {
            coPaycoInsDeductdetails.push({
                claim_id: claimId,
                note: 'Co-Pay of'+ coPay +'is due',
                type: 'co_pay',
                created_by: user_id
            });
        }

        if (deductible > 0) {
            coPaycoInsDeductdetails.push({
                claim_id: claimId,
                note: 'Deductible of'+ deductible +'is due',
                type: 'deductible',
                created_by: user_id
            });
        }

        params.coPaycoInsDeductdetails = coPaycoInsDeductdetails;
        params.appliedPaymets = appliedPaymets;
        return data.createPaymentapplications(params);
    }

};
