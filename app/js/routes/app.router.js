define([
    'backbone',
    'views/worklist',
    'views/studies',
    'modules/reporting/views/billing/charges',
    'modules/reporting/views/billing/payments'
], function (Backbone, WorklistView, StudiesView, ChargeReportView, PaymentReportView) {
    var AppRouter = Backbone.Router.extend({
        routes: {
            "app/worklist": "startApp" ,            
            "app/studies": "startAppStudies",
            "app/report/charges": "startChargeReporting" ,
            "app/report/payments": "startPaymentReporting"
        },

        startApp: function (subroutes) {
            if (!this.appRoute) {
                this.appRoute = new WorklistView({ el: $('#root') });
            }
        },        
        
        startAppStudies: function (subroutes) {
            if (!this.appRoute) {
                this.appRoute = new StudiesView({ el: $('#root') });
            }
        },
        startChargeReporting: function (subroutes) {
            if (!this.reportingRoute) {             
                this.reportingRoute = new ChargeReportView({ el: $('#root') });
            }
        },
        startPaymentReporting: function (subroutes) {
            if (!this.reportingRoute) {             
                this.reportingRoute = new PaymentReportView({ el: $('#root') });
            }
        },
    });

    return {
        initialize: function () {
            var router = new AppRouter();
            Backbone.history.start();
        }
    };
})