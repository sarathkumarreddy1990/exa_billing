define([
        'jquery'
        , 'backbone'
        , 'backbonesubroute'
        , 'modules/reporting/utils/routing'
        , 'modules/reporting/views/billing/patient_statement'
    ],
    function ($, Backbone, SubRoute, RoutingUtils, patientStatementView) {

        var patientStatementRouter = Backbone.SubRoute.extend({
            routes: {
                '': 'showDefaultView'
            },

            showDefaultView: function () {
                this.initializeRouter();
                this.patientStatementView.showForm();
            },

            initialize: function (options) {
                this.options = options;
            },

            initializeRouter: function () {
                this.options.screen = facilityModules.reportScreens.patient_statement;
                layout.initializeLayout(this);

                if (!layout.initialized) {
                    RoutingUtils.clearView(this.options.currentView);
                    this.patientStatementView = new patientStatementView(this.options);
                    this.options.currentView = this.patientStatementView;
                }
            }
        });

        return patientStatementRouter;
    });
