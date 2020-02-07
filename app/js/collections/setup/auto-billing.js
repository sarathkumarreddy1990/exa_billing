define(['backbone','models/setup/auto-billing'], function (Backbone,AutoBillingModel) {

    var AutoBillingList = Backbone.Collection.extend({
        model: AutoBillingModel,
        url: "/exa_modules/billing/setup/auto_billing",

        initialize: function () {
        },

        parse: function (response) {
            return response;
        }

    });
    return AutoBillingList;
});
