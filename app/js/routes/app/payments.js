define([
    'jquery',
    'backbone',
    'backbonesubroute',
    'views/app/payments',
    'views/app/payment-edit'
],
    function (
        $,
        Backbone,
        SubRoute,
        paymentsView,
        editPayementView
        ) {
        var paymentsRouter = Backbone.SubRoute.extend({
            routes: {
                "edit/:id": "editPayment",
                "new": "newPayment",
                "list": "allPayments"
            },

            editPayment: function (id) {
                this.initializeEditRouter();
                this.editPaymentsScreen.render(id);
            },

            newPayment: function () {
                this.initializeEditRouter();
                this.editPaymentsScreen.render(0);
            },

            allPayments: function () {
                this.initializeRouter();
                this.paymentsScreen.showGrid();
            },

            initialize: function (options) {
                this.options = options;
            },

            initializeRouter: function () {
                this.options.screen = "Payments";
                this.options.currentView = this.paymentsScreen;
                layout.initializeLayout(this);

                if (!layout.initialized) {
                    this.paymentsScreen = new paymentsView(this.options);
                }
            },

            initializeEditRouter: function () {
                this.options.screen = "Edit Payments";
                this.options.currentView = this.editPaymentsScreen;
                layout.initializeLayout(this);

                if (!layout.initialized) {
                    this.editPaymentsScreen = new editPayementView(this.options);
                }
            }
        });

        return paymentsRouter;
    });
