define([
    'jquery',
    'underscore',
    'backbone'
], function (
    $,
    _,
    Backbone
) {
        return function () {

            this.init = function () {
                var self = this;
                var accessDeniedScreens = [];
                var accessDeniedRightClickIDs = [];
                var billingScreenCodes = ['ADJC', 'BICO', 'BICL', 'CLST', 'BIPR', 'PRCQ', 'BILM', 'PARE', 'CASG', 'CASR', 'STCC', 'BIVA', 'PCA', 'EDRT', 'INSM', 'CLHO', 'BULG', 'BALG',
                    'AGAR', 'AARD', 'CHRG', 'CLAY', 'CLIN', 'CLTR', 'CRBE', 'DSPS', 'DICN', 'IVSL', 'MOSU', 'MNRC', 'PATS', 'PYMX', 'PAYT', 'PAIC', 'PBIC', 'PABI', 'PRCN', 'RPFR', 'REPC', 'REPS', 'TSUM','PACT',
                    'CLIM', 'HSTY', 'ECLM', 'CLMI', 'MASO', 'CLVA', 'ERAI', 'PAYM', 'SFIL', 'APAY', 'DPAY', 'DCLM', 'PCLM', 'PATR'];

                mappingObject = {
                    'ADJC': 'aAdjustmentCodes',
                    'BICO': 'aBillingCodes',
                    'BICL': 'aBillingClasses',
                    'CLST': 'aClaimStatus',
                    'BIPR': 'aBillingProviders',
                    'PRCQ': 'aProviderIdCodeQualifiers',
                    'BILM': 'aBillingMessages',
                    'PARE': 'aPaymentReasons',
                    'CASG': 'aCasGroupCodes',
                    'CASR': 'aCasReasonCodes',
                    'STCC': 'aStatusColorCodes',
                    'BIVA': 'aBillingValidations',
                    'PCA': 'aPrinterTemplate',
                    'EDRT': 'aEDITemplate',
                    'INSM': 'aInsuranceX12Mapping',
                    'CLHO': 'aEDIClearingHouses',
                    'BULG': 'aUserLog',
                    'BALG': 'aAuditLog',
                    'AGAR': 'aAgedARSummary',
                    'AARD': 'aAgedARDetails',
                    'CHRG': 'aCharges',
                    'CLAY': 'aClaimActivity',
                    'CLIN': 'aClaimInquiry',
                    'CLTR': 'aClaimTransaction',
                    'CRBE': 'aCreditBalanceEncounters',
                    'DSPS': 'aDateSVC', //this report is display none
                    'DICN': 'aDiagnosisCount',
                    'IVSL': 'aInsuranceLOP',
                    'MOSU': 'aModalitySummary',
                    'MNRC': 'aMonthlyRecap',
                    'PATS': 'aPatientStatement',
                    'PYMX': 'aPayerMix',
                    'PAYT': 'aPaymentDetails', // payment report
                    'PAIC': 'aPatientsByInsCompany',
                    'PBIC': 'aPaymentsByInsurance',
                    'PABI': 'aProcedureAnlaysis',
                    'PRCN': 'aProcedureCount',
                    'RPFR': 'aReadingProviderFees',
                    'REPC': 'aRefProCount',
                    'REPS': 'aRefProSummary',
                    'TSUM': 'aTransactionSummary',
                    'PACT' : 'btnPatientActivity',
                    'CLMI': ['anc_claim_inquiry', 'anc_patient_claim_inquiry'],
                    'MASO': 'anc_split_claim',
                    'HSTY': 'aStudies',
                    'CLIM': ['aClaims', 'anc_create_claim', 'anc_reset_invoice_no'],
                    'CLVA': 'btnValidateOrder',
                    'ERAI': 'aEob',
                    'PAYM': 'aPayments',
                    'SFIL': 'btnStudyFilter',
                    'ECLM': ['anc_edit_claim', 'anc_split_claim', 'anc_add_followup', 'anc_patient_claim_log', 'anc_reset_followup', 
                                'li_ul_change_claim_status', 'li_ul_change_billing_code', 'li_ul_change_billing_class', 'li_ul_change_payer_type'],
                    'PATR': ['anc_view_documents', 'anc_view_reports'],
                    'APAY': 'divPendingPay',
                    'DPAY': 'btnPaymentDelete',
                    'DCLM': 'anc_delete_claim', // This rights used for Delete Charge also
                    'PCLM': 'anc_patient_claim_inquiry'
                };
                accessDeniedScreens = _.difference(billingScreenCodes, app.screens);
                _.each(accessDeniedScreens, function (code) {
                    var screenId = '';
                    screenId = mappingObject[code];
                    accessDeniedRightClickIDs.push(screenId);
                    if(typeof screenId == 'string'){
                        self.hideScreens(screenId);
                    } else if(typeof screenId == 'object'){
                        _.each(screenId, function (screen) {
                            self.hideScreens(screen);
                        });
                    }
                });
                return {screenID : _.flatten(accessDeniedRightClickIDs), screenCode: accessDeniedScreens};
            };

            this.hideScreens = function(screenId) {

                if(screenId == 'divPendingPay') {
                    $('#' + screenId).addClass('maskPendingPay');
                } else {
                    $('#' + screenId).addClass('disabled');
                    $('#' + screenId).attr('href', '#');
                    $('.' + screenId).addClass('disabled');
                    $('.' + screenId).attr('href', '#');
                }
            }
        }
    });