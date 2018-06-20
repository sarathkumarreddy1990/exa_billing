define([
    'jquery',
    'backbone',
    'backbonesubroute',
    'views/setup/billing-messages'
],
    function (
        $,
        Backbone,
        SubRoute,
        BillingMessagesView
        ) {
        var BillingMessagesRouter = Backbone.SubRoute.extend({
            routes: {
                'list': 'showGrid',
                'new': 'showForm',
                'edit/:id': 'showEditForm'
            },

            showGrid: function () {
                this.initializeRouter();
                this.billingMessageScreen.showGrid();
            },

            showForm: function () {
                this.initializeRouter();
                this.billingMessageScreen.showForm(0);
            },

            showEditForm: function (id) {
                this.initializeRouter();
                this.billingMessageScreen.showForm(id);
            },

            initialize: function (options) {
                this.options = options;
            },

            initializeRouter: function () {
                this.options.screen = "Billing Messages";
                this.options.currentView = this.billingMessageScreen;
                layout.initializeLayout(this);

                if (!layout.initialized) {
                    this.billingMessageScreen = new BillingMessagesView(this.options);
                }
            }
        });

        return BillingMessagesRouter;
    });