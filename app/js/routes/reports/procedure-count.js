define([
    'jquery',
    'backbone',
    'backbonesubroute',
    'shared/routing',
    'views/reports/procedure-count'
],
    function (
        $,
        Backbone,
        SubRoute,
        RoutingUtils,
        ProcedureCountView
    ) {
        return Backbone.SubRoute.extend({
            routes: {
                'procedure-count': 'showDefaultView'
            },

            showDefaultView: function () {
                this.initializeRouter();
                this.procedureCountScreen.showForm();
            },

            initialize: function (options) {
                this.options = options;
            },

            initializeRouter: function () {
                this.options.screen = facilityModules.reportScreens.procedureCount;
                layout.initializeLayout(this);

                if (!layout.initialized) {
                    RoutingUtils.clearView(this.options.currentView);
                    this.procedureCountScreen = new ProcedureCountView(this.options);
                    this.options.currentView = this.procedureCountScreen;
                }
            }
        });
    });
