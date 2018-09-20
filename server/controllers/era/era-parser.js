const data = require('../../data/era/index');
const shared = require('../../shared');
const remarkCodes = require('../../resx/edi/era-remark-codes');
const _ = require('lodash');
const commentsDetails = [
    {
        code: 1,
        description: 'Processed as Primary'
    },
    {
        code: 2,
        description: 'Processed as Secondary'
    },
    {
        code: 3,
        description: 'Processed as Tertiary'
    },
    {
        code: 4,
        description: 'Denied'
    },
    {
        code: 19,
        description: 'Processed as Primary, Forwarded to Additional Payer(s)'
    },
    {
        code: 20,
        description: 'Processed as Secondary, Forwarded to Additional Payer(s)'
    },
    {
        code: 21,
        description: 'Processed as Tertiary, Forwarded to Additional Payer(s)'
    },
    {
        code: 22,
        description: 'Reversal of Previous Payment'
    },
    {
        code: 23,
        description: 'Not Our Claim, Forwarded to Additional Payer(s)'
    },
    {
        code: 25,
        description: 'Predetermination Pricing Only - No Payment'
    }
];

module.exports = {

    getFormatedLineItemsAndClaims: async function (claimLists, params) {

        let claimComments = [];
        let lineItems = [];
        let claimPaymentInformation = [];

        let payer_details = params.payer_details ? JSON.parse(params.payer_details) : {};

        let cas_details = await data.getcasReasonGroupCodes(payer_details);

        cas_details = cas_details.rows && cas_details.rows.length ? cas_details.rows[0] : {};

        // split and merge multiple claims in ~LX segments
        _.each(claimLists, function (obj) {

            if (obj.claimPaymentInformation && obj.claimPaymentInformation.length > 1) {
                let tempArray = obj.claimPaymentInformation.map(item => { return { claimPaymentInformation: [item] }; });
                claimPaymentInformation = claimPaymentInformation.concat(tempArray);
            }

        });

        if(claimPaymentInformation && claimPaymentInformation.length){
            claimLists = claimPaymentInformation;
        }

        await _.each(claimLists, function (claim, claim_index) {
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

                        if (PatientResponsibility && PatientResponsibility.length) {
                            PatientResponsibility = PatientResponsibility[0] ? PatientResponsibility[0] : '{}';
                        }

                        for (let m = 1; m <= 7; m++) {

                            if (PatientResponsibility && PatientResponsibility['reasonCode' + m] && PatientResponsibility['reasonCode' + m] == '1') {
                                deductible += PatientResponsibility['monetaryAmount' + m] ? parseFloat(PatientResponsibility['monetaryAmount' + m]) : 0;
                            }

                            if (PatientResponsibility && PatientResponsibility['reasonCode' + m] && PatientResponsibility['reasonCode' + m] == '2') {
                                co_insurance += PatientResponsibility['monetaryAmount' + m] ? parseFloat(PatientResponsibility['monetaryAmount' + m]) : 0;
                            }

                            if (PatientResponsibility && PatientResponsibility['reasonCode' + m] && PatientResponsibility['reasonCode' + m] == '3') {
                                co_pay += PatientResponsibility['monetaryAmount' + m] ? parseFloat(PatientResponsibility['monetaryAmount' + m]) : 0;
                            }
                        }

                        let serviceAdjustment = val.serviceAdjustment;
                        // reject CAS groupCode['PR'] for calculating adjustment
                        let amountArray = [];

                        _.map(_.reject(serviceAdjustment, { groupCode: 'PR' }), function (obj) {

                            for (let i = 1; i <= 7; i++) {

                                if (obj['monetaryAmount' + i]) {
                                    amountArray.push(parseFloat(obj['monetaryAmount' + i]));
                                }
                            }
                        });

                        let adjustmentAmount = _.sum(amountArray);
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
                        adjustmentAmount = ['1', '19'].indexOf(value.claimStatusCode) == -1 ? 0 : adjustmentAmount;

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

                        // Condition :: Check lineitem have segment REF*6R*[charge id] in ERA file. Otherwise assign 0
                        let serviceIdentification = _.filter(val.serviceIdentification, { referenceIdentQual: '6R' });
                        let charge_id = 0;

                        if (serviceIdentification && serviceIdentification.length) {
                            charge_id = serviceIdentification[0].assingedNumber && !isNaN(serviceIdentification[0].assingedNumber) ? serviceIdentification[0].assingedNumber : 0;
                        }

                        /**
                        *  DESC : Formatting lineItems (Added sequence index and flag:true ) if duplicate cpt code came
                        */
                        let duplicateObj = _.findLast(lineItems, {
                            claim_number: value.claimNumber,
                            cpt_code: val.qualifierData.cptCode,
                            claim_index: claim_index
                        });

                        let index = 1;
                        let duplicate_flag = false;

                        if (duplicateObj) {
                            index = duplicateObj.index && duplicateObj.index ? duplicateObj.index + 1 : 1;
                            duplicate_flag = true;

                            if (!duplicateObj.duplicate) {
                                duplicateObj.duplicate = true;
                            }
                        }

                        // Condition :: Check ERA file payment/Adjustment value is negative/postive to mark credit/debit paments
                        let isDebit = false;
                        let adjustment_code = 'ERA';

                        if (parseFloat(val.paidamount) < 0 || adjustmentAmount < 0) {
                            isDebit = true;
                            adjustment_code = 'ERAREC';
                        }

                        lineItems.push({
                            claim_number: value.claimNumber,
                            cpt_code: val.qualifierData.cptCode,
                            payment: parseFloat(val.paidamount) || 0.00,
                            adjustment: adjustmentAmount || 0.00,
                            cas_total_amt: _.sum(amountArray) || 0.00,
                            bill_fee: parseFloat(val.billFee) || 0.00,
                            original_reference: value.payerClaimContorlNumber || null,
                            claim_status_code: value.claimStatusCode || 0,
                            cas_details: cas_obj,
                            charge_id: charge_id,
                            service_date: val.serviceDate && val.serviceDate.serviceDate || null,
                            patient_fname: value.patientName.firstName || '',
                            patient_lname: value.patientName.lastName || '',
                            patient_mname: value.patientName.middleName || '',
                            patient_prefix: value.patientName.prefix || '',
                            patient_suffix: value.patientName.suffix || '',
                            index: index,
                            duplicate: duplicate_flag,
                            is_debit: isDebit,
                            code: adjustment_code,
                            claim_index: claim_index
                        });
                    });

                    if (value && value.claimStatusCode) {
                        let commentDesc = _.find(commentsDetails, function (item) { return item.code == parseInt(value.claimStatusCode); });

                        if (commentDesc && commentDesc.description) {
                            claimComments.push({
                                claim_number: value.claimNumber,
                                note: commentDesc.description,
                                type: 'auto',
                                claim_index: claim_index,
                                status_code_desc: true
                            });
                        }
                    }

                    if (co_pay != '') {

                        claimComments.push({
                            claim_number: value.claimNumber,
                            note: 'Co-Pay of ' + shared.roundFee(co_pay) + ' is due',
                            type: 'co_pay'
                        });
                    }

                    if (co_insurance != '') {

                        claimComments.push({
                            claim_number: value.claimNumber,
                            note: 'Co-Insurance of ' + shared.roundFee(co_insurance) + ' is due',
                            type: 'co_insurance'
                        });
                    }

                    if (deductible != '') {

                        claimComments.push({
                            claim_number: value.claimNumber,
                            note: 'Deductible of ' + shared.roundFee(deductible) + ' is due',
                            type: 'deductible'
                        });
                    }

                    if (value.outpatientAdjudicationInformation && Object.keys(value.outpatientAdjudicationInformation).length) {

                        _.each(Object.keys(value.outpatientAdjudicationInformation), function (key) {
                            let note = _.find(remarkCodes, (desc, k) => { if (k === value.outpatientAdjudicationInformation[key]) { return desc; } });

                            if (note) {
                                claimComments.push({
                                    claim_number: value.claimNumber,
                                    note: value.outpatientAdjudicationInformation[key] + ': ' + note,
                                    type: 'auto'
                                });
                            }
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

        /**
        *  Condition : ERA- Payment=0, adjustment == bill fee
        *  DESC : Check adjustment amount is zero, Set claim status & Claim comments Denied
        */
        let lineItemsByGroup = _.groupBy(lineItems, 'claim_index');
        let groupedLineItems = [];

        _.map(lineItemsByGroup, items => {

            if (_.sumBy(items, 'payment') == 0 && _.sumBy(items, 'cas_total_amt') == _.sumBy(items, 'bill_fee')) {
                items = items.map(item => {
                    item.claim_status_code = 4;
                    return item;
                });

                claimComments = claimComments.map(comment => {
                    comment.note = comment.claim_index == items[0].claim_index && comment.status_code_desc ? 'Denied' : comment.note;
                    return comment;
                });

                groupedLineItems = groupedLineItems.concat(items);
            } else {
                groupedLineItems = groupedLineItems.concat(items);
            }

        });


        return {
            lineItems: groupedLineItems,
            claimComments: claimComments,
            audit_details: auditDetails
        };

    }
};
