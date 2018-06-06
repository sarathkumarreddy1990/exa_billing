define(['backbone'], function (Backbone) {
    var paymentDetailsList = Backbone.Collection.extend({
        url: "/exa_modules/billing/claim_inquiry/claim_comments",
        initialize: function () {
        },
        parse: function (response) {
            return response;
        }
    });
    return paymentDetailsList;
});