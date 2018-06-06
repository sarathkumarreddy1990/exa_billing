define([
    'backbone',
    'views/worklist',
    'views/studies',
    'views/claims/claim-workbench',
    'routes/app/index',
    'routes/setup/index',
    'routes/reports/index',   
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
    PaymentsView,
    EditPaymentView,
    claimInquiryScreenView
    ) {
        var AppRouter = Backbone.Router.extend({
            routes: {
                "app/worklist": "startApp",
                "app/studies": "startAppStudies",
                "app/claim_workbench": "startClaimWorkBench",              

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