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
        let auditDetails = {
            company_id: params.companyId,
            screen_name: params.screenName,
            module_name: params.moduleName,
            client_ip: params.clientIp,
            user_id: parseInt(params.userId)
        };
        
        params.auditDetails = auditDetails;
        return data.deletePayment(params);
    },

    createOrUpdatePaymentapplications: async function (args) {
        let { paymentStatus } = args;
        let auditDetails = {
            company_id: args.companyId,
            screen_name: args.screenName,
            module_name: args.moduleName,
            client_ip: args.clientIp,
            user_id: parseInt(args.user_id)
        };

        if (paymentStatus == 'pending') {
            return pendingApplications(args);
        }

        if (paymentStatus == 'applied') {
            return appliedApplications(args);
        }

        async function pendingApplications(params) {

            let coPaycoInsDeductdetails = [];
            let claimCommentDetails = {};
            let { user_id, coPay, coInsurance, deductible, claimId } = params;

            if (coInsurance > 0) {
                coPaycoInsDeductdetails.push({
                    claim_id: claimId,
                    note: 'Co-Insurance of ' + coInsurance + ' is due',
                    type: 'co_insurance',
                    created_by: user_id
                });

                claimCommentDetails.coInsurance = coInsurance; 
            }

            if (coPay > 0) {
                coPaycoInsDeductdetails.push({
                    claim_id: claimId,
                    note: 'Co-Pay of ' + coPay + ' is due',
                    type: 'co_pay',
                    created_by: user_id
                });

                claimCommentDetails.coPay = coPay; 
            }

            if (deductible > 0) {
                coPaycoInsDeductdetails.push({
                    claim_id: claimId,
                    note: 'Deductible of ' + deductible + ' is due',
                    type: 'deductible',
                    created_by: user_id
                });

                claimCommentDetails.deductible = deductible; 
            }

            params.coPaycoInsDeductdetails = coPaycoInsDeductdetails;
            params.auditDetails = auditDetails;
            params.claimCommentDetails = claimCommentDetails;

            return await data.createPaymentapplications(params);

        }

        async function appliedApplications(params) {
            let claimCommentDetails = {};
            let updateAppliedPayments = [];
            let coPaycoInsDeductdetails = [];
            let { paymentId, line_items, user_id, coPay, coInsurance, deductible, claimId, adjustmentId } = params;
            line_items = JSON.parse(line_items);
            const save_cas_details = [];

            _.each(line_items, function (value) {

                updateAppliedPayments.push({
                    payment_application_id: value.paymentApplicationId,
                    payment_id: paymentId,
                    charge_id: value.charge_id,
                    amount: value.payment || 0.00,
                    adjustment_id: null,
                    parent_application_id: null,
                    parent_applied_dt: null
                });

                updateAppliedPayments.push({
                    payment_application_id: value.adjustmentApplicationId || null,
                    payment_id: paymentId,
                    charge_id: value.charge_id,
                    amount: value.adjustment || 0.00,
                    adjustment_id: adjustmentId || null,
                    parent_application_id:value.paymentApplicationId, 
                    parent_applied_dt:value.paymentAppliedDt 
                });


                _.each(value.cas_details, function (details) {
                    save_cas_details.push({
                        payment_application_id: value.adjustmentApplicationId != '' ? value.adjustmentApplicationId : null,
                        parent_application_id: value.adjustmentApplicationId == '' ? value.paymentApplicationId : null,
                        group_code_id : details.group_code_id,
                        reason_code_id : details.reason_code_id,
                        amount : details.amount,
                        cas_id : details.cas_id || null
                    });
                });

            });

            if (coInsurance > 0) {
                coPaycoInsDeductdetails.push({
                    claim_id: claimId,
                    note: 'Co-Insurance of ' + coInsurance + ' is due',
                    type: 'co_insurance',
                    created_by: user_id
                });

                claimCommentDetails.coInsurance = coInsurance; 
            }

            if (coPay > 0) {
                coPaycoInsDeductdetails.push({
                    claim_id: claimId,
                    note: 'Co-Pay of ' + coPay + ' is due',
                    type: 'co_pay',
                    created_by: user_id
                });

                claimCommentDetails.coPay = coPay; 
            }

            if (deductible > 0) {
                coPaycoInsDeductdetails.push({
                    claim_id: claimId,
                    note: 'Deductible of ' + deductible + ' is due',
                    type: 'deductible',
                    created_by: user_id
                });

                claimCommentDetails.deductible = deductible; 
            }

            params.coPaycoInsDeductdetails = coPaycoInsDeductdetails;
            params.updateAppliedPayments = updateAppliedPayments;
            params.save_cas_details = save_cas_details;
            params.claimCommentDetails = claimCommentDetails;
            return await data.updatePaymentApplication(params);
        }

    }

};
