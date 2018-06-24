const data = require('../../data/claim/claim-workbench');
const ediConnect = require('../../../modules/edi');

const _ = require('lodash');
//const PdfPrinter = require('pdfmake');

const config = require('../../config');
const ediServerUrl = config.get('ediServerUrl');
ediConnect.init(ediServerUrl);

module.exports = {

    getData: function (params) {
        params.isCount=false;
        return data.getData(params);
    },

    getDataCount: function (params) {
        params.isCount=true;
        return data.getData(params);
    },

    updateClaimStatus: function (params) {
        return data.updateClaimStatus(params);
    },

    getClaimObject: async function (params) {
        return data.getEDIClaim(params);
        // let claimObject = await data.getEDIClaim(params);
        // let claimTemplate = await data.getPaperClaimTemplate(params);

        // let pdfPrinter = PdfPrinter();
        // let docDefinition = { content: 'This is an sample PDF printed with pdfMake' };
        // pdfPrinter.createPdf(docDefinition).download('optionalName.pdf');
    },

    getPaperClaimTemplate: function (params) {
        return data.getPaperClaimTemplate(params);
    },

    getEDIClaim: async (params) => {    
        const result = await data.getEDIClaim(params);
        let ediResponse ={};

        if (result.rows && result.rows.length) { 

            if(!result.rows[0].edi_template) {
                return new Error('EDI Template not yet mapped with payer :(');
            }
            
            let data = _.map( result.rows, function (obj) {
                if((obj.subscriper_relationship).toUpperCase()!='SELF'){
                    obj.data[0].subscriber[0].patient[0].claim = obj.data[0].subscriber[0].claim;
                    delete obj.data[0].subscriber[0].claim;
                }

                return obj.data[0];
            });

            let ediRequestJson ={
                'config': {
                    'ALLOW_EMPTY_SEGMENT': true
                },
                header:result.rows[0].header,
                'bht': {
                    'requestID': '1',
                    'tsCreationDate': '20180204',
                    'tsCreationTime': '0604'
                },
                data:data
            };

            ediResponse = await ediConnect.generateEdi(result.rows[0].edi_template, ediRequestJson);
        }

        return ediResponse;
    },

    validateClaim: async function (params) {
        let claimDetails = await data.validateClaim(params);
        claimDetails = claimDetails.rows;
        let validation_result = { invalidClaim_data: [], 
            validClaim_data: [] };
        let error_data;
        params.success_claimID = [];
        let pointer;
        let defaultSubsInsValidationFields = ['subscriber_addressLine1', 'subscriber_city', 'subscriber_dob', 'subscriber_firstName', 'subscriber_lastName', 'subscriber_state', 'subscriber_zipCode', 'insurance_pro_address1', 'insurance_pro_city', 'insurance_pro_payerID', 'insurance_pro_state', 'insurance_pro_zipCode', 'insurance_pro_companyName'];

        _.each(claimDetails, (currentClaim) => {
            let validationFields = currentClaim.validation_fields;
            let errorMessages = [];
            let insSubsValidationFields = [];
            let insSubsInvalidFields = '';

            if(currentClaim.billing_method != 'patient_payment'){
                currentClaim.payer_name = currentClaim.payer_info.payer_name;
                currentClaim.payer_address1 = currentClaim.payer_info.payer_address1;
                currentClaim.payer_city = currentClaim.payer_info.payer_city;
                currentClaim.payer_state = currentClaim.payer_info.payer_state;
                currentClaim.payer_zip_code = currentClaim.payer_info.payer_zip_code;
            }

            if (currentClaim.billing_method == 'electronic_billing') {
                !currentClaim.payer_info.claimClearingHouse ? errorMessages.push('Claim - Clearing house does not exists ') : null;
                (!currentClaim.payer_info.edi_request_templates_id || currentClaim.payer_info.edi_request_templates_id == '-1') ? errorMessages.push('Claim - Request Template does not exists ') : null;
                !currentClaim.payer_info.claim_req_type ? errorMessages.push('Claim - Request Type does not  exists ') : null;
            }

            _.each(validationFields, (validationField) => {
                if (defaultSubsInsValidationFields.includes(validationField)) {
                    insSubsValidationFields.push(validationField);
                }
                else if(validationField == 'service_line_dig1'){
                    pointer = currentClaim.charge_pointer;

                    if (pointer && pointer.length > 0) {
                        _.each(pointer, function(pointer1, k){

                            if (pointer1 == null) {
                                errorMessages.push(`Claim ID ( ${currentClaim.id} ) - Charge ${pointer[k].ref_code} - ${pointer[k].display_description} Serice Line-Dig1 does not exists`);
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
                    'payer_name': currentClaim.billing_method == 'patient_payment' ?currentClaim.patient_name : currentClaim.payer_name,
                    'claim_notes': currentClaim.claim_notes,
                    'errorMessages': errorMessages
                };

                validation_result.invalidClaim_data.push(error_data);
            }
        });

        if (params.success_claimID && params.success_claimID.length > 0) {
            validation_result.validClaim_data = await data.movetoPendingSub(params);
        }

        return validation_result;           
    },

    checkClaimSubsInsValidation: (validationFields, currentClaim) => {
        let insSubsInvalidFields = [];

        if (currentClaim.primary_patient_insurance_id != null && currentClaim.primary_patient_insurance_id != '') {
            _.each(validationFields, (validationField) => {
                !currentClaim['p_' + validationField] || currentClaim['p_' + validationField].length == 0 ? insSubsInvalidFields.push('p_' + validationField) : null;
            });
        }

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

    deleteClaim:function (params) {
        return data.deleteClaim(params);
    }


};