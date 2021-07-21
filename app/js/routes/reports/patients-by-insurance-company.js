define([
    'jquery',
    'backbone',
    'backbonesubroute',
    'shared/routing',
    'views/reports/patients-by-insurance-company'
],
    function (
        $,
        Backbone,
        SubRoute,
        RoutingUtils,
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
                layout.initializeLayout(this);

                if (!layout.initialized) {
                    RoutingUtils.clearView(this.options.currentView);
                    this.options.currentView = this.patientsByInsuranceScreen = new PatientsByInsCompanyView(this.options);
                }
            }
        });
    });
