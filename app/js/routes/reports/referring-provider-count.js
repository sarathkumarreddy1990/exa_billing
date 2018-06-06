define([
    'jquery',
    'backbone',
    'backbonesubroute',
    'views/reports/referring-provider-count'
],
    function (
        $,
        Backbone,
        SubRoute,
        ReferringProviderCountView
    ) {
        return Backbone.SubRoute.extend({
            routes: {
                'referring-provider-count': 'showDefaultView'
            },

            showDefaultView: function () {
                this.initializeRouter();
                this.referringProviderCountScreen.showForm();
            },

            initialize: function (options) {
                this.options = options;
            },

            initializeRouter: function () {
                this.options.screen = facilityModules.reportScreens.referringProviderCount;
                this.options.currentView = this.referringProviderCountScreen;
                layout.initializeLayout(this);

                if (!layout.initialized) {
                    this.referringProviderCountScreen = new ReferringProviderCountView(this.options);
                }
            }
        });
    });
