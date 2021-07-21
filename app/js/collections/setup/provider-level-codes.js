define(['backbone','models/setup/provider-level-codes'], function (Backbone,providerLevelCodesModel) {

    var providerLevelCodesList = Backbone.Collection.extend({
        model: providerLevelCodesModel,
        url: "/exa_modules/billing/setup/provider_level_codes",

        initialize: function () {
        },

        parse: function (response) {
            return response
        }

    });
    return providerLevelCodesList;
});