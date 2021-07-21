define([
    'jquery',
    'backbone',
    'backbonesubroute',
    'shared/routing',
    'views/reports/payments-by-ins-company'
],
    function (
        $,
        Backbone,
        SubRoute,
        RoutingUtils,
        PaymentsByInsCompanyView
    ) {
        return Backbone.SubRoute.extend({
            routes: {
                'payments-by-ins-company': 'showDefaultView'
            },

            showDefaultView: function () {
                this.initializeRouter();
                this.paymentByInsCompanyScreen.showForm();
            },

            initialize: function (options) {
                this.options = options;
            },

            initializeRouter: function () {
                this.options.screen = facilityModules.reportScreens.paymentsByinscompany;
                layout.initializeLayout(this);

                if (!layout.initialized) {
                    RoutingUtils.clearView(this.options.currentView);
                    this.options.currentView = this.paymentByInsCompanyScreen = new PaymentsByInsCompanyView(this.options);
                }
            }
        });
    });
