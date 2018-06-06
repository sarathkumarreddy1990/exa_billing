define([
    'jquery',
    'backbone',
    'backbonesubroute',
    'views/setup/payment-reasons'
],
    function ($, Backbone, SubRoute, PaymentReasonsView) {
        var PaymentReasonsRouter = Backbone.SubRoute.extend({
            routes: {
                'list': 'showGrid',
                'new': 'showForm',
                'edit/:id': 'showEditForm'
            },

            showGrid: function () {
                this.initializeRouter();
                this.paymentReasonsScreen.showGrid();
            },

            showForm: function () {
                this.initializeRouter();
                this.paymentReasonsScreen.showForm(0);
            },

            showEditForm: function (id) {
                this.initializeRouter();
                this.paymentReasonsScreen.showForm(id);
            },

            initialize: function (options) {
                this.options = options;
            },

            initializeRouter: function () {
                this.options.screen = "Payment Reasons";
                this.options.currentView = this.paymentReasonsScreen;
                layout.initializeLayout(this);

                if (!layout.initialized) {
                    this.paymentReasonsScreen = new PaymentReasonsView(this.options);
                }
            }
        });

        return PaymentReasonsRouter;
    });

