define([
    'jquery',
    'backbone',
    'backbonesubroute',
    'views/reports/transaction-summary'
],
    function (
        $,
        Backbone,
        SubRoute,
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
                this.options.currentView = this.transactionSummaryScreen;
                layout.initializeLayout(this);

                if (!layout.initialized) {
                    this.transactionSummaryScreen = new TransactionSummaryView(this.options);
                }
            }
        });
    });
