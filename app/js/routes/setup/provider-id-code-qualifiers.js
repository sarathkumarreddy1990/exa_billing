define([
    'jquery',
    'backbone',
    'backbonesubroute',
    'views/setup/provider-id-code-qualifiers'
],
    function ($, Backbone, SubRoute, ProviderIdCodeQualifiersView) {
        var ProvierIdCodeQualifiersRouter = Backbone.SubRoute.extend({
            routes: {
                'list': 'showGrid',
                'new': 'showForm',
                'edit/:id': 'showEditForm'
            },

            showGrid: function () {
                this.initializeRouter();
                this.providerIdCodeQualifiersScreen.showGrid();
            },

            showForm: function () {
                this.initializeRouter();
                this.providerIdCodeQualifiersScreen.showForm(0);
            },

            showEditForm: function (id) {
                this.initializeRouter();
                this.providerIdCodeQualifiersScreen.showForm(id);
            },

            initialize: function (options) {
                this.options = options;
            },

            initializeRouter: function () {
                this.options.screen = "Provider ID Code Qualifiers";
                this.options.currentView = this.providerIdCodeQualifiersScreen;
                layout.initializeLayout(this);
                if (!layout.initialized) {
                    this.providerIdCodeQualifiersScreen = new ProviderIdCodeQualifiersView(this.options);
                }
            }
        });
        return ProvierIdCodeQualifiersRouter;
    });
