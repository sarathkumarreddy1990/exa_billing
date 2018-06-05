define(['backbone'], function (Backbone) {
    var billingClassesModel = Backbone.Model.extend({
        url: "/exa_modules/billing/setup/billing_classes",
        defaults: {
            company_id: "",
            code: "",
            description: "",
            is_active: ""
        },
        initialize: function (models) {
        }
    });
    return billingClassesModel;
});
