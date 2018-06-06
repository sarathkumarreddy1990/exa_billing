define([
    'jquery',
    'backbone',
    'backbonesubroute',
    'views/reports/reading-provider-fees'
],
    function (
        $,
        Backbone,
        SubRoute,
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
                this.options.currentView = this.readingProviderFeesScreen;
                layout.initializeLayout(this);

                if (!layout.initialized) {
                    this.readingProviderFeesScreen = new ReadingProviderFeesView(this.options);
                }
            }
        });
    });
