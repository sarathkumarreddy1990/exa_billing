define([
    'jquery',
    'backbone',
    'backbonesubroute',
    'shared/routing',
    'views/reports/payment-report'
],
    function (
        $,
        Backbone,
        SubRoute,
        RoutingUtils,
        PaymentsView
    ) {
        return Backbone.SubRoute.extend({
            routes: {
                'payment-report': 'showDefaultView'
            },

            showDefaultView: function () {
                this.initializeRouter();
                this.paymentScreen.showForm();
            },

            initialize: function (options) {
                this.options = options;
            },

            initializeRouter: function () {
                this.options.screen = facilityModules.reportScreens.paymentReport;
                layout.initializeLayout(this);

                if (!layout.initialized) {
                    RoutingUtils.clearView(this.options.currentView);
                    this.options.currentView = this.paymentScreen = new PaymentsView(this.options);
                }
            }
        });
    });
