const data = require('../../data/era/index');
const fs = require('fs');
const path = require('path');
const _ = require('lodash');
const { promisify } = require('util');
//const readdir = promisify(fs.readdir);
const readFile = promisify(fs.readFile);
// const writeFile = promisify(fs.writeFile);
const ediConnect = require('../../../modules/edi');
const paymentController = require('../payments/payments');

module.exports = {

    getEraFiles: function (params) {
        return data.getEraFiles(params);
    },

    processERAFile: async function (params) {
        let self = this,
            InsuranceDetails;
        let eraPath = path.join('D:/ERA');
        let templateName = '835_template_1';

        try {
            let dirExists = fs.existsSync(eraPath);

            if (!dirExists) {

                return 'No file';
            }

            //let filename = path.join(eraPath, '/297claims_parsed.json');

            eraPath = path.join(eraPath, '/297claims.txt');

            let eraRequestText = await readFile(eraPath, 'utf8');

            ediConnect.init('http://192.168.1.102:5581/edi/api');

            const eraResponseJson = await ediConnect.parseEra(templateName, eraRequestText);

            //await writeFile(filename, JSON.stringify(eraResponseJson), 'utf8');

            if (params.status == 'pending') {

                InsuranceDetails = await self.checkExistInsurance(eraResponseJson);
            }
            else {

                let paymentResult = await self.createPaymentFromERA(params.payer_details, params.file_id, eraResponseJson);

                let orderLists = eraResponseJson.length && eraResponseJson[0].headerNumber ? eraResponseJson[0].headerNumber : {};

                let LineItemsAndClaimLists = await self.getFormatedLineItemsAndClaims(orderLists, params.file_id);

                await self.processPayments(LineItemsAndClaimLists, paymentResult);

            }

            return InsuranceDetails;

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
    createPaymentFromERA: async function (payerDetails, file_id, eraResponseJson) {

        payerDetails = JSON.parse(payerDetails);

        let reassociation = eraResponseJson.length ? eraResponseJson[0].reassociationTraceNumber : {};
        let financialInfo = eraResponseJson.length && eraResponseJson[0].financialInformation && eraResponseJson[0].financialInformation.length ? eraResponseJson[0].financialInformation[0] : {};

        let monetoryAmount = financialInfo.monetoryAmount ? parseFloat(financialInfo.monetoryAmount).toFixed(2) : 0.00;
        let notes = 'Amount shown in EOB:' + monetoryAmount;

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
        paymentResult.file_id = file_id;
        paymentResult.created_by = payerDetails.created_by;

        await data.createEdiPayment(paymentResult);

        return paymentResult;
    },

    getFormatedLineItemsAndClaims: async function (orderLists, file_id) {

        let ediFileClaims = [];
        let lineItems = [];

        await _.each(orderLists, function (value) {
            value = value.claimPaymentInformation && value.claimPaymentInformation.length ? value.claimPaymentInformation[0] : {};

            _.each(value.servicePaymentInformation, function (val) {
                lineItems.push({
                    bill_fee: val.billFee,
                    this_pay: val.paidamount,
                    units: val.units,
                    cpt_code: val.qualifierData.cptCode,
                    modifier1: val.qualifierData.modifier1 || '',
                    modifier2: val.qualifierData.modifier2 || '',
                    modifier3: val.qualifierData.modifier3 || '',
                    modifier4: val.qualifierData.modifier4 || '',
                    cas_obj: val.serviceAdjustment,
                    claim_date: value.claimDate && value.claimDate.claimDate ? value.claimDate.claimDate : '',
                    claim_number: value.claimNumber,
                    claim_status_code: value.claimStatusCode,
                    total_paid_amount: value.paidAmount,
                    total_billfee: value.totalBillFee,
                    claim_frequency_code: value.claimFrequencyCode
                });
            });

            ediFileClaims.push({
                claim_number: value.claimNumber,
                edi_file_id : file_id
            });

        });

        return {
            lineItems: lineItems,
            ediFileClaims: ediFileClaims
        };

    },

    processPayments: async function(claimLists, paymentDetails){

        console.log(JSON.stringify(claimLists.lineItems))
        console.log('----------->', paymentDetails)

        return await data.createPaymentApplication(claimLists, paymentDetails);
    }
};
