define(['backbone','models/setup/billing-messages'], function (Backbone,billingMessagesModel) {

    var billingMessagesList = Backbone.Collection.extend({
        model: billingMessagesModel,
        url: "/exa_modules/billing/setup/billing_messages",

        initialize: function () {
        },

        parse: function (response) {
            return response
        }

    });
    return billingMessagesList;
});