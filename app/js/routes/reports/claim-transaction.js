define([
    'jquery',
    'backbone',
    'backbonesubroute',
    'views/reports/claim-transaction'
  ],
    function (
        $,
        Backbone,
        SubRoute,
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
                this.options.currentView = this.claimTransactionScreen;
                layout.initializeLayout(this);
  
                if (!layout.initialized) {
                    this.claimTransactionScreen = new ClaimTransactionView(this.options);
                }
            }
        });
    });
  