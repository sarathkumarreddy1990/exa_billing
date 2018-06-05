define([
    'jquery',
    'backbone',
    'backbonesubroute',
    'views/setup/billing-codes'
],
    function (
        $,
        Backbone,
        SubRoute,
        BillingCodesView
        ) {
        var BillingCodeRouter = Backbone.SubRoute.extend({
            routes: {
                'list': 'showGrid',
                'new': 'showForm',
                'edit/:id': 'showEditForm'
            },

            showGrid: function () {
                this.initializeRouter();
                this.billingCodeScreen.showGrid();
            },

            showForm: function () {
                this.initializeRouter();
                this.billingCodeScreen.showForm(0);
            },

            showEditForm: function (id) {
                this.initializeRouter();
                this.billingCodeScreen.showForm(id);
            },

            initialize: function (options) {
                this.options = options;
            },

            initializeRouter: function () {
                this.options.screen = "Billing Codes";
                this.options.currentView = this.billingCodeScreen;
                layout.initializeLayout(this);

                if (!layout.initialized) {
                    this.billingCodeScreen = new BillingCodesView(this.options);
                }
            }
        });

        return BillingCodeRouter;
    });
