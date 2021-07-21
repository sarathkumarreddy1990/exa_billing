define(['backbone'], function (Backbone) {
    var claimPatienyList = Backbone.Collection.extend({
        url: "/exa_modules/billing/claims/claim_inquiry/claim_patient",
        initialize: function () {
        },
        parse: function (response) {
            return response;
        }
    });
    return claimPatienyList;
});