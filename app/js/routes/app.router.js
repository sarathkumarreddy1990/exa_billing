define([
    'backbone',
    'views/worklist',   
    'views/studies',
    'views/claim-workbench',
    'modules/reporting/views/billing/charges',
    'modules/reporting/views/billing/payments'
], function (Backbone, WorklistView, StudiesView, ClaimWorkBenchView, ChargeReportView, PaymentReportView) {
    var AppRouter = Backbone.Router.extend({
        routes: {
            "app/worklist": "startApp",
            "app/report": "startReporting",
            "app/studies": "startAppStudies",
            "app/claim_workbench": "startClaimWorkBench",
            "app/report/charges": "startChargeReporting" ,
            "app/report/payments": "startPaymentReporting"
        },

        startApp: function (subroutes) {
            if (!this.appRoute) {
                this.appRoute = new WorklistView({ el: $('#root') });
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
        }

    });

    return {
        initialize: function () {
            var router = new AppRouter();
            Backbone.history.start();
        }
    };
})