define(['backbone'], function (Backbone) {
    var ClaimStatusModel = Backbone.Model.extend({
        urlRoot: "/exa_modules/billing/setup/claim_status",
        defaults: {
            code: "",
            description: "",
            isActive: "",
            company_id: ""
        },
        initialize: function (models) {
        }
    });
    return ClaimStatusModel;
});
