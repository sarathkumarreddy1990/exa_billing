define([
    'jquery',
    'backbone',
    'backbonesubroute',
    'views/reports/charges'
],
    function (
        $,
        Backbone,
        SubRoute,
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
                this.options.currentView = this.chargesScreen;
                layout.initializeLayout(this);

                if (!layout.initialized) {
                    this.chargesScreen = new ChargesView(this.options);
                }
            }
        });
    });
