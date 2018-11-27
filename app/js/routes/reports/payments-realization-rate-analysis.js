define([
    'jquery',
    'backbone',
    'backbonesubroute',
    'views/reports/payments-realization-rate-analysis'
],
    function (
        $,
        Backbone,
        SubRoute,
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
                this.options.currentView = this.PaymentsRealizationRateAnalysisScreen;
                layout.initializeLayout(this);

                if (!layout.initialized) {
                    this.PaymentsRealizationRateAnalysisScreen = new PaymentsRealizationRateAnalysisView(this.options);
                }
            }
        });
    });
