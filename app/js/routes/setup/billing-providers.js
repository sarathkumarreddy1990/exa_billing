define([
    'jquery',
    'backbone',
    'backbonesubroute',
    'views/setup/billing-providers'
],
    function (
        $,
        Backbone,
        SubRoute,
        BillingProvidersView
    ) {
        var BillingProviderRouter = Backbone.SubRoute.extend({
            routes: {
                'list': 'showGrid',
                'new': 'showForm',
                'edit/:id': 'showEditForm'
            },

            showGrid: function () {
                this.initializeRouter();
                this.billingProvidersScreen.showGrid();
            },

            showForm: function () {
                this.initializeRouter();
                this.billingProvidersScreen.showForm(0);
            },

            showEditForm: function (id) {
                this.initializeRouter();
                this.billingProvidersScreen.showForm(id);
            },

            initialize: function (options) {
                this.options = options;
            },

            initializeRouter: function () {
                this.options.screen = "Billing Providers";//facilityModules.setupScreens.icd;
                this.options.currentView = this.billingProvidersScreen;
                layout.initializeLayout(this);

                if (!layout.initialized) {
                    this.billingProvidersScreen = new BillingProvidersView(this.options);
                }
            }
        });

        return BillingProviderRouter;
    });
