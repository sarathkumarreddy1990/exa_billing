define([
    'jquery',
    'backbone',
    'backbonesubroute',
    'views/reports/aged-ar-details'
],
    function (
        $,
        Backbone,
        SubRoute,
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
                this.options.currentView = this.agedARDetailScreen;
                layout.initializeLayout(this);

                if (!layout.initialized) {
                    this.agedARDetailScreen = new AgedARDetailsView(this.options);
                }
            }
        });
    });
