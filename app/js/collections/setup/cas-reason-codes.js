define(['backbone', 'models/setup/cas-reason-codes'], function (Backbone, casReasonCodesModel) {
    var casReasonCodesList = Backbone.Collection.extend({
        model: casReasonCodesModel,
        url: "/exa_modules/billing/setup/cas_reason_codes",
        initialize: function () {
        },
        parse: function (response) {
            return response
        }
    });
    return casReasonCodesList;
});
