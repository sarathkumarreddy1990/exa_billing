define([
    'backbone',
    'backbonesubroute',
    'views/setup/index',
    'text!templates/access-denied.html',
    'routes/setup/billing-providers',
    'routes/setup/cas-group-codes',
    'routes/setup/cas-reason-codes',
    'routes/setup/adjustment-codes',
    'routes/setup/provider-level-codes',
    'routes/setup/provider-id-code-qualifiers',
    'routes/setup/billing-codes',
    'routes/setup/billing-classes',
    'routes/setup/payment-reasons',
    'routes/setup/claim-status',
    'routes/setup/edi-clearinghouses',
    'routes/setup/validations'
], function (
    Backbone,
    BackboneSubroute,
    SetupView,
    AccessDeniedTemplate,
    BillingProvidersRoute,
    CasGroupCodesRoute,
    CasReasonCodesRoute,
    AdjustmentCodesRoute,
    ProviderLevelCodesRoute,
    ProvierIdCodeQualifiersRoute,
    BillingCodesRoute,
    BillingClassesRoute,
    PaymentReasonsRoute,
    ClaimStatusRoute,
    EdiClearingHousesRoute,
    ValidationsRoute
    ) {
        return Backbone.SubRoute.extend({
            routes: {
                "billing_providers/*subroute": "startBillingProviders",
                "cas_group_codes/*subroute": "startCasGroupCodes",
                "cas_reason_codes/*subroute": "startCasReasonCodes",
                "adjustment_codes/*subroute": "startAdjustmentCodes",
                "provider_level_codes/*subroute": "startProviderLevelCodes",
                "provider_id_code_qualifiers/*subroute": "startProviderIdCodeQualifiers",
                "billing_codes/*subroute": "startBillingCodes",
                "billing_classes/*subroute": "startBillingClasses",
                "payment_reasons/*subroute" : "startPaymentReasons",
                "claim_status/*subroute" : "startClaimStatus",
                "edi_clearinghouses/*subroute" : "startEDIClearingHouses",
                "validations/*subroute" : "startValidations"
            },

            accessDeniedTemplate: _.template(AccessDeniedTemplate),

            defaultArgs: {
                createTrailingSlashRoutes: true, layout: siteLayouts.facility, outerLayout: null, module: facilityModules.setup, screen: null, el: '#data_container', routePrefix: null
            },

            accessDenied: function () {
                var self = this;
                $("#data_container").html(self.accessDeniedTemplate);
                $("#divPageHeaderButtons").html("");
            },

            startBillingProviders: function (subroute) {
                if (this.checkLicense('BillingProviders') && !this.billingProviderRouter) {
                    this.defaultArgs.routePrefix = 'setup/billing_providers/';
                    this.billingProviderRouter = new BillingProvidersRoute(this.defaultArgs.routePrefix, this.defaultArgs);
                } else {
                    this.accessDenied();
                }
            },

            startCasGroupCodes: function (subroute) {
                if (this.checkLicense('CasGroupCodes') && !this.casGroupCodeRouter) {
                    this.defaultArgs.routePrefix = 'setup/cas_group_codes/';
                    this.casGroupCodeRouter = new CasGroupCodesRoute(this.defaultArgs.routePrefix, this.defaultArgs);
                } else {
                    this.accessDenied();
                }
            },

            startCasReasonCodes: function (subroute) {
                if (this.checkLicense('CasReasonCodes') && !this.casReasonCodesRouter) {
                    this.defaultArgs.routePrefix = 'setup/cas_reason_codes/';
                    this.casReasonCodesRouter = new CasReasonCodesRoute(this.defaultArgs.routePrefix, this.defaultArgs);
                } else {
                    this.accessDenied();
                }
            },

            startAdjustmentCodes: function () {
                if (this.checkLicense('AdjustmentCodes') && !this.adjustmentCodeRouter) {
                    this.defaultArgs.routePrefix = 'setup/adjustment_codes/';
                    this.adjustmentCodeRouter = new AdjustmentCodesRoute(this.defaultArgs.routePrefix, this.defaultArgs);
                } else {
                    this.accessDenied();
                }
            },

            startProviderLevelCodes: function () {
                if (this.checkLicense('ProviderLevelCodes') && !this.providerLevelCodesRouter) {
                    this.defaultArgs.routePrefix = 'setup/provider_level_codes/';
                    this.providerLevelCodesRouter = new ProviderLevelCodesRoute(this.defaultArgs.routePrefix, this.defaultArgs);
                } else {
                    this.accessDenied();
                }
            },

            startProviderIdCodeQualifiers: function () {
                if (this.checkLicense('ProvierIdCodeQualifiers') && !this.providerIdCodeQualifiers) {
                    this.defaultArgs.routePrefix = 'setup/provider_id_code_qualifiers/';
                    this.providerIdCodeQualifiers = new ProvierIdCodeQualifiersRoute(this.defaultArgs.routePrefix, this.defaultArgs);
                } else {
                    this.accessDenied();
                }
            },

            startBillingCodes: function () {
                if (this.checkLicense('BillingCodes') && !this.billingCodesRouter) {
                    this.defaultArgs.routePrefix = 'setup/billing_codes/';
                    this.billingCodesRouter = new BillingCodesRoute(this.defaultArgs.routePrefix, this.defaultArgs);
                } else {
                    this.accessDenied();
                }
            },

            startBillingClasses: function () {
                if (this.checkLicense('BillingClasses') && !this.billingClassesRouter) {
                    this.defaultArgs.routePrefix = 'setup/billing_classes/';
                    this.billingClassesRouter = new BillingClassesRoute(this.defaultArgs.routePrefix, this.defaultArgs);
                } else {
                    this.accessDenied();
                }
            },

            startPaymentReasons: function(){
                if (this.checkLicense('PaymentReasons') && !this.paymentReasons) {
                    this.defaultArgs.routePrefix = 'setup/payment_reasons/';
                    this.paymentReasons = new PaymentReasonsRoute(this.defaultArgs.routePrefix, this.defaultArgs);
                } else {
                    this.accessDenied();
                }
            },

            startClaimStatus: function(){
                if (this.checkLicense('ClaimStatus') && !this.claimStatus) {
                    this.defaultArgs.routePrefix = 'setup/claim_status/';
                    this.claimStatus = new ClaimStatusRoute(this.defaultArgs.routePrefix, this.defaultArgs);
                } else {
                    this.accessDenied();
                }
            },

            startEDIClearingHouses: function () {
                if (this.checkLicense('EDIClearingHouse') && !this.paymentReasons) {
                    this.defaultArgs.routePrefix = 'setup/edi_clearinghouses/';
                    this.ediClearingHouses = new EdiClearingHousesRoute(this.defaultArgs.routePrefix, this.defaultArgs);
                } else {
                    this.accessDenied();
                }
            },

            startValidations: function(){
                if (this.checkLicense('Validations') && !this.claimStatus) {
                    this.defaultArgs.routePrefix = 'setup/validations/';
                    this.validations = new ValidationsRoute(this.defaultArgs.routePrefix, this.defaultArgs);
                } else {
                    this.accessDenied();
                }
            },

            initialize: function () {
                if (!this.setupView) {
                    this.setupView = new SetupView({ el: $('#root') });
                    this.defaultArgs.outerLayout = this.setupView;
                }
            },

            checkLicense: function (currentScreen) {
                //return layout.checkLicense(currentScreen);
                return true;
            },

            closeRoutes: function () {
                this.billingProviderRouter = null;
            }
        });
    });
