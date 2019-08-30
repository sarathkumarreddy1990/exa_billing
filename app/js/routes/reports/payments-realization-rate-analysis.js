define([
    'jquery',
    'backbone',
    'backbonesubroute',
    'shared/routing',
    'views/reports/payments-realization-rate-analysis'
],
    function (
        $,
        Backbone,
        SubRoute,
        RoutingUtils,
        PaymentsRealizationRateAnalysisView
    ) {
        return Backbone.SubRoute.extend({
            routes: {
                'payments-realization-rate-analysis': 'showDefaultView'
            },

            showDefaultView: function () {
                this.initializeRouter();
                this.PaymentsRealizationRateAnalysisScreen.showForm();
            },

            initialize: function (options) {
                this.options = options;
            },

            initializeRouter: function () {
                this.options.screen = facilityModules.reportScreens.paymentsRealizationRateAnalysis;
                layout.initializeLayout(this);

                if (!layout.initialized) {
                    RoutingUtils.clearView(this.options.currentView);
                    this.PaymentsRealizationRateAnalysisScreen = new PaymentsRealizationRateAnalysisView(this.options);
                    this.options.currentView = this.PaymentsRealizationRateAnalysisScreen;
                }
            }
        });
    });
