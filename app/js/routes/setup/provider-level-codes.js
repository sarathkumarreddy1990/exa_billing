define([
    'jquery',
    'backbone',
    'backbonesubroute',
    'views/setup/provider-level-codes'
],
    function (
        $,
        Backbone,
        SubRoute,
        ProviderLevelCodesView
        ) {
        var ProviderLevelCodeRouter = Backbone.SubRoute.extend({
            routes: {
                'list': 'showGrid',
                'new': 'showForm',
                'edit/:id': 'showEditForm'
            },

            showGrid: function () {
                this.initializeRouter();
                this.providerLevelCodeScreen.showGrid();
            },

            showForm: function () {
                this.initializeRouter();
                this.providerLevelCodeScreen.showForm(0);
            },

            showEditForm: function (id) {
                this.initializeRouter();
                this.providerLevelCodeScreen.showForm(id);
            },

            initialize: function (options) {
                this.options = options;
            },

            initializeRouter: function () {
                this.options.screen = "Provider Level Codes";
                this.options.currentView = this.providerLevelCodeScreen;
                layout.initializeLayout(this);

                if (!layout.initialized) {
                    this.providerLevelCodeScreen = new ProviderLevelCodesView(this.options);
                }
            }
        });

        return ProviderLevelCodeRouter;
    });
