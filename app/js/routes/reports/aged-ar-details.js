define([
    'jquery',
    'backbone',
    'backbonesubroute',
    'shared/routing',
    'views/reports/aged-ar-details'
],
    function (
        $,
        Backbone,
        SubRoute,
        RoutingUtils,
        AgedARDetailsView
    ) {
        return Backbone.SubRoute.extend({
            routes: {
                'aged-ar-details': 'showDefaultView'
            },

            showDefaultView: function () {
                this.initializeRouter();
                this.agedARDetailScreen.showForm();
            },

            initialize: function (options) {
                this.options = options;
            },

            initializeRouter: function () {
        agedardetails: 'Aged AR Details',
                this.options.screen = facilityModules.reportScreens.agedardetails;
                layout.initializeLayout(this);

                if (!layout.initialized) {
                    RoutingUtils.clearView(this.options.currentView);
                    this.agedARDetailScreen = new AgedARDetailsView(this.options);
                    this.options.currentView = this.agedARDetailScreen;
                }
            }
        });
    });
