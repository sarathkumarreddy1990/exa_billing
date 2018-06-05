define(['backbone'], function (Backbone) {
    var providerLevelCodesModel = Backbone.Model.extend({
        url: "/exa_modules/billing/setup/provider_level_codes",
        defaults: {
            company_id: "",
            is_active: "",
            code: "",
            description: "",
            reading_provider_percent_level: ""
        },
        initialize: function (models) {
        }
    });
    return providerLevelCodesModel;
});
