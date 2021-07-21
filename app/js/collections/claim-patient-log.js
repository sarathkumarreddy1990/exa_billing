define(['backbone'], function (Backbone) {
    var claimPatientLogList = Backbone.Collection.extend({
        url: "/exa_modules/billing/claims/claim_inquiry/claim_patient_log",
        initialize: function () {
        },
        parse: function (response) {
            return response;
        }
    });
    return claimPatientLogList;
});