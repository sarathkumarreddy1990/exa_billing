define([
    'jquery',
    'backbone',
    'backbonesubroute',
    'views/reports/referring-provider-summary'
],
    function (
        $,
        Backbone,
        SubRoute,
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
                this.options.currentView = this.referringProviderSummaryScreen;
                layout.initializeLayout(this);

                if (!layout.initialized) {
                    this.referringProviderSummaryScreen = new ReferringProviderSummaryView(this.options);
                }
            }
        });
    });
