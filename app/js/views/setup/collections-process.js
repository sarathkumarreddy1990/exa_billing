define([
    'jquery',
    'underscore',
    'backbone',
    'text!templates/setup/collections-process.html'
],

    function ($,
        _,
        Backbone,
        COLLProcessTemplates
    ) {
        var COLLProcessTemplateView = Backbone.View.extend({
            collProcessTemplates: _.template(COLLProcessTemplates),
            events: {
                'click #chkAutoCollectionProcess': 'showAutoCollectionProcess',
                'click #chkWriteOffBalance': 'showWriteOffBalance',
                'click #btnSaveCollectionProcess': 'save',
            },
            isExists: false,
            writeOffAdjCodeId: null,
            initialize: function (options) {
                this.options = options;
                $('#divPageHeaderButtons').empty();
            },

            showForm: function () {
                var self = this;
                $(this.el).html(this.collProcessTemplates());

                // 1. Collections Review Criteria first options
                var $chkPaymentStmtWise = $('#chkPaymentStmtWise');
                var $statementFrequency = $('#statementFrequency');
                var $paymentFrequencyStmtWise = $('#paymentFrequencyStmtWise');
                $('#chkPaymentStmtWise').off().on('click', function () {
                    var isChecked = $chkPaymentStmtWise.is(':checked');

                    if (!isChecked) {
                        $paymentFrequencyStmtWise.val('');
                        $statementFrequency.val('');
                    }
                    $paymentFrequencyStmtWise.prop('disabled', !isChecked);
                    $statementFrequency.prop('disabled', !isChecked);
                });

                // 2. Collections Review Criteria second options
                var $chkLastPatientPayment = $('#chkLastPatientPayment');
                $chkLastPatientPayment.off().on('click', function () {
                    var isChecked = $chkLastPatientPayment.is(':checked');

                    if (!isChecked) {
                        $('#lppDaysCount').val('');
                    }
                    $('#lppDaysCount').prop('disabled', !isChecked);
                });

                $('.collection-process-content').prop('hidden', true);
                $('.adj-code-content').prop('hidden', true);

                self.clearFields();
                self.adjustmentCodeAutoComplete();
                self.getCollectionProcess();

                commonjs.processPostRender();
                commonjs.validateControls();
            },

            getCollectionProcess: function () {
                var self = this;
                var request = {
                    url: "/exa_modules/billing/setup/collections_process",
                    type: 'GET',
                    data: {
                        userId: app.userID,
                        companyId: app.companyID
                    },
                    success: function (data, response) {
                        if (data && data.length) {
                            self.isExists = true;
                            var result = data[0];

                            $('#chkAutoCollectionProcess').prop('checked', result.can_process_auto_collections);
                            $('#txtMinAccBalance').val(result.minimum_account_balance);
                            $('#txtMinAccBalance').prop('disabled', !result.can_process_auto_collections);
                            $('.collection-process-content').prop('hidden', !result.can_process_auto_collections);

                            //Collections Review Criteria
                            var isCheckedPaymentStmtWise = result.statement_frequency && result.payment_frequency_stmt_wise || false
                            var $paymentFrequencyStmtWise = $('#paymentFrequencyStmtWise');
                            var $chkLastPatientPayment = $('#chkLastPatientPayment');
                            var $statementFrequency = $('#statementFrequency');
                            var $lppDaysCount = $('#lppDaysCount');

                            $('#chkPaymentStmtWise').prop('checked', isCheckedPaymentStmtWise);
                            $paymentFrequencyStmtWise.val(result.payment_frequency_stmt_wise || '');
                            $paymentFrequencyStmtWise.prop('disabled', !isCheckedPaymentStmtWise);

                            $statementFrequency.val(result.statement_frequency || '');
                            $statementFrequency.prop('disabled', !isCheckedPaymentStmtWise);

                            $chkLastPatientPayment.prop('checked', result.payment_frequency_last_pymt_wise);
                            $lppDaysCount.val(result.payment_frequency_last_pymt_wise);
                            $lppDaysCount.prop('disabled', !result.payment_frequency_last_pymt_wise);

                            // Claim Balance
                            $('#chkWriteOffBalance').prop('checked', result.write_off_adjustment_code_id);
                            $('.adj-code-content').prop('hidden', !result.write_off_adjustment_code_id);

                            if (result.write_off_adjustment_code_id) {
                                self.writeOffAdjCodeId = result.write_off_adjustment_code_id;
                                $('#select2-ddlAdjustmentCode-container').html(result.adjustment_desc);
                            }
                        }
                    },
                    error: function (err) {
                        commonjs.handleXhrError(err);
                    }
                };

                $.ajax(request);
            },

            showAutoCollectionProcess: function () {
                var isChecked = $('#chkAutoCollectionProcess').is(':checked');
                $('.collection-process-content').prop('hidden', !isChecked);
                $('#txtMinAccBalance').prop('disabled', !isChecked);

                if (!isChecked) { //clear fields when unchecked
                    this.clearFields();
                }
            },

            showWriteOffBalance: function () {
                var isChecked = $('#chkWriteOffBalance').is(':checked');
                $('.adj-code-content').prop('hidden', !isChecked);

                if (!isChecked) {
                    $("#ddlAdjustmentCode").empty();
                    this.writeOffAdjCodeId = null;
                }
            },

            adjustmentCodeAutoComplete: function () {
                var self = this;
                var placeHolderMsg = commonjs.geti18NString("messages.warning.payments.pleaseSelectAdjustment");
                $("#ddlAdjustmentCode").select2({
                    ajax: {
                        url: "/exa_modules/billing/autoCompleteRouter/adjustment_code",
                        dataType: 'json',
                        delay: 250,
                        data: function (params) {
                            return {
                                page: params.page || 1,
                                q: params.term || '',
                                pageSize: 10,
                                sortField: "code",
                                sortOrder: "ASC",
                                company_id: app.companyID
                            };
                        },
                        processResults: function (data, params) {
                            return commonjs.getTotalRecords(data, params);
                        },
                        cache: true
                    },
                    placeholder: placeHolderMsg,
                    escapeMarkup: function (markup) { return markup; },
                    minimumInputLength: 0,
                    templateResult: formatRepo,
                    templateSelection: formatRepoSelection
                });
                function formatRepo(repo) {
                    if (repo.loading) {
                        return repo.code;
                    }
                    var markup = "<table><tr>";
                    markup += "<td  data-id='" + repo.id + " ' title='" + repo.code + "(" + repo.code + ")'> <div>" + repo.description + '(' + repo.code + ')' + "</div>";
                    markup += "</td></tr></table>";
                    return markup;

                }
                function formatRepoSelection(res) {
                    if (res && res.id) {
                        self.writeOffAdjCodeId = res.id;
                        return res.description;
                    }
                }

            },

            clearFields: function () {
                $('#chkPaymentStmtWise').prop('checked', false);
                $('#chkWriteOffBalance').prop('checked', false);
                $('#chkLastPatientPayment').prop('checked', false);

                //clear input range
                $('input[type="number"]').val('');
                $('.adj-code-content').prop('hidden', true);
                $('input[type="number"]').prop('disabled', true);

                // clear adjustment option
                $("#ddlAdjustmentCode").empty();
                this.writeOffAdjCodeId = null;
            },

            validateCollectionProcess: function () {

                if (!$('#chkAutoCollectionProcess').is(':checked') && this.isExists){
                    return true;
                }

                if (!$('#chkAutoCollectionProcess').is(':checked')) {
                    commonjs.showWarning('messages.warning.setup.selectAutoCollectionsProcess');
                    return false;
                }

                if (!$('#txtMinAccBalance').val()) {
                    commonjs.showWarning('messages.warning.setup.minimumAmtRequired');
                    return false;
                }

                if (
                    ((!$('#paymentFrequencyStmtWise').val() || !$('#statementFrequency').val()) && $('#chkPaymentStmtWise').is(':checked')) ||
                    (!$('#lppDaysCount').val() && $('#chkLastPatientPayment').is(':checked'))
                ) {
                    commonjs.showWarning('messages.warning.setup.collectionsInputRequired')
                    return false;
                }

                if (!$('#chkPaymentStmtWise').is(':checked') && !$('#chkLastPatientPayment').is(':checked')) {
                    commonjs.showWarning('messages.warning.setup.collectionSelectOneOption');
                    return false;
                }

                if ($('#chkWriteOffBalance').is(':checked') && !this.writeOffAdjCodeId) {
                    commonjs.showWarning('messages.warning.payments.pleaseSelectAdjustment')
                    return false;
                }

                return true;
            },

            save: function () {
                var self = this;
                var isValidSettings = self.validateCollectionProcess();
                var isCollectionProcessChecked = $('#chkAutoCollectionProcess').is(':checked');

                if (isValidSettings) {
                    var requestType = self.isExists ? (!isCollectionProcessChecked ? 'DELETE' : 'PUT') : 'POST';

                    var requestData = {
                        companyId                   : app.companyID,
                        userId                      : app.userID,
                        statementFreq               : $('#statementFrequency').val() || null,
                        WriteOffAdjCodeId           : self.writeOffAdjCodeId || null,
                        minimumAccountBalance       : $('#txtMinAccBalance').val(),
                        paymentFreqLastPaymentWise  : $('#lppDaysCount').val() || null,
                        paymentFreqStmtWise         : $('#paymentFrequencyStmtWise').val() || null,
                        isAutoCollectionProcess     : isCollectionProcessChecked,
                    };

                    var request = {
                        url: "/exa_modules/billing/setup/collections_process",
                        type: requestType,
                        data: requestData,
                        success: function (data, response) {
                            if (data && data.length) {
                                if (requestType === 'DELETE') {
                                    self.isExists = false;
                                    self.clearFields();
                                } else {
                                    self.isExists = true;
                                }
                                var msg = requestType === 'POST' ? 'messages.status.collectionsProcessSaved' : 'messages.status.collectionsProcessUpdate';
                                commonjs.showStatus(msg);
                            }
                        },
                        error: function (err) {
                            commonjs.handleXhrError(err);
                        }
                    };

                    $.ajax(request);
                }
            }
        });

        return COLLProcessTemplateView;
    });
