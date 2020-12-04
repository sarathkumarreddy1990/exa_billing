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
            adjustmentCodes: {
                creditCodeId: null,
                debitCodeId: null,
                creditType: null,
                debitType: null
            },
            initialize: function (options) {
                this.options = options;
                $('#divPageHeaderButtons').empty();
            },

            showForm: function () {
                var self = this;
                $(this.el).html(this.collProcessTemplates());

                // 1. Collections Review Criteria first options
                var $chkPaymentStmtWise = $('#chkPaymentStmtWise');
                var $acrStatementCount = $('#acrStatementCount');
                var $acrStatementDays = $('#acrStatementDays');
                $chkPaymentStmtWise.off().on('click', function () {
                    var isChecked = $chkPaymentStmtWise.is(':checked');

                    if (!isChecked) {
                        $acrStatementDays.val('');
                        $acrStatementCount.val('');
                    }
                    $acrStatementDays.prop('disabled', !isChecked);
                    $acrStatementCount.prop('disabled', !isChecked);
                });

                // 2. Collections Review Criteria second options
                var $chkLastPatientPayment = $('#chkLastPatientPayment');
                $chkLastPatientPayment.off().on('click', function () {
                    var isChecked = $chkLastPatientPayment.is(':checked');

                    if (!isChecked) {
                        $('#acrLastPaymentDays').val('');
                    }
                    $('#acrLastPaymentDays').prop('disabled', !isChecked);
                });

                $('.collection-process-content').prop('hidden', true);
                $('.adj-code-content').prop('hidden', true);
                var placeHolderMsg = commonjs.geti18NString("messages.warning.payments.pleaseSelectAdjustment");

                self.clearFields();
                self.debitAdjustmentCodeAutoComplete(placeHolderMsg);
                self.creditAdjustmentCodeAutoComplete(placeHolderMsg);
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
                            var can_process_auto_collections = result.acr_min_balance_amount > 0;
                            $('#chkAutoCollectionProcess').prop('checked', can_process_auto_collections);
                            $('#txtMinAccBalance').val(result.acr_min_balance_amount);
                            $('#txtMinAccBalance').prop('disabled', !can_process_auto_collections);
                            $('.collection-process-content').prop('hidden', !can_process_auto_collections);

                            //Collections Review Criteria
                            var isCheckedPaymentStmtWise = result.acr_claim_status_statement_count && result.acr_claim_status_statement_days || false
                            var $acrStatementDays = $('#acrStatementDays');
                            var $chkLastPatientPayment = $('#chkLastPatientPayment');
                            var $acrStatementCount = $('#acrStatementCount');
                            var $acrLastPaymentDays = $('#acrLastPaymentDays');

                            $('#chkPaymentStmtWise').prop('checked', isCheckedPaymentStmtWise);
                            $acrStatementDays.val(result.acr_claim_status_statement_days || '');
                            $acrStatementDays.prop('disabled', !isCheckedPaymentStmtWise);

                            $acrStatementCount.val(result.acr_claim_status_statement_count || '');
                            $acrStatementCount.prop('disabled', !isCheckedPaymentStmtWise);

                            $chkLastPatientPayment.prop('checked', result.acr_claim_status_last_payment_days);
                            $acrLastPaymentDays.val(result.acr_claim_status_last_payment_days);
                            $acrLastPaymentDays.prop('disabled', !result.acr_claim_status_last_payment_days);

                            // Claim Balance - adjustment_info
                            isChecked = result.acr_write_off_debit_adjustment_code_id && result.acr_write_off_credit_adjustment_code_id
                            $('#chkWriteOffBalance').prop('checked', isChecked);
                            $('.adj-code-content').prop('hidden', !isChecked);

                            if (result.acr_write_off_debit_adjustment_code_id) { // debit
                                self.adjustmentCodes.debitCodeId = result.acr_write_off_debit_adjustment_code_id;
                                var debitAdjDesc = result.adjustment_info && result.adjustment_info.debit_adj_desc || '';
                                $('#select2-ddlDebitAdjustmentCode-container').html(debitAdjDesc);
                            }
                            if (result.acr_write_off_credit_adjustment_code_id) { // credit
                                self.adjustmentCodes.creditCodeId = result.acr_write_off_credit_adjustment_code_id;
                                var creditAdjDesc = result.adjustment_info && result.adjustment_info.credit_adj_desc || '';
                                $('#select2-ddlCreditAdjustmentCode-container').html(creditAdjDesc);
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
                    var placeHolderMsg = commonjs.geti18NString("messages.warning.payments.pleaseSelectAdjustment");
                    $('#select2-ddlDebitAdjustmentCode-container').html(placeHolderMsg);
                    $('#select2-ddlCreditAdjustmentCode-container').html(placeHolderMsg);
                    $("#ddlDebitAdjustmentCode").empty();
                    $("#ddlCreditAdjustmentCode").empty();
                    this.adjustmentCodes = {
                        creditCodeId: null,
                        debitCodeId: null,
                        creditType: null,
                        debitType: null
                    }
                }
            },

            debitAdjustmentCodeAutoComplete: function (placeHolderMsg) {
                var self = this;
                $("#ddlDebitAdjustmentCode").select2({
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
                        self.adjustmentCodes.debitCodeId = res.id;
                        self.adjustmentCodes.debitType = res.accounting_entry_type;
                        return res.description;
                    }
                }

            },

            creditAdjustmentCodeAutoComplete: function (placeHolderMsg) {
                var self = this;
                $("#ddlCreditAdjustmentCode").select2({
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
                        self.adjustmentCodes.creditCodeId = res.id;
                        self.adjustmentCodes.creditType = res.accounting_entry_type;
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
                $("#ddlDebitAdjustmentCode").empty();
                $("#ddlCreditAdjustmentCode").empty();
                var placeHolderMsg = commonjs.geti18NString("messages.warning.payments.pleaseSelectAdjustment");
                $('#select2-ddlDebitAdjustmentCode-container').html(placeHolderMsg);
                $('#select2-ddlCreditAdjustmentCode-container').html(placeHolderMsg);
                this.adjustmentCodes = {
                    creditCodeId: null,
                    debitCodeId: null,
                    creditType: null,
                    debitType: null
                }
            },

            validateCollectionProcess: function () {

                if (!$('#chkAutoCollectionProcess').is(':checked') && this.isExists){
                    return true;
                }

                if (!$('#chkAutoCollectionProcess').is(':checked')) {
                    commonjs.showWarning('messages.warning.setup.selectAutoCollectionsProcess');
                    return false;
                }

                if (!$('#txtMinAccBalance').val() || $('#txtMinAccBalance').val() == 0) {
                    commonjs.showWarning('messages.warning.setup.minimumAmtRequired');
                    return false;
                }

                var isValidStatementCount = !$('#acrStatementCount').val() || $('#acrStatementCount').val() == 0;
                var isValidStatementDays  = !$('#acrStatementDays').val() || $('#acrStatementDays').val() == 0;
                var isValidLastPaymentDays  = !$('#acrLastPaymentDays').val() || $('#acrLastPaymentDays').val() == 0;
                var isChkLastPatientPayment = $('#chkLastPatientPayment').is(':checked');
                var isChkPaymentStmtWise = $('#chkPaymentStmtWise').is(':checked');

                if (
                    ((isValidStatementDays || isValidStatementCount) && isChkPaymentStmtWise)
                    || ( isValidLastPaymentDays && isChkLastPatientPayment)
                ) {
                    commonjs.showWarning('messages.warning.setup.collectionsInputRequired')
                    return false;
                }

                if (!isChkPaymentStmtWise && !isChkLastPatientPayment) {
                    commonjs.showWarning('messages.warning.setup.collectionSelectOneOption');
                    return false;
                }

                if ($('#chkWriteOffBalance').is(':checked') &&
                    (!this.adjustmentCodes.debitCodeId || !this.adjustmentCodes.creditCodeId)
                ) {

                    var msg = !this.adjustmentCodes.debitCodeId ? commonjs.geti18NString("setup.collectionsProcess.debitAdjustmentCode")
                        : commonjs.geti18NString("setup.collectionsProcess.creditAdjustmentCode")

                    msg = commonjs.geti18NString("messages.warning.shared.pleaseselect") + ' ' + msg;
                    commonjs.showWarning(msg);
                    return false;
                }

                if (
                    (this.adjustmentCodes.creditCodeId &&
                        this.adjustmentCodes.creditType &&
                        this.adjustmentCodes.creditType !== 'credit'
                    ) ||
                    (this.adjustmentCodes.debitCodeId &&
                        this.adjustmentCodes.debitType &&
                        ['debit', 'refund_debit', 'recoupment_debit'].indexOf(this.adjustmentCodes.debitType) == -1
                    )
                ) {
                    commonjs.showWarning("setup.collectionsProcess.adjustmentTypeMismatch");
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
                        acrStatementCount           : $('#acrStatementCount').val() || null,
                        writeOffDebitAdjCodeId      : self.adjustmentCodes.debitCodeId || null,
                        writeOffCreditAdjCodeId     : self.adjustmentCodes.creditCodeId || null,
                        minimumAccountBalance       : $('#txtMinAccBalance').val(),
                        acrLastPaymentDays          : $('#acrLastPaymentDays').val() || null,
                        acrStatementDays            : $('#acrStatementDays').val() || null
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
