define([
    'jquery',
    'backbone',
    'backbonesubroute',
    'views/setup/status-color-codes'
],
    function (
        $,
        Backbone,
        SubRoute,
        StatusColorCodesView
        ) {
        var StatusColorCodeRouter = Backbone.SubRoute.extend({
            routes: {
                'list': 'showGrid',
                'new': 'showForm',
                'edit/:id': 'showEditForm'
            },

            showGrid: function () {
                this.initializeRouter();
                this.statusColorCodeScreen.showGrid();
            },

            showForm: function () {
                this.initializeRouter();
                this.statusColorCodeScreen.showForm(0);
            },

            showEditForm: function (id) {
                this.initializeRouter();
                this.statusColorCodeScreen.showForm(id);
            },

            initialize: function (options) {
                this.options = options;
            },

            initializeRouter: function () {
                this.options.screen = "Status Color Codes";
                this.options.currentView = this.statusColorCodeScreen;
                layout.initializeLayout(this);

                if (!layout.initialized) {
                    this.statusColorCodeScreen = new StatusColorCodesView(this.options);
                }
            }
        });

        return StatusColorCodeRouter;
    });