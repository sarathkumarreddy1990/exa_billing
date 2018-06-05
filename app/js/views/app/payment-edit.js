define(['jquery', 'immutable', 'underscore', 'backbone', 'jqgrid', 'jqgridlocale', 'text!templates/app/payment-edit.html', 'models/payment', 'models/pager', 'text!templates/payments-payer.html', 'collections/pending-payments', 'collections/applied-payments', 'text!templates/app/payment-apply-cas.html', 'text!templates/app/apply-payment.html'],
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
                'click #btnSaveAppliedPendingPayments': 'saveAllPayments',
                'change .payerType': 'setPayerFields',
                'click #btnPaymentAddNew': 'addNewPayemnt'
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

                self.render(paymentId);
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

            showBillingForm: function (paymentID) {
                var self = this;
                self.setAcs();
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

            setAcs: function () {
                this.setInsuranceAutoComplete();
                this.setPatientAutoComplete();
                this.setOFAutoComplete();
                this.setProviderAutoComplete();
            },

            setPayerFields: function (e) {
                var srcElement = $(e.target || e.srcElement);
                $('.payerFields').hide();
                if (srcElement.is('#chkpayerInsurance')) {
                    $('#divPayerInsurnace').show();
                    $('#divMethodInsurance').show();
                }
                else if (srcElement.is('#chkpayerPatient')) {
                    $('#divPayerPatient').show();
                    $('#divMethodPatient').show();
                }
                else if (srcElement.is('#chkpayerOrdering')) {
                    $('#divPayerOrderFacility').show();
                    $('#divMethodProvider').show();
                }
                else if (srcElement.is('#chkpayerProvider')) {
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
                    escapeMarkup: function (markup) { return markup; }, // let our custom formatter work
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
                    markup += "<td title='" + repo.insurance_code + "(" + repo.insurance_name + ")'> <div>" + repo.insurance_code + "(" + repo.insurance_name + ")" + "</div><div>" + insurance_info.Address1 + "</div>";
                    markup += "<div>" + insurance_info.City + ", " + insurance_info.State + " " + insurance_info.ZipCode + "</div>";
                    markup += "</td></tr></table>";
                    return markup;

                }
                function formatRepoSelection(res) {
                    if (res && res.id)
                        self.bindInsuranceDetails(res);
                    return res.insurance_name;
                }
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
                $('#s2id_txtautoPayerPP a span').html('Select Patient');
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
                $("input:radio[name=billingMethod][value=" + response.billing_method + "]").prop("checked", true);
                if (response.billing_method && response.billing_method == "DB")
                    $('#chkDirectingBillingCon').show();

                $('#txtInvoice').val(response.invoice_no);
                $('#txtAmount').val(response.amount.substr(1));
                $('#lblApplied').html(response.applied.substr(1));
                $('#lblBalance').html(response.available_balance.substr(1));
                var payment_info = commonjs.hstoreParse(response.payment_info);
                $("#txtCheque").val(payment_info.cheque_card_number);
                $("#txtCardName").val(payment_info.cheque_card_name);
                $("#ddlCardType").val(payment_info.credit_card_type);
                $("#txtCVN").val(payment_info.security_code);
                $("#paymentExpiryMonth").val(payment_info.credit_card_expiration_month);
                $("#paymentExpiryYear").val(payment_info.credit_card_expiration_year);
                $("#ddlpaymentReason").val(payment_info.reason)
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

                self.showPendingPaymentsGrid(paymentID);
                self.showAppliedByPaymentsGrid(paymentID);
                if (!self.casCodesLoaded)
                    self.setCasGroupCodesAndReasonCodes();
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
                    commonjs.showWarning("Please select ordeing facility");
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
                        display_id: $.trim($('#referencePaymentID').val()) || 0,
                        paid_facility_id: $.trim($('#ddlPaidLocation').val()),
                        facility_id: $.trim($('#ddlPaidLocation').val()),
                        payer_type: $('input:radio[name=payertype]:checked').val(),
                        billing_office_id: $.trim($('#ddlBillingOffice').val()) ? $.trim($('#ddlBillingOffice').val()) : 0,
                        amount: $.trim($('#txtAmount').val().replace(',', '')),
                        applied: applied ? applied : 0.00,
                        available_balance: balance ? balance : 0.00,
                        is_refund: false,
                        payer: self.payerType,
                        payer_name: self.payerName,
                        current_status: 'UnApplied',
                        // accounting_date: self.dtpAccountingDate && self.dtpAccountingDate.date() ? self.dtpAccountingDate.date().format('YYYY-MM-DD') : null,
                        accounting_date: moment($('#txtAccountingDate').val()).format('L'),
                        patient_id: self.patient_id,
                        payer_id: self.payer_id,
                        provider_id: self.provider_id,
                        provider_group_id: self.provider_group_id,
                        credit_card_type: $("#ddlCardType").val(),
                        security_code: $("#txtCVN").val() || '',
                        credit_card_number: $("#txtCheque").val() || '',
                        credit_card_name: $("#txtCardName").val() || '',
                        payment_mode: $("input:radio[name=payerMode]:checked").val() ? $("input:radio[name=payerMode]:checked").val() : '',
                        reason: $("#ddlpaymentReason").val(),
                        is_copay: $("#ddlpaymentReason").attr('data-copay'),
                        user_name: app.userInfo.userFullName,
                        user_id: app.userID,
                        notes: ($("#txtNotes").val()).replace(/(\r\n|\n|\r)/gm, ""),
                        paymentId: self.payment_id,
                        insurance_provider_id: self.insurance_provider_id,
                        company_id: app.companyID
                    });
                    this.model.save({
                    }, {
                            success: function (model, response) {
                                if (self.payment_id) {
                                    alert('Payment has been updated successfully');
                                    commonjs.hideLoading()
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

            showPendingPaymentsGrid: function (paymentID) {
                var self = this;
                this.pendPaymentTable = new customGrid();
                this.pendPaymentTable.render({
                    gridelementid: '#tblpendPaymentsGrid',
                    custompager: this.pendPaymtPager,
                    emptyMessage: 'No Record found',
                    colNames: ['', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
                    i18nNames: ['', '', '', '', '', 'billing.fileInsurance.claimNo', 'billing.fileInsurance.invoiceNo', 'billing.payments.patient', 'home.pendingStudies.studyDate', 'billing.payments.billFee', 'billing.payments.balance', 'order.summary.cptCodes', 'setup.studyFilters.accountNo', 'patient_id', 'facility_id'],
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
                                self.showApplyAndCas(rowID, paymentID, 'pending');
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
                        { name: 'study_id', hidden: true },
                        { name: 'claim_id', searchColumn: ['orders.id'], searchFlag: '%', width: 150 },
                        { name: 'invoice_no', searchFlag: '%', sortable: false, width: 150 },
                        { name: 'full_name', searchFlag: '%', searchColumn: ['patients.full_name'], width: 200 },
                        { name: 'study_date', searchFlag: 'datetime', formatter: self.studyDateFormatter, width: 100 },
                        { name: 'billing_fee', searchFlag: 'int', formatter: self.billingFeeFormatter, width: 100 },
                        { name: 'balance', searchFlag: 'int', formatter: self.balanceFormatter, width: 100 },
                        { name: 'display_description', searchFlag: '%', width: 250 },
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
                        self.showApplyAndCas(rowID, paymentID, 'pending');
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
                        payerId: self.payer_id,
                        payerType: self.payer_type
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

            showAppliedByPaymentsGrid: function (paymentID) {
                var self = this;
                this.appliedPaymentTable = new customGrid();
                this.appliedPaymentTable.render({
                    gridelementid: '#tblAppliedPaymentsGrid',
                    custompager: this.appliedPager,
                    emptyMessage: 'No Record found',
                    colNames: ['', '', '', '', '', 'Order Payment Ref', '', '', '', '', '', '', '', '', '', '', '', '', ''],
                    i18nNames: ['', '', '', '', '', '', 'billing.fileInsurance.claimNo', 'billing.fileInsurance.invoiceNo', 'billing.payments.patient', 'home.pendingStudies.studyDate', 'billing.payments.billFee', 'billing.payments.patientPaid', 'billing.payments.payerPaid', 'billing.payments.adjustment', 'billing.payments.thisPayment', 'billing.payments.balance', 'billing.payments.cptCodes', 'patient_id', 'facility_id'],
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
                                self.showApplyAndCas(rowID, paymentID, 'applied');
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
                        { name: 'order_id', hidden: true },
                        { name: 'study_id', hidden: true },
                        { name: 'order_payment_ref', searchColumn: ['orders.id'], searchFlag: '%', width: 150 },
                        { name: 'order_id_grid', searchColumn: ['orders.id'], searchFlag: '%', width: 100 },
                        { name: 'claim_id', searchFlag: '%', sortable: false, width: 100 },
                        { name: 'full_name', searchFlag: '%', searchColumn: ['patients.full_name'], width: 200 },
                        { name: 'study_date', searchFlag: 'datetime', formatter: self.studyDateFormatter, width: 150 },
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
                        self.showApplyAndCas(rowID, paymentID, 'applied');
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
                        payerId: self.payer_id,
                        payerType: self.payer_type
                    }
                });
            },

            showApplyAndCas: function (claimId, paymentID, paymentStatus) {
                var self = this;
                self.defalutCASArray = [0, 1, 2, 3, 4, 5, 6];
                $('<div/>').css({ top: '10%', height: '80%', "left": '5%', "overflow": "auto", "width": "90%", "left": "5%", "position": "absolute", 'border': '1px solid black', 'background-color': 'white' })
                    .appendTo('body')
                    .attr('id', 'divPaymentApply')
                    .html(self.applyCasTemplate({ 'casArray': self.defalutCASArray, adjustmentCodes: self.adjustmentCodeList.toJSON(), 'claimStatusList': this.claimStatusList.toJSON(), cas_group_codes: self.cas_group_codes, cas_reason_codes: self.cas_reason_codes }));
                commonjs.processPostRender();

                $('#btnCloseAppliedPendingPayments,#btnCloseApplyPaymentPopup').unbind().bind('click', function (e) {
                    $('#divPaymentApply').remove();
                    $('#siteModal').hide();
                });
                self.getClaimBasedCharges(claimId, paymentID, paymentStatus);
            },

            getClaimBasedCharges: function (claimId, paymentId, paymentStatus) {
                var self = this;
                self.casSave = [];
                $.ajax({
                    url: '/exa_modules/billing/pending_payments/getClaimBasedCharges',
                    type: 'GET',
                    data: {
                        claimId: claimId,
                        paymentId: paymentId,
                        paymentStatus: paymentStatus,
                        charge_id: 5214
                    },
                    success: function (data, response) {
                        var payments = data;
                        $.each(payments, function (index, payment) {
                            var paymentDet = {}
                            paymentDet.index = index;
                            paymentDet.id = payment.id ? payment.id : null;
                            paymentDet.study_id = payment.study_id ? payment.study_id : null;
                            paymentDet.payment_id = paymentId;
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

                            $('#btnCancelCAS').on('click', function () {
                                self.closePaymentsCAS(paymentStatus);
                            });

                            $('#btnSaveCAS').unbind().on('click', function () {
                                self.savePaymentsCAS(claimId, paymentId, paymentStatus, payment.payment_application_id);
                            });
                        });
                        $('#tBodyApplyPendingPayment').find('.applyCAS').on('click', function (e) {
                            self.getPayemntApplications(e);
                        });
                    },
                    error: function (err, response) {
                        commonjs.handleXhrError(err, response);
                    }
                });
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
                    alert('Payment Application Id not found');
            },

            closePaymentsCAS: function (e) {
                $('#divPaymentCAS select').val('');
                $('#divPaymentCAS input[type="text"]').val('');
                $('#divPaymentCAS').hide();
            },

            saveAllPayments: function () {
                var lineItems = $("#tBodyApplyPendingPayment tr"), dataLineItems = [], orderPayment = 0.00, orderAdjustment = 0.00;
                var valueType = $('input:radio[name=payertype_' + paymentId + ']:checked').val();
                switch (valueType) {
                    case "PIP":
                        payer_id = self.carrierID;
                        payerName = self.carrierNameValue;
                        billingMethod = $('input:radio[name=billingMethod]:checked').val();
                        inVoiceValue = $("#txtInvoice").val();
                        payerTypeID = self.carrierID;
                        var set_payer = $('#ddlResponsible option').filter('[data_id="' + payer_id + '"]').length && $('#ddlResponsible option').filter('[data_id="' + payer_id + '"]').attr('data_payer') ? $('#ddlResponsible option').filter('[data_id="' + payer_id + '"]').attr('data_payer') : '';
                        payer = set_payer ? set_payer : 'Insurance';
                        break;
                    case "PPP":
                        patient_id = self.patientID;
                        payerName = self.full_name;
                        billingMethod = $('input:radio[name=billingPPMethod]:checked').val();
                        payerTypeID = self.patientID;
                        payer = 'Patient';
                        break;
                    case "PRP":
                        provider_id = self.PR_ID;
                        payerName = self.PR_Name;
                        inVoiceValue = $("#txtPRInvoice").val();
                        billingMethod = $('input:radio[name=billingPRMethod]:checked').val();
                        payerTypeID = self.PR_ID;
                        payer = 'Provider';
                        break;
                    case "POF":
                        provider_group_id = self.group_id;
                        payerName = self.group_name;
                        inVoiceValue = $("#txtPRInvoice").val();
                        billingMethod = $('input:radio[name=billingPRMethod]:checked').val();
                        payerTypeID = self.group_id;
                        payer = 'Ordering Facility';
                        break;
                }
                $.each(lineItems, function (index) {
                    var details = {};
                    details.user_id = app.userID;
                    details.payment_id = $(this).attr('data_payment_id');
                    details.study_cpt_id = $(this).attr('data_study_cpt_id');
                    details.cpt_code_id = $(this).attr('data_cpt_id');
                    details.cpt_code = $(this).find('td:nth-child(2)').text();
                    details.cpt_description = $(this).find('td:nth-child(3)').text();
                    details.this_pay = $(this).find('td:nth-child(6)>input').val() ? $(this).find('td:nth-child(6)>input').val() : 0.00;
                    details.this_adjustment = $(this).find('td:nth-child(9)>input').val() ? $(this).find('td:nth-child(9)>input').val() : 0.00;
                    details.bill_fee = $(this).find('td:nth-child(4)').text();
                    details.allowed_fee = $(this).find('td:nth-child(7)').text();
                    details.all_payment = $(this).find('td:nth-child(5)').text() ? $(this).find('td:nth-child(5)').text() : 0.00;
                    details.all_adjustment = $(this).find('td:nth-child(8)').text() ? $(this).find('td:nth-child(8)').text() : "0.00";
                    details.balance = parseFloat(details.bill_fee) - (parseFloat(details.all_payment) + parseFloat(details.all_adjustment) + parseFloat(details.this_pay) + parseFloat(details.this_adjustment)).toFixed(2);
                    details.this_pay = (from == "paid_full" ? details.balance + parseFloat(details.this_pay) : details.this_pay);
                    details.payer = payer;
                    details.payer_name = payerName;
                    details.user_id = app.UserID;
                    details.comment_date = commentDate;
                    details.mode = mode;
                    details.cas_arr_obj = JSON.stringify(self.casSave[index]);
                    details.isPaymentApplied = false;
                    var comment_info = {
                        type: 'charge_payment',
                        payer_type: valueType,
                        IsReport: true,
                        Payment: details.this_pay,
                        from: 'fastPayment',
                        Charge: details.bill_fee,
                        Adjustment: details.this_adjustment
                    };
                    dataLineItems.push(details);
                    orderPayment = parseFloat(orderPayment) + parseFloat(details.this_pay);
                    orderAdjustment = parseFloat(orderAdjustment) + parseFloat(details.this_adjustment);
                });

                $.ajax({
                    url: '/saveAllPayments',
                    type: "PUT",
                    data: {
                        payer: payer,
                        payer_name: payerName,
                        patient_id: self.patientID,
                        allpayments: allpayments
                    },
                    success: function (model, response) {
                        alert('Payment applied successfully');
                    },
                    error: function (err, response) {
                        commonjs.handleXhrError(err, response);
                    }
                });
            },

            addNewPayemnt: function () {
                Backbone.history.navigate('#app/payments/new', true);
            }
        });
    });