define([
    'jquery',
    'backbone',
    'backbonesubroute',
    'views/reports/patient-statement'
],
    function (
        $,
        Backbone,
        SubRoute,
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
                this.options.currentView = this.patientStatementScreen;
                layout.initializeLayout(this);

                if (!layout.initialized) {
                    this.patientStatementScreen = new PatientStatementView(this.options);
                }
            }
        });
    });
