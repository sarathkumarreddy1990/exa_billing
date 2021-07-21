define([
    'jquery',
    'backbone',
    'backbonesubroute',
    'views/setup/adjustment-codes'
],
    function (
        $,
        Backbone,
        SubRoute,
        AdjustmentCodesView
    ) {
        var AdjustmentCodeRouter = Backbone.SubRoute.extend({
            routes: {
                'list': 'showGrid',
                'new': 'showForm',
                'edit/:id': 'showEditForm'
            },

            showGrid: function () {
                this.initializeRouter();
                this.adjustmentCodeScreen.showGrid();
            },

            showForm: function () {
                this.initializeRouter();
                this.adjustmentCodeScreen.showForm(0);
            },

            showEditForm: function (id) {
                this.initializeRouter();
                this.adjustmentCodeScreen.showForm(id);
            },

            initialize: function (options) {
                this.options = options;
            },

            initializeRouter: function () {
                this.options.screen = "Adjustment Codes";//facilityModules.setupScreens.icd;
                this.options.currentView = this.adjustmentCodeScreen;
                layout.initializeLayout(this);

                if (!layout.initialized) {
                    this.adjustmentCodeScreen = new AdjustmentCodesView(this.options);
                }
            }
        });

        return AdjustmentCodeRouter;
    });
