define([
    'jquery'
    , 'backbone'
    , 'backbonesubroute'
    , 'modules/reporting/utils/routing'
    , 'modules/reporting/views/billing/payments-by-ins-company'
],
    function ($, Backbone, SubRoute, RoutingUtils, paymentsByInsCompanyView) {

        var PaymentsByInsCompanyRouter = Backbone.SubRoute.extend({
            routes: {
                '': 'showDefaultView'
            },

            showDefaultView: function () {
                console.log('router - showDefaultView');
                this.initializeRouter();
                this.paymentsByInsCompanyView.showForm();
            },

            initialize: function (options) {
                console.log('router - initialize, options: ', options);
                this.options = options;
            },

            initializeRouter: function () {
                console.log('router - initializeRouter');
                this.options.screen = facilityModules.reportScreens.payments-by-ins-company;
                layout.initializeLayout(this);

                if (!layout.initialized) {
                    RoutingUtils.clearView(this.options.currentView);
                    this.paymentsByInsCompanyView = new paymentsByInsCompanyView(this.options);
                    this.options.currentView = this.paymentsByInsCompanyView;
                }
            }
        });

        return PaymentsByInsCompanyRouter;
    });