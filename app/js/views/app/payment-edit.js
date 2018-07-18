define(['jquery',
    'immutable',
    'underscore',
    'backbone',
    'jqgrid',
    'jqgridlocale',
    'text!templates/app/payment-edit.html',
    'models/app/payment',
    'models/pager',
    'text!templates/app/payments-payer.html',
    'collections/app/pending-payments',
    'collections/app/applied-payments',
    'text!templates/app/payment-apply-cas.html',
    'text!templates/app/apply-payment.html',
    'collections/app/patientsearch',
    'text!templates/app/patientSearchResult.html',
    'views/reports/payments-pdf',
    'views/claims/claim-inquiry',
    'shared/permissions'],

    function (
        jQuery,
        Immutable,
        _,
        Backbone,
        JGrid,
        JGridLocale,
        editPayment,
        ModelPayments,
        ModelPaymentsPager,
        paymentsGridHtml,
        pendingPayments,
        appliedPayments,
        ApplyCasHtml,
        ApplyPaymentTemplate,
        patientCollection,
        patSearchContent,
        paymentEditPDF,
        claimInquiryView,
        Permission) {
        return Backbone.View.extend({
            el: null,
            pager: null,
            patientsPager: null,
            patientTotalRecords: 0,
            model: null,
            pendPager: null,
            pendPaymtPager: null,
            pendPaymtInvoicePager: null,
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
            canDeletePayment: true,
            pendingGridLoaderd: false,
            isRefundApplied:false,

            events: {
                'click #btnPaymentSave': 'savePayment',
                'click #btnApplyCAS': 'getPayemntApplications',
                'change #selectPayerType': 'setPayerFields',
                'change .inputType': 'setInputTypeFields',
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
                "click #anc_search, #anc_search_claim": "showPatientOrders",
                'click #btnPaymentPendingRefresh': 'refreshPayments',
                'click #btnAppliedPayRefresh': 'refreshPayments',
                "change #selectPaymentMode": "changePayerMode",
                'click #btnPaymentDelete': 'deletePayment',
                'click #btnPaymentPrint': 'paymentPrintPDF',
                'click #btnPrintReceipt': 'paymentPrintReceiptPDF',
                'click #btnPaymentPendingRefreshOnly': 'refreshInvociePendingPayment',
                'click #btnPaymentApplyAll': 'checkAllPendingPayments',
                'keypress #claimId, #invoiceNo': 'searchInvoiceOrClaim'
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
                var facilities = (app.userInfo.user_type == "SU") ? app.facilities : app.userFacilities;
                var adjustment_codes = jQuery.grep(app.adjustmentCodes, function (obj, i) {
                    return (obj.type == "ADJCDE" || obj.type == "REFADJ");
                });
                var claim_status = jQuery.grep(app.adjustmentCodes, function (obj, i) {
                    return (obj.type == "CLMSTS");
                });
                this.facilityList = new modelCollection(commonjs.bindArray([app.facilities], false, true, true));
                this.adjustmentCodeList = new modelCollection(adjustment_codes);
                this.claimStatusList = new modelCollection(claim_status);
                this.paymentReasons = new modelCollection(app.payment_reasons);
                this.model = new ModelPayments();
                this.pager = new ModelPaymentsPager();
                this.pendPager = new ModelPaymentsPager();
                this.pendPaymtPager = new ModelPaymentsPager();
                this.pendPaymtInvoicePager = new ModelPaymentsPager();
                this.appliedPager = new ModelPaymentsPager();
                this.patientPager = new ModelPaymentsPager();
                this.pendingPayments = new pendingPayments();
                this.pendingPaymentsInvoice = new pendingPayments();
                this.appliedPayments = new appliedPayments();
                this.patientsPager = new ModelPaymentsPager();
                this.patientListcoll = new patientCollection();
                if(app.userInfo.user_type != 'SU'){
                    var rights = (new Permission()).init();
                    this.screenCode = rights.screenCode;
                }
                else {
                    this.screenCode = [];
                }

                commonjs.initHotkeys({
                    NEW_PAYMENT: '#btnPaymentAddNew'
                });
            },

            returnDoubleDigits: function (str) {
                str = str.toString();
                return str.length === 1 ? '0' + str : str;
            },

            render: function (paymentId) {
                var self = this;
                self.payment_id = 0;
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
                this.pendingGridLoaderd = false;
                self.showBillingForm(paymentId);
                self.showPaymentsGrid(paymentId);
                commonjs.processPostRender();
                commonjs.validateControls();
                if(self.screenCode.indexOf('APAY') > -1) {// for screen rights
                    $('#divPendingPay').addClass('maskPendingPay');
                    $('#btnPaymentApplyAll').attr('disabled', true);
                }
                if(self.screenCode.indexOf('DPAY') > -1)
                    $('#btnPaymentDelete').attr('disabled', true)
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
                self.bindNewDTP();
                self.clearPayemntForm();
                self.setAcs();
                if (paymentID == 0) {
                    this.model = new ModelPayments();
                    $('#btnPaymentClear').show();
                    $('#btnPaymentDelete').hide();
                    $('#divPendingPay').hide();
                    $('#btnPaymentAddNew').hide();
                    $('#btnPaymentPrint').hide();
                    $('#btnPrintReceipt').hide();
                    $('#btnPaymentRefClick').hide();
                    $('#selectPayerType').focus();
                    commonjs.hideLoading();
                }
                else {
                    this.model.set({ id: paymentID });
                    $('#btnPaymentClear').hide();
                    $('#btnPaymentDelete').show();
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
                $('#ddlpaymentReason').val('');
                $('#ddlPaidLocation').val(app.facilityID || 0);
                $('#selectPayerType').val(0);
                $('#selectPaymentMode').val(0);
                $('#PaymentForm input[type=text]').val('');
                $('.payerFields').hide();
                $('#txtInvoice').hide();
                $('#txtNotes').val('');
                this.changePayerMode('');
                $('#select2-txtautoPayerPIP-container').html('Select Insurance');
                $('#select2-txtautoPayerPP-container').html('Select Patient');
                $('#select2-txtautoPayerPOF-container').html('Select Ordering facility');
                $('#select2-txtautoPayerPR-container').html('Select Provider');
                if (this.dtpAccountingDate)
                    this.dtpAccountingDate.date(commonjs.getCompanyCurrentDateTime());
            },

            setAcs: function () {
                this.setInsuranceAutoComplete();
                this.setPatientAutoComplete();
                this.setOFAutoComplete();
                this.setProviderAutoComplete();
            },

            setInputTypeFields: function () {
                var selectedIp = $('input[name=ipType]:checked').val();
                if (selectedIp === 'inpInvoice') {
                    $('#txtInvoice').show();
                }
                else {
                    $('#txtInvoice').hide();
                    $('#btnPaymentApplyAll').hide();
                }
            },

            setPayerFields: function (e, obj) {
                this.payer_id = 0;
                var val = $('#selectPayerType').val();
                $('.payerFields').hide();
                $('#divInputType span').show();
                if (val === 'insurance') {
                    $('#select2-txtautoPayerPIP-container').html('Select Insurance');
                    $('#divPayerInsurnace').show();
                    $('#lblIpEob').show();
                    $('#divPayerInsurnace').show();
                }
                else if (val === 'patient') {
                    $('#select2-txtautoPayerPP-container').html('Select Patient');
                    $('#divPayerPatient').show();
                    $('#lblIpEob').hide();
                    $('#divInputType span').hide();
                    $('#txtInvoice').hide();
                }
                else if (val === 'ordering_facility') {
                    $('#select2-txtautoPayerPOF-container').html('Select Ordering facility');
                    $('#divPayerOrderFacility').show();
                    $('#lblIpEob').hide();
                }
                else if (val === 'ordering_provider') {
                    $('#select2-txtautoPayerPR-container').html('Select Provider');
                    $('#divPayerProvider').show();
                    $('#lblIpEob').hide();
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
                                    more: data && data.length ? (params.page * 30) < data[0].total_records : 0
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
                                    more: data && data.length ? (params.page * 30) < data[0].total_records : 0
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
                                    more: data && data.length ? (params.page * 30) < data[0].total_records : 0
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
                                    more: data && data.length ? (params.page * 30) < data[0].total_records : 0
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
                return { _addressInfo: addressInfo, _cityStateZip: cityStateZip }
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
                $('#ddlPaidLocation').val(response.facility_id || app.facilityID);
                self.setPayerName(response.payer_type, response)
                $("input:radio[name=billingMethod][value=" + response.billing_method + "]").prop("checked", true);

                $('#txtInvoice').val(response.invoice_no).show();
                if (response.invoice_no) {
                    $('#txtInvoice').val(response.invoice_no).show();
                    $('#chkIpInvoice').prop('checked', true);//.change();
                    $('#invoiceNo').val(response.invoice_no);
                    $('#anc_search').click();
                    $('#btnPaymentApplyAll').show();
                }
                else if (response.payer_type === "patient" && response.patient_id) {
                    $('#btnPaymentApplyAll').show();
                    $('#txtInvoice').hide();
                    $('#commonMsg').text('Pending payments for the patient : ');
                    var e = $.Event('keyup');
                    $('#mrn').val(response.account_no).focus().trigger(e);
                    $('#spnPatInfo').text(response.patient_name + ' (' + response.account_no + ') ');
                    this.showPendingPaymentsGrid(this.payment_id, response.payer_type, response.patient_id, response.patient_id);    
                }

                if (response.payer_type === "patient")
                    self.payer_id = response.patient_id;
                else if (response.payer_type === "ordering_facility")
                    self.payer_id = response.provider_group_id;
                else if (response.payer_type === "insurance")
                    self.payer_id = response.insurance_provider_id;
                else if (response.payer_type === "ordering_provider")
                    self.payer_id = response.provider_contact_id;

                $('#liPendingPaymentsPat a').click();
                // self.showPendingPaymentsGridInvoice(paymentID, response.payer_type, self.payer_id);
                $('#txtAmount').val(response.amount.substr(1));
                $('#lblApplied').html(response.applied.substr(1));
                $('#lblBalance').html(response.available_balance);
                $("#txtCheque").val(response.card_number);
                $("#txtCardName").val(response.card_name);
                $("#ddlpaymentReason").val(response.payment_reason_id)
                $("#txtNotes").val(response.notes)
                $('#selectPaymentMode').val(response.payment_mode);
                self.changePayerMode(response.payment_mode, true);

                commonjs.checkNotEmpty(response.accounting_date) ? self.dtpAccountingDate.date(response.accounting_date) : self.dtpAccountingDate.clear();

                self.payer_type = response.payer_type;
                self.payment_id = paymentID;
                self.patient_id = response.patient_id;
                // self.payer_id = response.patient_id || response.provider_contact_id || response.provider_group_id || response.insurance_provider_id;
                self.provider_id = response.provider_contact_id;
                self.provider_group_id = response.provider_group_id;
                self.insurance_provider_id = response.insurance_provider_id;

                // self.showAppliedByPaymentsGrid(paymentID, response.payer_type, self.payer_id);
                if (!self.casCodesLoaded)
                    self.setCasGroupCodesAndReasonCodes();
                self.payment_row_version = response.payment_row_version;
                $('#claimsTabs a').on('click', function (e) {
                    self.loadSelectedGrid(e, paymentID, response.payer_type, self.payer_id); 
                });

                $('#selectPayerType').focus();
            },

            setPayerName: function (payerType, payerNames) {
                $('#selectPayerType').val(payerType);
                this.setPayerFields();

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
                    url: '/exa_modules/billing/pending_payments/groupcodes_and_reasoncodes',
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
                    $('#txtautoPayerPIP').select2('open');
                    return false;
                }
                else if (payermode == 'patient' && !self.payer_id) {
                    commonjs.showWarning("Please select patient");
                    $('#txtautoPayerPP').select2('open');
                    return false;
                }
                else if (payermode == 'ordering_provider' && !self.payer_id) {
                    commonjs.showWarning("Please select provider");
                    $('#txtautoPayerPR').select2('open');
                    return false;
                }
                else if (payermode == 'ordering_facility' && !self.payer_id) {
                    commonjs.showWarning("Please select ordering facility");
                    $('#txtautoPayerPOF').select2('open');
                    return false;
                }
                else
                    return true;
            },

            validatepayments: function () {
                var self = this;
                var amount = $.trim($("#txtAmount").val());
                if ($('#selectPayerType').val() === '0') {
                    commonjs.showWarning("Please select payer type");
                    $('#selectPayerType').focus();
                    return false;
                }
                if (!self.validatePayer($('#selectPayerType').val())) {
                    return false;
                }
                if ($.trim($("#txtAccountingDate").val()) == "") {
                    commonjs.showWarning("Please select accounting date");
                    return false;
                }
                if (amount == "") {
                    commonjs.showWarning("Please enter amount");
                    $("#txtAmount").focus();
                    return false;
                }
                if (amount == "" || (amount.indexOf('-') > 0)) {
                    commonjs.showWarning("Please enter valid amount");
                    $('#txtAmount').focus();
                    return false;
                }
                if ($('#selectPaymentMode').val() === '0') {
                    commonjs.showWarning("Please select payment mode");
                    $('#selectPaymentMode').focus();
                    return false;
                }
                if ($('#selectPaymentMode').val() === 'card' && $.trim($("#txtCheque").val()) == "") {
                    commonjs.showWarning('Please enter card#');
                    $('#txtCheque').focus();
                    return false;
                }
                if ($('#selectPaymentMode').val() === 'card' && $.trim($("#txtCardName").val()) == "") {
                    commonjs.showWarning('Please enter card name');
                    $('#txtCardName').focus();
                    return false;
                }
                if ($('#selectPaymentMode').val() === 'check' && $.trim($("#txtCheque").val()) == "") {
                    commonjs.showWarning('Please enter cheque#');
                    $('#txtCheque').focus();
                    return false;
                }
                return true;
            },

            refreshPayments: function (e) {
                var target = $(e.target || e.srcElement);
                if (target.is('#btnPaymentPendingRefresh')) {
                    this.pendPaymentTable.refreshAll();
                }
                else {
                    this.appliedPaymentTable.refreshAll();
                }
            },
            
            refreshInvociePendingPayment: function (e) {
                this.invoicePendPaymentTable.refreshAll();
            },

            savePayment: function () {
                var self = this;
                if (self.validatepayments()) {
                    $('#btnPaymentSave').attr('disabled', true);
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
                        payer_type: $('#selectPayerType').val(),
                        amount: $.trim($('#txtAmount').val().replace(',', '')) || 0.00,
                        invoice_no: $('#txtInvoice').is(':visible') ? $('#txtInvoice').val() : null,
                        accounting_date: self.dtpAccountingDate && self.dtpAccountingDate.date() ? self.dtpAccountingDate.date().format('YYYY-MM-DD') : null,
                        patient_id: self.patient_id,
                        provider_contact_id: self.provider_id,
                        provider_group_id: self.provider_group_id,
                        insurance_provider_id: self.insurance_provider_id,
                        credit_card_number: $("#txtCheque").val() || null,
                        credit_card_name: $("#txtCardName").val() || null,
                        payment_mode: $('#selectPaymentMode').val(),
                        payment_reason_id: $("#ddlpaymentReason").val() || null,
                        user_id: app.userID,
                        notes: ($("#txtNotes").val()).replace(/(\r\n|\n|\r)/gm, "") || null,
                        payment_row_version: self.payment_row_version
                    });
                    this.model.save({
                    }, {
                            success: function (model, response) {
                                self.gridFirstLoaded = false;
                                self.pendingGridLoaderd = false;
                                self.tabClicked = '';
                                if (self.payment_id) {
                                    if (response && response.length) {
                                        commonjs.showStatus('Payment has been updated successfully');
                                        self.render(self.payment_id);
                                    }
                                    else {
                                        commonjs.showWarning('This payment has been already updated by some other user - please refresh the page and try again.');
                                    }
                                    $('#btnPaymentSave').removeAttr('disabled');
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

            showPendingPaymentsGridInvoice: function (paymentID, payerType, payerId) {
                var self = this;
                this.invoicePendPaymentTable = new customGrid();
                this.invoicePendPaymentTable.render({
                    gridelementid: '#tblpendPaymentsGridOnly',
                    custompager: this.pendPaymtInvoicePager,
                    emptyMessage: 'No Record found',
                    colNames: ['', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
                    i18nNames: ['', '', '', '', '', 'billing.fileInsurance.claimNo', 'billing.fileInsurance.invoiceNo', 'billing.payments.patient','billing.fileInsurance.claimDt', 'billing.payments.billFee', 'billing.payments.balance', 'setup.userSettings.cptCodes', 'setup.userSettings.accountNo', '', ''],
                    colModel: [
                        {
                            name: 'edit', width: 20, sortable: false, search: false,
                            className: 'icon-ic-edit',
                            formatter: function (e, model, data) {
                                return "<i class='icon-ic-edit' title='Edit'></i>";
                            },
                            customAction: function (rowID, e) {
                                var gridData = $('#tblpendPaymentsGridOnly').jqGrid('getRowData', rowID);
                                self.order_payment_id = 0;
                                self.showApplyAndCas(rowID, paymentID, 'pending', gridData.charge_id, gridData);
                            }
                        },
                        {
                            name: 'claim_inquiry', width: 20, sortable: false, search: false,
                            className: 'icon-ic-raw-transctipt',
                            formatter: function () {
                                return "<i class='icon-ic-raw-transctipt' title='Claim Inquiry'></i>"
                            },
                            customAction: function (rowID, e) {
                                var gridData = $('#tblpendPaymentsGridOnly').jqGrid('getRowData', rowID);
                                self.showClaimInquiry(gridData.claim_id, '', true);
                            }
                        },
                        { name: 'id', index: 'id', key: true, searchFlag: 'int', hidden: true },
                        { name: 'order_id', hidden: true },
                        { name: 'charge_id', hidden: true },
                        { name: 'claim_id', width: 150 },
                        { name: 'invoice_no',  width: 150 },
                        { name: 'full_name', width: 250 },
                        { name: 'claim_date', width: 250, formatter: self.claimDateFormatter },
                        { name: 'billing_fee', width: 100 },
                        { name: 'balance', width: 100 },
                        { name: 'display_description', width: 300 },
                        { name: 'account_no',  width: 150 },
                        { name: 'patient_id', key: true, hidden: true },
                        { name: 'facility_id', key: true, hidden: true },
                    ],
                    customizeSort: true,
                    sortable: {
                        exclude: ',#jqgh_tblpendPaymentsGridOnly_edit'
                    },
                    pager: '#gridPager_pendPaymentsOnly',
                    sortname: "pp.full_name",
                    sortorder: "ASC",
                    caption: "Pending Payments",
                    datastore: self.pendingPaymentsInvoice,
                    container: this.el,
                    ondblClickRow: function (rowID) {
                        self.order_payment_id = 0;
                        var gridData = $('#tblpendPaymentsGridOnly').jqGrid('getRowData', rowID);
                        self.showApplyAndCas(rowID, paymentID, 'pending', gridData.charge_id, gridData);
                    },
                    disablesearch: false,
                    disablesort: false,
                    disablepaging: false,
                    showcaption: false,
                    disableadd: true,
                    disablereload: true,
                    customargs: {
                        gridFlag: 'pendingPayments',
                        paymentID: paymentID,
                        payerId: payerId,
                        payerType: payerType
                    },
                    onaftergridbind: function (model, gridObj) {
                        self.setMoneyMask();
                    }
                });

                setTimeout(function () {
                    $('#tblpendPaymentsGridOnly').jqGrid('setGridHeight', '300px');
                    $('#tblpendPaymentsGridOnly').jqGrid('setGridWidth', $(window).width() - 20);
                    commonjs.processPostRender();
                }, 500);
            },

            claimDateFormatter: function (cellvalue, options, rowObject) {
                var colValue;
                colValue = (commonjs.checkNotEmpty(rowObject.claim_date) ? commonjs.convertToFacilityTimeZone(rowObject.facility_id, rowObject.claim_date).format('L') : '');
                return colValue;
            },
 
            showPendingPaymentsGrid: function (paymentID, payerType, payerId, patientId, claimIdToSearch, invoiceNoToSearch) {
                var self = this;
                if (!self.pendingGridLoaderd) {
                    this.pendPaymentTable = new customGrid();
                    this.pendPaymentTable.render({
                        gridelementid: '#tblpendPaymentsGrid',
                        custompager: this.pendPaymtPager,
                        emptyMessage: 'No Record found',
                        colNames: ['', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
                        i18nNames: ['', '', '', '', '', 'billing.fileInsurance.claimNo', 'billing.fileInsurance.invoiceNo', 'billing.payments.patient', 'billing.fileInsurance.claimDt', 'billing.payments.billFee', 'billing.payments.balance', 'setup.userSettings.cptCodes', 'setup.userSettings.accountNo', '', ''],
                        colModel: [
                            {
                                name: 'edit', width: 20, sortable: false, search: false,
                                className: 'icon-ic-edit',
                                formatter: function (e, model, data) {
                                    return "<i class='icon-ic-edit' title='Edit'></i>";
                                },
                                customAction: function (rowID, e) {
                                    var gridData = $('#tblpendPaymentsGrid').jqGrid('getRowData', rowID);
                                    self.order_payment_id = 0;
                                    self.showApplyAndCas(rowID, paymentID || self.payment_id, 'pending', gridData.charge_id, gridData);
                                }
                            },
                            {
                                name: 'claim_inquiry', width: 20, sortable: false, search: false,
                                className: 'icon-ic-raw-transctipt',
                                formatter: function () {
                                    return "<i class='icon-ic-raw-transctipt' title='Claim Inquiry'></i>"
                                },
                                customAction: function (rowID, e) {
                                    var gridData = $('#tblpendPaymentsGrid').jqGrid('getRowData', rowID);
                                    self.showClaimInquiry(gridData.claim_id, '', true);
                                }
                            },
                            { name: 'id', index: 'id', key: true, hidden: true },
                            { name: 'order_id', hidden: true },
                            { name: 'charge_id', hidden: true },
                            { name: 'claim_id', width: 150 },
                            { name: 'invoice_no', width: 150 },
                            { name: 'full_name', width: 250 },
                            { name: 'claim_date',  width: 250, formatter: self.claimDateFormatter },
                            { name: 'billing_fee', width: 100 },
                            { name: 'balance', width: 100 },
                            { name: 'display_description', width: 300 },
                            { name: 'account_no', width: 150 },
                            { name: 'patient_id', key: true, hidden: true },
                            { name: 'facility_id', key: true, hidden: true }
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
                            self.showApplyAndCas(rowID, paymentID || self.payment_id, 'pending', gridData.charge_id, gridData);
                        },
                        disablesearch: false,
                        disablesort: false,
                        disablepaging: false,
                        showcaption: false,
                        disableadd: true,
                        disablereload: true,
                        customargs: {
                            gridFlag: 'pendingPayments',
                            paymentID: paymentID,
                            payerId: payerId,
                            payerType: payerType,
                            patientId: patientId,
                            claimIdToSearch: claimIdToSearch,
                            invoiceNoToSearch: invoiceNoToSearch
                        },

                        beforeRequest: function () {
                            self.setCustomArgs(paymentID, payerId, payerType, patientId, claimIdToSearch, invoiceNoToSearch);
                        },
                        onaftergridbind: function (model, gridObj) {
                            self.setMoneyMask();
                        }
                    });

                    setTimeout(function () {
                        $('#tblpendPaymentsGrid').jqGrid('setGridHeight', '300px');
                        $('#tblpendPaymentsGrid').jqGrid('setGridWidth', $(window).width() - 20);
                    }, 500);

                    self.pendingGridLoaderd = true;
                    commonjs.processPostRender();
                }
                else {
                    self.pendPaymentTable.options.customargs = {
                        gridFlag: 'pendingPayments',
                        paymentID: self.payment_id,
                        payerId: self.payer_id,
                        payerType: self.payer_type,
                        patientId: patientId,
                        claimIdToSearch: claimIdToSearch,
                        invoiceNoToSearch: invoiceNoToSearch
                    }
                    self.pendPaymentTable.refreshAll();
                }
                
                $('#btnBackToPatient').show();
                $('#divPendingRecords').show();
                $('#diVPatient').hide();
            },

            setCustomArgs: function (paymentID, payerId, payerType, patientId, claimIdToSearch, invoiceNoToSearch) {
                var self = this;
                self.pendPaymentTable.options.customargs = {
                    gridFlag: 'pendingPayments',
                    paymentID: paymentID,
                    payerId: payerId,
                    payerType: payerType,
                    patientId: patientId,
                    claimIdToSearch: claimIdToSearch,
                    invoiceNoToSearch: invoiceNoToSearch
                }
            },

            afterGridBind: function (dataset, e, pager) {
                var self = this;
                if (!self.gridFirstLoaded) {
                    self.gridFirstLoaded = true;
                    if (dataset && dataset.length) {
                        $('#liPendingPayments a').click();
                    }
                    else {
                        $('#liPendingPaymentsPat a').click();
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
                    colNames: ['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
                    i18nNames: ['', '', '', '', 'billing.fileInsurance.claimNo', 'billing.fileInsurance.invoiceNo', 'billing.payments.patient', 'billing.payments.billFee', 'billing.payments.patientPaid', 'billing.payments.payerPaid', 'billing.payments.adjustment', 'billing.payments.thisAdj', 'billing.payments.thisPayment', 'billing.payments.balance', 'billing.payments.cptCodes', 'patient_id', 'facility_id', ''],
                    colModel: [
                        {
                            name: 'edit', width: 20, sortable: false, search: false,
                            className: 'icon-ic-edit',
                            formatter: function (e, model, data) {
                                return "<i class='icon-ic-edit' title='Edit'></i>";
                            },
                            customAction: function (rowID, e) {
                                var gridData = $('#tblAppliedPaymentsGrid').jqGrid('getRowData', rowID);
                                self.showApplyAndCas( gridData.claim_id, paymentID, 'applied', gridData.charge_id, gridData);
                            }
                        },
                        {
                            name: 'claim_inquiry', width: 20, sortable: false, search: false,
                            className: 'icon-ic-raw-transctipt',
                            formatter: function () {
                                return "<i class='icon-ic-raw-transctipt' title='Claim Inquiry'></i>"
                            },
                            customAction: function (rowID, e) {
                                var gridData = $('#tblAppliedPaymentsGrid').jqGrid('getRowData', rowID);
                                self.showClaimInquiry(gridData.claim_id, '', true);
                            }
                        },
                        { name: 'claim_id', index: 'id', key: true, hidden: true },
                        { name: 'charge_id', hidden: true },
                        { name: 'claim_id',  width: 100 },
                        { name: 'invoice_no',  width: 100 },
                        { name: 'full_name', width: 200 },
                        { name: 'bill_fee', width: 100 },
                        { name: 'patient_paid', sortable: false, search: false, width: 100 },
                        { name: 'others_paid', sortable: false, search: false, width: 100 },
                        { name: 'adjustment', width: 100 },
                        { name: 'this_adjustment', width: 100 },
                        { name: 'payment', width: 100 },
                        { name: 'balance', width: 100 },
                        { name: 'display_description', width: 200 },
                        { name: 'patient_id', key: true, hidden: true },
                        { name: 'facility_id', key: true, hidden: true },
                        { name: 'payment_application_id', key: false, hidden: true }
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
                        self.showApplyAndCas( gridData.claim_id, paymentID, 'applied', gridData.charge_id, gridData);
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
                    },
                    onaftergridbind: function (model, gridObj) {
                        self.afterAppliedGridBind(model, gridObj, self);
                        self.setMoneyMask();
                    }
                });

                setTimeout(function () {
                    $('#tblAppliedPaymentsGrid').jqGrid('setGridHeight', '300px');
                    $('#tblAppliedPaymentsGrid').jqGrid('setGridWidth', $(window).width() - 20);
                    commonjs.processPostRender();
                }, 500);
            },

            closeAppliedPendingPayments: function (obj, paymentId) {
                var self = this;
                if ($('#divPendingPayments').is(':visible')) {
                    if (self.invoicePendPaymentTable) {
                        self.pendPaymtInvoicePager.set({ "PageNo": 1 });
                        self.invoicePendPaymentTable.refreshAll();
                    }
                    if (self.appliedPaymentTable) {
                        self.appliedPager.set({ "PageNo": 1 });
                        self.appliedPaymentTable.refreshAll();
                    }
                }
                else if ($('#divPendingPaymentsPat').is(':visible')) {
                    if (self.pendPaymentTable) {
                        self.pendPaymtPager.set({ "PageNo": 1 });
                        self.pendPaymentTable.refreshAll();
                    }
                    if (self.appliedPaymentTable) {
                        self.appliedPager.set({ "PageNo": 1 });
                        self.appliedPaymentTable.refreshAll();
                    };
                }
                else {
                    if (self.appliedPaymentTable) {
                        self.appliedPager.set({ "PageNo": 1 });
                        self.appliedPaymentTable.refreshAll();
                    };
                }    
                self.getAppliedBalance(paymentId);
            },

            showApplyAndCas: function (claimId, paymentID, paymentStatus, chargeId, rowData) {
                var self = this;
                var paymentApplicationId = rowData.payment_application_id;
                self.defalutCASArray = [0, 1, 2, 3, 4, 5, 6];
                self.casSegmentsSelected = [];
                var patient_paid = rowData.patient_paid ? rowData.patient_paid.substr(1) : '0.00';
                var others_paid = rowData.others_paid ? rowData.others_paid.substr(1) : '0.00';
                commonjs.showDialog({ header: 'Claim Charges', width: '85%', height: '72%', html: self.applyCasTemplate({ adjustmentCodes: self.adjustmentCodeList.toJSON(), 'claimStatusList': this.claimStatusList.toJSON(), cas_group_codes: self.cas_group_codes, cas_reason_codes: self.cas_reason_codes, patient_paid: patient_paid, others_paid: others_paid }) });

                $('#siteModal').removeAttr('tabindex');
                $('#divApplyPendingPayments').height($('#modal_div_container').height() - 340);
                $('#siteModal .close, #siteModal .btn-secondary').unbind().bind('click', function (e) {
                    self.closeAppliedPendingPayments(e, paymentID);
                    $('#siteModal').hide();
                })

                commonjs.processPostRender();
                commonjs.validateControls();

                $('#btnCloseAppliedPendingPayments,#btnCloseApplyPaymentPopup').unbind().bind('click', function (e) {
                    $('#divPaymentApply').remove();
                    $('#siteModal').hide();
                });
                self.getClaimBasedCharges(claimId, paymentID, paymentStatus, chargeId, paymentApplicationId, true);
            },

            setFeeFields: function (claimDetail, isInitial) {
                if (isInitial) {
                    $('#ddlAdjustmentCode_fast').val('');
                    $('#txtResponsibleNotes').val('');
                }
                var order_info = claimDetail;
                $('#lblBalanceNew').text(order_info.balance ? order_info.balance : "0.00");
                $('#lblBillingFee, #spApplyTotalFee').text(order_info.billFee ? order_info.billFee : "0.00");
                $('#lblAdjustment, #spAdjustmentApplied').text(order_info.adjustment ? order_info.adjustment : "0.00");
                $('#spPaymentApplied').text(order_info.payment ? order_info.payment : "0.00");
                $('#lblOthers').text(order_info.others_paid ? order_info.others_paid : "0.00");
                $('#lblPatient').text(order_info.patient_paid ? order_info.patient_paid : "0.00");
            },

            getClaimBasedCharges: function (claimId, paymentId, paymentStatus, chargeId, paymentApplicationId, isInitialBind) {
                var self = this;
                self.casSave = [];
                $.ajax({
                    url: '/exa_modules/billing/pending_payments/claim-charges',
                    type: 'GET',
                    data: {
                        claimId: claimId,
                        paymentId: paymentId,
                        paymentStatus: paymentStatus,
                        charge_id: chargeId,
                        paymentApplicationId: paymentApplicationId,
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
                            paymentDet.payment_amount = payment.payment_amount ? parseFloat(payment.payment_amount) : '0.00';
                            paymentDet.adjustment = payment.adjustment_amount ? parseFloat(payment.adjustment_amount) : '0.00';
                            paymentDet.other_payment = payment.other_payment && !isNaN(payment.other_payment) ? parseFloat(payment.other_payment).toFixed(2) : '0.00';
                            paymentDet.other_adjustment = payment.other_adjustment && !isNaN(payment.other_adjustment) ? parseFloat(payment.other_adjustment).toFixed(2) : '0.00';
                            paymentDet.bill_fee = payment.bill_fee ? parseFloat(payment.bill_fee).toFixed(2) : '0.00'
                            paymentDet.payment_application_id = payment.payment_application_id;
                            paymentDet.payment_applied_dt = payment.payment_applied_dt;
                            paymentDet.payment_adjustment_id = payment.adjustment_id;
                            paymentDet.other_payment = (parseFloat(paymentDet.other_payment) - parseFloat(paymentDet.payment_amount)).toFixed(2);
                            paymentDet.other_adjustment = (parseFloat(paymentDet.other_adjustment) - parseFloat(paymentDet.adjustment)).toFixed(2);
                            paymentDet.allowed_amount = '0.00';
                            var balance = parseFloat(paymentDet.bill_fee) - (parseFloat(paymentDet.other_payment) + parseFloat(paymentDet.other_adjustment) + parseFloat(paymentDet.adjustment) + parseFloat(paymentDet.payment_amount)).toFixed(2);
                            paymentDet.balance = parseFloat(balance).toFixed(2);

                            var applyPaymentRow = self.applyPaymentTemplate({ payment: paymentDet });

                            $('#tBodyApplyPendingPayment').append(applyPaymentRow);

                            $('.this_pay, .this_adjustment').unbind().blur(function (e) {
                                self.updatePaymentAdjustment();
                                self.updateRefundRecoupment();
                            });
                            
                            $('.this_allowed').unbind().blur(function (e) {
                                self.calculateAdjustment(e)
                                self.updatePaymentAdjustment();
                            });

                            $('.checkDebit').unbind().click(function (e) {
                                self.updateRefundRecoupment();
                                self.updatePaymentAdjustment();
                            });

                            $('#ddlAdjustmentCode_fast').unbind().change(function () {
                                self.updateRefundRecoupment();
                                self.updatePaymentAdjustment();
                            });

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
                            var $Option = $('<option/>', { value: adjustmentCode.id, text: adjustmentCode.description, 'data_code_type': adjustmentCode.type });
                            if (adjustmentCode.type === 'refund_debit') {
                                $Option.css({ background: 'gray' }).attr('title', 'Refund Adjustment').addClass('refund_debit');
                            }
                            else if (adjustmentCode.type === 'recoupment_debit') {
                                $Option.css({ background: 'lightgray' }).attr('title', 'Recoupment Adjustment').addClass('recoupment_debit');
                            }
                            $('#ddlAdjustmentCode_fast').append($Option); 
                        }); 

                        $.each(payerTypes, function (index, payerType) {
                            if (payerType.patient_id)
                                $('#ddlResponsible').append($('<option/>', { value: payerType.patient_id, text: payerType.patient_name + '(Patient)', 'data-payerType': 'patient' }));

                            if ((payerType.primary && payerType.primary != 'null') && payerType.primary_ins_provider_name != null)
                                $('#ddlResponsible').append($('<option/>', { value: payerType.primary, text: payerType.primary_ins_provider_name + '(' + payerType.primary_ins_provider_code + ')(Primary Insurance)', 'data-payerType': 'primary_insurance' }));

                            if ((payerType.secondary && payerType.secondary != 'null') && payerType.secondary_ins_provider_name != null)
                                $('#ddlResponsible').append($('<option/>', { value: payerType.secondary, text: payerType.secondary_ins_provider_name + '(' + payerType.secondary_ins_provider_code + ')(Secondary Insurance)', 'data-payerType': 'secondary_insurance' }));

                            if ((payerType.tertiary && payerType.tertiary != 'null') && payerType.tertiary_ins_provider_name != null)
                                $('#ddlResponsible').append($('<option/>', { value: payerType.tertiary, text: payerType.tertiary_ins_provider_name + '(' + payerType.tertiary_ins_provider_code + ')(Tretiary Insurance)', 'data-payerType': 'tertiary_insurance' }));

                            if ((payerType.order_facility_id) && payerType.ordering_facility_name != null)
                                $('#ddlResponsible').append($('<option/>', { value: payerType.order_facility_id, text: payerType.ordering_facility_name + '(Ordering Facility)', 'data-payerType': 'ordering_facility' }));

                            if ((payerType.referring_provider_contact_id) && payerType.provider_name != null)
                                $('#ddlResponsible').append($('<option/>', { value: payerType.referring_provider_contact_id, text: payerType.provider_name + '(Provider)' , 'data-payerType': 'referring_provider' }));
                        });
                        $("#ddlResponsible option[data-payerType=" + payerTypes[0].payer_type + "]").attr('selected', 'selected');

                        $.each(charges, function (index, charge_details) {
                            if(charge_details.adjustment_code_id){
                                $("#ddlAdjustmentCode_fast").val(charge_details.adjustment_code_id);
                                return false;
                            }
                            else{
                                $("#ddlAdjustmentCode_fast").val('');
                            }
                        });
                        //$("#ddlAdjustmentCode_fast").val(charges.length ? charges[0].adjustment_code_id : '');
                        
                        // $("#ddlResponsible option[val=" + charges[0].adjustment_code_id + "]").attr('selected', 'selected');
                        $('#ddlResponsible').select2();
                        $("#ddlAdjustmentCode_fast").select2({width: '300px'});

                        $('#tBodyApplyPendingPayment').find('.applyCAS').on('click', function (e) {
                            var selectedRow = $(e.target || e.srcElement).closest('tr');
                            var chargeId = selectedRow.attr('data_charge_id_id');
                            self.getPayemntApplications(e);
                        });

                        $('#applyPaymentContent').find('#btnSaveAppliedPendingPayments').unbind().on('click', function (e) {
                            self.saveAllPayments(e, claimId, paymentId, paymentStatus, chargeId, paymentApplicationId);
                        });                        

                        $('#btnClearAppliedPendingPayments').unbind().on('click', function (e) {
                            self.clearPayments(e, paymentId, claimId);
                        });

                        $('#btnPayfullAppliedPendingPayments').unbind().on('click', function (e) {
                            self.saveAllPayments(e, claimId, paymentId, paymentStatus, chargeId, paymentApplicationId);
                        });

                        self.reloadPaymentFields(claimId);

                        $('#txtResponsibleNotes').val(payerTypes[0].billing_notes);

                        var adjCodeType = $('#ddlAdjustmentCode_fast').find(':selected').attr('data_code_type');

                        if ( adjCodeType === 'recoupment_debit' || adjCodeType === 'refund_debit') {

                            $('.checkDebit').prop('checked', true);
                            self.updateRefundRecoupment();
                            if(paymentStatus === 'applied' && adjCodeType === 'refund_debit')
                            {
                                self.isRefundApplied = true;
                            }
                        }
                        else
                        {
                            $('.checkDebit').prop('checked', false);
                            self.updateRefundRecoupment();
                        }  

                    },
                    error: function (err, response) {
                        commonjs.handleXhrError(err, response);
                    }
                });
            },

            clearPayments: function () {
                var pay_val = '0.00';
                $('.checkDebit').prop('checked', false);
                $('.this_pay').val(pay_val);
                $('.this_adjustment').val(pay_val);
            },

            updateRefundRecoupment: function () {
                var lineItems = $("#tBodyApplyPendingPayment tr");
                var isDebit = $('.checkDebit')[0].checked;
                var adjustment_codetype = $('#ddlAdjustmentCode_fast').find(':selected').attr('data_code_type');

                if (isDebit && adjustment_codetype) {
                    $('#btnPayfullAppliedPendingPayments').attr('disabled', true);
                    var thisAdjustment;

                    $.each(lineItems, function () {
                        thisAdjustment = $(this).find('td:nth-child(8)>input');
                        thisPayment = $(this).find('td:nth-child(5)>input');
                        if (adjustment_codetype === 'refund_debit') {
                            $(this).find('td:nth-child(5)>input').val('0.00');
                            $(this).find('td:nth-child(6)>input').val('0.00');
                            $(this).find('td:nth-child(5)>input').attr('disabled', true);
                            thisAdjustment.val(parseFloat(-Math.abs(thisAdjustment.val())).toFixed(2));
                        }
                        else if  (adjustment_codetype === 'recoupment_debit') {
                            $(this).find('td:nth-child(5)>input').attr('disabled', false);
                            thisAdjustment.val(parseFloat(-Math.abs(thisAdjustment.val())).toFixed(2));
                            thisPayment.val(parseFloat(-Math.abs(thisPayment.val())).toFixed(2));
                        }
                        else {
                            thisAdjustment.val(parseFloat(Math.abs(thisAdjustment.val())).toFixed(2));
                            thisPayment.val(parseFloat(Math.abs(thisPayment.val())).toFixed(2));
                            $(this).find('td:nth-child(5)>input').attr('disabled', false);
                        }
                    });

                }
                else {
                    lineItems.find('td:nth-child(5)>input').attr('disabled', false);
                    $.each(lineItems, function () {
                        thisAdjustment = $(this).find('td:nth-child(8)>input');
                        thisPayment = $(this).find('td:nth-child(5)>input');
                        thisAdjustment.val(parseFloat(Math.abs(thisAdjustment.val())).toFixed(2));
                        thisPayment.val(parseFloat(Math.abs(thisPayment.val())).toFixed(2));
                    });
                    $('#btnPayfullAppliedPendingPayments').attr('disabled', false);
                }
            },

            calculateAdjustment: function (e) {
                var row = $(e.target).closest('tr');
                var isDebit = $('.checkDebit')[0].checked;
                var bill_fee = parseFloat($(row).find('td:nth-child(3)').text()).toFixed(2);
                var otherPayment = $(row).find('td:nth-child(4)').text() != '' ? parseFloat($(row).find('td:nth-child(4)').text()) : 0.00;
                var this_pay = $(row).find('td:nth-child(5)>input').val() ? parseFloat($(row).find('td:nth-child(5)>input').val()) : 0.00;
                var allowed_fee = $(row).find('td:nth-child(6)>input').val() ? parseFloat($(row).find('td:nth-child(6)>input').val()) : 0.00;
                var otherAdj = parseFloat($(row).find('td:nth-child(7)').text())
                var adjustment = bill_fee - (allowed_fee)
                adjustment = isDebit ? -Math.abs(adjustment) : Math.abs(adjustment);
                $(row).find('td:nth-child(8)>input').val(parseFloat(adjustment).toFixed(2));
                var payment_amt = $(row).find('td:nth-child(5)>input').val() ? parseFloat($(row).find('td:nth-child(5)>input').val()) : 0.00;
                var adj_amt = $(row).find('td:nth-child(8)>input').val() ? parseFloat($(row).find('td:nth-child(8)>input').val()) : 0.00;
                var current_balance = parseFloat($(row).find('td:nth-child(3)').text()) - (otherPayment + otherAdj + payment_amt + adj_amt);
                $(row).find('td:nth-child(9)').text(parseFloat(current_balance).toFixed(2));
            },

            updatePaymentAdjustment: function () {
                var lineItems = $("#tBodyApplyPendingPayment tr");
                var payment = 0.0, adjustment = 0.0, other_payment = 0.0, other_adj = 0.0;

                $.each(lineItems, function (index) {
                    var otherPayment = parseFloat($(this).find('td:nth-child(4)').text().trim())
                    var otherAdj = parseFloat($(this).find('td:nth-child(7)').text().trim())
                    var payment_amt = $(this).find('td:nth-child(5)>input').val() ? parseFloat($(this).find('td:nth-child(5)>input').val().trim()) : 0.00;
                    var adj_amt = $(this).find('td:nth-child(8)>input').val() ? parseFloat($(this).find('td:nth-child(8)>input').val().trim()) : 0.00;
                    payment = payment + parseFloat(payment_amt);
                    other_payment = other_payment + parseFloat(otherPayment);
                    other_adj = other_adj + parseFloat(otherAdj);
                    adjustment = adjustment + parseFloat(adj_amt);
                    var current_balance = parseFloat($(this).find('td:nth-child(3)').text().trim()) - (otherPayment + otherAdj + payment_amt + adj_amt);
                    $(this).find('td:nth-child(9)').text(parseFloat(current_balance).toFixed(2));
                });

                if (payment < 0)
                    $('#spPaymentApplied').text('($' + parseFloat(payment).toFixed(2).substr(1) + ')');
                else
                    $('#spPaymentApplied').text('$' + parseFloat(payment).toFixed(2));

                if (adjustment < 0)
                    $('#spAdjustmentApplied').text('($' + parseFloat(adjustment).toFixed(2).substr(1) + ')');
                else
                    $('#spAdjustmentApplied').text('$' + parseFloat(adjustment).toFixed(2));

                var orderBillFee = parseFloat($('#lblBillingFee').text().substr(1).replace(',', ''));
                var orderBalance = orderBillFee - (parseFloat(adjustment) + parseFloat(payment) + parseFloat(other_payment) + parseFloat(other_adj));
                var orderAdjustment = parseFloat(adjustment) + parseFloat(other_adj);

                if (orderBalance < 0)
                    $('#lblBalanceNew').text('($' + parseFloat(orderBalance).toFixed(2).substr(1) + ')');
                else
                    $('#lblBalanceNew').text('$' + parseFloat(orderBalance).toFixed(2));

                if (orderAdjustment < 0)
                    $('#lblAdjustment').text('($' + parseFloat(orderAdjustment).toFixed(2).substr(1) + ')');
                else
                    $('#lblAdjustment').text('$' + parseFloat(orderAdjustment).toFixed(2));
            },

            savePaymentsCAS: function (claimId, paymentId, paymentStatus, payment_application_id) {
                var self = this;
                var charge_id = $('#divPaymentCAS').attr('data-charge_id');
                self.casSegmentsSelected = self.casSegmentsSelected.filter(function (obj) {
                    return obj.charge_id != charge_id
                })
                var cas = self.vaidateCasCodeAndReason(payment_application_id, paymentStatus, charge_id);
                if (cas) {
                    self.casSegmentsSelected.push(cas);
                    self.closePaymentsCAS();
                }
            },

            checkPreviousRowIsEmpty: function (previousRow, currentRow) {
                for (var casRow = 1; casRow < currentRow; casRow++) {
                    var _row = casRow;
                    var groupCode = $('#selectGroupCode' + _row).val()
                    var reasonCode = $('#selectReason' + _row).val()
                    var amount = $('#txtAmount' + _row).val()
                    if (groupCode === '' && reasonCode === '' && amount === '') {
                        commonjs.showWarning('Please fill the values in row ' + _row + ' before filling row ' + currentRow);
                        return false;
                    }
                }
                return true;
            },

            vaidateCasCodeAndReason: function (payment_application_id, paymentStatus, charge_id) {
                var self = this;
                var hasReturned = false;
                var casObj = [];
                var rowCame = 0;
                for (var k = 1; k <= 7; k++) {
                    var emptyCasObj = {};
                    var groupCode = $('#selectGroupCode' + k).val();
                    var reasonCode = $('#selectReason' + k).val();
                    var amount = $('#txtAmount' + k).val();
                    
                    if (paymentStatus === 'applied') {
                        var cas_id = $('#selectGroupCode' + k).attr('cas_id');
                    }

                    if (groupCode != '' && reasonCode != '' && amount != '') {
                        if (k != 0 && self.checkPreviousRowIsEmpty(k - 1, k)) {
                            emptyCasObj['group_code_id'] = groupCode;
                            emptyCasObj['reason_code_id'] = reasonCode;
                            emptyCasObj['amount'] = amount;
                            if (paymentStatus === 'applied') { emptyCasObj['cas_id'] = cas_id; }
                            casObj.push(emptyCasObj);
                            rowCame = k;
                        }
                        else return false;
                    }
                    else if (groupCode != '' && reasonCode == '') {
                        commonjs.showWarning('Please select the reason in row ' + k);
                        $('#selectReason' + k).focus()
                        return false;
                    }
                    else if (groupCode == '' && reasonCode != '') {
                        commonjs.showWarning('Please select the group code in row ' + k);
                        $('#selectGroupCode' + k).focus()
                        return false;
                    }
                    else if ((reasonCode != '' || groupCode != '') && amount == "") {
                        commonjs.showWarning('Please enter amount in row ' + k);
                        $('#txtAmount' + k).focus();
                        return false;
                    }
                }
                return {charge_id:charge_id,casObj:casObj};
            },

            getPayemntApplications: function (e) {
                var self = this;
                var chargeItem = $(e.target).closest('tr');
                var chargeId = chargeItem.attr('data_charge_id_id');
                var paymentApplicationId = chargeItem.attr('data_payment_adjustment_id');
                if (paymentApplicationId) {
                    $.ajax({
                        url: '/exa_modules/billing/pending_payments/payment_applications',
                        type: 'GET',
                        data: {
                            paymentApplicationId: paymentApplicationId
                        },
                        success: function (data, response) {
                            var payemntCasApplns = data || self.casSegmentsSelected;
                                $.each(payemntCasApplns, function (index, appln) {
                                    var rowVal = index + 1;
                                    $('#selectGroupCode' + rowVal).val(appln.cas_group_code_id).attr('cas_id', appln.id);
                                    $('#selectReason' + rowVal).val(appln.cas_reason_code_id);
                                    var amount = appln.amount.indexOf('$') == 0 ? appln.amount.substr(1) : appln.amount;
                                    $('#txtAmount' + rowVal).val(parseFloat(amount.replace(/,/g, '')).toFixed(2));
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
                    var casSelected = self.casSegmentsSelected.filter(function (obj) {
                        return obj.charge_id == chargeId
                    })
                    if (casSelected && casSelected.length) {
                        $.each(casSelected[0].casObj, function (index, appln) {
                            var rowVal = index + 1;
                            $('#selectGroupCode' + rowVal).val(appln.group_code_id);
                            $('#selectReason' + rowVal).val(appln.reason_code_id);
                            $('#txtAmount' + rowVal).val(parseFloat(appln.amount).toFixed(2));
                        });
                    }
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
                var self = this;
                var isDebit = $('.checkDebit')[0].checked;
                var adjustment_codetype = $('#ddlAdjustmentCode_fast').find(':selected').attr('data_code_type');
                var val= ['refund_debit','recoupment_debit']

                if ($('#ddlResponsible').val() === '') {
                    commonjs.showWarning('Please select responsible');
                    $('#ddlResponsible').select2('open')
                    return false;
                }
                else if ($('#ddlAdjustmentCode_fast').val() === '0') {
                    commonjs.showWarning('Please select adjustemnt code');
                    return false;
                } else if ( isDebit && val.indexOf(adjustment_codetype) < 0) {
                    commonjs.showWarning('Please select Refund Or Recoupment adjustment code ');
                    return false;
                } else if (!isDebit && val.indexOf(adjustment_codetype) >= 0 ) {
                    commonjs.showWarning('Please select DR checkbox ');
                    return false;
                } else if (self.isRefundApplied === true) {
                    if ($('#ddlAdjustmentCode_fast').find(':selected').attr('data_code_type') != 'refund_debit') {
                        var refund_change_confirm = confirm("This payment is refund mode want to overwrite this payment ? ");
                        if (refund_change_confirm == true) {
                            self.isRefundApplied = false;
                            return true;
                        } else {
                            return false;
                        }
                    } else {
                        self.isRefundApplied = false;
                        return true;
                    }
                }
                else return true;
            },

            saveAllPayments: function (e, claimId, paymentId, paymentStatus, chargeId, paymentApplicationId) {
                var targetObj = $(e.target);
                var objIsPayInFull = targetObj.is('#btnPayfullAppliedPendingPayments');
                var self = this;
                if (this.validatePayerDetails()) {
                    var lineItems = $("#tBodyApplyPendingPayment tr"), dataLineItems = [], orderPayment = 0.00, orderAdjustment = 0.00;
                    var line_items = [];

                    var cas = self.casSegmentsSelected;

                    $.each(lineItems, function (index) {
                        var _line_item = {};
                        var chargeRow = $(this);

                        var bill_fee = $(this).find('td:nth-child(3)').text();
                        var all_payment = $(this).find('td:nth-child(4)').text() ? $(this).find('td:nth-child(4)').text() : 0.00;
                        var this_pay = $(this).find('td:nth-child(5)>input').val() ? $(this).find('td:nth-child(5)>input').val() : 0.00;
                        var all_adjustment = $(this).find('td:nth-child(7)').text() ? $(this).find('td:nth-child(7)').text() : "0.00";
                        var this_adjustment = $(this).find('td:nth-child(8)>input').val() ? $(this).find('td:nth-child(8)>input').val() : 0.00;
                        var balance = parseFloat(bill_fee) - (parseFloat(all_payment) + parseFloat(all_adjustment) + parseFloat(this_pay) + parseFloat(this_adjustment)).toFixed(2);
                        
                        _line_item["charge_id"] = chargeRow.attr('data_charge_id_id');
                        _line_item["paymentApplicationId"] = chargeRow.attr('data_payment_application_id');
                        _line_item["adjustmentApplicationId"] = chargeRow.attr('data_payment_adjustment_id');
                        _line_item["paymentAppliedDt"] =  chargeRow.attr('data_payment_applied_dt');
                        // _line_item["payment"] = objIsPayInFull ? parseFloat(chargeRow.find('td:nth-child(9)').text().trim()) : chargeRow.find('td:nth-child(5)>input').val() ? parseFloat(chargeRow.find('td:nth-child(5)>input').val()) : 0.00;
                        _line_item["payment"] = objIsPayInFull  ? balance + parseFloat(this_pay) : this_pay;

                        _line_item["adjustment"] = chargeRow.find('td:nth-child(8)>input').val() ? parseFloat(chargeRow.find('td:nth-child(8)>input').val()) : 0.00;
                        
                        var _cas = cas.filter(function (obj) {
                            return obj.charge_id == chargeRow.attr('data_charge_id_id')
                        })

                        _line_item["cas_details"] = _cas && _cas.length ? _cas[0].casObj : [];
                        line_items.push(_line_item);
                    });

                    var payerType = $('#ddlResponsible').find(':selected').attr('data-payerType');
                    var adjustmentType = $('#ddlAdjustmentCode_fast').val() || null;
                    var billingNotes = $('#txtResponsibleNotes').val();
                    var deduction = $('#txtDeduction').val();
                    var coInsurance = $('#txtCoInsurance').val();
                    var coPay = $('#txtCoPay').val();

                    commonjs.showLoading();
                    targetObj.attr('disabled', true);

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
                            adjustmentId: adjustmentType,
                            paymentStatus: paymentStatus
                        },
                        success: function (model, response) {
                            commonjs.showStatus(paymentStatus === 'applied' ? 'Payment has been updated successfully' : 'Payment has been applied successfully');
                            targetObj.removeAttr('disabled');
                            commonjs.hideLoading();
                            // if (paymentStatus != 'applied') {
                            //     self.casSegmentsSelected = [];
                            //     self.closeAppliedPendingPayments(e, paymentId);
                            //     commonjs.hideDialog();
                            // }
                            // else {
                            paymentStatus != 'applied' ? paymentApplicationId = model[0].details.create_payment_applications.payment_application_id : paymentApplicationId;
                            self.getClaimBasedCharges(claimId, paymentId, 'applied', chargeId, paymentApplicationId, false)
                            // }
                        },
                        error: function (err, response) {
                            targetObj.removeAttr('disabled');
                            commonjs.handleXhrError(err, response);
                        }
                    });
                }
            },

            reloadPaymentFields: function (claimId) {
                var self = this;
                jQuery.ajax({
                    url: "/exa_modules/billing/pending_payments/fee_details",
                    type: "GET",
                    data: {
                        claimId: claimId
                    },
                    success: function (data, textStatus, jqXHR) {
                        if (data) {
                            var feeDetails = data[0];
                            self.setFeeFields({ billFee: feeDetails.bill_fee, adjustment: feeDetails.adjustment, balance: feeDetails.balance, others_paid: feeDetails.others_paid, patient_paid: feeDetails.patient_paid, payment: feeDetails.payment });
                        }
                        commonjs.hideLoading();
                    },
                    error: function (err) {
                        commonjs.handleXhrError(err);
                    }
                });
            },

            addNewPayemnt: function () {
                Backbone.history.navigate('#billing/payments/new', true);
            },

            goBackToPayments: function () {
                Backbone.history.navigate('#billing/payments/filter', true);
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
                        if (response) {
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
                    this.patientsPager.set({ "LastPageNo": Math.ceil(this.patientTotalRecords / this.patientsPager.get('pageSize')) });
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
                this.claimIdToSearch = '';
                this.invoiceNoToSearch = '';
                this.showPatientForm(patientId, patient_name, account_no);
            },

            showPatientForm: function (patientId, patient_name, account_no) {
                var self = this;
                $('#commonMsg').text('Pending payments for the patient : ')
                $('#spnPatInfo').text(patient_name + ' (' + account_no + ') ');
                this.showPendingPaymentsGrid(this.payment_id, this.payer_type, this.payer_id, patientId);
            },
            
            validateClaimId: function () {
                if ($('#claimId').val() == '') {
                    commonjs.showWarning('Please enter claim id to search');
                }
                else
                    return true;    
            },

            validateInvoice: function () {
                if ($('#invoiceNo').val() == '') {
                    commonjs.showWarning('Please enter invoice # to search');
                }
                else return true;
            },

            searchInvoiceOrClaim: function (e) {
                var self = this;
                if (e.which == 13) {
                    var self = this;
                    var target = $(e.target || e.srcElement);
                    self.patientId = 0;
                    self.claimIdToSearch = $('#claimId').val();
                    self.invoiceNoToSearch = $('#invoiceNo').val();

                    if ($(e.target).is('#claimId')) {
                        if (self.validateClaimId()) {
                            $('#commonMsg').text('Pending payments for claim id : ')
                            $('#spnPatInfo').text(self.claimIdToSearch);
                            self.showPendingPaymentsGrid(this.payment_id, this.payer_type, this.payer_id, 0, self.claimIdToSearch, '');
                        }
                    }
                    else if ($(e.target).is('#invoiceNo')) {
                        if (self.validateInvoice()) {
                            $('#commonMsg').text('Pending payments for inovice # : ')
                            $('#spnPatInfo').text(self.invoiceNoToSearch);
                            self.showPendingPaymentsGrid(this.payment_id, this.payer_type, this.payer_id, 0, '', self.invoiceNoToSearch);
                        }
                    }
                }
            },

            showPatientOrders: function (e) {
                var self = this;
                var target = $(e.target || e.srcElement);
                self.patientId = 0;
                self.claimIdToSearch = $('#claimId').val();
                self.invoiceNoToSearch = $('#invoiceNo').val();

                if ($(e.target).is('#anc_search_claim')) {
                    if (self.validateClaimId()) {
                        $('#commonMsg').text('Pending payments for claim id : ')
                        $('#spnPatInfo').text(self.claimIdToSearch);
                        self.showPendingPaymentsGrid(this.payment_id, this.payer_type, this.payer_id, 0, self.claimIdToSearch, '');
                    }
                }
                else if ($(e.target).is('#anc_search')) {
                    if (self.validateInvoice()) {
                        $('#commonMsg').text('Pending payments for inovice # : ')
                        $('#spnPatInfo').text(self.invoiceNoToSearch);
                        self.showPendingPaymentsGrid(this.payment_id, this.payer_type, this.payer_id, 0, '', self.invoiceNoToSearch);
                    }
                }
            },

            backToPatient: function (e) {
                $('#btnBackToPatient').hide();
                $('#diVPatient').show();
                $('#divPendingRecords').hide();
            },

            changePayerMode: function (e, isBind) {
                var valueType = $("#selectPaymentMode").val();

                switch (valueType) {
                    case "cash":
                    case "":
                        $("#txtCheque").attr("disabled", "disabled");
                        $("#txtCardName").attr("disabled", "disabled");
                        $("#paymentExpiryMonth").attr("disabled", "disabled");
                        $("#paymentExpiryYear").attr("disabled", "disabled");
                        $("#ddlCardType").attr("disabled", "disabled");
                        $("#txtCVN").attr("disabled", "disabled");
                        break;
                    case "check":
                    case "EFT":
                        $("#txtCheque").removeAttr("disabled");
                        // if (!isBind) {
                        //     $("#txtCheque").focus();
                        // }
                        $("#txtCardName").attr("disabled", "disabled");
                        $("#paymentExpiryMonth").attr("disabled", "disabled");
                        $("#paymentExpiryYear").attr("disabled", "disabled");
                        $("#ddlCardType").attr("disabled", "disabled");
                        $("#txtCVN").attr("disabled", "disabled");
                        break;
                    case "card":
                        // if (!isBind) {
                        //     $("#txtCheque").focus();
                        // }
                        $("#txtCheque").removeAttr("disabled");
                        $("#txtCardName").removeAttr("disabled");
                        $("#paymentExpiryMonth").removeAttr("disabled");
                        $("#paymentExpiryYear").removeAttr("disabled");
                        $("#ddlCardType").removeAttr("disabled");
                        $("#txtCVN").removeAttr("disabled");
                        break;
                }
            },

            afterAppliedGridBind: function (dataset, e, self) {
                if (dataset && dataset.length > 0) {
                    self.canDeletePayment = false;
                    $('#selectPayerType').attr({ 'disabled': true, 'title': 'You cannot change the payer since the payment has already applied' })
                }
            },

            validatePaymentDelete: function () {
                var self = this;
                if (self.canDeletePayment)
                    return confirm('Are you sure to delete this payment?');
                else {
                    return confirm('This payemet has been already applied. Proceed anyway?');
                }
            },

            deletePayment: function () {
                var self = this;
                if (self.validatePaymentDelete()) {
                    var self = this;
                    $.ajax({
                        url: '/exa_modules/billing/pending_payments/payment',
                        type: 'DELETE',
                        data: {
                            payment_id: self.payment_id
                        },
                        success: function (data, response) {
                            commonjs.showStatus('Payment has been deleted successfully');
                            Backbone.history.navigate('#billing/payments/filter', true);
                        },
                        error: function (err, response) {
                            commonjs.handleXhrError(err, response);
                        }
                    });
                }
            },

            paymentPrintPDF: function (e) {
                var self = this;
                self.paymentEditPDF = new paymentEditPDF({ el: $('#modal_div_container') });
                var paymentEditPDFArgs = {
                    payment_id: this.payment_id,
                    flag: 'paymentPDF'
                }
                self.paymentEditPDF.onReportViewClick(e, paymentEditPDFArgs);
            },

            paymentPrintReceiptPDF: function (e) {
                var self = this;
                self.paymentEditPDF = new paymentEditPDF({ el: $('#modal_div_container') });
                var paymentEditPDFArgs = {
                    payment_id: this.payment_id,
                    flag: 'payment-print-pdf'
                }
                self.paymentEditPDF.onReportViewClick(e, paymentEditPDFArgs);
            },

            disableSelectedReasonCode: function (e) {
                var idParent = $(e.target).attr("id");
                $('.col2 option').removeAttr("disabled");
                var reasonSelected = $(e.target).val();
                $('.col2 option[value="' + reasonSelected + '"]').prop("disabled", true);
            },

            checkAllPendingPayments: function () {
                var self = this;
                var paymentAmt = $('#lblBalance').text() != '' ? parseFloat($('#lblBalance').text().substring(1)) : 0.00;
                var payer = $('#selectPayerType :selected').val();
                if ($('#selectPayerType').val() === '0') {
                    commonjs.showWarning("Please select payer type");
                    $('#selectPayerType').focus();
                    return false;
                }
                if (!self.validatePayer($('#selectPayerType').val())) {
                    return false;
                }
                if (!self.payer_id) {
                    commonjs.showWarning("Payer id not setted properly");
                    return false;
                }
                if ($('#txtInvoice').val() == '' && payer != 'patient') {
                    commonjs.showWarning('Please update Invoice number to apply');
                    return false;
                }
                if (paymentAmt == 0) {
                    commonjs.showWarning('Minimum balance required to process invoice payment');
                    return false;
                }

                $.ajax({
                    url: '/exa_modules/billing/payments/invoice_details',
                    type: 'GET',
                    data: {
                        paymentId: self.payment_id,
                        invoice_no: $('#txtInvoice').val() || 0,
                        payer_type : payer,
                        payer_id : self.payer_id
                    },
                    success: function (data, response) {
                        if (data && data.length) {
                            var total_claims = data[0].total_claims || 0;
                            var valid_claims = data[0].valid_claims || 0;
                            var msg;

                            if (total_claims == valid_claims) {
                                msg = 'Overall (' + valid_claims + ') pending claims. Are you sure to process?';
                            }
                            else if (total_claims != 0 && valid_claims != 0) {
                                msg = 'Valid claim count is (' + valid_claims + ') from overall (' + total_claims + ') pending claims. Are you sure to process?';
                            } else if (total_claims != 0 && valid_claims == 0) {
                                msg = 'No valid claims to process payment';
                                commonjs.showWarning(msg);
                                return false;
                            }
                            else if (total_claims == 0) {
                                msg = "No valid claims to process payment(Pending claims doesn't have balance)";
                                commonjs.showWarning(msg);
                                return false;
                            }
                            if (confirm(msg)) {
                                self.applyAllPending();
                            }
                        }
                    },
                    error: function (err, response) {
                        commonjs.handleXhrError(err, response);
                    }
                });


            },

            applyAllPending: function () {
                var self = this;

                var payer = $('#selectPayerType :selected').val();

                $.ajax({
                    url: '/exa_modules/billing/payments/apply_invoice_payments',
                    type: 'POST',
                    data: {
                        paymentId: self.payment_id,
                        invoice_no: $('#txtInvoice').val() || 0,
                        payer_type: payer,
                        payer_id: self.payer_id
                    },
                    success: function (data, response) {
                        if (data && data.length) {
                            self.getAppliedBalance(self.payment_id);
                            $('#btnPaymentPendingRefresh').click();
                            $('#btnAppliedPayRefresh').click();
                            commonjs.showStatus('Payment has been applied auccessfully');
                        }
                    },
                    error: function (err, response) {
                        commonjs.handleXhrError(err, response);
                    }
                });

            },

            showClaimInquiry: function(id, patient_id, from) {
                self.claimInquiryView = new claimInquiryView({ el: $('#modal_div_container') });
                self.claimInquiryView.render(id, patient_id, from); 
            },

            getAppliedBalance: function (paymentId) {
                var self = this;
                $.ajax({
                    url: '/exa_modules/billing/pending_payments/applied_amount',
                    type: 'GET',
                    data: {
                        paymentId: paymentId
                    },
                    success: function (data, response) {
                        if (data && data.length) {
                            if (data[0].applied.indexOf('$') == 0)
                                $('#lblApplied').html(data[0].applied.substr(1));
                            else
                                $('#lblApplied').html(data[0].applied);
                            
                            if (data[0].balance.indexOf('$') == 0)
                                $('#lblBalance').html(data[0].balance.substr(1));
                            else
                                $('#lblBalance').html(data[0].balance);
                        }
                    },
                    error: function (err, response) {
                        commonjs.handleXhrError(err, response);
                    }
                });
            },

            loadSelectedGrid: function (e, paymentID, payer_type, payer_id) {
                var self = this;
                var id = $(e.target || e.srcElement).closest('a').attr('id');
                if (id == self.tabClicked)
                    return false;

                if (id === 'aPeningPayments' && (!$('#tblpendPaymentsGridOnly').children().length)) {
                    self.showPendingPaymentsGridInvoice(paymentID, payer_type, payer_id);
                }
                else if (id === 'aAppliedPayments' && (!$('#tblAppliedPaymentsGrid').children().length)) {
                    self.showAppliedByPaymentsGrid(paymentID, payer_type, payer_id);
                }
                self.tabClicked = id;
            },

            setMoneyMask: function (obj1, obj2) {
                $(".ui-jqgrid-htable thead:first tr.ui-search-toolbar input[name=billing_fee],[name=balance],[name=bill_fee],[name=adjustment],[name=this_adjustment],[name=payment]").addClass('floatbox');
                $(".ui-jqgrid-htable thead:first tr.ui-search-toolbar input[name=claim_id]").addClass('integerbox');
                commonjs.validateControls();
            }

        });
    });