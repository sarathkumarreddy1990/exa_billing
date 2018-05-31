define([
    'jquery'
    , 'backbone'
    , 'backbonesubroute'
    , 'modules/reporting/utils/routing'
    , 'modules/reporting/views/billing/transaction-summary'
],
    function ($, Backbone, SubRoute, RoutingUtils, transactionSummaryView) {

        var transactionSummaryRouter = Backbone.SubRoute.extend({
            routes: {
                '': 'showDefaultView'
            },

            showDefaultView: function () {
                console.log('router - showDefaultView');
                this.initializeRouter();
                this.transactionSummaryView.showForm();
            },

            initialize: function (options) {
                console.log('router - initialize, options: ', options);
                this.options = options;
            },

            initializeRouter: function () {
                console.log('router - initializeRouter');
                this.options.screen = facilityModules.reportScreens.transactionSummary;
                layout.initializeLayout(this);

                if (!layout.initialized) {
                    RoutingUtils.clearView(this.options.currentView);
                    this.transactionSummaryView = new transactionSummaryView(this.options);
                    this.options.currentView = this.transactionSummaryView;
                }
            }
        });

        return transactionSummaryRouter;
    });