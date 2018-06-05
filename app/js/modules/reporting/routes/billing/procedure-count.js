define([
        'jquery'
        , 'backbone'
        , 'backbonesubroute'
        , 'modules/reporting/utils/routing'
        , 'modules/reporting/views/billing/procedure-count'
    ],
    function ($, Backbone, SubRoute, RoutingUtils, procedureCountView) {

        var procedureCountRouter = Backbone.SubRoute.extend({
            routes: {
                '': 'showDefaultView'
            },

            showDefaultView: function () {
                console.log('router - showDefaultView');
                this.initializeRouter();
                this.procedureCountView.showForm();
            },

            initialize: function (options) {
                this.options = options;
            },

            initializeRouter: function () {
                this.options.screen = facilityModules.reportScreens.procedureCount;
                layout.initializeLayout(this);

                if (!layout.initialized) {
                    RoutingUtils.clearView(this.options.currentView);
                    this.procedureCountView = new procedureCountView(this.options);
                    this.options.currentView = this.procedureCountView;
                }
            }
        });

        return procedureCountRouter;
    });
