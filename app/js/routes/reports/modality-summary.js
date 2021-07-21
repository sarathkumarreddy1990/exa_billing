define([
    'jquery',
    'backbone',
    'backbonesubroute',
    'shared/routing',
    'views/reports/modality-summary'
],
    function (
        $,
        Backbone,
        SubRoute,
        RoutingUtils,
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
                layout.initializeLayout(this);

                if (!layout.initialized) {
                    RoutingUtils.clearView(this.options.currentView);
                    this.options.currentView = this.modalitySummaryScreen = new ModalitySummaryView(this.options);
                }
            }
        });
    });
