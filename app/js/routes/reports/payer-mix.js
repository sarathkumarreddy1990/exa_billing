define([
    'jquery',
    'backbone',
    'backbonesubroute',
    'shared/routing',
    'views/reports/payer-mix'
],
    function (
        $,
        Backbone,
        SubRoute,
        RoutingUtils,
        PayerMixView
    ) {
        return Backbone.SubRoute.extend({
            routes: {
                'payer-mix': 'showDefaultView'
            },

            showDefaultView: function () {
                this.initializeRouter();
                this.payerMixScreen.showForm();
            },

            initialize: function (options) {
                this.options = options;
            },

            initializeRouter: function () {
                this.options.screen = facilityModules.reportScreens.payerMix;
                layout.initializeLayout(this);

                if (!layout.initialized) {
                    RoutingUtils.clearView(this.options.currentView);
                    this.payerMixScreen = new PayerMixView(this.options);
                    this.options.currentView = this.payerMixScreen;
                }
            }
        });
    });
