const data = require('../../data/era/index');
const _ = require('lodash');

module.exports = {
    
    getFormatedLineItemsAndClaims: async function (claimLists, params) {

        let claimComments = [];
        let lineItems = [];

        let payer_details = params.payer_details ? JSON.parse(params.payer_details) : {};

        let cas_details = await data.getcasReasonGroupCodes(payer_details);

        cas_details = cas_details.rows && cas_details.rows.length ? cas_details.rows[0] : {};

        await _.each(claimLists, function (claim) {
            let claimPaymentInformation = claim.claimPaymentInformation && claim.claimPaymentInformation.length ? claim.claimPaymentInformation : {};

            _.each(claimPaymentInformation, function (value) {
                let co_pay = 0;
                let co_insurance = 0;
                let deductible = 0;

                if (value.claimNumber && !isNaN(value.claimNumber)) {

                    _.each(value.servicePaymentInformation, function (val) {

                        /**
                        *  Functionality  : To get co_pay, co_insurance and deductible
                        *  DESC : SUM of CAS groups code (Ex:'PR')
                        */
                        let PatientResponsibility = _.filter(val.serviceAdjustment, { groupCode: 'PR' });

                        if (Object.keys(PatientResponsibility).length) {

                            co_pay += PatientResponsibility && PatientResponsibility[0] && PatientResponsibility[0].monetaryAmount1 ? parseFloat(PatientResponsibility[0].monetaryAmount1) : 0;
                            deductible += PatientResponsibility && PatientResponsibility[0] && PatientResponsibility[0].monetaryAmount3 ? parseFloat(PatientResponsibility[0].monetaryAmount3) : 0;
                            co_insurance += PatientResponsibility && PatientResponsibility[0] && PatientResponsibility[0].monetaryAmount2 ? parseFloat(PatientResponsibility[0].monetaryAmount2) : 0;
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
                        let validCAS = _.filter(serviceAdjustment, function (obj) {

                            for (let j = 1; j <= 7; j++) {

                                if (obj['reasonCode' + j] && _.filter(cas_details.cas_reason_codes, function (cas) { return cas.code == obj['reasonCode' + j]; }).length == 0) {
                                    return false;
                                }
                            }

                            if (_.filter(cas_details.cas_group_codes, function (cas) { return cas.code == obj.groupCode; }).length == 0) {
                                return false;
                            }

                            return true;

                        });

                        /**
                        *  Condition : Apply adjustment only for primary payer
                        *  DESC : Primary payers are defined via the claim status of 1 or 19
                        */
                        adjustmentAmount = ['1', '19'].indexOf(value.claimStatusCode) == -1 ? 0 : adjustmentAmount[0];
                        
                        /**
                        *  Condition : Check Is Valid CAS or Not
                        *  DESC : Is any one of CAS is not Valid, Then assigne adjustment amount = 0
                        */
                        if (val.serviceAdjustment && (validCAS.length != serviceAdjustment.length)) {
                            adjustmentAmount = 0;
                        }

                        /**
                        *  Condition : ERA- Payment=0, adjustment == bill fee means should not apply adjustment 
                        *  DESC : Assign Adjustment amount is zero
                        */

                        if (val.paidamount && val.billFee && (parseFloat(val.paidamount) == 0) && (parseFloat(val.billFee) == adjustmentAmount)) {
                            adjustmentAmount = 0;
                        }

                        /**
                        *  DESC : Formatting cas details
                        */
                        let cas_obj = [];

                        _.each(validCAS, function (cas) {

                            let groupcode = _.filter(cas_details.cas_group_codes, { code: cas.groupCode });

                            for (let j = 1; j <= 7; j++) {

                                if (cas['reasonCode' + j]) {
                                    let reasoncode = _.filter(cas_details.cas_reason_codes, { code: cas['reasonCode' + j] });

                                    cas_obj.push({
                                        group_code_id: groupcode && groupcode.length ? groupcode[0].id : null,
                                        reason_code_id: reasoncode && reasoncode.length ? reasoncode[0].id : null,
                                        amount: cas['monetaryAmount' + j] ? parseFloat(cas['monetaryAmount' + j]) : 0
                                    });
                                }
                            }

                        });

                        let serviceIdentification = _.filter(val.serviceIdentification, { referenceIdentQual: '6R' });
                        let charge_id = 0;

                        if (serviceIdentification && serviceIdentification.length) {
                            charge_id = serviceIdentification[0].assingedNumber && !isNaN(serviceIdentification[0].assingedNumber) ? serviceIdentification[0].assingedNumber : 0;
                        }

                        lineItems.push({
                            payment: val.paidamount,
                            adjustment: adjustmentAmount || 0.00,
                            cpt_code: val.qualifierData.cptCode,
                            claim_number: value.claimNumber,
                            original_reference: value.payerClaimContorlNumber || null,
                            claim_status_code: value.claimStatusCode || 0,
                            cas_details: cas_obj,
                            charge_id: charge_id,
                            patient_fname : value.patientName.firstName || '',
                            patient_lname : value.patientName.lastName || '',
                            patient_mname : value.patientName.middleName || '',
                            patient_prefix : value.patientName.prefix || '',
                            patient_suffix : value.patientName.suffix || ''
                        });
                    });

                    if (co_pay != '') {

                        claimComments.push({
                            claim_number: value.claimNumber,
                            note: 'Co-Pay of ' + co_pay + ' is due',
                            type: 'co_pay'
                        });
                    }

                    if (co_insurance != '') {

                        claimComments.push({
                            claim_number: value.claimNumber,
                            note: 'Co-Insurance of ' + co_insurance + ' is due',
                            type: 'co_insurance'
                        });
                    }

                    if (deductible != '') {

                        claimComments.push({
                            claim_number: value.claimNumber,
                            note: 'Deductible of ' + deductible + ' is due',
                            type: 'deductible'
                        });
                    }

                }
            });

        });

        let auditDetails = {
            company_id: payer_details.company_id,
            screen_name: 'ERA',
            module_name: params.moduleName,
            client_ip: params.clientIp,
            user_id: parseInt(payer_details.created_by)
        };

        return {
            lineItems: lineItems,
            claimComments: claimComments,
            audit_details: auditDetails
        };

    }
};
