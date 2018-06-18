define([
    'jquery',
    'backbone',
    'backbonesubroute',
    'views/reports/payments-by-ins-company'
],
    function (
        $,
        Backbone,
        SubRoute,
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
                this.options.screen = facilityModules.reportScreens.inscompany;
                this.options.currentView = this.paymentByInsCompanyScreen;
                layout.initializeLayout(this);

                if (!layout.initialized) {
                    this.paymentByInsCompanyScreen = new PaymentsByInsCompanyView(this.options);
                }
            }
        });
    });
