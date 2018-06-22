const data = require('../../data/era/index');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const readFile = promisify(fs.readFile);
const ediConnect = require('../../../modules/edi');
const paymentController = require('../payments/payments');
const eraParser = require('./era-parser');
const logger = require('../../../logger');

module.exports = {

    getEraFiles: function (params) {
        return data.getEraFiles(params);
    },

    processERAFile: async function (params) {
        let self = this,
            processDetails,
            eraPath,
            rootDir;
        let processDetailsArray = [];
        let message = [];

        const eraFileDir = await data.getERAFilePathById(params);

        rootDir = eraFileDir.rows && eraFileDir.rows.length && eraFileDir.rows[0].root_directory ? eraFileDir.rows[0].root_directory : '';
        eraPath = eraFileDir.rows && eraFileDir.rows.length && eraFileDir.rows[0].file_path ? eraFileDir.rows[0].file_path : '';

        eraPath = path.join(rootDir, eraPath);

        try {
            let dirExists = fs.existsSync(eraPath);

            if (!dirExists) {

                message.push({
                    status: 100,
                    message: 'Directory not found in file store'
                });

                return message;
               
            }

            eraPath = path.join(eraPath, params.file_id);

            let eraRequestText = await readFile(eraPath, 'utf8');

            ediConnect.init('http://192.168.1.102:5581/edi/api');

            let templateName = await ediConnect.getDefaultEraTemplate();
            
            if(!templateName){
                message.push({
                    status: 100,
                    message: 'ERA template not found'
                });

                return message;
            }
            
            const eraResponseJson = await ediConnect.parseEra(templateName, eraRequestText);

            if (params.status != 'applypayments') {
                processDetails = await self.checkExistInsurance(params, eraResponseJson);
                processDetailsArray.push(processDetails);
            }
            else {
                processDetails = await self.applyERAPayments(eraResponseJson, params);
                processDetailsArray.push(processDetails);
            }

            return processDetailsArray;

        } catch (err) {
            
            if (err.message && err.message == 'Invalid template name') {
                logger.error(err);

                message.push({
                    status: 100,
                    message: 'Invalid template name'
                });
            } else {
                message = err;
            }

            return message;
        }

    },

    applyERAPayments: async function (eraResponseJson, params) {
        let self = this;

        const results = [];

        for (const eraObject of eraResponseJson) {

            results.push(self.processPayments(params, eraObject));
        }

        return await Promise.all(results);

    },
    checkExistInsurance: async function (params, eraResponseJson) {

        let payerDetails = {};
        let reassociation = eraResponseJson.length ? eraResponseJson[0].reassociationTraceNumber : {};
        let payerIdentification = reassociation.originatingCompanyID ? reassociation.originatingCompanyID : '';

        const existsInsurance = await data.selectInsuranceEOB({
            payer_id: payerIdentification
            , company_id: 1
            , file_id: params.file_id
        });

        if (existsInsurance && existsInsurance.rows && existsInsurance.rows.length) {

            payerDetails.type = 'exists';
            payerDetails.payer_id = existsInsurance.rows[0].id;
            payerDetails.payer_code = existsInsurance.rows[0].insurance_code;
            payerDetails.payer_name = existsInsurance.rows[0].insurance_name;
            payerDetails.payer_Identification = params.status != 'pending' ? existsInsurance.rows[0].payer_id : payerIdentification;

        }
        else {
            payerDetails.type = 'none';
        }

        return payerDetails;
    },

    createPaymentFromERA: async function (params, eraResponseJson) {

        let paymentResult;
        let payerDetails = JSON.parse(params.payer_details);

        let reassociation = eraResponseJson.length ? eraResponseJson[0].reassociationTraceNumber : {};
        let financialInfo = eraResponseJson.length && eraResponseJson[0].financialInformation && eraResponseJson[0].financialInformation.length ? eraResponseJson[0].financialInformation[0] : {};

        let monetoryAmount = financialInfo.monetoryAmount ? parseFloat(financialInfo.monetoryAmount).toFixed(2) : 0.00;
        let notes = 'Amount shown in EOB:' + monetoryAmount;

        notes += '\n \n' + params.file_id + '.ERA';
        payerDetails.paymentId = null;
        payerDetails.company_id = payerDetails.company_id;
        payerDetails.user_id = payerDetails.created_by;
        payerDetails.facility_id = 1;
        payerDetails.patient_id = null;
        payerDetails.insurance_provider_id = payerDetails.payer_id;
        payerDetails.provider_group_id = null;
        payerDetails.provider_contact_id = null;
        payerDetails.payment_reason_id = 2;
        payerDetails.amount = monetoryAmount;
        payerDetails.accounting_date = 'now()';
        payerDetails.invoice_no = '';
        payerDetails.display_id = null;  // alternate_payment_id
        payerDetails.payer_type = 'insurance';
        payerDetails.notes = notes;
        payerDetails.payment_mode = 'check';
        payerDetails.credit_card_name = null;
        payerDetails.credit_card_number = reassociation.referenceIdent || null; // card_number
        payerDetails.clientIp = params.clientIp;
        payerDetails.screenName = params.screenName;
        payerDetails.moduleName = params.moduleName;
        payerDetails.logDescription = 'Payment created via ERA';


        paymentResult = await data.checkExistsERAPayment(params);
        paymentResult = paymentResult && paymentResult.rows && paymentResult.rows.length ? paymentResult.rows[0] : {};

        try {

            if (!paymentResult.id) {
                paymentResult = await paymentController.createOrUpdatePayment(payerDetails);
                paymentResult = paymentResult && paymentResult.rows && paymentResult.rows.length ? paymentResult.rows[0] : {};
            }

            paymentResult.file_id = params.file_id;
            paymentResult.created_by = payerDetails.created_by;

            await data.createEdiPayment(paymentResult);

            return paymentResult;

        } catch (err) {

            throw err;
        }


    },

    processPayments: async function (params, eraObject) {
        let self = this;

        let paymentDetails = await self.createPaymentFromERA(params, eraObject);

        let claimLists = eraObject && eraObject.headerNumber ? eraObject.headerNumber : {};

        let LineItemsAndClaimLists = await eraParser.getFormatedLineItemsAndClaims(claimLists, params);

        let processedClaims = await data.createPaymentApplication(LineItemsAndClaimLists, paymentDetails);

        return processedClaims;
    },

    checkERAFileIsProcessed: async function (fileMd5, company_id) {
        return data.checkERAFileIsProcessed(fileMd5, company_id);
    },

    saveERAFile: async function (params) {
        return data.saveERAFile(params);
    },

    getFileStorePath: async function (params) {
        return data.getFileStorePath(params);
    }

};
