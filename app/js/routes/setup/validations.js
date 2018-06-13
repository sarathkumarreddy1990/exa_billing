define([
    'jquery',
    'backbone',
    'backbonesubroute',
    'views/setup/validations'
],
    function (
        $,
        Backbone,
        SubRoute,
        ValidationsView
        ) {
        var ValidationsRouter = Backbone.SubRoute.extend({
            routes: {
                'all': 'showAll'
            },

            showAll: function () {
                this.initializeRouter();
                this.validationsScreen.showAll();
            },

            initialize: function (options) {
                this.options = options;
            },

            initializeRouter: function () {
                this.options.screen = "Billing Validation";
                this.options.currentView = this.validationsScreen;
                layout.initializeLayout(this);
                if (!layout.initialized) {
                    this.validationsScreen = new ValidationsView(this.options);
                }
            }
        });

        return ValidationsRouter;
    });
