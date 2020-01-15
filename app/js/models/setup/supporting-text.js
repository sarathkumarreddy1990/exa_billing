define(['backbone'], function (Backbone) {
    var supportingTextModel = Backbone.Model.extend({
        urlRoot: "/exa_modules/billing/setup/supporting_text",
        defaults: {
            companyId: "",
            processType: "",
            processStatus: "",
            colorCode: ""
        },
        initialize: function (models) {
        }
    });
    return supportingTextModel;
});
