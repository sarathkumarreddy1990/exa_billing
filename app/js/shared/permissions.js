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
                var billingScreenCodes = ['ADJC', 'BICO', 'BICL', 'CLST', 'BIPR', 'PRCQ', 'BILM', 'PARE', 'CASG', 'CASR', 'STCC', 'BIVA', 'PCA', 'EDRT', 'INSM', 'CLHO', 'BULG', 'BALG',
                    'AGAR', 'AARD', 'CHRG', 'CLAY', 'CLIN', 'CLTR', 'CRBE', 'DSPS', 'DICN', 'IVSL', 'MOSU', 'MNRC', 'PATS', 'PYMX', 'PAYT', 'PAIC', 'PBIC', 'PABI', 'PRCN', 'RPFR', 'REPC', 'REPS', 'TSUM',
                    'CLIM', 'STDS', 'ECLM', 'CLMI', 'MASO', 'CLVA', 'ERAI', 'PAYM', 'BUST', 'SFIL']

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
                    'PAYT': 'aPaymentDetails',
                    'PAIC': 'aPatientsByInsCompany',
                    'PBIC': 'aPaymentsByInsurance',
                    'PABI': 'aProcedureAnlaysis',
                    'PRCN': 'aProcedureCount',
                    'RPFR': 'aReadingProviderFees',
                    'REPC': 'aRefProCount',
                    'REPS': 'aRefProSummary',
                    'TSUM': 'aTransactionSummary',
                    'CLMI': 'anc_claim_inquiry',
                    'MASO': 'anc_split_claim',
                    'STDS': 'aStudies',
                    'CLIM': ['aClaims', 'anc_create_claim'],
                   // 'CLIM': 'anc_create_claim',
                    'CLVA': 'btnValidateOrder',
                    'ERAI': 'aEob',
                    'PAYM': 'aPayments',
                    'BUST': 'mySettings',
                    'SFIL':'btnStudyFilter'
                };
                accessDeniedScreens = _.difference(billingScreenCodes, app.screens);

                _.each(accessDeniedScreens, function (code) {
                    var screenId = '';
                    screenId = mappingObject[code];
                    if(typeof screenId == 'string'){
                        self.hideScreens(screenId);
                    } else if(typeof screenId == 'object'){
                        _.each(screenId, function (screen) {
                            self.hideScreens(screen);
                        });
                    }
                });
            };

            this.hideScreens = function(screenId) {
                $('#' + screenId).addClass('disabled');
                $('#' + screenId).attr('href', '#');
                $('.' + screenId).addClass('disabled');
                $('.' + screenId).attr('href', '#');
            }
        }
    });