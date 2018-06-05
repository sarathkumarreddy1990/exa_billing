define(['backbone'], function (Backbone) {
    var billingCodesModel = Backbone.Model.extend({
        url: "/exa_modules/billing/setup/billing_codes",
        defaults: {
            company_id: "",
            code: "",
            description: "",
            is_active: ""
        },
        initialize: function (models) {
        }
    });
    return billingCodesModel;
});
