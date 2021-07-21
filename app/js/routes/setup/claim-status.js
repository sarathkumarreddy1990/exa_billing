define([
    'jquery',
    'backbone',
    'backbonesubroute',
    'views/setup/claim-status'
],
    function ($, Backbone, SubRoute, ClaimStatusView) {
        var ClaimStatusRouter = Backbone.SubRoute.extend({
            routes: {
                'list': 'showGrid',
                'new': 'showForm',
                'edit/:id': 'showEditForm'
            },

            showGrid: function () {
                this.initializeRouter();
                this.claimStatusScreen.showGrid();
            },

            showForm: function () {
                this.initializeRouter();
                this.claimStatusScreen.showForm(0);
            },

            showEditForm: function (id) {
                this.initializeRouter();
                this.claimStatusScreen.showForm(id);
            },

            initialize: function (options) {
                this.options = options;
            },

            initializeRouter: function () {
                this.options.screen = "Claim Status";
                this.options.currentView = this.claimStatusScreen;
                layout.initializeLayout(this);

                if (!layout.initialized) {
                    this.claimStatusScreen = new ClaimStatusView(this.options);
                }
            }
        });

        return ClaimStatusRouter;
    });


