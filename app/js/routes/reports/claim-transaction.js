define([
    'jquery',
    'backbone',
    'backbonesubroute',
    'shared/routing',
    'views/reports/claim-transaction'
  ],
    function (
        $,
        Backbone,
        SubRoute,
        RoutingUtils,
        ClaimTransactionView
    ) {
        return Backbone.SubRoute.extend({
            routes: {
                'claim-transaction': 'showDefaultView'
            },

            showDefaultView: function () {
                this.initializeRouter();
                this.claimTransactionScreen.showForm();
            },

            initialize: function (options) {
                this.options = options;
            },

            initializeRouter: function () {
                this.options.screen = facilityModules.reportScreens.claimTransaction;
                layout.initializeLayout(this);

                if (!layout.initialized) {
                    RoutingUtils.clearView(this.options.currentView);
                    this.claimTransactionScreen = new ClaimTransactionView(this.options);
                    this.options.currentView = this.claimTransactionScreen;
                }
            }
        });
    });
