define(['backbone', 'models/setup/provider-id-codes'], function (Backbone, providerIdCodesModel) {

    var providerIdCodes = Backbone.Collection.extend({
        model: providerIdCodesModel,
        url: "/exa_modules/billing/setup/provider_id_codes",

        initialize: function () {
        },

        parse: function (response) {
            return response
        }

    });
    return providerIdCodes;
});
