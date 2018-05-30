define([
    'backbone',
    'views/worklist',
    'views/studies',
    'views/claim-workbench',
    'routes/app/index',
    'routes/setup/index',
    'modules/reporting/views/billing/charges',
    'modules/reporting/views/billing/payments',
    'modules/reporting/views/billing/claim_activity',
    'modules/reporting/views/billing/claim_inquiry',
    'modules/reporting/views/billing/patient_statement',
    'modules/reporting/views/billing/modality_summary',
    'modules/reporting/views/billing/payer_mix'
], function (Backbone,
    WorklistView,
    StudiesView,
    ClaimWorkBenchView,
    AppRoute,
    SetupRoute,
    ChargeReportView,
    PaymentReportView) {
        var AppRouter = Backbone.Router.extend({
            routes: {
                "app/worklist": "startApp",
                "app/report": "startReporting",
                "app/studies": "startAppStudies",
                "app/claim_workbench": "startClaimWorkBench",
                "app/reports/charges": "startChargeReporting" ,
                "app/reports/payments": "startPaymentReporting",
                "app/reports/claim_activity": "startClaimActivityReporting",
                "app/reports/claim_inquiry": "startClaimInquiryReporting",
                "app/reports/patient_statement": "startPatientStatementReporting",
                "app/reports/modality_summary": "startModalitySummaryReporting",           
                "app/reports/payer_mix": "startPayerMixReporting",
    
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
    