define([
    'backbone',
    'views/worklist',
    'views/studies',
    'views/claims/claim-workbench',
    'routes/app/index',
    'routes/setup/index',
    'routes/reports/index',
    'modules/reporting/routes/index',
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
    'views/app/payments',
    'views/app/payment-edit',
    'views/claim-inquiry'
], function (Backbone,
    WorklistView,
    StudiesView,
    ClaimWorkBenchView,
    AppRoute,
    SetupRoute,
    ReportsRoute,
    ReportingRoute,
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
    PaymentsView,
    EditPaymentView,
    claimInquiryScreenView
    ) {
        var AppRouter = Backbone.Router.extend({
            routes: {
                "app/worklist": "startApp",
                "app/studies": "startAppStudies",
                "app/claim_workbench": "startClaimWorkBench",
                "app/reports/charges": "startChargeReporting",
                "app/reports/payments": "startPaymentReporting",
                "app/reports/claim-activity": "startClaimActivityReporting",
                "app/reports/claim-inquiry": "startClaimInquiryReporting",
                "app/reports/patient-statement": "startPatientStatementReporting",
                "app/reports/modality-summary": "startModalitySummaryReporting",
                "app/reports/payer-mix": "startPayerMixReporting",
                "app/reports/payments-by-ins-company": "startPaymentsByInsuranceCompanyReporting",
                "app/reports/referring-provider-count": "startReferringProviderCountReporting",
                "app/reports/referring-provider-summary": "startReferringProviderSummaryReporting",
                "app/reports/transaction-summary": "starttransactionSummaryReporting",
                "app/reports/date-of-SVC-payment-summary": "startDateOfSVCSummaryViewReporting",
                "app/reports/diagnosis-count": "startDiagnosisCountReporting",
                "app/reports/patients-by-insurance-company": "startPatientsByInsuranceCompanyViewReporting",
                "app/reports/procedure-count": "startProcedureCountViewReporting",
                "app/reports/reading-provider-fees": "startReadingProviderFeesReporting",

                "billing/*subroute": "startApp",
                "setup/*subroute": "startSetup",
                "app/payments": "startPayments",
                "app/payments/edit/:id": "editPayment",
                "reports/*subroute": "startReporting",
                "app/claim-inquiry": "startClaimInquiry",
                "app/payments/new": "editPayment"
            },
            
            startApp: function (subroute) {
                if (!this.appRouter) {
                    this.appRouter = new AppRoute("billing/", { createTrailingSlashRoutes: true });
                }
            },

            startSetup: function (subroute) {
                if (!this.setupRouter) {
                    this.setupRouter = new SetupRoute("setup/", { createTrailingSlashRoutes: true });
                }
            },

            startReporting: function (subroute) {
                if (!this.reportingRouter) {
                    this.reportingRouter = new ReportsRoute("reports/", { createTrailingSlashRoutes: true }); // new module, notice plural "/reports" <---
                }
            },

            startAppStudies: function (subroutes) {
                if (!this.appRoute) {
                    this.appRoute = new StudiesView({ el: $('#root') });
                }
            },

            startClaimWorkBench: function (subroutes) {
                if (!this.appClaimWorkBenchRoute) {
                    this.appClaimWorkBenchRoute = new ClaimWorkBenchView({ el: $('#root') });
                }
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

            startPayments: function (subroutes) {
                if (!this.appRoute) {
                    this.appRoute = new PaymentsView({ el: $('#root') });
                }
            },

            editPayment: function (paymentId) {
                if (!this.appRoute) {
                    this.appRoute = new EditPaymentView({ el: $('#root'), id: paymentId });
                }
            },

            startClaimInquiry: function(subroutes){
                if(!this.appRoute){
                    this.appRoute = new claimInquiryScreenView({ el: $('#root') });
                }
            },

            initialize: function () {
                $('#initialLoading').hide();
                $('#root-content').show();
            }
        });
        return {
            initialize: function () {
                new AppRouter();
                Backbone.history.start();
            }
        };
    });