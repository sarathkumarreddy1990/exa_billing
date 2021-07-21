define([
    'jquery',
    'backbone',
    'backbonesubroute',
    'views/reports/patient-activity-statement'
],
    function (
        $,
        Backbone,
        SubRoute,
        paymentInvoiceView
    ) {
        return Backbone.SubRoute.extend({
            routes: {
                'payment-invoice': 'showDefaultView' 
            },

            showDefaultView: function () {
                this.initializeRouter();
                this.paymentInvoiceScreenScreen.showForm();
            },

            initialize: function (options) {
                this.options = options;
            },

            initializeRouter: function () {
                this.options.screen = facilityModules.reportScreens.paymentInvoice;
                this.options.currentView = this.paymentInvoiceScreen;
                layout.initializeLayout(this);

                if (!layout.initialized) {
                    this.paymentInvoiceScreen = new paymentInvoiceView(this.options);
                }
            }
        });
    });
