const data = require('../../data/era/index');
const ohipData = require('../ohip');
const paymentController = require('../payments/payments');
const logger = require('../../../logger');
const _ = require('lodash');


module.exports = {

    processOHIPEraFile: async function (payment_data, params) {
        const self = this;
        const edi_file_id = params.edi_files_id || 0;

        try {

            logger.info('Initializing payment apply process with OHIP file');
            let default_payer = await data.getDefaultPayer();
            const startTime = new Date().getTime();

            if (!default_payer.rows.length){
                return {
                    status: '23156',
                    message: 'Default Payer Not available'
                };
            }

            params.insurance_provider_id = default_payer.rows[0].insurance_provider_id;

            logger.info(`Payment creation process started for edi file ${edi_file_id} - OHIP`);

            params.created_by = params.userId || 1;
            params.company_id = params.companyId || 1;

            let paymentDetails = await self.createPayment(payment_data, params);

            logger.info(`Payment creation process ended for edi file ${edi_file_id} - OHIP`);

            logger.info(`Grouping claim process for edi file ${edi_file_id} started - OHIP`);
            let lineItemsAndClaimLists = await self.getOHIPLineItemsAndClaims(payment_data.ra_json, params);
            logger.info(`Grouping claim process for edi file ${edi_file_id} ended - OHIP`);

            logger.info(`Creating charges for legacy claims for edi file ${edi_file_id} - started`);
            await ohipData.createLegacyClaimCharge(lineItemsAndClaimLists, paymentDetails);
            logger.info(`Creating charges for legacy claims for edi file ${edi_file_id} - ended`);

            logger.info(`Applying claim process started for edi file ${edi_file_id} - OHIP`);
            let processedClaims = await ohipData.createPaymentApplication(lineItemsAndClaimLists, paymentDetails);
            logger.info(`Applying claim process ended for edi file ${edi_file_id} - OHIP`);

            logger.info(`create payment application for unapplied charges for edi file ${edi_file_id} - started`);
            await ohipData.applyPaymentApplication(lineItemsAndClaimLists.audit_details, paymentDetails);
            logger.info(`create payment application for unapplied charges for edi file ${edi_file_id} - ended`);


            logger.info(`updating era file status started for edi file ${edi_file_id} - OHIP`);
            await ohipData.updateERAFileStatus(paymentDetails);
            logger.info(`updating era file status ended for edi file ${edi_file_id} - OHIP`);

            const endTime = new Date().getTime();

            logger.info('Payment apply process done - OHIP');
            logger.info(`Time taken for OHIP Payment creation: ${endTime - startTime}ms`);

            return processedClaims;

        } catch (err) {
            logger.error(err);

            return err;
        }

    },

    getOHIPLineItemsAndClaims: async (ohipJson, params) => {

        let lineItems = [];
        let claimComments = [];
        let cas_reason_group_details = await data.getcasReasonGroupCodes(params);
        cas_reason_group_details = cas_reason_group_details.rows && cas_reason_group_details.rows.length ? cas_reason_group_details.rows[0] : {};

        ohipJson.claims && ohipJson.claims.forEach((claim, claim_index) => {
            if (claim.accountingNumber) {
                let isExaClaim = /^\d+$/.test(claim.accountingNumber);

                claim.items.forEach((serviceLine) => {

                    let index = 1;
                    let duplicate_flag = false;
                    let amountPaid = serviceLine.amountPaid ? Math.round(serviceLine.amountPaid * 100) / 10000 : 0.00; //

                    //DESC : Formatting lineItems (Added sequence index and flag:true ) if duplicate cpt code came
                    let duplicateObj = _.findLast(lineItems, {
                        claim_number: claim.accountingNumber,
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

                    let groupCode = _.find(cas_reason_group_details.cas_group_codes, { code: 'OHIP_EOB' });
                    let reasonCode = _.find(cas_reason_group_details.cas_reason_codes, { code: serviceLine.explanatoryCode });
                    let cas_details = [];

                    if (serviceLine.explanatoryCode && groupCode && reasonCode) {
                        cas_details.push({
                            group_code_id: groupCode.id,
                            reason_code_id: reasonCode.id,
                            amount: 0
                        });
                    }

                    amountPaid = isDebit && (amountPaid * -1) || amountPaid;

                    let item = {
                        claim_number: claim.accountingNumber,
                        cpt_code: serviceLine.serviceCode,
                        denied_value: serviceLine.explanatoryCode !== '' && amountPaid === 0 ? 1 : 0, // Set 1 when cpts payment = zero and the explanatoryCode should not be empty
                        payment: amountPaid || 0.00,
                        adjustment: 0.00,
                        cas_details,
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
                        claim_index: claim_index,
                        is_exa_claim: isExaClaim,
                        original_reference: claim.claimNumber || '',
                    };

                    lineItems.push(item);
                });

                claimComments.push({
                    claim_number: claim.accountingNumber,
                    is_exa_claim: isExaClaim,
                    note: `${claim.claimNumber} - Payment received via MCEDT-EBS`,
                    type: 'auto'
                });
            }
        });

        let auditDetails = {
            screen_name: params.screenName || 'Payments',
            module_name: params.moduleName || 'era',
            entity_name: params.entityName || 'Payments',
            client_ip: params.clientIp || '127.0.0.1',
            company_id: params.companyId || 1,
            user_id: params.userId || 1
        };

        /**
        *  Condition : payment === 0 && explanatoryCode !==''
        *  DESC : Set claims status code = 4 (DENIED) for claim, When each Cpts payment must be zero and the explanatoryCode should not be empty
        */
        let lineItemsByGroup = _.groupBy(lineItems, 'claim_number');
        let groupedLineItems = [];

        _.map(lineItemsByGroup, (items) => {

            if (_.sumBy(items, 'denied_value') === items.length) {
                items = items.map(item => {
                    item.claim_status_code = 4;
                    return item;
                });
            }

            groupedLineItems = groupedLineItems.concat(items);

        });

        return {
            lineItems: groupedLineItems,
            claimComments,
            audit_details: auditDetails
        };

    },

    createPayment: async function (f_data, params) {

        let paymentResult = {};
        let result = {};
        let ohipPaymentResults = {};
        let eraObject = f_data.ra_json;
        let totalAmountPayable = eraObject.totalAmountPayable || 0.00;
        let notes = `File Name: ${f_data.uploaded_file_name || ''} \nAmount shown in EOB: $${totalAmountPayable}`;
        let payerDetails = {
            amount       : 0,
            notes        : notes,
            user_id      : params.user_id || 1,
            file_id      : params.edi_files_id || 0,
            clientIp     : params.clientIp || '127.0.0.1',
            payer_type   : 'insurance',
            paymentId    : params.payment_id || null,
            company_id   : params.company_id || 1,
            patient_id   : null,
            invoice_no   : '',
            display_id   : null,  // alternate_payment_id
            created_by   : params.created_by || 1,
            screenName   : params.screenName || 'Payments',
            moduleName   : params.moduleName || 'era',
            facility_id  : params.facility_id || 1,
            isERAPayment : true,
            payment_mode : 'eft',
            credit_card_name    : null,
            ordering_facility_id : null,
            provider_contact_id : null,
            payment_reason_id   : null,
            logDescription      : 'Payment created via ERA',
            accounting_date     : eraObject.paymentDate || 'now()',
            credit_card_number  : eraObject.chequeNumber || null,
            insurance_provider_id : params.insurance_provider_id,
        };

        try {

            paymentResult.file_id =  payerDetails.file_id; // imported ERA file id
            paymentResult.created_by = payerDetails.created_by;
            paymentResult.company_id = payerDetails.company_id;
            paymentResult.uploaded_file_name =  f_data.uploaded_file_name || '';
            paymentResult.payer_type = payerDetails.payer_type;
            paymentResult.messageText = eraObject.messageText || '';
            paymentResult.code = 'ERA';
            paymentResult.from = 'OHIP_EOB';

            if(params.payment_id === '' || !params.payment_id ) {
                result = await paymentController.createOrUpdatePayment(payerDetails);
                result = result && result.rows && result.rows.length ? result.rows[0] : {};

                ohipPaymentResults = {
                    ...paymentResult,
                    ...result
                };

                await data.createEdiPayment(ohipPaymentResults);
            }
            else {
                ohipPaymentResults = { ...paymentResult, ...params };
            }

            return ohipPaymentResults;

        } catch (err) {

            throw err;
        }

    }

};
