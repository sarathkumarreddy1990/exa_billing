define(['backbone','models/setup/billing-codes'], function (Backbone,billingCodesModel) {

    var billingCodesList = Backbone.Collection.extend({
        model: billingCodesModel,
        url: "/exa_modules/billing/setup/billing_codes",

        initialize: function () {
        },

        parse: function (response) {
            return response
        }

    });
    return billingCodesList;
});