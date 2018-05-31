define([
        'jquery'
        , 'backbone'
        , 'backbonesubroute'
        , 'modules/reporting/utils/routing'
        , 'modules/reporting/views/billing/modality_summary'
    ],
    function ($, Backbone, SubRoute, RoutingUtils, modalitySummaryView) {

        var modalitySummaryRouter = Backbone.SubRoute.extend({
            routes: {
                '': 'showDefaultView'
            },

            showDefaultView: function () {
                console.log('router - showDefaultView');
                this.initializeRouter();
                this.modalitySummaryView.showForm();
            },

            initialize: function (options) {
                this.options = options;
            },

            initializeRouter: function () {
                this.options.screen = facilityModules.reportScreens.modality_summary;
                layout.initializeLayout(this);

                if (!layout.initialized) {
                    RoutingUtils.clearView(this.options.currentView);
                    this.modalitySummaryView = new modalitySummaryView(this.options);
                    this.options.currentView = this.modalitySummaryView;
                }
            }
        });

        return modalitySummaryRouter;
    });
