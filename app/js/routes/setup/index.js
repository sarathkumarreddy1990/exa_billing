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
    'routes/setup/validations',
    'routes/setup/status-color-codes',
    'routes/setup/supporting-text',
    'routes/setup/audit-log',
    'routes/setup/user-log',
    'routes/setup/edi-templates',
    'routes/setup/billing-messages',
    'routes/setup/insurance-x12-mapping',
    'routes/setup/printer-templates',
    'routes/setup/auto-billing',
    'routes/setup/submission-types',
    'routes/setup/collections-process',
    'routes/setup/delay-reason'

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
    ValidationsRoute,
    StatusColorCodesRoute,
    SupportingTextRoute,
    AuditLogRoute,
    UserLogRoute,
    EDITemplatesRoute,
    BillingMessagesRoute,
    InsuranceX12MappingRoute,
    PaperClaimTemplatesRoute,
    AutoBillingRoute,
    SubmissionTypesRoute,
    CollectionsProcess,
    DelayReasonRoute
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
                "validations/*subroute" : "startValidations",
                "status_color_codes/*subroute" : "startStatusColorCodes",
                "supporting_text/*subroute" : "startSupportingText",
                "audit_log/*subroute" : "startAuditLog",
                "user_log/*subroute" : "startUserLog",
                "edi_templates/*subroute" : "startEDITemplates",
                "billing_messages/*subroute" : "startBillingMessages",
                "insurance_x12_mapping/*subroute" : "startInsuranceX12Mapping",
                "printer_templates/*subroute" : "startPaperClaimTemplates",
                "auto_billing/*subroute" : "startAutoBilling",
                "submission_types/*subroute": "startSubmissionType",
                "collections_process/*subroute": "startCollectionsProcess",
                "delay_reason/*subroute": "startDelayReason"

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

            startBillingProviders: function () {
                if (this.checkLicense('BillingProviders') && !this.billingProviderRouter) {
                    this.defaultArgs.routePrefix = 'setup/billing_providers/';
                    this.billingProviderRouter = new BillingProvidersRoute(this.defaultArgs.routePrefix, this.defaultArgs);
                } else {
                    this.accessDenied();
                }
            },

            startCasGroupCodes: function () {
                if (this.checkLicense('CasGroupCodes') && !this.casGroupCodeRouter) {
                    this.defaultArgs.routePrefix = 'setup/cas_group_codes/';
                    this.casGroupCodeRouter = new CasGroupCodesRoute(this.defaultArgs.routePrefix, this.defaultArgs);
                } else {
                    this.accessDenied();
                }
            },

            startCasReasonCodes: function () {
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
                if (this.checkLicense('EDIClearingHouse') && !this.ediClearingHouses) {
                    this.defaultArgs.routePrefix = 'setup/edi_clearinghouses/';
                    this.ediClearingHouses = new EdiClearingHousesRoute(this.defaultArgs.routePrefix, this.defaultArgs);
                } else {
                    this.accessDenied();
                }
            },

            startValidations: function(){
                if (this.checkLicense('Validations') && !this.validations) {
                    this.defaultArgs.routePrefix = 'setup/validations/';
                    this.validations = new ValidationsRoute(this.defaultArgs.routePrefix, this.defaultArgs);
                } else {
                    this.accessDenied();
                }
            },

            startAuditLog: function(){
                if (this.checkLicense('AuditLog') && !this.auditLog) {
                    this.defaultArgs.routePrefix = 'setup/audit_log/';
                    this.auditLog = new AuditLogRoute(this.defaultArgs.routePrefix, this.defaultArgs);
                } else {
                    this.accessDenied();
                }
            },

            startUserLog: function(){
                if (this.checkLicense('UserLog') && !this.userLog) {
                    this.defaultArgs.routePrefix = 'setup/user_log/';
                    this.userLog = new UserLogRoute(this.defaultArgs.routePrefix, this.defaultArgs);
                } else {
                    this.accessDenied();
                }
            },

            startStatusColorCodes: function () {
                if (this.checkLicense('StatusColorCodes') && !this.statusColorCodesRouter) {
                    this.defaultArgs.routePrefix = 'setup/status_color_codes/';
                    this.statusColorCodesRouter = new StatusColorCodesRoute(this.defaultArgs.routePrefix, this.defaultArgs);
                } else {
                    this.accessDenied();
                }
            },

            startSupportingText: function () {

                if (this.checkLicense('SupportingText') && !this.supportingTextRouter) {
                    this.defaultArgs.routePrefix = 'setup/supporting_text/';
                    this.supportingTextRouter = new SupportingTextRoute(this.defaultArgs.routePrefix, this.defaultArgs);
                } else {
                    this.accessDenied();
                }
            },

            startEDITemplates: function () {
                if (this.checkLicense('EDITemplates') && !this.ediTemplatesRouter) {
                    this.defaultArgs.routePrefix = 'setup/edi_templates/';
                    this.ediTemplatesRouter = new EDITemplatesRoute(this.defaultArgs.routePrefix, this.defaultArgs);
                } else {
                    this.accessDenied();
                }
            },

            startBillingMessages: function () {
                if (this.checkLicense('BillingMessages') && !this.billingMessagesRouter) {
                    this.defaultArgs.routePrefix = 'setup/billing_messages/';
                    this.billingMessagesRouter = new BillingMessagesRoute(this.defaultArgs.routePrefix, this.defaultArgs);
                } else {
                    this.accessDenied();
                }
            },

            startInsuranceX12Mapping: function () {
                if (this.checkLicense('InsuranceX12Mapping') && !this.insuranceX12MappingRouter) {
                    this.defaultArgs.routePrefix = 'setup/insurance_x12_mapping/';
                    this.insuranceX12MappingRouter = new InsuranceX12MappingRoute(this.defaultArgs.routePrefix, this.defaultArgs);
                } else {
                    this.accessDenied();
                }
            },

            startPaperClaimTemplates: function () {
                if (this.checkLicense('PrinterTemplates') && !this.paperClaimTemplatesRouter) {
                    this.defaultArgs.routePrefix = 'setup/printer_templates/';
                    this.paperClaimTemplatesRouter = new PaperClaimTemplatesRoute(this.defaultArgs.routePrefix, this.defaultArgs);
                } else {
                    this.accessDenied();
                }
            },

            startAutoBilling: function () {
                if (this.checkLicense('AutoBilling') && !this.autoBillingRouter) {
                    this.defaultArgs.routePrefix = 'setup/auto_billing/';
                    this.autoBillingRouter = new AutoBillingRoute(this.defaultArgs.routePrefix, this.defaultArgs);
                } else {
                    this.accessDenied();
                }
            },
            startCollectionsProcess: function () {
                if (this.checkLicense('CollectionsProcess') && !this.collectionsProcessRouter) {
                    this.defaultArgs.routePrefix = 'setup/collections_process/';
                    this.collectionsProcessRouter = new CollectionsProcess(this.defaultArgs.routePrefix, this.defaultArgs);
                } else {
                    this.accessDenied();
                }
            },

            startSubmissionType:  function () {
                if (this.checkLicense('SubmissionTypes') && !this.submissionTypeRouter) {
                    this.defaultArgs.routePrefix = 'setup/submission_types/';
                    this.submissionTypeRouter = new SubmissionTypesRoute(this.defaultArgs.routePrefix, this.defaultArgs);
                } else {
                    this.accessDenied();
                }
            },

            startDelayReason: function(){
                if (this.checkLicense('delayReason') && !this.delayReasonRouter) {
                    this.defaultArgs.routePrefix = 'setup/delay_reason/';
                    this.delayReasonRouter = new DelayReasonRoute(this.defaultArgs.routePrefix, this.defaultArgs);
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

            checkLicense: function () {
                //return layout.checkLicense(currentScreen);
                return true;
            },

            closeRoutes: function () {
                this.billingProviderRouter = null;
            }
        });
    });
