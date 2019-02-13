const data = require('../../data/era/index');
const paymentController = require('../payments/payments');
const logger = require('../../../logger');
const shared = require('../../shared');

const mkdirp = require('mkdirp');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { promisify } = require('util');
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);

let auditDetails = {
    screen_name: 'ERA',
    module_name: 'era',
    client_ip: '127.0.0.1',
    entity_name: 'ERA',
}

module.exports = {

    processOHIPEraFile: async function (era_json, params) {
        const self = this;

        //ToDo:: Get parsed era file info
        // const era_json = {};

        try {

            logger.info(`Initializing payment creation with OHIP file`);
            params.screenName = auditDetails.screen_name;
            params.moduleName = auditDetails.module_name;
            params.entityName = auditDetails.screen_name;
            params.entity_name = auditDetails.screen_name;
            let paymentDetails = await self.createPayment(era_json, params);
            paymentDetails.isFrom = 'OHIP_EOB';
            params.created_by = paymentDetails.created_by || 1;
            params.company_id = paymentDetails.company_id || 1;
            let lineItemsAndClaimLists = await self.getOHIPLineItemsAndClaims(era_json, params);
            let processedClaims = await data.createPaymentApplication(lineItemsAndClaimLists, paymentDetails);

            // again we call to create payment application for unapplied charges form ERA claims
            await data.applyPaymentApplication(lineItemsAndClaimLists.audit_details, paymentDetails);

            await data.updateERAFileStatus(paymentDetails);

            logger.info(`Payment creation process done - OHIP`);

            return processedClaims;

        } catch (err) {
            logger.error(err);

            return err;
        }

    },

    getOHIPLineItemsAndClaims: async (ohipJson, params) => {

        let lineItems = [];
        ohipJson.claims.forEach((claim, claim_index) => {
            if (claim.claimNumber && !isNaN(claim.claimNumber)) {
                claim.items.forEach((serviceLine) => {

                    let index = 1;
                    let duplicate_flag = false;
                    let amountPaid = serviceLine.amountPaid ? Math.round(serviceLine.amountPaid * 100) / 10000 : 0.00; //

                    //DESC : Formatting lineItems (Added sequence index and flag:true ) if duplicate cpt code came
                    let duplicateObj = _.findLast(lineItems, {
                        claim_number: serviceLine.claimNumber,
                        cpt_code: serviceLine.serviceCode,
                        claim_index: claim_index
                    });

                    if (duplicateObj) {
                        index = duplicateObj.index && duplicateObj.index ? duplicateObj.index + 1 : 1;
                        duplicate_flag = true;

                        if (!duplicateObj.duplicate) {
                            duplicateObj.duplicate = true;
                        }
                    }

                    // Condition check ERA file payment/Adjustment sign is postive/negative to mark credit/debit payments
                    let isDebit = false;
                    let adjustment_code = 'ERA';

                    if (serviceLine.amountPaidSign && serviceLine.amountPaidSign === '-') {
                        isDebit = true;
                        adjustment_code = 'ERAREC';
                    }

                    let item = {
                        claim_number: serviceLine.claimNumber,
                        cpt_code: serviceLine.serviceCode,
                        payment: amountPaid || 0.00,
                        adjustment: 0.00,
                        cas_details: [],
                        charge_id: 0,
                        service_date: serviceLine.serviceDate || null,
                        patient_fname: claim.patientFirstName || '',
                        patient_lname: claim.patientLastName || '',
                        patient_mname: claim.patientMiddleName || '',
                        patient_prefix: claim.patientPrefix || '',
                        patient_suffix: claim.patientSuffix || '',
                        index: index,
                        duplicate: duplicate_flag,
                        is_debit: isDebit,
                        code: adjustment_code,
                        claim_index: claim_index
                    };

                    lineItems.push(item);
                });
            }
        });

        return {
            lineItems: lineItems,
            claimComments: [],
            audit_details: auditDetails
        };

    },

    createPayment: async function (eraObject, params) {
        let paymentResult;
        let payerDetails = {};
        let totalAmountPayable = eraObject.totalAmountPayable ? Math.round(eraObject.totalAmountPayable * 100) / 10000 : 0.00;
        let notes = 'Amount shown in EOB:$' + totalAmountPayable;
        payerDetails.paymentId = null;
        payerDetails.company_id = params.company_id || 1;
        payerDetails.user_id = params.user_id || 1;
        payerDetails.facility_id = params.facility_id || 1;
        payerDetails.created_by = params.created_by || 1;
        payerDetails.patient_id = null;
        payerDetails.insurance_provider_id = params.insurance_provider_id || 1;  // ToDo:: params from UI
        payerDetails.provider_group_id = null;
        payerDetails.provider_contact_id = null;
        payerDetails.payment_reason_id = null;
        payerDetails.amount = 0;
        payerDetails.accounting_date = eraObject.paymentDate || 'now()';
        payerDetails.invoice_no = '';
        payerDetails.display_id = null;  // alternate_payment_id
        payerDetails.payer_type = 'insurance';
        payerDetails.notes = notes;
        payerDetails.payment_mode = 'eft';
        payerDetails.credit_card_name = null;
        payerDetails.credit_card_number = eraObject.chequeNumber || null; // card_number
        payerDetails.clientIp = params.clientIp;
        payerDetails.screenName = params.screenName;
        payerDetails.moduleName = params.moduleName;

        payerDetails.logDescription = 'Payment created via ERA';
        payerDetails.isERAPayment = true;
        payerDetails.file_id = params.file_id || 0; // ToDo:: uploaded ERA file id


        try {

            await paymentController.createOrUpdatePayment(payerDetails);
            paymentResult = await paymentController.createOrUpdatePayment(payerDetails);
            paymentResult = paymentResult && paymentResult.rows && paymentResult.rows.length ? paymentResult.rows[0] : {};
            paymentResult.file_id =  payerDetails.file_id; // imported ERA file id
            paymentResult.created_by = payerDetails.created_by;
            paymentResult.company_id = payerDetails.company_id;
            paymentResult.uploaded_file_name =  'Canada_ERA.txt';
            paymentResult.payer_type = payerDetails.payer_type;
            paymentResult.messageText = eraObject.messageText || '';
            paymentResult.code = 'ERA';

            await data.createEdiPayment(paymentResult);

        } catch (err) {

            throw err;
        }

        return paymentResult;
    }

}
