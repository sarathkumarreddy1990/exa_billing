define([
    'backbone',
    'backbonesubroute',
    'text!templates/access-denied.html',
    'modules/reporting/views/billing/charges',
    'modules/reporting/views/billing/payments',
    'modules/reporting/views/billing/claim-activity',
    'modules/reporting/views/billing/claim-inquiry',
    'modules/reporting/views/billing/patient-statement',
    'modules/reporting/views/billing/modality-summary',
    'modules/reporting/views/billing/payer-mix',
    'modules/reporting/views/billing/payments-by-ins-company',
    'modules/reporting/views/billing/referring-provider-count',
    'modules/reporting/views/billing/referring-provider-summary',
    'modules/reporting/views/billing/transaction-summary',
    'modules/reporting/views/billing/date-of-SVC-payment-summary',
    'modules/reporting/views/billing/diagnosis-count',
    'modules/reporting/views/billing/patients-by-insurance-company',
    'modules/reporting/views/billing/procedure-count',
    'modules/reporting/views/billing/reading-provider-fees',
], function (
    Backbone,
    BackboneSubroute,
    AccessDeniedTemplate,
    ChargeReportView,
    PaymentReportView,
    ClaimActivityView,
    ClaimInquiryView,
    PatientStatementView,
    MoadalitySummaryView,
    PayerMixView,
    PaymentByInsCompanyView,
    ReferringProviderCountView,
    ReferringProviderSummaryView,
    TransactionSummaryView,
    DateOfSVCSummaryView,
    DiagnosisCountView,
    PatientsByInsuranceCompanyView,
    ProcedureCountView,
    ReadingProviderFeesView,
    ) {
        return Backbone.SubRoute.extend({
            routes: {
                "charges": "startChargeReporting",
                "payments": "startPaymentReporting",
                "claim-activity": "startClaimActivityReporting",
                "claim-inquiry": "startClaimInquiryReporting",
                "patient-statement": "startPatientStatementReporting",
                "modality-summary": "startModalitySummaryReporting",
                "payer-mix": "startPayerMixReporting",
                "payments-by-ins-company": "startPaymentsByInsuranceCompanyReporting",
                "referring-provider-count": "startReferringProviderCountReporting",
                "referring-provider-summary": "startReferringProviderSummaryReporting",
                "transaction-summary": "starttransactionSummaryReporting",
                "date-of-SVC-payment-summary": "startDateOfSVCSummaryViewReporting",
                "diagnosis-count": "startDiagnosisCountReporting",
                "patients-by-insurance-company": "startPatientsByInsuranceCompanyViewReporting",
                "procedure-count": "startProcedureCountViewReporting",
                "reading-provider-fees": "startReadingProviderFeesReporting",
            },

            accessDeniedTemplate: _.template(AccessDeniedTemplate),

            // defaultArgs: {
            //     createTrailingSlashRoutes: true, layout: siteLayouts.report, outerLayout: null, module: facilityModules.report, screen: null, el: '#data_container', routePrefix: null
            // },

            accessDenied: function () {
                var self = this;
                $("#data_container").html(self.accessDeniedTemplate);
                $("#divPageHeaderButtons").html("");
            },

                     
    
            startChargeReporting: function (subroutes) {
                if (!this.reportingRoute) {             
                    this.reportingRoute = new ChargeReportView({ el: $('#root') });
                }
            },   

            startPaymentReporting: function (subroutes) {
                if (!this.reportingRoute) {             
                    this.reportingRoute = new PaymentReportView({ el: $('#root') });
                }
            },    

            startPaymentReporting: function (subroutes) {
                if (!this.reportingRoute) {             
                    this.reportingRoute = new PaymentReportView({ el: $('#root') });
                }
            },    
          
            startClaimActivityReporting: function (subroutes) {
                if (!this.reportingRoute) {             
                    this.reportingRoute = new ClaimActivityView({ el: $('#root') });
                }
            },

            startClaimInquiryReporting: function (subroutes) {
                if (!this.reportingRoute) {             
                    this.reportingRoute = new ClaimInquiryView({ el: $('#root') });
                }
            },

            startPatientStatementReporting: function (subroutes) {
                if (!this.reportingRoute) {             
                    this.reportingRoute = new PatientStatementView({ el: $('#root') });
                }
            },

            startModalitySummaryReporting: function (subroutes) {
                if (!this.reportingRoute) {             
                    this.reportingRoute = new MoadalitySummaryView({ el: $('#root') });
                }
            }, 

            startPayerMixReporting: function (subroutes) {
                if (!this.reportingRoute) {             
                    this.reportingRoute = new PayerMixView({ el: $('#root') });
                }
            },
            
            startPaymentsByInsuranceCompanyReporting: function (subroutes) {
                if (!this.reportingRoute) {             
                    this.reportingRoute = new PaymentByInsCompanyView({ el: $('#root') });
                }
            },  

            startReferringProviderCountReporting: function (subroutes) {
                if (!this.reportingRoute) {             
                    this.reportingRoute = new ReferringProviderCountView({ el: $('#root') });
                }
            },

            startReferringProviderSummaryReporting: function (subroutes) {
                if (!this.reportingRoute) {             
                    this.reportingRoute = new ReferringProviderSummaryView({ el: $('#root') });
                }
            },

            starttransactionSummaryReporting: function (subroutes) {
                if (!this.reportingRoute) {             
                    this.reportingRoute = new TransactionSummaryView({ el: $('#root') });
                }
            },

            startDateOfSVCSummaryViewReporting: function (subroutes) {
                if (!this.reportingRoute) {             
                    this.reportingRoute = new DateOfSVCSummaryView({ el: $('#root') });
                }
            },

            startDiagnosisCountReporting: function (subroutes) {
                if (!this.reportingRoute) {             
                    this.reportingRoute = new DiagnosisCountView({ el: $('#root') });
                }
            },

            startPatientsByInsuranceCompanyViewReporting: function (subroutes) {
                if (!this.reportingRoute) {             
                    this.reportingRoute = new PatientsByInsuranceCompanyView({ el: $('#root') });
                }
            },

            startProcedureCountViewReporting: function (subroutes) {
                if (!this.reportingRoute) {             
                    this.reportingRoute = new ProcedureCountView({ el: $('#root') });
                }
            },

            startReadingProviderFeesReporting: function (subroutes) {
                if (!this.reportingRoute) {             
                    this.reportingRoute = new ReadingProviderFeesView({ el: $('#root') });
                }
            },

            initialize: function (options) {
                this.options = options;
            },

            initializeRouter: function () {
                this.options.screen = "Reports";
                this.options.currentView = this.adjustmentCodeScreen;
                layout.initializeLayout(this);

                if (!layout.initialized) {
                    this.adjustmentCodeScreen = new AdjustmentCodesView(this.options);
                }
            },

            // initialize: function () {
            //     if (!this.setupView) {
            //         this.setupView = new SetupView({ el: $('#root') });
            //         this.defaultArgs.outerLayout = this.setupView;
            //     }
            // },

            checkLicense: function (currentScreen) {
                //return layout.checkLicense(currentScreen);
                return true;
            },
        });
    });
