define([
    'jquery',
    'backbone',
    'backbonesubroute',
    'shared/routing',
    'views/reports/referring-provider-summary'
],
    function (
        $,
        Backbone,
        SubRoute,
        RoutingUtils,
        ReferringProviderSummaryView
    ) {
        return Backbone.SubRoute.extend({
            routes: {
                'referring-provider-summary': 'showDefaultView'
            },

            showDefaultView: function () {
                this.initializeRouter();
                this.referringProviderSummaryScreen.showForm();
            },

            initialize: function (options) {
                this.options = options;
            },

            initializeRouter: function () {
                this.options.screen = facilityModules.reportScreens.referringprovidersummary;
                layout.initializeLayout(this);

                if (!layout.initialized) {
                    RoutingUtils.clearView(this.options.currentView);
                    this.referringProviderSummaryScreen = new ReferringProviderSummaryView(this.options);
                    this.options.currentView = this.referringProviderSummaryScreen;
                }
            }
        });
    });
