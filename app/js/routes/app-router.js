define([
    'backbone',
    'views/worklist',
    'views/studies',
    'views/claim-workbench',
    'routes/setup/index',
    'modules/reporting/views/billing/charges',
    'modules/reporting/views/billing/payments'
], function (Backbone,
    WorklistView,
    StudiesView,
    ClaimWorkBenchView,
    SetupRoute,
    ChargeReportView,
    PaymentReportView) {
        var AppRouter = Backbone.Router.extend({
            routes: {
                "app/worklist": "startApp",
                "app/report": "startReporting",
                "app/studies": "startAppStudies",
                "app/claim_workbench": "startClaimWorkBench",
                "app/report/charges": "startChargeReporting" ,
                "app/report/payments": "startPaymentReporting",
    
                "app/setup/*subroute": "startSetup",
            },

            startApp: function (subroutes) {
                if (!this.appRoute) {
                    this.appRoute = new WorklistView({ el: $('#root') });
                }
            },

            startSetup: function (subroute) {
                if (!this.setupRouter) {
                    this.setupRouter = new SetupRoute("app/setup/", { createTrailingSlashRoutes: true });
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
    