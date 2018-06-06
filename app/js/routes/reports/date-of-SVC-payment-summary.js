define([
    'jquery',
    'backbone',
    'backbonesubroute',
    'views/reports/date-of-SVC-payment-summary'
],
    function (
        $,
        Backbone,
        SubRoute,
        DateOfSVCSummaryView
    ) {
        return Backbone.SubRoute.extend({
            routes: {
                'date-of-SVC-payment-summary': 'showDefaultView'
            },

            showDefaultView: function () {
                this.initializeRouter();
                this.svcPaymentSummaryScreen.showForm();
            },

            initialize: function (options) {
                this.options = options;
            },

            initializeRouter: function () {
                this.options.screen = facilityModules.reportScreens.svcPaymentSummary;
                this.options.currentView = this.svcPaymentSummaryScreen;
                layout.initializeLayout(this);

                if (!layout.initialized) {
                    this.svcPaymentSummaryScreen = new DateOfSVCSummaryView(this.options);
                }
            }
        });
    });
