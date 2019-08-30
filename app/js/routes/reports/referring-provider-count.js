define([
    'jquery',
    'backbone',
    'backbonesubroute',
    'shared/routing',
    'views/reports/referring-provider-count'
],
    function (
        $,
        Backbone,
        SubRoute,
        RoutingUtils,
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
                layout.initializeLayout(this);

                if (!layout.initialized) {
                    RoutingUtils.clearView(this.options.currentView);
                    this.options.currentView = this.referringProviderCountScreen = new ReferringProviderCountView(this.options);
                }
            }
        });
    });
