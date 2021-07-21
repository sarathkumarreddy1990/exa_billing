const fs = require('fs');
const path = require('path');
const logger = require('../../../logger');
const { promisify } = require('util');
const readFileAsync = promisify(fs.readFile);

const data = require('../../data/claim/claim-workbench');
const ediData = require('../../data/claim/claim-edi');
const ohipData = require('../../data/ohip');
const ahsData = require('../../data/ahs');
const mhsalData = require('../../data/mhs');
const claimPrintData = require('../../data/claim/claim-print');
const ediConnect = require('../../../modules/edi');
const censusController = require('../census');

const studiesController = require('../../controllers/studies');

const helper = require('../../data');
const _ = require('lodash');

const sftp = require('../../../modules/edi/sftp');

const fonts = {
    Roboto: {
        normal: path.join(__dirname, '../../../app/fonts/Roboto/Roboto-Regular.ttf'),
        bold: path.join(__dirname, '../../../app/fonts/Roboto/Roboto-Medium.ttf'),
        italics: path.join(__dirname, '../../../app/fonts/Roboto/Roboto-Italic.ttf'),
        bolditalics: path.join(__dirname, '../../../app/fonts/Roboto/Roboto-MediumItalic.ttf')
    }
};
const PdfPrinter = require('pdfmake');
const printer = new PdfPrinter(fonts);

const getClaimsForEDI = async (params) => {
    params.isCount = false;
    const claims = await data.getData(params);
    let claimIds = [];

    _.each(claims.rows, (claim) => {
        claimIds.push(claim.id);
    });

    return claimIds.toString();
}

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

    getEDIClaim: async (req) => {
        let params = req.body;

        if (params.isAllClaims) {
            params.claimIds = await getClaimsForEDI(params);
        }

        let claimIds = params.claimIds.split(',');
        let validationData = await data.validateEDIClaimCreation(claimIds, req.session.country_alpha_3_code);
        validationData = validationData && validationData.rows && validationData.rows.length && validationData.rows[0] || [];

        if(validationData) {
            if (validationData.claim_status.indexOf('PV') > -1) {
                return new Error('Please validate claims');
            } else if(validationData.unique_billing_method_count > 1 ){
                return new Error('Please select claims with same type of billing method');
            } else if((validationData.clearing_house_count != claimIds.length || validationData.unique_clearing_house_count > 1) && req.session.country_alpha_3_code != 'can' ){
                return new Error('Please select claims with same type of clearing house Claims');
            } else if (validationData.claim_status.length != claimIds.length) {
                return new Error('Claim date should not be greater than the current date');
            }
        }

        const result = await ediData.getClaimData(params);
        let ediResponse = {};
        let claimDetails = [];
        let sftpData = {};

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

            let header = result.rows[0].header;

            if (header.enableFtp) {
                sftpData = {
                    enableFtp: true,
                    host: header.ftpHostName,
                    user: header.ftpUserName,
                    password: header.ftpPassword,
                    port: header.ftpPort,
                    privateKey: header.ftpIdentityFile,
                    uploadDirPath: header.ftpSentFolder || 'batches',
                    clearingHouseName: header.clearinghouses_name
                };
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

            ediResponse = await ediConnect.generateEdi(result.rows[0].header.edi_template_name, ediRequestJson);
            let validation =[];

            if (ediResponse && ediResponse.ediTextWithValidations) {
                let segmentValidations = ediResponse.ediTextWithValidations.filter(segmentData => typeof segmentData !== 'string' && segmentData.v)
                    .map(segmentData => segmentData.v)
                    .reduce((result, item) => result.concat(item), []);
                validation = ediResponse.validations.concat(segmentValidations);
            }

            if (!ediResponse.errMsg && !ediResponse.err && (validation && validation.length == 0)) {
                const companyId = req.body.companyId || req.companyId;
                let claimInfo = {};
                let uploadRes;

                if (sftpData && sftpData.enableFtp) {
                    claimInfo = {
                        companyId: companyId,
                        sftpData: sftpData,
                        ediText: ediResponse.ediText
                    };

                    uploadRes = await sftp.upload(claimInfo);
                } else {
                    logger.info(`SFTP option not enabled in ${sftpData.clearingHouseName} clearing house, So skipping process.`);

                    uploadRes = {
                        err: null,
                        status: 'ok'
                    };
                }

                let ediStatus = '';
                let ediFileId = 0;

                if (uploadRes && !uploadRes.err) {
                    ediFileId = uploadRes.edi_file_id || 0;
                    params.claim_status = 'PP';
                    params.type = 'auto';
                    params.success_claimID = params.claimIds.split(',');
                    params.isClaim = true;
                    params.claimDetails = JSON.stringify(claimDetails);
                    ediStatus = 'success';
                    params.auditDesc = 'Claim status has changed during claim process (Paper/EDI)';
                    await data.changeClaimStatus(params);
                } else {
                    ediResponse.err = uploadRes.err;
                    ediStatus = 'failure';
                }

                if (ediFileId > 0) {
                    await data.updateEDIFile({
                        status: ediStatus,
                        ediFileId: ediFileId,
                        ...params
                    });
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
                params.auditDesc = 'Claim status has changed during claim process (Direct Invoice)';
                break;
            case 'paper_claim_original':
                notes = 'Paper claim (RED) to ';
                params.auditDesc = 'Claim status has changed during claim process (Paper claim (RED))';
                break;
            case 'paper_claim_full':
                notes = 'Paper claim (B&W) to ';
                params.auditDesc = 'Claim status has changed during claim process (Paper claim (B&W))';
                break;
            case 'patient_invoice':
                notes = 'Patient Invoice printed ';
                params.auditDesc = 'Claim status has changed during claim process (Patient Invoice)';
                break;
            case 'special_form':
                notes = 'Special Form to ';
                params.auditDesc = 'Claim status has changed during claim process (Special Form)';
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

    // Claim validation for MHSAL
    mhsalClaimValidation: async (params) => {

        const claimDetails = await mhsalData.getClaimsData({ claimIds: params.claim_ids });
        const file_path = path.join(__dirname, '../../resx/mhsal-claim-validation-fields.json');
        let validationClaimJson = JSON.parse(await readFileAsync(file_path, 'utf8'));
        let validation_result = {
            invalidClaim_data: [],
            validClaim_data: [],
            validP77Claim_data: [],
        };
        let error_data;

        if (claimDetails[0].billing_method === 'electronic_billing') {
            validationClaimJson = validationClaimJson.default;
        } else {
            validationClaimJson = validationClaimJson.paper_claim;
        }

        params.success_claimID = [];
        console.log(claimDetails[0]);

        _.each(claimDetails, (currentClaim) => {
            let errorMessages = [];
            let claimData = currentClaim;

            if (claimData) {
                _.each(validationClaimJson, (fieldValue, field) => {

                    if (fieldValue) {
                        !claimData[field] ? errorMessages.push(`Claim - ${field} does not exist`) : null;

                        if (field === 'phn' && claimData.phn && claimData.phn.province_alpha_2_code === 'MB') {

                            if (!claimData['register_number']) {
                                errorMessages.push(`Claim - Register_number does not exist`);
                            } else if (claimData['register_number'].province_alpha_2_code !== "MB") {
                                errorMessages.push(`Patient - Register_number mismatch for phn province`);
                            }
                        }
                    }
                });
            }

            if (!errorMessages.length) {
                currentClaim.claim_status_code !== 'P77' && params.success_claimID.push(currentClaim.claim_id) || validation_result.validP77Claim_data.push(currentClaim.claim_id)
            } else {
                error_data = {
                    'id': currentClaim.claim_id,
                    'patient_name': claimData.patient_name,
                    'payer_name': claimData.payer_name,
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

    defaultClaimValidation: async function (params) {
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

            if (currentClaim.billing_method == 'electronic_billing' && params.billingRegionCode !== 'can_BC') {
                !currentClaim.payer_info.claimClearingHouse ? errorMessages.push('Claim - Clearing house does not exists ') : null;
                (!currentClaim.payer_info.edi_request_templates_id || currentClaim.payer_info.edi_request_templates_id == '-1') ? errorMessages.push('Claim - Request Template does not exists ') : null;
            }

            if (currentClaim.primary_patient_insurance_id != null && currentClaim.primary_patient_insurance_id != '') {
                if (currentClaim.is_pri_relationship_self) {
                    currentClaim.p_subscriber_firstName && currentClaim.patient_firstName.toLowerCase() !== currentClaim.p_subscriber_firstName.toLowerCase() ? errorMessages.push('Claim - Primary Subscriber First Name (Self) and Patient First Name Not Matched') : '';
                    currentClaim.p_subscriber_lastName && currentClaim.patient_lastName.toLowerCase() !== currentClaim.p_subscriber_lastName.toLowerCase() ? errorMessages.push('Claim - Primary Subscriber Last Name (Self) and Patient Last Name Not Matched') : '';
                    currentClaim.p_subscriber_middleName && currentClaim.patient_middleName.toLowerCase() !== currentClaim.p_subscriber_middleName.toLowerCase() ? errorMessages.push('Claim - Primary Subscriber Middle Name (Self) and Patient Middle Name Not Matched') : '';
                    currentClaim.p_subscriber_suffixName && currentClaim.patient_suffixName.toLowerCase() !== currentClaim.p_subscriber_suffixName.toLowerCase() ? errorMessages.push('Claim - Primary Subscriber Suffix Name (Self) and Patient Suffix Name Not Matched') : '';
                }
            }

            if (currentClaim.secondary_patient_insurance_id != null && currentClaim.secondary_patient_insurance_id != '') {
                if (currentClaim.is_sec_relationship_self) {
                    currentClaim.s_subscriber_firstName && currentClaim.patient_firstName.toLowerCase() !== currentClaim.s_subscriber_firstName.toLowerCase() ? errorMessages.push('Claim - Secondary Subscriber First Name (Self) and Patient First Name Not Matched') : '';
                    currentClaim.s_subscriber_lastName && currentClaim.patient_lastName.toLowerCase() !== currentClaim.s_subscriber_lastName.toLowerCase() ? errorMessages.push('Claim - Secondary Subscriber Last Name (Self) and Patient Last Name Not Matched') : '';
                    currentClaim.s_subscriber_middleName && currentClaim.patient_middleName.toLowerCase() !== currentClaim.s_subscriber_middleName.toLowerCase() ? errorMessages.push('Claim - Secondary Subscriber Middle Name (Self) and Patient Suffix Name Not Matched') : '';
                    currentClaim.s_subscriber_suffixName && currentClaim.patient_suffixName.toLowerCase() !== currentClaim.s_subscriber_suffixName.toLowerCase() ? errorMessages.push('Claim - Secondary Subscriber Suffix Name (Self) and Patient Suffix Name Not Matched') : '';
                }
            }

            if (currentClaim.tertiary_patient_insurance_id != null && currentClaim.tertiary_patient_insurance_id != '') {
                if (currentClaim.is_ter_relationship_self) {
                    currentClaim.t_subscriber_firstName && currentClaim.patient_firstName.toLowerCase() !== currentClaim.t_subscriber_firstName.toLowerCase() ? errorMessages.push('Claim - Tertiary Subscriber Fisrt Name (Self) and Patient First Name Not Matched') : '';
                    currentClaim.t_subscriber_lastName && currentClaim.patient_lastName.toLowerCase() !== currentClaim.t_subscriber_lastName.toLowerCase() ? errorMessages.push('Claim - Tertiary Subscriber Last Name (Self) and Patient Last Name Not Matched') : '';
                    currentClaim.t_subscriber_middleName && currentClaim.patient_middleName.toLowerCase() !== currentClaim.t_subscriber_middleName.toLowerCase() ? errorMessages.push('Claim - Tertiary Subscriber Middle Name (Self) and Patient Middle Name Not Matched') : '';
                    currentClaim.t_subscriber_suffixName && currentClaim.patient_suffixName.toLowerCase() !== currentClaim.t_subscriber_suffixName.toLowerCase() ? errorMessages.push('Claim - Tertiary Subscriber Suffix Name (Self) and Patient Suffix Name Not Matched') : '';
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

    validateClaim: async function (params) {

        switch (params.billingRegionCode) {
            case 'can_AB':
                return this.ahsClaimValidation(params);
            case 'can_MB':
                return this.mhsalClaimValidation(params);
            case 'can_ON':
                return this.ohipClaimValidation(params);
            default:
                return this.defaultClaimValidation(params);
        }
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

    validateBatchClaims: async (studyDetails) => {
        let validCharges = await data.validateBatchClaimCharge(JSON.stringify(studyDetails));
        let errorData;

        if (studyDetails.length !== parseInt(validCharges.rows[0].charges_count)) {
            errorData = {
                code: '55802'
                , message: 'No charge in claim'
                , name: 'error'
                , Error: 'No charge in claim'
                , severity: 'Error'
            };

            return {
                err: errorData,
                result: false
            };
        }

        if (parseInt(validCharges.rows[0].invalid_split_claim_count)) {
            errorData = {
                code: '23156'
                , message: 'No ordering facility in claim'
                , name: 'error'
                , Error: 'No ordering facility in claim'
                , severity: 'Error'
            };

            return {
                err: errorData,
                result: false
            };
        }

        return {
            err: null,
            result: true
        };

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

        if (params.isAllStudies == 'true'  || params.isAllCensus === 'true') {
            const studyData = await(params.isAllCensus === 'true' ?  censusController.getData(params) : studiesController.getData(params));
            let studyDetails = [];

            if (params.isMobileBillingEnabled) {
                _.map(studyData.rows, (study) => {
                    studyDetails.push({
                        patient_id: study.patient_id,
                        study_id: study.study_id,
                        order_id: study.order_id,
                        billing_type: study.billing_type || 'global'
                    });
                });
            } else {
                _.map(studyData.rows, (study) => {
                    studyDetails.push({
                        patient_id: study.patient_id,
                        study_id: study.study_id,
                        order_id: study.order_id,
                        billing_type: 'global'
                    });
                });
            }

            let result = await this.validateBatchClaims(studyDetails);

            if (result.err) {
                return result.err;
            }

            params.studyDetails = JSON.stringify(studyDetails);
        } else if (params.isMobileBillingEnabled === 'true') {
            let result = await this.validateBatchClaims(JSON.parse(params.studyDetails));

            if (result.err) {
                return result.err;
            }
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
    },

    ohipClaimValidation: async function (params) {
        // TODO: this probably belongs in modules/ohip/routes.js
        // (but it works right here for right now)
        let claimDetails = await ohipData.getClaimsData({ claimIds: params.claim_ids });
        let file_path = path.join(__dirname, '../../resx/ohip-claim-validation-fields.json');
        let valdationClaimJson = await readFileAsync(file_path, 'utf8');
        valdationClaimJson = JSON.parse(valdationClaimJson);

        if (claimDetails[0].billing_method == 'patient_payment' || claimDetails[0].billing_method == 'direct_billing') {
            valdationClaimJson = valdationClaimJson.patient_payment;
        } else {
            let {
                paymentProgram = null
            } = claimDetails[0].insurance_details || {};

            valdationClaimJson = valdationClaimJson.default[paymentProgram && paymentProgram.toLowerCase() || ''];
        }

        let validation_result = {
            invalidClaim_data: [],
            validClaim_data: []
        };

        let error_data;
        params.success_claimID = [];

        _.each(claimDetails, (currentClaim) => {
            let errorMessages = [];
            let claimData = {...currentClaim, ...currentClaim.insurance_details };

            if (claimData) {
                _.each(valdationClaimJson, (fieldValue, field) => {
                    if (fieldValue) {
                        if (typeof fieldValue === 'object') {
                            if (claimData[field]) {
                                _.each(fieldValue, (data, dataField) => {
                                    if (data) {
                                        !claimData[dataField] || !claimData[dataField].length ? errorMessages.push(` Claim - ${dataField} does not exists`) : null;
                                    }
                                });
                            }
                        } else {
                            !claimData[field] || !claimData[field].length ? errorMessages.push(` Claim - ${field} does not exists`) : null;
                        }
                    }
                });
            }

            if (!errorMessages.length) {
                params.success_claimID.push(currentClaim.claim_id);
            }
            else {
                error_data = {
                    'id': currentClaim.claim_id,
                    'patient_name': claimData.patientName,
                    'payer_name': claimData.payerName,
                    'claim_notes': currentClaim.claimNotes,
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

    ahsClaimValidation: async function (params) {

        let claimDetails = await ahsData.getClaimsData({ claimIds: params.claim_ids });

        let file_path = path.join(__dirname, '../../resx/ahs-claim-validation-fields.json');
        let valdationClaimJson = await readFileAsync(file_path, 'utf8');
        valdationClaimJson = JSON.parse(valdationClaimJson);

        if (claimDetails && claimDetails[0].billing_method == 'patient_payment' || claimDetails[0].billing_method == 'direct_billing') {
            valdationClaimJson = valdationClaimJson.patient_payment;
        } else {
            valdationClaimJson = valdationClaimJson.default;
        }

        let validation_result = {
            invalidClaim_data: [],
            validClaim_data: [],
            invalidStatus_claims: []
        };

        let error_data;
        params.success_claimID = [];

        _.each(claimDetails, (currentClaim) => {
            let errorMessages = [];
            let claimData = currentClaim;

            if (claimData) {
                let skipValidation = claimData.oop_referral_indicator === 'Y';
                _.each(valdationClaimJson, (fieldValue, field) => {
                    if (fieldValue) {
                        if (typeof fieldValue === 'object') {
                            if (claimData[field]) {
                                _.each(fieldValue, (data, dataField) => {
                                    if (data) {
                                        dataField === 'provider_prid' && skipValidation
                                            ? null
                                            : !claimData[dataField] || !claimData[dataField].length
                                                ? errorMessages.push(` Claim - ${dataField} does not exists`)
                                                : null;
                                    }
                                });
                            }
                        } else {
                            field === 'provider_prid' && skipValidation
                                ? null
                                : !claimData[field] || !claimData[field].length
                                    ? errorMessages.push(` Claim - ${field} does not exists`)
                                    : null;
                        }
                    }
                });

            }

            if (!errorMessages.length) {
                currentClaim.claim_status_code !== 'PV' && validation_result.invalidStatus_claims.push(currentClaim.claim_id) || params.success_claimID.push(currentClaim.claim_id);
            }
            else {
                error_data = {
                    'id': currentClaim.claim_id,
                    'patient_name': claimData.patientName,
                    'payer_name': claimData.payerName,
                    'claim_notes': currentClaim.claimNotes,
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

    getClaimTotalBalance: data.getClaimTotalBalance,

    getPaperClaimPdf: async function (params) {
        let printerTemplateData = await claimPrintData.getPrinterTemplate(params);

        let pdfDoc = null;

        if (printerTemplateData && printerTemplateData.rows.length) {
            printerTemplateData = printerTemplateData.rows[0];

            let claimData = await ediData.getClaimData(params);

            if (claimData && claimData.rows.length) {
                claimData = claimData.rows;

                printerTemplateData.template_content += 'module.exports = { dd : dd }';

                let template = eval(printerTemplateData.template_content).dd;

                template.pageSize = {
                    width: parseInt(printerTemplateData.page_width) || 612,
                    height: parseInt(printerTemplateData.page_height) || 792
                };

                template.pageMargins = [
                    parseFloat(printerTemplateData.left_margin) || 12,
                    parseFloat(printerTemplateData.top_margin) || 20,
                    parseFloat(printerTemplateData.right_margin) || 0,
                    parseFloat(printerTemplateData.bottom_margin) || 0
                ];

                pdfDoc = await printer.createPdfKitDocument(template);
                pdfDoc.end();
            } else {
                throw new Error('Claim Data Not found');
            }
        } else {
            throw new Error('Paper Claim Template Not Found');
        }

        return pdfDoc;
    },

    getClaimsForEDI:getClaimsForEDI,
    getLatestResourceNumberForEDI: data.getLatestResourceNumberForEDI

};
