define([
    'jquery',
    'backbone',
    'backbonesubroute',
    'views/census'
],
    function (
        $,
        Backbone,
        SubRoute,
        censusView
    ) {
        var censusRouter = Backbone.SubRoute.extend({
            routes: {
                'list': 'showGrid',
            },

            showGrid: function () {
                this.initializeRouter();
                this.censusScreen.render();
            },

            initialize: function (options) {
                this.options = options;
            },

            initializeRouter: function () {
                this.options.screen = "Census";
                this.options.currentView = this.censusScreen;
                this.options.module ="Home";
                layout.initializeLayout(this);

                if (!layout.initialized) {
                    this.censusScreen = new censusView(this.options);
                }
            }
        });

        return censusRouter;
    });
