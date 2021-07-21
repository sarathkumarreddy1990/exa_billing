define([
    'jquery',
    'backbone',
    'backbonesubroute',
    'shared/routing',
    'views/reports/credit-balance-encounters'
  ],
    function (
        $,
        Backbone,
        SubRoute,
        RoutingUtils,
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
                layout.initializeLayout(this);

                if (!layout.initialized) {
                    RoutingUtils.clearView(this.options.currentView);
                    this.options.currentView = this.creditBalanceEncounterScreen = new CreditBalanceEncountersView(this.options);
                }
            }
        });
    });
