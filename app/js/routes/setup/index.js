define([
    'backbone',
    'backbonesubroute',
    'views/setup/index',
    'text!templates/access-denied.html',
    'routes/setup/billing-providers',
    'routes/setup/cas-group-codes'
], function (
    Backbone,
    BackboneSubroute,
    SetupView,
    AccessDeniedTemplate,
    BillingProvidersRoute,
    CasGroupCodesRoute
) {
        return Backbone.SubRoute.extend({
            routes: {
                "billing_providers/*subroute": "startBillingProviders",
                "cas_group_codes/*subroute": "startCasGroupCodes"
            },

            accessDeniedTemplate: _.template(AccessDeniedTemplate),

            defaultArgs: {
                createTrailingSlashRoutes: true, layout: null, outerLayout: null, module: null, screen: null, el: '#data_container', routePrefix: null
            },

            accessDenied: function () {
                var self = this;
                $("#data_container").html(self.accessDeniedTemplate);
                $("#divPageHeaderButtons").html("");
            },

            startBillingProviders: function (subroute) {
                if (this.checkLicense('BillingProviders') && !this.billingProviderRouter) {
                    this.defaultArgs.routePrefix = 'setup/billing_providers/';
                    this.billingProviderRouter = new BillingProvidersRoute(this.defaultArgs.routePrefix, this.defaultArgs);
                } else {
                    this.accessDenied();
                }
            },

            startCasGroupCodes: function (subroute) {
                if (this.checkLicense('CasGroupCodes') && !this.casGroupCodeRouter) {
                    this.defaultArgs.routePrefix = 'setup/cas_group_codes/';
                    this.casGroupCodeRouter = new CasGroupCodesRoute(this.defaultArgs.routePrefix, this.defaultArgs);
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
