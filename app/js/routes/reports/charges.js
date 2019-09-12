define([
    'jquery',
    'backbone',
    'backbonesubroute',
    'shared/routing',
    'views/reports/charges'
],
    function (
        $,
        Backbone,
        SubRoute,
        RoutingUtils,
        ChargesView
    ) {
        return Backbone.SubRoute.extend({
            routes: {
                'charges': 'showDefaultView'
            },

            showDefaultView: function () {
                this.initializeRouter();
                this.chargesScreen.showForm();
            },

            initialize: function (options) {
                this.options = options;
            },

            initializeRouter: function () {
                this.options.screen = facilityModules.reportScreens.charges;
                layout.initializeLayout(this);

                if (!layout.initialized) {
                    RoutingUtils.clearView(this.options.currentView);
                    this.options.currentView = this.chargesScreen = new ChargesView(this.options);
                }
            }
        });
    });
