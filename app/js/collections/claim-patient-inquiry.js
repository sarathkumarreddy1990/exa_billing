define(['backbone'], function (Backbone) {
    var claimPatienyList = Backbone.Collection.extend({
        url: "/exa_modules/billing/claims/claim_inquiry/claim_patient",
        initialize: function () {
        },
        parse: function (response) {
            var patientClaimAlerts = {};

            $.each(response, function (i, data) {
                if (data.claim_comments) {
                    patientClaimAlerts[data.claim_id] = data.claim_comments;
                }
            });

            if (Object.keys(patientClaimAlerts).length) {
                commonjs.showClaimAlerts(patientClaimAlerts, 'patientClaims');
            }
            
            return response;
        }
    });
    return claimPatienyList;
});