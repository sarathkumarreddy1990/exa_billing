define(['backbone'], function (Backbone) {
    var ValidationsModel = Backbone.Model.extend({
        url: "/exa_modules/billing/setup/validations",
        defaults: {
        },
        initialize: function (models) {
        }
    });
    return ValidationsModel;
});
