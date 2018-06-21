define([
    'jquery',
    'underscore',
    'backbone',
    'text!templates/claims/split-claim.html',
    'text!templates/claims/cpt-list.html'
], function (
    $,
    _,
    Backbone,
    splitCLaimTemplate,
    cptListTemplate) {
        return Backbone.View.extend({
            el: null,
            splitCLaimTemplate: _.template(splitCLaimTemplate),
            cptListTemplate: _.template(cptListTemplate),

            initialize: function (options) {
                this.options = options;
            },

            render: function () {
                this.rendered = true;
                commonjs.showDialog({
                    header: 'Create/SPlit',
                    width: '85%',
                    height: '75%',
                    html: this.splitCLaimTemplate()
                });

                this.showCharge();
                this.validateSplitClaim(this.claim_id);
                $('#divAllCPTList, #divSelectedCPTList').height($('#modal_div_container').height() - 60).css('padding', '0');
            },

            validateSplitClaim: function (claim_id) {
                var self = this;
                self.claim_id = claim_id;

                $.ajax({
                    url: '/exa_modules/billing/claims/split_claim/validateData',
                    type: 'GET',
                    data: {
                        'claim_id': claim_id
                    },
                    success: function (data, response) {
                        if (data && data[0]) {
                            data = data[0];

                            if (data.charge_count == 0) {
                                commonjs.showWarning('Can not split the claim without charge');
                            } else if (data.charge_count < 2) {
                                commonjs.showWarning('Can not split the claim with one charge');
                            } else if (data.payment_count > 0) {
                                commonjs.showWarning('Can not split the claim with payment');
                            } else {
                                self.initializeCPTList();
                            }
                        }

                    },
                    error: function (err) {
                        commonjs.handleXhrError(err);
                    }
                })
            },

            initializeCPTList: function () {
                var self = this;
                if (!self.rendered)
                    self.render();
                self.bindSplitEvents();
            },

            bindSplitEvents: function () {
                var self = this;

                $('#btnCreateClaim').off().click(function () {
                    self.splitClaim();
                });

                $('#btnReload').off().click(function () {
                    self.reloadChargeList();
                });

                $('section').off().dblclick(function (e) {
                    self.selectCharge(e);
                });

            },

            showCharge: function () {
                var self = this;

                $.ajax({
                    url: '/exa_modules/billing/claims/split_claim',
                    type: 'GET',
                    data: {
                        'claim_id': self.claim_id
                    },
                    success: function (data, response) {
                        if (data && data[0]) {
                            var CPTList = self.cptListTemplate({ charges: data[0].claim_details });
                            $('#divAllCPTList').append(CPTList).fadeIn("slow");
                            self.setEvents();
                            commonjs.hideLoading();
                            commonjs.initializeScreen({ header: { screen: 'Split Claim', ext: 'createSplit' } }, true);
                        }

                    },
                    error: function (err) {
                        commonjs.handleXhrError(err);
                    }
                })
            },

            setEvents: function () {
                var self = this;

                $('.icon-ic-plus').on('click', function (e) {
                    if (e && e.target) {
                        if (self.validateMinimumCharge(e)) {
                            var el = $(e.target || e.srcElement).closest('section');
                            $(this)
                                .removeClass('icon-ic-plus')
                                .addClass('icon-ic-minus').on('click', function (e) {
                                    $(this)
                                        .removeClass('icon-ic-minus')
                                        .addClass('icon-ic-plus')
                                        .attr('title', 'Add to Selected')
                                    $('#divAllCPTList').append($('<section/>').append($(this).closest('cpt')))
                                    self.setEvents();
                                    return false;
                                })
                                .attr('title', 'Undo')

                            $('#divSelectedCPTList').append($('<section/>').append($(this).closest('cpt')))
                        }
                        else {
                            commonjs.showWarning('Minimum one Charge required for the Claim')
                            return false;
                        }
                    }
                    return false;
                })
            },

            validateMinimumCharge: function (e) {
                if ($(e.target).is('.icon-ic-minus'))
                    return true
                else
                    return $('#divAllCPTList section cpt').length > 1;
            },

            splitClaim: function () {
                var self = this;
                var _cpt_ids = [];
                if ($('#divSelectedCPTList section cpt').length > 0) {
                    $.each($('#divSelectedCPTList section cpt'), function () {
                        let charge_id = $(this).attr('data-charge_id');
                        _cpt_ids.push(charge_id);
                    });

                    if (confirm('Are you sure to create order with the selected stud(y)ies?')) {
                        //  $('#btnCreateClaim').attr('disabled', true);
                        commonjs.showLoading('Processing please wait..');
                        $.ajax({
                            url: "/exa_modules/billing/claims/split_claim",
                            type: "PUT",
                            data: {
                                cpt_ids: _cpt_ids.join(','),
                                claim_id: self.claim_id
                            },
                            success: function (data, response) {
                                commonjs.showStatus('Claim has been splited successfully');
                                self.reloadChargeList();
                                $('#btnCreateClaim').removeAttr('disabled');
                            },
                            error: function (err) {
                                commonjs.handleXhrError(err);
                            }
                        });
                    }
                }
                else {
                    commonjs.showWarning('Please select atleast one charge to merge')
                    return false;
                }

            },

            selectCharge: function (e) {
                if (e.target || e.srcElement) {
                    var selectedStudy = $(e.target || e.srcElement).closest('section');
                    if (selectedStudy.find('.icon-ic-plus').length) {
                        selectedStudy.find('.icon-ic-plus').click();
                        return false;
                    }
                    else {
                        selectedStudy.find('.icon-ic-minus').click()
                        return false;
                    }
                }
            },

            reloadChargeList: function () {
                var self = this;

                self.showCharge();
                $('#divAllCPTList').empty();
                $('#divSelectedCPTList').empty();
                $('#btnCreateClaim').removeAttr('disabled');
            }
        });
    });