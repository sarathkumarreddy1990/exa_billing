define([
    'jquery',
    'backbone',
    'backbonesubroute',
    'shared/routing',
    'views/reports/reading-provider-fees'
],
    function (
        $,
        Backbone,
        SubRoute,
        RoutingUtils,
        ReadingProviderFeesView
    ) {
        return Backbone.SubRoute.extend({
            routes: {
                'reading-provider-fees': 'showDefaultView'
            },

            showDefaultView: function () {
                this.initializeRouter();
                this.readingProviderFeesScreen.showForm();
            },

            initialize: function (options) {
                this.options = options;
            },

            initializeRouter: function () {
                this.options.screen = facilityModules.reportScreens.readingProviderFees;
                layout.initializeLayout(this);

                if (!layout.initialized) {
                    RoutingUtils.clearView(this.options.currentView);
                    this.readingProviderFeesScreen = new ReadingProviderFeesView(this.options);
                    this.options.currentView = this.readingProviderFeesScreen;
                }
            }
        });
    });
