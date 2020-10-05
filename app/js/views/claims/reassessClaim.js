define(['jquery',
    'underscore',
    'backbone',
    'text!templates/claims/claimReassess.html',
    'text!templates/claims/validations.html'
], function (
    $,
    _,
    Backbone,
    claimReassessTemplate,
    validationTemplate
) {
    return Backbone.View.extend({
        el: null,
        claimReassessTemplate: _.template(claimReassessTemplate),
        validationTemplate: _.template(validationTemplate),

        initialize: function (options) {
            this.options = options;
        },

        render: function (data) {
            this.rendered = true;
            commonjs.showDialog({
                header: 'Reassess Claim',
                i18nHeader: 'setup.rightClickMenu.reassessClaim',
                width: '50%',
                height: '30%',
                html: this.claimReassessTemplate()
            });
            this.bindEvents(data);
        },

        bindEvents: function (data) {
            var self = this;
            $('#saveSupportText').off().click(function () {
                var supportText = $('#claimReassessment').val();

                if (supportText =='') {
                    return commonjs.showWarning('billing.fileInsurance.reasonForReassess');
                }

                commonjs.showLoading();
                $.ajax({
                    url: '/exa_modules/billing/ahs/can_ahs_reassess_claim',
                    type: 'PUT',
                    data: {
                        'claimIds': data.claimId.toString(),
                        'supportingText': supportText,
                        'source': 'reassessment'
                    },
                    success: function (data) {
                        data.err = data && (data.err || data[0]);

                        if (data.validationMessages && data.validationMessages.length) {
                            // To show array of validation messages
                            commonjs.showNestedDialog({
                                header: 'Claim Validation Result',
                                i18nHeader: 'billing.claims.claimValidationResponse',
                                height: '50%',
                                width: '60%',
                                html: self.validationTemplate({
                                    'validationMessages': data.validationMessages
                                })
                            });
                        } else if (data.err) {
                            commonjs.showWarning(data.err);
                        } else {
                            commonjs.showStatus('messages.status.claimSubmitted');
                        }
                        commonjs.hideLoading();
                        commonjs.hideDialog();
                },
                    error: function (err) {
                        commonjs.handleXhrError(err);
                    }
                });
            });
        }

    });
});
