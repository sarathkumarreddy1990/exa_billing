const data = require('../../data/payments/payments');
const eraData = require('../../data/era/index');
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

    },
    
    getAppliedAmount: function (paymentId) {
        return data.getAppliedAmount(paymentId);
    },

    getInvoiceDetails: async function (params) {
        
        let claimIds = [];
        let flag = true;
        let result = [];
        let totalPaymentAmount = 0;

        let claimCharges = await data.getInvoiceDetails(params);

        claimCharges = claimCharges.rows.length ? claimCharges.rows : [];
        let paymentAmount = claimCharges[0].payment_balance_total || 0;
        let totalClaim = claimCharges[0].total_claims || 0;

        _.each(claimCharges, function (item) {

            let claimNumber = parseInt(item.claim_id);

            if (!_.includes(claimIds, claimNumber) && !flag) {
                return false;
            }

            if ((totalPaymentAmount < paymentAmount) || _.includes(claimIds, claimNumber)) {

                if (!_.includes(claimIds, claimNumber)) {
                    claimIds.push(parseInt(item.claim_id));
                }

                if ((totalPaymentAmount + parseInt(item.balance)) <= paymentAmount) {
                    totalPaymentAmount += parseInt(item.balance);
                } else {
                    item.balance = paymentAmount - totalPaymentAmount;
                    totalPaymentAmount += item.balance;
                    flag = false;
                }
            }
        });

        result.push({
            total_claims: totalClaim,
            valid_claims: claimIds.length
        });

        return result;
    },

    createInvoicePaymentapplications: async function (params) {
        
        let auditDetails = {
            company_id: params.companyId,
            screen_name: params.screenName,
            module_name: params.moduleName,
            client_ip: params.clientIp,
            user_id: parseInt(params.userId)
        };
        let paymentDetails ={};
        let claimIds = [];
        let flag = true;
        let lineItems = [];
        let totalPaymentAmount = 0;

        let claimCharges =  await data.getClaimCharges(params);
       
        claimCharges = claimCharges.rows.length ? claimCharges.rows : [];
        let paymentAmount = claimCharges[0].payment_balance_total || 0;
        
        _.each(claimCharges, function (item) {

            let claimNumber = parseInt(item.claim_id);
            
            if (!_.includes(claimIds, claimNumber) && !flag) {
                return false;
            } 

            if ((totalPaymentAmount < paymentAmount) || _.includes(claimIds, claimNumber) ) {

                if (!_.includes(claimIds, claimNumber)){
                    claimIds.push(parseInt(item.claim_id));
                }

                if ((totalPaymentAmount + parseInt(item.balance)) <= paymentAmount) {
                    totalPaymentAmount += parseInt(item.balance);
                } else {
                    item.balance = paymentAmount - totalPaymentAmount;
                    totalPaymentAmount += item.balance;
                    flag = false;
                }

                lineItems.push({
                    payment: parseInt(item.balance),
                    adjustment: 0.00,
                    cpt_code: item.cpt_code,
                    claim_number: item.claim_id,
                    original_reference: null,
                    claim_status_code: 0,
                    cas_details: [],
                    charge_id: item.charge_id,
                    patient_fname: item.patient_fname || '',
                    patient_lname: item.patient_lname || '',
                    patient_mname: item.patient_mname || '',
                    patient_prefix: item.patient_prefix || '',
                    patient_suffix: item.patient_suffix || ''
                });
            }
        });
 
        params.lineItems = lineItems;
        params.claimComments = [];
        params.audit_details = auditDetails;
        paymentDetails.id = params.paymentId;
        paymentDetails.code = null;
        paymentDetails.isFrom = 'PAYMENT';
        paymentDetails.created_by = parseInt(params.userId);
        paymentDetails.company_id = parseInt(params.companyId);
        paymentDetails.uploaded_file_name = ''; // Assign empty for ERA argument
        
        let result = await eraData.createPaymentApplication(params, paymentDetails);

        return result;
    }

};

