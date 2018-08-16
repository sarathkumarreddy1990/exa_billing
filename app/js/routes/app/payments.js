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
                "list": "showAllPayments",
                "filter": "filterPayments",
                "filter/:from": "filterPatientPayments",
                "list/:from": "showAllPayments",
                "edit/:from/:id": "editPatientPayment",
                "new/:from": "newPayment",
            },

            editPayment: function (id) {
                this.initializeEditRouter();
                this.editPaymentsScreen.render(id);
            },

            editPatientPayment: function (from, id) {
                this.initializeEditRouter();
                this.editPaymentsScreen.render(id, from);
            },

            newPayment: function (from) {
                this.initializeEditRouter();
                this.editPaymentsScreen.render(0, from);
            },

            showAllPayments: function (from) {
                this.initializeRouter();
                this.paymentsScreen.showGrid(false, from);
            },

            filterPayments: function () {
                this.initializeRouter();
                this.paymentsScreen.showGrid(true);
            },

            filterPatientPayments: function (from) {
                this.initializeRouter();
                this.paymentsScreen.showGrid(true, from);
            },

            initialize: function (options) {
                this.options = options;
            },

            initializeRouter: function () {
                this.options.screen = "Payments";
                this.options.currentView = this.paymentsScreen;
                this.options.module ="Payments";
                layout.initializeLayout(this);

                if (!layout.initialized) {
                    this.paymentsScreen = new paymentsView(this.options);
                }
            },

            initializeEditRouter: function () {
                this.options.screen = "Edit Payments";
                this.options.currentView = this.editPaymentsScreen;
                this.options.module ="Payments";
                layout.initializeLayout(this);

                if (!layout.initialized) {
                    this.editPaymentsScreen = new editPayementView(this.options);
                }
            }
        });

        return paymentsRouter;
    });
