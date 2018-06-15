const data = require('../../data/era/index');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const readFile = promisify(fs.readFile);
const ediConnect = require('../../../modules/edi');
const paymentController = require('../payments/payments');
const eraParser = require('./era-parser');

module.exports = {

    getEraFiles: function (params) {
        return data.getEraFiles(params);
    },

    processERAFile: async function (params) {
        let self = this,
            processDetails,
            eraPath,
            rootDir;
        let templateName = '835_template_1';

        const eraFileDir = await data.getERAFilePathById(params);

        rootDir = eraFileDir.rows && eraFileDir.rows.length && eraFileDir.rows[0].root_directory ? eraFileDir.rows[0].root_directory : '';
        eraPath = eraFileDir.rows && eraFileDir.rows.length && eraFileDir.rows[0].file_path ? eraFileDir.rows[0].file_path : '';
        
        eraPath = path.join(rootDir, eraPath);

        try {
            let dirExists = fs.existsSync(eraPath);

            if (!dirExists) {

                return 'Directory not found in file store';
            }

            eraPath = path.join(eraPath, params.file_id);

            let eraRequestText = await readFile(eraPath, 'utf8');

            ediConnect.init('http://192.168.1.102:5581/edi/api');

            const eraResponseJson = await ediConnect.parseEra(templateName, eraRequestText); 

            if (params.status == 'pending') {

                processDetails = await self.checkExistInsurance(eraResponseJson);
            }
            else {

                let paymentResult = await self.createPaymentFromERA(params, eraResponseJson);
                
                let claimLists = eraResponseJson.length && eraResponseJson[0].headerNumber ? eraResponseJson[0].headerNumber : {};
                
                let LineItemsAndClaimLists = await eraParser.getFormatedLineItemsAndClaims(claimLists, params.file_id, params.payer_details);

                processDetails = await self.processPayments(LineItemsAndClaimLists, paymentResult);

            }

            return processDetails;

        } catch (err) {
            throw err;
        }

    },

    checkExistInsurance: async function (eraResponseJson) {

        let payerDetails = {};
        let reassociation = eraResponseJson.length ? eraResponseJson[0].reassociationTraceNumber : {};
        let payerIdentification = reassociation.originatingCompanyID ? reassociation.originatingCompanyID : '';

        const existsInsurance = await data.selectInsuranceEOB({
            payer_id: payerIdentification
            , company_id: 1
        });

        if (existsInsurance && existsInsurance.rows && existsInsurance.rows.length) {

            payerDetails.type = 'exists';
            payerDetails.payer_id = existsInsurance.rows[0].id;
            payerDetails.payer_code = existsInsurance.rows[0].insurance_code;
            payerDetails.payer_name = existsInsurance.rows[0].insurance_name;
            payerDetails.payer_Identification = payerIdentification;

        }
        else {
            payerDetails.type = 'none';
        }

        return payerDetails;
    },
    
    createPaymentFromERA: async function (params, eraResponseJson) {

        let payerDetails = JSON.parse(params.payer_details);

        let reassociation = eraResponseJson.length ? eraResponseJson[0].reassociationTraceNumber : {};
        let financialInfo = eraResponseJson.length && eraResponseJson[0].financialInformation && eraResponseJson[0].financialInformation.length ? eraResponseJson[0].financialInformation[0] : {};

        let monetoryAmount = financialInfo.monetoryAmount ? parseFloat(financialInfo.monetoryAmount).toFixed(2) : 0.00;
        let notes = 'Amount shown in EOB:' + monetoryAmount;

        notes += '\n \n'+params.file_id + '.ERA';
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

        let paymentResult = await paymentController.createOrUpdatePayment(payerDetails);

        paymentResult = paymentResult && paymentResult.rows && paymentResult.rows.length ? paymentResult.rows[0] : {};
        paymentResult.file_id = params.file_id;
        paymentResult.created_by = payerDetails.created_by;

        await data.createEdiPayment(paymentResult);

        return paymentResult;
    },

    processPayments: async function (LineItemsAndClaimLists, paymentDetails) {

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
