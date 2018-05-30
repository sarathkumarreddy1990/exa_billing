define(['backbone','models/setup/cas-group-codes'], function (Backbone,casGroupCodesModel) {

    var casGroupCodesList = Backbone.Collection.extend({
        model: casGroupCodesModel,
        url: "/exa_modules/billing/cas_group_codes",

        initialize: function () {
        },

        parse: function (response) {
            return response
        }

    });
    return casGroupCodesList;
});