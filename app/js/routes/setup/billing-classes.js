define([
    'jquery',
    'backbone',
    'backbonesubroute',
    'views/setup/billing-classes'
],
    function (
        $,
        Backbone,
        SubRoute,
        BillingClassesView
        ) {
        var BillingClassRouter = Backbone.SubRoute.extend({
            routes: {
                'list': 'showGrid',
                'new': 'showForm',
                'edit/:id': 'showEditForm'
            },

            showGrid: function () {
                this.initializeRouter();
                this.billingClassScreen.showGrid();
            },

            showForm: function () {
                this.initializeRouter();
                this.billingClassScreen.showForm(0);
            },

            showEditForm: function (id) {
                this.initializeRouter();
                this.billingClassScreen.showForm(id);
            },

            initialize: function (options) {
                this.options = options;
            },

            initializeRouter: function () {
                this.options.screen = "Billing Classes";
                this.options.currentView = this.billingClassScreen;
                layout.initializeLayout(this);

                if (!layout.initialized) {
                    this.billingClassScreen = new BillingClassesView(this.options);
                }
            }
        });

        return BillingClassRouter;
    });
