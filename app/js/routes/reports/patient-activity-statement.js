define([
    'jquery',
    'backbone',
    'backbonesubroute',
    'views/reports/patient-activity-statement'
],
    function (
        $,
        Backbone,
        SubRoute,
        PatientActivityStatementView
    ) {
        return Backbone.SubRoute.extend({
            routes: {
                'patient-activity-statement': 'showDefaultView'
            },

            showDefaultView: function () {
                this.initializeRouter();
                this.patientActivityStatementScreenScreen.showForm();
            },

            initialize: function (options) {
                this.options = options;
            },

            initializeRouter: function () {
                this.options.screen = facilityModules.reportScreens.patientActivityStatement;
                this.options.currentView = this.patientActivityStatementScreen;
                layout.initializeLayout(this);

                if (!layout.initialized) {
                    this.patientActivityStatementScreen = new PatientActivityStatementView(this.options);
                }
            }
        });
    });
