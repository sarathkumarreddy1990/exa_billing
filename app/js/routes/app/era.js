define([
    'jquery',
    'backbone',
    'backbonesubroute',
    'views/app/era'
],
    function (
        $,
        Backbone,
        SubRoute,
        eraView
        ) {
        var paymentsRouter = Backbone.SubRoute.extend({
            routes: {
                "list": "showEra"
            },

            showEra: function () {
                this.initializeRouter();
                this.eraScreen.showGrid();
            },

            initialize: function (options) {
                this.options = options;
            },

            initializeRouter: function () {
                this.options.screen = "Era";
                this.options.currentView = this.eraScreen;
                layout.initializeLayout(this);

                if (!layout.initialized) {
                    this.eraScreen = new eraView(this.options);
                }
            }
        });

        return paymentsRouter;
    });
