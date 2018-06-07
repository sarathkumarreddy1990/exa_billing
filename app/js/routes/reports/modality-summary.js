define([
    'jquery',
    'backbone',
    'backbonesubroute',
    'views/reports/modality-summary'
],
    function (
        $,
        Backbone,
        SubRoute,
        ModalitySummaryView
    ) {
        return Backbone.SubRoute.extend({
            routes: {
                'modality-summary': 'showDefaultView'
            },

            showDefaultView: function () {
                this.initializeRouter();
                this.modalitySummaryScreen.showForm();
            },

            initialize: function (options) {
                this.options = options;
            },

            initializeRouter: function () {
                this.options.screen = facilityModules.reportScreens.modalitySummary;
                this.options.currentView = this.modalitySummaryScreen;
                layout.initializeLayout(this);

                if (!layout.initialized) {
                    this.modalitySummaryScreen = new ModalitySummaryView(this.options);
                }
            }
        });
    });
