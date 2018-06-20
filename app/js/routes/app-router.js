define([
    'backbone',
    'views/worklist',
    'views/studies',
    'views/claims/claim-workbench',
    'routes/app/index',
    'routes/setup/index',
    'routes/reports/index'
], function (Backbone,
    WorklistView,
    StudiesView,
    ClaimWorkBenchView,
    AppRoute,
    SetupRoute,
    ReportsRoute
) {
        var AppRouter = Backbone.Router.extend({
            routes: {
                "setup/*subroute": "startSetup",
                "reports/*subroute": "startReporting",
                "billing/*subroute": "startApp",
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
    