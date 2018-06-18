define(['backbone'], function (Backbone) {
    var CasReasonCodesModel = Backbone.Model.extend({
        urlRoot: "/exa_modules/billing/setup/cas_reason_codes",
        defaults: {
            code: "",
            description: "",
            isActive: "",
            company_id: ""
        },
        initialize: function (models) {
        }
    });
    return CasReasonCodesModel;
});
