define(['jquery', 'immutable', 'underscore', 'backbone', 'jqgrid', 'jqgridlocale', 'text!templates/app/payment-edit.html', 'models/app/payment', 'models/pager', 'text!templates/app/payments-payer.html', 'collections/app/pending-payments', 'collections/app/applied-payments', 'text!templates/app/payment-apply-cas.html', 'text!templates/app/apply-payment.html', 'collections/app/patientsearch', 'text!templates/app/patientSearchResult.html'],
    function (jQuery, Immutable, _, Backbone, JGrid, JGridLocale, editPayment, ModelPayments, ModelPaymentsPager, paymentsGridHtml, pendingPayments, appliedPayments, ApplyCasHtml, ApplyPaymentTemplate, patientCollection, patSearchContent) {
        return Backbone.View.extend({
            el: null,
            pager: null,
            patientsPager: null,
            patientTotalRecords: 0,
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
            patSearchContentTemplate: _.template(patSearchContent),
            gridFirstLoaded: false,

            events: {
                'click #btnPaymentSave': 'savePayment',
                'click #btnApplyCAS': 'getPayemntApplications',
                'change .payerType': 'setPayerFields',
                'click #btnPaymentAddNew': 'addNewPayemnt',
                'click #btnPaymentBack': 'goBackToPayments',
                'click #btnPaymentClear': 'clearPayemntForm',
                "keyup #searchPatient .search-field": "applySearch",
                "click #anc_first": "onpaging",
                "click #anc_previous": "onpaging",
                "click #anc_next": "onpaging",
                "click #anc_last": "onpaging",
                "dblclick .selectionpatient": "selectPatient",
                "click #btnBackToPatient": "backToPatient",
                "click #anc_search": "showPatientOrders",
                'click #btnPaymentRefresh': 'refreshPayments',
                'click a#ppliedRefresh': 'refreshPayments',
                'click #btnPaymentPrint, #btnPrintReceipt, #btnPaymentDelete, #btnPayfullAppliedPendingPayments': "underConstruction"
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
                this.patientsPager = new ModelPaymentsPager();
                this.patientListcoll = new patientCollection();
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
                commonjs.validateControls();
            },

            showPaymentsGrid: function () {
                var ipForm1 = $('#divPendingPay');
                ipForm1.html(this.paymentsGridTemplate({ facilities: this.paidlocation.toJSON() }));
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
                $('#ddlPaidLocation').val(0);
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
                                page: params.page || 1,
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
                                page: params.page || 1,
                                q: params.term || '',
                                pageSize: 10,
                                sortField: "full_name",
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
                        url: "/exa_modules/billing/autoCompleteRouter/provider_group",
                        dataType: 'json',
                        delay: 250,
                        data: function (params) {
                            return {
                                page: params.page || 1,
                                q: params.term || '',
                                pageSize: 10,
                                sortField: "group_name",
                                sortOrder: "ASC",
                                groupType: 'OF',
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
                        url: "/exa_modules/billing/autoCompleteRouter/providers",
                        dataType: 'json',
                        delay: 250,
                        data: function (params) {
                            return {
                                page: params.page || 1,
                                q: params.term || '',
                                provider_type: 'RF',
                                pageSize: 10,
                                sortField: "p.last_name",
                                sortOrder: "asc",
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
                    escapeMarkup: function (markup) { return markup; },
                    minimumInputLength: 0,
                    templateResult: formatRepo,
                    templateSelection: formatRepoSelection
                });
                function formatRepo(repo) {
                    if (repo.loading) {
                        return repo.text;
                    }
           
                    var contactInfo = commonjs.hstoreParse(repo.contact_info);
                    var provContactInfo = self.getProviderAddressInfo(contactInfo);
                    markup1 += "<div>" + provContactInfo._addressInfo + "</div>";
                    markup1 += "<div>" + provContactInfo._cityStateZip + "</div>";
                    if (!repo.is_active) {
                        var markup1 = "<table class='ref-result' style='width: 100%'><tr class='inActiveRow'>";
                        markup1 += "<td><div><b>" + repo.full_name + "</b><b>" + '(' + repo.provider_code + ')' + "</b></div>";                 
                        markup1 += "<div>" + provContactInfo._addressInfo + "</div>";
                        markup1 += "<div>" + provContactInfo._cityStateZip + "</div>";
                        markup1 += "</td></tr></table>";
                        return markup1;
                    }
                    else {
                        var markup = "<table class='ref-result' style='width: 100%'><tr>";
                        markup += "<td><div><b>" + repo.full_name + "</b><b>" + '(' + repo.provider_code + ')' + "</b></div>";                                
                        markup += "<div>" + provContactInfo._addressInfo + "</div>";
                        markup += "<div>" + provContactInfo._cityStateZip + "</div>";
                        markup += "</td></tr></table>"
                    return markup;
                }
                }
                function formatRepoSelection(res) {
                    if (res && res.id)
                        self.bindProviderDetails(res);
                    return res.full_name;
                }
                $('#select2-txtautoPayerPR-container').html('Select Provider');
            },

            getProviderAddressInfo: function (providerInfo) {
                var addressInfo = $.grep([providerInfo.ADDR1, providerInfo.ADDR2], Boolean).join(", ");
                var cityStateZip = $.grep([providerInfo.CITY, providerInfo.STATE, providerInfo.ZIP, providerInfo.MOBNO], Boolean).join(", ");
                return {_addressInfo: addressInfo, _cityStateZip: cityStateZip}
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
                $('#ddlPaidLocation').val(response.facility_id || 0);
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

            refreshPayments: function (e) {
                var target = $(e.target || e.srcElement);
                if (target.is('#btnPaymentRefresh')) {
                    this.pendPaymentTable.refreshAll();
                }
                else {
                    this.appliedPaymentTable.refreshAll();
                }
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
                                    Backbone.history.navigate('#billing/payments/edit/' + model.attributes[0].id, true);  
                            },
                            error: function (err, response) {
                                commonjs.handleXhrError(err, response);
                            }
                        });
                }
            },

            showPendingPaymentsGrid: function (paymentID, payerType, payerId, patientId, invoice_no_to_search) {
                var self = this;
                this.pendPaymentTable = new customGrid();
                this.pendPaymentTable.render({
                    gridelementid: '#tblpendPaymentsGrid',
                    custompager: this.pendPaymtPager,
                    emptyMessage: 'No Record found',
                    colNames: ['', '', '', '', '', '', '', '', '', '', '', '', '', ''],
                    i18nNames: ['', '', '', '', '', 'billing.fileInsurance.claimNo', 'billing.fileInsurance.invoiceNo', 'billing.payments.patient', 'billing.payments.billFee', 'billing.payments.balance', 'setup.userSettings.cptCodes', 'setup.userSettings.accountNo', '', ''],
                    colModel: [
                        {
                            name: 'edit', width: 20, sortable: false, search: false,
                            className: 'icon-ic-edit',
                            formatter: function (a, b, c) {
                                return "<span class='icon-ic-edit' title='click Here to Edit'></span>";
                            },
                            customAction: function (rowID, e) {
                                var gridData = $('#tblpendPaymentsGrid').jqGrid('getRowData', rowID);
                                self.order_payment_id = 0;
                                self.showApplyAndCas(rowID, paymentID, 'pending', gridData.charge_id, gridData);
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
                        { name: 'invoice_no', searchFlag: '%',  width: 150 },
                        { name: 'full_name', searchFlag: '%', searchColumn: ['pp.full_name'], width: 250 },
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
                    sortname: "pp.full_name",
                    sortorder: "ASC",
                    caption: "Pending Payments",
                    datastore: self.pendingPayments,
                    container: this.el,
                    ondblClickRow: function (rowID) {
                        self.order_payment_id = 0;
                        var gridData = $('#tblpendPaymentsGrid').jqGrid('getRowData', rowID);
                        self.showApplyAndCas(rowID, paymentID, 'pending', gridData.charge_id, gridData);
                    },
                    disablesearch: false,
                    disablesort: false,
                    disablepaging: false,
                    showcaption: false,
                    disableadd: true,
                    disablereload: true,
                    // // onbeforegridbind: self.updateCollection,
                    onaftergridbind: function (model, gridObj) {
                        self.afterGridBind(model, gridObj);
                    },
                    customargs: {
                        gridFlag: 'pendingPayments',
                        paymentID: paymentID,
                        payerId: payerId,
                        payerType: payerType,
                        patientId: patientId,
                        invoice_no_to_search: invoice_no_to_search 
                    },
                    
                    beforeRequest: function () {
                        self.setCustomArgs(paymentID, payerId, payerType, patientId, invoice_no_to_search);
                    },
                });
                
                setTimeout(function () {
                    $('#tblpendPaymentsGrid').jqGrid('setGridHeight', '600px');
                    $('#tblpendPaymentsGrid').jqGrid('setGridWidth', $(window).width() - 20);
                }, 500);
            },

            setCustomArgs: function (paymentID, payerId, payerType, patientId, invoice_no_to_search) {
                var self = this;
                self.pendPaymentTable.options.customargs = {
                    gridFlag: 'pendingPayments',
                    paymentID: paymentID,
                    payerId: payerId,
                    payerType: payerType,
                    patientId: patientId,
                    invoice_no_to_search: invoice_no_to_search
                }
            },

            afterGridBind: function (dataset, e, pager) {
                var self = this;
                if (e.options.customargs.patientId || e.options.customargs.invoice_no_to_search) {
                    $('#btnBackToPatient').show();
                    $('#diVPatient').hide();
                    $('#divPendingRecords').show();                    
                }
                else {
                    if (dataset && dataset.length) {
                        $('#btnBackToPatient').hide();
                        $('#divPendingRecords').show();
                        $('#diVPatient').hide();
                        self.gridFirstLoaded = true;
                    }
                    else if(!self.gridFirstLoaded) {
                        $('#divPendingRecords').hide();
                        $('#diVPatient').show();
                    }
                }    
            },

            showAppliedByPaymentsGrid: function (paymentID, payerType, payerId) {
                var self = this;
                this.appliedPaymentTable = new customGrid();
                this.appliedPaymentTable.render({
                    gridelementid: '#tblAppliedPaymentsGrid',
                    custompager: this.appliedPager,
                    emptyMessage: 'No Record found',
                    // colNames: ['', '', '', '', 'Order Payment Ref', '', '', '', '', '', '', '', '', '', '', '', ''],
                    // i18nNames: ['', '', '', '', '', 'billing.fileInsurance.claimNo', 'billing.fileInsurance.invoiceNo', 'billing.payments.patient', 'billing.payments.billFee', 'billing.payments.patientPaid', 'billing.payments.payerPaid', 'billing.payments.adjustment', 'billing.payments.thisPayment', 'billing.payments.balance', 'billing.payments.cptCodes', '', ''],
                    colNames: ['', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
                    i18nNames: ['', '', '', '', 'billing.fileInsurance.claimNo', 'billing.fileInsurance.invoiceNo', 'billing.payments.patient', 'billing.payments.billFee', 'billing.payments.patientPaid', 'billing.payments.payerPaid', 'billing.payments.adjustment', 'billing.payments.balance', 'billing.payments.cptCodes', 'patient_id', 'facility_id'],
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
                                self.showApplyAndCas(rowID, paymentID, 'applied', gridData.charge_id, gridData);
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
                        { name: 'claim_id', searchColumn: ['orders.id'], searchFlag: '%', width: 100 },
                        { name: 'invoice_no', searchFlag: '%',  width: 100 },
                        { name: 'full_name', searchFlag: '%', searchColumn: ['pp.full_name'], width: 200 },
                        { name: 'bill_fee', searchFlag: 'hstore', searchColumn: ['order_info->bill_fee'], formatter: self.appliedBillFeeFormatter, width: 100 },
                        { name: 'patient_paid', searchFlag: 'hstore', searchColumn: ['more_info->patient_paid'], formatter: self.appliedPatPaidFormatter, width: 100 },
                        { name: 'others_paid', searchFlag: 'hstore', searchColumn: ['more_info->payer_paid'], formatter: self.appliedPayerPaidFormatter, width: 100 },
                        { name: 'adjustment', searchFlag: 'hstore', searchColumn: ['order_info->adjustment'], formatter: self.appliedAdjustmentFormatter, width: 100 },
//                        { name: 'amount_paid', searchFlag: 'money', formatter: self.paymentApplied, width: 100 },
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
                        self.showApplyAndCas(rowID, paymentID, 'applied', gridData.charge_id, gridData);
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
                
                setTimeout(function () {
                    $('#tblAppliedPaymentsGrid').jqGrid('setGridHeight', '600px');
                    $('#tblAppliedPaymentsGrid').jqGrid('setGridWidth', $(window).width() - 20);
                }, 500);
            },

            closeAppliedPendingPayments: function () {
                var self = this;
                if (self.appliedPaymentTable) {
                    self.appliedPager.set({ "PageNo": 1 });
                    self.appliedPaymentTable.refreshAll();
                };
                if (self.pendPaymentTable) {
                    self.pendPaymtPager.set({ "PageNo": 1 });
                    self.pendPaymentTable.refreshAll();
                }
            },

            showApplyAndCas: function (claimId, paymentID, paymentStatus, chargeId, rowData) {
                var self = this;
                self.defalutCASArray = [0, 1, 2, 3, 4, 5, 6];
                self.casSegmentsSelected = [];
                var patient_paid = rowData.patient_paid ? rowData.patient_paid.substr(1) : '0.00';
                var others_paid = rowData.others_paid ? rowData.others_paid.substr(1) : '0.00';
                commonjs.showDialog({ header: 'Claim Charges', width: '85%', height: '70%', html: self.applyCasTemplate({ adjustmentCodes: self.adjustmentCodeList.toJSON(), 'claimStatusList': this.claimStatusList.toJSON(), cas_group_codes: self.cas_group_codes, cas_reason_codes: self.cas_reason_codes, patient_paid: patient_paid,  others_paid: others_paid}) });
                
                $('#siteModal .close, #siteModal .btn-secondary').unbind().bind('click', function (e) {
                    self.closeAppliedPendingPayments(e);
                    $('#siteModal').hide();
                })

                // $('#divPaymentCAS select').select2();
                commonjs.processPostRender();
                commonjs.validateControls();

                $('#btnCloseAppliedPendingPayments,#btnCloseApplyPaymentPopup').unbind().bind('click', function (e) {
                    $('#divPaymentApply').remove();
                    $('#siteModal').hide();
                });
                self.getClaimBasedCharges(claimId, paymentID, paymentStatus, chargeId);
            },

            setFeeFields: function (claimDetail, isInitial) {
                if (isInitial) {
                    $('#ddlAdjustmentCode_fast').val('');
                    $('#txtResponsibleNotes').val('');
                }   
                var order_info = claimDetail;
                $('#lblBalanceNew').text(order_info.balance ? parseFloat(order_info.balance).toFixed(2) : "0.00");
                $('#lblBillingFee, #spApplyTotalFee').text(order_info.billFee ? parseFloat(order_info.billFee).toFixed(2) : "0.00");
                $('#lblAdjustment, #spAdjustmentApplied').text(order_info.adjustment ? parseFloat(order_info.adjustment).toFixed(2) : "0.00");
                $('#spPaymentApplied').text(order_info.applied_payment ? parseFloat(order_info.applied_payment).toFixed(2) : "0.00");
                $('#txtResponsibleNotes').val(claimDetail.notes);
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
                            paymentDet.charge_id = payment.id ? payment.id : null;
                            paymentDet.payment_id = paymentId;
                            paymentDet.claimId = claimId;
                            paymentDet.cpt_code = payment.cpt_code;
                            paymentDet.cpt_description = payment.cpt_description;
                            paymentDet.payment_amount = payment.payment_amount ? parseFloat(payment.payment_amount) : 0.00;
                            paymentDet.adjustment = payment.adjustment_amount ? parseFloat(payment.adjustment_amount) : 0.00;
                            paymentDet.other_payment = payment.other_payment && !isNaN(payment.other_payment) ? parseFloat(payment.other_payment).toFixed(2) : 0.00;
                            paymentDet.other_adjustment = payment.other_adjustment && !isNaN(payment.other_adjustment) ? parseFloat(payment.other_adjustment).toFixed(2) : 0.00;
                            paymentDet.bill_fee = payment.bill_fee ? parseFloat(payment.bill_fee).toFixed(2) : 0.00
                            paymentDet.allowed_fee = 0.00;
                            paymentDet.payment_application_id = payment.payment_application_id;
                            paymentDet.payment_adjustment_id = payment.adjustment_id;
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

                            $('#btnSaveCAS').unbind().on('click', function (e) {
                                self.savePaymentsCAS(claimId, paymentId, paymentStatus, payment.payment_application_id);
                            });
                        });
                        commonjs.validateControls();
                        self.setFeeFields({}, true);

                        $('#ddlAdjustmentCode_fast').append($('<option/>', { value: '', text: 'Select' }));
                        $('#ddlResponsible').append($('<option/>', { value: '', text: 'Select' }));

                        $.each(adjustmentCodes, function (index, adjustmentCode) {
                            $('#ddlAdjustmentCode_fast').append($('<option/>', { value: adjustmentCode.id, text: adjustmentCode.description }));
                        });

                        $.each(payerTypes, function (index, payerType) {
                            if (payerType.patient_id)
                                $('#ddlResponsible').append($('<option/>', { value: payerType.patient_id, text: payerType.patient_name, 'data-payerType': 'patient' }));
                            
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

                        $("#ddlAdjustmentCode_fast").val(charges.length ? charges[0].adjustment_code_id : '');

                        $('#tBodyApplyPendingPayment').find('.applyCAS').on('click', function (e) {
                            var selectedRow = $(e.target || e.srcElement).closest('tr');
                            var chargeId = selectedRow.attr('data_charge_id_id');
                            self.getPayemntApplications(e);
                        });

                        $('#applyPaymentContent').find('#btnSaveAppliedPendingPayments').unbind().on('click', function (e) {
                            self.saveAllPayments(e, claimId, paymentId, paymentStatus, chargeId);
                        });

                        $('#btnClearAppliedPendingPayments').unbind().on('click', function (e) {
                            self.clearPayments(e, paymentId, claimId);
                        });
                        
                        $('#btnPayfullAppliedPendingPayments').unbind().on('click', function (e) {
                            self.underConstruction();
                        });

                        var bilFeeCols = $("#tBodyApplyPendingPayment tr td:nth-child(3) span");//.text().trim();
                        var billFee = 0;
                        $.each(bilFeeCols, function (index, col) {
                            billFee += parseFloat($(this).text().trim())
                        }); 
                        
                        var adjustmentCols = $("#tBodyApplyPendingPayment tr td:nth-child(8) input");//.text().trim();
                        var adjustment = 0;
                        $.each(adjustmentCols, function (index, col) {
                            adjustment += parseFloat($(this).val().trim())
                        });                    
                        
                        var balanceCols = $("#tBodyApplyPendingPayment tr td:nth-child(9) span");//.text().trim();
                        var balance = 0;
                        $.each(balanceCols, function (index, col) {
                            balance += parseFloat($(this).text().trim())
                        });
                        
                        self.setFeeFields({ billFee: billFee, adjustment: adjustment, balance: balance, notes: payerTypes[0].billing_notes, adjustment_code_id: charges[0].adjustment_code_id});

                        console.log({ billFee: billFee, adjustment: adjustment, balance: balance });
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
                var charge_id = $('#divPaymentCAS').attr('data-charge_id');
                var cas = self.vaidateCasCodeAndReason(payment_application_id, paymentStatus);
                self.casSegmentsSelected = cas ;
                self.closePaymentsCAS();
                self.closePaymentsCAS();
            },

            vaidateCasCodeAndReason: function (payment_application_id, paymentStatus) {
                var self = this;
                var hasReturned = false;
                var casObj = [];
                var emptyCasObj = {};
                for (var k = 1; k <= 7; k++) {
                    var emptyCasObj = {};
                    var groupCode = $('#selectGroupCode' + k).val()
                    var reasonCode = $('#selectReason' + k).val()
                    var amount = $('#txtAmount' + k).val()
                    if(paymentStatus === 'applied'){
                        var cas_id= $('#selectGroupCode' + k).attr('cas_id');
                    }

                    if (groupCode != '' && reasonCode != '' && amount != '') {
                        emptyCasObj['group_code_id'] = groupCode;
                        emptyCasObj['reason_code_id'] = reasonCode;
                        emptyCasObj['amount'] = amount;
                        if(paymentStatus === 'applied')
                            { emptyCasObj['cas_id'] = cas_id;}
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
                var paymentApplicationId = chargeItem.attr('data_payment_adjustment_id');
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
                                $('#selectGroupCode' + rowVal).val(appln.cas_group_code_id).attr('cas_id', appln.id);
                                $('#selectReason' + rowVal).val(appln.cas_reason_code_id);
                                $('#txtAmount' + rowVal).val(appln.amount.substr(1));
                            });

                            $('#divPaymentCAS').attr('data-charge_id', chargeId).show();
                            commonjs.validateControls();
                        },
                        error: function (err, response) {
                            commonjs.handleXhrError(err, response);
                        }
                    });
                }
                else {
                    $.each([], function (index, appln) {
                        var rowVal = index + 1;
                        $('#selectGroupCode' + rowVal).val('');
                        $('#selectReason' + rowVal).val('');
                        $('#txtAmount' + rowVal).val('');
                    });
                    $('#divPaymentCAS').attr('data-charge_id', chargeId).show();
                    commonjs.validateControls();
                }
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
                    // $('#ddlAdjustmentCode_fast').select2('open')
                    return false;
                }
                else return true;
            },

            saveAllPayments: function (e, claimId, paymentId, paymentStatus, chargeId) {
                var self = this;
                if (this.validatePayerDetails()) {
                    var lineItems = $("#tBodyApplyPendingPayment tr"), dataLineItems = [], orderPayment = 0.00, orderAdjustment = 0.00;
                    var line_items = [];     

                    var cas = self.casSegmentsSelected;
                    
                    $.each(lineItems, function (index) {
                        var _line_item = {};
                        _line_item["charge_id"] = $(this).attr('data_charge_id_id');
                        _line_item["paymentApplicationId"] = $(this).attr('data_payment_application_id');
                        _line_item["adjustmentApplicationId"] = $(this).attr('data_payment_adjustment_id');
                        _line_item["payment"] = $(this).find('td:nth-child(5)>input').val() ? parseFloat($(this).find('td:nth-child(5)>input').val()) : 0.00;
                        _line_item["adjustment"] = $(this).find('td:nth-child(8)>input').val() ? parseFloat($(this).find('td:nth-child(8)>input').val()) : 0.00;
                        _line_item["cas_details"] = cas;
                        line_items.push(_line_item);
                    });

                    var payerType = $('#ddlResponsible').find(':selected').attr('data-payerType');
                    var adjustmentType = $('#ddlAdjustmentCode_fast').val() || null;
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
                            paymentStatus: paymentStatus
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
            },

            applySearch: _.debounce(function (e) {
                var $divPatientSearchResults = $('#divPatientSearchResults');
                var isNotEmpty = false;
                var canSearch = true;
                $('#searchPatient').find('.search-field').each(function () {
                    if ($(this).val()) {
                        isNotEmpty = true;
                        return false;
                    }
                });

                if (isNotEmpty) {
                    var dobVal = $('#dob').val();

                    if (dobVal) {
                        canSearch = moment(dobVal).isValid();
                    }

                    if (canSearch) {
                        $divPatientSearchResults.html('<span style="text-align:center;display:block;font-size:20px;">Searching...</span>');
                        commonjs.showLoading('Searching...');
                        this.patientsPager.set({ "pageNo": 1 });
                        this.patientsPager.set({ "searchId": 0 });
                        this.patientsPager.set({ "symbol": '>' });
                        this.patientsPager.set({ "sortOrder": 'ASC' });
                        var user_options = commonjs.getCookieOptions(1);

                        if ($('#chk_isActiveNeeded').is(':checked')) {
                            user_options = 'yes';
                        } else {
                            user_options = 'no';
                        }
                        commonjs.setCookieOptions(1, user_options);
                        this.patientsPager.set('pageNo', 1);
                        this.reqId = Date.now();
                        this.bindGrid(true);
                    }
                }
                else {
                    $divPatientSearchResults.empty();
                    $('#divPatientPaging').hide();
                    $('#divEmptySearch').hide();
                    $('#divNoPatients').hide();
                    $("#ulChangeMenu").hide();
                }
            }, 500),

            bindGrid: function (isTotalRecordNeeded) {
                $('#divPatientPaging').hide();
                var self = this;
                var pagesize = this.patientsPager.get('pageSize');
                var user_info = commonjs.hstoreParse(app.userInfo.user_settings);

                this.patientListcoll = new patientCollection();
                this.patientListcoll.fetch({
                    data: {
                        fromPTSL: true,
                        combined: true,
                        pageNo: this.patientsPager.get('pageNo'),
                        pageSize: pagesize,
                        facility_id: $('#ddlFacilitySearch').val(),
                        fields: this.getSearchFields(),
                        showInactive: $('#chk_isActiveNeeded').prop('checked'),
                        type: $('#ddlSearchType').val(),
                        showOwner: $('#chk_PatOwner').prop('checked'),
                        sortField: (commonjs.checkNotEmpty(this.patientsPager.get("sortField"))) ? this.patientsPager.get("sortField") : 'patients.last_name',
                        company_id: app.companyID
                    },
                    processData: true,
                    success: function (model, response) {
                        if (response){
                            self.renderGrid(response, isTotalRecordNeeded);
                        }
                    },
                    error: function (model, response) {
                        commonjs.handleXhrError(model, response);
                    }
                });
            },

            getSearchFields: function () {
                var obj = {};
                $('#searchPatient').find('.search-field').each(function () {
                    var el = $(this);
                    var val = $.trim(el.val());
                    if (val) {
                        obj[el.attr('id')] = val;
                    }
                });

                return obj;
            },

            renderGrid: function (patients, isTotalRecordNeeded) {
                var self = this;

                if (!isTotalRecordNeeded) {
                    this.patientsPager.set({ "patientTotalRecords": this.patientTotalRecords });
                    this.patientsPager.set({"LastPageNo": Math.ceil(this.patientTotalRecords / this.patientsPager.get('pageSize')) });
                    this.setPaging();
                    commonjs.hideLoading();
                } else {
                    var pagesize = this.patientsPager.get('pageSize');
                    var user_info = commonjs.hstoreParse(app.userInfo.user_settings);
                    jQuery.ajax({
                        url: "/exa_modules/billing/pending_payments/patient_count",
                        type: "GET",
                        data: {
                            fromPTSL: true,
                            combined: true,
                            pageNo: this.patientsPager.get('pageNo'),
                            pageSize: pagesize,
                            facility_id: $('#ddlFacilitySearch').val() ? $('#ddlFacilitySearch').val() : "",
                            flag: self.currentElementID,
                            fields: this.getSearchFields(),
                            showInactive: $('#chk_isActiveNeeded').prop('checked') ? $('#chk_isActiveNeeded').prop('checked') : false,
                            showOwner: $('#chk_PatOwner').prop('checked') ? $('#chk_PatOwner').prop('checked') : false,
                            type: $('#ddlSearchType').val(),
                            sortField: (commonjs.checkNotEmpty(this.patientsPager.get("sortField"))) ? this.patientsPager.get("sortField") : 'patients.id',
                            company_id: app.companyID
                        },
                        success: function (data, textStatus, jqXHR) {
                            if (data) {
                                self.patientTotalRecords = (data && data.length > 0) ? data[0].total_records : 0;
                                self.lastId = (data && data.length > 0) ? data[0].lastid : 0;
                                self.patientsPager.set({ "lastPageNo": Math.ceil(self.patientTotalRecords / self.patientsPager.get('pageSize')) });
                                self.setPaging();
                            }
                            commonjs.hideLoading();
                        },
                        error: function (err) {
                            commonjs.handleXhrError(err);
                        }
                    });
                }

                var content = '';

                for (var j = 0; j < patients.length; j++) {
                    var patientList = patients[j];
                    patientList.birth_date = commonjs.getDateFormat(patientList.birth_date);
                    var patient_info = commonjs.hstoreParse(patientList.patient_info);
                    var owner_info = commonjs.hstoreParse(patientList.owner_info);
                    patientList.phone = (patient_info.c1HomePhone) ? patient_info.c1HomePhone : '';
                    patientList.address1 = (patient_info.c1AddressLine1) ? patient_info.c1AddressLine1 : '';
                    patientList.address2 = (patient_info.c1AddressLine2) ? patient_info.c1AddressLine2 : '';
                    patientList.zip = (patient_info.c1Zip) ? patient_info.c1Zip : '';
                    patientList.city = (patient_info.c1City) ? patient_info.c1City : '';
                    patientList.state = (patient_info.c1State) ? patient_info.c1State : '';
                    patientList.home = (patient_info.c1HomePhone) ? patient_info.c1HomePhone : '';
                    patientList.work = (patient_info.c1WorkPhone) ? patient_info.c1WorkPhone : '';
                    patientList.mobile = (patient_info.c1MobilePhone) ? patient_info.c1MobilePhone : '';
                    patientList.owner_address1 = (owner_info.owner_address1) ? owner_info.owner_address1 : '';
                    patientList.owner_address2 = (owner_info.owner_address2) ? owner_info.owner_address2 : '';
                    patientList.owner_city = (owner_info.owner_city) ? owner_info.owner_city : '';
                    patientList.owner_state = (owner_info.owner_state) ? owner_info.owner_state : '';
                    patientList.owner_zip = (owner_info.owner_zip) ? owner_info.owner_zip : '';
                    patientList.owner_id = patientList.owner_id > 0 ? parseInt(patientList.owner_id) : 0;
                    patientList.showOwner = $('#chk_PatOwner').prop('checked');
                    content += this.patSearchContentTemplate({ patient: patientList });
                }
                var $results = $('#divPatientSearchResults');
                $results.html(content).show();

                $('.inactiveSpanClick').dblclick(function () {
                    return false;
                });

                var currentSearchValue = '';

                // build up 'error' text based on the user's search query
                $('#searchPatient').find('.search-field').each(function () {
                    var el = $(this);
                    if (el.val()) {
                        if (currentSearchValue) {
                            currentSearchValue += ', '
                        }
                        currentSearchValue += el.attr('placeholder') + ': ' + $.trim(el.val());
                    }
                });

                if (patients.length < 1) {
                    $('#divEmptySearch').hide();
                    $('#ulChangeMenu').hide();
                    $('#divPatientPaging').hide();
                    $('#em_SearchValue').text($.trim(currentSearchValue));
                    $('#divNoPatients').show();
                }
                else {
                    $('#divPatientPaging').show();
                    $('#ulChangeMenu').show();
                    $('#divNoPatients').hide();
                    $('#divEmptySearch').hide();
                    $results.show();
                }
            },

            setPaging: function () {
                if (parseInt(this.patientsPager.get('pageNo')) == 1) {
                    this.patientsPager.set({ "previousPageNo": 1 });
                }
                else {
                    this.patientsPager.set({ "previousPageNo": (parseInt(this.patientsPager.get('pageNo'))) - 1 });
                }

                if (parseInt(this.patientsPager.get('pageNo')) >= this.patientsPager.get('lastPageNo')) {
                    this.patientsPager.set({ "nextPageNo": this.patientsPager.get('lastPageNo') });
                }
                else {
                    this.patientsPager.set({ "nextPageNo": (parseInt(this.patientsPager.get('pageNo'))) + 1 });
                }

                if (this.patientsPager.get('pageNo') == 1) {
                    $('#li_first').addClass('disabled').attr('disabled', 'disabled');
                    $('#li_previous').addClass('disabled').attr('disabled', 'disabled');
                }
                else {
                    $('#li_first').removeClass('disabled').removeAttr('disabled');
                    $('#li_previous').removeClass('disabled').removeAttr('disabled');
                }

                if (this.patientsPager.get('pageNo') == this.patientsPager.get('lastPageNo')) {
                    $('#li_next').addClass('disabled').attr('disabled', 'disabled');
                    $('#li_last').addClass('disabled').attr('disabled', 'disabled');
                }
                else {
                    $('#li_next').removeClass('disabled').removeAttr('disabled');
                    $('#li_last').removeClass('disabled').removeAttr('disabled');
                }

                $('#spnPatientTotalRecords').html(this.patientTotalRecords);
                $('#spnPatientCurrentPage').html(this.patientsPager.get('pageNo'));
                $('#spnPatientTotalPage').html(this.patientsPager.get('lastPageNo'));
            },

            onpaging: function (e) {
                var self = this;
                var id = ((e.target || e.srcElement).tagName == 'I') ? (e.target || e.srcElement).parentElement.id : (e.target || e.srcElement).id;
                if ($('#' + id).closest("li").attr('disabled') != 'disabled') {
                    switch (id) {
                        case "anc_first":
                            self.patientsPager.set({ "pageNo": 1 });
                            break;
                        case "anc_previous":
                            if ((self.patientsPager.get("pageNo") - 1) == 1) {
                                self.patientsPager.set({ "pageNo": 1 });
                            }
                            else {
                                self.patientsPager.set({ "pageNo": self.patientsPager.get('previousPageNo') });
                            }
                            break;

                        case "anc_next":
                            if ((self.patientsPager.get("pageNo") + 1) == self.patientsPager.get('lastPageNo')) {
                                self.patientsPager.set({ "pageNo": self.patientsPager.get('lastPageNo') });
                            }
                            else {
                                self.patientsPager.set({ "pageNo": self.patientsPager.get('nextPageNo') });
                            }

                            break;
                        case "anc_last":
                            self.patientsPager.set({ "pageNo": self.patientsPager.get('lastPageNo') });
                            break;
                    }
                    self.bindGrid(false);
                }
            },

            selectPatient: function (e) {                
                var tagName = commonjs.getElementFromEventTarget(e).tagName;
                var self = this;
                var patientId = (tagName == 'P') ? (e.target || e.srcElement).parentElement.id.split('_')[2] : (e.target || e.srcElement).id.split('_')[2];
                var patient_name = $(e.target || e.srcElement).closest('.selectionpatient').data('name');
                var account_no = $(e.target || e.srcElement).closest('.selectionpatient').data('value');
                var dicom_patient_id = $(e.target || e.srcElement).closest('.selectionpatient').data('dicom_patient_id');

                this.patientId = patientId;
                this.invoice_no_to_search = '';
                this.showPatientForm(patientId);
            },

            showPatientForm: function (patientId) {  
                var self = this;
                self.pendPaymentTable.options.customargs = {
                    gridFlag: 'pendingPayments',
                    paymentID: self.payment_id,
                    payerId: self.payer_id,
                    payerType: self.payer_type,
                    patientId: patientId,
                    invoice_no_to_search: ''
                }
                self.pendPaymentTable.refreshAll();
                // this.showPendingPaymentsGrid(this.payment_id, this.payer_type, this.payer_id, patientId);  
            },

            showPatientOrders: function (e) {
                var self = this;
                let target = $(e.target || e.srcElement);
                if ($('#claimId').val()) {
                    self.patientId = 0;
                    self.invoice_no_to_search = $('#claimId').val();
                    // self.showPendingPaymentsGrid(this.payment_id, this.payer_type, this.payer_id, 0, self.invoice_no_to_search);
                    self.pendPaymentTable.options.customargs = {
                        gridFlag: 'pendingPayments',
                        paymentID: self.payment_id,
                        payerId: self.payer_id,
                        payerType: self.payer_type,
                        patientId: 0,
                        invoice_no_to_search: self.invoice_no_to_search
                    }
                    self.pendPaymentTable.refreshAll();
                }
                else
                    commonjs.showWarning('Please enter invoice number');
            },

            backToPatient: function (e) {
                $('#btnBackToPatient').hide();
                $('#diVPatient').show();
                $('#divPendingRecords').hide();                              
            },

            underConstruction: function () {
                alert('Under construction');
            }

        });
    });