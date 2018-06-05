define(['backbone', 'models/setup/provider-id-code-qualifiers'], function (Backbone, providerIdCodeQualifiersModel) {
    var ProviderIdCodeQualifiersList = Backbone.Collection.extend({
        model: providerIdCodeQualifiersModel,
        url: "/exa_modules/billing/setup/provider_id_code_qualifiers",
        initialize: function () {
        },
        parse: function (response) {
            return response
        }
    });
    return ProviderIdCodeQualifiersList;
});
