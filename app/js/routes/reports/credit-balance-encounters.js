define([
    'jquery',
    'backbone',
    'backbonesubroute',
    'views/reports/credit-balance-encounters'
  ],
    function (
        $,
        Backbone,
        SubRoute,
        CreditBalanceEncountersView
    ) {
        return Backbone.SubRoute.extend({
            routes: {
                'credit-balance-encounters': 'showDefaultView'
            },
  
            showDefaultView: function () {
                this.initializeRouter();
                this.creditBalanceEncounterScreen.showForm();
            },
  
            initialize: function (options) {
                this.options = options;
            },
  
            initializeRouter: function () {
                this.options.screen = facilityModules.reportScreens.creditBalanceEncounters;
                this.options.currentView = this.creditBalanceEncounterScreen;
                layout.initializeLayout(this);
  
                if (!layout.initialized) {
                    this.creditBalanceEncounterScreen = new CreditBalanceEncountersView(this.options);
                }
            }
        });
    });
  