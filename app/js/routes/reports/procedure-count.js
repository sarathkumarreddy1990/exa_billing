define([
    'jquery',
    'backbone',
    'backbonesubroute',
    'views/reports/procedure-count'
],
    function (
        $,
        Backbone,
        SubRoute,
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
                this.options.currentView = this.procedureCountScreen;
                layout.initializeLayout(this);

                if (!layout.initialized) {
                    this.procedureCountScreen = new ProcedureCountView(this.options);
                }
            }
        });
    });
