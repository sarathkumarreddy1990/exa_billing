define(['backbone'], function (Backbone) {
    var ProviderIdCodeQualifiersModel = Backbone.Model.extend({
        urlRoot: "/exa_modules/billing/setup/provider_id_code_qualifiers",
        defaults: {
            qualifierCode:"",
            description: "",
            isActive: "",
            company_id: ""
        },
        initialize: function (models) {
        }
    });
    return ProviderIdCodeQualifiersModel;
});
