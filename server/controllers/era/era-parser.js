const data = require('../../data/era/index');
const _ = require('lodash');

module.exports = {
    
    getFormatedLineItemsAndClaims: async function (claimLists, file_id, payer_details) {

        let ediFileClaims = [];
        let claimComments = [];
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
                    payment: val.paidamount,
                    adjustment: adjustmentAmount,
                    cpt_code: val.qualifierData.cptCode,
                    claim_number: value.claimNumber,
                    claim_status_code: value.claimStatusCode,
                    cas_details: val.serviceAdjustment,
                    charge_id: val.serviceIdentification && val.serviceIdentification.assingedNumber && !isNaN( val.serviceIdentification.assingedNumber ) ? val.serviceIdentification.assingedNumber : 0
                });
            });

            ediFileClaims.push({
                claim_number: value.claimNumber,
                edi_file_id: file_id,
                co_pay: co_pay,
                co_insurance: co_insurance,
                deductible: deductible
            });

            if(co_pay !=''){

                claimComments.push({
                    claim_number: value.claimNumber,
                    note: 'Co-Pay of ' + co_pay + ' is due',
                    type:'co_pay'
                });
            }

            if(co_insurance !=''){

                claimComments.push({
                    claim_number: value.claimNumber,
                    note: 'Co-Insurance of ' + co_insurance + ' is due',
                    type:'co_insurance'
                });
            }

            if(deductible !=''){

                claimComments.push({
                    claim_number: value.claimNumber,
                    note: 'Deductible of ' + deductible + ' is due',
                    type:'deductible'
                });
            }

        });

        return {
            lineItems: lineItems,
            ediFileClaims: ediFileClaims,
            claimComments: claimComments
        };

    }
};
