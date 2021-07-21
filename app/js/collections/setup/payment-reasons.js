define(['backbone', 'models/setup/payment-reasons'], function (Backbone, paymentReasonsModel) {
    var PaymentReasonsList = Backbone.Collection.extend({
        model: paymentReasonsModel,
        url: "/exa_modules/billing/setup/payment_reasons",
        initialize: function () {
        },
        parse: function (response) {
            return response
        }
    });
    return PaymentReasonsList;
});
