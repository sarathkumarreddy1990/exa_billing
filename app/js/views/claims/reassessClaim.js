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
        supportingTextOptions: [],

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
            this.identifyAssociatedCpts(data);
        },

        bindEvents: function (data) {
            var self = this;

            $("#btnAddSupportingText").off().click(function (e) {
                self.insertSupportingText();
            })

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
        },

        identifyAssociatedCpts: function(data) {
            var self = this;
            $.ajax({
                url: '/exa_modules/billing/claims/claim',
                method: 'GET',
                data: {
                    id: data.claimId[0] ? data.claimId[0] : 0
                }
            }).then(function(response) {
                var claimChargeList = response[0] && response[0].claim_charges ? response[0].claim_charges : [];
                var associatedCpts = [];
                for (var i = 0; i < claimChargeList.length; i++) {
                    var index = claimChargeList[i];
                    if (index.cpt_id) {
                        associatedCpts.push(index.cpt_id);
                    }
                }
                self.findRelevantTemplates(associatedCpts);
            })

        },

        findRelevantTemplates: function(associatedCpts) {
            var self = this;
            $.ajax({
                url: '/exa_modules/billing/setup/supporting_text/findRelevantTemplates',
                method: 'POST',
                data: {
                    cpts: associatedCpts
                }
            }).then(function(response) {
                self.supportingTextOptions = response || [];
                if (response.length > 0) {
                    var $templateDropdown = $('#ddlSupportingTextOptions_claimReassess');
                    $templateDropdown.empty();
                    $templateDropdown.append('<option value="" i18n="shared.buttons.select">Select</option>');
                    for (var i = 0; i < response.length; i++) {
                        $templateDropdown.append('<option value="' + response[i].id + '">' + response[i].template_name + '</option');
                    }
                }
            })
        },

        insertSupportingText: function() {
            var existingSupportingText = $('#claimReassessment').val();
            var selectedTemplateId = $('#ddlSupportingTextOptions_claimReassess').val();
            var correspondingTemplateText = _.find(this.supportingTextOptions, { 'id': selectedTemplateId}).supporting_text;
            var updatedSupportingText = existingSupportingText + ' ' + correspondingTemplateText;
            $('#claimReassessment').val(updatedSupportingText);
        },

    });
});
