define(['backbone', 'models/setup/claim-status'], function (Backbone, claimStatusModel) {
    var ClaimStatusList = Backbone.Collection.extend({
        model: claimStatusModel,
        url: "/exa_modules/billing/setup/claim_status",
        initialize: function () {
        },
        parse: function (response) {
            return response
        }
    });
    return ClaimStatusList;
});
