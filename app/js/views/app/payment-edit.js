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
    'collections/app/studycpt-list'],

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
        studycptCollection
    ) {
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
            studyCptPager: null,
            rendered: false,
            gridLoaded: [],
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
            isRefundApplied: false,
            casDeleted: [],
            saveClick:false,

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
                "click .selectInsurance": "searchInsurance",
                "click .searchProvider": "searchProvider",
                "click .selectPatientSave": "searchPatient",
                "click .selectOrderingFac": "searchOrderingFac",
                'click .btnInsuranceSelectSave': 'saveInsuranceProviderGrid',
                'click .btnRefProviderSelectSave': 'saveProviderGrid',
                'click .btnPatientSelectSave': 'savePatientGrid',
                'click .btnOFSelectSave': 'saveOFGrid',
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

            usermessage: {
                selectCarrier: commonjs.geti18NString("billing.payments.searchCarrier"),
                selectPatient: commonjs.geti18NString("billing.payments.searchPatient"),
                selectOrderingFacility: commonjs.geti18NString("billing.payments.searchOrderingFacility"),
                selectProvider: commonjs.geti18NString("billing.payments.searchProvider")
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
                this.claimStatuses = new modelCollection(app.claim_status);
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
                this.studycptList = new studycptCollection();
                this.studyCptPager = new ModelPaymentsPager();
                if (app.userInfo.user_type != 'SU') {
                    var rights = (window.appRights).init();
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

            render: function (paymentId, from) {
                var self = this;
                self.from = from;
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
                self.showBillingForm(paymentId, self.from);

                if (self.from !== 'ris')
                    self.showPaymentsGrid(paymentId);

                commonjs.processPostRender();
                commonjs.validateControls();
                commonjs.isMaskValidate();
                if (self.screenCode.indexOf('APAY') > -1) {// for screen rights
                    $('#divPendingPay').addClass('maskPendingPay');
                    $('#btnPaymentApplyAll').attr('disabled', true);
                }
                if (self.screenCode.indexOf('DPAY') > -1)
                    $('#btnPaymentDelete').attr('disabled', true)

                if (self.from === 'ris') { // accessing payments from RIS, we need to hide, disable some buttons, and screens
                    $('#divPendingPaymentsContainer').hide();
                    $('#selectPayerType').attr('disabled', 'disabled');
                    $('#btnPaymentApplyAll').hide();
                    $('#btnPaymentPrint').hide();
                    $('#divStudyCpt').show();
                }
                else {
                    $('#divStudyCpt').hide();
                }
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

            showBillingForm: function (paymentID, from) {
                var self = this;
                self.bindNewDTP();
                self.clearPayemntForm(from);
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
                    if (from === 'ris') {
                        $('#selectPayerType').val('patient');
                        self.setPayerFields();
                    }
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
                                self.paymentTabClick();
                                self.bindpayments(result[0], paymentID, from);
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
                $('#selectPaymentMode').val(0);
                $('#PaymentForm input[type=text]').val('');
                $('.payerFields').hide();

                if (this.from === 'ris') {
                    $('#selectPayerType').val('patient');
                    this.setPayerFields();
                    $('#select2-txtautoPayerPP-container').html('Select Patient');
                    $('#divPayerPatient').show();
                }
                else {
                    $('#selectPayerType').val(0);
                }

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
                this.clearPayerFields();
                if (val === 'insurance') {
                    $('#select2-txtautoPayerPIP-container').html('Select Insurance');
                    $('#divPayerInsurnace').show();
                    $('#lblIpEob').show();
                    $('#chkIpEob').prop('checked', true);
                    $('#divPayerInsurnace').show();
                    $('#lblInputType').text('Input Type');
                }
                else if (val === 'patient') {
                    $('#select2-txtautoPayerPP-container').html('Select Patient');
                    $('#divPayerPatient').show();
                    $('#lblIpEob').hide();
                    $('#divInputType span').hide();
                    $('#txtInvoice').hide();
                    $('#lblInputType').text('');
                }
                else if (val === 'ordering_facility') {
                    $('#select2-txtautoPayerPOF-container').html('Select Ordering facility');
                    $('#divPayerOrderFacility').show();
                    $('#lblIpEob').hide();
                    $('#lblInputType').text('Input Type');
                }
                else if (val === 'ordering_provider') {
                    $('#select2-txtautoPayerPR-container').html('Select Provider');
                    $('#divPayerProvider').show();
                    $('#lblIpEob').hide();
                    $('#lblInputType').text('Input Type');
                }
            },

            setInsuranceAutoComplete: function () {
                var self = this;
                var $txtautoPayerPIP = $("#txtautoPayerPIP");
                var $select2Container = $('#select2-txtautoPayerPIP-container');
                var placeHolder = i18n.get("billing.payments.selectInsurance");
                $txtautoPayerPIP.select2({
                    ajax: {
                        url: "/exa_modules/billing/autoCompleteRouter/insurances",
                        dataType: 'json',
                        delay: 250,
                        data: function (params) {
                            if (params.term === undefined && $select2Container.text().toLowerCase() != placeHolder.toLowerCase())
                                params.term = $select2Container.text();
                            return {
                                page: params.page || 1,
                                q: params.term || '',
                                pageSize: 10,
                                sortField: "insurance_code",
                                sortOrder: "ASC",
                                company_id: app.companyID,
                                isInactive: false
                            };
                        },
                        processResults: function (data, params) {
                            return commonjs.getTotalRecords(data, params);
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
                $select2Container = $('#select2-txtautoPayerPIP-container');
                $select2Container.html(placeHolder);
                $txtautoPayerPIP.on('select2:open', function (event) {
                    commonjs.getPlaceHolderForSearch();
                    placeHolder = i18n.get("billing.payments.selectInsurance");
                    if ($select2Container && $select2Container.text().toLowerCase() != placeHolder.toLowerCase())
                        $txtautoPayerPIP.data('select2').dropdown.$search.val($select2Container.text());
                });
            },

            saveInsuranceProviderGrid: function (e) {
                if (insuranceArray && insuranceArray.length > 0 && insuranceArray[0].insurance_name) {
                    this.payer_id = parseInt(insuranceArray[0].insurance_id) || 0;
                    this.insurance_provider_id = insuranceArray[0].insurance_id;
                    this.payerCode = insuranceArray[0].insurance_code ? insuranceArray[0].insurance_code : '';
                    this.payerName = insuranceArray[0].insurance_name;
                    this.payerType = 'insurance';
                    coverage_level = 'Primary Insurance';
                    $("#hdnPayerID").val(insuranceArray[0].insurance_id);
                    $("#lblAutoInsurance").html(insuranceArray[0].insurance_name);
                    $('#select2-txtautoPayerPIP-container').html(insuranceArray[0].insurance_code || '');
                } else {
                    $("#lblAutoInsurance").html('');
                    $('#select2-txtautoPayerPIP-container').html(this.usermessage.selectCarrier);
                }
                $('#siteModal').modal('hide');
            },

            saveProviderGrid: function (e) {
                if (providerArray && providerArray.length > 0 && providerArray[0].full_name) {
                    this.payer_id = parseInt(providerArray[0].provider_contact_id) || 0;
                    this.payerCode = providerArray[0].provider_code;
                    this.provider_id = providerArray[0].provider_contact_id;
                    this.payerName = providerArray[0].full_name;
                    this.payerType = 'Ordering Provider';
                    coverage_level = 'Providers';
                    $('#select2-txtautoPayerPR-container').html(providerArray[0].full_name);
                } else
                    $('#select2-txtautoPayerPR-container').html(this.usermessage.selectProvider);
                $('#siteModal').modal('hide');
            },

            savePatientGrid: function (e) {
                if (patientArray && patientArray.length > 0 && patientArray[0].patient_name) {
                    this.payer_id = parseInt(patientArray[0].patient_id) || 0;
                    this.patient_id = this.payer_id;
                    this.payerCode = '';
                    this.payerName = patientArray[0].patient_name;
                    this.payerType = 'patient';
                    coverage_level = 'Patient';
                    $("#hdnPayerID").val(patientArray[0].patient_id);
                    $("#lblAutoPatient").html(patientArray[0].patient_name);
                    $('#select2-txtautoPayerPP-container').html(patientArray[0].account_no);
                } else {
                    $("#lblAutoPatient").html('');
                    $('#select2-txtautoPayerPP-container').html(this.usermessage.selectPatient);
                }
                $('#siteModal').modal('hide');
            },

            saveOFGrid: function (e) {
                if (orderingFacilityArray && orderingFacilityArray.length > 0 && orderingFacilityArray[0].group_name) {
                    this.payer_id = parseInt(orderingFacilityArray[0].provider_group_id) || 0;
                    this.provider_group_id = this.payer_id;
                    this.payerCode = orderingFacilityArray[0].group_code || '';
                    this.payerName = orderingFacilityArray[0].group_name;
                    this.payerType = 'ordering_facility';
                    coverage_level = 'Odering Facility';
                    $("#hdnPayerID").val(orderingFacilityArray[0].provider_group_id);
                    $('#select2-txtautoPayerPOF-container').html(orderingFacilityArray[0].group_name);
                } else
                    $('#select2-txtautoPayerPOF-container').html(this.usermessage.selectOrderingFacility);
                $('#siteModal').modal('hide');
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
                var $txtautoPayerPP = $("#txtautoPayerPP");
                var $select2Container = $('#select2-txtautoPayerPP-container');
                var placeHolder = i18n.get("billing.payments.selectPatient");
                $txtautoPayerPP.select2({
                    ajax: {
                        url: "/exa_modules/billing/autoCompleteRouter/patients",
                        dataType: 'json',
                        delay: 250,
                        data: function (params) {
                            if (params.term === undefined && $select2Container.text().toLowerCase() != placeHolder.toLowerCase())
                                params.term = $select2Container.text();
                            return {
                                page: params.page || 1,
                                q: params.term || '',
                                pageSize: 10,
                                sortField: "full_name",
                                sortOrder: "ASC",
                                company_id: app.companyID
                            };
                        },
                        processResults: function (data, params) {
                            return commonjs.getTotalRecords(data, params);
                        },
                        cache: true
                    },
                    placeholder: placeHolder,
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
                $select2Container = $('#select2-txtautoPayerPP-container');
                $select2Container.html(placeHolder);
                $txtautoPayerPP.on('select2:open', function (event) {
                    commonjs.getPlaceHolderForSearch();
                    placeHolder = i18n.get("billing.payments.selectPatient");
                    if ($select2Container && $select2Container.text().toLowerCase() != placeHolder.toLowerCase())
                        $txtautoPayerPP.data('select2').dropdown.$search.val($select2Container.text());
                });
            },

            setOFAutoComplete: function () {
                var self = this;
                var $txtautoPayerPOF = $("#txtautoPayerPOF");
                var $select2Container = $('#select2-txtautoPayerPOF-container');
                var placeHolder = i18n.get("billing.payments.selectOrderingFacility");
                $('#s2id_txtautoPayerPOF a span').html('Select ordering facility');
                $txtautoPayerPOF.select2({
                    ajax: {
                        url: "/exa_modules/billing/autoCompleteRouter/provider_group",
                        dataType: 'json',
                        delay: 250,
                        data: function (params) {
                            if (params.term === undefined && $select2Container.text().toLowerCase() != placeHolder.toLowerCase())
                                params.term = $select2Container.text();
                            return {
                                page: params.page || 1,
                                q: params.term || '',
                                pageSize: 10,
                                sortField: "group_name",
                                sortOrder: "ASC",
                                groupType: 'OF',
                                company_id: app.companyID
                            };
                        },
                        processResults: function (data, params) {
                            return commonjs.getTotalRecords(data, params);
                        },
                        cache: true
                    },
                    placeholder: placeHolder,
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
                $select2Container = $('#select2-txtautoPayerPOF-container');
                $select2Container.html(placeHolder);
                $txtautoPayerPOF.on('select2:open', function (event) {
                    commonjs.getPlaceHolderForSearch();
                    placeHolder = i18n.get("billing.payments.selectOrderingFacility");
                    if ($select2Container && $select2Container.text().toLowerCase() != placeHolder.toLowerCase())
                        $txtautoPayerPOF.data('select2').dropdown.$search.val($select2Container.text());
                });
            },

            setProviderAutoComplete: function () {
                var self = this;
                var $txtautoPayerPR = $("#txtautoPayerPR");
                var $select2Container = $('#select2-txtautoPayerPR-container');
                var placeHolder = i18n.get("billing.payments.selectProvider");
                $('#s2id_txtautoPayerPR a span').html('Select provider');
                $txtautoPayerPR.select2({
                    ajax: {
                        url: "/exa_modules/billing/autoCompleteRouter/providers",
                        dataType: 'json',
                        delay: 250,
                        data: function (params) {
                            if (params.term === undefined && $select2Container.text().toLowerCase() != placeHolder.toLowerCase())
                                params.term = $select2Container.text();
                            return {
                                page: params.page || 1,
                                q: params.term || '',
                                provider_type: 'RF',
                                pageSize: 10,
                                sortField: "p.last_name",
                                sortOrder: "asc",
                                company_id: app.companyID
                            };
                        },
                        processResults: function (data, params) {
                            return commonjs.getTotalRecords(data, params);
                        },
                        cache: true
                    },
                    placeholder: placeHolder,
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
                $select2Container = $('#select2-txtautoPayerPR-container');
                $select2Container.html(placeHolder);
                $txtautoPayerPR.on('select2:open', function (event) {
                    commonjs.getPlaceHolderForSearch();
                    placeHolder = i18n.get("billing.payments.selectProvider");
                    if ($select2Container && $select2Container.text().toLowerCase() != placeHolder.toLowerCase())
                        $txtautoPayerPR.data('select2').dropdown.$search.val($select2Container.text());
                });
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

            formatMoneyValue: function (amount, fromCas) {
                if (typeof amount === "string" && fromCas) {
                    return parseFloat(amount.replace(/[(]/g,'-').replace(/[^0-9.-]+/g, "")) || "";
                } else if (typeof amount === "number") {
                    return amount < 0 ? '($' + parseFloat(amount) + ')' : '$' + parseFloat(amount);
                }
                return amount;
            },

            bindpayments: function (response, paymentID, from) {
                var self = this;
                var payment_statuses = ['fully_applied', 'partially_applied', 'over_applied'];
                self.order_id = (response.order_id) ? response.order_id : 0;
                self.study_id = (response.study_id) ? response.study_id : 0;
                $('#lblPayerID').html(response.id);
                $('#referencePaymentID').val(response.display_id);
                $('#ddlPaidLocation').val(response.facility_id || app.facilityID);
                self.setPayerName(response.payer_type, response)
                $("input:radio[name=billingMethod][value=" + response.billing_method + "]").prop("checked", true);

                if (payment_statuses.indexOf(response.current_status) > -1) {
                    self.canDeletePayment = false;
                    $("#selectPayerType").prop("disabled", true);
                    if (from === "ris") {
                        $("#btnPaymentSave").prop("disabled", true);
                        $("#btnPaymentDelete").prop("disabled", true);
                    }
                }

                $('#txtInvoice').val(response.invoice_no).show();
                if (response.invoice_no) {
                    $('#txtInvoice').val(response.invoice_no).show();
                    $('#chkIpInvoice').prop('checked', true);//.change();
                    $('#invoiceNo').val(response.invoice_no);
                    $('#anc_search').click();
                    from !== 'ris' ? $('#btnPaymentApplyAll').show() : '';
                } else if (response.payer_type === "insurance") {
                    $('#chkIpEob').prop('checked', true);
                }
                else if (response.payer_type === "patient" && response.patient_id) {
                    from !== 'ris' ? $('#btnPaymentApplyAll').show() : '';
                    $('#lblInputType').text('');
                    $('#txtInvoice').hide();
                    $('#commonMsg').text(commonjs.geti18NString("shared.fields.pendingPaymentsForThePatient"));
                    var e = $.Event('keyup');
                    $('#mrn').val(response.account_no).focus().trigger(e);
                    $('#spnPatInfo').text(response.patient_name + ' (' + response.account_no + ') ');
                    this.showPendingPaymentsGrid(this.payment_id, response.payer_type, response.patient_id, response.patient_id);
                }

                if (response.payer_type === "patient") {
                    self.payer_id = response.patient_id;
                } else {
                    $('#btnPrintReceipt').hide();
                    if (response.payer_type === "ordering_facility")
                        self.payer_id = response.provider_group_id;
                    else if (response.payer_type === "insurance")
                        self.payer_id = response.insurance_provider_id;
                    else if (response.payer_type === "ordering_provider")
                        self.payer_id = response.provider_contact_id;
                }

                $('#liPendingPaymentsPat a').click();
                // self.showPendingPaymentsGridInvoice(paymentID, response.payer_type, self.payer_id);
                $('#txtAmount').val(self.formatMoneyValue(response.amount));
                $('#lblApplied').html(self.formatMoneyValue(response.applied));
                $('#lblBalance').html(self.formatMoneyValue(response.available_balance));
                $("#txtCheque").val(response.card_number);
                $("#txtCardName").val(response.card_name);
                $("#ddlpaymentReason").val(response.payment_reason_id)
                $("#txtNotes").val(response.notes)
                $('#selectPaymentMode').val(response.payment_mode);
                self.changePayerMode(response.payment_mode, true);

                commonjs.checkNotEmpty(response.accounting_date) ? self.dtpAccountingDate.date(response.accounting_date) : self.dtpAccountingDate.clear();
                self.study_dt = self.dtpAccountingDate.date().format('YYYY-MM-DD');
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
                self.showStudyCpt(self.payer_id,self.study_dt);
            },

            showStudyCpt: function (payerId, study_dt) {
                var self = this;
                self.gridLoaded = [];
                this.studyCptTable = new customGrid();
                this.studyCptTable.render({
                    gridelementid: '#tblStudyCpt',
                    custompager: this.studyCptPager,
                    emptyMessage: 'No Record found',
                    colNames: ['', '', '', '', '', '', ''],
                    i18nNames: ['', '', '', 'billing.COB.studyDate', 'billing.payments.accessionNo', 'billing.payments.studyDescription', 'billing.payments.cptCodes'],
                    colModel: [
                        {
                            name: 'as_chkStudyCpt',
                            width: 20,
                            sortable: false,
                            resizable: false,
                            search: false,
                            isIconCol: true,
                            formatter: function (cellvalue, option, rowObject) {
                                return '<input type="checkbox" name="chkStudyCpt" id="chktblStudyCpt' + '_' + rowObject.id + '" />'

                            },
                            customAction: function (rowID, e, that) {
                            }
                        },
                        { name: 'id', index: 'id', key: true, searchFlag: 'int', hidden: true },
                        { name: 'facility_id', searchFlag: 'int', hidden: true },
                        { name: 'study_dt', width: 70, formatter: self.studyDateFormatter },
                        { name: 'accession_no', width: 70},
                        { name: 'study_description', width: 100},
                        { name: 'cpt_code', width: 70 }
                    ],
                    customizeSort: true,
                    sortable: {
                        exclude: ',#jqgh_tblStudyCpt_edit'
                    },
                    pager: '#gridPager_studyCpt',
                    sortname: "study_dt",
                    sortorder: "ASC",
                    caption: "StudyCpt",
                    datastore: self.studycptList,
                    container: this.el,
                    disablesearch: false,
                    disablesort: false,
                    disablepaging: true,
                    showcaption: false,
                    disableadd: true,
                    disablereload: true,
                    customargs: {
                        payerId: payerId,
                        customDt: study_dt
                    },
                    onaftergridbind: function (model, gridObj) {
                        self.bindDateRangeOnSearchBox(gridObj, 'tblStudyCpt',study_dt);
                    },
                });

                setTimeout(function () {
                    $('#tblStudyCpt').jqGrid('setGridHeight', '300px');
                    $('#tblStudyCpt').jqGrid('setGridWidth', $(window).width() - 20);
                    commonjs.processPostRender();
                }, 500);
            },

            paymentTabClick: function (from) {
                $(".nav-item").on("click", function (e) {
                    setTimeout(function () {
                        if (e.target.id == 'aAppliedPayments') {
                            $('#gbox_tblAppliedPaymentsGrid').find("#gs_claim_id").focus();
                        } else if (e.target.id == 'aPeningPaymentsWithAccInv') {
                            $('#gbox_tblpendPaymentsGrid').find("#gs_claim_id").focus();
                            if (from === 'save') $('#btnBackToPatient').click();

                            if ($('#chkIpEob').is(":checked")) {
                                $("#claimId").focus();
                            } else if ($('#chkIpInvoice').is(":checked")) {
                                $("#invoiceNo").focus();
                            } else {
                                $("#lname").focus();
                            }

                        } else if (e.target.id == 'aPeningPayments') {
                            $('#gbox_tblpendPaymentsGridOnly').find("#gs_claim_id").focus();
                        }
                    }, 100);

                });
            },

            bindDateRangeOnSearchBox: function (gridObj, gridId,study_dt) {
                var self = this, tabtype = 'order';
                var columnsToBind = ['study_dt']
                var drpOptions = { locale: { format: "L" } };
                var currentFilter = 1;

                _.each(columnsToBind, function (col) {
                    var rangeSetName = "past";
                    var colSelector = '#gs_' + col;

                    var colElement = $(colSelector);

                    if (self.gridLoaded.indexOf(gridId) == -1) {
                        var fromDate = moment().startOf('month');
                        var toDate = moment().endOf('month');
                        if($.trim($("#txtAccountingDate").val()) == ""){
                            colElement.val(study_dt);
                        }
                        else{
                            colElement.val($.trim($("#txtAccountingDate").val()));
                        }

                        self.gridLoaded.push(gridId)
                    }

                    var drp = commonjs.bindDateRangePicker(colElement, drpOptions, rangeSetName, function (start, end, format) {
                        if (start && end) {
                            currentFilter.startDate = start.format('L');
                            currentFilter.endDate = end.format('L');
                            $('input[name=daterangepicker_start]').removeAttr("disabled");
                            $('input[name=daterangepicker_end]').removeAttr("disabled");
                            $('.ranges ul li').each(function (i) {
                                if ($(this).hasClass('active')) {
                                    currentFilter.rangeIndex = i;
                                }
                            });
                        }
                    });
                    colElement.on("apply.daterangepicker", function (ev, drp) {
                        gridObj.refresh();
                    });
                    colElement.on("cancel.daterangepicker", function (ev, drp) {
                        gridObj.refresh();
                    });
                });
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

            setCasGroupCodesAndReasonCodes: function (isFromClaim, callback) {
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
                        // Send response to claim screen
                        if (isFromClaim && typeof callback === 'function') {
                            callback({
                                cas_group_codes: self.cas_group_codes,
                                cas_reason_codes: self.cas_reason_codes
                            });
                        }
                    },
                    error: function (err, response) {
                        commonjs.handleXhrError(err, response);
                    }
                });
            },

            validatePayer: function (payermode) {
                var self = this;
                if (payermode == 'insurance' && !self.payer_id) {
                    commonjs.showWarning("messages.warning.payments.pleaseSelectInsurance");
                    $('#txtautoPayerPIP').select2('open');
                    return false;
                }
                else if (payermode == 'patient' && !self.payer_id) {
                    commonjs.showWarning("messages.warning.payments.pleaseSelectPatient");
                    $('#txtautoPayerPP').select2('open');
                    return false;
                }
                else if (payermode == 'ordering_provider' && !self.payer_id) {
                    commonjs.showWarning("messages.warning.payments.pleaseSelectProvider");
                    $('#txtautoPayerPR').select2('open');
                    return false;
                }
                else if (payermode == 'ordering_facility' && !self.payer_id) {
                    commonjs.showWarning("messages.warning.payments.pleaseSelectOrderingFacility");
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
                    commonjs.showWarning("messages.warning.payments.selectPayerType");
                    $('#selectPayerType').focus();
                    return false;
                }
                if (!self.validatePayer($('#selectPayerType').val())) {
                    return false;
                }
                if ($.trim($("#txtAccountingDate").val()) == "") {
                    commonjs.showWarning("messages.warning.payments.selectAccountingDate");
                    return false;
                }
                if (amount == "") {
                    commonjs.showWarning("messages.warning.payments.enterAmount");
                    $("#txtAmount").focus();
                    return false;
                }
                if (amount == "" || (amount.indexOf('-') > 0)) {
                    commonjs.showWarning("messages.warning.payments.enterValidAmount");
                    $('#txtAmount').focus();
                    return false;
                }
                if ($('#selectPaymentMode').val() === '0') {
                    commonjs.showWarning("messages.warning.payments.selectPaymentMode");
                    $('#selectPaymentMode').focus();
                    return false;
                }
                if ($('#selectPaymentMode').val() === 'card' && $.trim($("#txtCheque").val()) == "") {
                    commonjs.showWarning('messages.warning.payments.enterCardNo');
                    $('#txtCheque').focus();
                    return false;
                }
                if ($('#selectPaymentMode').val() === 'check' && $.trim($("#txtCheque").val()) == "") {
                    commonjs.showWarning('messages.warning.payments.enterCheckNo');
                    $('#txtCheque').focus();
                    return false;
                }
                if ($("#chkIpInvoice").is(':checked') && $.trim($("#txtInvoice").val()) == "") {
                    commonjs.showWarning('messages.warning.payments.enterInvoiceNo');
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

            savePayment: function (e, claimId, paymentId, paymentStatus, paymentApplicationId) {
                var self = this;
                if ((!self.isFromClaim && !self.validatepayments()) || (self.isFromClaim && !self.validatePayerDetails())) {
                    return false;
                }

                $('#btnPaymentSave').attr('disabled', true);
                commonjs.showLoading('messages.loadingMsg.default')
                var paymentObj = {
                    paymentId: self.payment_id,
                    company_id: app.companyID,
                    payer_type: $('#selectPayerType').val(),
                    invoice_no: $('#txtInvoice').is(':visible') ? $('#txtInvoice').val() : null,
                    patient_id: self.patient_id,
                    provider_contact_id: self.provider_id,
                    provider_group_id: self.provider_group_id,
                    insurance_provider_id: self.insurance_provider_id,
                    credit_card_number: $("#txtCheque").val() || null,
                    credit_card_name: $("#txtCardName").val() || null,
                    payment_mode: $('#selectPaymentMode').val(),
                    payment_reason_id: $("#ddlpaymentReason").val() || null,
                    user_id: app.userID,
                    payment_row_version: self.payment_row_version
                };

                if (self.isFromClaim && self.claimPaymentObj) {
                    var lineItems = $("#tBodyApplyPendingPayment tr");
                    var payment = 0.00;
                    // get total this payment.
                    $.each(lineItems, function (index) {
                        var $thisPay = $(this).find('td:nth-child(5)>input');
                        var payment_amt = $thisPay.val() ? $thisPay.val().trim() : 0.00;
                        payment += parseFloat(payment_amt);
                    });
                    paymentObj.paymentId = self.payment_id || self.claimPaymentObj.paymentId || paymentId || 0 ;
                    paymentObj.amount = payment;
                    paymentObj.isFromClaim = true;
                    paymentObj.patient_id = self.claimPaymentObj.patient_id;
                    paymentObj.payer_type = self.claimPaymentObj.payer_type;
                    paymentObj.facility_id = self.claimPaymentObj.facility_id;
                    paymentObj.payment_mode = self.claimPaymentObj.payment_mode;
                    paymentObj.accounting_date = self.claimPaymentObj.accounting_date;
                    paymentObj.provider_group_id = self.claimPaymentObj.provider_group_id;
                    paymentObj.credit_card_number = self.claimPaymentObj.credit_card_number;
                    paymentObj.provider_contact_id = self.claimPaymentObj.provider_contact_id;
                    paymentObj.insurance_provider_id = self.claimPaymentObj.insurance_provider_id;
                    paymentObj.payment_row_version = self.claimPaymentObj.payment_row_version;
                } else {
                    paymentObj.amount = parseFloat($('#txtAmount').val()) || 0.00;
                    paymentObj.facility_id = $.trim($('#ddlPaidLocation').val());
                    paymentObj.display_id = $.trim($('#referencePaymentID').val()) || null;
                    paymentObj.accounting_date = self.dtpAccountingDate && self.dtpAccountingDate.date() ? self.dtpAccountingDate.date().format('YYYY-MM-DD') : null;
                    paymentObj.notes = ($("#txtNotes").val()).replace(/(\r\n|\n|\r)/gm, "") || null;
                }

                this.model.set(paymentObj);
                this.model.save({
                }, {
                        success: function (model, response) {
                            self.gridFirstLoaded = false;
                            self.pendingGridLoaderd = false;
                            self.tabClicked = '';
                            self.saveClick = true;
                            var msg = self.payment_id ? commonjs.geti18NString('messages.status.paymentUpdatedSuccessfully') : commonjs.geti18NString('messages.status.paymentCreatedSuccessfully');

                            if (self.isFromClaim && response && response.length === 0) {
                                commonjs.hideLoading();
                                return false;
                            } else if (self.isFromClaim && response && response.length) {
                                commonjs.showStatus(msg);
                                self.payment_id = response[0].id || 0;
                                self.claimPaymentObj.isPaymentUpdate = false;
                                self.saveAllPayments(e, claimId, self.payment_id, paymentStatus, 0, paymentApplicationId);
                                commonjs.hideLoading();
                            } else {
                                // Payment screen flow
                                if (self.payment_id) {
                                    if (response && response.length) {
                                        commonjs.showStatus(msg);
                                        self.render(self.payment_id, self.from);
                                    }
                                    else {
                                        commonjs.showWarning('messages.warning.payments.paymentAlreadyUpdated');
                                    }
                                    $('#btnPaymentSave').removeAttr('disabled');
                                    commonjs.hideLoading();
                                }
                                else {
                                    if (self.from === 'ris'){
                                        Backbone.history.navigate('#billing/payments/edit/' + self.from + '/' + model.attributes[0].id, true);
                                    } else {
                                        Backbone.history.navigate('#billing/payments/edit/' + model.attributes[0].id, true);
                                    }
                                }
                                self.paymentTabClick('save');
                            }

                        },
                        error: function (err, response) {
                            commonjs.handleXhrError(err, response);
                        }
                    });

            },

            showPendingPaymentsGridInvoice: function (paymentID, payerType, payerId) {
                var self = this;
                this.invoicePendPaymentTable = new customGrid();
                this.invoicePendPaymentTable.render({
                    gridelementid: '#tblpendPaymentsGridOnly',
                    custompager: this.pendPaymtInvoicePager,
                    emptyMessage: 'No Record found',
                    colNames: ['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
                    i18nNames: ['', '', '', '', '', '', 'billing.fileInsurance.claimNo', 'billing.fileInsurance.invoiceNo', 'billing.payments.patient', 'billing.fileInsurance.claimDt', 'billing.payments.billFee', 'billing.payments.balance', 'setup.userSettings.cptCodes', 'setup.userSettings.accountNo', '', ''],
                    colModel: [
                        {
                            name: 'edit', width: 20, sortable: false, search: false,
                            className: 'icon-ic-edit',
                            formatter: function (e, model, data) {
                                return "<i class='icon-ic-edit' i18nt='shared.buttons.edit'></i>";
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
                                return "<i class='icon-ic-raw-transctipt' i18nt='billing.fileInsurance.claimInquiry'></i>"
                            },
                            customAction: function (rowID, e) {
                                var gridData = $('#tblpendPaymentsGridOnly').jqGrid('getRowData', rowID);
                                self.showClaimInquiry(gridData.claim_id, '', true);
                            }
                        },
                        { name: 'id', index: 'id', key: true, searchFlag: 'int', hidden: true },
                        { name: 'order_id', hidden: true },
                        { name: 'charge_id', hidden: true },
                        { name: 'claim_dt', hidden: true },
                        { name: 'claim_id', width: 150 },
                        { name: 'invoice_no', width: 150 },
                        { name: 'full_name', width: 250 },
                        { name: 'claim_date', width: 250, formatter: self.claimDateFormatter },
                        { name: 'billing_fee', width: 100 },
                        { name: 'balance', width: 100 },
                        { name: 'display_description', width: 300 },
                        { name: 'account_no', width: 150 },
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
                        //$("#gs_claim_id").focus()
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

            studyDateFormatter: function (cellvalue, options, rowObject) {
                var colValue;
                colValue = (commonjs.checkNotEmpty(rowObject.study_dt) ? commonjs.convertToFacilityTimeZone(rowObject.facility_id, rowObject.study_dt).format('L') : '');
                return colValue;
            },

            showPendingPaymentsGrid: function (paymentID, payerType, payerId, patientId, claimIdToSearch, invoiceNoToSearch,dblclickPat) {
                var self = this;
                self.claimID = claimIdToSearch;
                self.dblclickPat = dblclickPat || claimIdToSearch || invoiceNoToSearch;
                $("#divGrid_pendPayments").hide();
                if (!self.pendingGridLoaderd) {
                    this.pendPaymentTable = new customGrid();
                    this.pendPaymentTable.render({
                        gridelementid: '#tblpendPaymentsGrid',
                        custompager: this.pendPaymtPager,
                        emptyMessage: 'No Record found',
                        colNames: ['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
                        i18nNames: ['', '', '', '', '', '', 'billing.fileInsurance.claimNo', 'billing.fileInsurance.invoiceNo', 'billing.payments.patient', 'billing.fileInsurance.claimDt', 'billing.payments.billFee', 'billing.payments.balance', 'setup.userSettings.cptCodes', 'setup.userSettings.accountNo', '', ''],
                        colModel: [
                            {
                                name: 'edit', width: 20, sortable: false, search: false,
                                className: 'icon-ic-edit',
                                formatter: function (e, model, data) {
                                    return "<i class='icon-ic-edit' i18nt='shared.buttons.edit'></i>";
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
                                    return "<i class='icon-ic-raw-transctipt' i18nt='billing.fileInsurance.claimInquiry'></i>"
                                },
                                customAction: function (rowID, e) {
                                    var gridData = $('#tblpendPaymentsGrid').jqGrid('getRowData', rowID);
                                    self.showClaimInquiry(gridData.claim_id, '', true);
                                }
                            },
                            { name: 'id', index: 'id', key: true, hidden: true },
                            { name: 'order_id', hidden: true },
                            { name: 'charge_id', hidden: true },
                            { name: 'claim_dt', hidden: true },
                            { name: 'claim_id', width: 150 },
                            { name: 'invoice_no', width: 150 },
                            { name: 'full_name', width: 250 },
                            { name: 'claim_date', width: 250, formatter: self.claimDateFormatter },
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

                            if (self.claimID && gridObj.options && gridObj.options.customargs && gridObj.options.customargs.claimIdToSearch == self.claimID) {
                                self.order_payment_id = 0;
                                rowID = $('#tblpendPaymentsGrid').jqGrid('getDataIDs');
                                if (model && model.length) {
                                    if (rowID && rowID.length) {
                                        var gridData = $('#tblpendPaymentsGrid').jqGrid('getRowData', rowID[0]);
                                        self.showApplyAndCas(gridData.claim_id, paymentID || self.payment_id, 'pending', gridData.charge_id, gridData);
                                        self.claimID = "";
                                    }
                                } else {
                                    commonjs.showWarning('Invalid claim id ' + gridObj.options.customargs.claimIdToSearch);
                                }
                                $('#btnBackToPatient').click();
                                $('#claimId').focus();

                            } else {
                                $("#divGrid_pendPayments").show();
                            }

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
                    colNames: ['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
                    i18nNames: ['', '', '', '', '', 'billing.fileInsurance.claimNo', 'billing.fileInsurance.invoiceNo', 'billing.payments.patient', 'billing.fileInsurance.claimDt', 'billing.payments.billFee', 'billing.payments.patientPaid', 'billing.payments.payerPaid', 'billing.payments.adjustment', 'billing.payments.thisAdj', 'billing.payments.thisPayment', 'billing.payments.balance', 'billing.payments.cptCodes', 'patient_id', 'facility_id', ''],
                    colModel: [
                        {
                            name: 'edit', width: 20, sortable: false, search: false,
                            className: 'icon-ic-edit',
                            formatter: function (e, model, data) {
                                return "<i class='icon-ic-edit' i18nt='shared.buttons.edit'></i>";
                            },
                            customAction: function (rowID, e) {
                                var gridData = $('#tblAppliedPaymentsGrid').jqGrid('getRowData', rowID);
                                self.showApplyAndCas(gridData.claim_id, paymentID, 'applied', gridData.charge_id, gridData);
                            }
                        },
                        {
                            name: 'claim_inquiry', width: 20, sortable: false, search: false,
                            className: 'icon-ic-raw-transctipt',
                            formatter: function () {
                                return "<i class='icon-ic-raw-transctipt' i18nt='shared.screens.setup.claimInquiry'></i>"
                            },
                            customAction: function (rowID, e) {
                                var gridData = $('#tblAppliedPaymentsGrid').jqGrid('getRowData', rowID);
                                self.showClaimInquiry(gridData.claim_id, '', true);
                            }
                        },
                        { name: 'claim_id', index: 'id', key: true, hidden: true },
                        { name: 'charge_id', hidden: true },
                        { name: 'claim_dt', hidden: true },
                        { name: 'claim_id', width: 100 },
                        { name: 'invoice_no', width: 100 },
                        { name: 'full_name', width: 200 },
                        { name: 'claim_date', width: 150, formatter: self.claimDateFormatter },
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
                        self.showApplyAndCas(gridData.claim_id, paymentID, 'applied', gridData.charge_id, gridData);
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
                        if(self.saveClick){
                            $('#gbox_tblAppliedPaymentsGrid').find("#gs_claim_id").focus();
                        }

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

            showApplyAndCas: function (claimId, paymentID, paymentStatus, chargeId, rowData, callback) {
                var self = this;
                var paymentApplicationId = rowData.payment_application_id || null;
                self.defalutCASArray = [0, 1, 2, 3, 4, 5, 6];
                self.casSegmentsSelected = [];
                self.isFromClaim = rowData.isFromClaim || false;
                paymentID = self.payment_id || paymentID;
                var patient_paid = rowData.patient_paid ? self.formatMoneyValue(rowData.patient_paid) : '0.00';
                var others_paid = rowData.others_paid ? self.formatMoneyValue(rowData.others_paid) : '0.00';
                var claimDt = (commonjs.checkNotEmpty(rowData.claim_dt) ? commonjs.convertToFacilityTimeZone(rowData.facility_id, rowData.claim_dt).format('L') : '');
                var casDialogHeader = commonjs.geti18NString('billing.fileInsurance.claim') + ': # <strong>' + rowData.claim_id + ',  ' + rowData.full_name + '  ' + claimDt + '</strong>';
                var casDialogHtml = self.applyCasTemplate({
                    adjustmentCodes: self.adjustmentCodeList.toJSON(),
                    'claimStatusList': this.claimStatusList.toJSON(),
                    cas_group_codes: self.cas_group_codes || rowData.cas_group_codes,
                    cas_reason_codes: self.cas_reason_codes || rowData.cas_reason_codes,
                    patient_paid: patient_paid,
                    others_paid: others_paid,
                    claim_statuses: self.claimStatuses.toJSON()
                });
                var _showDialogObj = {
                    header: casDialogHeader,
                    width: rowData.isFromClaim ? '75%' : '85%',
                    height: rowData.isFromClaim ? '65%' : '72%',
                    html: casDialogHtml
                };

                if (rowData.isFromClaim) {
                    commonjs.showNestedDialog(_showDialogObj);
                    self.claimPaymentObj = rowData.newPaymentObj;
                    self.payment_id = paymentID;
                } else {
                    commonjs.showDialog(_showDialogObj);
                }

                $('#siteModal').removeAttr('tabindex');
                $('#divApplyPendingPayments').height($('#modal_div_container').height() - 340);
                $('#siteModal .close, #siteModal .btn-secondary').unbind().bind('click', function (e) {
                    // call appliedpending payment if not from claim screen
                    if (!self.isFromClaim) {
                        self.closeAppliedPendingPayments(e, paymentID);
                        $('#siteModal').hide();
                    }
                })

                commonjs.processPostRender();
                commonjs.validateControls();
                commonjs.isMaskValidate();

                $('#btnCloseAppliedPendingPayments,#btnCloseApplyPaymentPopup').off().click(function (e) {
                    $('#divPaymentApply').remove();
                    $('#siteModal').hide();
                });
                self.getClaimBasedCharges(claimId, paymentID, paymentStatus, chargeId, paymentApplicationId, true);
                // Hide some of edit-payment property if showDialog open via claim screen
                if (rowData.isFromClaim) {
                    $('#siteModalNested').removeAttr('tabindex'); //removed tabIndex attr on sitemodel for select2 search text area can't editable
                    $('#btnPayfullAppliedPendingPayments').hide();
                    $('#formBillingProviders .form-group').not('.divAdjustmentCodes').hide();
                    $('#siteModalNested .close, #siteModalNested .btn-secondary').off().click(function (e) {
                        // Send response to claim screen
                        if (typeof callback === 'function') {
                            callback(null, {
                                status: 'closed',
                                payment_id: self.payment_id || paymentID
                            });
                        }
                    });
                }
            },

            setFeeFields: function (claimDetail, isInitial) {
                if (isInitial) {
                    $('#ddlAdjustmentCode_fast').val('');
                    $('#txtResponsibleNotes').val('');
                }
                var order_info = claimDetail;
                $('#lblBalanceNew').text(order_info.balance ? order_info.balance : "0.00");
                $('#lblBillingFee, #spApplyTotalFee').text(order_info.billFee ? order_info.billFee : "0.00");
                $('#spAdjustmentApplied').text(order_info.adjustment ? order_info.adjustment : "0.00");
                $('#lblAdjustment').text(order_info.total_adjustment ? order_info.total_adjustment : "0.00");
                $('#spPaymentApplied').text(order_info.payment ? order_info.payment : "0.00");
                $('#lblOthers').text(order_info.others_paid ? order_info.others_paid : "0.00");
                $('#lblPatient').text(order_info.patient_paid ? order_info.patient_paid : "0.00");
            },

            getClaimBasedCharges: function (claimId, paymentId, paymentStatus, chargeId, paymentApplicationId, isInitialBind) {
                var self = this;
                var $ddlResponsible = $('#ddlResponsible');
                self.casSave = [];
                self.casDeleted = [];
                var responsibleObjArray = [{ id: '', text: 'Select' }];
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
                        $ddlResponsible.empty();
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
                        commonjs.isMaskValidate();
                        self.setFeeFields({}, true);

                        $('#ddlAdjustmentCode_fast').append($('<option/>', { value: '', text: 'Select' }));

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

                        $.each(payerTypes, function (index, payerObj) {

                            if (payerObj.patient_id) {
                                responsibleObjArray.push({
                                    id: payerObj.patient_id,
                                    text: payerObj.patient_name + '(Patient)',
                                    payer_type: 'patient',
                                    selected: payerObj.payer_type === 'patient'
                                });
                            }

                            if (payerObj.primary && payerObj.primary != 'null' && payerObj.primary_ins_provider_name != null) {
                                responsibleObjArray.push({
                                    id: payerObj.primary,
                                    text: payerObj.primary_ins_provider_name + '(' + payerObj.primary_ins_provider_code + ')(Primary Insurance)',
                                    payer_type: 'primary_insurance',
                                    selected: payerObj.payer_type === 'primary_insurance'
                                });
                            }

                            if (payerObj.secondary && payerObj.secondary != 'null' && payerObj.secondary_ins_provider_name != null) {
                                responsibleObjArray.push({
                                    id: payerObj.secondary,
                                    text: payerObj.secondary_ins_provider_name + '(' + payerObj.secondary_ins_provider_code + ')(Secondary Insurance)',
                                    payer_type: 'secondary_insurance',
                                    selected: payerObj.payer_type === 'secondary_insurance'
                                });
                            }

                            if (payerObj.tertiary && payerObj.tertiary != 'null' && payerObj.tertiary_ins_provider_name != null) {
                                responsibleObjArray.push({
                                    id: payerObj.tertiary,
                                    text: payerObj.tertiary_ins_provider_name + '(' + payerObj.tertiary_ins_provider_code + ')(Tertiary Insurance)',
                                    payer_type: 'tertiary_insurance',
                                    selected: payerObj.payer_type === 'tertiary_insurance'
                                });
                            }

                            if (payerObj.order_facility_id && payerObj.ordering_facility_name != null) {
                                responsibleObjArray.push({
                                    id: payerObj.order_facility_id,
                                    text: payerObj.ordering_facility_name + '(Ordering Facility)',
                                    payer_type: 'ordering_facility',
                                    selected: payerObj.payer_type === 'ordering_facility'
                                });
                            }

                            if (payerObj.referring_provider_contact_id && payerObj.provider_name != null) {
                                responsibleObjArray.push({
                                    id: payerObj.referring_provider_contact_id,
                                    text: payerObj.provider_name + '(Provider)',
                                    payer_type: 'referring_provider',
                                    selected: payerObj.payer_type === 'referring_provider'
                                });
                            }
                        });

                        self.currentResponsible = payerTypes && payerTypes.length ? payerTypes[0].payer_type : null;

                        $ddlResponsible.select2({
                            data: responsibleObjArray,
                            templateSelection: function (data) {
                                var isEdit = self.currentResponsible !== data.payer_type

                                $(data.element).attr({
                                    'data-payer_type': data.payer_type,
                                    selected: true,
                                    is_edit: isEdit
                                });

                                return data.text;
                            }
                        })
                        .on('select2:selecting', function (event) {
                            $(event.target).find('option').removeAttr('selected');
                            $(event.target).find('option').removeAttr('is_edit');
                        });

                        self.received_claim_status_id = payerTypes && payerTypes[0].claim_status_id
                        $('#ddlClaimStatus').val(self.received_claim_status_id);

                        $.each(charges, function (index, charge_details) {
                            if (charge_details.adjustment_code_id) {
                                $("#ddlAdjustmentCode_fast").val(charge_details.adjustment_code_id);
                                return false;
                            }
                            else {
                                $("#ddlAdjustmentCode_fast").val('');
                            }
                        });

                        $("#ddlAdjustmentCode_fast").select2({
                            width: '300px',
                            templateResult: formatRepo
                        });
                        function formatRepo(repo) {

                            if (repo.loading) {
                                return repo.text;
                            }
                            var _div = $('<div/>').append(repo.text);

                            if ($(repo.element).hasClass('recoupment_debit')) {
                                _div.addClass('recoupment_debit')
                            } else if ($(repo.element).hasClass('refund_debit')) {
                                _div.addClass('refund_debit')
                            }

                            return _div;
                        };


                        $('#tBodyApplyPendingPayment').find('.applyCAS').on('click', function (e) {
                            var selectedRow = $(e.target || e.srcElement).closest('tr');
                            var chargeId = selectedRow.attr('data_charge_id_id');
                            self.getPayemntApplications(e);
                        });

                        $('#applyPaymentContent').find('#btnSaveAppliedPendingPayments').off().click(_.debounce(function (e) {
                            // Call savePayment fun if payment status == 'pending status', This call only for payment creation via claim screen
                            if (self.isFromClaim && (paymentStatus === 'pending' && !paymentId || self.claimPaymentObj.isPaymentUpdate)) {
                                self.savePayment(e, claimId, paymentId, paymentStatus, paymentApplicationId);
                            } else {
                                self.saveAllPayments(e, claimId, paymentId, paymentStatus, chargeId, paymentApplicationId);
                            }
                        }, 250));

                        $('#btnClearAppliedPendingPayments').unbind().on('click', function (e) {
                            self.clearPayments(e, paymentId, claimId);
                        });

                        $('#btnPayfullAppliedPendingPayments').unbind().on('click', function (e) {
                            self.saveAllPayments(e, claimId, paymentId, paymentStatus, chargeId, paymentApplicationId);
                        });

                        self.reloadPaymentFields(claimId, paymentId, paymentApplicationId);

                        $('#txtResponsibleNotes').val(payerTypes[0].billing_notes);

                        var adjCodeType = $('#ddlAdjustmentCode_fast').find(':selected').attr('data_code_type');

                        if (adjCodeType === 'recoupment_debit' || adjCodeType === 'refund_debit') {

                            $('.checkDebit').prop('checked', true);
                            self.updateRefundRecoupment();
                            if (paymentStatus === 'applied' && adjCodeType === 'refund_debit') {
                                self.isRefundApplied = true;
                            }
                            else
                                self.isRefundApplied = false;
                        }
                        else {
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
                        else if (adjustment_codetype === 'recoupment_debit') {
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
                var self = this;
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

                $('#spPaymentApplied').text(self.formatMoneyValue(payment));
                $('#spAdjustmentApplied').text(self.formatMoneyValue(adjustment));

                var orderBillFee = self.formatMoneyValue($('#lblBillingFee').text(), true);
                var orderBalance = orderBillFee - (parseFloat(adjustment) + parseFloat(payment) + parseFloat(other_payment) + parseFloat(other_adj));
                var orderAdjustment = parseFloat(adjustment) + parseFloat(other_adj);

                $('#lblBalanceNew').text(self.formatMoneyValue(orderBalance));
                $('#lblAdjustment').text(self.formatMoneyValue(orderAdjustment));
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
                    var cas_id = '';
                    if (paymentStatus === 'applied') {
                        cas_id = $('#selectGroupCode' + k).attr('cas_id');
                    }

                    if (groupCode == '' && ($('#selectGroupCode' + k).attr('cas_id') != '' && $('#selectGroupCode' + k).attr('cas_id') > 0)) {
                        self.casDeleted.push($('#selectGroupCode' + k).attr('cas_id'));
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
                return { charge_id: charge_id, casObj: casObj };
            },

            getPayemntApplications: function (e) {
                var self = this;
                var chargeItem = $(e.target).closest('tr');
                var chargeId = chargeItem.attr('data_charge_id_id');
                var adjustmentApplicationId = chargeItem.attr('data_payment_adjustment_id');
                if (adjustmentApplicationId) {
                    $.ajax({
                        url: '/exa_modules/billing/pending_payments/payment_applications',
                        type: 'GET',
                        data: {
                            paymentApplicationId: adjustmentApplicationId
                        },
                        success: function (data, response) {
                            $('#divPaymentCAS select').removeAttr('cas_id');
                            var payemntCasApplns = data || self.casSegmentsSelected;
                            $.each(payemntCasApplns, function (index, appln) {
                                var rowVal = index + 1;
                                $('#selectGroupCode' + rowVal).val(appln.cas_group_code_id).attr('cas_id', appln.id);
                                $('#selectReason' + rowVal).val(appln.cas_reason_code_id);
                                var amount = appln.amount.indexOf('$') >= 0 ? self.formatMoneyValue(appln.amount, true) : appln.amount;
                                $('#txtAmount' + rowVal).val(amount);
                            });

                            $('#divPaymentCAS').attr('data-charge_id', chargeId).show();
                            commonjs.validateControls();
                            commonjs.isMaskValidate();
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
                            $('#selectGroupCode' + rowVal).val(appln.group_code_id).attr('cas_id', '');
                            $('#selectReason' + rowVal).val(appln.reason_code_id);
                            $('#txtAmount' + rowVal).val(parseFloat(appln.amount).toFixed(2));
                        });
                    }
                    $('#divPaymentCAS').attr('data-charge_id', chargeId).show();
                    commonjs.validateControls();
                    commonjs.isMaskValidate();
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
                var val = ['refund_debit', 'recoupment_debit']

                if ($('#ddlResponsible').val() === '') {
                    commonjs.showWarning('shared.warning.missingResponsible');
                    $('#ddlResponsible').select2('open')
                    return false;
                }
                else if ($('#ddlAdjustmentCode_fast').val() === '0') {
                    commonjs.showWarning('messages.warning.payments.pleaseSelectAdjustment');
                    return false;
                } else if (isDebit && val.indexOf(adjustment_codetype) < 0) {
                    commonjs.showWarning('messages.warning.payments.pleaseSelectRefAdjCode');
                    return false;
                } else if (!isDebit && val.indexOf(adjustment_codetype) >= 0) {
                    commonjs.showWarning('messages.warning.payments.pleaseSelectDRCheckBox');
                    return false;
                } else if (self.isRefundApplied === true) {
                    if ($('#ddlAdjustmentCode_fast').val() && $('#ddlAdjustmentCode_fast').find(':selected').attr('data_code_type') != 'refund_debit') {
                        var refund_change_confirm = confirm(commonjs.geti18NString("messages.confirm.payments.overwriteRefundAreYouSure"));
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
                } else if (isDebit && adjustment_codetype === 'refund_debit') {
                    var lineItems = $("#tBodyApplyPendingPayment tr");
                    var adjustment_has_value = 0;
                    $.each(lineItems, function () {
                        thisAdjustment = $(this).find('td:nth-child(8)>input').val();
                        if (parseFloat(thisAdjustment) != 0.00) {
                            adjustment_has_value = adjustment_has_value + 1;
                        }
                    });
                    if (adjustment_has_value === 0) {
                        commonjs.showWarning('messages.warning.payments.enterRefundAmount');
                        adjustment_has_value = 0;
                        return false;
                    }
                    else return true;
                }
                else return true;
            },

            saveAllPayments: function (e, claimId, paymentId, paymentStatus, chargeId, paymentApplicationId) {
                var targetObj = $(e.target);
                var objIsPayInFull = targetObj.is('#btnPayfullAppliedPendingPayments');
                var isClaimDenied = false;
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
                        var all_adjustment = $(this).find('td:nth-child(7)').text() ? $(this).find('td:nth-child(7)').text() : 0.00;
                        var this_adjustment = $(this).find('td:nth-child(8)>input').val() ? $(this).find('td:nth-child(8)>input').val() : 0.00;
                        var balance = parseFloat(bill_fee) - (parseFloat(all_payment) + parseFloat(all_adjustment) + parseFloat(this_pay) + parseFloat(this_adjustment)).toFixed(2);

                        _line_item["charge_id"] = chargeRow.attr('data_charge_id_id');
                        _line_item["paymentApplicationId"] = chargeRow.attr('data_payment_application_id');
                        _line_item["adjustmentApplicationId"] = chargeRow.attr('data_payment_adjustment_id');
                        _line_item["paymentAppliedDt"] = chargeRow.attr('data_payment_applied_dt');
                        _line_item["payment"] = objIsPayInFull ? balance + parseFloat(this_pay) : parseFloat(this_pay);
                        _line_item["adjustment"] = chargeRow.find('td:nth-child(8)>input').val() ? parseFloat(chargeRow.find('td:nth-child(8)>input').val()) : 0.00;

                        var _cas = cas.filter(function (obj) {
                            return obj.charge_id == chargeRow.attr('data_charge_id_id')
                        })

                        _line_item["cas_details"] = _cas && _cas.length ? _cas[0].casObj : [];
                        line_items.push(_line_item);
                    });

                    /**
                    *  Condition : Payment==0, adjustment ==0
                    *  DESC : Check payment & adjustment amount is zero, Set claim status Denied
                    */
                    var totalPayment = _.reduce(line_items,function(m,x) { return m + x.payment; }, 0);
                    var totalAdjustment = _.reduce(line_items,function(m,x) { return m + x.adjustment; }, 0);

                    if (totalPayment === 0 && totalAdjustment === 0) {
                        $('#ddlClaimStatus').val($("option[data-desc = 'D']").val());
                        isClaimDenied = true;
                    }

                    var payerType = $('#ddlResponsible').find(':selected').attr('data-payer_type');
                    var isPayerChanged = $('#ddlResponsible').find(':selected').attr('is_edit');
                    var adjustmentType = $('#ddlAdjustmentCode_fast').val() || null;
                    var billingNotes = $('#txtResponsibleNotes').val();
                    var deduction = $('#txtDeduction').val();
                    var coInsurance = $('#txtCoInsurance').val();
                    var coPay = $('#txtCoPay').val();
                    var claimStatusID = self.received_claim_status_id != $('#ddlClaimStatus').val() ? $('#ddlClaimStatus').val()
                        : isClaimDenied ? $('#ddlClaimStatus').val() : 0;

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
                            paymentStatus: paymentStatus,
                            casDeleted: JSON.stringify(self.casDeleted),
                            claimStatusID: claimStatusID,
                            is_payerChanged: isPayerChanged,
                            is_claimDenied: isClaimDenied,
                            isFromClaim: self.isFromClaim
                        },
                        success: function (model, response) {
                            var msg = self.isFromClaim ? commonjs.geti18NString('messages.status.tosSuccessfullyCompleted') :
                                paymentStatus === 'applied' ? commonjs.geti18NString('messages.status.paymentUpdatedSuccessfully') : commonjs.geti18NString('messages.status.paymentAppliedSuccessfully');

                            commonjs.showStatus(msg);
                            targetObj.removeAttr('disabled');
                            commonjs.hideLoading();
                            self.isRefundApplied = false;
                            self.casDeleted = [];
                            self.casSegmentsSelected = [];
                            $('#txtDeduction').val("0.00");
                            $('#txtCoInsurance').val("0.00");
                            $('#txtCoPay').val("0.00");
                            paymentStatus != 'applied' ? paymentApplicationId = model[0].details.create_payment_applications.payment_application_id : paymentApplicationId;
                            self.paymentApplicationId = paymentApplicationId;
                            self.getClaimBasedCharges(claimId, paymentId, 'applied', chargeId, paymentApplicationId, false);
                            $('.modal-footer button').focus();
                        },
                        error: function (err, response) {
                            targetObj.removeAttr('disabled');
                            commonjs.handleXhrError(err, response);
                        }
                    });
                }
            },

            reloadPaymentFields: function (claimId, paymentId, paymentApplicationId) {
                var self = this;
                jQuery.ajax({
                    url: "/exa_modules/billing/pending_payments/fee_details",
                    type: "GET",
                    data: {
                        claimId: claimId,
                        paymentId: paymentId,
                        paymentApplicationId: paymentApplicationId
                    },
                    success: function (data, textStatus, jqXHR) {
                        if (data) {
                            var feeDetails = data[0];
                            self.total_Adjustment = feeDetails.adjustment || 0;
                            self.total_Payment = feeDetails.payment || 0;
                            self.setFeeFields({ billFee: feeDetails.bill_fee, adjustment: feeDetails.adjustment, balance: feeDetails.balance, others_paid: feeDetails.others_paid, patient_paid: feeDetails.patient_paid, payment: feeDetails.payment, total_adjustment: feeDetails.total_adjustment });
                        }
                        commonjs.hideLoading();
                    },
                    error: function (err) {
                        commonjs.handleXhrError(err);
                    }
                });
            },

            addNewPayemnt: function () {
                this.clearPayerFields();
                if (this.from === 'ris')
                    Backbone.history.navigate('#billing/payments/new/ris', true);
                else
                    Backbone.history.navigate('#billing/payments/new', true);
            },

            clearPayerFields: function () {
                this.patient_id = this.provider_id = this.provider_group_id = this.insurance_provider_id = null;
            },
               
            goBackToPayments: function () {
                if (this.from === 'ris')
                    Backbone.history.navigate('#billing/payments/filter/ris', true);
                else
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
                        commonjs.showLoading('messages.loadingMsg.searching');
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

            searchProvider: function (e) {
                commonjs.showDialog({
                    header: 'Providers',
                    i18nHeader: 'billing.payments.providers',
                    width: '75%',
                    height: '80%',
                    needShrink: true,
                    url: '/vieworder#setup/provider/all/familyHistory',
                    onLoad: 'commonjs.removeIframeHeader()'
                });
            },

            searchOrderingFac: function (e) {
                commonjs.showDialog({
                    header: 'Ordering Facility',
                    i18nHeader: 'billing.payments.orderingFacility',
                    width: '75%',
                    height: '80%',
                    needShrink: true,
                    url: '/vieworder#setup/orderingFacility/all/familyHistory',
                    onLoad: 'commonjs.removeIframeHeader()'
                });
            },

            searchInsurance: function (e) {
                commonjs.showDialog({
                    header: 'Insurance Provider',
                    i18nHeader: 'billing.payments.insuranceProvider',
                    width: '75%',
                    height: '70%',
                    needShrink: true,
                    url: '/vieworder#setup/insuranceProvider/all/familyHistory',
                    onLoad: 'commonjs.removeIframeHeader()'
                });
            },

            searchPatient: function (e) {
                commonjs.showDialog({
                    header: 'Patient',
                    i18nHeader: 'billing.payments.patient',
                    width: '75%',
                    height: '80%',
                    url: '/vieworder#patient/search/all/payments'
                });
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
                this.showPatientForm(patientId, patient_name, account_no,true);
            },

            showPatientForm: function (patientId, patient_name, account_no,dblclickPat) {
                var self = this;
                var msg =  commonjs.geti18NString("shared.fields.pendingPaymentsForThePatient");
                $('#commonMsg').text(msg)
                $('#spnPatInfo').text(patient_name + ' (' + account_no + ') ');
                this.showPendingPaymentsGrid(this.payment_id, this.payer_type, this.payer_id, patientId, 0, '', dblclickPat);
            },

            validateClaimId: function () {
                if ($('#claimId').val() == '') {
                    commonjs.showWarning('messages.warning.claims.pleaseEnterClaimIDToSearch');
                }
                else
                    return true;
            },

            validateInvoice: function () {
                if ($('#invoiceNo').val() == '') {
                    commonjs.showWarning('messages.warning.claims.pleaseEnterInvoiceToSearch');
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
                            var msg =  commonjs.geti18NString("shared.fields.pendingPaymentsForClaim");
                            $('#commonMsg').text(msg);
                            $('#spnPatInfo').text(self.claimIdToSearch);
                            self.showPendingPaymentsGrid(this.payment_id, this.payer_type, this.payer_id, 0, self.claimIdToSearch, '');
                        }
                    }
                    else if ($(e.target).is('#invoiceNo')) {
                        if (self.validateInvoice()) {
                            var msg =  commonjs.geti18NString("shared.fields.pendingPaymentsForInvoice");
                            $('#commonMsg').text(msg);
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
                        var msg =  commonjs.geti18NString("shared.fields.pendingPaymentsForClaim");
                        $('#commonMsg').text(msg)
                        $('#spnPatInfo').text(self.claimIdToSearch);
                        self.showPendingPaymentsGrid(this.payment_id, this.payer_type, this.payer_id, 0, self.claimIdToSearch, '');
                    }
                }
                else if ($(e.target).is('#anc_search')) {
                    if (self.validateInvoice()) {
                        var msg =  commonjs.geti18NString("shared.fields.pendingPaymentsForInvoice");
                        $('#commonMsg').text(msg)
                        $('#spnPatInfo').text(self.invoiceNoToSearch);
                        self.showPendingPaymentsGrid(this.payment_id, this.payer_type, this.payer_id, 0, '', self.invoiceNoToSearch);
                    }
                }
            },

            backToPatient: function (e) {
                $('#btnBackToPatient').hide();
                $('#diVPatient').show();

                if($('#chkIpEob').is(":checked")){
                    $("#claimId").focus();
                }else if($('#chkIpInvoice').is(":checked")){
                    $("#invoiceNo").focus();
                }else{
                    $("#lname").focus();
                }

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
                        $("#txtCardName").attr("disabled", "disabled");
                        $("#paymentExpiryMonth").attr("disabled", "disabled");
                        $("#paymentExpiryYear").attr("disabled", "disabled");
                        $("#ddlCardType").attr("disabled", "disabled");
                        $("#txtCVN").attr("disabled", "disabled");
                        break;
                    case "card":
                    case "adjustment":
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
                    return confirm(commonjs.geti18NString("messages.status.areYouSureToDeleteThisPayment"));
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
                            commonjs.showStatus('messages.status.paymentDeleteSuccessfully');
                            if (self.from === 'ris')
                                Backbone.history.navigate('#billing/payments/filter/ris', true);
                            else
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

                if (self.from === 'ris') {
                    var studyIds = [];
                    for (var i = 0; i < $("#tblStudyCpt").find('input[name=chkStudyCpt]:checked').length; i++) {
                        var rowId = $("#tblStudyCpt").find('input[name=chkStudyCpt]:checked')[i].parentNode.parentNode.id;
                        studyIds.push(rowId);
                    }

                    if (studyIds && studyIds.length == 0) {
                        commonjs.showWarning("messages.warning.claims.pleaseSelectStudyCPT");
                        return false;
                    }
                    else {
                        self.paymentEditPDF = new paymentEditPDF({ el: $('#modal_div_container') });
                        var paymentPDFArgs = {
                            studyIds: studyIds,
                            flag: 'RISPrintReceipt',
                            patient_id: self.patient_id,
                            payment_id: self.payment_id
                        }
                        self.paymentEditPDF.onReportViewClick(e, paymentPDFArgs);
                    }
                }
                else {
                    self.paymentEditPDF = new paymentEditPDF({ el: $('#modal_div_container') });
                    var paymentEditPDFArgs = {
                        payment_id: this.payment_id,
                        patient_id: self.patient_id,
                        flag: 'payment-print-pdf'
                    }
                    self.paymentEditPDF.onReportViewClick(e, paymentEditPDFArgs);
                }
            },

            disableSelectedReasonCode: function (e) {
                var idParent = $(e.target).attr("id");
                $('.col2 option').removeAttr("disabled");
                var reasonSelected = $(e.target).val();
                $('.col2 option[value="' + reasonSelected + '"]').prop("disabled", true);
            },

            checkAllPendingPayments: function () {
                var self = this;
                var paymentAmt = $('#lblBalance').text() != '' ? self.formatMoneyValue($('#lblBalance').text()) : 0.00;
                var payer = $('#selectPayerType :selected').val();
                if ($('#selectPayerType').val() === '0') {
                    commonjs.showWarning("messages.warning.claims.pleaseSelectPayerType");
                    $('#selectPayerType').focus();
                    return false;
                }
                if (!self.validatePayer($('#selectPayerType').val())) {
                    return false;
                }
                if (!self.payer_id) {
                    commonjs.showWarning("messages.warning.claims.payerIDNotSettedProperly");
                    return false;
                }
                if ($('#txtInvoice').val() == '' && payer != 'patient') {
                    commonjs.showWarning("messages.warning.claims.pleaseUpdateInvoice");
                    return false;
                }
                if (paymentAmt == 0) {
                    commonjs.showWarning("messages.warning.claims.minimumBalanceRequiredToProcessInvoicePayment");
                    return false;
                }

                $.ajax({
                    url: '/exa_modules/billing/payments/invoice_details',
                    type: 'GET',
                    data: {
                        paymentId: self.payment_id,
                        invoice_no: $('#txtInvoice').val() || 0,
                        payer_type: payer,
                        payer_id: self.payer_id
                    },
                    success: function (data, response) {
                        if (data && data.length) {
                            var total_claims = data[0].total_claims || 0;
                            var valid_claims = data[0].valid_claims || 0;
                            var msg;

                            if (total_claims == valid_claims && (total_claims != 0 && valid_claims != 0)) {
                                msg = 'Overall (' + valid_claims + ') pending claims. Are you sure to process?';
                            }
                            else if (total_claims != 0 && valid_claims != 0) {
                                msg = 'Valid claim count is (' + valid_claims + ') from overall (' + total_claims + ') pending claims. Are you sure to process?';
                            } else if (total_claims != 0 && valid_claims == 0) {
                                commonjs.showWarning('messages.status.noValidClaimsToProcess');
                                return false;
                            }
                            else if (total_claims == 0) {
                                commonjs.showWarning('messages.status.noValidClaimsToProcessPayment');
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
                            commonjs.showStatus('messages.status.allPaymentHasBeenAppliedSuccessfully');
                            self.getAppliedBalance(self.payment_id);
                            $('#btnPaymentPendingRefresh').click();
                            $('#btnAppliedPayRefresh').click();
                        }
                    },
                    error: function (err, response) {
                        commonjs.handleXhrError(err, response);
                    }
                });

            },

            showClaimInquiry: function (id, patient_id, from) {
                self.claimInquiryView = new claimInquiryView({ el: $('#modal_div_container') });
                self.claimInquiryView.render({
                    'claim_id': id,
                    'patient_id': patient_id,
                    'source': 'payments'
                });
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
                            $('#lblApplied').html(self.formatMoneyValue(data[0].applied));
                            $('#lblBalance').html(self.formatMoneyValue(data[0].balance));
                            if (data[0].applied && parseFloat(data[0].applied.replace('$', '')) > 0) {
                                self.canDeletePayment = false;
                                $("#selectPayerType").prop("disabled", true);
                            }
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
