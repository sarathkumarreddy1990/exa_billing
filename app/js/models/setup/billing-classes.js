define(['backbone'], function (Backbone) {
    var billingClassesModel = Backbone.Model.extend({
        url: "/exa_modules/billing/setup/billing_classes",
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
