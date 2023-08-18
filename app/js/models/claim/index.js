define(['backbone'], function (Backbone) {
    var claimsModels = Backbone.Model.extend({
        urlRoot: "/exa_modules/billing/claims/claim",
        initialize: function () {

        },
        parse: function (result) {
            return result;
        }
    });
    return claimsModels;
});

