define([
    'jquery'
    , 'backbone'
    , 'backbonesubroute'
    , 'modules/reporting/utils/routing'
    , 'modules/reporting/views/billing/patients-by-insurance-company'
],
    function ($, Backbone, SubRoute, RoutingUtils, patientsByInsuranceCompanyView) {

        var PatientsByInsuranceCompanyRouter = Backbone.SubRoute.extend({
            routes: {
                '': 'showDefaultView'
            },

            showDefaultView: function () {
                console.log('router - showDefaultView');
                this.initializeRouter();
                this.patientsByInsuranceCompanyView.showForm();
            },

            initialize: function (options) {
                console.log('router - initialize, options: ', options);
                this.options = options;
            },

            initializeRouter: function () {
                console.log('router - initializeRouter');
                this.options.screen = facilityModules.reportScreens.patientsInscompany;
                layout.initializeLayout(this);

                if (!layout.initialized) {
                    RoutingUtils.clearView(this.options.currentView);
                    this.patientsByInsuranceCompanyView = new patientsByInsuranceCompanyView(this.options);
                    this.options.currentView = this.patientsByInsuranceCompanyView;
                }
            }
        });

        return PatientsByInsuranceCompanyRouter;
    });