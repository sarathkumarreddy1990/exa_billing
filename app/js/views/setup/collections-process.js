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
                var $acrStatementCount = $('#acrStatementCount');
                var $acrStatementDays = $('#acrStatementDays');
                $('#chkPaymentStmtWise').off().on('click', function () {
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

                            // Claim Balance
                            $('#chkWriteOffBalance').prop('checked', result.acr_write_off_adjustment_code_id);
                            $('.adj-code-content').prop('hidden', !result.acr_write_off_adjustment_code_id);

                            if (result.acr_write_off_adjustment_code_id) {
                                self.writeOffAdjCodeId = result.acr_write_off_adjustment_code_id;
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
                        acrStatementCount           : $('#acrStatementCount').val() || null,
                        WriteOffAdjCodeId           : self.writeOffAdjCodeId || null,
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
