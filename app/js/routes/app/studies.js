define([
    'jquery',
    'backbone',
    'backbonesubroute',
    'views/studies'
],
    function (
        $,
        Backbone,
        SubRoute,
        StudiesView
    ) {
        var StudiesRouter = Backbone.SubRoute.extend({
            routes: {
                'list': 'showGrid',
                'new': 'showForm'
            },

            showGrid: function () {
                this.initializeRouter();
                this.studiesScreen.render();
            },

            showForm: function () {
                this.initializeRouter();
                this.studiesScreen.showForm(0);
            },

            initialize: function (options) {
                this.options = options;
            },

            initializeRouter: function () {
                this.options.screen = "Studies";//facilityModules.setupScreens.icd;
                this.options.currentView = this.studiesScreen;
                layout.initializeLayout(this);

                if (!layout.initialized) {
                    this.studiesScreen = new StudiesView(this.options);
                }
            }
        });

        return StudiesRouter;
    });
