define(['backbone','models/setup/billing-providers'], function (Backbone,billingProviderModel) {

    var billingProvList = Backbone.Collection.extend({
        model: billingProviderModel,
        url: "/exa_modules/billing/setup/billing_providers",

        initialize: function () {
        },

        parse: function (response) {
            return response
        }

    });
    return billingProvList;
});