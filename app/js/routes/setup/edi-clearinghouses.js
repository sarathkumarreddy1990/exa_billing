define([
    'jquery',
    'backbone',
    'backbonesubroute',
    'views/setup/edi-clearinghouses'
],
    function (
        $,
        Backbone,
        SubRoute,
        EDIClearingHousesView
    ) {
        var EDIClearingHousesRouter = Backbone.SubRoute.extend({
            routes: {
                'list': 'showGrid',
                'new': 'showForm',
                'edit/:id': 'showEditForm'
            },

            showGrid: function () {
                this.initializeRouter();
                this.ediClearingHousesScreen.showGrid();
            },

            showForm: function () {
                this.initializeRouter();
                this.ediClearingHousesScreen.showForm(0);
            },

            showEditForm: function (id) {
                this.initializeRouter();
                this.ediClearingHousesScreen.showForm(id);
            },

            initialize: function (options) {
                this.options = options;
            },

            initializeRouter: function () {
                this.options.screen = "EDI Clearing Houses";//facilityModules.setupScreens.icd;
                this.options.currentView = this.ediClearingHousesScreen;
                layout.initializeLayout(this);

                if (!layout.initialized) {
                    this.ediClearingHousesScreen = new EDIClearingHousesView(this.options);
                }
            }
        });

        return EDIClearingHousesRouter;
    });
