define([
    'jquery',
    'backbone',
    'backbonesubroute',
    'shared/routing',
    'views/reports/transaction-summary'
],
    function (
        $,
        Backbone,
        SubRoute,
        RoutingUtils,
        TransactionSummaryView
    ) {
        return Backbone.SubRoute.extend({
            routes: {
                'transaction-summary': 'showDefaultView'
            },

            showDefaultView: function () {
                this.initializeRouter();
                this.transactionSummaryScreen.showForm();
            },

            initialize: function (options) {
                this.options = options;
            },

            initializeRouter: function () {
                this.options.screen = facilityModules.reportScreens.transactionSummary;
                layout.initializeLayout(this);

                if (!layout.initialized) {
                    RoutingUtils.clearView(this.options.currentView);
                    this.transactionSummaryScreen = new TransactionSummaryView(this.options);
                    this.options.currentView = this.transactionSummaryScreen;
                }
            }
        });
    });
