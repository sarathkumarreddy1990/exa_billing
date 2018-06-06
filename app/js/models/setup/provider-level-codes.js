define(['backbone'], function (Backbone) {
    var providerLevelCodesModel = Backbone.Model.extend({
        url: "/exa_modules/billing/setup/provider_level_codes",
        defaults: {
            companyId: "",
            isActive: "",
            code: "",
            description: "",
            readingProviderPercentLevel: ""
        },
        initialize: function (models) {
        }
    });
    return providerLevelCodesModel;
});
