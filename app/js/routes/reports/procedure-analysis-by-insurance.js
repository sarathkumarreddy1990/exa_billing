define([
    'jquery',
    'backbone',
    'backbonesubroute',
    'views/reports/procedure-analysis-by-insurance'
],
    function (
        $,
        Backbone,
        SubRoute,
        ProcedureAnalysisInsuranceView
    ) {
        return Backbone.SubRoute.extend({
            routes: {
                'procedure-analysis-by-insurance': 'showDefaultView'
            },

            showDefaultView: function () {
                this.initializeRouter();
                this.procedureAnalysisInsuranceScreen.showForm();
            },

            initialize: function (options) {
                this.options = options;
            },

            initializeRouter: function () {
                this.options.screen = facilityModules.reportScreens.procedureanalysisbyinsurance;
                this.options.currentView = this.procedureAnalysisInsuranceScreen;
                layout.initializeLayout(this);

                if (!layout.initialized) {
                    this.procedureAnalysisInsuranceScreen = new ProcedureAnalysisInsuranceView(this.options);
                }
            }
        });
    });
