define([
    'jquery',
    'backbone',
    'backbonesubroute',
    'shared/routing',
    'views/reports/procedure-analysis-by-insurance'
],
    function (
        $,
        Backbone,
        SubRoute,
        RoutingUtils,
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
                layout.initializeLayout(this);

                if (!layout.initialized) {
                    RoutingUtils.clearView(this.options.currentView);
                    this.options.currentView = this.procedureAnalysisInsuranceScreen = new ProcedureAnalysisInsuranceView(this.options);
                }
            }
        });
    });
