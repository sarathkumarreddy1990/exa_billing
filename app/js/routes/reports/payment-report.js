define([
    'jquery',
    'backbone',
    'backbonesubroute',
    'views/reports/payment-report'
],
    function (
        $,
        Backbone,
        SubRoute,
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
                this.options.currentView = this.paymentScreen;
                layout.initializeLayout(this);

                if (!layout.initialized) {
                    this.paymentScreen = new PaymentsView(this.options);
                }
            }
        });
    });
