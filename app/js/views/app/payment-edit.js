define(['jquery', 'immutable', 'underscore', 'backbone', 'jqgrid', 'jqgridlocale', 'text!templates/app/payment-edit.html', 'models/app/payment', 'models/pager', 'text!templates/payments-payer.html', 'collections/app/pending-payments', 'collections/app/applied-payments', 'text!templates/app/payment-apply-cas.html', 'text!templates/app/apply-payment.html'],
    function (jQuery, Immutable, _, Backbone, JGrid, JGridLocale, editPayment, ModelPayments, ModelPaymentsPager, paymentsGridHtml, pendingPayments, appliedPayments, ApplyCasHtml, ApplyPaymentTemplate) {
        return Backbone.View.extend({
            el: null,
            pager: null,
            model: null,
            pendPager: null,
            pendPaymtPager: null,
            appliedPager: null,
            paymentTable: null,
            rendered: false,
            gridLoaded: false,
            formLoaded: false,
            gridPendLoaded: false,
            casCodesLoaded: false,
            pendPaymentTable: null,
            pendPaymentTable1: null,
            appliedPaymentTable: null,
            paymentsEditTemplate: _.template(editPayment),
            paymentsGridTemplate: _.template(paymentsGridHtml),
            applyCasTemplate: _.template(ApplyCasHtml),
            applyPaymentTemplate: _.template(ApplyPaymentTemplate),
            casSegmentsSelected: [],

            events: {
                'click #btnPaymentSave': 'savePayment',
                'click #btnApplyCAS': 'getPayemntApplications',
                'change .payerType': 'setPayerFields',
                'click #btnPaymentAddNew': 'addNewPayemnt',
                'click #btnPaymentBack': 'goBackToPayments',
                'click #btnPaymentClear': 'clearPayemntForm'
            },

            initialize: function (options) {
                var self = this;
                this.options = options;
                var paymentId = options.id ? options.id : 0;
                var paymentStatus = [
                    { 'value': 'Applied', 'text': 'Applied' },
                    { 'value': 'UnApplied', 'text': 'UnApplied' },
                    { 'value': 'PartialApplied', 'text': 'PartialApplied' },
                    { 'value': 'OverApplied', 'text': 'OverApplied' },
                    { 'value': 'Refund', 'text': 'Refund' }
                ];
                this.payer_type = [
                    { 'value': "PPP", 'text': "Patient" },
                    { 'value': "POF", 'text': "Ordering Facility" },
                    { 'value': "PIP", 'text': "Insurance" },
                    { 'value': "PRP", 'text': "Provider" }
                ];
                this.billing_method = [
                    { 'value': "DB", 'text': "Direct Billing(Invoice)" },
                    { 'value': "EB", 'text': "Electronic" },
                    { 'value': "PP", 'text': "Patient Payment" }
                ];

                var modelCollection = Backbone.Collection.extend({
                    model: Backbone.Model.extend({})
                });

                this.paymentStatusList = new modelCollection(paymentStatus);

                app.adjustmentCodes = [];
                this.paidlocation = new modelCollection(app.facilities);
                this.facilityAdd = new modelCollection(commonjs.bindArray([app.facilities], true, true, false));
                var facilities = (app.userInfo.user_type == "SU") ? app.facilities : app.userfacilities;
                var adjustment_codes = jQuery.grep(app.adjustmentCodes, function (obj, i) {
                    return (obj.type == "ADJCDE" || obj.type == "REFADJ");
                });
                var claim_status = jQuery.grep(app.adjustmentCodes, function (obj, i) {
                    return (obj.type == "CLMSTS");
                });
                this.facilityList = new modelCollection(commonjs.bindArray([app.facilities], false, true, true));
                this.adjustmentCodeList = new modelCollection(adjustment_codes);
                this.claimStatusList = new modelCollection(claim_status);
                this.paymentReasons = new modelCollection([]);
                this.model = new ModelPayments();
                this.pager = new ModelPaymentsPager();
                this.pendPager = new ModelPaymentsPager();
                this.pendPaymtPager = new ModelPaymentsPager();
                this.appliedPager = new ModelPaymentsPager();
                this.patientPager = new ModelPaymentsPager();
                this.pendingPayments = new pendingPayments();
                this.appliedPayments = new appliedPayments();

            },

            returnDoubleDigits: function (str) {
                str = str.toString();
                return str.length === 1 ? '0' + str : str;
            },

            render: function (paymentId) {
                var self = this;
                commonjs.showLoading('Loading..')
                self.defalutCASArray = [0, 1, 2, 3, 4, 5, 6];

                var yearValue = moment().year();
                var expiryYear = [];
                var expiryMonth = [];
                expiryYear.push({ value: yearValue, text: yearValue })
                for (var i = 0; i < 20; i++) {
                    yearValue = yearValue + 1;
                    expiryYear.push({ value: yearValue, text: yearValue })
                }
                for (var j = 1; j < 13; j++) {
                    expiryMonth.push({ value: self.returnDoubleDigits(j), text: self.returnDoubleDigits(j) });
                }
                $(this.el).html(this.paymentsEditTemplate({ expiryYear: expiryYear, expiryMonth: expiryMonth, paidlocation: this.paidlocation.toJSON(), facilityAdd: this.paidlocation.toJSON(), paymentReasons: this.paymentReasons.toJSON(), id: self.payemntId }));
                this.rendered = true;
                self.showBillingForm(paymentId);
                self.showPaymentsGrid(paymentId);
                commonjs.processPostRender();
            },

            showPaymentsGrid: function () {
                var ipForm1 = $('#divPendingPay');
                ipForm1.html(this.paymentsGridTemplate());
            },

            bindNewDTP: function (paymentID, setDate) {
                var self = this;
                var accObj = $("#divAccountingDate");

                if (accObj.length) {
                    self.dtpAccountingDate = commonjs.bindDateTimePicker(accObj, { format: 'L' });
                    commonjs.checkNotEmpty(setDate) ? self.dtpAccountingDate.date(setDate) : self.dtpAccountingDate.clear();
                }
            },

            showBillingForm: function (paymentID) {
                var self = this;
                self.clearPayemntForm();
                self.setAcs();
                self.bindNewDTP();
                if (paymentID == 0) {
                    this.model = new ModelPayments();
                    $('#btnPaymentClear').show();
                    $('#divPendingPay').hide();
                    $('#btnPaymentAddNew').hide();
                    $('#btnPaymentPrint').hide();
                    $('#btnPrintReceipt').hide();
                    $('#btnPaymentRefClick').hide();
                    commonjs.hideLoading();
                }
                else {
                    this.model.set({ id: paymentID });
                    $('#btnPaymentClear').hide();
                    this.model.fetch({
                        data: { id: this.model.id },
                        success: function (model, result) {
                            if (result && result.length) {
                                self.bindpayments(result[0], paymentID);
                                commonjs.hideLoading();
                            }
                        }
                    });
                }
                commonjs.processPostRender();
            },

            clearPayemntForm: function () {
                this.payer_id = 0;
                $('#PaymentForm input[type=radio]').prop('ckecked', false);
                $('#PaymentForm select').val('');
                $('#PaymentForm input[type=text]').val('');
                $('#select2-txtautoPayerPIP-container').html('Select Insurance');
                $('#select2-txtautoPayerPP-container').html('Select Patient');
                $('#select2-txtautoPayerPOF-container').html('Select Ordering facility');
                $('#select2-txtautoPayerPR-container').html('Select Provider');
            },

            setAcs: function () {
                this.setInsuranceAutoComplete();
                this.setPatientAutoComplete();
                this.setOFAutoComplete();
                this.setProviderAutoComplete();
            },

            setPayerFields: function (e, obj) {
                var srcElement = obj ? obj : $(e.target || e.srcElement);
                $('.payerFields').hide();

                this.payer_id = 0;
                if (srcElement.is('#chkpayerInsurance')) {
                    $('#select2-txtautoPayerPIP-container').html('Select Insurance');
                    $('#divPayerInsurnace').show();
                    $('#divMethodInsurance').show();
                }
                else if (srcElement.is('#chkpayerPatient')) {
                    $('#select2-txtautoPayerPP-container').html('Select Patient');
                    $('#divPayerPatient').show();
                    $('#divMethodPatient').show();
                }
                else if (srcElement.is('#chkpayerOrdering')) {
                    $('#select2-txtautoPayerPOF-container').html('Select Ordering facility');
                    $('#divPayerOrderFacility').show();
                    $('#divMethodProvider').show();
                }
                else if (srcElement.is('#chkpayerProvider')) {
                    $('#select2-txtautoPayerPR-container').html('Select Provider');
                    $('#divPayerProvider').show();
                    $('#divMethodProvider').show();
                }
            },

            setInsuranceAutoComplete: function () {
                var self = this;
                $("#txtautoPayerPIP").select2({
                    ajax: {
                        url: "/exa_modules/billing/autoCompleteRouter/insurances",
                        dataType: 'json',
                        delay: 250,
                        data: function (params) {
                            return {
                                page: params.page || 20,
                                q: params.term || '',
                                pageSize: 10,
                                sortField: "insurance_code",
                                sortOrder: "ASC",
                                company_id: 1
                            };
                        },
                        processResults: function (data, params) {
                            params.page = params.page || 1;
                            return {
                                results: data,
                                pagination: {
                                    more: (params.page * 30) < data[0].total_records
                                }
                            };
                        },
                        cache: true
                    },
                    placeholder: 'Select carrier',
                    escapeMarkup: function (markup) { return markup; },
                    minimumInputLength: 0,
                    templateResult: formatRepo,
                    templateSelection: formatRepoSelection
                });
                function formatRepo(repo) {
                    if (repo.loading) {
                        return repo.text;
                    }
                    var insurance_info = commonjs.hstoreParse(repo.insurance_info);
                    var markup = "<table><tr>";
                    markup += "<td title='" + repo.insurance_name + "(" + repo.insurance_code + ")'> <div>" + repo.insurance_name + "(" + repo.insurance_code + ")" + "</div><div>" + insurance_info.Address1 + "</div>";
                    markup += "<div>" + insurance_info.City + ", " + insurance_info.State + " " + insurance_info.ZipCode + "</div>";
                    markup += "</td></tr></table>";
                    return markup;

                }
                function formatRepoSelection(res) {
                    if (res && res.id)
                        self.bindInsuranceDetails(res);
                    return res.insurance_name;
                }
                $('#select2-txtautoPayerPIP-container').html('Select Insurance');
            },

            bindInsuranceDetails: function (res) {
                var self = this, payer_typ, coverage_level;
                self.payer_id = res.id;
                self.insurance_provider_id = res.id;
                self.payerCode = res.insurance_code;
                self.payerName = res.insurance_name;
                self.payerType = 'insurance';
                coverage_level = 'Primary Insurance';
            },

            setPatientAutoComplete: function () {
                var self = this;
                $("#txtautoPayerPP").select2({
                    ajax: {
                        url: "/exa_modules/billing/autoCompleteRouter/patients",
                        dataType: 'json',
                        delay: 250,
                        data: function (params) {
                            return {
                                page: params.page || 20,
                                q: params.term || '',
                                pageSize: 10,
                                sortField: "insurance_code",
                                sortOrder: "ASC",
                                company_id: 1
                            };
                        },
                        processResults: function (data, params) {
                            params.page = params.page || 1;
                            return {
                                results: data,
                                pagination: {
                                    more: (params.page * 30) < data[0].total_records
                                }
                            };
                        },
                        cache: true
                    },
                    placeholder: 'Select Patient',
                    escapeMarkup: function (markup) { return markup; }, // let our custom formatter work
                    minimumInputLength: 0,
                    templateResult: formatRepo,
                    templateSelection: formatRepoSelection
                });
                function formatRepo(repo) {
                    if (repo.loading) {
                        return repo.text;
                    }
                    var markup = "<table><tr>";
                    markup += "<td title='" + repo.full_name + "(" + repo.account_no + ")'> <div>" + repo.full_name + "(" + repo.account_no + ")" + "</div><div>" + commonjs.getFormattedUtcDate(repo.DOB) + "</div>";
                    markup += "</td></tr></table>";
                    return markup;

                }
                function formatRepoSelection(res) {
                    if (res && res.id)
                        self.bindPatientDetails(res);
                    return res.full_name;
                }
                $('#select2-txtautoPayerPP-container').html('Select Patient');
            },

            setOFAutoComplete: function () {
                var self = this;
                $('#s2id_txtautoPayerPOF a span').html('Select ordering facility');
                $("#txtautoPayerPOF").select2({
                    ajax: {
                        url: "/exa_modules/billing/autoCompleteRouter/orderingFacility",
                        dataType: 'json',
                        delay: 250,
                        data: function (params) {
                            return {
                                page: params.page || 20,
                                q: params.term || '',
                                pageSize: 10,
                                sortField: "insurance_code",
                                sortOrder: "ASC",
                                company_id: 1
                            };
                        },
                        processResults: function (data, params) {
                            params.page = params.page || 1;
                            return {
                                results: data,
                                pagination: {
                                    more: (params.page * 30) < data[0].total_records
                                }
                            };
                        },
                        cache: true
                    },
                    placeholder: 'Select ordering facility',
                    escapeMarkup: function (markup) { return markup; }, // let our custom formatter work
                    minimumInputLength: 0,
                    templateResult: formatRepo,
                    templateSelection: formatRepoSelection
                });
                function formatRepo(repo) {
                    if (repo.loading) {
                        return repo.text;
                    }
                    var markup = "<table><tr>";
                    markup += "<td title='" + repo.group_name + "(" + repo.group_code + ")'> <div>" + repo.group_name + "(" + repo.group_code + ")" + "</div>";
                    markup += "</td></tr></table>";
                    return markup;

                }
                function formatRepoSelection(res) {
                    if (res && res.id)
                        self.bindOfDetails(res);
                    return res.group_name;
                }
                $('#select2-txtautoPayerPOF-container').html('Select Ordering facility');
            },

            setProviderAutoComplete: function () {
                var self = this;
                $('#s2id_txtautoPayerPR a span').html('Select provider');
                $("#txtautoPayerPR").select2({
                    ajax: {
                        url: "/exa_modules/billing/autoCompleteRouter/getProvidersAc",
                        dataType: 'json',
                        delay: 250,
                        data: function (params) {
                            return {
                                page: params.page || 20,
                                q: params.term || '',
                                pageSize: 10,
                                sortField: "insurance_code",
                                sortOrder: "ASC",
                                company_id: 1
                            };
                        },
                        processResults: function (data, params) {
                            params.page = params.page || 1;
                            return {
                                results: data,
                                pagination: {
                                    more: (params.page * 30) < data[0].total_records
                                }
                            };
                        },
                        cache: true
                    },
                    placeholder: 'Select provider',
                    escapeMarkup: function (markup) { return markup; }, // let our custom formatter work
                    minimumInputLength: 0,
                    templateResult: formatRepo,
                    templateSelection: formatRepoSelection
                });
                function formatRepo(repo) {
                    if (repo.loading) {
                        return repo.text;
                    }
                    var markup = "<table><tr>";
                    markup += "<td title='" + repo.full_name + "(" + repo.provider_code + ")'> <div>" + repo.full_name + "(" + repo.provider_code + ")" + "</div>";
                    markup += "</td></tr></table>";
                    return markup;
                }
                function formatRepoSelection(res) {
                    if (res && res.id)
                        self.bindProviderDetails(res);
                    return res.full_name;
                }
                $('#select2-txtautoPayerPR-container').html('Select Provider');
            },

            bindPatientDetails: function (res) {
                var self = this, payer_type, coverage_level;
                self.payer_id = res.id;
                self.patient_id = res.id;
                self.payerCode = '';
                self.payerName = res.full_name;
                self.payerType = 'patient';
                coverage_level = 'Patient';
            },

            bindOfDetails: function (res) {
                var self = this, payer_type, coverage_level;
                self.payer_id = res.id;
                self.provider_group_id = res.id;
                self.payerCode = res.group_code;
                self.payerName = res.group_name;
                self.payerType = 'ordering_facility';
                coverage_level = 'Odering Facility';
            },

            bindProviderDetails: function (res) {
                var self = this, payer_typ;
                self.payer_id = res.id;
                self.provider_id = res.id;
                self.payerCode = res.provider_code;
                self.payerName = res.full_name;
                self.payerType = 'Ordering Provider';
                coverage_level = 'Providers';
            },

            bindpayments: function (response, paymentID) {
                var self = this;
                self.order_id = (response.order_id) ? response.order_id : 0;
                self.study_id = (response.study_id) ? response.study_id : 0;
                $('#lblPayerID').html(response.id);
                $('#referencePaymentID').val(response.display_id);
                $('#ddlPaidLocation').val(response.facility_id);
                $("input:radio[name=payertype][value=" + response.payer_type + "]").prop("checked", true);
                self.setPayerName(response.payer_type, response)
                $("input:radio[name=billingMethod][value=" + response.billing_method + "]").prop("checked", true);
                if (response.billing_method && response.billing_method == "DB")
                    $('#chkDirectingBillingCon').show();

                $('#txtInvoice').val(response.invoice_no);
                $('#txtAmount').val(response.amount.substr(1));
                $('#lblApplied').html(response.applied.substr(1));
                $('#lblBalance').html(response.available_balance.substr(1));
                $("#txtCheque").val(response.card_number);
                $("#txtCardName").val(response.card_name);
                $("#ddlpaymentReason").val(response.payment_reason_id)
                $("#txtNotes").val(response.notes)
                $("input:radio[name=payerMode][value=" + response.payment_mode + "]").prop("checked", true);
                $('#txtAccountingDate').val(moment(response.accounting_date).format('L'))

                self.payer_type = response.payer_type;
                self.payment_id = paymentID;
                self.patient_id = response.patient_id;
                self.payer_id = response.patient_id || response.provider_contact_id || response.provider_group_id || response.insurance_provider_id;
                self.provider_id = response.provider_contact_id;
                self.provider_group_id = response.provider_group_id;
                self.insurance_provider_id = response.insurance_provider_id;

                self.showPendingPaymentsGrid(paymentID, response.payer_type, self.payer_id);
                self.showAppliedByPaymentsGrid(paymentID, response.payer_type, self.payer_id);
                if (!self.casCodesLoaded)
                    self.setCasGroupCodesAndReasonCodes();
            },

            setPayerName: function (payerType, payerNames) {
                this.setPayerFields(null, $("input:radio[name=payertype][value=" + payerType + "]"));

                if (payerType === 'insurance') {
                    $('#select2-txtautoPayerPIP-container').html(payerNames.insurance_name);
                }
                else if (payerType === 'patient') {
                    $('#select2-txtautoPayerPP-container').html(payerNames.patient_name);
                }
                else if (payerType === 'ordering_facility') {
                    $('#select2-txtautoPayerPOF-container').html(payerNames.ordering_facility_name);
                }
                else if (payerType === 'ordering_provider') {
                    $('#select2-txtautoPayerPR-container').html(payerNames.provider_full_name);
                }
            },

            setCasGroupCodesAndReasonCodes: function () {
                var self = this;
                $.ajax({
                    url: '/exa_modules/billing/pending_payments/getGroupCodesAndReasonCodes',
                    type: 'GET',
                    data: {
                        companyID: app.companyID
                    },
                    success: function (data, response) {
                        self.casCodesLoaded = true;
                        var casCodes = data[0];
                        self.cas_group_codes = casCodes.cas_group_codes;
                        self.cas_reason_codes = casCodes.cas_reason_codes;
                    },
                    error: function (err, response) {
                        commonjs.handleXhrError(err, response);
                    }
                });
            },

            validatePayer: function (payermode) {
                var self = this;
                if (payermode == 'insurance' && !self.payer_id) {
                    commonjs.showWarning("Please select insurance");
                    return false;
                }
                else if (payermode == 'patient' && !self.payer_id) {
                    commonjs.showWarning("Please select patient");
                    return false;
                }
                else if (payermode == 'provider' && !self.payer_id) {
                    commonjs.showWarning("Please select provider");
                    return false;
                }
                else if (payermode == 'ordering_facility' && !self.payer_id) {
                    commonjs.showWarning("Please select ordering facility");
                    return false;
                }
                else
                    return true;
            },

            validatepayments: function () {
                var self = this;
                var amount = $.trim($("#txtAmount").val());
                if ($('input:radio[name=payertype]:checked').length == 0) {
                    commonjs.showWarning("Please select payer type");
                    return false;
                }
                if (!self.validatePayer($('input:radio[name=payertype]:checked').val())) {
                    return false;
                }
                if ($.trim($("#txtAccountingDate").val()) == "") {
                    commonjs.showWarning("Please select accounting date");
                    return false;
                }
                if (amount == "") {
                    commonjs.showWarning("Please enter amount");
                    return false;
                }
                if (amount == "" || (amount.indexOf('-') > 0)) {
                    commonjs.showWarning("Please enter valid amount");
                    return false;
                }
                if ($('input:radio[name=payerMode]:checked').length == 0) {
                    commonjs.showWarning("Please select payment mode");
                    return false;
                }
                if ($('#chkModeCheck').prop('checked') && $.trim($("#txtCheque").val()) == "") {
                    commonjs.showWarning('Please enter cheque#');
                    return false;
                }
                if ($('#chkModeCard').prop('checked') && $.trim($("#txtCheque").val()) == "") {
                    commonjs.showWarning('Please enter card no');
                    return false;
                }
                return true;
            },

            savePayment: function () {
                var self = this;
                if (self.validatepayments()) {
                    commonjs.showLoading('Loading..')
                    var applied = 0;
                    var balance = 0;
                    var amount = $.trim($('#txtAmount').val().replace(',', ''));
                    var amountValue = amount ? parseFloat(amount.replace(/[^0-9\.]+/g, "")).toFixed(2) : 0.00;
                    var applied = $.trim($('#lblApplied').html());
                    var appliedValue = applied ? parseFloat(applied.replace(/[^0-9\.]+/g, "")).toFixed(2) : 0.00;
                    var balance = (parseFloat(amountValue).toFixed(2) - parseFloat(appliedValue).toFixed(2)) + 0.00;
                    var totalbalance = balance ? parseFloat(balance).toFixed(2) : '0.00';
                    this.model.set({
                        paymentId: self.payment_id,
                        company_id: app.companyID,
                        facility_id: $.trim($('#ddlPaidLocation').val()),
                        display_id: $.trim($('#referencePaymentID').val()) || null,
                        payer_type: $('input:radio[name=payertype]:checked').val(),
                        amount: $.trim($('#txtAmount').val().replace(',', '')) || 0.00,
                        invoice_no: $('#txtInvoice').val() || null,
                        accounting_date: moment($('#txtAccountingDate').val()).format('L') || null,
                        patient_id: self.patient_id,
                        provider_contact_id: self.provider_id,
                        provider_group_id: self.provider_group_id,
                        insurance_provider_id: self.insurance_provider_id,
                        credit_card_number: $("#txtCheque").val() || null,
                        credit_card_name: $("#txtCardName").val() || null,
                        payment_mode: $("input:radio[name=payerMode]:checked").val() ? $("input:radio[name=payerMode]:checked").val() : '',
                        payment_reason_id: $("#ddlpaymentReason").val() || null,
                        user_id: app.userID,
                        notes: ($("#txtNotes").val()).replace(/(\r\n|\n|\r)/gm, "") || null
                    });
                    this.model.save({
                    }, {
                            success: function (model, response) {
                                if (self.payment_id) {
                                    commonjs.showStatus('Payment has been updated successfully');
                                    self.render(self.payment_id);
                                    commonjs.hideLoading();
                                }
                                else
                                    self.render(model.attributes[0].id);
                            },
                            error: function (err, response) {
                                commonjs.handleXhrError(err, response);
                            }
                        });
                }
            },

            showPendingPaymentsGrid: function (paymentID, payerType, payerId) {
                var self = this;
                this.pendPaymentTable = new customGrid();
                this.pendPaymentTable.render({
                    gridelementid: '#tblpendPaymentsGrid',
                    custompager: this.pendPaymtPager,
                    emptyMessage: 'No Record found',
                    colNames: ['', '', '', '', '', '', '', '', '', '', '', '', '', ''],
                    i18nNames: ['', '', '', '', '', 'billing.fileInsurance.claimNo', 'billing.fileInsurance.invoiceNo', 'billing.payments.patient', 'billing.payments.billFee', 'billing.payments.balance', 'order.summary.cptCodes', 'setup.studyFilters.accountNo', 'patient_id', 'facility_id'],
                    colModel: [
                        {
                            name: 'edit', width: 20, sortable: false, search: false,
                            className: 'icon-ic-edit',
                            formatter: function (a, b, c) {
                                return "<span class='icon-ic-edit' title='click Here to Edit'></span>"
                                // var url = "#app/payments/edit/" + b.rowId;
                                // return '<a href=' + url + '> Edit'
                            },
                            customAction: function (rowID, e) {
                                var gridData = $('#tblpendPaymentsGrid').jqGrid('getRowData', rowID);
                                self.order_payment_id = 0;
                                self.showApplyAndCas(rowID, paymentID, 'pending', gridData.charge_id);
                            }
                        },
                        {
                            name: 'claim_inquiry', width: 20, sortable: false, search: false,
                            className: 'icon-ic-raw-transctipt',
                            formatter: function () {
                                return "<span class='icon-ic-raw-transctipt' title='click Here to view Claim inquiry'></span>"
                            },
                            customAction: function (rowID, e) {
                                var gridData = $('#tblpendPaymentsGrid').jqGrid('getRowData', rowID);
                                commonjs.showDialog({ header: 'Claim Inquiry', i18nHeader: 'menuTitles.rightClickMenu.claimInquiry', onLoad: 'removeIframeHeader()', width: '85%', height: '75%', url: '/vieworder#patient/paymentDetails/' + gridData.order_id + '/' + gridData.patient_id });
                            }
                        },
                        { name: 'id', index: 'id', key: true, searchFlag: 'int', hidden: true },
                        { name: 'order_id', hidden: true },
                        { name: 'charge_id', hidden: true },
                        { name: 'claim_id', searchColumn: ['orders.id'], searchFlag: '%', width: 150 },
                        { name: 'invoice_no', searchFlag: '%', sortable: false, width: 150 },
                        { name: 'full_name', searchFlag: '%', searchColumn: ['patients.full_name'], width: 250 },
                        { name: 'billing_fee', searchFlag: 'int', formatter: self.billingFeeFormatter, width: 100 },
                        { name: 'balance', searchFlag: 'int', formatter: self.balanceFormatter, width: 100 },
                        { name: 'display_description', searchFlag: '%', width: 300 },
                        { name: 'account_no', searchFlag: '%', width: 150 },
                        { name: 'patient_id', key: true, hidden: true },
                        { name: 'facility_id', key: true, hidden: true },
                    ],
                    customizeSort: true,
                    sortable: {
                        exclude: ',#jqgh_tblpendPaymentsGrid_edit'
                    },
                    pager: '#gridPager_pendPayments',
                    sortname: "patients.full_name",
                    sortorder: "ASC",
                    caption: "Pending Payments",
                    datastore: self.pendingPayments,
                    container: this.el,
                    ondblClickRow: function (rowID) {
                        self.order_payment_id = 0;
                        var gridData = $('#tblpendPaymentsGrid').jqGrid('getRowData', rowID);
                        self.showApplyAndCas(rowID, paymentID, 'pending', gridData.charge_id);
                    },
                    disablesearch: false,
                    disablesort: false,
                    disablepaging: false,
                    showcaption: false,
                    disableadd: true,
                    disablereload: true,
                    onbeforegridbind: self.updateCollection,
                    customargs: {
                        gridFlag: 'pendingPayments',
                        paymentID: paymentID,
                        payerId: payerId,
                        payerType: payerType
                    }
                });

                if (self.options.customargs) {
                    self.options.customargs.fromDate = null;
                    self.options.customargs.toDate = null;
                    self.options.customargs.facility_id = null;
                    self.options.customargs.payer_type = payerFlag;
                    self.options.customargs.payer_id = payer_id;
                    self.options.invoice_no = invoice_no ? invoice_no : 0
                }
            },

            showAppliedByPaymentsGrid: function (paymentID, payerType, payerId) {
                var self = this;
                this.appliedPaymentTable = new customGrid();
                this.appliedPaymentTable.render({
                    gridelementid: '#tblAppliedPaymentsGrid',
                    custompager: this.appliedPager,
                    emptyMessage: 'No Record found',
                    colNames: ['', '', '', '', 'Order Payment Ref', '', '', '', '', '', '', '', '', '', '', '', ''],
                    i18nNames: ['', '', '', '', '', 'billing.fileInsurance.claimNo', 'billing.fileInsurance.invoiceNo', 'billing.payments.patient', 'billing.payments.billFee', 'billing.payments.patientPaid', 'billing.payments.payerPaid', 'billing.payments.adjustment', 'billing.payments.thisPayment', 'billing.payments.balance', 'billing.payments.cptCodes', 'patient_id', 'facility_id'],
                    colModel: [
                        {
                            name: 'edit', width: 20, sortable: false, search: false,
                            className: 'icon-ic-edit',
                            formatter: function (a, b, c) {
                                return "<span class='icon-ic-edit' title='click Here to Edit'></span>"
                                // var url = "#app/payments/edit/" + b.rowId;
                                // return '<a href=' + url + '> Edit'
                            },
                            customAction: function (rowID, e) {
                                var gridData = $('#tblAppliedPaymentsGrid').jqGrid('getRowData', rowID);
                                self.showApplyAndCas(rowID, paymentID, 'applied', gridData.charge_id);
                            }
                        },
                        {
                            name: 'claim_inquiry', width: 20, sortable: false, search: false,
                            className: 'icon-ic-raw-transctipt',
                            formatter: function () {
                                return "<span class='icon-ic-raw-transctipt' title='click Here to view Claim inquiry'></span>"
                            },
                            customAction: function (rowID, e) {
                                var gridData = $('#tblAppliedPaymentsGrid').jqGrid('getRowData', rowID);
                                commonjs.showDialog({ header: 'Claim Inquiry', i18nHeader: 'menuTitles.rightClickMenu.claimInquiry', onLoad: 'removeIframeHeader()', width: '85%', height: '75%', url: '/vieworder#patient/paymentDetails/' + gridData.order_id + '/' + gridData.patient_id });
                            }
                        },
                        { name: 'id', index: 'id', key: true, searchFlag: 'int', hidden: true },
                        { name: 'charge_id', hidden: true },
                        { name: 'order_payment_ref', searchColumn: ['orders.id'], searchFlag: '%', width: 150 },
                        { name: 'order_id_grid', searchColumn: ['orders.id'], searchFlag: '%', width: 100 },
                        { name: 'claim_id', searchFlag: '%', sortable: false, width: 100 },
                        { name: 'full_name', searchFlag: '%', searchColumn: ['patients.full_name'], width: 200 },
                        { name: 'bill_fee', searchFlag: 'hstore', searchColumn: ['order_info->bill_fee'], formatter: self.appliedBillFeeFormatter, width: 100 },
                        { name: 'patient_paid', searchFlag: 'hstore', searchColumn: ['more_info->patient_paid'], formatter: self.appliedPatPaidFormatter, width: 100 },
                        { name: 'others_paid', searchFlag: 'hstore', searchColumn: ['more_info->payer_paid'], formatter: self.appliedPayerPaidFormatter, width: 100 },
                        { name: 'adjustment', searchFlag: 'hstore', searchColumn: ['order_info->adjustment'], formatter: self.appliedAdjustmentFormatter, width: 100 },
                        { name: 'amount_paid', searchFlag: 'money', formatter: self.paymentApplied, width: 100 },
                        { name: 'balance', searchFlag: 'hstore', searchColumn: ['order_info->balance'], formatter: self.appliedBalanceFormatter, width: 100 },
                        { name: 'display_description', searchFlag: '%', width: 200 },
                        { name: 'patient_id', key: true, hidden: true },
                        { name: 'facility_id', key: true, hidden: true }
                    ],
                    customizeSort: true,
                    sortable: {
                        exclude: ',#jqgh_tblAppliedPaymentsGrid_edit'
                    },
                    pager: '#gridPager_appliedPayments',
                    sortname: "full_name",
                    sortorder: "ASC",
                    caption: "Applied Payments",
                    datastore: self.appliedPayments,
                    container: this.el,
                    ondblClickRow: function (rowID) {
                        var gridData = $('#tblAppliedPaymentsGrid').jqGrid('getRowData', rowID);
                        self.showApplyAndCas(rowID, paymentID, 'applied', gridData.charge_id);
                    },
                    disablesearch: false,
                    disablesort: false,
                    disablepaging: false,
                    showcaption: false,
                    disableadd: true,
                    disablereload: true,
                    customargs: {
                        gridFlag: 'appliedPayments',
                        paymentID: paymentID,
                        payerId: payerId,
                        payerType: payerType
                    }
                });
            },

            showApplyAndCas: function (claimId, paymentID, paymentStatus, chargeId) {
                var self = this;
                self.defalutCASArray = [0, 1, 2, 3, 4, 5, 6];
                commonjs.showDialog({ header: 'Claim Charges', width: '85%', height: '70%', html: self.applyCasTemplate({adjustmentCodes: self.adjustmentCodeList.toJSON(), 'claimStatusList': this.claimStatusList.toJSON(), cas_group_codes: self.cas_group_codes, cas_reason_codes: self.cas_reason_codes }) });
                $('#divPaymentCAS select').select2();
                commonjs.processPostRender();

                $('#btnCloseAppliedPendingPayments,#btnCloseApplyPaymentPopup').unbind().bind('click', function (e) {
                    $('#divPaymentApply').remove();
                    $('#siteModal').hide();
                });
                self.getClaimBasedCharges(claimId, paymentID, paymentStatus, chargeId);
            },

            setFeeFields: function (claimDetail) {
                $('#spApplyTotalFee').text(claimDetail.total_bill_fee ? parseFloat(claimDetail.total_bill_fee).toFixed(2) : 0.00);
                $('#spApplyAllowed').text(claimDetail.total_allowed_fee ? parseFloat(claimDetail.total_allowed_fee).toFixed(2) : 0.00);
                $('#spPaymentApplied').text(claimDetail.order_payment_applied ? parseFloat(claimDetail.order_payment_applied).toFixed(2) : 0.00);
                $('#spAdjustmentApplied').text(claimDetail.order_adjustment_applied ? parseFloat(claimDetail.order_adjustment_applied).toFixed(2) : 0.00);
                $('#spPaymentUnApplied').text(claimDetail.order_payment_unapplied ? parseFloat(claimDetail.order_payment_unapplied).toFixed(2) : 0.00);
                $('#spAdjustmentUnApplied').text(claimDetail.order_adjustment_unapplied ? parseFloat(claimDetail.order_adjustment_unapplied).toFixed(2) : 0.00);

                $('#txtDeduction').val("0.00");
                $('#txtCoInsurance').val("0.00");
                $('#txtCoPay').val("0.00");
                var order_info = {};
                $('#lblBalance').text(order_info.balance ? parseFloat(order_info.balance).toFixed(2) : "0.00");
                $('#lblContractValue').text(order_info.allowed_fee ? parseFloat(order_info.allowed_fee).toFixed(2) : "0.00");
                $('#lblBillingFee').text(order_info.bill_fee ? parseFloat(order_info.bill_fee).toFixed(2) : "0.00");
                $('#lblAdjustment').text(order_info.adjustment ? parseFloat(order_info.adjustment).toFixed(2) : "0.00");
                $('#lblOthers').text(order_info.others_paid ? parseFloat(order_info.others_paid).toFixed(2) : "0.00");
                $('#lblPatient').text(order_info.patient_paid ? parseFloat(order_info.patient_paid).toFixed(2) : "0.00");
                $('#ddlClaimStatus').val(order_info.claim_status);
                $('#txtResponsibleNotes').val('');
            },

            getClaimBasedCharges: function (claimId, paymentId, paymentStatus, chargeId) {
                var self = this;
                self.casSave = [];
                $.ajax({
                    url: '/exa_modules/billing/pending_payments/getClaimBasedCharges',
                    type: 'GET',
                    data: {
                        claimId: claimId,
                        paymentId: paymentId,
                        paymentStatus: paymentStatus,
                        charge_id: chargeId,
                        companyID: app.companyID
                    },
                    success: function (data, response) {
                        var allData = data[0];
                        var charges = allData.charges;
                        var adjustmentCodes = allData.adjustment_codes;
                        var payerTypes = allData.payer_types;
                        $('#tBodyApplyPendingPayment').empty();
                        $('#ddlAdjustmentCode_fast').empty();
                        $('#ddlResponsible').empty();
                        $.each(charges, function (index, payment) {
                            var paymentDet = {}
                            paymentDet.index = index;
                            paymentDet.id = payment.id ? payment.id : null;
                            paymentDet.study_id = payment.study_id ? payment.study_id : null;
                            paymentDet.payment_id = paymentId;
                            paymentDet.claimId = claimId;
                            paymentDet.study_cpt_id = payment.study_cpt_id ? payment.study_cpt_id : null;
                            paymentDet.cpt_code_id = payment.cpt_code_id ? payment.cpt_code_id : null;
                            paymentDet.cpt_code = payment.cpt_code;
                            paymentDet.cpt_description = payment.cpt_description;
                            paymentDet.payment_amount = payment.current_payment ? parseFloat(payment.current_payment).toFixed(2) : 0.00;
                            paymentDet.other_payment = payment.other_payment && !isNaN(payment.other_payment) ? parseFloat(payment.other_payment).toFixed(2) : 0.00;
                            paymentDet.other_adjustment = payment.other_adjustment && !isNaN(payment.other_adjustment) ? parseFloat(payment.other_adjustment).toFixed(2) : 0.00;
                            paymentDet.adjustment = payment.current_adj ? parseFloat(payment.current_adj).toFixed(2) : 0.0;
                            paymentDet.bill_fee = payment.bill_fee ? parseFloat(payment.bill_fee).toFixed(2) : 0.00
                            paymentDet.allowed_fee = 0.00;
                            paymentDet.payment_application_id = payment.payment_application_id;
                            var balance = parseFloat(paymentDet.bill_fee) - (parseFloat(paymentDet.other_payment) + parseFloat(paymentDet.other_adjustment) + parseFloat(paymentDet.adjustment) + parseFloat(paymentDet.payment_amount)).toFixed(2);
                            paymentDet.balance = parseFloat(balance).toFixed(2);

                            var applyPaymentRow = self.applyPaymentTemplate({ payment: paymentDet });

                            $('#tBodyApplyPendingPayment').append(applyPaymentRow);

                            var cas_arr_obj = [];
                            var cas_arr_obj = payment.cas_arr_obj ? JSON.parse(payment.cas_arr_obj) : [];
                            self.casSave[index] = cas_arr_obj;

                            $('#btnCancelCAS').unbind().on('click', function () {
                                self.closePaymentsCAS(paymentStatus);
                            });

                            $('#btnSaveCAS').unbind().on('click', function () {
                                self.savePaymentsCAS(claimId, paymentId, paymentStatus, payment.payment_application_id);
                            });
                        });
                        self.setFeeFields({});
                        $.each(adjustmentCodes, function (index, adjustmentCode) {
                            $('#ddlAdjustmentCode_fast').append($('<option/>', { value: adjustmentCode.id, text: adjustmentCode.description }));
                        });
                        $('#ddlAdjustmentCode_fast').select2({});
                        $.each(payerTypes, function (index, payerType) {
                            if (payerType.patient_id)
                                $('#ddlResponsible').append($('<option/>', { value: payerType.patient_id, text: payerType.patient_name, 'data-payerType': 'patient' }));
                            // if (payerType.facility_id)
                            //     $('#ddlResponsible').append($('<option/>', { value: payerType.facility_id, text: payerType.facility_name, 'data-payerType': 'patient' }));
                            if (payerType.primary && payerType.primary != 'null')
                                $('#ddlResponsible').append($('<option/>', { value: payerType.primary, text: payerType.primary_ins_provider_name + '(' + payerType.primary_ins_provider_code + ')', 'data-payerType': 'primary_insurance' }));

                            if (payerType.secondary && payerType.secondary != 'null')
                                $('#ddlResponsible').append($('<option/>', { value: payerType.primary, text: payerType.secondary_ins_provider_name + '(' + payerType.secondary_ins_provider_code + ')', 'data-payerType': 'secondary_insurance' }));

                            if (payerType.tertiary && payerType.tertiary != 'null')
                                $('#ddlResponsible').append($('<option/>', { value: payerType.primary, text: payerType.tertiary_ins_provider_name + '(' + payerType.tertiary_ins_provider_code + ')', 'data-payerType': 'tertiary_insurance' }));

                            if (payerType.order_facility_id)
                                $('#ddlResponsible').append($('<option/>', { value: payerType.order_facility_id, text: payerType.ordering_facility_name, 'data-payerType': 'ordering_facility' }));
                            if (payerType.referring_provider_contact_id)
                                $('#ddlResponsible').append($('<option/>', { value: payerType.referring_provider_contact_id, text: payerType.provider_name, 'data-payerType': 'referring_provider' }));
                        });
                        $("#ddlResponsible option[data-payerType=" + payerTypes[0].payer_type + "]").attr('selected', 'selected');
                        $('#ddlResponsible').select2({});
                        $('#tBodyApplyPendingPayment').find('.applyCAS').on('click', function (e) {
                            self.getPayemntApplications(e);
                        });
                        $('#applyPaymentContent').find('#btnSaveAppliedPendingPayments').unbind().on('click', function (e) {
                            self.saveAllPayments(e, claimId, paymentId, paymentStatus, chargeId);
                        });
                        $('#btnClearAppliedPendingPayments').unbind().on('click', function (e) {
                            self.clearPayments(e, paymentId, claimId);
                        });
                    },
                    error: function (err, response) {
                        commonjs.handleXhrError(err, response);
                    }
                });
            },

            clearPayments: function () {
                var pay_val = '0.00';
                $('.this_pay').val(pay_val);
                $('.this_adjustment').val(pay_val);
            },

            savePaymentsCAS: function (claimId, paymentId, paymentStatus, payment_application_id) {
                var self = this;
                var cas = self.vaidateCasCodeAndReason();
                self.casSegmentsSelected[payment_application_id] = cas;

                var self = this;
                $.ajax({
                    url: '/exa_modules/billing/pending_payments/savePaymentApplicationDetails',
                    type: 'GET',
                    data: {
                        cas: cas,
                        companyID: app.companyID
                    },
                    success: function (data, response) {
                    },
                    error: function (err, response) {
                        commonjs.handleXhrError(err, response);
                    }
                });
            },

            vaidateCasCodeAndReason: function () {
                var self = this;
                var hasReturned = false;
                var casObj = [];
                var emptyCasObj = {};
                for (var k = 1; k <= 7; k++) {
                    var groupCode = $('#selectGroupCode' + k).val()
                    var reasonCode = $('#selectReason' + k).val()
                    var amount = $('#txtAmount' + k).val()

                    if (groupCode != '' && reasonCode != '' && amount != '') {
                        emptyCasObj['group_code' + k] = groupCode;
                        emptyCasObj['group_reason' + k] = reasonCode;
                        emptyCasObj['amount' + k] = amount;
                        casObj.push(emptyCasObj);
                        hasReturned = true;
                    }
                    else if (groupCode != '' && reasonCode == '') {
                        commonjs.showWarning('Please select the reason in row ' + k);
                        $('#selectReason' + k).focus()
                        return false;
                    }
                    else if ((reasonCode != '' || groupCode != '') && amount == "") {
                        commonjs.showWarning('Please enter amount in row ' + k);
                        $('#txtAmount' + k).focus();
                        return false;
                    }
                }

                return casObj;
            },

            getPayemntApplications: function (e) {
                var self = this;
                var chargeItem = $(e.target).closest('tr');
                var chargeId = chargeItem.attr('data_charge_id_id');
                var paymentApplicationId = chargeItem.attr('data_payment_application_id');
                if (paymentApplicationId) {
                    $.ajax({
                        url: '/exa_modules/billing/pending_payments/getPayemntApplications',
                        type: 'GET',
                        data: {
                            paymentApplicationId: paymentApplicationId
                        },
                        success: function (data, response) {
                            var payemntCasApplns = data;
                            $.each(payemntCasApplns, function (index, appln) {
                                var rowVal = index + 1;
                                $('#selectGroupCode' + rowVal).val(appln.cas_group_code_id);
                                $('#selectReason' + rowVal).val(appln.cas_reason_code_id);
                                $('#txtAmount' + rowVal).val(appln.amount.substr(1));
                            });

                            $('#divPaymentCAS').show();
                        },
                        error: function (err, response) {

                        }
                    });
                }
                else
                    commonjs.showWarning('Payment Application Id not found');
            },

            closePaymentsCAS: function (e) {
                $('#divPaymentCAS select').val('');
                $('#divPaymentCAS input[type="text"]').val('');
                $('#divPaymentCAS').hide();
            },

            validatePayerDetails: function () {
                if ($('#ddlResponsible').val() === '') {
                    commonjs.showWarning('Please select responsible');
                    $('#ddlResponsible').select2('open')
                    return false;
                }
                else if ($('#ddlAdjustmentCode_fast').val() === '0') {
                    commonjs.showWarning('Please select adjustemnt code');
                    $('#ddlAdjustmentCode_fast').select2('open')
                    return false;
                }
                else return true;
            },

            saveAllPayments: function (e, claimId, paymentId, paymentStatus, chargeId) {
                var self = this;
                if (this.validatePayerDetails()) {
                    var lineItems = $("#tBodyApplyPendingPayment tr"), dataLineItems = [], orderPayment = 0.00, orderAdjustment = 0.00;
                    var line_items = [];

                    $.each(lineItems, function (index) {
                        var _line_item = {};
                        _line_item["chargeId"] = $(this).attr('data_charge_id_id');
                        _line_item["payment"] = $(this).find('td:nth-child(5)>input').val() ? parseFloat($(this).find('td:nth-child(5)>input').val()) : 0.00;
                        _line_item["adjustment"] = $(this).find('td:nth-child(8)>input').val() ? parseFloat($(this).find('td:nth-child(8)>input').val()) : 0.00;
                        line_items.push(_line_item);
                    });

                    // var payerType = $('#ddlResponsible').val();
                    var payerType = $('#ddlResponsible').find(':selected').attr('data-payerType');
                    var adjustmentType = $('#ddlAdjustmentCode_fast').val();
                    var billingNotes = $('#txtResponsibleNotes').val();
                    var deduction = $('#txtDeduction').val();
                    var coInsurance = $('#txtCoInsurance').val();
                    var coPay = $('#txtCoPay').val();

                    $.ajax({
                        url: '/exa_modules/billing/payments/applyPayments',
                        type: "POST",
                        dataType: 'json',
                        data: {
                            line_items: JSON.stringify(line_items),
                            paymentId: paymentId,
                            claimId: claimId,
                            user_id: app.userID,
                            coPay: coPay,
                            coInsurance: coInsurance,
                            deductible: deduction,
                            billingNotes: billingNotes,
                            payerType: payerType,
                            adjestmentId: adjustmentType,
                            paymentStatus : paymentStatus
                        },
                        success: function (model, response) {
                            alert('Payment has been applied successfully');
                            self.getClaimBasedCharges(claimId, paymentId, paymentStatus, chargeId);
                        },
                        error: function (err, response) {
                            commonjs.handleXhrError(err, response);
                        }
                    });
                }
            },

            addNewPayemnt: function () {
                Backbone.history.navigate('#billing/payments/new', true);
                this.render(0);
            },
            
            goBackToPayments: function () {
                Backbone.history.navigate('#billing/payments/list', true);
            }
        });
    });