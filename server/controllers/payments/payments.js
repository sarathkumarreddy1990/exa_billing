const data = require('../../data/payments/payments');
const _ = require('lodash');

module.exports = {

    getPayments: function (params) {
        return params && params.id ? data.getPayment(params) : data.getPayments(params);
    },

    createOrUpdatePayment: function (params) {
        return data.createOrUpdatePayment(params);
    },

    deletePayment: function (params) {
        return data.deletePayment(params);
    },

    createOrUpdatePaymentapplications: function (args) {
        let { paymentStatus } = args;

        if (paymentStatus == 'pending') {
            pendingApplications(args);
        }

        if (paymentStatus == 'applied') {
            appliedApplications(args);
        }

        async function pendingApplications(params) {

            let appliedPaymets = [];
            let coPaycoInsDeductdetails = [];
            let { paymentId, line_items, user_id, coPay, coInsurance, deductible, claimId, adjestmentId } = params;
            line_items = JSON.parse(line_items);
            const save_cas_details = [];


            _.each(line_items, function (value) {

                appliedPaymets.push({
                    payment_id: paymentId,
                    charge_id: value.chargeId,
                    payment_amount: value.payment == null ? 0.00 : value.payment,
                    adjustment_amount: value.adjustment == null ? 0.00 : value.adjustment,
                    adjestment_id: adjestmentId,
                    created_by: user_id
                });

            });

            if (coInsurance > 0) {
                coPaycoInsDeductdetails.push({
                    claim_id: claimId,
                    note: 'Co-Insurance of ' + coInsurance + ' is due',
                    type: 'co_insurance',
                    created_by: user_id
                });
            }

            if (coPay > 0) {
                coPaycoInsDeductdetails.push({
                    claim_id: claimId,
                    note: 'Co-Pay of ' + coPay + ' is due',
                    type: 'co_pay',
                    created_by: user_id
                });
            }

            if (deductible > 0) {
                coPaycoInsDeductdetails.push({
                    claim_id: claimId,
                    note: 'Deductible of ' + deductible + ' is due',
                    type: 'deductible',
                    created_by: user_id
                });
            }

            params.coPaycoInsDeductdetails = coPaycoInsDeductdetails;
            params.appliedPaymets = appliedPaymets;

            const appliedValues = await data.createPaymentapplications(params);

            for (const value of line_items) {
                for (const application_ids of appliedValues.rows) {
                    if (value.chargeId == application_ids.charge_id && application_ids.amount_type == 'adjustment') {
                        _.each(value.cas_details, function (details) {
                            if (details.amount != 0) {
                                let casDetails = {
                                    application_id: application_ids.application_id,
                                    group_code: details.group_code_id,
                                    reason_code: details.reason_code_id,
                                    amount: details.amount
                                };
                                save_cas_details.push(data.saveCasDetails(casDetails));
                            }
                        });


                    }
                }
            }

            return await Promise.all(save_cas_details);
        }

        async function appliedApplications(params) {

            let updateAppliedPayments = [];
            let coPaycoInsDeductdetails = [];
            let { paymentId, line_items, user_id, coPay, coInsurance, deductible, claimId, adjestmentId } = params;
            line_items = JSON.parse(line_items);
            // const save_cas_details = [];

            _.each(line_items, function (value) {

                updateAppliedPayments.push({
                    payment_application_id: value.paymentApplicationId,
                    payment_id: paymentId,
                    charge_id: value.chargeId,
                    amount: value.payment == null ? 0.00 : value.payment,
                    adjestment_id: null
                });

                updateAppliedPayments.push({
                    payment_application_id: value.adjustmentApplicationId,
                    payment_id: paymentId,
                    charge_id: value.chargeId,
                    amount: value.adjustment == null ? 0.00 : value.adjustment,
                    adjestment_id: adjestmentId
                });

            });

            if (coInsurance > 0) {
                coPaycoInsDeductdetails.push({
                    claim_id: claimId,
                    note: 'Co-Insurance of ' + coInsurance + ' is due',
                    type: 'co_insurance',
                    created_by: user_id
                });
            }

            if (coPay > 0) {
                coPaycoInsDeductdetails.push({
                    claim_id: claimId,
                    note: 'Co-Pay of ' + coPay + ' is due',
                    type: 'co_pay',
                    created_by: user_id
                });
            }

            if (deductible > 0) {
                coPaycoInsDeductdetails.push({
                    claim_id: claimId,
                    note: 'Deductible of ' + deductible + ' is due',
                    type: 'deductible',
                    created_by: user_id
                });
            }

            params.coPaycoInsDeductdetails = coPaycoInsDeductdetails;
            params.updateAppliedPayments = updateAppliedPayments;

            return await data.updatePaymentApplication(params);
        }

    }

};
