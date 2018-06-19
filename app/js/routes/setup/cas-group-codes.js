define([
    'jquery',
    'backbone',
    'backbonesubroute',
    'views/setup/cas-group-codes'
],
    function (
        $,
        Backbone,
        SubRoute,
        CasGroupCodesView
    ) {
        var CasGroupCodeRouter = Backbone.SubRoute.extend({
            routes: {
                'list': 'showGrid',
                'new': 'showForm',
                'edit/:id': 'showEditForm'
            },

            showGrid: function () {
                this.initializeRouter();
                this.casGroupCodeScreen.showGrid();
            },

            showForm: function () {
                this.initializeRouter();
                this.casGroupCodeScreen.showForm(0);
            },

            showEditForm: function (id) {
                this.initializeRouter();
                this.casGroupCodeScreen.showForm(id);
            },

            initialize: function (options) {
                this.options = options;
            },

            initializeRouter: function () {
                this.options.screen = "CAS Group Codes";//facilityModules.setupScreens.icd;
                this.options.currentView = this.casGroupCodeScreen;
                layout.initializeLayout(this);

                if (!layout.initialized) {
                    this.casGroupCodeScreen = new CasGroupCodesView(this.options);
                }
            }
        });

        return CasGroupCodeRouter;
    });
