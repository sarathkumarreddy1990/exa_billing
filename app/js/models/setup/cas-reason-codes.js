define(['backbone'], function (Backbone) {
    var casReasonCodesModel = Backbone.Model.extend({
        url: "/exa_modules/billing/setup/cas_reason_codes",
        defaults: {
            code: "",
            name: "",
            description: "",
            is_active: "",
            company_id: ""
        },
        initialize: function (models) {
        }
    });
    return casReasonCodesModel;
});
