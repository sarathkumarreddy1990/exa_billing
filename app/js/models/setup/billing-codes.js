define(['backbone'], function (Backbone) {
    var billingCodesModel = Backbone.Model.extend({
        urlRoot: "/exa_modules/billing/setup/billing_codes",
        defaults: {
            companyId: "",
            code: "",
            description: "",
            isActive: "",
            colorCode: ""
        },
        initialize: function () {
        }
    });
    return billingCodesModel;
});
