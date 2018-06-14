define(['backbone'], function (Backbone) {
    var billingClassesModel = Backbone.Model.extend({
        urlRoot: "/exa_modules/billing/setup/billing_classes",
        defaults: {
            companyId: "",
            code: "",
            description: "",
            isActive: ""
        },
        initialize: function (models) {
        }
    });
    return billingClassesModel;
});
