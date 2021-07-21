define(['backbone'], function (Backbone) {
    var billingMessagesModel = Backbone.Model.extend({
        urlRoot: "/exa_modules/billing/setup/billing_messages",
        defaults: {
            companyId: "",
            code: "",
            description: ""
        },
        initialize: function (models) {
        }
    });
    return billingMessagesModel;
});
