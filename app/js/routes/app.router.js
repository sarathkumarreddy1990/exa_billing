define([
    'backbone',
    'views/worklist',
    'modules/reporting/views/billing/charges'
], function (Backbone, WorklistView, ReportView) {
    var AppRouter = Backbone.Router.extend({
        routes: {
            "app/worklist": "startApp" ,
            "app/report": "startReporting" 
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
        }
    });

    return {
        initialize: function () {
            var router = new AppRouter();
            Backbone.history.start();
        }
    };
})