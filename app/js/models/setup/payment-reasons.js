define(['backbone'], function (Backbone) {
    var PaymentReasonsModel = Backbone.Model.extend({
        url: "/exa_modules/billing/setup/payment_reasons",
        defaults: {
            code: "",
            description: "",
            isActive: "",
            company_id: ""
        },
        initialize: function (models) {
        }
    });
    return PaymentReasonsModel;
});
