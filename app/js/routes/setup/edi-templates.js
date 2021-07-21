define([
    'jquery',
    'backbone',
    'backbonesubroute',
    'views/setup/edi-templates'
],
    function (
        $,
        Backbone,
        SubRoute,
        EDITemplatesView
    ) {
        var EDITemplatesRouter = Backbone.SubRoute.extend({
            routes: {
                'all': 'showForm'
            },

            showForm: function () {
                this.initializeRouter();
                this.ediTemplateScreen.showForm(0);
            },

            initialize: function (options) {
                this.options = options;
            },

            initializeRouter: function () {
                this.options.screen = "EDI Templates";//facilityModules.setupScreens.icd;
                this.options.currentView = this.ediTemplateScreen;
                layout.initializeLayout(this);

                if (!layout.initialized) {
                    this.ediTemplateScreen = new EDITemplatesView(this.options);
                }
            }
        });

        return EDITemplatesRouter;
    });
