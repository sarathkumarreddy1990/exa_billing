define([
    'jquery',
    'backbone',
    'backbonesubroute',
    'views/reports/aged-ar-summary'
],
    function (
        $,
        Backbone,
        SubRoute,
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
                this.options.currentView = this.agedARSummaryScreen;
                layout.initializeLayout(this);

                if (!layout.initialized) {
                    this.agedARSummaryScreen = new AgedARSummaryView(this.options);
                }
            }
        });
    });
