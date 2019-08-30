define([
    'jquery',
    'backbone',
    'backbonesubroute',
    'shared/routing',
    'views/reports/aged-ar-summary'
],
    function (
        $,
        Backbone,
        SubRoute,
        RoutingUtils,
        AgedARSummaryView
    ) {
        return Backbone.SubRoute.extend({
            routes: {
                'aged-ar-summary': 'showDefaultView'
            },

            showDefaultView: function () {
                this.initializeRouter();
                this.agedARSummaryScreen.showForm();
            },

            initialize: function (options) {
                this.options = options;
            },

            initializeRouter: function () {
                this.options.screen = facilityModules.reportScreens.agedarsummary;
                layout.initializeLayout(this);

                if (!layout.initialized) {
                    RoutingUtils.clearView(this.options.currentView);
                    this.options.currentView = this.agedARSummaryScreen = new AgedARSummaryView(this.options);
                }
            }
        });
    });
