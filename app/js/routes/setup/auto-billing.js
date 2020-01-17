define([
    'jquery',
    'backbone',
    'backbonesubroute',
    'views/setup/auto-billing'
],
    function (
        $,
        Backbone,
        SubRoute,
        AutoBillingView
    ) {
        var AutoBillingRouter = Backbone.SubRoute.extend({
            routes: {
                'list': 'showGrid',
                'new': 'showForm',
                'edit/:id': 'showEditForm'
            },

            showGrid: function () {
                this.initializeRouter();
                this.autoBillingScreen.showGrid();
            },

            showForm: function () {
                this.initializeRouter();
                this.autoBillingScreen.showForm(0);
            },

            showEditForm: function (id) {
                this.initializeRouter();
                this.autoBillingScreen.showForm(id);
            },

            initialize: function (options) {
                this.options = options;
            },

            initializeRouter: function () {
                this.options.screen = "Auto Billing";
                this.options.currentView = this.autoBillingScreen;
                layout.initializeLayout(this);

                if (!layout.initialized) {
                    this.autoBillingScreen = new AutoBillingView(this.options);
                }
            }
        });

        return AutoBillingRouter;
    });
