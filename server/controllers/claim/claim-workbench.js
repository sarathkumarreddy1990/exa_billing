const fs = require('fs');
const path = require('path');
const logger = require('../../../logger');

const data = require('../../data/claim/claim-workbench');
const ediData = require('../../data/claim/claim-edi');
const claimPrintData = require('../../data/claim/claim-print');
const ediConnect = require('../../../modules/edi');
const {
    constants,
    OHIPEncoderV03,
    EDIQueryAdapter
} = require('../../../modules/ohip');

const studiesController = require('../../controllers/studies');

const helper = require('../../data');
const _ = require('lodash');
//const PdfPrinter = require('pdfmake');

module.exports = {

    getData: function (params) {
        params.isCount = false;
        return data.getData(params);
    },

    getDataCount: function (params) {
        params.isCount = true;
        return data.getData(params);
    },

    updateClaimStatus: function (params) {
        return data.updateClaimStatus(params);
    },

    getClaimObject: async function (params) {
        return ediData.getClaimData(params);
        // let claimObject = await ediData.getClaimData(params);
        // let claimTemplate = await data.getPaperClaimTemplate(params);

        // let pdfPrinter = PdfPrinter();
        // let docDefinition = { content: 'This is an sample PDF printed with pdfMake' };
        // pdfPrinter.createPdf(docDefinition).download('optionalName.pdf');
    },

    getInvoiceData: async function (params) {
        return claimPrintData.getInvoiceData(params);
    },

    getPrinterTemplate: function (params) {
        return claimPrintData.getPrinterTemplate(params);
    },
    
    submitOhipClaim: function (params) {
        return ediData.submitOhipClaim(params);
    },

    getEDIClaim: async (params) => {
        let claimIds = (params.claimIds).split(',');
        let validationData = await data.validateEDIClaimCreation(claimIds);
        validationData = validationData && validationData.rows && validationData.rows.length && validationData.rows[0] || [];

        if(validationData) {
            if (validationData.claim_status.indexOf('PV') > -1) {
                return new Error('Please validate claims');
            } else if(validationData.unique_billing_method_count > 1 ){
                return new Error('Please select claims with same type of billing method');
            } else if(validationData.clearing_house_count != claimIds.length || validationData.unique_clearing_house_count > 1){
                return new Error('Please select claims with same type of clearing house Claims');
            }

        }

        const result = await ediData.getClaimData(params);
        let ediResponse = {};
        let claimDetails = [];

        if (result && result instanceof Error) {
            return result;
        }

        if (result && result.rows && !result.rows.length) {
            return new Error('NO_DATA');
        }

        if (result.rows && result.rows.length) {

            if (!result.rows[0].header) {
                return new Error('Clearinghouse not yet mapped with payer');
            }

            if (!result.rows[0].header.edi_template_name) {
                return new Error('EDI Template not yet mapped with Clearinghouse');
            }

            let ediData = _.map(result.rows, function (obj) {

                claimDetails.push(
                    {
                        coverage_level: obj.coverage_level,
                        claim_id: obj.claim_id,
                        insuranceName: obj.insurance_name,
                        note: 'Electronic claim to ' + obj.insurance_name + ' (' + obj.coverage_level + ' )'
                    }
                );

                if ((obj.subscriber_relationship).toUpperCase() != 'SELF') {
                    obj.data[0].subscriber[0].patient[0].claim = obj.data[0].subscriber[0].claim;
                    delete obj.data[0].subscriber[0].claim;
                }

                return obj.data[0];
            });

            let ediRequestJson = {
                'config': {
                    'ALLOW_EMPTY_SEGMENT': true,
                    'VALIDATION_SET': 'default_validation'
                },
                header: result.rows[0].header,
                'bht': {
                    'requestID': '1',
                    'tsCreationDate': result.rows[0].header.fgDate,
                    'tsCreationTime': result.rows[0].header.fgTime
                },
                data: ediData
            };

            const country_alpha_3_code = (await helper.query(`
                SELECT
                    country_alpha_3_code
                FROM sites
                WHERE
                    id = 1
            `, [])).rows[0].country_alpha_3_code;

            if (country_alpha_3_code === 'can') {

                const enc = new OHIPEncoderV03();
                const queryAdapter = new EDIQueryAdapter(ediData);
                const mappedData = queryAdapter.getMappedData();

                ediResponse = '';

                mappedData.forEach((batch) => {

                    const context = {
                        batchDate: new Date(),
                        batchSequenceNumber: '441'  // TODO: needs to be dynamically generated
                    };

                    const filename = enc.getFilename(batch, context);

                    // for each claim
                    let claimStr = enc.encode(batch, context);

                    ediResponse = {
                        ohipText: claimStr,
                        ohipFilename: filename
                    };

                    const fullOHIPFilepath = path.join('ohip-out', filename);

                    fs.writeFile(fullOHIPFilepath, claimStr, constants.encoding, (err) => {
                        if (err) {
                            logger.error('While generating OHIP Claim Submission file', err);
                        }
                        else {
                            logger.info('Created OHIP Claim Submission file: ' + fullOHIPFilepath);
                        }
                    });
                });
            }
            else {

                ediResponse = await ediConnect.generateEdi(result.rows[0].header.edi_template_name, ediRequestJson);
                let validation =[];

                if (ediResponse && ediResponse.ediTextWithValidations) {
                    let segmentValidations = ediResponse.ediTextWithValidations.filter(segmentData => typeof segmentData !== 'string' && segmentData.v)
                        .map(segmentData => segmentData.v)
                        .reduce((result, item) => result.concat(item), []);
                    validation = ediResponse.validations.concat(segmentValidations);
                }

                if (!ediResponse.errMsg && (validation && validation.length == 0)) {
                    params.claim_status = 'PP';
                    params.type = 'auto';
                    params.success_claimID = params.claimIds.split(',');
                    params.isClaim = true;
                    params.claimDetails = JSON.stringify(claimDetails);
                    await data.changeClaimStatus(params);
                }

            }
        } else {
            ediResponse = result;
        }

        return ediResponse;
    },

    updateStatus: async function (params) {
        params.claim_status = 'PP';
        params.type = 'auto';
        params.isClaim = true;
        let claimIds = params.claimIds.split(',');
        params.success_claimID = claimIds;
        let claimDetails = [];
        let notes = '';

        switch (params.templateType) {
            case 'direct_invoice':
                notes = 'Invoice claim to ';
                break;
            case 'paper_claim_original':
                notes = 'Paper claim (RED) to ';
                break;
            case 'paper_claim_full':
                notes = 'Paper claim (B&W) to ';
                break;
            case 'patient_invoice':
                notes = 'Patient Invoice  printed ';
                break;
        }

        _.map(claimIds, function (obj) {

            claimDetails.push(
                {
                    claim_id: obj,
                    note: notes

                }
            );

        });

        params.claimDetails = JSON.stringify(claimDetails);
        params.notes = notes;
        let result = await data.changeClaimStatus(params);
        return result;
    },

    validateClaim: async function (params) {
        let claimDetails = await ediData.validateClaim(params);

        if (claimDetails && claimDetails.constructor.name === 'Error') {
            return claimDetails;
        }

        claimDetails = claimDetails.rows;
        let validation_result = {
            invalidClaim_data: [],
            validClaim_data: []
        };
        let error_data;
        params.success_claimID = [];
        let pointers;
        let defaultSubsInsValidationFields = ['subscriber_addressLine1', 'subscriber_city', 'subscriber_dob', 'subscriber_gender', 'subscriber_firstName', 'subscriber_lastName', 'subscriber_state', 'subscriber_zipCode', 'insurance_pro_address1', 'insurance_pro_city', 'insurance_pro_payerID', 'insurance_pro_state', 'insurance_pro_zipCode', 'insurance_pro_companyName'];

        _.each(claimDetails, (currentClaim) => {
            let validationFields = currentClaim.validation_fields;
            let errorMessages = [];
            let insSubsValidationFields = [];
            let insSubsInvalidFields = '';

            if (!currentClaim.billing_method) {
                errorMessages.push('Cannot validate without billing method..');
            }

            if (currentClaim.billing_method && currentClaim.billing_method != 'patient_payment') {
                currentClaim.payer_name = currentClaim.payer_info.payer_name;
                currentClaim.payer_address1 = currentClaim.payer_info.payer_address1;
                currentClaim.payer_city = currentClaim.payer_info.payer_city;
                currentClaim.payer_state = currentClaim.payer_info.payer_state;
                currentClaim.payer_zip_code = currentClaim.payer_info.payer_zip_code;
            }

            if (currentClaim.billing_method == 'electronic_billing') {
                !currentClaim.payer_info.claimClearingHouse ? errorMessages.push('Claim - Clearing house does not exists ') : null;
                (!currentClaim.payer_info.edi_request_templates_id || currentClaim.payer_info.edi_request_templates_id == '-1') ? errorMessages.push('Claim - Request Template does not exists ') : null;
            }

            if (currentClaim.primary_patient_insurance_id != null && currentClaim.primary_patient_insurance_id != '') {
                if (currentClaim.is_pri_relationship_self) {
                    currentClaim.p_subscriber_firstName != '' ? currentClaim.patient_firstName === currentClaim.p_subscriber_firstName ? '' : errorMessages.push('Claim - Primary Subscriber First Name (Self) and Patient First Name Not Matched') : '';
                    currentClaim.p_subscriber_lastName != '' ? currentClaim.patient_lastName === currentClaim.p_subscriber_lastName ? '' : errorMessages.push('Claim - Primary Subscriber Last Name (Self) and Patient Last Name Not Matched') : '';
                    currentClaim.p_subscriber_middleName != '' ? currentClaim.patient_middleName === currentClaim.p_subscriber_middleName ? '' : errorMessages.push('Claim - Primary Subscriber Middle Name (Self) and Patient Middle Name Not Matched') : '';
                    currentClaim.p_subscriber_suffixName != '' ? currentClaim.patient_suffixName === currentClaim.p_subscriber_suffixName ? '' : errorMessages.push('Claim - Primary Subscriber Suffix Name (Self) and Patient Suffix Name Not Matched') : '';
                }
            }

            if (currentClaim.secondary_patient_insurance_id != null && currentClaim.secondary_patient_insurance_id != '') {
                if (currentClaim.is_sec_relationship_self) {
                    currentClaim.s_subscriber_firstName != '' ? currentClaim.patient_firstName === currentClaim.s_subscriber_firstName ? '' : errorMessages.push('Claim - Secondary Subscriber First Name (Self) and Patient First Name Not Matched') : '';
                    currentClaim.s_subscriber_lastName != '' ? currentClaim.patient_lastName === currentClaim.s_subscriber_lastName ? '' : errorMessages.push('Claim - Secondary Subscriber Last Name (Self) and Patient Last Name Not Matched') : '';
                    currentClaim.s_subscriber_middleName != '' ? currentClaim.patient_middleName === currentClaim.s_subscriber_middleName ? '' : errorMessages.push('Claim - Secondary Subscriber Middle Name (Self) and Patient Suffix Name Not Matched') : '';
                    currentClaim.s_subscriber_suffixName != '' ? currentClaim.patient_suffixName === currentClaim.s_subscriber_suffixName ? '' : errorMessages.push('Claim - Secondary Subscriber Suffix Name (Self) and Patient Suffix Name Not Matched') : '';
                }
            }

            if (currentClaim.tertiary_patient_insurance_id != null && currentClaim.tertiary_patient_insurance_id != '') {
                if (currentClaim.is_ter_relationship_self) {
                    currentClaim.t_subscriber_firstName != '' ? currentClaim.patient_firstName === currentClaim.t_subscriber_firstName ? '' : errorMessages.push('Claim - Tertiary Subscriber Fisrt Name (Self) and Patient First Name Not Matched') : '';
                    currentClaim.t_subscriber_lastName != '' ? currentClaim.patient_lastName === currentClaim.t_subscriber_lastName ? '' : errorMessages.push('Claim - Tertiary Subscriber Last Name (Self) and Patient Last Name Not Matched') : '';
                    currentClaim.t_subscriber_middleName != '' ? currentClaim.patient_middleName === currentClaim.t_subscriber_middleName ? '' : errorMessages.push('Claim - Tertiary Subscriber Middle Name (Self) and Patient Middle Name Not Matched') : '';
                    currentClaim.t_subscriber_suffixName != '' ? currentClaim.patient_suffixName === currentClaim.t_subscriber_suffixName ? '' : errorMessages.push('Claim - Tertiary Subscriber Suffix Name (Self) and Patient Suffix Name Not Matched') : '';
                }
            }

            _.each(validationFields, (validationField) => {
                if (defaultSubsInsValidationFields.includes(validationField)) {
                    insSubsValidationFields.push(validationField);
                }
                else if (validationField == 'service_line_dig1') {
                    pointers = currentClaim.charge_pointer;

                    if (pointers && pointers.length > 0) {
                        _.each(pointers, function (pointer) {

                            if (pointer && pointer.pointer1 == null) {
                                errorMessages.push(`Claim ID ( ${currentClaim.id} ) - Charge ${pointer.ref_code} - ${pointer.display_description} Serice Line-Dig1 does not exists`);
                            }
                        });
                    }

                } else {
                    !currentClaim[validationField] || currentClaim[validationField].length == 0 ? errorMessages.push(` Claim - ${validationField} does not exists`) : null;
                }
            });

            insSubsInvalidFields = this.checkClaimSubsInsValidation(insSubsValidationFields, currentClaim);

            if (insSubsInvalidFields && insSubsInvalidFields.length) {
                _.each(insSubsInvalidFields, (insSubsInvalidField) => {
                    insSubsInvalidField != null && insSubsInvalidField != '' ? errorMessages.push(` Claim - ${insSubsInvalidField} does not exists`) : null;
                });
            }

            if (!errorMessages.length) {
                params.success_claimID.push(currentClaim.id);
            }
            else {
                error_data = {
                    'id': currentClaim.id,
                    'patient_name': currentClaim.patient_name,
                    'payer_name': currentClaim.billing_method == 'patient_payment' ? currentClaim.patient_name : currentClaim.payer_name,
                    'claim_notes': currentClaim.claim_notes,
                    'errorMessages': errorMessages
                };

                validation_result.invalidClaim_data.push(error_data);
            }
        });

        if (params.success_claimID && params.success_claimID.length > 0) {
            validation_result.validClaim_data = await data.updateValidateClaimStatus(params);
        }

        return validation_result;
    },

    checkClaimSubsInsValidation: (validationFields, currentClaim) => {
        let insSubsInvalidFields = [];

        _.each(validationFields, (validationField) => {
            !currentClaim['p_' + validationField] || currentClaim['p_' + validationField].length == 0 ? insSubsInvalidFields.push('p_' + validationField) : null;
        });

        if (currentClaim.secondary_patient_insurance_id != null && currentClaim.secondary_patient_insurance_id != '') {
            _.each(validationFields, (validationField) => {
                !currentClaim['s_' + validationField] || currentClaim['s_' + validationField].length == 0 ? insSubsInvalidFields.push('s_' + validationField) : null;
            });
        }

        if (currentClaim.tertiary_patient_insurance_id != null && currentClaim.tertiary_patient_insurance_id != '') {
            _.each(validationFields, (validationField) => {
                !currentClaim['t_' + validationField] || currentClaim['t_' + validationField].length == 0 ? insSubsInvalidFields.push('t_' + validationField) : null;
            });
        }

        return insSubsInvalidFields;
    },

    deleteClaimOrCharge: function (params) {
        return data.deleteClaimOrCharge(params);
    },

    checkChargePaymentDetails: function (params) {
        return data.checkChargePaymentDetails(params);
    },

    checkPaymentDetails: function (params) {
        return data.checkPaymentDetails(params);
    },

    getClaimStudy: function (params) {
        return data.getClaimStudy(params);
    },

    getBillingPayers: function (params) {
        return data.getBillingPayers(params);
    },

    updateBillingPayers: async function (params) {
        // Todo: cpt bill fee calculation and update charges
        return await data.updateBillingPayers(params);
    },

    updateFollowUp: async function (params) {
        return await data.updateFollowUp(params);
    },

    createBatchClaims: async function (params) {
        let auditDetails = {
            company_id: params.company_id,
            screen_name: params.screenName,
            module_name: params.screenName,
            entity_name: params.screenName,
            client_ip: params.clientIp,
            user_id: parseInt(params.userId)
        };
        params.auditDetails = auditDetails;
        params.created_by = parseInt(params.userId);

        if (params.isAllStudies == 'true') {
            const studyData = await studiesController.getData(params);
            let studyDetails = [];

            _.map(studyData.rows, (study) => {
                studyDetails.push({
                    patient_id: study.patient_id,
                    study_id: study.study_id,
                    order_id: study.order_id
                });
            });

            let validCharges = await data.validateBatchClaimCharge(JSON.stringify(studyDetails));

            if(studyDetails.length !== parseInt(validCharges.rows[0].count)) {
                let responseData = {
                    code:'55802'
                    , message: 'No charge in claim'
                    , name: 'error'
                    , Error: 'No charge in claim'
                    , severity: 'Error'
                };

                return await responseData;
            }

            params.studyDetails = JSON.stringify(studyDetails);
        }

        return await data.createBatchClaims(params);
    },

    getClaimDataInvoice: async function (params) {
        return await data.getClaimDataInvoice(params);
    },

    updateInvoiceNo: async function (params) {
        return await data.updateInvoiceNo(params);
    },

    getClaimSummary: async function (params) {
        return await data.getClaimSummary(params);
    }
};
