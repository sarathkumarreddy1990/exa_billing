define([
    'jquery',
    'backbone',
    'backbonesubroute',
    'views/setup/user-log'
],
    function ($, Backbone, SubRoute, UserLogView) {
        var UserLogRouter = Backbone.SubRoute.extend({
            routes: {
                'list': 'showGrid',
                'view/:id': 'showDetails'
            },

            showGrid: function () {
                this.initializeRouter();
                this.userLogScreen.showGrid();
            },
            initialize: function (options) {
                this.options = options;
            },

            initializeRouter: function () {
                this.options.screen = "Aser Log";
                this.options.currentView = this.userLogScreen;
                layout.initializeLayout(this);
                if (!layout.initialized) {
                    this.userLogScreen = new UserLogView(this.options);
                }
            },

            showDetails: function(id){
                this.initializeRouter();
                this.userLogScreen.displayDetails(id);

            }
        });
        return UserLogRouter;
    });