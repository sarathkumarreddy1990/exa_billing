define([
    'backbone',
    'views/worklist',
    'views/studies',
    'views/claims/claim-workbench',
    'routes/app/index',
    'routes/setup/index',
    'routes/reports/index',
    'modules/multichat/utils/chatLoader'
], function (Backbone,
    WorklistView,
    StudiesView,
    ClaimWorkBenchView,
    AppRoute,
    SetupRoute,
    ReportsRoute,
    chatLoader
) {
        var AppRouter = Backbone.Router.extend({
            routes: {
                "setup/*subroute": "startSetup",
                "reports/*subroute": "startReporting",
                "billing/*subroute": "startApp",
            },

            startApp: function () {
                if (!this.appRouter) {
                    this.appRouter = new AppRoute("billing/", { createTrailingSlashRoutes: true });
                }
            },

            startSetup: function () {
                if (!this.setupRouter) {
                    this.setupRouter = new SetupRoute("setup/", { createTrailingSlashRoutes: true });
                }
            },

            startReporting: function () {
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
                chatLoader.loadChat(Backbone.history.getFragment());
            }
        };
    });
