define([
     'underscore'
    , 'text!templates/claims/claim-alerts.html'
    , 'sweetalert2'
], function (
      _
    , alertsTemplate
    , swal2
) {
    var alerts = {
        claimAlertsTemplate: _.template(alertsTemplate),

        /**
        * Show claim comments as alert
        * @param {Array} claimAlerts contains comments data
        * @param {String} isFrom contains screen name
        */
        showClaimAlerts: function (claimAlerts, isFrom) {
            swal2.fire({
                title: commonjs.geti18NString("billing.claims.alert"),
                html: this.claimAlertsTemplate({claimAlerts, isFrom}),
                onOpen: function () {
                    $('.swal2-checkbox').addClass('d-none');
                    $('#alertContent').css('padding', '0px')
                    $('#swal2-content').css({
                        'max-height': '250px',
                        'overflow': 'auto'
                    });
                }
            });
        }
    };

    return alerts;
});
