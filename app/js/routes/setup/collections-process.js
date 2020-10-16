define([
    'jquery',
    'backbone',
    'backbonesubroute',
    'views/setup/collections-process'
],
    function (
        $,
        Backbone,
        SubRoute,
        COLLProcessTemplatesView
    ) {
        var CollectionsProcessRouter = Backbone.SubRoute.extend({
            routes: {
                'all': 'showForm'
            },

            showForm: function () {
                this.initializeRouter();
                this.collProcessTemplateScreen.showForm(0);
            },

            initialize: function (options) {
                this.options = options;
            },

            initializeRouter: function () {
                this.options.screen = "Collections Process";
                this.options.currentView = this.collProcessTemplateScreen;
                layout.initializeLayout(this);

                if (!layout.initialized) {
                    this.collProcessTemplateScreen = new COLLProcessTemplatesView(this.options);
                }
            }
        });

        return CollectionsProcessRouter;
    });
