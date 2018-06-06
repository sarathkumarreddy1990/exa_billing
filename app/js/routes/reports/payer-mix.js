define([
    'jquery',
    'backbone',
    'backbonesubroute',
    'views/reports/payer-mix'
],
    function (
        $,
        Backbone,
        SubRoute,
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
                this.options.currentView = this.payerMixScreen;
                layout.initializeLayout(this);

                if (!layout.initialized) {
                    this.payerMixScreen = new PayerMixView(this.options);
                }
            }
        });
    });
