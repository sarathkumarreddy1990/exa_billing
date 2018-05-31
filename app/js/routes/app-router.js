define([
    'backbone',
    'views/worklist',
    'views/studies',
    'views/claim-workbench',
    'routes/app/index',
    'routes/setup/index',
    'modules/reporting/views/billing/charges',
    'modules/reporting/views/billing/payments',
    'modules/reporting/views/billing/claim-activity',
    'modules/reporting/views/billing/claim-inquiry',
    'modules/reporting/views/billing/patient-statement',
    'modules/reporting/views/billing/modality-summary',
    'modules/reporting/views/billing/payer-mix',
    'modules/reporting/views/billing/payments_by_ins_company',
    'modules/reporting/views/billing/referring_provider_count'
], function (Backbone,
    WorklistView,
    StudiesView,
    ClaimWorkBenchView,
    AppRoute,
    SetupRoute,
    ChargeReportView,
    PaymentReportView,
    ClaimActivityView, 
    ClaimInquiryView, 
    PatientStatementView, 
    MoadalitySummaryView, 
    PayerMixView,
    PaymentByInsCompanyView,
    ReferringProviderCountView
    ) {
        var AppRouter = Backbone.Router.extend({
            routes: {
                "app/worklist": "startApp",
                "app/report": "startReporting",
                "app/studies": "startAppStudies",
                "app/claim_workbench": "startClaimWorkBench",
                "app/reports/charges": "startChargeReporting" ,
                "app/reports/payments": "startPaymentReporting",
                "app/reports/claim-activity": "startClaimActivityReporting",
                "app/reports/claim-inquiry": "startClaimInquiryReporting",
                "app/reports/patient-statement": "startPatientStatementReporting",
                "app/reports/modality-summary": "startModalitySummaryReporting",           
                "app/reports/payer-mix": "startPayerMixReporting",
                "app/reports/payments_by_ins_company": "startPaymentsByInsuranceCompanyReporting",
                "app/reports/referring_provider_count": "startReferringProviderCountReporting",
    
                "app/*subroute": "startApp",
                "setup/*subroute": "startSetup",
            },

            // startApp: function (subroutes) {
            //     if (!this.appRoute) {
            //         this.appRoute = new WorklistView({ el: $('#root') });
            //     }
            // },

            startApp: function (subroute) {
                if (!this.appRouter) {
                    this.appRouter = new AppRoute("app/", { createTrailingSlashRoutes: true });
                }
            },

            startSetup: function (subroute) {
                if (!this.setupRouter) {
                    this.setupRouter = new SetupRoute("setup/", { createTrailingSlashRoutes: true });
                }
            },

            startReporting: function (subroutes) {
                if (!this.reportingRoute) {
                    // this.reportingRoute = new ReportView("reports/", { createTrailingSlashRoutes: true });
                    this.reportingRoute = new ReportView({ el: $('#root') });
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
    