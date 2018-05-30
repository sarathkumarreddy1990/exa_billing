define([
    'backbone',
    'backbonesubroute',
    'views/setup/index',
    'text!templates/access-denied.html',
    'routes/setup/billing-providers'
], function (
    Backbone,
    BackboneSubroute,
    SetupView,
    AccessDeniedTemplate,
    BillingProvidersRoute
) {
        return Backbone.SubRoute.extend({
            routes: {
                "billing_providers/*subroute": "startBillingProviders"
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

            startBillingProviders: function (subroute) {
                if (this.checkLicense('BillingProviders') && !this.billingProviderRouter) {
                    this.defaultArgs.routePrefix = 'app/setup/billing_providers/';
                    this.billingProviderRouter = new BillingProvidersRoute(this.defaultArgs.routePrefix, this.defaultArgs);
                } else {
                    this.accessDenied();
                }
            },

            initialize: function () {
                if (!this.setupView) {
                    this.setupView = new SetupView({ el: $('#root') });
                    this.defaultArgs.outerLayout = this.setupView;
                }
            },

            checkLicense: function (currentScreen) {
                //return layout.checkLicense(currentScreen);
                return true;
            },

            closeRoutes: function () {
                this.billingProviderRouter = null;
            }
        });
    });
