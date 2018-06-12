define([
    'jquery',
    'backbone',
    'backbonesubroute',
    'views/reports/monthly-recap'
],
    function (
        $,
        Backbone,
        SubRoute,
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
                this.options.currentView = this.monthlyRecapScreen;
                layout.initializeLayout(this);

                if (!layout.initialized) {
                    this.monthlyRecapScreen = new MonthlyRecapView(this.options);
                }
            }
        });
    });
