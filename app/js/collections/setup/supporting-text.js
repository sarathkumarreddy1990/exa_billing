define(['backbone','models/setup/supporting-text'], function (Backbone,supportingTextModel) {

    var supportingTextList = Backbone.Collection.extend({
        model: supportingTextModel,
        url: "/exa_modules/billing/setup/supporting_text",

        initialize: function () {
        },

        parse: function (response) {
            return response
        }

    });
    return supportingTextList;
});