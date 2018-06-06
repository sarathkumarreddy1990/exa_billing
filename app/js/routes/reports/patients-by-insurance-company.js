define([
    'jquery',
    'backbone',
    'backbonesubroute',
    'views/reports/patients-by-insurance-company'
],
    function (
        $,
        Backbone,
        SubRoute,
        PatientsByInsCompanyView
    ) {
        return Backbone.SubRoute.extend({
            routes: {
                'patients-by-insurance-company': 'showDefaultView'
            },

            showDefaultView: function () {
                this.initializeRouter();
                this.patientsByInsuranceScreen.showForm();
            },

            initialize: function (options) {
                this.options = options;
            },

            initializeRouter: function () {
                this.options.screen = facilityModules.reportScreens.patientsByInsurance;
                this.options.currentView = this.patientsByInsuranceScreen;
                layout.initializeLayout(this);

                if (!layout.initialized) {
                    this.patientsByInsuranceScreen = new PatientsByInsCompanyView(this.options);
                }
            }
        });
    });
