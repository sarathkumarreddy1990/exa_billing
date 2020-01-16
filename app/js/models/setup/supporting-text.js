define(['backbone'], function (Backbone) {
    var supportingTextModel = Backbone.Model.extend({
        urlRoot: "/exa_modules/billing/setup/supporting_text",
        defaults: {
            companyId: ""
        },
        initialize: function (models) {
        }
    });
    return supportingTextModel;
});
