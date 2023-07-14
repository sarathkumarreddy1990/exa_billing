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
                obj.claimPaymentInformation.map(item => {
                    claimPaymentInformation.push({ claimPaymentInformation: [item] });
                });

            } else if (obj.claimPaymentInformation && obj.claimPaymentInformation.length == 1) {
                obj.claimPaymentInformation.map(item => {
                    claimPaymentInformation.push({ claimPaymentInformation: [item] });
                });

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

                        /**
                        *  Condition : Check valid CAS group and reason codes
                        *  DESC : CAS group and reason codes not matched means shouldn't apply adjustment (Ex: adjustment = 0)
                        */
                        const serviceAdjustment = val.serviceAdjustment;
                        const validCAS = [];

                        _.map(serviceAdjustment, function (obj) {
                            let grpCount = 1;
                            for (let j = 1; j <= 7; j++) {

                                if (obj['groupCode' + j]) {
                                    grpCount = Math.max(grpCount, j);
                                }
                                const casReasonCode = obj['reasonCode' + j];
                                const casGroupCode = obj['groupCode' + j] || obj['groupCode' + grpCount];

                                if (casReasonCode
                                    && cas_details.cas_reason_codes.some(val => val.code === casReasonCode)
                                    && cas_details.cas_group_codes.some(val => val.code === casGroupCode)
                                ) {
                                    const casObj = {};
                                    casObj['groupCode'] = casGroupCode;
                                    casObj['reasonCode' + j] = casReasonCode;
                                    casObj['monetaryAmount' + j] = obj['monetaryAmount' + j];
                                    validCAS.push(casObj);
                                }
                            }
                        });

                        // reject invalid CAS group codes and adjustment codes for calculating adjustment
                        const amountArray = [];

                        _.map(validCAS, function (obj) {

                            // In ERA file CAS have more than 7, but we have limit(7) to process the CAS values.
                            for (let i = 1; i <= 7; i++) {
                                const reasonCode = obj['reasonCode' + i];
                                const isInvalidAdjustment = obj.groupCode === 'PR' && ['1', '2', '3'].includes(reasonCode) // Suppress 'PR' CAS group codes with reason codes [1, 2, 3] for adjustment calculations.
                                    || (['2', '20', '3', '21'].includes(value.claimStatusCode)
                                        && (
                                            (obj.groupCode === 'CO' && reasonCode === '45')
                                            || (obj.groupCode === 'OA' && reasonCode === '23')
                                        )
                                    );

                                if (!isInvalidAdjustment && obj['monetaryAmount' + i]) {
                                    amountArray.push(parseFloat(obj['monetaryAmount' + i]));
                                }
                            }
                        });

                        let adjustmentAmount = amountArray.length ? _.round(_.sum(amountArray), 2) : 0.00;

                        /**
                        *  Condition : Apply adjustment only for primary payer
                        *  DESC : Primary payers are defined via the claim status of 1 or 19
                        *  Secondary payers are defined via the claim status of 2 or 20
                        *  Tertiary payers are defined via the claim status of 3 or 21
                        *  EXA-35927 - Added code 22 for reversal of a previous adjustment
                        */
                        adjustmentAmount = ['1', '19', '2', '20', '3', '21', '22'].indexOf(value.claimStatusCode) > -1
                            ? adjustmentAmount
                            : 0;

                        /**
                        *  Condition : Check Is Valid CAS or Not
                        *  DESC : Is any one of CAS is not Valid, Then assigne adjustment amount = 0
                        */
                        if (val.serviceAdjustment && (validCAS.length == 0)) {
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
                        let isGroupDeniedStatus = false;
                        let hasCASPatientResponsibility = false;

                        _.each(validCAS, function (cas) {

                            let groupcode = _.filter(cas_details.cas_group_codes, { code: cas.groupCode });

                            for (let j = 1; j <= 7; j++) {

                                if (cas['reasonCode' + j]) {
                                    let reasoncode = _.filter(cas_details.cas_reason_codes, { code: cas['reasonCode' + j] });

                                    if (cas.groupCode === 'PR' && cas['reasonCode' + j] === '96') {
                                        isGroupDeniedStatus = true;
                                    }

                                    if (cas.groupCode === 'PR' && cas['reasonCode' + j] !== '96') {
                                        hasCASPatientResponsibility = true;
                                    }

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
                            claim_index: claim_index,
                            is_group_denied: isGroupDeniedStatus,
                            has_cas_patient_responsibility: hasCASPatientResponsibility
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
        *  Condition : ERA- Payment=0, adjustment == bill fee OR Payment=0 && Adjustment=0
        *  DESC : Check adjustment amount is zero, Set claim status & Claim comments Denied
        */
        let lineItemsByGroup = _.groupBy(lineItems, 'claim_index');
        let groupedLineItems = [];

        for (let i in lineItemsByGroup) {
            let items = lineItemsByGroup[i];

            //get and push reporting line items
            let reportingCharges = await data.getReportingCharges(items[0], payer_details.payer_id);

            if (reportingCharges.length) {
                groupedLineItems = groupedLineItems.concat(reportingCharges);
            }

            const is_denied_claim_status = items.some(val =>
                ((val.payment === 0
                && (val.adjustment === 0 || val.adjustment === val.bill_fee))
                && !val.has_cas_patient_responsibility)
                || val.is_group_denied
            );

            if (is_denied_claim_status) {
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

        }

        return {
            lineItems: groupedLineItems,
            claimComments: claimComments,
            audit_details: auditDetails
        };

    }
};
