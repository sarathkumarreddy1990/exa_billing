define([
        'jquery'
        , 'backbone'
        , 'backbonesubroute'
        , 'modules/reporting/utils/routing'
        , 'modules/reporting/views/billing/payments'
    ],
    function ($, Backbone, SubRoute, RoutingUtils, paymentsView) {

        var PaymentsRouter = Backbone.SubRoute.extend({
            routes: {
                '': 'showDefaultView'
            },

            showDefaultView: function () {
                console.log('router - showDefaultView');
                this.initializeRouter();
                this.paymentsView.showForm();
            },

            initialize: function (options) {
                console.log('router - initialize, options: ', options);
                this.options = options;
            },

            initializeRouter: function () {
                console.log('router - initializeRouter');
                this.options.screen = facilityModules.reportScreens.payments;
                layout.initializeLayout(this);

                if (!layout.initialized) {
                    RoutingUtils.clearView(this.options.currentView);
                    this.paymentsView = new paymentsView(this.options);
                    this.options.currentView = this.paymentsView;
                }
            }
        });

        return PaymentsRouter;
    });
