define([
    'jquery',
    'backbone',
    'backbonesubroute',
    'views/setup/cas-reason-codes'
],
    function ($, Backbone, SubRoute, CasReasonCodesView) {
        var CasReasonCodeRouter = Backbone.SubRoute.extend({
            routes: {
                'list': 'showGrid',
                'new': 'showForm',
                'edit/:id': 'showEditForm'
            },

            showGrid: function () {
                this.initializeRouter();
                this.casReasonCodeScreen.showGrid();
            },

            showForm: function () {
                this.initializeRouter();
                this.casReasonCodeScreen.showForm(0);
            },

            showEditForm: function (id) {
                this.initializeRouter();
                this.casReasonCodeScreen.showForm(id);
            },

            initialize: function (options) {
                this.options = options;
            },

            initializeRouter: function () {
                this.options.screen = "CAS Reason Codes";
                this.options.currentView = this.casReasonCodeScreen;
                layout.initializeLayout(this);
                if (!layout.initialized) {
                    this.casReasonCodeScreen = new CasReasonCodesView(this.options);
                }
            }
        });
        return CasReasonCodeRouter;
    });