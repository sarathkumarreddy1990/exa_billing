define([
    'backbone',
    'views/worklist',
    'modules/reporting/views/billing/charges',
    'views/studies',
    'views/claim-workbench'
], function (Backbone, WorklistView, ReportView, StudiesView, ClaimWorkBenchView) {
    var AppRouter = Backbone.Router.extend({
        routes: {
            "app/worklist": "startApp",
            "app/report": "startReporting",
            "app/studies": "startAppStudies",
            "app/claim_workbench": "startClaimWorkBench"
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
        }

    });

    return {
        initialize: function () {
            var router = new AppRouter();
            Backbone.history.start();
        }
    };
})