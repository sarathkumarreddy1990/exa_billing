define([
    'jquery',
    'backbone',
    'backbonesubroute',
    'views/claims/claim-workbench'
],
    function (
        $,
        Backbone,
        SubRoute,
        claimWorkbenchView
        ) {
        var StudiesRouter = Backbone.SubRoute.extend({
            routes: {
                'list': 'showGrid'
            },

            showGrid: function () {
                this.initializeRouter();
                this.claimWorkbenchScreen.render();
            },

            initialize: function (options) {
                this.options = options;
            },

            initializeRouter: function () {
                this.options.screen = "ClaimWorkbench";//facilityModules.setupScreens.icd;
                this.options.currentView = this.claimWorkbenchScreen;
                this.options.module ="Claims";
                layout.initializeLayout(this);

                if (!layout.initialized) {
                    this.claimWorkbenchScreen = new claimWorkbenchView(this.options);
                }
            }
        });

        return StudiesRouter;
    });
