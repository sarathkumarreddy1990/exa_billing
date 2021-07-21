define([
    'jquery',
    'backbone',
    'backbonesubroute',
    'views/setup/user-log'
],
    function ($, Backbone, SubRoute, UserLogView) {
        var UserLogRouter = Backbone.SubRoute.extend({
            routes: {
                'list': 'showGrid'
            },

            showGrid: function () {
                this.initializeRouter();
                this.userLogScreen.showGrid();
            },
            initialize: function (options) {
                this.options = options;
            },

            initializeRouter: function () {
                this.options.screen = "User Log";
                this.options.currentView = this.userLogScreen;
                layout.initializeLayout(this);
                if (!layout.initialized) {
                    this.userLogScreen = new UserLogView(this.options);
                }
            }
        });
        return UserLogRouter;
    });