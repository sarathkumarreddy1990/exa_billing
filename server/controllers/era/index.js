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
            processDetails;
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

                processDetails = await self.checkExistInsurance(eraResponseJson);
            }
            else {

                let paymentResult = await self.createPaymentFromERA(params.payer_details, params.file_id, eraResponseJson);

                let claimLists = eraResponseJson.length && eraResponseJson[0].headerNumber ? eraResponseJson[0].headerNumber : {};

                let LineItemsAndClaimLists = await self.getFormatedLineItemsAndClaims(claimLists, params.file_id, params.payer_details);

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

    getFormatedLineItemsAndClaims: async function (claimLists, file_id, payer_details) {

        let ediFileClaims = [];
        let lineItems = [];

        payer_details = JSON.parse(payer_details);

        let casReasonGroupCode = await data.getcasReasonGroupCode(payer_details);

        casReasonGroupCode = casReasonGroupCode.rows && casReasonGroupCode.rows.length ? casReasonGroupCode.rows[0] : {};

        await _.each(claimLists, function (value) {
            value = value.claimPaymentInformation && value.claimPaymentInformation.length ? value.claimPaymentInformation[0] : {};
            let co_pay = 0;
            let co_insurance = 0;
            let deductible = 0;


            _.each(value.servicePaymentInformation, function (val) {

                /**
                *  Functionality  : To get co_pay, co_insurance and deductible
                *  DESC : SUM of CAS groups code (Ex:'PR')
                */
                let PatientResponsibility = _.pickBy(val.serviceAdjustment, { groupCode: 'PR' });

                if (Object.keys(PatientResponsibility).length) {

                    co_pay += PatientResponsibility && PatientResponsibility[0].monetaryAmount1 ? parseFloat(PatientResponsibility[0].monetaryAmount1) : 0;
                    deductible += PatientResponsibility && PatientResponsibility[0].monetaryAmount3 ? parseFloat(PatientResponsibility[0].monetaryAmount3) : 0;
                    co_insurance += PatientResponsibility && PatientResponsibility[0].monetaryAmount2 ? parseFloat(PatientResponsibility[0].monetaryAmount2) : 0;
                }

                let serviceAdjustment = _.reject(val.serviceAdjustment, { groupCode: 'PR' });
                let adjustmentAmount = _.map(serviceAdjustment, function (obj) {
                    let amountArray = [];

                    for (let i = 1; i <= 7; i++) {

                        if (obj['monetaryAmount' + i]) {
                            amountArray.push(parseFloat(obj['monetaryAmount' + i]));
                        }
                    }

                    return _.sum(amountArray);
                });

                /**
                *  Condition : Check valid CAS group and reason codes
                *  DESC : CAS group and reason codes not matched means shouldn't apply adjustment (Ex: adjustment = 0)
                */
                let validGroupCodes = _.filter(val.serviceAdjustment, function (obj) {

                    for (let j = 1; j <= 7; j++) {

                        if (obj['reasonCode' + j] && (casReasonGroupCode.cas_reasons.indexOf(obj['reasonCode' + j]) == -1)) {

                            return false;

                        }
                    }

                    if (casReasonGroupCode.cas_groups.indexOf(obj.groupCode) == -1) {

                        return false;
                    }

                    return true;

                });

                if (val.serviceAdjustment && (validGroupCodes.length != val.serviceAdjustment.length)) {

                    adjustmentAmount = 0;
                }

                /**
                *  Condition : Apply adjustment only for primary payer
                *  DESC : Primary payers are defined via the claim status of 1 or 19
                */
                adjustmentAmount = ['1', '19'].indexOf(value.claimStatusCode) == -1 ? 0 : adjustmentAmount[0];

                lineItems.push({
                    bill_fee: val.billFee,
                    this_pay: val.paidamount,
                    units: val.units,
                    cpt_code: val.qualifierData.cptCode,
                    modifier1: val.qualifierData.modifier1 || '',
                    modifier2: val.qualifierData.modifier2 || '',
                    modifier3: val.qualifierData.modifier3 || '',
                    modifier4: val.qualifierData.modifier4 || '',
                    claim_date: value.claimDate && value.claimDate.claimDate ? value.claimDate.claimDate : '',
                    claim_number: value.claimNumber,
                    claim_status_code: value.claimStatusCode,
                    total_paid_amount: value.paidAmount,
                    total_billfee: value.totalBillFee,
                    claim_frequency_code: value.claimFrequencyCode,
                    cas_obj: val.serviceAdjustment,
                    this_adj: adjustmentAmount

                });
            });

            ediFileClaims.push({
                claim_number: value.claimNumber,
                edi_file_id: file_id,
                co_pay: co_pay,
                co_insurance: co_insurance,
                deductible: deductible
            });

        });

        return {
            lineItems: lineItems,
            ediFileClaims: ediFileClaims
        };

    },

    processPayments: async function (claimLists, paymentDetails) {

        //console.log(JSON.stringify(claimLists))
        let processedClaims = await data.createPaymentApplication(claimLists, paymentDetails);
        
        // if(processedClaims && processedClaims.rows.length){
        //     console.log('Before merge-->', processedClaims.rows[0].insert_edi_file_claims);
        //     let result = _.map(claimLists.ediFileClaims, function (obj) {
        //         if(processedClaims.rows[0].insert_edi_file_claims && ( processedClaims.rows[0].insert_edi_file_claims.indexOf(parseInt(obj.claim_number)) > -1 ) ){
        //         }
        //     });
        //     console.log('After merge-->', processedClaims.rows[0].insert_edi_file_claims);
        // }

        return processedClaims;
    }
};
