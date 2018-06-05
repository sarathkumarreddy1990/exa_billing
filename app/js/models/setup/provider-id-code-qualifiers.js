define(['backbone'], function (Backbone) {
    var ProviderIdCodeQualifiersModel = Backbone.Model.extend({
        url: "/exa_modules/billing/setup/provider_id_code_qualifiers",
        defaults: {
            qualifier_code:"",
            description: "",
            is_active: "",
            company_id: ""
        },
        initialize: function (models) {
        }
    });
    return ProviderIdCodeQualifiersModel;
});
