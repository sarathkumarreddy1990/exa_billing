define([
    'jquery'
    , 'backbone'
    , 'backbonesubroute'
    , 'modules/reporting/utils/routing'
    , 'modules/reporting/views/billing/payer_mix'
],
    function ($, Backbone, SubRoute, RoutingUtils, payerMixView) {

        var PayerMixRouter = Backbone.SubRoute.extend({
            routes: {
                '': 'showDefaultView'
            },

            showDefaultView: function () {
                console.log('router - showDefaultView');
                this.initializeRouter();
                this.payerMixView.showForm();
            },

            initialize: function (options) {
                console.log('router - initialize, options: ', options);
                this.options = options;
            },

            initializeRouter: function () {
                console.log('router - initializeRouter');
                this.options.screen = facilityModules.reportScreens.payer_mix;
                layout.initializeLayout(this);

                if (!layout.initialized) {
                    RoutingUtils.clearView(this.options.currentView);
                    this.payerMixView = new payerMixView(this.options);
                    this.options.currentView = this.payerMixView;
                }
            }
        });

        return PayerMixRouter;
    });