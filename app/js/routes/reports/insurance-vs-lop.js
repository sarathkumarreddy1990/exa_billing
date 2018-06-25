define([
    'jquery',
    'backbone',
    'backbonesubroute',
    'views/reports/insurance-vs-lop'
],
    function (
        $,
        Backbone,
        SubRoute,
        InsuranceVSLop
    ) {
        return Backbone.SubRoute.extend({
            routes: {
                'insurance-vs-lop': 'showDefaultView'
            },

            showDefaultView: function () {
                this.initializeRouter();
                this.InsuranceVSLopScreen.showForm();
            },

            initialize: function (options) {
                this.options = options;
            },

            initializeRouter: function () {
                this.options.screen = facilityModules.reportScreens.insuranceVsLOP;
                this.options.currentView = this.InsuranceVSLopScreen;
                layout.initializeLayout(this);

                if (!layout.initialized) {
                    this.InsuranceVSLopScreen = new InsuranceVSLop(this.options);
                }
            }
        });
    });
