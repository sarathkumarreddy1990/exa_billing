define([
    'jquery',
    'underscore',
    'backbone',
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
    'collections/app/studycpt-list',
    'shared/trackFormChanges',
    'text!templates/app/addtional-cas.html',
    'views/reports/patient-statement',
    'shared/claim-alerts'
], function (
        jQuery,
        _,
        Backbone,
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
        studycptCollection,
        trackFormChanges,
        AdditionCASTemplate,
        PatientStatementView,
        claimAlertsView
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
            pendingGridLoaderd: false,
            isRefundApplied: false,
            casDeleted: [],
            saveClick: false,
            paymentDateObj: null,
            isEscKeyPress: false,
            eobFileId: null,
            ediFileId: null,
            claimId: null,
            mailTo: '',
            defaultCASField: 7,
            patientId: null,
            additionCASFormTemplate: _.template(AdditionCASTemplate),

            events: {
                'click #btnPaymentSave': 'savePayment',
                'click #btnApplyCAS': 'getPayemntApplications',
                'change #selectPayerType': 'setPayerFields',
                'change .inputType': 'setInputTypeFields',
                'click #btnPaymentAddNew': 'addNewPayemnt',
                'click #btnPaymentBack': 'goBackToPayments',
                'click #btnPaymentClear': 'clearPaymentForm',
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
                'click #btnPaymentDelete': 'validatePaymentDelete',
                'click #btnPaymentPrint': 'paymentPrintPDF',
                'click #btnPrintReceipt': 'paymentPrintReceiptPDF',
                'click #btnPaymentPendingRefreshOnly': 'refreshInvociePendingPayment',
                'click #btnPaymentApplyAll': 'checkAllPendingPayments',
                'keypress #claimId, #invoiceNo': 'searchInvoiceOrClaim',
                'click .nextPrevPayment': 'nextPrevPayment',
                "keyup .search-payer": "searchPayer",
                "click #btnClearPatSearch": "resetPatSearch",
                "click #eobPreviewPayment img": "showPDF",
                "click .btnEobPaymentUpload": "uploadPDF",
                "click #btnReloadEOB": "reloadEobPDF",
                "click #btnPaymentDocument": "showPatientDocuments"
            },

            usermessage: {
                selectCarrier: commonjs.geti18NString("billing.payments.searchCarrier"),
                selectPatient: commonjs.geti18NString("billing.payments.searchPatient"),
                selectOrderingFacility: commonjs.geti18NString("billing.payments.searchOrderingFacility"),
                selectProvider: commonjs.geti18NString("billing.payments.searchProvider")
            },

            initialize: function (options) {
                this.options = options;
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
                this.paidlocation = new modelCollection(commonjs.getActiveFacilities());
                this.facilityAdd = new modelCollection(commonjs.bindArray([app.facilities], true, true, false));
                var adjustment_codes = jQuery.grep(app.adjustmentCodes, function (obj) {
                    return (obj.type == "ADJCDE" || obj.type == "REFADJ");
                });
                var claim_status = jQuery.grep(app.adjustmentCodes, function (obj) {
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
                console.log('render payment-edit!');

                var self = this;
                self.from = from;
                self.payment_id = paymentId || 0;
                self.paymentDateObj = null;
                commonjs.showLoading();
                self.defalutCASArray = [0, 1, 2, 3, 4, 5, 6];
                self.claimId = this.options.claim_id;

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
                $(this.el).html(this.paymentsEditTemplate({
                    country_alpha_3_code: app.country_alpha_3_code,
                    province_alpha_2_code: app.province_alpha_2_code,
                    expiryYear: expiryYear,
                    expiryMonth: expiryMonth,
                    paidlocation: this.paidlocation.toJSON(),
                    facilityAdd: this.paidlocation.toJSON(),
                    paymentReasons: this.paymentReasons.toJSON(),
                    id: self.payemntId
                }));
                this.rendered = true;
                this.pendingGridLoaderd = false;
                self.showBillingForm(paymentId, self.from);

                if (self.from !== 'ris')
                    self.showPaymentsGrid(paymentId);

                if (!self.payment_id) {
                    commonjs.processPostRender();
                }
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
                var changeAccountingDates = app.userInfo.user_settings && app.userInfo.user_settings.userCanChangeAccountingDates;
                if (!changeAccountingDates || changeAccountingDates === 'false') {
                    $("#txtAccountingDate").prop('disabled', true);
                    $("#divAccountingDate span").off().on('click', function(){
                        commonjs.showWarning('messages.errors.accessdenied');
                    });
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
                self.clearPaymentForm(from);
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
                    $('#btnPaymentPrev').hide();
                    $('#btnPaymentNext').hide();
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
            },

            showPatientDocuments: function () {
                if (!this.patient_id) {
                    commonjs.showWarning('messages.warning.noPatient');
                    return;
                }

                window.open('/vieworder#patient/document/' + btoa(this.patient_id) + '/payment');
            },

            clearPaymentForm: function () {
                var facility = this.paidlocation.get(app.facilityID);

                if (!facility) {
                    facility = this.paidlocation.at(0);
                }
                this.payer_id = 0;
                $('#PaymentForm input[type=radio]').prop('ckecked', false);
                $('#ddlpaymentReason').val('');
                $('#ddlPaidLocation').val(facility.id);
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

                $('#chkIpInvoice').prop('checked', false);
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

            setPayerFields: function () {
                this.payer_id = 0;
                var val = $('#selectPayerType').val();
                $('.payerFields').hide();
                $('#divInputType span').show();
                $('#btnPaymentDocument').hide();
                this.clearPayerFields();
                if (val === 'insurance') {
                    var $payerInsurance = $('#txtautoPayerPIP');
                    $('#select2-txtautoPayerPIP-container').html(commonjs.geti18NString('billing.payments.selectInsurance'));
                    $('#divPayerInsurnace').show();
                    if ($payerInsurance.length) { // clear selected insurance when switching Payer type
                        $payerInsurance.find('option').remove();
                        this.setInsuranceAutoComplete();
                    }
                    $('#lblIpEob').show();
                    $('#chkIpEob').prop('checked', true);
                    $('#lblInputType').text('Input Type');
                }
                else if (val === 'patient') {
                    var $payerPatient = $('#txtautoPayerPP');
                    $('#select2-txtautoPayerPP-container').html(commonjs.geti18NString('billing.payments.selectPatient'));
                    $('#divPayerPatient').show();
                    if ($payerPatient.length) { // clear selected patient when switching Payer type
                        $payerPatient.find('option').remove();
                        this.setPatientAutoComplete();
                    }

                    $('#chkIpInvoice').prop('checked', false);
                    $('#txtInvoice').val('');
                    $('#lblIpEob').hide();
                    $('#divInputType span').hide();
                    $('#txtInvoice').hide();
                    $('#lblInputType').text('');
                    $('#searchPayer #mrn').val('');
                    $('#searchPayer #lname').val('');
                    $('#searchPayer #fname').val('');
                    $('#searchPayer #dob').val('');
                    $('#btnPaymentDocument').show();
                }
                else if (val === 'ordering_facility') {
                    var $payerOrdFacility = $('#txtautoPayerPOF');
                    $('#select2-txtautoPayerPOF-container').html(commonjs.geti18NString('billing.payments.selectOrderingFacility'));
                    $('#divPayerOrderFacility').show();
                    if ($payerOrdFacility.length) { // clear selected ordering facility when switching Payer type
                        $payerOrdFacility.find('option').remove();
                        this.setOFAutoComplete();
                    }

                    $('#lblIpEob').hide();
                    $('#lblInputType').text('Input Type');
                }
                else if (val === 'ordering_provider') {
                    var $payerOrdProvider = $('#txtautoPayerPR');
                    $('#select2-txtautoPayerPR-container').html(commonjs.geti18NString('billing.payments.selectProvider'));
                    $('#divPayerProvider').show();
                    if ($payerOrdProvider.length) { // clear selected ordering provider when switching Payer type
                        $payerOrdProvider.find('option').remove();
                        this.setProviderAutoComplete();
                    }

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
                $txtautoPayerPIP.on('select2:open', function () {
                    commonjs.getPlaceHolderForSearch();
                    placeHolder = i18n.get("billing.payments.selectInsurance");
                    if ($select2Container && $select2Container.text().toLowerCase() != placeHolder.toLowerCase()
                        && $select2Container.text().toLowerCase() != 'select insurance')
                        $txtautoPayerPIP.data('select2').dropdown.$search.val($select2Container.text());
                });
            },

            // TODO: lots of undefined vars in this function, so it probably doesn't work. Is it fine to delete this?
            /* eslint-disable no-undef */
            saveInsuranceProviderGrid: function () {
                if (insuranceArray && insuranceArray.length > 0 && insuranceArray[0].insurance_name) {
                    this.payer_id = parseInt(insuranceArray[0].insurance_id) || 0;
                    this.insurance_provider_id = insuranceArray[0].insurance_id;
                    this.payerCode = insuranceArray[0].insurance_code ? insuranceArray[0].insurance_code : '';
                    this.payerName = insuranceArray[0].insurance_name;
                    this.payerType = 'insurance';
                    coverage_level = 'Primary Insurance';
                    $("#hdnPayerID").val(insuranceArray[0].insurance_id);
                    $('#select2-txtautoPayerPIP-container').html(insuranceArray[0].insurance_name || '');
                } else {
                    $("#lblAutoInsurance").html('');
                    $('#select2-txtautoPayerPIP-container').html(this.usermessage.selectCarrier);
                }
                $('#siteModal').modal('hide');
            },
            /* eslint-enable no-undef */

            // TODO: lots of undefined vars in this function, so it probably doesn't work. Is it fine to delete this?
            /* eslint-disable no-undef */
            saveProviderGrid: function () {
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
            /* eslint-enable no-undef */

            // TODO: lots of undefined vars in this function, so it probably doesn't work. Is it fine to delete this?
            /* eslint-disable no-undef */
            savePatientGrid: function () {
                if (patientArray && patientArray.length > 0 && patientArray[0].patient_name) {
                    this.payer_id = parseInt(patientArray[0].patient_id) || 0;
                    this.patient_id = this.payer_id;
                    this.payerCode = '';
                    this.payerName = patientArray[0].patient_name;
                    this.payerType = 'patient';
                    coverage_level = 'Patient';
                    $("#hdnPayerID").val(patientArray[0].patient_id);
                    $('#select2-txtautoPayerPP-container').html(patientArray[0].patient_name);
                    $('#searchPayer #mrn').val(patientArray[0].account_no || '');
                    $('#searchPayer #lname').val(patientArray[0].last_name || '');
                    $('#searchPayer #fname').val(patientArray[0].first_name || '');
                    $('#searchPayer #dob').val(moment(patientArray[0].dob).format('L') || '');
                } else {
                    $('#searchPayer #mrn').val("");
                    $('#searchPayer #lname').val("");
                    $('#searchPayer #fname').val("");
                    $('#searchPayer #dob').val("");
                    $('#select2-txtautoPayerPP-container').html(this.usermessage.selectPatient);
                }
                $('#siteModal').modal('hide');
            },
            /* eslint-enable no-undef */

            // TODO: lots of undefined vars in this function, so it probably doesn't work. Is it fine to delete this?
            /* eslint-disable no-undef */
            saveOFGrid: function () {
                var $txtautoPayerPOF = $('#select2-txtautoPayerPOF-container');
                var data = orderingFacilityArray || {};
                var orderingFacilityId = ~~data.ordering_facility_id;
                var orderingFacilityName = data.ordering_facility_name || "";
                var orderingFacilityCode = data.ordering_facility_code  || "";

                if (orderingFacilityName) {
                    this.payer_id = orderingFacilityId;
                    this.ordering_facility_id = this.payer_id;
                    this.payerCode = orderingFacilityCode;
                    this.payerName = orderingFacilityName;
                    this.payerType = 'ordering_facility';
                    coverage_level = 'Ordering Facility';
                    $("#hdnPayerID").val(orderingFacilityId);
                    $txtautoPayerPOF.html(orderingFacilityName);
                }
                else {
                    $txtautoPayerPOF.html(this.usermessage.selectOrderingFacility);
                }

                $('#siteModal').modal('hide');
            },
            /* eslint-enable no-undef */

            bindInsuranceDetails: function (res) {
                var self = this;
                self.payer_id = res.id;
                self.insurance_provider_id = res.id;
                self.payerCode = res.insurance_code;
                self.payerName = res.insurance_name;
                self.payerType = 'insurance';
            },

            setPatientAutoComplete: function () {
                var self = this;
                var $txtautoPayerPP = $("#txtautoPayerPP");
                var $select2Container = $('#select2-txtautoPayerPP-container');
                var placeHolder = i18n.get("billing.payments.selectPatient");
                $txtautoPayerPP.select2({
                    ajax: {
                        url: "/exa_modules/billing/pending_payments/patient_search",
                        dataType: 'json',
                        delay: 100,
                        data: function (params) {
                            return {
                                fromPTSL: true,
                                combined: true,
                                pageNo: params.page || 1,
                                pageSize: 10,
                                fields: self.getPayerSearchFields(),
                                showInactive: true,
                                showOwner: false,
                                sortField: "patients.last_name",
                                company_id: app.companyID,
                                sortOrder: "ASC",
                                facility_id: -1,
                                type: "start"
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
                    templateSelection: formatRepoSelection,
                    minimumResultsForSearch: Infinity,
                    open: function () {
                        $('.select2-search input').prop('focus', false);
                    }
                });
                function formatRepo(repo) {
                    if (repo.loading) {
                        return repo.text;
                    }
                    var patientList = $('<table/>');
                    patientList.append(
                        $('<tr/>').addClass('row').attr({ title: repo.full_name + "(" + repo.account_no + ")" })
                            .append($('<td/>').addClass('col-12').append($('<div/>')).text(repo.full_name + "(" + repo.account_no + ")"))
                            .append($('<td/>').addClass('col-12').append($('<div/>')).text(commonjs.getDateFormat(repo.birth_date)))
                    );
                    return patientList;
                }
                function formatRepoSelection(res) {
                    if (res && res.id) {
                        self.bindPatientDetails(res);
                    }
                    $('#searchPayer #mrn').val(res.account_no);
                    $('#searchPayer #lname').val(res.last_name);
                    $('#searchPayer #fname').val(res.first_name);
                    $('#searchPayer #dob').val(moment(res.birth_date).format('L'));

                    return res.full_name;
                }
                $select2Container = $('#select2-txtautoPayerPP-container');
                $select2Container.html(placeHolder);
            },

            resetPatSearch: function () {

                if (!this.payment_id) {
                    this.payer_id = 0;
                }
                $('#searchPayer #mrn').val('');
                $('#searchPayer #lname').val('');
                $('#searchPayer #fname').val('');
                $('#searchPayer #dob').val('');
                $('#select2-txtautoPayerPP-container').html(commonjs.geti18NString('billing.payments.selectPatient'));
                $('#txtautoPayerPP').select2("open");
            },

            setOFAutoComplete: function () {
                var self = this;
                var $txtautoPayerPOF = $("#txtautoPayerPOF");
                var $select2Container = $('#select2-txtautoPayerPOF-container');
                var placeHolder = i18n.get("billing.payments.selectOrderingFacility");
                $('#s2id_txtautoPayerPOF a span').html('Select ordering facility');
                $txtautoPayerPOF.select2({
                    ajax: {
                        url: "/exa_modules/billing/autoCompleteRouter/ordering_facilities",
                        dataType: 'json',
                        delay: 250,
                        data: function (params) {
                            if (params.term === undefined && $select2Container.text().toLowerCase() != placeHolder.toLowerCase())
                                params.term = $select2Container.text();
                            return {
                                page: params.page || 1,
                                q: params.term || '',
                                pageSize: 10,
                                sortField: "ordering_facility_name",
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
                    markup += "<td title='" + repo.ordering_facility_name + "(" + repo.ordering_facility_code + ")'> <div>" + repo.ordering_facility_name + "(" + repo.ordering_facility_code + ")" + "</div>";
                    markup += "</td></tr></table>";
                    return markup;

                }
                function formatRepoSelection(res) {
                    if (res && res.id)
                        self.bindOfDetails(res);
                    return res.ordering_facility_name;
                }
                $select2Container = $('#select2-txtautoPayerPOF-container');
                $select2Container.html(placeHolder);
                $txtautoPayerPOF.on('select2:open', function () {
                    commonjs.getPlaceHolderForSearch();
                    placeHolder = i18n.get("billing.payments.selectOrderingFacility");
                    if ($select2Container && $select2Container.text().toLowerCase() != placeHolder.toLowerCase()
                        && $select2Container.text().toLowerCase() != 'select ordering facility')
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

                        var markup = "<table class='ref-result' style='width: 100%'><tr>";
                        markup += "<td><div><b>" + repo.full_name + "</b><b>" + '(' + repo.provider_code + ')' + "</b></div>";
                        markup += "<div>" + provContactInfo._addressInfo + "</div>";
                        markup += "<div>" + provContactInfo._cityStateZip + "</div>";
                        markup += "</td></tr></table>"
                        return markup;

                }
                function formatRepoSelection(res) {
                    if (res && res.id)
                        self.bindProviderDetails(res);
                    return res.full_name;
                }
                $select2Container = $('#select2-txtautoPayerPR-container');
                $select2Container.html(placeHolder);
                $txtautoPayerPR.on('select2:open', function () {
                    commonjs.getPlaceHolderForSearch();
                    placeHolder = i18n.get("billing.payments.selectProvider");
                    if ($select2Container && $select2Container.text().toLowerCase() != placeHolder.toLowerCase()
                        && $select2Container.text().toLowerCase() != 'select provider')
                        $txtautoPayerPR.data('select2').dropdown.$search.val($select2Container.text());
                });
            },

            getProviderAddressInfo: function (providerInfo) {
                var addressInfo = $.grep([providerInfo.ADDR1, providerInfo.ADDR2], Boolean).join(", ");
                var cityStateZip = $.grep([providerInfo.CITY, providerInfo.STATE, providerInfo.ZIP, providerInfo.MOBNO], Boolean).join(", ");
                return { _addressInfo: addressInfo, _cityStateZip: cityStateZip }
            },

            bindPatientDetails: function (res) {
                var self = this;
                self.payer_id = res.id;
                self.patient_id = res.id;
                self.payerCode = '';
                self.payerName = res.full_name;
                self.payerType = 'patient';
            },

            bindOfDetails: function (res) {
                var self = this;
                self.payer_id = res.id;
                self.ordering_facility_id = res.id;
                self.payerCode = res.ordering_facility_code;
                self.payerName = res.ordering_facility_name;
                self.payerType = 'ordering_facility';
            },

            bindProviderDetails: function (res) {
                var self = this;
                self.payer_id = res.id;
                self.provider_id = res.id;
                self.payerCode = res.provider_code;
                self.payerName = res.full_name;
                self.payerType = 'Ordering Provider';
            },

            formatMoneyValue: function (amount, fromCas) {
                if (typeof amount === "string" && fromCas) {
                    return parseFloat(amount.replace(/[(]/g, '-').replace(/[^0-9.-]+/g, "")) || "";
                } else if (typeof amount === "number") {
                    return amount < 0 ? '($' + parseFloat(amount * (-1)).toFixed(2) + ')' : '$' + parseFloat(amount).toFixed(2);
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
                self.setPayerName(response.payer_type, response);
                $("input:radio[name=billingMethod][value=" + response.billing_method + "]").prop("checked", true);

                if (payment_statuses.indexOf(response.current_status) > -1) {
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
                        self.payer_id = response.ordering_facility_id;
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

                if(commonjs.checkNotEmpty(response.payment_dt)){
                    self.paymentDateObj =  commonjs.convertToFacilityTimeZone(response.facility_id, response.payment_dt);
                }
                commonjs.checkNotEmpty(response.accounting_date) ? self.dtpAccountingDate.date(response.accounting_date) : self.dtpAccountingDate.clear();
                self.study_dt = self.dtpAccountingDate.date().format('YYYY-MM-DD');
                self.payer_type = response.payer_type;
                self.payment_id = paymentID;
                self.patient_id = response.patient_id;
                // self.payer_id = response.patient_id || response.provider_contact_id || response.provider_group_id || response.insurance_provider_id;
                self.provider_id = response.provider_contact_id;
                self.ordering_facility_id = response.ordering_facility_id;
                self.insurance_provider_id = response.insurance_provider_id;
                // self.showAppliedByPaymentsGrid(paymentID, response.payer_type, self.payer_id);
                if (!self.casCodesLoaded)
                    self.setCasGroupCodesAndReasonCodes();
                self.payment_row_version = response.payment_row_version;
                $('#claimsTabs a').on('click', function (e) {
                    self.loadSelectedGrid(e, paymentID, response.payer_type, self.payer_id);
                });
                self.showStudyCpt(self.payer_id, self.study_dt);

                if (response.edi_file_id) {
                    self.ediFileId = response.edi_file_id;
                    self.eobFileId = response.eob_file_id || null;

                    if (response.eob_file_id) {
                        $('#eobPreviewPayment').removeClass('hidden');
                    } else {
                        $('#eobPaymentUpload').removeClass('hidden');
                    }
                }
            },

            showStudyCpt: function (payerId, study_dt) {
                var self = this;
                self.gridLoaded = [];
                this.studyCptTable = new customGrid();
                this.studyCptTable.render({
                    gridelementid: '#tblStudyCpt',
                    custompager: this.studyCptPager,
                    emptyMessage: commonjs.geti18NString("messages.status.noRecordFound"),
                    colNames: ['', '', '', '', '', '', ''],
                    i18nNames: [
                        '',
                        '',
                        '',
                        'billing.payments.accessionNo',
                        'billing.COB.studyDate',
                        'shared.fields.cptCodes',
                        'shared.fields.cptDescription',
                    ],
                    colModel: [
                        {
                            name: 'as_chkStudyCpt',
                            width: 20,
                            sortable: false,
                            resizable: false,
                            search: false,
                            isIconCol: true,
                            formatter: function (cellvalue, option, rowObject) {
                                return '<input type="checkbox" name="chkStudyCpt" id="chktblStudyCpt' + '_' + rowObject.id + '" data-study_id="' + rowObject.id + '"/>';
                            },
                            customAction: function (rowID, e) {
                                var $selectedStudyId = $("#tblStudyCpt_" + rowID + "_t  input[name=chkSubGridStudyCpt]");
                                var isCheckedStudy = $("#" + e.target.id + ":checked").length > 0;
                                $selectedStudyId.prop("checked", isCheckedStudy);
                            }
                        },
                        { name: 'id', index: 'id', key: true, searchFlag: 'int', hidden: true },
                        { name: 'facility_id', searchFlag: 'int', hidden: true },
                        { name: 'accession_no', width: 70 },
                        { name: 'study_dt', width: 70, formatter: self.studyDateFormatter },
                        { name: 'cpt_code', width: 70 },
                        { name: 'study_description', width: 100 }
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
                    subGrid: true,
                    subGridInstance: function(subgrid_id, row_id) {
                        var studycptListData = new studycptCollection();
                        var subgridTableid = subgrid_id + "_t";
                        $("#" + subgrid_id).html("<table id='" + subgridTableid + "' class='scroll'></table>");
                        var tableId = "#" + subgridTableid;
                        var subGridCptTable = new customGrid(studycptListData, tableId);

                        subGridCptTable.render({
                            gridelementid: tableId,
                            custompager: new ModelPaymentsPager(),
                            colNames: ['', '', '', '', '', '', ''],
                            i18nNames: [
                                '',
                                '',
                                '',
                                'billing.payments.accessionNo',
                                'billing.COB.studyDate',
                                'shared.fields.cptCode',
                                'shared.fields.cptDescription',
                            ],
                            colModel: [
                                {
                                    name: 'sub_chkStudyCpt',
                                    width: 25,
                                    sortable: false,
                                    resizable: false,
                                    search: false,
                                    isIconCol: true,
                                    formatter: function (cellvalue, option, rowObject) {
                                        return '<input type="checkbox" name="chkSubGridStudyCpt" id="studyCpt' + '_' + rowObject.id + '" data-study_id="' + rowObject.study_id + '"/>';
                                    },
                                    customAction: function (rowID, e, that) {
                                        var unCheckedCptsCount = $("#" + e.currentTarget.id + " input[name=chkSubGridStudyCpt]").not(":checked").length;
                                        var accessionNo = _.get(that, "options.customargs.accession_no");
                                        $("#chktblStudyCpt_" + accessionNo).prop("checked", !unCheckedCptsCount);
                                    }
                                },
                                { name: 'id', index: 'id', key: true, hidden: true },
                                { name: 'facility_id', hidden: true },
                                { name: 'accession_no', width: 70 },
                                { name: 'study_dt', width: 70, formatter: self.studyDateFormatter},
                                { name: 'cpt_code', width: 70 },
                                { name: 'cpt_description', width: 100 }
                            ],
                            sortname: "study_dt",
                            sortorder: "ASC",
                            disablesearch: true,
                            disablesort: true,
                            disablepaging: true,
                            showcaption: false,
                            disableadd: true,
                            disablereload: true,
                            defaultwherefilter: '',
                            customargs: {
                                accession_no: row_id,
                                from: 'subGridStudyCPT'
                            },
                            isSubGrid: true,
                            onaftergridbind: function (model) {
                                var accessionNo = model && model[0].attributes.accession_no;
                                var selectedStudyCount = $("#chktblStudyCpt_" + accessionNo + ":checked").length;

                                if (selectedStudyCount) {
                                    $("#tblStudyCpt_" +  accessionNo  + "_t  input[name=chkSubGridStudyCpt]").prop("checked", true);
                                }
                            },
                        });

                        $(tableId).jqGrid($(".modal-body").height() - 140);
                        $(tableId).jqGrid('setGridWidth', $(window).width() - 20);
                    },
                    onaftergridbind: function (model, gridObj) {
                        self.bindDateRangeOnSearchBox(gridObj, 'tblStudyCpt', study_dt);

                        //Remove + icon if cpt count is less than 2
                        _.each(model, function(cptData) {
                            if(_.get(cptData, "attributes.cpt_code", []).length < 2) {
                                $("tbody tr#" + cptData.id + " td").removeClass("ui-sgcollapsed sgcollapsed");
                                $("tbody tr#" + cptData.id + " span").removeClass("ui-icon ui-icon-plus");
                            }
                        })
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

            bindDateRangeOnSearchBox: function (gridObj, gridId, study_dt) {
                var self = this;
                var columnsToBind = ['study_dt']
                var drpOptions = { locale: { format: "L" } };
                var currentFilter = 1;

                _.each(columnsToBind, function (col) {
                    var rangeSetName = "past";
                    var colSelector = '#gs_' + col;

                    var colElement = $(colSelector);

                    if (self.gridLoaded.indexOf(gridId) == -1) {
                        if($.trim($("#txtAccountingDate").val()) == ""){
                            colElement.val(study_dt);
                        }
                        else{
                            colElement.val($.trim($("#txtAccountingDate").val()));
                        }

                        self.gridLoaded.push(gridId)
                    }

                    commonjs.bindDateRangePicker(colElement, drpOptions, rangeSetName, function (start, end) {
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
                    colElement.on("apply.daterangepicker", function () {
                        gridObj.refresh();
                    });
                    colElement.on("cancel.daterangepicker", function () {
                        gridObj.options.customargs.customDt = '';
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
                    $('#searchPayer #mrn').val(payerNames.account_no);
                    $('#searchPayer #lname').val(payerNames.last_name);
                    $('#searchPayer #fname').val(payerNames.first_name);
                    $('#searchPayer #dob').val(moment(payerNames.birth_date).format('L'));
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
                    success: function (data) {
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
                return true;
            },

            validatepayments: function () {
                var self = this;
                var amount = $.trim($("#txtAmount").val());
                var accountingDate = self.dtpAccountingDate && self.dtpAccountingDate.date() ? self.dtpAccountingDate.date().format('YYYY-MM-DD') : null;
                var startDate = self.paymentDateObj ? moment(self.paymentDateObj).subtract(30, 'days').startOf('day') : moment().subtract(30, 'days').startOf('day');
                var endDate = self.paymentDateObj ? moment(self.paymentDateObj).add(30, 'days').startOf('day') : moment().add(30, 'days').startOf('day');

                if (!moment(accountingDate).isBetween(startDate, endDate)
                    && accountingDate
                    && !confirm(commonjs.geti18NString("messages.confirm.payments.overwriteAccountingDate"))) {
                    return false;
                }

                if (!$('#ddlPaidLocation').val() || $('#ddlPaidLocation').val() === '0') {
                    commonjs.showWarning("messages.warning.payments.selectPaidLocation");
                    $('#ddlPaidLocation').focus();
                    return false;
                }

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

            refreshInvociePendingPayment: function () {
                this.invoicePendPaymentTable.refreshAll();
            },

            /**
            *  Condition : Payment + adjustment == Order Balance
            *  DESC : Check payment & adjustment amount is should be equal with order balance and payer_type === 'patient' for Canadian config.
            */

            overPaymentValidation: function () {
                var self = this;
                self.payer_type = self.isFromClaim ? self.claimPaymentObj.payer_type : self.payer_type;
                return true;
            },

            savePayment: function (e, claimId, paymentId, paymentStatus, paymentApplicationId) {
                var self = this;
                var $target = $(e.target);
                if ((!self.isFromClaim && !self.validatepayments()) || (self.isFromClaim && !self.validatePayerDetails())) {
                    return false;
                }

                $('#btnPaymentSave').attr('disabled', true);
                $target.prop('disabled', true);

                commonjs.showLoading();
                var paymentObj = {
                    paymentId: self.payment_id,
                    company_id: app.companyID,
                    payer_type: $('#selectPayerType').val(),
                    invoice_no: $('#txtInvoice').is(':visible') ? $('#txtInvoice').val() : null,
                    patient_id: self.patient_id,
                    provider_contact_id: self.provider_id,
                    ordering_facility_id: self.ordering_facility_id,
                    insurance_provider_id: self.insurance_provider_id,
                    credit_card_number: $("#txtCheque").val() || null,
                    credit_card_name: $("#txtCardName").val() || null,
                    payment_mode: $('#selectPaymentMode').val(),
                    payment_reason_id: $("#ddlpaymentReason").val() || null,
                    user_id: app.userID,
                    payment_row_version: self.payment_row_version
                };

                if (self.isFromClaim && self.claimPaymentObj) {
                    if (!self.overPaymentValidation()) {
                        $target.prop('disabled', false);
                        return false;
                    }

                    var lineItems = $("#tBodyApplyPendingPayment tr");
                    var payment = 0.00;
                    // get total this payment.
                    $.each(lineItems, function () {
                        var $thisPay = $(this).find('.payment__this_pay');
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
                    paymentObj.ordering_facility_id = self.claimPaymentObj.ordering_facility_id;
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
                                $target.prop('disabled', false);
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
                    emptyMessage: commonjs.geti18NString("messages.status.noRecordFound"),
                    colNames: ['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
                    i18nNames: ['', '', '', '', '', '', '', 'billing.fileInsurance.claimNo', 'billing.fileInsurance.ordFacility', 'billing.fileInsurance.invoiceNo', 'billing.payments.patient', 'billing.fileInsurance.claimDt', 'billing.payments.billFee', 'billing.payments.balance', 'shared.fields.cptCodes', 'setup.userSettings.accountNo', '', ''],
                    colModel: [
                        {
                            name: 'alert', width: 20, sortable: false, search: false,
                            className: 'icon-ic-info',
                            formatter: function (e, model, data) {
                                if (data.show_alert_icon) {
                                    return '<i class="icon-ic-info" i18nt="shared.buttons.alert" id="alertInfoRow_' + model.rowId + '"></i>';
                                }

                                return "";
                            },
                        },
                        {
                            name: 'edit', width: 20, sortable: false, search: false,
                            className: 'icon-ic-edit',
                            formatter: function () {
                                return "<i class='icon-ic-edit' i18nt='shared.buttons.edit'></i>";
                            },
                            customAction: function (rowID) {
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
                            customAction: function (rowID) {
                                var gridData = $('#tblpendPaymentsGridOnly').jqGrid('getRowData', rowID);
                                self.showClaimInquiry(gridData.claim_id, '', true);
                            }
                        },
                        { name: 'id', index: 'id', key: true, searchFlag: 'int', hidden: true },
                        { name: 'order_id', hidden: true },
                        { name: 'charge_id', hidden: true },
                        { name: 'claim_dt', hidden: true },
                        { name: 'claim_id', width: 150 },
                        { name: 'ordering_facility_name', width: 150 },
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
                    onaftergridbind: function () {
                        self.setMoneyMask();
                        //$("#gs_claim_id").focus()
                    },
                    delayedPagerUpdate: true,
                    pagerApiUrl: '/exa_modules/billing/pending_payments/payment_count'
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

            showPendingPaymentsGrid: function (paymentID, payerType, payerId, patientId, claimIdToSearch, invoiceNoToSearch, dblclickPat) {
                var self = this;
                self.claimID = claimIdToSearch;
                self.dblclickPat = dblclickPat || claimIdToSearch || invoiceNoToSearch;
                $("#divGrid_pendPayments").hide();
                if (!self.pendingGridLoaderd) {
                    this.pendPaymentTable = new customGrid();
                    this.pendPaymentTable.render({
                        gridelementid: '#tblpendPaymentsGrid',
                        custompager: this.pendPaymtPager,
                        emptyMessage: commonjs.geti18NString("messages.status.noRecordFound"),
                        colNames: ['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
                        i18nNames: ['', '', '', '', '', '', '', 'billing.fileInsurance.claimNo', 'billing.fileInsurance.invoiceNo', 'billing.payments.patient', 'billing.fileInsurance.claimDt', 'billing.payments.billFee', 'billing.payments.balance', 'shared.fields.cptCodes', 'setup.userSettings.accountNo', '', ''],
                        colModel: [
                            {
                                name: 'alert', width: 20, sortable: false, search: false,
                                className: 'icon-ic-info',
                                formatter: function (e, model, data) {
                                    if (data.show_alert_icon) {
                                        return '<i class="icon-ic-info" i18nt="shared.buttons.alert" id="alertInfoRow_' + model.rowId + '"></i>';
                                    }

                                    return "";
                                },
                            },
                            {
                                name: 'edit', width: 20, sortable: false, search: false,
                                className: 'icon-ic-edit',
                                formatter: function () {
                                    return "<i class='icon-ic-edit' i18nt='shared.buttons.edit'></i>";
                                },
                                customAction: function (rowID) {
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
                                customAction: function (rowID) {
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
                                var rowID = $('#tblpendPaymentsGrid').jqGrid('getDataIDs');
                                if (model && model.length) {
                                    if (rowID && rowID.length) {
                                        var gridData = $('#tblpendPaymentsGrid').jqGrid('getRowData', rowID[0]);
                                        self.showApplyAndCas(gridData.claim_id, paymentID || self.payment_id, 'pending', gridData.charge_id, gridData);
                                        self.claimID = "";
                                    }
                                } else {
                                    commonjs.showWarning(commonjs.geti18NString('messages.warning.payments.invalidClaimid') + " " + gridObj.options.customargs.claimIdToSearch);
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

            afterGridBind: function (dataset) {
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
                    emptyMessage: commonjs.geti18NString("messages.status.noRecordFound"),
                    colNames: ['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
                    i18nNames: ['', '', '', '', '', 'billing.fileInsurance.claimNo', 'billing.fileInsurance.invoiceNo', 'billing.payments.patient', 'billing.fileInsurance.claimDt', 'billing.payments.billFee', 'billing.payments.patientPaid', 'billing.payments.payerPaid', 'billing.payments.adjustment', 'billing.payments.thisAdj', 'billing.payments.thisPayment', 'billing.payments.balance', 'shared.fields.cptCodes', 'patient_id', 'facility_id', ''],
                    colModel: [
                        {
                            name: 'alert', width: 20, sortable: false, search: false,
                            className: 'icon-ic-info',
                            formatter: function (e, model) {
                                return '<i class="icon-ic-info" i18nt="shared.buttons.alert" id="alertInfoRow_' + model.rowId + '"></i>';
                            },
                        },
                        {
                            name: 'edit', width: 20, sortable: false, search: false,
                            className: 'icon-ic-edit',
                            formatter: function () {
                                return "<i class='icon-ic-edit' i18nt='shared.buttons.edit'></i>";
                            },
                            customAction: function (rowID) {
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
                            customAction: function (rowID) {
                                var gridData = $('#tblAppliedPaymentsGrid').jqGrid('getRowData', rowID);
                                self.showClaimInquiry(gridData.claim_id, '', true);
                            }
                        },
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
                    }
                }
                else {
                    if (self.appliedPaymentTable) {
                        self.appliedPager.set({ "PageNo": 1 });
                        self.appliedPaymentTable.refreshAll();
                    }
                }
                $('#totalPaymentBalance').parent().remove();
                self.getAppliedBalance(paymentId);
            },

            showApplyAndCas: function (claimId, paymentID, paymentStatus, chargeId, rowData, callback) {
                var self = this;
                var paymentApplicationId = rowData.payment_application_id || null;
                self.defalutCASArray = [0, 1, 2, 3, 4, 5, 6];
                self.casSegmentsSelected = [];
                self.isFromClaim = rowData.isFromClaim || false;
                self.paymentStatus = paymentStatus || '';
                paymentID = self.payment_id || paymentID;
                var patient_paid = rowData.patient_paid ? self.formatMoneyValue(rowData.patient_paid) : '0.00';
                var others_paid = rowData.others_paid ? self.formatMoneyValue(rowData.others_paid) : '0.00';
                var cas_group_codes = self.cas_group_codes || rowData.cas_group_codes;
                var cas_reason_codes = self.cas_reason_codes || rowData.cas_reason_codes;
                var claimDt = (commonjs.checkNotEmpty(rowData.claim_dt) ? commonjs.convertToFacilityTimeZone(rowData.facility_id, rowData.claim_dt).format('L') : '');
                var casDialogHeader = commonjs.geti18NString('billing.fileInsurance.claim') + ': # <strong>' + rowData.claim_id + ',  ' + rowData.full_name + '  ' + claimDt + '</strong> <h6 class="pull-right"><input type="button" id="btnPatientDocument" class="ml-5 btn btn-primary" i18n="shared.fields.documents"></h6>';
                var casDialogHtml = self.applyCasTemplate({
                    country_alpha_3_code: app.country_alpha_3_code,
                    province_alpha_2_code: app.province_alpha_2_code,
                    adjustmentCodes: self.adjustmentCodeList.toJSON(),
                    claimStatusList: this.claimStatusList.toJSON(),
                    cas_group_codes: cas_group_codes,
                    cas_reason_codes: cas_reason_codes,
                    patient_paid: patient_paid,
                    others_paid: others_paid,
                    claim_statuses: self.claimStatuses.toJSON(),
                    billingRegionCode: app.billingRegionCode,
                    can_ab_claim_status: commonjs.can_ab_claim_status,
                    can_ab_wcb_claim_status: commonjs.can_ab_wcb_claim_status
                });
                var _showDialogObj = {
                    header: casDialogHeader,
                    width: rowData.isFromClaim ? '75%' : '85%',
                    height: rowData.isFromClaim ? '65%' : '72%',
                    html: casDialogHtml,
                };

                if (rowData.isFromClaim) {
                    _showDialogObj.onHidden = function() {
                        $('#modal_div_container').css('overflow-x', 'hidden');
                    };
                    commonjs.showNestedDialog(_showDialogObj);
                    self.claimPaymentObj = rowData.newPaymentObj;
                    self.payment_id = paymentID;
                } else {
                    commonjs.showDialog(_showDialogObj);
                }


                $('#btnPatientDocument').off().click(function(){
                    var study_id;
                    var order_id;
                    var url;

                    commonjs.getClaimStudy(claimId, function (result) {
                        if (result) {
                            study_id = result.study_id;
                            order_id = result.order_id;
                            url = study_id
                                    ? '/vieworder#order/document/' + btoa(order_id) + '/' + btoa(self.patientId) + '/' + btoa(study_id) + '/claim'
                                    : '/vieworder#patient/document/' + btoa(self.patientId) + '/payment';

                            window.open(url);
                        }
                    });
                });

                $('#siteModal').removeAttr('tabindex');
                $('#divApplyPendingPayments').height($('#modal_div_container').height() - 340);
                $('#siteModal .close, #siteModal .btn-secondary').unbind().bind('click', function (e) {
                    // call appliedpending payment if not from claim screen
                    if (!self.isFromClaim) {
                        self.closeAppliedPendingPayments(e, paymentID);
                        $('#siteModal').hide();
                    }
                })

                var $totalPaymentBalance = $('#totalPaymentBalance');
                if (!$totalPaymentBalance.length && !self.isFromClaim) {
                    var $modalHeader = $('#siteModal .modal-header #spanModalHeader').parent();
                    $modalHeader.append('<h6 class="pull-right"><strong id="totalPaymentBalance" class="mr-5"></strong></h6>');
                    $totalPaymentBalance = $('#totalPaymentBalance');
                }
                var paymentHeader = commonjs.geti18NString("menuTitles.order.totalPaymentRecordBalance") + ' : ' + self.formatMoneyValue($('#lblBalance').text());
                $totalPaymentBalance.text(paymentHeader);
                commonjs.processPostRender();
                commonjs.validateControls();
                commonjs.isMaskValidate();

                $('#btnCloseAppliedPendingPayments,#btnCloseApplyPaymentPopup').off().click(function () {
                    $('#divPaymentApply').remove();
                    $('#siteModal').hide();
                });
                self.getClaimBasedCharges(claimId, paymentID, paymentStatus, chargeId, paymentApplicationId, true);
                // Hide some of edit-payment property if showDialog open via claim screen
                if (rowData.isFromClaim) {
                    $('#siteModalNested').removeAttr('tabindex'); //removed tabIndex attr on sitemodel for select2 search text area can't editable
                    $('#btnPayfullAppliedPendingPayments').hide();
                    $('#formBillingProviders .form-group').not('.divAdjustmentCodes').hide();
                    $('#siteModalNested .close, #siteModalNested .btn-secondary').off().click(function () {
                        var isPaymentsModel = $('#siteModalNested #divPendingPayment').is(':visible');
                        $('#modal_div_container_nested').empty();
                        // Send response to claim screen when nested model closed from payments
                        if (typeof callback === 'function' && isPaymentsModel) {
                            callback(null, {
                                status: 'closed',
                                payment_id: self.payment_id || paymentID
                            });
                        }
                    });
                }

                if (self.screenCode.indexOf('ECST') > -1) { // If the user don't have rights for edit claim status, claim status change action is disabled.
                    $('#ddlClaimStatus').prop({'disabled': true, 'title': commonjs.geti18NString("messages.errors.accessdenied")});
                }

                if (app.billingRegionCode === 'can_BC') {
                    $('#spAddCAS').show().off().click(function () {
                        self.addCAS(cas_group_codes, cas_reason_codes);
                        commonjs.updateCulture(app.currentCulture, commonjs.beautifyMe);
                        commonjs.validateControls();
                        commonjs.isMaskValidate();
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

            isServiceFacilityLocation: function (posCode) {
                return (
                    app.isMobileBillingEnabled
                    && app.settings.enableMobileRad
                    && posCode
                    && posCode !== 'OF'
                );
            },

            getPOSDetails: function (payerObj) {
                var placeOfService = {
                    value: null,
                    text: ''
                };

                var posCode = payerObj.pos_map_code;
                var hasMatchingOrderingFacility = ~~payerObj.ordering_facility_contact_id === ~~payerObj.patient_ordering_facility_contact_id;

                switch (posCode) {
                    case 'F':
                        placeOfService.value = payerObj.facility_id;
                        placeOfService.text = payerObj.facility_name;
                        break;
                    case 'PR':
                        placeOfService.value = payerObj.patient_id;
                        placeOfService.text = payerObj.patient_name;
                        break;
                    case 'OP':
                        placeOfService.value = payerObj.provider_contact_id;
                        placeOfService.text = payerObj.provider_name;
                        break;
                    case 'OF':
                        placeOfService.value = payerObj.order_facility_id;
                        placeOfService.text = payerObj.ordering_facility_name;
                        break;
                    case 'OFP':
                        if (!hasMatchingOrderingFacility) {
                            placeOfService.value = payerObj.patient_ordering_facility_contact_id;
                            placeOfService.text = payerObj.patient_ordering_facility_name;
                        }
                        break;
                }

                return placeOfService;
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
                    success: function (data) {
                        var allData = data[0];
                        var charges = allData.charges;
                        var adjustmentCodes = allData.adjustment_codes;
                        var payerTypes = allData.payer_types;
                        $('#tBodyApplyPendingPayment').empty();
                        $('#ddlAdjustmentCode_fast').empty();
                        $ddlResponsible.empty();
                        self.charges = charges;
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
                            paymentDet.allowed_id = payment.allowed_id;
                            paymentDet.allowed_amount = payment.allowed_amount;
                            var balance = parseFloat(paymentDet.bill_fee) - (parseFloat(paymentDet.other_payment) + parseFloat(paymentDet.other_adjustment) + parseFloat(paymentDet.adjustment) + parseFloat(paymentDet.payment_amount)).toFixed(2);
                            paymentDet.balance = parseFloat(balance).toFixed(2);

                            var applyPaymentRow = self.applyPaymentTemplate({
                                country_alpha_3_code: app.country_alpha_3_code,
                                province_alpha_2_code: app.province_alpha_2_code,
                                payment: paymentDet
                            });

                            $('#tBodyApplyPendingPayment').append(applyPaymentRow);

                            $('.this_pay, .this_adjustment').unbind().blur(function () {
                                self.updatePaymentAdjustment();
                                self.updateRefundRecoupment();
                            });

                            $('.this_allowed').unbind().blur(function (e) {
                                self.calculateAdjustment(e)
                                self.updatePaymentAdjustment();
                            });

                            $('.checkDebit').unbind().click(function () {
                                self.updateRefundRecoupment();
                                self.updatePaymentAdjustment();
                            });

                            $('#ddlAdjustmentCode_fast').unbind().change(function () {
                                self.updateRefundRecoupment();
                                self.updatePaymentAdjustment();
                            });

                            var cas_arr_obj = [];
                            cas_arr_obj = payment.cas_arr_obj ? JSON.parse(payment.cas_arr_obj) : [];
                            self.casSave[index] = cas_arr_obj;

                            $('#btnCancelCAS').unbind().on('click', function () {
                                self.closePaymentsCAS(paymentStatus);
                            });

                            $('#btnSaveCAS').unbind().on('click', function () {
                                self.savePaymentsCAS(claimId, paymentId, paymentStatus, payment.payment_application_id);
                            });
                        });
                        commonjs.validateControls();
                        commonjs.isMaskValidate();
                        self.setFeeFields({}, true);

                        $('#ddlAdjustmentCode_fast').append($('<option/>', { value: '', text: 'Select' }));

                        $.each(adjustmentCodes, function (index, adjustmentCode) {
                            var $Option = $('<option/>', { value: adjustmentCode.id, text: adjustmentCode.description, 'data_code_type': adjustmentCode.type, 'data_code': adjustmentCode.code });
                            if (adjustmentCode.type === 'refund_debit') {
                                $Option.css({ background: 'gray' }).attr('title', 'Refund Adjustment').addClass('refund_debit');
                            }
                            else if (adjustmentCode.type === 'recoupment_debit') {
                                $Option.css({ background: 'lightgray' }).attr('title', 'Recoupment Adjustment').addClass('recoupment_debit');
                            }
                            else if (adjustmentCode.type === 'debit') {
                                $Option.css({ background: 'gray' }).attr('title', 'Debit Adjustment').addClass('recoupment_debit');
                            }
                            $('#ddlAdjustmentCode_fast').append($Option);
                        });

                        $.each(payerTypes, function (index, payerObj) {
                            self.patientId = payerObj.patient_id;

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
                                    selected: payerObj.payer_type === 'primary_insurance',
                                    code: payerObj.primary_ins_provider_code
                                });
                            }

                            if (payerObj.secondary && payerObj.secondary != 'null' && payerObj.secondary_ins_provider_name != null) {
                                responsibleObjArray.push({
                                    id: payerObj.secondary,
                                    text: payerObj.secondary_ins_provider_name + '(' + payerObj.secondary_ins_provider_code + ')(Secondary Insurance)',
                                    payer_type: 'secondary_insurance',
                                    selected: payerObj.payer_type === 'secondary_insurance',
                                    code: payerObj.secondary_ins_provider_code
                                });
                            }

                            if (payerObj.tertiary && payerObj.tertiary != 'null' && payerObj.tertiary_ins_provider_name != null) {
                                responsibleObjArray.push({
                                    id: payerObj.tertiary,
                                    text: payerObj.tertiary_ins_provider_name + '(' + payerObj.tertiary_ins_provider_code + ')(Tertiary Insurance)',
                                    payer_type: 'tertiary_insurance',
                                    selected: payerObj.payer_type === 'tertiary_insurance',
                                    code: payerObj.tertiary_ins_provider_code
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

                            if (self.isServiceFacilityLocation(payerObj.pos_map_code)) {
                                var posData = self.getPOSDetails(payerObj);

                                posData.value && responsibleObjArray.push({
                                    id: posData.value,
                                    text: posData.text + '(Service Facility)',
                                    payer_type: 'service_facility_location',
                                    selected: payerObj.payer_type === 'service_facility_location'
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
                                self.displayClaimStatusByProvider(data && data.code);
                                return data.text;
                            }
                        })
                        .on('select2:selecting', function (event) {
                            $(event.target).find('option').removeAttr('selected');
                            $(event.target).find('option').removeAttr('is_edit');
                            self.displayClaimStatusByProvider(event.params.args.data && event.params.args.data.code);
                        });

                        self.received_claim_status_id = payerTypes && payerTypes[0].claim_status_id
                        $('#ddlClaimStatus').val(self.received_claim_status_id);
                        self.disableElementsForProvince(payerTypes);

                        $.each(charges, function (index, charge_details) {
                            if (charge_details.adjustment_code_id) {
                                $("#ddlAdjustmentCode_fast").val(charge_details.adjustment_code_id);
                                return false;
                            }

                                $("#ddlAdjustmentCode_fast").val('');

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
                        }


                        $('#tBodyApplyPendingPayment').find('.applyCAS').on('click', function (e) {
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

                        $('#applyPaymentContent').find('#btnSaveAppliedPendingPaymentsNotes').unbind().on('click', function (e) {
                            self.updateNotes(e, claimId);
                        });

                        var is_payer_type_patient = (payerTypes[0].payer_type === "patient" && $('#ddlClaimResponsible').val() === "PPP");
                        var is_payer_type_patient_exclude_from_claim = (!self.isFromClaim && $('#ddlResponsible').find(':selected').attr('data-payer_type') === "patient");

                        if (is_payer_type_patient || is_payer_type_patient_exclude_from_claim) {
                            $('#divPatientStatement').show();
                        }
                        else {
                            $('#divPatientStatement').val('').hide();
                        }

                        $('#btnPatientStatement').off().on('click', function(e) {
                            self.mailTo = 'select';
                            self.printStatement(e, claimId, [payerTypes[0].patient_id]);
                        });

                        $('.printStatement').off().on('click', function(e) {
                            self.mailTo = $(e.target).attr('data-method');
                            self.printStatement(e, claimId, [payerTypes[0].patient_id]);
                        });

                        $('#btnClearAppliedPendingPayments').unbind().on('click', function (e) {
                            self.clearPayments(e, paymentId, claimId);
                        });

                        $('#btnPayfullAppliedPendingPayments').unbind().on('click', function (e) {
                            self.saveAllPayments(e, claimId, paymentId, paymentStatus, chargeId, paymentApplicationId, 'PaidInFull');
                        });

                        self.reloadPaymentFields(claimId, paymentId, paymentApplicationId, isInitialBind);

                        $('#txtResponsibleNotes').val(payerTypes[0].billing_notes);

                        var adjCodeType = $('#ddlAdjustmentCode_fast').find(':selected').attr('data_code_type');
                        var adjCode = $('#ddlAdjustmentCode_fast').find(':selected').attr('data_code');

                        if (['recoupment_debit', 'refund_debit'].indexOf(adjCodeType) > -1 || (adjCode === 'BDR' && adjCodeType === 'debit')) {

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

                        var paymentReconAlerts = allData.claim_comments || null;

                        if (isInitialBind && paymentReconAlerts) {
                            claimAlertsView.showClaimAlerts(paymentReconAlerts);
                        }

                        // To get focus after binding on claim charges
                        var thisPayment = $($('.payment__this_pay')[0]);
                        thisPayment.focus();
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
                $('.payment__this_allowed').val(pay_val);

                this.updatePaymentAdjustment();
            },

            updateRefundRecoupment: function () {
                var lineItems = $("#tBodyApplyPendingPayment tr");
                var isDebit = $('.checkDebit').length && $('.checkDebit')[0].checked;
                var adjustmentCodeType = $('#ddlAdjustmentCode_fast').find(':selected').attr('data_code_type');
                var adjustmentCode = $('#ddlAdjustmentCode_fast').find(':selected').attr('data_code');

                if (isDebit && adjustmentCodeType) {
                    $('#btnPayfullAppliedPendingPayments').attr('disabled', true);
                    var $thisAdjustment;
                    var $thisPayment;

                    $.each(lineItems, function () {
                        var hasDebit = ['refund_debit', 'debit'].indexOf(adjustmentCodeType) > -1;
                        $thisAdjustment = $(this).find('.payment__this_adjustment');
                        $thisPayment = $(this).find('.payment__this_pay');

                        $thisPayment.prop('disabled', hasDebit);

                        if (adjustmentCodeType === 'refund_debit') {
                            $thisPayment.val('0.00');
                            $(this).find('.payment__other_adjustment').val('0.00');
                            $thisAdjustment.val(parseFloat(-Math.abs($thisAdjustment.val())).toFixed(2));
                        }
                        else if (adjustmentCode === 'BDR') {
                            $thisAdjustment.val(parseFloat(-Math.abs($thisAdjustment.val())).toFixed(2));
                        }
                        else if (adjustmentCodeType === 'recoupment_debit') {
                            $thisPayment.prop('disabled', false);
                            $thisAdjustment.val(parseFloat(-Math.abs($thisAdjustment.val())).toFixed(2));
                            $thisPayment.val(parseFloat(-Math.abs($thisPayment.val())).toFixed(2));
                        }
                        else {
                            $thisAdjustment.val(parseFloat(Math.abs($thisAdjustment.val())).toFixed(2));
                            $thisPayment.val(parseFloat(Math.abs($thisPayment.val())).toFixed(2));
                            $thisPayment.attr('disabled', false);
                        }
                    });

                }
                else {
                    lineItems.find('.payment__this_pay').attr('disabled', false);
                    $.each(lineItems, function () {
                        var $thisAdjustment = $(this).find('.payment__this_adjustment');
                        var $thisPayment = $(this).find('.payment__this_pay');
                        $thisAdjustment.val(parseFloat(Math.abs($thisAdjustment.val())).toFixed(2));
                        $thisPayment.val(parseFloat(Math.abs($thisPayment.val())).toFixed(2));
                    });
                    $('#btnPayfullAppliedPendingPayments').attr('disabled', false);
                }
            },

            calculateAdjustment: function (e) {
                var $row = $(e.target).closest('tr');
                var isDebit = $('.checkDebit')[0].checked;
                var $billFee = $row.find('.payment__bill_fee');
                var $thisPay = $row.find('.payment__this_pay');
                var $thisAdj = $row.find('.payment__this_adjustment');
                var $otherAdj = $row.find('.payment__other_adjustment');
                var $allowedFee = $row.find('.payment__this_allowed');
                var $otherPayment = $row.find('.payment__others');
                var $paymentBalance = $row.find('.payment__balance');
                var otherAdj = parseFloat($otherAdj.text());
                var billFee = parseFloat($billFee.text()).toFixed(2);
                var allowedFee = $allowedFee.val() ? parseFloat($allowedFee.val()) : 0.00;
                var otherPayment = $otherPayment.text() != '' ? parseFloat($otherPayment.text()) : 0.00;
                var adjustment = billFee - allowedFee;
                adjustment = isDebit ? -Math.abs(adjustment) : Math.abs(adjustment);

                if ($allowedFee.val() != '') {
                    $thisAdj.val(parseFloat(adjustment).toFixed(2));
                }
                var paymentAmt = $thisPay.val() ? parseFloat($thisPay.val()) : 0.00;
                var adjAmt = $thisAdj.val() ? parseFloat($thisAdj.val()) : 0.00;
                var currentBalance = parseFloat($billFee.text()) - (otherPayment + otherAdj + paymentAmt + adjAmt);

                $paymentBalance.text(parseFloat(currentBalance).toFixed(2));
            },

            updatePaymentAdjustment: function () {
                var self = this;
                var lineItems = $("#tBodyApplyPendingPayment tr");
                var payment = 0.0;
                var adjustment = 0.0;
                var other_payment = 0.0;
                var other_adj = 0.0;
                var paymentBalance = 0.0;

                $.each(lineItems, function () {
                    var otherPayment = parseFloat($(this).find('.payment__others').text().trim())
                    var otherAdj = parseFloat($(this).find('.payment__other_adjustment').text().trim())
                    var payment_amt = $(this).find('.payment__this_pay').val() ? parseFloat($(this).find('.payment__this_pay').val().trim()) : 0.00;
                    var adj_amt = $(this).find('.payment__this_adjustment').val() ? parseFloat($(this).find('.payment__this_adjustment').val().trim()) : 0.00;
                    payment = payment + parseFloat(payment_amt);
                    other_payment = other_payment + parseFloat(otherPayment);
                    other_adj = other_adj + parseFloat(otherAdj);
                    adjustment = adjustment + parseFloat(adj_amt);
                    var current_balance = parseFloat($(this).find('.payment__bill_fee').text().trim()) - (otherPayment + otherAdj + payment_amt + adj_amt);
                    $(this).find('.payment__balance').text(parseFloat(current_balance).toFixed(2));
                    var cpt_id = parseInt($(this).attr('data_charge_id_id').trim()) || null;
                    paymentBalance = paymentBalance + parseFloat(payment_amt);
                    if (cpt_id) {
                        var charge = _.find(self.charges, { id: cpt_id });
                        if (charge) {
                            paymentBalance = paymentBalance - (charge.payment_amount || 0);
                        }
                    }
                });

                $('#spPaymentApplied').text(self.formatMoneyValue(payment));
                $('#spAdjustmentApplied').text(self.formatMoneyValue(adjustment));

                var orderBillFee = self.formatMoneyValue($('#lblBillingFee').text(), true);
                var orderBalance = orderBillFee - (parseFloat(adjustment) + parseFloat(payment) + parseFloat(other_payment) + parseFloat(other_adj));
                var orderAdjustment = parseFloat(adjustment) + parseFloat(other_adj);

                var balancePayment = (self.formatMoneyValue($('#lblBalance').text(), true) - paymentBalance) || 0;
                var paymentHeader = commonjs.geti18NString("menuTitles.order.totalPaymentRecordBalance") + ' : ' + self.formatMoneyValue(balancePayment)
                $('#totalPaymentBalance').text(paymentHeader);
                $('#lblBalanceNew').text(self.formatMoneyValue(orderBalance));
                $('#lblAdjustment').text(self.formatMoneyValue(orderAdjustment));
            },

            savePaymentsCAS: function (claimId, paymentId, paymentStatus) {
                var charge_id = $('#divPaymentCAS').attr('data-charge_id');
                this.casSegmentsSelected = this.casSegmentsSelected.filter(function (obj) {
                    return obj.charge_id != charge_id
                })
                var cas = this.validateCasCodeAndReason(paymentStatus, charge_id);
                if (cas) {
                    this.casSegmentsSelected.push(cas);
                    this.closePaymentsCAS();
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

            validateCasCodeAndReason: function (paymentStatus, charge_id) {
                var self = this;
                var casObj = [];
                var length = $('.casPayment').length;
                var isClaimDenied = false;

                for (var k = 1; k <= length; k++) {
                    var emptyCasObj = {};
                    var groupId = $('#selectGroupCode' + k).val();
                    var reasonId = $('#selectReason' + k).val();
                    var groupCode = $('#selectGroupCode' + k + ' option:selected').attr('data-code');
                    var reasonCode = $('#selectReason' + k + ' option:selected').attr('data-code');

                    if (!isClaimDenied) {
                        isClaimDenied = groupCode === 'PR' && reasonCode === '96';
                    }

                    var amount = $('#txtAmount' + k).val();
                    var cas_id = '';

                    if (paymentStatus === 'applied') {
                        cas_id = $('#selectGroupCode' + k).attr('cas_id');
                    }

                    if (groupId == '' && ($('#selectGroupCode' + k).attr('cas_id') != '' && $('#selectGroupCode' + k).attr('cas_id') > 0)) {
                        self.casDeleted.push($('#selectGroupCode' + k).attr('cas_id'));
                    }

                    if (groupId != '' && reasonId != '' && amount != '') {
                        if (k != 0 && self.checkPreviousRowIsEmpty(k - 1, k)) {
                            emptyCasObj['group_code_id'] = groupId;
                            emptyCasObj['reason_code_id'] = reasonId;
                            emptyCasObj['amount'] = amount;
                            if (paymentStatus === 'applied') { emptyCasObj['cas_id'] = cas_id; }
                            casObj.push(emptyCasObj);
                        }
                        else return false;
                    }
                    else if (groupId != '' && reasonId == '') {
                        commonjs.showWarning('Please select the reason in row ' + k);
                        $('#selectReason' + k).focus()
                        return false;
                    }
                    else if (groupId == '' && reasonId != '') {
                        commonjs.showWarning('Please select the group code in row ' + k);
                        $('#selectGroupCode' + k).focus()
                        return false;
                    }
                    else if ((reasonId != '' || groupId != '') && amount == "") {
                        commonjs.showWarning('Please enter amount in row ' + k);
                        $('#txtAmount' + k).focus();
                        return false;
                    }
                }
                return { charge_id: charge_id, isClaimDenied: isClaimDenied, casObj: casObj };
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
                        success: function (data) {
                            $('#divPaymentCAS select').removeAttr('cas_id');
                            var payemntCasApplns = data || self.casSegmentsSelected;
                            $.each(payemntCasApplns, function (index, appln) {
                                var rowVal = index + 1;
                                if (rowVal > 7 && app.billingRegionCode === 'can_BC') {
                                    self.addCAS(self.cas_group_codes, self.cas_reason_codes);
                                }
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
                    else {
                        for (var k = 1; k <= this.defaultCASField; k++) {
                            $('#selectGroupCode' + k).attr('cas_id', '');
                        }
                    }
                    $('#divPaymentCAS').attr('data-charge_id', chargeId).show();
                    commonjs.validateControls();
                    commonjs.isMaskValidate();
                }
            },

            closePaymentsCAS: function () {
                $('#divPaymentCAS select').val('');
                $('#divPaymentCAS input[type="text"]').val('');
                $('#divPaymentCAS').hide();
            },

            validatePayerDetails: function () {
                var self = this;
                var isDebit = $('.checkDebit')[0].checked;
                var adjustment_codetype = $('#ddlAdjustmentCode_fast').find(':selected').attr('data_code_type');
                var val = ['refund_debit', 'recoupment_debit', 'debit'];
                var isNegativeAdj = val.indexOf(adjustment_codetype) > -1;

                if ($('#ddlResponsible').val() === '') {
                    commonjs.showWarning('shared.warning.missingResponsible');
                    $('#ddlResponsible').select2('open')
                    return false;
                }
                else if ($('#ddlAdjustmentCode_fast').val() === '0') {
                    commonjs.showWarning('messages.warning.payments.pleaseSelectAdjustment');
                    return false;
                } else if (isDebit && !isNegativeAdj) {
                    commonjs.showWarning('messages.warning.payments.pleaseSelectRefAdjCode');
                    return false;
                } else if (!isDebit && isNegativeAdj) {
                    commonjs.showWarning('messages.warning.payments.pleaseSelectDRCheckBox');
                    return false;
                } else if (self.isRefundApplied === true) {
                    if ($('#ddlAdjustmentCode_fast').val() && $('#ddlAdjustmentCode_fast').find(':selected').attr('data_code_type') != 'refund_debit') {
                        var refund_change_confirm = confirm(commonjs.geti18NString("messages.confirm.payments.overwriteRefundAreYouSure"));
                        if (refund_change_confirm == true) {
                            self.isRefundApplied = false;
                            return true;
                        }
                        return false;

                    }
                    self.isRefundApplied = false;
                    return true;

                } else if (isDebit && adjustment_codetype === 'refund_debit') {
                    var lineItems = $("#tBodyApplyPendingPayment tr");
                    var adjustment_has_value = 0;
                    $.each(lineItems, function () {
                        var thisAdjustment = $(this).find('.payment__this_adjustment').val();
                        if (parseFloat(thisAdjustment) != 0.00) {
                            adjustment_has_value = adjustment_has_value + 1;
                        }
                    });
                    if (adjustment_has_value === 0) {
                        commonjs.showWarning('messages.warning.payments.enterRefundAmount');
                        adjustment_has_value = 0;
                        return false;
                    }
                    return true;
                }
                return true;
            },

            saveAllPayments: function (e, claimId, paymentId, paymentStatus, chargeId, paymentApplicationId) {
                var targetObj = $(e.target);
                var objIsPayInFull = targetObj.is('#btnPayfullAppliedPendingPayments');
                var self = this;

                if (this.validatePayerDetails()) {
                    var lineItems = $("#tBodyApplyPendingPayment tr");
                    var line_items = [];
                    var cas = this.casSegmentsSelected;

                    $.each(lineItems, function () {
                        var _line_item = {};
                        var chargeRow = $(this);

                        var bill_fee = $(this).find('.payment__bill_fee').text();
                        var all_payment = $(this).find('.payment__others').text() ? $(this).find('.payment__others').text() : 0.00;
                        var this_pay = $(this).find('.payment__this_pay').val() ? $(this).find('.payment__this_pay').val() : 0.00;
                        var all_adjustment = $(this).find('.payment__other_adjustment').text() ? $(this).find('.payment__other_adjustment').text() : 0.00;
                        var this_adjustment = $(this).find('.payment__this_adjustment').val() ? $(this).find('.payment__this_adjustment').val() : 0.00;
                        var balance = parseFloat(bill_fee) - (parseFloat(all_payment) + parseFloat(all_adjustment) + parseFloat(this_pay) + parseFloat(this_adjustment)).toFixed(2);

                        _line_item["charge_id"] = chargeRow.attr('data_charge_id_id');
                        _line_item["paymentApplicationId"] = chargeRow.attr('data_payment_application_id');
                        _line_item["adjustmentApplicationId"] = chargeRow.attr('data_payment_adjustment_id');
                        _line_item["paymentAppliedDt"] = chargeRow.attr('data_payment_applied_dt');
                        _line_item["payment"] = objIsPayInFull ? balance + parseFloat(this_pay) : parseFloat(this_pay);
                        _line_item["adjustment"] = chargeRow.find('.payment__this_adjustment').val() ? parseFloat(chargeRow.find('.payment__this_adjustment').val()) : 0.00;
                        _line_item["balance"] = objIsPayInFull ? 0 : balance;
                        _line_item["allowed_id"] = chargeRow.attr('data_allowed_id');
                        _line_item["allowed_amount"] = parseFloat($(this).find('.payment__this_allowed').val() || 0.00);

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
                    var totalPayment = _.reduce(line_items, function(m, x) { return m + x.payment; }, 0);
                    var totalAdjustment = _.reduce(line_items, function(m, x) { return m + x.adjustment; }, 0);
                    var totalClaimBalance = _.reduce(line_items, function(m, x) { return m + x.balance; }, 0);

                    if (!self.overPaymentValidation()) {
                        return false;
                    }

                    /**
                    *  Condition : If payment_payer_type === 'patient' && claim_status !== Pending Validation/Submission
                    *  DESC : No need to change Claim Status & Responsible
                    *  Reference ticket  : EXA-12612
                    */
                    var paymentPayerType = self.isFromClaim ? self.claimPaymentObj.payer_type || '' : $('#selectPayerType').val();
                    var isClaimStatusChanged = self.received_claim_status_id != $('#ddlClaimStatus').val();

                    var deniedStatus = _.filter(self.claimStatuses.toJSON(), { code: 'D' });
                    var deniedStatusId = deniedStatus.length && deniedStatus[0].id || '';
                    var isClaimDenied = _.get(cas, ['0', 'isClaimDenied']) || false;

                    if (totalPayment === 0 && totalAdjustment === 0) {
                        isClaimDenied = true;
                    }

                    if (isClaimDenied) {
                        $('#ddlClaimStatus').val(deniedStatusId);
                    }

                    var payerType = $('#ddlResponsible').find(':selected').attr('data-payer_type');
                    var isPayerChanged = $('#ddlResponsible').find(':selected').attr('is_edit') === 'true';
                    var adjustmentType = $('#ddlAdjustmentCode_fast').val() || null;
                    var billingNotes = $('#txtResponsibleNotes').val();
                    var deduction = $('#txtDeduction').val();
                    var coInsurance = $('#txtCoInsurance').val();
                    var coPay = $('#txtCoPay').val();
                    var claimStatusID = (isClaimStatusChanged || isClaimDenied)
                        ? $('#ddlClaimStatus').val()
                        : 0;

                    var preventClaimStatusUpdate = false;
                    var preventPayerTypeUpdate = false;
                    var isClaimPaidInFull = totalClaimBalance === 0; // Update claim status to paid in full when claim balance = 0 irrespective of payer
                    var isClaimOverPaid = totalClaimBalance < 0; // verify claim balance after current (payment & adjustment)
                    var claimPayerType = ['primary_insurance', 'secondary_insurance', 'tertiary_insurance'].includes(self.currentResponsible)
                        ? 'insurance'
                        : self.currentResponsible;

                    if ((paymentPayerType !== claimPayerType || $('#ddlClaimResponsible').val() === 'PSF') && isClaimPaidInFull) {
                        preventPayerTypeUpdate = (!isPayerChanged || isClaimOverPaid) && !isClaimPaidInFull;
                        preventClaimStatusUpdate = !isClaimStatusChanged && !isClaimPaidInFull;
                    }
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
                            claimStatusID: preventClaimStatusUpdate ? self.received_claim_status_id : claimStatusID,
                            is_payerChanged: isPayerChanged && $('#ddlClaimResponsible').val() !== 'PSF',
                            is_claimDenied: isClaimDenied,
                            deniedStatusId: deniedStatusId,
                            isFromClaim: self.isFromClaim,
                            changeResponsibleParty : !preventPayerTypeUpdate
                        },
                        success: function (model) {
                            var msg = self.isFromClaim ? commonjs.geti18NString('messages.status.tosSuccessfullyCompleted') :
                                paymentStatus === 'applied' ? commonjs.geti18NString('messages.status.paymentUpdatedSuccessfully') : commonjs.geti18NString('messages.status.paymentAppliedSuccessfully');

                            commonjs.showStatus(msg);
                            if (e.target.id !== 'btnSaveAppliedPendingPayments') {
                                targetObj.removeAttr('disabled');
                            }
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
                            self.getAppliedBalance(paymentId);
                            $('.modal-footer button').focus();
                            if (self.isEscKeyPress) {
                                self.isEscKeyPress = false;
                                self.closePayment();
                            }
                        },
                        error: function (err, response) {
                            targetObj.removeAttr('disabled');
                            commonjs.handleXhrError(err, response);
                        }
                    });
                }
            },

            updateNotes: function (e, claimId) {
                var targetObj = $(e.target);

                commonjs.showLoading();
                targetObj.attr('disabled', true);
                $.ajax({
                    url: '/exa_modules/billing/payments/notes/' + claimId,
                    type: 'PUT',
                    data: {
                        billingNotes: $.trim($('#txtResponsibleNotes').val())
                    },
                    success: function (response) {
                        if (response && response.length) {
                            commonjs.showStatus("messages.status.successfullyCompleted");
                            commonjs.hideLoading();
                            targetObj.removeAttr('disabled');
                        }
                    },
                    error: function (err) {
                        commonjs.handleXhrError(err);
                        commonjs.hideLoading();
                        targetObj.removeAttr('disabled');
                    }
                });
            },

            createPatientActivityParams: function(claimId, patientId) {
                this.PatientStatementView = new PatientStatementView({
                    el: $('#reportFrame')
                });
                return {
                    'patientIds': patientId,
                    'claimId': claimId,
                    'flag': "patientStatement",
                    'logInClaimInquiry': true,
                    'mailTo': this.mailTo
                }
            },

            printStatement: function (e, claimId, patientId) {
                var patientStatementParams = this.createPatientActivityParams(claimId, patientId);
                if (patientStatementParams) {
                    this.PatientStatementView.onReportViewClick(e, patientStatementParams);
                }
            },

            reloadPaymentFields: function (claimId, paymentId, paymentApplicationId, isInitialBind) {
                var self = this;
                jQuery.ajax({
                    url: "/exa_modules/billing/pending_payments/fee_details",
                    type: "GET",
                    data: {
                        claimId: claimId,
                        paymentId: paymentId,
                        paymentApplicationId: paymentApplicationId
                    },
                    success: function (data) {
                        if (data) {
                            var feeDetails = data[0];
                            self.total_Adjustment = feeDetails.adjustment || 0;
                            self.total_Payment = feeDetails.payment || 0;
                            self.currentOrderBalance = feeDetails.balance || 0;
                            self.setFeeFields({ billFee: feeDetails.bill_fee, adjustment: feeDetails.adjustment, balance: feeDetails.balance, others_paid: feeDetails.others_paid, patient_paid: feeDetails.patient_paid, payment: feeDetails.payment, total_adjustment: feeDetails.total_adjustment });
                        }
                        if (isInitialBind) {
                            var id = layout.currentModule == 'Claims' || layout.currentScreen == 'Studies' ? 'modalBodyNested' : 'modalBody';
                            $('#' + id).trackFormChanges(function (unsaved) {
                                if (unsaved) {
                                    if (confirm(commonjs.geti18NString("messages.confirm.unsavedFormConfirm"))) {
                                        self.isEscKeyPress = true;
                                        $('#btnSaveAppliedPendingPayments').trigger('click');
                                    }
                                } else {
                                    self.closePayment();
                                }
                            })
                        }
                        $('#btnSaveAppliedPendingPayments').removeAttr('disabled');
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
                this.patient_id = this.provider_id = this.ordering_facility_id = this.insurance_provider_id = null;
            },

            goBackToPayments: function () {
                if (this.from === 'ris')
                    Backbone.history.navigate('#billing/payments/filter/ris', true);
                else
                    Backbone.history.navigate('#billing/payments/list', true);
            },

            searchPayer: _.debounce(function (e) {
                var canSearch = true;
                var dobVal = $('#dob').val();

                if (dobVal) {
                    canSearch = moment(dobVal, commonjs.getDateTemplate()).isValid();
                }

                if (e.originalEvent && canSearch) {
                    var aa = $('#txtautoPayerPP').data('select2'); //To handle focus change in library
                    aa.$selection.focus = function () { return false; }
                    $('#txtautoPayerPP').select2("close");
                    $('#txtautoPayerPP').select2("open");
                }
            }, 800),

            getPayerSearchFields: function () {
                var obj = {};
                $('#searchPayer').find('.search-payer').each(function () {
                    var el = $(this);
                    var val = $.trim(el.val());
                    if (val) {
                        obj[el.attr('id')] = val;
                    }
                });
                return obj;
            },

            applySearch: _.debounce(function () {
                var $divPatientSearchResults = $('#divPatientSearchResults');
                var isNotEmpty = false;
                var canSearch = true;
                $('#searchPatient').find('.search-field').each(function () {
                    var searchText = $(this).val();
                    var _eleId = $(this).attr('id');
                    searchText = searchText.replace(/[()_-]/g, '');

                    if (searchText != '') {
                        isNotEmpty = commonjs.isValidSearchLimit(_eleId, searchText);

                        if (!isNotEmpty) {
                            return false;
                        }
                    }
                });

                if (isNotEmpty) {
                    var dobVal = $('#dob').val();

                    if (dobVal) {
                        canSearch = moment(dobVal, commonjs.getDateTemplate()).isValid();
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
                        success: function (data) {
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

            searchProvider: function () {
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

            searchOrderingFac: function () {
                commonjs.showDialog({
                    header: 'Ordering Facility',
                    i18nHeader: 'billing.payments.orderingFacility',
                    width: '75%',
                    height: '80%',
                    needShrink: true,
                    url: '/vieworder#setup/orderingFacility/all/familyHistory?isContactSearch=true',
                    onLoad: 'commonjs.removeIframeHeader()'
                });
            },

            searchInsurance: function () {
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

            searchPatient: function () {
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
                var patientId = (tagName == 'P') ? (e.target || e.srcElement).parentElement.id.split('_')[2] : (e.target || e.srcElement).id.split('_')[2];
                var patient_name = $(e.target || e.srcElement).closest('.selectionpatient').data('name');
                var account_no = $(e.target || e.srcElement).closest('.selectionpatient').data('value');

                this.patientId = patientId;
                this.claimIdToSearch = '';
                this.invoiceNoToSearch = '';
                this.showPatientForm(patientId, patient_name, account_no, true);
            },

            showPatientForm: function (patientId, patient_name, account_no, dblclickPat) {
                $('#commonMsg').text(commonjs.geti18NString("shared.fields.pendingPaymentsForThePatient"));
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
                    self.patientId = 0;
                    self.claimIdToSearch = $('#claimId').val();
                    self.invoiceNoToSearch = $('#invoiceNo').val();

                    var msg;

                    if ($(e.target).is('#claimId')) {
                        if (self.validateClaimId()) {
                            msg = commonjs.geti18NString("shared.fields.pendingPaymentsForClaim");
                            $('#commonMsg').text(msg);
                            $('#spnPatInfo').text(self.claimIdToSearch);
                            self.showPendingPaymentsGrid(this.payment_id, this.payer_type, this.payer_id, 0, self.claimIdToSearch, '');
                        }
                    }
                    else if ($(e.target).is('#invoiceNo')) {
                        if (self.validateInvoice()) {
                            msg = commonjs.geti18NString("shared.fields.pendingPaymentsForInvoice");
                            $('#commonMsg').text(msg);
                            $('#spnPatInfo').text(self.invoiceNoToSearch);
                            self.showPendingPaymentsGrid(this.payment_id, this.payer_type, this.payer_id, 0, '', self.invoiceNoToSearch);
                        }
                    }
                }
            },

            showPatientOrders: function (e) {
                var self = this;
                self.patientId = 0;
                self.claimIdToSearch = $('#claimId').val();
                self.invoiceNoToSearch = $('#invoiceNo').val();

                var msg;

                if ($(e.target).is('#anc_search_claim')) {
                    if (self.validateClaimId()) {
                        msg =  commonjs.geti18NString("shared.fields.pendingPaymentsForClaim");
                        $('#commonMsg').text(msg)
                        $('#spnPatInfo').text(self.claimIdToSearch);
                        self.showPendingPaymentsGrid(this.payment_id, this.payer_type, this.payer_id, 0, self.claimIdToSearch, '');
                    }
                }
                else if ($(e.target).is('#anc_search')) {
                    if (self.validateInvoice()) {
                        msg =  commonjs.geti18NString("shared.fields.pendingPaymentsForInvoice");
                        $('#commonMsg').text(msg)
                        $('#spnPatInfo').text(self.invoiceNoToSearch);
                        self.showPendingPaymentsGrid(this.payment_id, this.payer_type, this.payer_id, 0, '', self.invoiceNoToSearch);
                    }
                }
            },

            backToPatient: function () {
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

            changePayerMode: function () {
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
                    case "eft":
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

            afterAppliedGridBind: function (dataset) {
                var paymentRowId;

                if (dataset && dataset.length) {
                    $('#selectPayerType').attr({
                        'disabled': true,
                        'i18nt': 'billing.payments.youCannotChangeThePayerSinceThePaymentHasAlreadyApplied'
                    });

                    // Show alert icon if payment alerts exists for the claim
                    $.each(dataset, function (i, paymentData) {
                        paymentRowId = _.get(paymentData, "attributes.id");
                        $('#alertInfoRow_' + paymentRowId).prop('hidden', !_.get(paymentData, "attributes.show_alert_icon"));
                    });
                }
            },

            validatePaymentDelete: function () {
                var self = this;
                var nextPrevButton = $('.nextPrevPayment');
                nextPrevButton.prop('disabled', true);
                $.ajax({
                    url: '/exa_modules/billing/pending_payments/can_delete_payment',
                    type: 'get',
                    data: {
                        paymentId: self.payment_id
                    },
                    success: function (data) {
                        if (data[0].can_delete_payment) {
                            if (confirm(commonjs.geti18NString("messages.status.areYouSureToDeleteThisPayment"))) {
                                self.deletePayment(nextPrevButton);
                            }
                        } else {
                            alert(commonjs.geti18NString("messages.status.paymentAppliedToClaimsPleaseUnapplyBeforeDelete"));
                        }
                        nextPrevButton.prop('disabled', false);
                    },
                    error: function (err, response) {
                        nextPrevButton.prop('disabled', false);
                        commonjs.handleXhrError(err, response);
                    }
                });
            },

            deletePayment: function (btnPrevNext) {
                var self = this;
                btnPrevNext.prop('disabled', true);
                $.ajax({
                    url: '/exa_modules/billing/pending_payments/payment',
                    type: 'DELETE',
                    data: {
                        payment_id: self.payment_id
                    },
                    success: function () {
                        commonjs.showStatus("messages.status.paymentHasBeenDeletedSuccessfully");
                        btnPrevNext.prop('disabled', false);
                        if (self.from === 'ris')
                            Backbone.history.navigate('#billing/payments/filter/ris', true);
                        else
                            Backbone.history.navigate('#billing/payments/filter', true);
                    },
                    error: function (err, response) {
                        btnPrevNext.prop('disabled', false);
                        commonjs.handleXhrError(err, response);
                    }
                });
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
                    var studyCptIds = [];

                    // Push study ids if no subgrid cpts are selected
                    $("#tblStudyCpt").find('input[name=chkStudyCpt]:checked').each(function () {
                        var studyId = $(this).attr("data-study_id");
                        var selectedCptCount = $("#tblStudyCpt_" + studyId + "_t  input[name=chkSubGridStudyCpt]").length;
                        if (!selectedCptCount) {
                            studyIds.push(~~this.parentNode.parentNode.id);
                        }
                    })

                    // Push selected subgrid study cpt ids
                    $("#tblStudyCpt").find('input[name=chkSubGridStudyCpt]:checked').each(function () {
                        studyCptIds.push(~~this.parentNode.parentNode.id);
                    })

                    if (studyIds && !studyIds.length && studyCptIds && !studyCptIds.length) {
                        commonjs.showWarning("messages.warning.claims.pleaseSelectStudyCPT");
                        return false;
                    }

                        self.paymentEditPDF = new paymentEditPDF({ el: $('#modal_div_container') });
                        var paymentPDFArgs = {
                            studyIds: studyIds,
                            studyCptIds: studyCptIds,
                            flag: 'RISPrintReceipt',
                            patient_id: self.patient_id,
                            payment_id: self.payment_id
                        }
                        self.paymentEditPDF.onReportViewClick(e, paymentPDFArgs);

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
                    success: function (data) {
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
                    success: function (data) {
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

            showClaimInquiry: function (id, patient_id) {
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
                    success: function (data) {
                        if (data && data.length) {
                            var totalPaymentBalance = self.formatMoneyValue(data[0].balance);
                            var paymentHeader = commonjs.geti18NString("menuTitles.order.totalPaymentRecordBalance") + ' : ' + totalPaymentBalance
                            $('#lblApplied').html(self.formatMoneyValue(data[0].applied));
                            $('#lblBalance').html(totalPaymentBalance);
                            $('#totalPaymentBalance').text(paymentHeader);

                            if (data[0].applied && parseFloat(data[0].applied.replace('$', '')) > 0) {
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

                if (id === 'aPeningPayments' && (!$('#tblpendPaymentsGridOnly').children().length)) {
                    self.showPendingPaymentsGridInvoice(paymentID, payer_type, payer_id);
                }
                else if (id === 'aAppliedPayments' && (!$('#tblAppliedPaymentsGrid').children().length)) {
                    self.showAppliedByPaymentsGrid(paymentID, payer_type, payer_id);
                }
                self.tabClicked = id;
            },

            setMoneyMask: function () {
                var $gridFields = $(".ui-jqgrid-htable thead:first tr.ui-search-toolbar");
                $gridFields.find("input[name=billing_fee],[name=balance],[name=bill_fee],[name=adjustment],[name=this_adjustment],[name=payment]").addClass('negativeFloatBox');
                $gridFields.find("input[name=claim_id]").addClass('integerbox');
                commonjs.validateControls();
            },

            nextPrevPayment: function (e) {
                $('.nextPrevPayment').prop('disabled', true);
                var self = this;
                var data;
                var paymentsList = JSON.parse(window.localStorage.getItem('payment_list')) || {};
                var index = _.findIndex(paymentsList, { id: btoa(self.payment_id) });
                var targetId = $(e.target).attr('id');

                if (targetId === 'btnPaymentPrev') {
                    data = paymentsList[index - 1];
                } else if (targetId === 'btnPaymentNext') {
                    data = paymentsList[index + 1];
                }
                var rowId = data && atob(data.id) || null;

                if (rowId) {

                    if (self.from === 'ris') {
                        Backbone.history.navigate('#billing/payments/edit/' + self.from + '/' + rowId, true);
                    } else {
                        Backbone.history.navigate('#billing/payments/edit/' + rowId, true);
                    }
                } else {
                    commonjs.showWarning("messages.warning.payments.noRecords");
                }
                $('.nextPrevPayment').prop('disabled', false);
            },

            showPDF: function() {
                var self = this;
                if (self.eobFileId == null) {
                    $.ajax({
                        url: '/exa_modules/billing/era/eob_file_id',
                        type: 'GET',
                        data: {
                            paymentID: self.payment_id
                        },
                        success: function (data) {
                            if (data.rows && data.rows.length) {
                                self.eobFileId = data.rows[0].eob_file_id;
                            }

                            self.showDocument();
                        },
                        error: function (err, response) {
                            commonjs.handleXhrError(err, response);
                        }
                    });
                } else {
                    self.showDocument();
                }

            },

            showDocument: function() {
                var self = this;
                commonjs.showDialog({
                    url: '/exa_modules/billing/era/eob_pdf?file_id=' + self.eobFileId + '&company_id=' + app.companyID,
                    width: '80%',
                    height: '80%',
                    header: 'EOB',
                    i18nHeader: "billing.payments.eob"
                });
            },

            uploadPDF: function(e) {
                var self = this;
                $('.btnEobPaymentUpload').attr('id', self.ediFileId)
                var iframe = $('#ifrEobFileUpload')[0];
                iframe.contentWindow.fireUpload(e);
            },

            reloadEobPDF: function() {
                var fileStatus;
                var fileStoreExist;

                var ifrDoc = $("#ifrEobFileUpload").contents();
                if (ifrDoc) {
                    $(ifrDoc).find('.eraProcessButton').css('display', 'none');
                    fileStatus = $(ifrDoc).find('#fileStatus');
                    fileStoreExist = $(ifrDoc).find('#fileStoreExist');

                    if ((fileStatus.text()).toLowerCase() === 'ok') {
                        $('#eobPreviewPayment').removeClass('hidden');
                        $('#eobPaymentUpload').addClass('hidden');
                    } else if (fileStoreExist && fileStoreExist.text() == 'FILE_STORE_NOT_EXISTS') {
                        commonjs.showWarning("messages.warning.era.fileStoreNotconfigured");
                        $(ifrDoc).find('#fileIsDuplicate, #fileNameUploaded, #fileStoreExist').html('');
                        return false;
                    } else if (fileStatus && fileStatus.text() == 'INVALID_FILE') {
                        commonjs.showWarning("messages.warning.era.invalidFileFormat");
                        $(ifrDoc).find('#fileStatus, #fileNameUploaded, #fileStoreExist').html('');
                        return false;
                    } else if (fileStoreExist && fileStoreExist.text() != '') {
                        commonjs.showWarning(fileStoreExist.text());
                        $(ifrDoc).find('#fileIsDuplicate, #fileNameUploaded, #fileStoreExist').html('');
                        return false;
                    }
                }
            },

            closePayment: function () {
                if (layout.currentModule == 'Claims' || layout.currentScreen == 'Studies') {
                    $('#siteModalNested .close').trigger('click');
                } else {
                    $('#siteModal .close').trigger('click');
                }
            },

            // enable/disable elements Based on billing province.
            disableElementsForProvince: function(data) {
                var details = data && data[0] || {};

                if (app.billingRegionCode === 'can_AB') {
                    var currentClaimStatus = app.claim_status.find(function(obj) {
                        return obj.id === details.claim_status_id;
                    });
                    var invalidClaimStatusArray = ['DEL', 'ISS', 'PAE', 'PGA', 'PGD', 'REJ', 'REQ'];
                    var disableClaimStatus = (
                        details && details.primary_ins_provider_code && details.primary_ins_provider_code.toLowerCase() === 'ahs' &&
                        invalidClaimStatusArray.indexOf(currentClaimStatus.code) !== -1
                    ) || false;

                    $('#ddlClaimStatus').prop('disabled', disableClaimStatus);
                } else if (app.billingRegionCode === 'can_MB') {
                    var queryClaimStatusId, p77ClaimStatusId;

                    _.each(app.claim_status, function (obj) {
                        switch (obj.code) {
                            case 'QR':
                                queryClaimStatusId = obj.id;
                                break;
                            case 'P77':
                                p77ClaimStatusId = obj.id;
                                break;
                        }
                    });

                    var queryStatusEle = $('#ddlClaimStatus option[value="' + queryClaimStatusId + '"]');
                    var p77StatusEle = $('#ddlClaimStatus option[value="' + p77ClaimStatusId + '"]');

                    var validStatus = app.claim_status.find(function(obj) {
                        return obj.id === details.claim_status_id;
                    }); //returns an id of partially paid or over paid.

                    if (['MPP', 'OP', 'R'].includes(validStatus.code)) {
                        queryStatusEle.show();
                    } else {
                        queryStatusEle.hide();
                    }

                    if (validStatus.code !== 'P77') {
                        p77StatusEle.hide();
                        $("#btnSaveAppliedPendingPaymentsNotes").hide();
                    } else {
                        $("#btnSaveAppliedPendingPayments").hide();
                    }
                } else if (app.billingRegionCode === 'can_BC') {
                    var currentClaimStatusCode, ohClaimStatusId;

                    _.each(app.claim_status, function(obj) {
                        if (obj.id === details.claim_status_id) {
                            currentClaimStatusCode = obj.code;
                        }

                        if (obj.code === 'OH') {
                            ohClaimStatusId = obj.id;
                        }
                    });

                    if (currentClaimStatusCode === 'OH') {
                        $("#btnSaveAppliedPendingPayments").hide();
                    } else {
                        $('#ddlClaimStatus option[value="' + ohClaimStatusId  + '"]').hide();
                        $("#btnSaveAppliedPendingPaymentsNotes").hide();
                    }
                }
            },

            /**
            * addCAS - Add addtional CAS
            *
            * @param  {Array} cas_group_codes CAS group codes
            * @param  {Array} cas_reason_codes CAS reason codes
            */
            addCAS: function (cas_group_codes, cas_reason_codes) {
                var element = '';

                var count = $('.casPayment').length
                if (count + 1 <= 10) {
                    element += this.additionCASFormTemplate({
                        cas_group_codes: cas_group_codes,
                        cas_reason_codes: cas_reason_codes,
                        id: count + 1
                    });
                    $('#contentPaymentCAS').append(element);
                }
            },

            displayClaimStatusByProvider: function(primary_insurance_code) {
                var claimStatusOption = '#ddlClaimStatus option';

                if (app.billingRegionCode === "can_AB" && primary_insurance_code && primary_insurance_code.toLowerCase() === "wcb") {
                    $(claimStatusOption).hide();
                    $(claimStatusOption + '.can_ab').show();
                    $(claimStatusOption + '.can_ab_wcb').show();
                }
                else {
                    $(claimStatusOption).show();
                    $(claimStatusOption + '.can_ab_wcb').hide();
                }
            },

        });
});
