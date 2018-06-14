define(['backbone', 'models/setup/validations'], function (Backbone, validationsModel) {
    var ValidationsInfo = Backbone.Collection.extend({
        model: validationsModel,
        url: "/exa_modules/billing/setup/validations",
        initialize: function () {
        },
        parse: function (response) {
            return response
        }
    });
    return ValidationsInfo;
});
