define([
    'jquery',
    'backbone',
    'backbonesubroute',
    'shared/routing',
    'views/reports/patient-statement'
],
    function (
        $,
        Backbone,
        SubRoute,
        RoutingUtils,
        PatientStatementView
    ) {
        return Backbone.SubRoute.extend({
            routes: {
                'patient-statement': 'showDefaultView'
            },

            showDefaultView: function () {
                this.initializeRouter();
                this.patientStatementScreen.showForm();
            },

            initialize: function (options) {
                this.options = options;
            },

            initializeRouter: function () {
                this.options.screen = facilityModules.reportScreens.patientStatement;
                layout.initializeLayout(this);

                if (!layout.initialized) {
                    RoutingUtils.clearView(this.options.currentView);
                    this.patientStatementScreen = new PatientStatementView(this.options);
                    this.options.currentView = this.patientStatementScreen;
                }
            }
        });
    });
