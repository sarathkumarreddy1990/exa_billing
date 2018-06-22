define([
    'jquery',
    'backbone',
    'backbonesubroute',
    'views/setup/paper-claim-templates'
],
    function (
        $,
        Backbone,
        SubRoute,
        PaperClaimTemplatesView
    ) {
        var PaperClaimTemplatesRouter = Backbone.SubRoute.extend({
            routes: {
                'list': 'showGrid',
                'new': 'showForm',
                'edit/:id': 'showEditForm'
            },

            showGrid: function () {
                this.initializeRouter();
                this.paperClaimTemplatesScreen.showGrid();
            },

            showForm: function () {
                this.initializeRouter();
                this.paperClaimTemplatesScreen.showForm(0);
            },

            showEditForm: function (id) {
                this.initializeRouter();
                this.paperClaimTemplatesScreen.showForm(id);
            },

            initialize: function (options) {
                this.options = options;
            },

            initializeRouter: function () {
                this.options.screen = "Printer Templates";//facilityModules.setupScreens.icd;
                this.options.currentView = this.paperClaimTemplatesScreen;
                layout.initializeLayout(this);

                if (!layout.initialized) {
                    this.paperClaimTemplatesScreen = new PaperClaimTemplatesView(this.options);
                }
            }
        });

        return PaperClaimTemplatesRouter;
    });
