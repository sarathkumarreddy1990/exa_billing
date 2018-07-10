define(['backbone'], function (Backbone) {
    var claimsModels = Backbone.Model.extend({
        urlRoot: "/exa_modules/billing/claims/create_claim",
        initialize: function (models) {

        },
        parse: function (result) {
            return result;
        }
    });
    return claimsModels;
});

