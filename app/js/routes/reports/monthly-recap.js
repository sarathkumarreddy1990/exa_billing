define([
    'jquery',
    'backbone',
    'backbonesubroute',
    'shared/routing',
    'views/reports/monthly-recap'
],
    function (
        $,
        Backbone,
        SubRoute,
        RoutingUtils,
        MonthlyRecapView
    ) {
        return Backbone.SubRoute.extend({
            routes: {
                'monthly-recap': 'showDefaultView'
            },

            showDefaultView: function () {
                this.initializeRouter();
                this.monthlyRecapScreen.showForm();
            },

            initialize: function (options) {
                this.options = options;
            },

            initializeRouter: function () {
                this.options.screen = facilityModules.reportScreens.monthlyRecap;
                layout.initializeLayout(this);

                if (!layout.initialized) {
                    RoutingUtils.clearView(this.options.currentView);
                    this.monthlyRecapScreen = new MonthlyRecapView(this.options);
                    this.options.currentView = this.monthlyRecapScreen;
                }
            }
        });
    });
