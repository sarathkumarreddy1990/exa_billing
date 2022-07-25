define(['backbone'], function (Backbone) {
    var claimPatienyList = Backbone.Collection.extend({
        url: "/exa_modules/billing/claims/claim_inquiry/claim_patient",
        initialize: function () {
        },
        parse: function (response) {
            var patientClaimAlerts = response && response[0].claim_comments;

            if (patientClaimAlerts) {
                commonjs.showClaimAlerts(patientClaimAlerts);
            }
            
            return response;
        }
    });
    return claimPatienyList;
});