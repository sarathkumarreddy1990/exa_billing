define([
    'jquery'
    , 'backbone'
    , 'backbonesubroute'
    , 'modules/reporting/utils/routing'
    , 'modules/reporting/views/billing/date-of-SVC-payment-summary'
],
    function ($, Backbone, SubRoute, RoutingUtils, dateOfSVCPaymentSummaryView) {

        var DateOfSVCPaymentSummaryRouter = Backbone.SubRoute.extend({
            routes: {
                '': 'showDefaultView'
            },

            showDefaultView: function () {
                console.log('router - showDefaultView');
                this.initializeRouter();
                this.dateOfSVCPaymentSummaryView.showForm();
            },

            initialize: function (options) {
                console.log('router - initialize, options: ', options);
                this.options = options;
            },

            initializeRouter: function () {
                console.log('router - initializeRouter');
                this.options.screen = facilityModules.reportScreens.svcPaymentSummary;
                layout.initializeLayout(this);

                if (!layout.initialized) {
                    RoutingUtils.clearView(this.options.currentView);
                    this.dateOfSVCPaymentSummaryView = new dateOfSVCPaymentSummaryView(this.options);
                    this.options.currentView = this.dateOfSVCPaymentSummaryView;
                }
            }
        });

        return DateOfSVCPaymentSummaryRouter;
    });