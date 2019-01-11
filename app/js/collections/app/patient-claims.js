define(['backbone'], function (Backbone) {
    return Backbone.Collection.extend({
        url: "/exa_modules/billing/payments/patient_claim_list",
        initialize: function () {
        },
        parse: function (response) {
            return response;
        }
    });
});
