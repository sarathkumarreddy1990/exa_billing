define([
    'backbone',
    'backbonesubroute',
    'views/app/index',
    'text!templates/access-denied.html',
    'routes/app/studies',
    'routes/app/claims',
    'routes/app/payments'
], function (
    Backbone,
    BackboneSubroute,
    AppView,
    AccessDeniedTemplate,
    StudiesRoute,
    ClaimWorkBenchRoute,
    PaymentsRoute
) {
        return Backbone.SubRoute.extend({
            routes: {
                "studies/*subroute": "startStudies",
                "claim_workbench/*subroute": "startClaimWorkbench",
                "payments/*subroute": "startPayments"
            },

            accessDeniedTemplate: _.template(AccessDeniedTemplate),

            defaultArgs: {
                createTrailingSlashRoutes: true, layout: siteLayouts.facility, outerLayout: null, module: facilityModules.setup, screen: null, el: '#data_container', routePrefix: null
            },

            accessDenied: function () {
                var self = this;
                $("#data_container").html(self.accessDeniedTemplate);
                $("#divPageHeaderButtons").html("");
            },

            startStudies: function (subroute) {
                if (this.checkLicense('Studies') && !this.studiesRouter) {
                    this.defaultArgs.routePrefix = 'billing/studies/';
                    this.studiesRouter = new StudiesRoute(this.defaultArgs.routePrefix, this.defaultArgs);
                } else {
                    this.accessDenied();
                }
            },

            startClaimWorkbench: function (subroute) {
                if (this.checkLicense('ClaimWorkbench') && !this.claimWorkbenchRouter) {
                    this.defaultArgs.routePrefix = 'billing/claim_workbench/';
                    this.claimWorkbenchRouter = new ClaimWorkBenchRoute(this.defaultArgs.routePrefix, this.defaultArgs);
                } else {
                    this.accessDenied();
                }
            },

            startPayments: function (subroute) {
                if (this.checkLicense('Payments') && !this.paymentsRouter) {
                    this.defaultArgs.routePrefix = 'billing/payments/';
                    this.paymentsRouter = new PaymentsRoute(this.defaultArgs.routePrefix, this.defaultArgs);
                } else {
                    this.accessDenied();
                }
            },

            initialize: function () {
                if (!this.appView) {
                    this.appView = new AppView({ el: $('#root') });
                    this.defaultArgs.outerLayout = this.appView;
                }
            },

            checkLicense: function (currentScreen) {
                //return layout.checkLicense(currentScreen);
                return true;
            },

            closeRoutes: function () {
                this.studiesRouter = null;
            }
        });
    });
