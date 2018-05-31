define([
    'backbone',
    'views/worklist',
    'views/studies',
    'views/claim-workbench',
    'routes/app/index',
    'routes/setup/index',
    'modules/reporting/views/billing/charges',
    'modules/reporting/views/billing/payments',
    'views/payments',
    'views/payment-edit'
], function (Backbone,
    WorklistView,
    StudiesView,
    ClaimWorkBenchView,
    AppRoute,
    SetupRoute,
    ChargeReportView,
    PaymentReportView,
    PaymentsView,
    EditPaymentView
    ) {
        var AppRouter = Backbone.Router.extend({
            routes: {
                "app/worklist": "startApp",
                "app/report": "startReporting",
                "app/studies": "startAppStudies",
                "app/claim_workbench": "startClaimWorkBench",
                "app/report/charges": "startChargeReporting" ,
                "app/report/payments": "startPaymentReporting",
    
                // "app/*subroute": "startApp",
                "setup/*subroute": "startSetup",
                "app/payments": "startPayments",
                "app/payments/edit/:id": "editPayment"
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
    