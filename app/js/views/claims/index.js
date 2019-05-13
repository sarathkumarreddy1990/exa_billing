define(['jquery',
'underscore',
'backbone',
'models/claims',
'models/pager',
'models/patient-insurance',
'models/patient-details',
'text!templates/claims/claim-form.html',
'text!templates/claims/charge-row.html',
'text!templates/claims/insurance-eligibility.html',
'collections/app/patientsearch',
'text!templates/app/patientSearchResult.html',
'text!templates/claims/claim-validation.html',
'text!templates/claims/icd9-icd10.html',
'text!templates/claims/patient-alert.html',
'views/app/payment-edit',
'collections/app/pending-payments',
'text!templates/claims/payment-row.html',
'shared/address',
'text!templates/claims/eligibilityResponseOHIP.html'
],
    function ($,
        _,
        Backbone,
        newClaimModel,
        modelPatientPager,
        modelPatientInsurance,
        patientModel,
        claimCreationTemplate,
        chargeRowTemplate,
        insurancePokitdokForm,
        patientCollection,
        patSearchContent,
        claimValidation,
        icd9to10Template,
        patientAlertTemplate,
        editPaymentView,
        pendingPayments,
        paymentRowTemplate,
        address,
        insuranceOhipForm
    ) {
        var claimView = Backbone.View.extend({
            el: null,
            rendered: false,
            claimCreationTemplate: _.template(claimCreationTemplate),
            chargerowtemplate: _.template(chargeRowTemplate),
            patSearchContentTemplate: _.template(patSearchContent),
            claimValidation: _.template(claimValidation),
            patientAlertTemplate: _.template(patientAlertTemplate),
            paymentRowTemplate: _.template(paymentRowTemplate),
            insuranceOhipTemplate: _.template(insuranceOhipForm),
            updateResponsibleList: [],
            chargeModel: [],
            claimICDLists: [],
            existingPrimaryInsurance: [],
            existingSecondaryInsurance: [],
            existingTriInsurance: [],
            npiNo: '',
            federalTaxId: '',
            enableInsuranceEligibility: '',
            tradingPartnerId: '',
            ACSelect: { refPhy: {}, readPhy: {} },
            icd9to10Template : _.template(icd9to10Template),
            responsible_list: [
                { payer_type: "PPP", payer_type_name: "patient", payer_id: null, payer_name: null },
                { payer_type: "PIP_P", payer_type_name: "primary_insurance", payer_id: null, coverage_level: "P", payer_name: null, billing_method: null },
                { payer_type: "PIP_S", payer_type_name: "secondary_insurance", payer_id: null, coverage_level: "S", payer_name: null, billing_method: null },
                { payer_type: "PIP_T", payer_type_name: "tertiary_insurance", payer_id: null, coverage_level: "T", payer_name: null, billing_method: null },
                { payer_type: "POF", payer_type_name: "ordering_facility", payer_id: null, payer_name: null },
                { payer_type: "RF", payer_type_name: "referring_provider", payer_id: null, payer_name: null }
            ],
            usermessage: {
                selectStudyRefProvider: 'Select Refer. Provider',
                selectStudyReadPhysician: 'Select Read. Provider',
                selectDiagnosticCode: 'Select Code',
                selectOrdFacility: 'Select Ordering Facility',
                selectCarrier: 'Search Carrier',
                selectcptcode: "Select Cpt Code",
                selectcptdescription: "Select Cpt Description"
            },
            patientsPager: null,
            patientTotalRecords: 0,
            patientAddress: {},
            priInsCode : '',
            elIDs: {
                'primaryInsAddress1': '#txtPriSubPriAddr',
                'primaryInsAddress2': '#txtPriSubSecAddr',
                'primaryInsCity': '#txtPriCity',
                'primaryInsState': '#ddlPriState',
                'primaryInsZipCode': '#txtPriZipCode'
            },
            initialize: function (options) {
                this.options = options;
                this.model = new newClaimModel();
                this.patInsModel = new modelPatientInsurance();

                var modelCollection = Backbone.Collection.extend({
                    model: Backbone.Model.extend({})
                });
                this.facilities = new modelCollection(commonjs.bindArray(app.facilities, true, true));
                this.states = new modelCollection(commonjs.bindArray(app.states[0].app_states, true));
                this.genders = new modelCollection(commonjs.bindArray(app.gender, true));
                this.claimStatusList = new modelCollection(app.claim_status);
                this.billingCodesList = new modelCollection(app.billing_codes);
                this.billingClassList = new modelCollection(app.billing_classes);
                this.billingProviderList = new modelCollection(app.billing_providers);
                this.InsurancePokitdokTemplateForm = new _.template(insurancePokitdokForm);
                this.patientsPager = new modelPatientPager();
                this.patientListcoll = new patientCollection();
                this.pendingPayments = new pendingPayments();
                this. screenCode = [];
                if(app.userInfo.user_type != 'SU'){
                    var rights = (window.appRights).init();
                    this.screenCode = rights.screenCode;
                }
            },
            urlNavigation: function () { //To restrict the change in URL based on tab selection. Maintain Same URL for every tab in claim creation screen
                var self = this;
                if (!self.isEdit) {
                    history.go(-1);
                    return false
                }
            },
            render: function (isFrom) {
                var self = this;
                this.rendered = true;

                commonjs.showDialog({
                    header: 'Claim Creation',
                    i18nHeader: 'shared.fields.claimCreation',
                    width: '95%',
                    height: '75%',
                    html: this.claimCreationTemplate({
                        country_alpha_3_code: app.country_alpha_3_code,
                        patient_name: self.cur_patient_name,
                        account_no: self.cur_patient_acc_no,
                        dob: self.cur_patient_dob,
                        facilities: self.facilities.toJSON(),
                        genders: self.genders.toJSON(),
                        states: self.states.toJSON(),
                        claimStatusList: self.claimStatusList.toJSON(),
                        billingCodesList: self.billingCodesList.toJSON(),
                        billingClassList: self.billingClassList.toJSON(),
                        billingProviderList: self.billingProviderList.toJSON(),
                        posList: app.places_of_service || [],
                        relationshipList: app.relationship_status || [],
                        chargeList: self.claimChargeList || [],
                        paymentList: self.paymentList
                    })
                });

                if (app.country_alpha_3_code === 'can') {
                    $('#txtPriGroupNo').attr('maxlength', 2);
                } else {
                    $('label[for=txtPriPolicyNo]').append("<span class='Required' style='color: red;padding-left: 5px;'>*</span>");
                }
                self.clearDependentVariables();
                // Hide non-edit tabs
                if (!self.isEdit) {
                    $('.editClaimRelated').hide();
                }

                if (isFrom == 'patientSearch') {
                    $('.woClaimRelated').hide();
                } else {
                    $('#divPatient').hide();
                }

                $('#siteModal').removeAttr('tabindex'); //removed tabIndex attr for select2 search text can't editable

                if (isFrom != 'patientSearch') {
                    self.bindDetails();
                    self.bindTabMenuEvents();
                }

                if(self.screenCode.indexOf('CLVA') > -1) // this is for validate button rights
                    $('#btnValidateClaim').attr('disabled', true)

                if(self.screenCode.indexOf('PATR') > -1)
                    $('#btPatientDocuemnt').attr('disabled', true)

                self.initializeDateTimePickers();
                $('#modal_div_container').animate({ scrollTop: 0 }, 100);

                // Append dynamic address details for canadian config
                var AddressInfoMap = {
                    city: {
                        domId: 'txtPriCity',
                        infoKey: 'city'
                    },
                    state: {
                        domId: 'ddlPriState',
                        infoKey: 'state'
                    },
                    zipCode: {
                        domId: 'txtPriZipCode',
                        infoKey: 'zip'
                    }
                }
                self.bindCityStateZipTemplate({}, AddressInfoMap, 'Pri');
            },

            initializeDateTimePickers: function () {
                var self = this;

                self.benefitDate1 = commonjs.bindDateTimePicker('divBOD1', { format: 'L' });
                self.benefitDate1.date(moment().format('L'));
                self.injuryDate = commonjs.bindDateTimePicker('divInjuryDate', { format: 'L' });
                self.injuryDate.date();
                self.otherDate = commonjs.bindDateTimePicker('divOtherDate', { format: 'L' });
                self.otherDate.date();
                self.wcf = commonjs.bindDateTimePicker('divWCF', { format: 'L' });
                self.wcf.date();
                self.wct = commonjs.bindDateTimePicker('divWCT', { format: 'L' });
                self.wct.date();
                self.hcf = commonjs.bindDateTimePicker('divHCF', { format: 'L' });
                self.hcf.date();
                self.hct = commonjs.bindDateTimePicker('divHCT', { format: 'L' });
                self.hct.date();
                self.priDOB = commonjs.bindDateTimePicker('divPriDOB', { format: 'L' });
                self.priDOB.date();

                if (app.country_alpha_3_code !== 'can') {
                    self.benefitDate2 = commonjs.bindDateTimePicker('divBOD2', { format: 'L' });
                    self.benefitDate2.date(moment().format('L'));
                    self.benefitDate3 = commonjs.bindDateTimePicker('divBOD3', { format: 'L' });
                    self.benefitDate3.date(moment().format('L'));
                    self.secDOB = commonjs.bindDateTimePicker('divSecDOB', { format: 'L' });
                    self.secDOB.date();
                    self.terDOB = commonjs.bindDateTimePicker('divTerDOB', { format: 'L' });
                    self.terDOB.date();
                }
                commonjs.isMaskValidate();

            },

            checkInsuranceEligibility: function (e) {
                var self = this;
                if (app.country_alpha_3_code === 'can')
                    self.insuranceEligibilityCan(e)
                else
                    self.insuranceEligibilityUsa(e)
            },

            insuranceEligibilityCan: function (e) {
                var self = this;

                if ($('#txtPriPolicyNo').val().length == 0 && self.priInsCode != '' && ['hcp', 'wsib'].indexOf(self.priInsCode.toLowerCase()) > -1) {
                    commonjs.showWarning('messages.warning.shared.invalidHealthNumber');
                    return;
                }
                if (self.priInsCode === '' || $('#ddlPriInsurance').val() === '') {
                    commonjs.showWarning('messages.warning.claims.selectPriInsurance');
                    $('#ddlPriInsurance').focus();
                    return;
                }
                if (self.priInsCode !== '' && ['hcp','wsib'].indexOf(self.priInsCode.toLowerCase()) === -1) {
                    commonjs.showWarning('messages.warning.shared.invalidEligibilityCheck');
                    return;
                }
                else {
                    $.ajax({
                        url: '/exa_modules/billing/ohip/validateHealthCard',
                        type: "GET",
                        data: {
                            healthNumber: $('#txtPriPolicyNo').val(),
                            versionCode: $('#txtPriGroupNo').val(),
                            patient_id: self.cur_patient_id,
                            patient_insurance_id: self.priClaimInsID || self.primaryPatientInsuranceId
                        },
                        success: function (data) {
                            if ( data ) {
                                var eligibilityRes = (data.results && data.results.length) ? data.results[0] : data.faults && data.faults[0] || data.err
                                eligibilityRes.dateOfBirth = (eligibilityRes.dateOfBirth &&  commonjs.getFormattedDate(eligibilityRes.dateOfBirth)) || '';
                                eligibilityRes.expiryDate = (eligibilityRes.expiryDate &&  commonjs.getFormattedDate(eligibilityRes.expiryDate)) || '';
                                commonjs.showNestedDialog({
                                    header: 'Healthcard Eligibility Result', i18nHeader: 'menuTitles.patient.patientInsuranceEligibility', height: '70%', width: '70%',
                                    html: self.insuranceOhipTemplate({
                                        'insuranceData': eligibilityRes
                                    })
                                });
                            }
                            else {
                                commonjs.showWarning( 'messages.status.noValidationData', 'largestatus' );
                            }
                        },
                        error: function (request, status, error) {
                            commonjs.handleXhrError(request);
                        }
                    });
                }
            },

            insuranceEligibilityUsa: function (e) {
                var self = this;
                var serviceTypeCodes = [], serviceTypes = [];
                var id = e && e.target && e.target.id && e.target.id;
                var ins = '';

                var eligibilityData = {
                    Sender: "",
                    AuthKey: "",
                    APIOrgCode: "",
                    InsuranceCompanyCode: "-1",
                    ProviderCode: "-1",
                    EntityType: '1',
                    NpiNo: self.npiNo,
                    FederalTaxID: self.federalTaxId ? self.federalTaxId : '',
                    BenefitOnDate: null,
                    BirthDate: null,
                    RelationshipCode: 34,
                    ServiceTypeCodes: null,
                    ServiceTypes: null,
                    FromLocal: 'false',
                    ResponseType: 'html',
                    patient_id: self.cur_patient_id,
                    isExistingInsurance: true,
                    patient_insurance_id: null,
                    LastName: null,
                    FirstName: null,
                    address: null,
                    PolicyNo: null,
                    InsuranceCompanyName: null,
                    tradingPartnerId: self.tradingPartnerId
                }

                if (id == 'btnCheckEligibility2') {
                    ins = 2;
                } else if (id == 'btnCheckEligibility3') {
                    ins = 3;
                }


                if (!$('#ddlServiceType' + ins + ' :selected').length) {
                    commonjs.showWarning('messages.warning.shared.selectservicetype');
                    return;
                }

                if (!$('#txtBenefitOnDate' + ins).val()) {
                    commonjs.showWarning('messages.warning.shared.selectbenefitondate');
                    return;
                }

                if (!self.npiNo) {
                    commonjs.showWarning('messages.warning.shared.npinumbernotpresent');
                    return;
                }

                if (!self.federalTaxId) {
                    commonjs.showWarning('messages.warning.shared.federaltaxidnotpresent');
                    return;
                }

                if (!self.enableInsuranceEligibility) {
                    commonjs.showWarning('messages.warning.shared.eligibilitycheckdisabled');
                    return;
                }

                if (!$('#ddlBillingProvider').val()) {
                    commonjs.showWarning("messages.warning.shared.selectbillingProvider");
                    $('#ddlBillingProvider').focus();
                    return;
                }

                $.each($('#ddlServiceType' + ins + ' :selected'), function (index, value) {
                    serviceTypeCodes.push($(value).val())
                    var serviceType = $(value).attr('title').toLowerCase();
                    serviceTypes.push(serviceType.replace(/[^A-Z0-9]+/ig, "_"));
                });

                eligibilityData.serviceTypeCodes = serviceTypeCodes;
                eligibilityData.serviceTypes = serviceTypes;

                eligibilityData.billingProviderId = $('#ddlBillingProvider option:selected').val() != '' ? parseInt($('#ddlBillingProvider option:selected').val()) : null;

                if (!ins) {  // Primary insurance
                    eligibilityData.insuranceProviderId = self.priInsID;
                    eligibilityData.relationshipCode = $('#ddlPriRelationShip').val() ? $('#ddlPriRelationShip').val() : eligibilityData.RelationshipCode;
                    eligibilityData.policyNo = $('#txtPriPolicyNo').val() ? $('#txtPriPolicyNo').val() : null;
                    eligibilityData.benefitOnDate = $('#txtBenefitOnDate').val() ? $('#txtBenefitOnDate').val() : null;
                    eligibilityData.birthDate = commonjs.getISODateString(document.querySelector('#txtPriDOB').value);
                    eligibilityData.lastName = $('#txtPriSubLastName').val() ? $('#txtPriSubLastName').val() : null;
                    eligibilityData.firstName = $('#txtPriSubFirstName').val() ? $('#txtPriSubFirstName').val() : null;
                } else if (ins == 2) { // Secondary insurance
                    eligibilityData.insuranceProviderId = self.secInsID;
                    eligibilityData.relationshipCode = $('#ddlSecRelationShip').val() ? $('#ddlSecRelationShip').val() : eligibilityData.relationshipCode;
                    eligibilityData.policyNo = $('#txtSecPolicyNo').val() ? $('#txtSecPolicyNo').val() : null;
                    eligibilityData.benefitOnDate = $('#txtBenefitOnDate2').val() ? $('#txtBenefitOnDate2').val() : null;
                    eligibilityData.birthDate = commonjs.getISODateString(document.querySelector('#txtSecDOB').value);
                    eligibilityData.lastName = $('#txtSecSubLastName').val() ? $('#txtSecSubLastName').val() : null;
                    eligibilityData.firstName = $('#txtSecSubFirstName').val() ? $('#txtSecSubFirstName').val() : null;
                }
                else if (ins == 3) { // Teritary insurance
                    eligibilityData.insuranceProviderId = self.terInsID;
                    eligibilityData.relationshipCode = $('#ddlTerRelationShip').val() ? $('#ddlTerRelationShip').val() : eligibilityData.relationshipCode;
                    eligibilityData.policyNo = $('#txtTerPolicyNo').val() ? $('#txtTerPolicyNo').val() : null;
                    eligibilityData.benefitOnDate = $('#txtBenefitOnDate3').val() ? $('#txtBenefitOnDate3').val() : null;
                    eligibilityData.birthDate = commonjs.getISODateString(document.querySelector('#txtTerDOB').value);
                    eligibilityData.lastName = $('#txtTerSubLastName').val() ? $('#txtTerSubLastName').val() : null;
                    eligibilityData.firstName = $('#txtTerSubFirstName').val() ? $('#txtTerSubFirstName').val() : null;
                }

                $('#btnCheckEligibility' + ins).prop('disabled', true);
                $('#imgLoading').show();


                commonjs.showLoading("messages.loadingMsg.connectingPokitdok");
                $('#divPokidokResponse').empty();
                $.ajax({
                    url: '/exa_modules/billing/claims/claim/eligibility',
                    type: "POST",
                    dataType: "json",
                    data: eligibilityData,
                    success: function (response) {
                        commonjs.hideLoading();

                        data = response.data;
                        $('#btnCheckEligibility' + ins).prop('disabled', false);
                        if (data && data.errors) {
                            commonjs.showWarning(data.errors.query ? data.errors.query : 'ERR: ' + JSON.stringify(data.errors) + '..');
                            return;
                        }
                        else if (!data.errors && response.insPokitdok == true) {
                            commonjs.showNestedDialog({ header: 'Pokitdok Response', width: '80%', height: '70%', html: $(self.InsurancePokitdokTemplateForm({ 'InsuranceData': response.data, 'InsuranceDatavalue': response.meta })) });
                        }

                        $('#divCoPayDetails').height('400px');

                        $.each($('#divPokitdok table td'), function (index, obj) {
                            $(obj).attr('title', $(obj).text().replace(/[*$-]/, '').trim());
                        });

                        $("#btnClosePokidokPopup").unbind().click(function (e) {
                            $('#divPokidokResponse').hide();
                        });
                    },
                    error: function (model, response) {
                        commonjs.handleXhrError(model, response);
                    }
                });
            },

            bindDetails: function (doHide) {
                var self = this;

                // set all Insurance auto_complete
                self.bindServiceType();
                self.bindInsuranceAutocomplete('ddlPriInsurance');
                self.bindInsuranceAutocomplete('ddlSecInsurance');
                self.bindInsuranceAutocomplete('ddlTerInsurance');

                self.setProviderAutoComplete('PR'); // rendering provider auto complete
                self.setProviderAutoComplete('RF'); // referring provider auto complete
                self.setDiagCodesAutoComplete();
                self.setOrderingFacilityAutoComplete();
                if (!self.isEdit)
                    self.bindExistingPatientInsurance(doHide);
            },

            initializeClaimEditForm: function (isFrom) {
                var self = this;
                if (!this.rendered)
                    this.render('claim');
                self.bindclaimFormEvents(isFrom);
            },

            /* Get claim edit details function*/
            showEditClaimForm: function (claim_Id, isFrom, options) {
                var self = this;
                self.model.set({ id: claim_Id });
                self.claim_Id = claim_Id;
                self.isEdit = true;
                self.claimICDLists = [];
                self.removedCharges = [];
                self.chargeModel = [];
                self.options = options || {};
                self.patientAlerts = [];
                self.dtpAccountingDate = [];
                if (isFrom && isFrom != 'reload') {
                    self.openedFrom = isFrom
                }

                commonjs.showLoading();

                $.ajax({
                    type: 'GET',
                    url: '/exa_modules/billing/claims/claim',
                    data: {
                        id: claim_Id
                    },
                    success: function (model, response) {

                        if (model && model.length > 0) {
                            var claimDetails = model[0];
                            self.cur_patient_acc_no = claimDetails.patient_account_no;
                            self.cur_patient_name = claimDetails.patient_name;
                            self.cur_patient_dob = claimDetails.patient_dob;
                            self.cur_patient_id = claimDetails.patient_id ? parseInt(claimDetails.patient_id) : null;

                            self.claim_dt_iso = commonjs.checkNotEmpty(claimDetails.claim_dt)
                                ? commonjs.convertToFacilityTimeZone(claimDetails.facility_id, claimDetails.claim_dt).format('YYYY-MM-DD LT z')
                                : '';
                            self.priClaimInsID = claimDetails.primary_patient_insurance_id || null;
                            self.secClaimInsID = claimDetails.secondary_patient_insurance_id || null;
                            self.terClaimInsID = claimDetails.tertiary_patient_insurance_id || null;
                            self.claim_row_version = claimDetails.claim_row_version || null;
                            self.facilityId = claimDetails.facility_id; // claim facility_date
                            self.studyDate = commonjs.getConvertedFacilityTime(claimDetails.claim_dt, '', 'L', claimDetails.facility_id);
                            self.patientAddress = claimDetails.patient_info ? commonjs.hstoreParse(claimDetails.patient_info) : {};
                            self.paymentList = claimDetails.payment_details || [];
                            self.billing_method = claimDetails.billing_method;
                            $('.claimProcess').prop('disabled', false);
                            $('#btnSaveClaim').prop('disabled', false);
                            /* Bind claim charge Details - start */
                            $('#tBodyCharge').empty();
                            claimDetails.claim_charges = claimDetails.claim_charges || [];
                            self.claimChargeList = [];
                            $.each(claimDetails.claim_charges, function (index, obj) {
                                obj.charge_dt = commonjs.checkNotEmpty(obj.charge_dt) ? commonjs.convertToFacilityTimeZone(claimDetails.facility_id, obj.charge_dt).format('L') : '';
                                obj.facility_id = claimDetails.facility_id;
                                obj.data_row_id = index;
                                self.bindModifiersData(obj);
                                self.claimChargeList.push(obj);
                                self.chargeModel.push({
                                    id: obj.id,
                                    data_row_id: index,
                                    ref_charge_id: null,
                                    claim_id: obj.claim_id,
                                    study_id: obj.study_id,
                                    accession_no: obj.accession_no,
                                    payment_exists: obj.payment_exists,
                                    is_deleted: false,
                                });
                            });
                            /* Bind claim charge Details - end */

                            if (commonjs.hasModalClosed() && isFrom === 'reload') {
                                commonjs.hideLoading();
                                return false;
                            }

                            self.initializeClaimEditForm(isFrom);
                            /* Bind chargeLineItems events - started*/
                            if(self.screenCode.indexOf('DCLM') > -1) {
                                $('span[id^="spDeleteCharge"]').removeClass('removecharge');
                                $('span[id^="spDeleteCharge"]').css('color','#DCDCDC');
                            }
                            self.assignLineItemsEvents();
                            self.assignModifierEvent();
                            app.modifiers_in_order = true;
                            commonjs.validateControls();
                            commonjs.isMaskValidate();
                            /* Bind chargeLineItems events - Ended */
                            self.addPatientHeaderDetails(claimDetails, 'edit')

                            /* Patient Alert data Bind Started */
                            self.patientAlerts = claimDetails.alerts;
                            self.showAlertBadge();
                            /* Patient Alert data Bind Ended */

                            $.each(self.claimChargeList, function (index, data) {
                                /* Bind charge table data*/
                                self.createCptCodesUI(index);

                                if (data.cpt_code || data.display_description) {
                                    $('#lblCptCode_' + index).html(data.cpt_code).attr({
                                        'data_id': data.cpt_id,
                                        'data_description': data.display_description,
                                        'data_code': data.cpt_code
                                    }).removeClass('cptIsExists');
                                    $('#lblCptDescription_' + index).html(data.display_description).attr({
                                        'data_id': data.cpt_id,
                                        'data_description': data.display_description,
                                        'data_code': data.cpt_code
                                    }).removeClass('cptIsExists');
                                }
                                self.bindCPTSelectionEvents('#divCptCode_' + index);
                                self.bindCPTSelectionEvents('#divCptDescription_' + index);

                                $('#txtModifier1_' + index).val(data.modifier1_id ? self.getModifierCode(data.modifier1_id) : "").attr('data-id', data.modifier1_id);
                                $('#txtModifier2_' + index).val(data.modifier2_id ? self.getModifierCode(data.modifier2_id) : "").attr('data-id', data.modifier2_id);
                                $('#txtModifier3_' + index).val(data.modifier3_id ? self.getModifierCode(data.modifier3_id) : "").attr('data-id', data.modifier3_id);
                                $('#txtModifier4_' + index).val(data.modifier4_id ? self.getModifierCode(data.modifier4_id) : "").attr('data-id', data.modifier4_id);
                                $('#checkExclude_' + index).prop('checked', data.is_excluded);
                            });

                            if (self.openedFrom && self.openedFrom === 'patientSearch')
                                $('.claimProcess').hide(); // hide Next/Prev btn if opened from patient search

                            // trigger blur event for update Total bill fee, balance etc.
                            $(".allowedFee, .billFee").blur();
                            $(".diagCodes").blur();

                            if (app.country_alpha_3_code !== 'can') {
                                /*Bind ICD List if not canadian billing*/
                                claimDetails.claim_icd_data = claimDetails.claim_icd_data || [];
                                self.claimICDLists = [];
                                $('#ulSelectedDiagCodes').empty();
                                $('#hdnDiagCodes').val('');
                                $.each(claimDetails.claim_icd_data, function (index, obj) {
                                    self.ICDID = obj.icd_id;
                                    self.icd_code = obj.code;
                                    self.icd_description = obj.description

                                    self.claimICDLists.push({
                                        id: obj.id,
                                        icd_id: obj.icd_id,
                                        claim_id: self.claim_Id || null,
                                        is_deleted: false
                                    });
                                    self.addDiagCodes(false);
                                });

                                commonjs.enableModifiersOnbind('M'); // Modifier
                                commonjs.enableModifiersOnbind('P'); // Diagnostic Pointer
                            }
                            // clear icd details after bind
                            self.ICDID = self.icd_code = self.icd_description = '';

                            /* Edit claim bind Existing Insurance List -Start*/
                            var existingPrimaryInsurance = [];
                            var existingSecondaryInsurance = [];
                            var existingTriInsurance = [];
                            var existing_insurance = claimDetails.existing_insurance || [];

                            self.npiNo = claimDetails.npi_no || '';
                            self.federalTaxId = claimDetails.federal_tax_id || '';
                            self.enableInsuranceEligibility = claimDetails.enable_insurance_eligibility || '';

                            $.each(existing_insurance, function (index, value) {
                                switch (value.coverage_level) {
                                    case 'primary':
                                        existingPrimaryInsurance.push(value);
                                        break;
                                    case 'secondary':
                                        existingSecondaryInsurance.push(value);
                                        break;
                                    case 'tertiary':
                                        existingTriInsurance.push(value);
                                }
                            });
                            self.bindExistingInsurance(existingPrimaryInsurance, 'ddlExistPriIns')
                            self.bindExistingInsurance(existingSecondaryInsurance, 'ddlExistSecIns')
                            self.bindExistingInsurance(existingTriInsurance, 'ddlExistTerIns')
                            /* Edit claim bind Existing Insurance List - End */

                            $('#btnSaveClaim').attr('disabled', false);
                            $("#txtClaimDate").attr("disabled", "disabled");

                            self.bindDefaultClaimDetails(claimDetails);
                            $('.claimProcess').prop('disabled', false);
                            if (self.options && !self.options.study_id)
                                $('#btPatientDocuemnt').prop('disabled', true);

                            self.getAlertEvent(); // for Patient Alert Button Click event availability

                            /* Bind claim payment Details - start */
                                self.bindClaimPaymentLines(claimDetails.payment_details, false);
                                self.bindClaimPaymentEvent();
                            /* Bind claim payment Details - end */

                            if (app.country_alpha_3_code === 'can') {
                                $('label[for=txtPriPolicyNo] span').remove();
                                if (claimDetails.existing_insurance && claimDetails.existing_insurance.length && claimDetails.existing_insurance[0].insurance_code && ['HCP', 'WSIB'].indexOf(claimDetails.existing_insurance[0].insurance_code.toUpperCase()) >= 0) {
                                    self.priInsCode = claimDetails.existing_insurance[0].insurance_code;
                                    $('label[for=txtPriPolicyNo]').append("<span class='Required' style='color: red;padding-left: 5px;'>*</span>");
                                }
                            }

                            commonjs.hideLoading();
                        }
                    },
                    error: function (model, response) {
                        $('.claimProcess').attr('disabled', false);
                        commonjs.hideLoading();
                        commonjs.handleXhrError(model, response);
                    }
                });
            },

            getModifierCode : function(id) {
                var code = "";
                var modifierData = app.modifiers.filter(function(modifiers) {
                     return modifiers.id == id;
                });
                if(modifierData && modifierData.length > 0) {
                    code = modifierData[0].code;
                }
                return code;
            },

            createCptCodesUI: function(rowIndex) {
                $('#divChargeCpt_' + rowIndex)
                    .append($('<div/>', { id: "divCptCode_" + rowIndex }).addClass('pointerCursor select-container').attr('data-type','cpt')
                        .append($('<lable/>', { id: "lblCptCode_" + rowIndex }).addClass('cptcode cptIsExists select-container-label').attr('data-type','cpt').html("Select")
                                .mousemove(function(e){
                                    var msg = $(e.target).attr('data_code');
                                    $(e.target).attr('title',msg);
                                })));

                $('#divChargeCptDesc_' + rowIndex)
                    .append($('<div/>', { id: "divCptDescription_" + rowIndex }).addClass('pointerCursor select-container').attr('data-type','cptdesc')
                        .append($('<lable/>', { id: "lblCptDescription_" + rowIndex }).addClass('cptcode cptIsExists select-container-label').attr('data-type','cptdesc').html("Select")
                                .mousemove(function(e){
                                    var msg = $(e.target).attr('data_description');
                                    $(e.target).attr('title',msg);
                                })));
            },

            bindDefaultClaimDetails: function (claim_data) {
                var self = this;

                /* Claim section start*/

                var renderingProvider = claim_data.fac_reading_phy_full_name || claim_data.reading_phy_full_name || self.usermessage.selectStudyReadPhysician;
                var referringProvider = claim_data.ref_prov_full_name || self.usermessage.selectStudyRefProvider;
                var orderingFacility = claim_data.ordering_facility_name || claim_data.service_facility_name || self.usermessage.selectOrdFacility;

                self.ACSelect.readPhy.contact_id = claim_data.fac_rendering_provider_contact_id || claim_data.rendering_provider_contact_id || null;
                self.ACSelect.refPhy.contact_id = claim_data.referring_provider_contact_id || null;
                self.ACSelect.refPhy.Code = claim_data.ref_prov_code || null;
                self.ACSelect.refPhy.Desc = referringProvider;
                self.group_id = parseInt(claim_data.ordering_facility_id) || parseInt(claim_data.service_facility_id) || null;
                self.group_name = orderingFacility;

                $('#ddlBillingProvider').val(claim_data.fac_billing_provider_id || claim_data.billing_provider_id || '');
                $('#ddlFacility').val(claim_data.facility_id || '');
                $('#select2-ddlRenderingProvider-container').html(renderingProvider);
                $('#select2-ddlReferringProvider-container').html(referringProvider);
                $('#select2-ddlOrdFacility-container').html(orderingFacility);

                /* Claim section end */
                /* Additional info start*/

                claim_data.hospitalization_from_date ? self.hcf.date(claim_data.hospitalization_from_date) : self.hcf.clear();
                claim_data.hospitalization_to_date ? self.hct.date(claim_data.hospitalization_to_date) :self.hct.clear();
                claim_data.unable_to_work_from_date ? self.wcf.date(claim_data.unable_to_work_from_date) : self.wcf.clear();
                claim_data.unable_to_work_to_date ? self.wct.date(claim_data.unable_to_work_to_date ) :self.wct.clear();
                document.querySelector('#txtOtherDate').value = claim_data.same_illness_first_date ? moment(claim_data.same_illness_first_date).format('L') : '';
                document.querySelector('#txtDate').value = claim_data.current_illness_date ? moment(claim_data.current_illness_date).format('L') : '';


                $('input[name="outSideLab"]').prop('checked', claim_data.service_by_outside_lab);
                $('input[name="employment"]').prop('checked', claim_data.is_employed);
                $('input[name="autoAccident"]').prop('checked', claim_data.is_auto_accident);
                $('input[name="otherAccident"]').prop('checked', claim_data.is_other_accident);
                $('#txtOriginalRef').val(claim_data.original_reference ? claim_data.original_reference : '');
                $('#txtAuthorization').val(claim_data.authorization_no ? claim_data.authorization_no : '');
                $('#frequency').val(claim_data.frequency ? claim_data.frequency : '');

                /* Additional info end */
                /* Billing summary start */

                $('#txtClaimNotes').val(claim_data.claim_notes || '');
                $('#ddlBillingCode').val(claim_data.billing_code_id || '');
                $('#ddlBillingClass').val(claim_data.billing_class_id || '');
                $('#txtClaimResponsibleNotes').val(claim_data.billing_notes || '')

                if (claim_data.claim_fee_details && claim_data.claim_fee_details.length) {
                    var claim_fee_details = claim_data.claim_fee_details[0] || {};

                    $('#spBillFee').text(commonjs.roundFee(claim_fee_details.bill_fee || 0.00));
                    $('#spBalance').text(commonjs.roundFee(claim_fee_details.balance || 0.00));
                    $('#spAllowed').text(commonjs.roundFee(claim_fee_details.allowed || 0.00));
                    $('#spPatientPaid').text(commonjs.roundFee(claim_fee_details.patient_paid || 0.00));
                    $('#spOthersPaid').text(commonjs.roundFee(claim_fee_details.others_paid || 0.00));
                    $('#spAdjustment').text(commonjs.roundFee(claim_fee_details.adjustment || 0.00));
                    $('#spRefund').text(commonjs.roundFee(claim_fee_details.refund_amount || 0.00));
                }
                /* Billing summary end */

                /* ResponsibleList start*/

                self.updateResponsibleList({
                    payer_type: 'PPP',
                    payer_name: self.cur_patient_name + '( Patient )',
                    payer_id: self.cur_patient_id
                }, null);

                var facility = $('#ddlFacility option:selected').val();
                if (self.group_id || null) {
                    self.updateResponsibleList({
                        payer_type: 'POF',
                        payer_id: self.group_id,
                        payer_name: self.group_name + '(Service Facility)'
                    }, null);
                }

                if (self.ACSelect.refPhy.contact_id || null) {
                    self.updateResponsibleList({
                        payer_type: 'RF',
                        payer_id: self.ACSelect.refPhy.contact_id,
                        payer_name: self.ACSelect.refPhy.Desc + '(Referring Provider)'
                    }, null);
                }
                /* ResponsibleList End*/
                /* Common Details Edit & Claim creation */
                if (self.isEdit) {
                    self.bindEditClaimInsuranceDetails(claim_data);
                    var responsibleIndex = _.find(self.responsible_list, function (item) { return item.payer_type_name == claim_data.payer_type; });
                    $('#ddlClaimResponsible').val(responsibleIndex.payer_type);
                    $('#ddlClaimResponsible').data('current-payer',claim_data.payer_type);
                    $('#ddlClaimStatus').val(claim_data.claim_status_id || '');
                    $('#ddlFrequencyCode').val(claim_data.frequency || '')
                    $('#ddlPOSType').val(app.country_alpha_3_code !== 'can' && claim_data.place_of_service_id || '');
                    document.querySelector('#txtClaimDate').value = claim_data.claim_dt ? self.convertToTimeZone(claim_data.facility_id, claim_data.claim_dt).format('L') : '';
                } else {
                    var responsibleIndex = _.find(self.responsible_list, function (item) { return item.payer_type == 'PIP_P'; });
                    if (responsibleIndex && responsibleIndex.payer_id) {
                        $('#ddlClaimResponsible').val('PIP_P');
                    }else{
                        $('#ddlClaimResponsible').val('PPP');
                    }
                    $('#ddlClaimStatus').val($("option[data-desc = 'PV']").val());
                    var frequency = [{ code: 7, desc: 'corrected' }, { code: 8, desc: 'void' }, { code: 1, desc: 'original' }];
                    if (claim_data.frequency) {
                        var code = _.find(frequency, function (item) { return item.code == parseInt(claim_data.frequency); });
                        $('#ddlFrequencyCode').val(code.desc || '');
                    }
                    if (app.country_alpha_3_code !== 'can' && claim_data.pos_type_code && claim_data.pos_type_code != '') {
                        $('#ddlPOSType').val($('option[data-code = ' + claim_data.pos_type_code.trim() + ']').val());
                    } else if (app.country_alpha_3_code !== 'can') {
                        $('#ddlPOSType').val(claim_data.fac_place_of_service_id || '');
                    }
                    var currentDate = new Date();
                    var defaultStudyDate = moment(currentDate).format('L');
                    var lineItemStudyDate = self.studyDate && self.studyDate != '' ?  self.studyDate : '';
                    $('#txtClaimDate').val(self.studyDate ? lineItemStudyDate : defaultStudyDate);
                }
                /* Common Details end */

                //upate total billfee and balance
                $(".allowedFee, .billFee").blur();
                $(".diagCodes").blur();

            },

            checkRelationshipActive: function (id) {
                return $.grep(app.relationship_status, function (relationship) {
                    return id == relationship.id;
                }).length;
            },

            bindEditClaimInsuranceDetails: function (claimData) {
                var self = this;
                var states = app.states && app.states.length && app.states[0].app_states;

                if (claimData.p_insurance_provider_id || null) {

                    self.priInsID = claimData.p_insurance_provider_id
                    self.priInsName = claimData.p_insurance_name;
                    self.priInsCode = claimData.p_insurance_code;
                    $('#select2-ddlPriInsurance-container').html(claimData.p_insurance_name);
                    $('#chkPriAcptAsmt').prop('checked', claimData.p_assign_benefits_to_patient);
                    $('#lblPriInsPriAddr').html(claimData.p_address1);
                    var pri_csz = $.grep([claimData.p_city, claimData.p_state, claimData.p_zip], Boolean).join(", ");
                    $('#lblPriInsCityStateZip').html(pri_csz);
                    $('#lblPriPhoneNo').html(claimData.p_phone_no);
                    $('#txtPriPolicyNo').val(claimData.p_policy_number);
                    $('#txtPriGroupNo').val(claimData.p_group_number);
                    $("#ddlPriRelationShip").val(this.checkRelationshipActive(claimData.p_subscriber_relationship_id) ? claimData.p_subscriber_relationship_id : "");
                    var priSelf = ($('#ddlPriRelationShip option:selected').text()).toLowerCase();
                    ($.trim(priSelf) == 'self' || $.trim(priSelf) == 'select') ? $('#showPriSelf').hide() : $('#showPriSelf').show();
                    $('#txtPriSubFirstName').val(claimData.p_subscriber_firstname);
                    $('#txtPriSubMiName').val(claimData.p_subscriber_middlename);
                    $('#txtPriSubLastName').val(claimData.p_subscriber_lastname);
                    $('#txtPriSubSuffix').val(claimData.p_subscriber_name_suffix);
                    if (app.gender.indexOf(claimData.p_subscriber_gender) > -1) {
                        $('#ddlPriGender').val(claimData.p_subscriber_gender);
                    }
                    $('#txtPriSubPriAddr').val(claimData.p_subscriber_address_line1);
                    $('#txtPriSubSecAddr').val(claimData.p_subscriber_address_line2);

                    // Append dynamic address details for canadian config
                    var AddressInfoMap = {
                        city: {
                            domId: 'txtPriCity',
                            infoKey: 'p_subscriber_city'
                        },
                        state: {
                            domId: 'ddlPriState',
                            infoKey: 'p_subscriber_state'
                        },
                        zipCode: {
                            domId: 'txtPriZipCode',
                            infoKey: 'p_subscriber_zipcode'
                        }
                    }
                    self.bindCityStateZipTemplate(claimData, AddressInfoMap, 'Pri');

                    document.querySelector('#txtPriDOB').value = claimData.p_subscriber_dob ? moment(claimData.p_subscriber_dob).format('L') : '';
                    document.querySelector('#txtPriStartDate').value = claimData.p_valid_from_date ? moment(claimData.p_valid_from_date).format('L') : '';
                    document.querySelector('#txtPriExpDate').value = claimData.p_valid_to_date ? moment(claimData.p_valid_to_date).format('L') : '';

                    // append to ResponsibleList
                    self.updateResponsibleList({
                        payer_type: 'PIP_P',
                        payer_id: claimData.p_insurance_provider_id,
                        payer_name: claimData.p_insurance_name + '( Primary Insurance )',
                        billing_method: claimData.p_billing_method
                    }, null);
                }

                if (app.country_alpha_3_code !== 'can' && claimData.s_insurance_provider_id || null) {
                    self.secInsID = claimData.s_insurance_provider_id
                    self.SecInsName = claimData.s_insurance_name;
                    $('#select2-ddlSecInsurance-container').html(claimData.s_insurance_name);
                    $('#chkSecAcptAsmt').prop('checked', claimData.s_assign_benefits_to_patient);
                    $('#chkSecMedicarePayer').prop('checked', claimData.s_medicare_insurance_type_code ? true : false);
                    $('#selectMedicalPayer').toggle(claimData.s_medicare_insurance_type_code ? true : false);
                    $('#selectMedicalPayer').val(claimData.s_medicare_insurance_type_code);
                    $('#lblSecInsPriAddr').html(claimData.s_address1);
                    var sec_csz = $.grep([claimData.s_city, claimData.s_state, claimData.s_zip], Boolean).join(", ");
                    $('#lblSecInsCityStateZip').html(sec_csz);
                    $('#lblSecPhoneNo').html(claimData.s_phone_no);
                    $('#txtSecPolicyNo').val(claimData.s_policy_number);
                    $('#txtSecGroupNo').val(claimData.s_group_number);
                    $("#ddlSecRelationShip").val(this.checkRelationshipActive(claimData.s_subscriber_relationship_id) ? claimData.s_subscriber_relationship_id : "");
                    var secSelf = ($('#ddlSecRelationShip option:selected').text()).toLowerCase();
                    ($.trim(secSelf) == 'self' || $.trim(secSelf) == 'select') ? $('#showSecSelf').hide() : $('#showSecSelf').show();
                    $('#txtSecSubFirstName').val(claimData.s_subscriber_firstname);
                    $('#txtSecSubMiName').val(claimData.s_subscriber_middlename);
                    if (app.gender.indexOf(claimData.s_subscriber_gender) > -1) {
                        $('#ddlSecGender').val(claimData.s_subscriber_gender);
                    }
                    $('#txtSecSubLastName').val(claimData.s_subscriber_lastname);
                    $('#txtSecSubSuffix').val(claimData.s_subscriber_name_suffix);
                    $('#txtSecSubPriAddr').val(claimData.s_subscriber_address_line1);
                    $('#txtSecSubSecAddr').val(claimData.s_subscriber_address_line2);
                    $('#txtSecCity').val(claimData.s_subscriber_city);
                    //$('#ddlSecState').val(claimData.s_subscriber_state);
                    $('#txtSecZipCode').val(claimData.s_subscriber_zipcode);

                    if (states && states.indexOf(claimData.s_subscriber_state) > -1) {
                        $('#ddlSecState').val(claimData.s_subscriber_state);
                    }

                    document.querySelector('#txtSecDOB').value = claimData.s_subscriber_dob ? moment(claimData.s_subscriber_dob).format('L') : '';
                    document.querySelector('#txtSecStartDate').value = claimData.s_valid_from_date ? moment(claimData.s_valid_from_date).format('L') : '';
                    document.querySelector('#txtSecExpDate').value = claimData.s_valid_to_date ? moment(claimData.s_valid_to_date).format('L') : '';

                    // append to ResponsibleList
                    self.updateResponsibleList({
                        payer_type: 'PIP_S',
                        payer_id: claimData.s_insurance_provider_id,
                        payer_name: claimData.s_insurance_name + '( Secondary Insurance )',
                        billing_method: claimData.s_billing_method
                    }, null);
                }

                if (app.country_alpha_3_code !== 'can' && claimData.t_insurance_provider_id || null) {
                    self.terInsID = claimData.t_insurance_provider_id
                    self.terInsName = claimData.t_insurance_name;
                    $('#select2-ddlTerInsurance-container').html(claimData.t_insurance_name);
                    $('#chkTerAcptAsmt').prop('checked', claimData.t_assign_benefits_to_patient);
                    $('#lblTerInsPriAddr').html(claimData.t_address1);
                    var ter_csz = $.grep([claimData.t_city, claimData.t_state, claimData.t_zip], Boolean).join(", ");
                    $('#lblTerInsCityStateZip').html(ter_csz);
                    $('#lblTerPhoneNo').html(claimData.t_phone_no);
                    $('#txtTerPolicyNo').val(claimData.t_policy_number);
                    $('#txtTerGroupNo').val(claimData.t_group_number);
                    $("#ddlTerRelationShip").val(this.checkRelationshipActive(claimData.t_subscriber_relationship_id) ? claimData.t_subscriber_relationship_id : "");
                    var terSelf = ($('#ddlTerRelationShip option:selected').text()).toLowerCase();
                    ($.trim(terSelf) == 'self' || $.trim(terSelf) == 'select') ? $('#showTerSelf').hide() : $('#showTerSelf').show();
                    $('#txtTerSubFirstName').val(claimData.t_subscriber_firstname);
                    $('#txtTerSubMiName').val(claimData.t_subscriber_middlename);
                    if (app.gender.indexOf(claimData.t_subscriber_gender) > -1) {
                        $('#ddlTerGender').val(claimData.t_subscriber_gender);
                    }
                    $('#txtTerSubLastName').val(claimData.t_subscriber_lastname);
                    $('#txtTerSubSuffix').val(claimData.t_subscriber_name_suffix);
                    $('#txtTerSubPriAddr').val(claimData.t_subscriber_address_line1);
                    $('#txtTerSubSecAddr').val(claimData.t_subscriber_address_line2);
                    $('#txtTerCity').val(claimData.t_subscriber_city);
                    //$('#ddlTerState').val(claimData.t_subscriber_state);
                    $('#txtTerZipCode').val(claimData.t_subscriber_zipcode);

                    if (states && states.indexOf(claimData.t_subscriber_state) > -1) {
                        $('#ddlTerState').val(claimData.t_subscriber_state);
                    }

                    document.querySelector('#txtTerDOB').value = claimData.t_subscriber_dob ? moment(claimData.t_subscriber_dob).format('L') : '';
                    document.querySelector('#txtTerStartDate').value = claimData.t_valid_from_date ? moment(claimData.t_valid_from_date).format('L') : '';
                    document.querySelector('#txtTerExpDate').value = claimData.t_valid_to_date ? moment(claimData.t_valid_to_date).format('L') : '';

                    // append to ResponsibleList
                    self.updateResponsibleList({
                        payer_type: 'PIP_T',
                        payer_id: claimData.t_insurance_provider_id,
                        payer_name: claimData.t_insurance_name + '( Tertiary Insurance )',
                        billing_method: claimData.t_billing_method
                    }, null);
                }

            },

            showClaimForm: function (options, isFrom) {
                var self = this;
                var primaryStudyDetails;
                if (options && options.from === 'studies') {
                    primaryStudyDetails = options;
                    self.selectedStudyIds = options.study_id;
                    self.selectedOrderIds = [options.order_id];
                } else {
                    primaryStudyDetails = JSON.parse(window.localStorage.getItem('primary_study_details'));
                    self.selectedStudyIds = JSON.parse(window.localStorage.getItem('selected_studies'));
                    self.selectedOrderIds = JSON.parse(window.localStorage.getItem('selected_orders'));
                }
                self.cur_patient_id = primaryStudyDetails.patient_id ? parseInt(primaryStudyDetails.patient_id) : null;
                self.cur_patient_name = primaryStudyDetails.patient_name;
                self.cur_patient_acc_no = primaryStudyDetails.account_no;
                self.cur_patient_dob = primaryStudyDetails.patient_dob ? moment.utc(primaryStudyDetails.patient_dob).format('L') : null;
                self.pri_accession_no = primaryStudyDetails.accession_no || null;
                self.cur_study_id = primaryStudyDetails.study_id || null;
                self.isEdit = self.claim_Id ? true : false;
                self.facilityId = primaryStudyDetails.facility_id;
                if (options) {
                    options.study_id = primaryStudyDetails.study_id || null;
                    options.order_id = (self.selectedOrderIds && self.selectedOrderIds[0]) ? parseInt(self.selectedOrderIds[0]) : null;
                    options.patient_id = primaryStudyDetails.patient_id ? parseInt(primaryStudyDetails.patient_id) : null;
                }
                self.options = options || {};
                if (isFrom && isFrom != 'reload') {
                    self.openedFrom = isFrom
                }

                if (!this.rendered) {
                    if (self.isInitialLoaded) {
                        $('#tab_menu').find('li').removeClass('active');
                        $('#newClaimNavCharge').closest('li').addClass('active');
                        self.bindTabMenuEvents();
                    } else {
                        self.render('studies');
                    }
                }

                self.getLineItemsAndBind(self.selectedStudyIds);
                if (options && options.from === 'patientSearch') {
                    $('.claimProcess').hide();
                    self.bindDetails();
                    self.bindTabMenuEvents();
                }
                self.updateResponsibleList({
                    payer_type: 'PPP',
                    payer_name: self.cur_patient_name + '( Patient )',
                    payer_id: self.cur_patient_id
                }, null);

                self.bindclaimFormEvents();
                self.model.clear().set({ id: null });
            },

            showPatientForm: function () {
                var self = this;

                if (!this.rendered)
                    this.render('patientSearch');

                // Patient search events
                $('#anc_first, #anc_previous, #anc_next, #anc_last').off().click(function (e) {
                    self.onpaging(e);
                });

                $('.search-field').off().keyup(function (e) {
                    self.applySearch(e);
                });
            },

            bindclaimFormEvents: function (isFrom) {

                var self = this;
                $("#createNewCharge").off().click(function (e) {
                    self.addChargeLine(e);
                });

                $("#btnAddDiagCode").off().click(function (e) {
                    self.addDiagCodes(true);
                });

                $("#btnSaveClaim").off().click(function (e) {
                    self.saveClaimDetails(e);
                });

                $("#ddlExistTerIns, #ddlExistSecIns, #ddlExistPriIns").off().change(function (e) {
                    self.assignExistInsurance(e);
                });

                $("#ddlPriRelationShip, #ddlSecRelationShip, #ddlTerRelationShip").off().change(function (e) {
                    self.showSelf(e);
                    self.changeRelationalShip(e);
                });

                $(".closePopup").off().click(function (e) {
                    $('#site_modal_div_container').empty().hide();
                });

                $("#chkSecMedicarePayer").off().change(function (e) {
                    $('#selectMedicalPayer').toggle($('#chkSecMedicarePayer').is(':checked')).val('');
                });

                $("#btnResetPriInsurance, #btnResetSecInsurance, #btnResetTerInsurance").off().click(function (e) {
                   self.insuranceUpdate(e);
                });

                $("#btnValidateClaim").off().click(function (e) {
                    self.validateClaim();
                });

                $("#btPatientDocuemnt").off().click(function (e) {
                   commonjs.openDocumentsAndReports(self.options);
                });

                $("#btnPatientNotes").off().click(function (e) {
                    commonjs.openNotes(self.options);
                });

                $(".claimProcess").off().click(function (e) {
                    self.processClaim(e);
                });

                $('#btnCheckEligibility, #btnCheckEligibility2, #btnCheckEligibility3').off().click(function (e) {
                    self.checkInsuranceEligibility(e);
                });

                //Todo
                // $('#tab_menu a').off().click(function (e) {
                //     self.urlNavigation(e);
                // });

                $("#chkPriSelf").off().change(function (e) {
                    self.setPriRelationShipSelf(e);
                    self.changeRelationalShip(e);
                });

                $(" #chkSecSelf").off().change(function (e) {
                    self.setSecRelationShipSelf(e);
                    self.changeRelationalShip(e);
                });

                $(" #chkTerSelf").off().change(function (e) {
                    self.setTerRelationShipSelf(e);
                    self.changeRelationalShip(e);
                });

                if (isFrom && isFrom != 'reload') {
                    $('#modal_div_container').animate({ scrollTop: 0 }, 100);
                }
            },
            getLineItemsAndBind: function (selectedStudyIds) {
                var self = this;
                self.chargeModel = [];
                self.patientAlerts = [];
                self.studyDate = commonjs.getConvertedFacilityTime(app.currentdate, '', 'L', app.facilityID);
                if (selectedStudyIds) {
                    commonjs.showLoading();
                    $.ajax({
                        type: 'GET',
                        url: '/exa_modules/billing/claims/claim/line_items',
                        data: {
                            from: 'claimCreation',
                            study_ids: selectedStudyIds,
                            patient_id: self.cur_patient_id || 0,
                        },
                        success: function (model, response) {
                            self.claimICDLists =[];
                            if (model && model.length > 0) {
                                $('#tBodyCharge').empty();
                                $('#btnValidateClaim').hide();
                                var modelDetails = model[0];
                                self.studyDate = modelDetails && modelDetails.charges && modelDetails.charges.length && modelDetails.charges[0].study_dt ? commonjs.getConvertedFacilityTime(modelDetails.charges[0].study_dt, '', 'L', self.facilityId) : self.studyDate;
                                self.facilityId = modelDetails && modelDetails.charges && modelDetails.charges.length && modelDetails.charges[0].facility_id ? modelDetails.charges[0].facility_id : self.facilityId ;
                                var _defaultDetails = modelDetails.claim_details && modelDetails.claim_details.length > 0 ? modelDetails.claim_details[0] : {};
                                var _diagnosisProblems = modelDetails.problems && modelDetails.problems.length > 0 ? modelDetails.problems : [];
                                var diagnosisCodes = [];
                                self.patientAddress = _defaultDetails.patient_info ? _defaultDetails.patient_info : {};
                                self.addPatientHeaderDetails(_defaultDetails, 'create')

                                /* Patient Alert data Bind Started */
                                self.patientAlerts = _defaultDetails.alerts;
                                self.showAlertBadge();
                                /* Patient Alert data Bind Ended */

                                self.claim_dt_iso = modelDetails && commonjs.checkNotEmpty(modelDetails.study_dt)
                                        ? commonjs.convertToFacilityTimeZone(self.facilityId, modelDetails.study_dt)
                                        : commonjs.convertToFacilityTimeZone(app.facilityID, app.currentdate);
                                self.studyDate = self.claim_dt_iso ? self.claim_dt_iso.format('L') : self.studyDate;
                                $('#txtClaimDate').val(self.studyDate || '');
                                self.claim_dt_iso = self.claim_dt_iso.format('YYYY-MM-DD LT z');

                                _.each(modelDetails.charges, function (item) {
                                    var index = $('#tBodyCharge').find('tr').length;
                                    item.data_row_id = index;
                                    self.addLineItems(item, index, true);

                                    self.chargeModel.push({
                                        id: null,
                                        claim_id: null,
                                        ref_charge_id: item.study_cpt_id,
                                        accession_no: item.accession_no,
                                        study_id: item.study_id,
                                        data_row_id: index
                                    });
                                });

                                if (app.country_alpha_3_code !== 'can') {
                                    _.each(_diagnosisProblems, function (item) {

                                        if (_.findIndex(diagnosisCodes, { id: item.id }) == -1) {
                                            diagnosisCodes.push({ id: item.id, code: item.code, description: item.description });
                                        }

                                    });

                                    self.bindProblemsContent(diagnosisCodes);
                                }

                                setTimeout(function () {
                                    self.bindDefaultClaimDetails(_defaultDetails);
                                }, 200);


                                /* Bind chargeLineItems events - started*/
                                if(self.screenCode.indexOf('DCLM') > -1) {
                                    $('span[id^="spDeleteCharge"]').removeClass('removecharge');
                                    $('span[id^="spDeleteCharge"]').css('color','#DCDCDC');
                                }

                                self.assignLineItemsEvents();
                                self.assignModifierEvent();
                                app.modifiers_in_order = true;
                                commonjs.enableModifiersOnbind('M'); // Modifier
                                commonjs.enableModifiersOnbind('P'); // Diagnostic Pointer
                                commonjs.validateControls();
                                commonjs.isMaskValidate();
                                /* Bind chargeLineItems events - Ended */

                                self.getAlertEvent(); // for Patient Alert Button Click event availability

                                $("#txtClaimDate").attr("disabled", "disabled");
                                if (self.isInitialLoaded) {
                                    self.bindDetails(true);
                                    self.bindTabMenuEvents();
                                } else {
                                    $('.claimProcess').prop('disabled', false);
                                    commonjs.hideLoading();
                                }
                                commonjs.updateCulture(app.currentCulture, commonjs.beautifyMe);
                            }
                        },
                        error: function (model, response) {
                            $('.claimProcess').prop('disabled', false);
                            commonjs.hideLoading();
                            commonjs.handleXhrError(model, response);
                        }
                    })

                }

            },

            addChargeLine: function (e) {
                e.stopImmediatePropagation();
                var self = this;
                var _targetId = $(e.target || e.srcElement).attr('id');
                if (_targetId == "createNewCharge") {
                    var index = $('#tBodyCharge tr:last').attr('data_row_id') ? $('#tBodyCharge tr:last').attr('data_row_id') : -1;
                    var rowData = _.find(self.chargeModel, { 'data_row_id': parseInt(index) });
                    var _rowObj = {
                        id: null,
                        claim_id: self.claim_Id || null,
                        ref_charge_id: null,
                        study_id: self.isEdit ? (rowData && rowData.study_id || null) : (self.cur_study_id || null),
                        accession_no: $('#tBodyCharge tr:first').length > 0 ? $('#tBodyCharge tr:first').find('.charges__accession-num').text().trim() : (self.pri_accession_no || null),
                        data_row_id: parseInt(index) + 1
                    }
                } else {
                    var rowObj = $(e.target || e.srcElement).closest('tr');
                    var accession_no = $.trim(rowObj.find('.charges__accession-num').text())
                    var index = rowObj.length > 0 ? $('#tBodyCharge tr:last').attr('data_row_id') : 0;
                    var rowData = _.find(self.chargeModel, { 'data_row_id': parseInt(rowObj.attr('data_row_id')) });
                    var _rowObj = {
                        id: null,
                        claim_id: rowData.claim_id ? rowData.claim_id : null,
                        ref_charge_id: null,
                        study_id: rowData.study_id,
                        accession_no: rowData.accession_no,
                        data_row_id: parseInt(index) + 1
                    }
                }

                self.bindModifiersData(_rowObj);

                self.addLineItems(_rowObj, _rowObj.data_row_id, false);
                self.assignLineItemsEvents();
                self.assignModifierEvent();
                app.modifiers_in_order = true;
                commonjs.enableModifiersOnbind('M'); // Modifier
                commonjs.enableModifiersOnbind('P'); // Diagnostic Pointer
                commonjs.validateControls();
                commonjs.isMaskValidate();
                self.chargeModel.push(_rowObj);

            },

            bindModifiersData: function(rowObj) {
                var m = 1;
                var data = function(id) {
                    var modifiers = app.modifiers.filter(function(item){
                        return item['modifier' + id] == "true" || item['modifier' + id] == true;
                    });
                    rowObj["modifiers" + id] = modifiers;
                    m++;
                    if(m < 5) {
                        data(m);
                    }

                }
                data(m);
            },

            addLineItems: function (data, index, isDefault) {
                var self = this;

                data.charge_dt = self.studyDate ? self.studyDate : '--';
                self.bindModifiersData(data);
                var chargeTableRow = self.chargerowtemplate({
                    country_alpha_3_code: app.country_alpha_3_code,
                    row: data
                });
                $('#tBodyCharge').append(chargeTableRow);

                /* Bind charge table data*/

                self.createCptCodesUI(index);

                if (data.cpt_code || data.display_description) {
                    $('#lblCptCode_' + index)
                            .html(data.cpt_code)
                            .attr({'data_id': data.cpt_id}).removeClass('cptIsExists');
                    $('#lblCptDescription_' + index).html(data.display_description).attr({'data_id': data.cpt_id}).removeClass('cptIsExists');
                }

                self.bindCPTSelectionEvents('#divCptCode_' + index);
                self.bindCPTSelectionEvents('#divCptDescription_' + index);


                // modifiers dropdown
                for (var m = 1; m <= 4; m++) {

                    var arr = jQuery.grep(app.modifiers, function (n, i) {
                        return (n['modifier' + m] == true || n['modifier' + m] == 'true');
                    });

                    // bind default pointer from line items
                    if (isDefault) {
                        var _pointer = data.icd_pointers && data.icd_pointers[m - 1] ? data.icd_pointers[m - 1] : '';
                        $('#ddlPointer' + m + '_' + index).val(_pointer);
                        $('#txtModifier' + m + '_' + index).val(data['m' + m] ? self.getModifierCode(data['m' + m]) : "").attr('data-id', data['m' + m]);
                        //self.bindModifiersData('ddlModifier' + m + '_' + index, arr);
                    }else{
                        $('#ddlPointer' + m + '_' + index).val(data['pointer' + m]);
                        // ToDo:: Once modifiers dropdown added have to bind
                        $('#txtModifier' + m + '_' + index).val(data['modifier' + m +'_id'] ? self.getModifierCode(data['modifier' + m +'_id']) : null).attr('data-id',data['modifier' + m +'_id']);
                    }

                }

            },

            bindCPTSelectionEvents: function (el) {
                var self = this;
                $(el).click(function (e) {
                    if(!$(this).prop('disabled')) {
                        e.stopImmediatePropagation();
                        var targetID = e.target.id;
                        var rowIndex = targetID.split('_')[1];
                        var type = $(e.target).attr('data-type');
                        if (type == 'cpt') {
                            self.createCPTSelectionUI(rowIndex, 'cpt');
                            self.setChargeAutoComplete(rowIndex, 'code');
                            $('#divCptCode_' + rowIndex).hide();
                            $('#divSelCptCode_' + rowIndex).show();
                            $('#select2-txtCptCode_' + rowIndex + '-container').html($('#lblCptCode_' + rowIndex).html()).attr({
                                'data_id': $('#lblCptCode_' + rowIndex).attr('data_id'),
                                'data_description': $('#lblCptCode_' + rowIndex).attr('data_description'),
                                'data_code': $('#lblCptCode_' + rowIndex).attr('data_code')
                            });
                            $('#divCptDescription_' + rowIndex).prop('disabled', true);
                        } else {
                            self.createCPTSelectionUI(rowIndex, 'cptdesc');
                            self.setChargeAutoComplete(rowIndex, 'description');
                            $('#divCptDescription_' + rowIndex).hide();
                            $('#divSelCptDescription_' + rowIndex).show();
                            $('#divCptCode_' + rowIndex).prop('disabled', true);
                            $('#select2-txtCptDescription_' + rowIndex + '-container').html($('#lblCptDescription_' + rowIndex).html()).attr({
                                'data_id': $('#lblCptDescription_' + rowIndex).attr('data_id'),
                                'data_description': $('#lblCptDescription_' + rowIndex).attr('data_description'),
                                'data_code': $('#lblCptDescription_' + rowIndex).attr('data_code')
                            });
                        }
                    }
                });
            },

            createCPTSelectionUI: function(rowIndex, type) {
                if(type == 'cpt') {
                    $('#divChargeCpt_' + rowIndex)
                    .append($('<div/>',{id:'divSelCptCode_' + rowIndex})
                    .append($('<select/>',{id:'txtCptCode_' + rowIndex})));
                } else {
                    $('#divChargeCptDesc_' + rowIndex)
                    .append($('<div/>',{id:'divSelCptDescription_' + rowIndex})
                    .append($('<select/>',{id:'txtCptDescription_' + rowIndex})));
                }
            },

            assignModifierEvent: function () {
                var self = this;

                $('.inputModifiers')
                    .on("keydown", function (evt) {
                        evt = (evt) ? evt : window.event;
                        var charCode = (evt.which) ? evt.which : evt.keyCode;
                        if (!$(evt.target).hasClass('diagCodes')) {
                            if (charCode > 31 && (charCode < 46 || charCode > 90) && (charCode < 96 || charCode > 105))
                                return false;
                        }
                        else {
                            if (charCode > 31 && (charCode < 48 || charCode > 57) && (charCode < 96 || charCode > 105))
                                return false;
                        }
                        return true;
                    })
                    .on("keyup", function (e) {
                        var _isFrom = $(e.target).hasClass('diagCodes') ? 'P' : 'M';
                        self.checkInputModifiersValues(e, _isFrom);
                    })
                    .on("change", function (e) {
                        var _isFrom = $(e.target).hasClass('diagCodes') ? 'P' : 'M';
                        self.checkInputModifiersValues(e, _isFrom,null,'change');
                    })
                    .on("blur", function (e) {
                        var _isFrom = $(e.target).hasClass('diagCodes') ? 'P' : 'M';
                        self.checkInputModifiersValues(e, _isFrom, null,'blur');
                        var content = $(e.target).val();
                        if(_isFrom == 'M') {
                            var validContent = app.modifiers.filter(function(modifier) {
                                return modifier.code == content;
                            });
                            if(validContent && validContent.length > 0) {
                                $(e.target).attr('data-id', validContent[0].id);
                            } else {
                                $(e.target).attr('data-id',null);
                            }
                        }
                    });

                $('.units').on("blur", function (e) {
                    var dataContent = $(e.target).val() != '' ? $(e.target).val() : 1.000;
                    if (parseFloat(dataContent) != 0) {
                        $(e.target).css('border-color', '')
                        $(e.target).removeClass('invalidUnites')
                    }
                    else {
                        $(e.target).css('border-color', 'red')
                        $(e.target).addClass('invalidUnites')
                    }
                });
            },

            checkInputModifiersValues: function (e, isFrom, isEdit, evType) {
                var self = this;
                if (isFrom == 'P') { // Diagnostic Pointer

                    if (isEdit) { // for edit purpose Billing flag
                        var dataContent = $(e.target).val();
                        var modifierLevel = $(e.target).attr('data-type');
                        if (dataContent != '') {
                            if (dataContent <= self.icdCodeList.length && dataContent != 0) {
                                $(e.target).css('border-color', '')
                                $(e.target).removeClass('invalidModifier')
                            }
                            else {
                                $(e.target).css('border-color', 'red')
                                $(e.target).addClass('invalidModifier')
                            }
                        }
                        else {
                            $(e.target).css('border-color', '')
                            $(e.target).removeClass('invalidModifier')
                        }
                    } else {
                        var count = $('ul.icdTagList li').length;
                        var _pointers = [], iterator = 1;
                        jQuery.grep($('.diagCodes'), function (value) {
                            count = count ? count : self.icdCodeListLength;
                            var val = $(value).val() ? $(value).val() : 0;
                            var _id = $(value).attr('id');
                            if (val != '') {
                                if (val <= count && val != 0) {
                                    $('#' + _id).css('border-color', '')
                                    $('#' + _id).removeClass('invalidCpt')
                                    if (_pointers.indexOf(val) != -1 && iterator <= 4)
                                        $('#' + _id).css('border-color', 'red').addClass('invalidCpt');
                                    else
                                        _pointers.push(val);
                                }
                                else {
                                    $('#' + _id).css('border-color', 'red')
                                    $('#' + _id).addClass('invalidCpt')
                                }
                            } else {
                                $('#' + _id).css('border-color', '')
                                $('#' + _id).removeClass('invalidCpt')
                            }
                            if (iterator >= 4) {
                                iterator = 1;
                                _pointers = [];
                            }
                            else
                                iterator++;

                        });
                    }
                    commonjs.activateInputModifiers(isFrom, e.target);
                }
                else if (isFrom == 'M') { // Modifiers

                    var dataContent = $(e.target).val();
                    var modifierLevel = $(e.target).attr('data-type');
                    modifierLevel = modifierLevel.replace('M','modifier');
                    var existData = [];
                    if (dataContent != '') {
                        var existData = jQuery.grep(app.modifiers, function (value) {
                            return (value.code.toLowerCase().indexOf(dataContent.toLowerCase()) > -1 && (value[modifierLevel] == true || value[modifierLevel] == 'true'));
                        });

                        if (existData.length > 0 && dataContent && dataContent.length == 2) {
                            $(e.target).css('border-color', '')
                            $(e.target).removeClass('invalidModifier')
                        }
                        else {
                            $(e.target).css('border-color', 'red')
                            $(e.target).addClass('invalidModifier')
                        }
                    }
                    else {
                        $(e.target).css('border-color', '')
                        $(e.target).removeClass('invalidModifier');
                        $(e.target).removeClass("invalidCpt");
                        $('#divModifierList').remove();
                    }
                    commonjs.activateInputModifiers(isFrom, e.target);
                    if(existData.length > 0 && !evType) {
                            self.createModifierDropDown(e, existData);
                        } else {
                             $('#divModifierList').remove();
                        }
                }

            },

            createModifierDropDown: function(e, existData) {
                $('#divModifierList').remove();
                $(e.target).parent().append($('<div/>' , {id:'divModifierList'}));
                var divModifierList = $('#divModifierList');
                divModifierList.empty();
                var modifierEl = $('<div/>').addClass('dropdown-menu');
                divModifierList.append(modifierEl);
                for(var i = 0; i < existData.length; i++) {
                     modifierEl
                        .append($('<div/>').addClass('dropdown-item').hover(function() {
                            $(this).css({'background-color':'#337ab7'});
                        },function(){
                            $(this).css({'background-color':'transparent'});
                        })
                        .mousedown(function(event) {
                            $(e.target).val($(this).html());
                            $('#divModifierList').remove();
                        })
                        .html(existData[i].code));
                }
                $(e.target).css('border-color', '')
                $(e.target).removeClass('invalidModifier')
                var top = $(e.target).offset().top + $(e.target).outerHeight();
                var left = $(e.target).offset().left
                divModifierList.css({'position':'relative', 'display':'block'});
                modifierEl.css({'display':'block','z-index':'10001'});
            },

            assignLineItemsEvents: function () {
                var self = this;

                // Add NewChargeLine
                $(".addChargeLine").off().click(function (e) {
                    self.addChargeLine(e);
                });
                // Remove line item form charge table
                $('.removecharge').off().click(function (e) {

                    var rowObj = $(e.target || e.srcElement).closest('tr');
                    var rowId = parseInt(rowObj.attr('data_row_id'))
                    var rowData = _.find(self.chargeModel, { 'data_row_id': rowId });

                    if ($('#tBodyCharge tr').length <= 1) {
                        commonjs.showWarning("messages.warning.claims.claimChargeRequired");
                        return false;
                    }
                    if (rowData.id) {
                        $.ajax({
                            url: '/exa_modules/billing/claim_workbench/charge_check_payment_details',
                            type: 'GET',
                            data: {
                                charge_id: rowData.id,
                            },
                            success: function (data, response) {
                                var msg = commonjs.geti18NString("messages.confirm.billing.deletionConfirmation")
                                if (confirm(msg)) {
                                    if (rowData.payment_exists && data.rows[0].is_payment_available != 0 ) {
                                        var alertMsg = commonjs.geti18NString("messages.warning.claims.chargeDeleteValidation")
                                        alert(alertMsg);
                                    } else {
                                        self.removeChargeFromDB(rowData.id, function (response) {
                                            if (response && response.status) {
                                                removeCharge(rowData, rowId, rowObj);
                                            } else {
                                                commonjs.showWarning("messages.errors.errorOnChargeDeletion");
                                            }
                                        });
                                    }
                                }

                            },
                            error: function (err, response) {
                                commonjs.handleXhrError(err, response);
                            }
                        });
                    } else {
                        removeCharge(rowData, rowId, rowObj);
                    }
                });
                // Enable bill_fee
                $('span[id^="editBillFee"]').off().click(function (e) {
                    var index = $(e.target || e.srcElement).closest('tr').attr('data_row_id');
                    $('#txtBillFee_' + index).attr({ disabled: false, edit: true }).focus();
                    $('#txtAllowedFee_' + index).attr({ disabled: false, edit: true });
                });

                // changeFee details on keup
                $(".units, .billFee, .allowedFee").off().blur(function (e) {
                    self.changeFeeData(e)
                });

                var removeCharge = function(rowData,  rowId, rowObj){

                    if (rowData.id || null) {
                        self.removedCharges.push({
                            id: parseInt(rowData.id),
                            claim_id: rowData.claim_id ? rowData.claim_id : null,
                            last_updated_by: app.userID,
                            deleted_by: app.userID,
                            is_deleted: true
                        });
                    }
                    self.chargeModel = _.reject(self.chargeModel, function(d) { return d.data_row_id === rowId;});
                    rowObj.remove();
                    // trigger blur event for update Total bill fee, balance etc.
                    $(".allowedFee, .billFee").blur();

                };

            },

            removeChargeFromDB: function(chargeId, callback){
                var self = this;

                $.ajax({
                    type: 'PUT',
                    url: '/exa_modules/billing/claim_workbench/claim_charge/delete',
                    data: {
                        target_id: chargeId,
                        type: 'charge',
                        screenName: 'claims'
                    },
                    success: function (model, response) {
                        console.log(model);
                        if(model && model.rowCount){
                            var _status = model.rows && model.rows.length && model.rows[0].purge_claim_or_charge ? model.rows[0].purge_claim_or_charge : false
                            callback({
                                status: _status
                            })
                        }else{
                            callback(model)
                        }
                    },
                    error: function (model, response) {

                        commonjs.handleXhrError(model, response);
                    }
                })
            },

            changeFeeData: function (e) {
                var self = this, total_bill_fee = 0.0, total_allowed = 0.0, patient_paid = 0.0, others_paid = 0.0, refund = 0.0, adjustemnt_amout = 0.0;
                if (!commonjs.checkNotEmpty($(e.target || e.srcElement).val()))
                    $(e.target || e.srcElement).hasClass('units') ? $(e.target || e.srcElement).val('1.000') : $(e.target || e.srcElement).val('0.00');
                if (commonjs.checkNotEmpty($(e.target || e.srcElement).val()) && !$(e.target || e.srcElement).hasClass('units')) {
                    var billingNumber = $(e.target || e.srcElement).val()
                    $(e.target || e.srcElement).val(parseFloat(billingNumber).toFixed(2));
                }
                var rowID = $(e.target || e.srcElement).closest('tr').attr('data_row_id');
                var totalBillFee = parseFloat($('#txtUnits_' + rowID).val()) * parseFloat($('#txtBillFee_' + rowID).val());
                $('#txtTotalBillFee_' + rowID).val(totalBillFee.toFixed(2));

                if(app.country_alpha_3_code !== 'can'){
                    var totalAllowedFee = parseFloat($('#txtUnits_' + rowID).val()) * parseFloat($('#txtAllowedFee_' + rowID).val());
                    $('#txtTotalAllowedFee_' + rowID).val(totalAllowedFee.toFixed(2));
                }

                $("#tBodyCharge").find("tr").each(function (index) {
                    var $totalbillFee = $(this).find("#txtTotalBillFee_" + index);
                    var thisTotalBillFee = $totalbillFee.val() || 0.00;
                    total_bill_fee = total_bill_fee + parseFloat(thisTotalBillFee);

                    if(app.country_alpha_3_code !== 'can'){
                        var $totalAllowedFee = $(this).find("#txtTotalAllowedFee_" + index);
                        var thisTotalAllowed = $totalAllowedFee.val() || 0.00;
                        total_allowed = total_allowed + parseFloat(thisTotalAllowed);
                    }
                });
                var patient_paid = parseFloat($('#spPatientPaid').text());
                var others_paid = parseFloat($('#spOthersPaid').text());
                var refund_amount = parseFloat($('#spRefund').text());
                var adjustment_amount = parseFloat($('#spAdjustment').text());
                $('#spTotalBillFeeValue').text(commonjs.roundFee(total_bill_fee));
                $('#spBillFee').text(commonjs.roundFee(total_bill_fee));
                var balance = total_bill_fee - (patient_paid + others_paid + adjustment_amount + refund_amount);
                $('#spBalance').text(commonjs.roundFee(balance));

                if(app.country_alpha_3_code !== 'can'){
                    $('#spTotalAllowedFeeValue').text(commonjs.roundFee(total_allowed));
                    $('#spAllowed').text(commonjs.roundFee(total_allowed));
                }
            },

            updateResponsibleList: function (payer_details, paymentDetails) {
                var self = this, index, responsibleEle, selected_opt;
                var paymentPayerEle = $('#tBodyPayment tr').find("[id^=ddlPayerName]").filter(':input:enabled');
                // Inner function used to create dynamic options;
                function getOption (obj){
                    return $('<option/>').attr('value', obj.payer_type).text(obj.payer_name);
                };

                if (!paymentDetails) {
                    index = _.findIndex(self.responsible_list, function (item) { return item.payer_type == payer_details.payer_type; });
                    if (index > -1) {
                        self.responsible_list[index].payer_id = payer_details.payer_id;
                        self.responsible_list[index].payer_name = payer_details.payer_name;
                        self.responsible_list[index].billing_method = payer_details.billing_method;
                    }
                    responsibleEle = $('#ddlClaimResponsible');
                    selected_opt = responsibleEle.find('option[value="' + payer_details.payer_type + '"]');
                    if (!payer_details.payer_name) {
                        selected_opt.remove();
                    } else if (selected_opt && selected_opt.length && payer_details.payer_name) {
                        $(selected_opt).text(payer_details.payer_name)
                    } else {
                        $(responsibleEle).append(getOption(payer_details));
                        if (paymentPayerEle.length) {
                            $(paymentPayerEle).append(getOption(payer_details));
                        }
                    }
                } else {
                    // Append claim responsible as payment payer
                    responsibleEle = $('#ddlPayerName_' + paymentDetails.row_id);
                    $.each(self.responsible_list, function (index, obj) {
                        if (obj.payer_id) {
                            $(responsibleEle).append(getOption(obj));
                        }
                    });
                }
            },

            setChargeAutoComplete: function (rowIndex, type) {
                var self = this;
                var txtCptCode = 'txtCptCode_' + rowIndex;
                var txtCptDescription = 'txtCptDescription_' + rowIndex;
                var id = '';
                var message = '';
                if (type == 'code') {
                    id = txtCptCode;
                    message = self.usermessage.selectcptcode;
                }
                else {
                    id = txtCptDescription;
                    message = self.usermessage.selectcptdescription;
                }

                $("#" + id).select2({
                    ajax: {
                        url: "/exa_modules/billing/autoCompleteRouter",
                        dataType: 'json',
                        delay: 250,
                        data: function (params) {
                            return {
                                page: params.page || 1,
                                q: params.term || '',
                                pageSize: 10,
                                sortField: "trim(display_description)",
                                sortOrder: "asc",
                                company_id: app.companyID
                            };
                        },
                        processResults: function (data, params) {
                            return commonjs.getTotalRecords(data, params);
                        },
                        cache: true
                    },
                    placeholder: message,
                    escapeMarkup: function (markup) { return markup; }, // let our custom formatter work
                    minimumInputLength: 0,
                    templateResult: formatRepo
                });
                function formatRepo(repo) {
                    if (repo.loading) {
                        return repo.text;
                    }
                    if (repo.is_active || repo.is_active == undefined) {
                        var markup = "<table><tr>";
                        if (repo.display_code != '')
                            markup += "<td title='" + repo.display_code + (repo.display_description ? "(" + repo.display_description + ")" : '') + "'><div>" + repo.display_code + (repo.display_description ? "(" + repo.display_description + ")" : '') + "</div>";
                        else
                            markup += "<td title='" + repo.display_code + repo.display_description ? repo.display_description : '' + "'><div>" + repo.display_code + repo.display_description ? repo.display_description : '' + "</div>";
                        markup += "</td></tr></table>"
                        return markup;
                    }
                    else {
                        var markup1 = "<table><tr class='inActiveRow'>";
                        if (repo.display_code != '')
                            markup1 += "<td title='" + repo.display_code + "(" + repo.display_description + ")" + "'><div>" + repo.display_code + "(" + repo.display_description + ")" + "</div>";
                        else
                            markup += "<td title='" + repo.display_code + repo.display_description + "'><div>" + repo.display_code + repo.display_description + "</div>";
                        markup1 += "</td></tr></table>"
                        return markup1;
                    }
                }
                $('#' + id).select2('open');
                $('#' + id).on('select2:selecting',function(e) {
                    var res = e.params.args.data;
                     if (res.id) {
                        var duration = (res.duration > 0) ? res.duration : 15;
                        var units = (res.units > 0) ? parseFloat(res.units) : 1.0;
                        var fee = (res.globalfee > 0) ? parseFloat(res.globalfee) : 0.0;
                        if(self.isCptAlreadyExists(res.id,rowIndex)) {
                            var msg = commonjs.geti18NString("messages.confirm.billing.duplicateCode")
                            if(confirm(msg)) {
                                self.setCptValues(rowIndex, res, duration, units, fee, type);
                            }
                        } else {
                            self.setCptValues(rowIndex, res, duration, units, fee, type);
                        }
                    }
                });
                $('#' + id).on('select2:close', function (e) {
                    var rowIndex = e.target.id.split('_')[1];
                    self.hideCptSelections(rowIndex, type);
                });
            },

            isCptAlreadyExists: function(cptID,rowID) {
                var isExists = false;
                 $('#tBodyCharge').find('tr').each(function (index, rowObject) {
                    var id = $(this).attr('data_row_id');
                    var cpt_code_id = $('#lblCptCode_' + id).attr('data_id');
                    if(rowID != id && cpt_code_id == cptID) {
                        isExists = true;
                    }
                 });
                 return isExists;
            },

            hideCptSelections: function(rowIndex, type) {
                if(type == 'code') {
                    $('#divCptDescription_' + rowIndex).prop('disabled', false);
                    $('#divCptCode_' + rowIndex).show();
                    $('#divSelCptCode_' + rowIndex).remove();
                } else {
                    $('#divCptCode_' + rowIndex).prop('disabled', false);
                    $('#divCptDescription_' + rowIndex).show();
                    $('#divSelCptDescription_' + rowIndex).remove();
                }
            },

            setCptValues: function (rowIndex, res, duration, units, fee, type) {
                $('#lblCptCode_' + rowIndex)
                    .html(res.display_code)
                    .attr({
                        'data_id': res.id,
                        'data_description': res.display_description,
                        'data_code': res.display_code
                    }).removeClass('cptIsExists');
                $('#lblCptDescription_' + rowIndex)
                    .html(res.display_description)
                    .attr({
                        'data_id': res.id,
                        'data_description': res.display_description,
                        'data_code': res.display_code
                    }).removeClass('cptIsExists');

                $('#txtUnits_' + rowIndex).val(units);
                $('#txtBillFee_' + rowIndex).val(parseFloat(fee).toFixed(2));
                $('#txtTotalBillFee_' + rowIndex).val(parseFloat(units * fee).toFixed(2));

                if(app.country_alpha_3_code !== 'can') {
                    $('#txtAllowedFee_' + rowIndex).val(parseFloat(fee).toFixed(2));
                    $('#txtTotalAllowedFee_' + rowIndex).val(parseFloat(units * fee).toFixed(2));
                }
            },

            setProviderAutoComplete: function (provider_type) {
                var self = this, _id;

                if (provider_type == 'PR') {
                    _id = 'ddlRenderingProvider';
                } else {
                    _id = 'ddlReferringProvider';
                }

                $("#" + _id).select2({
                    ajax: {
                        url: "/exa_modules/billing/autoCompleteRouter/providers",
                        dataType: 'json',
                        delay: 250,
                        data: function (params) {
                            return {
                                page: params.page || 1,
                                q: params.term || '',
                                provider_type: provider_type,
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
                    placeholder: self.usermessage.selectStudyReadPhysician,
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
                    if (!repo.is_active) {
                        var markup1 = "<table class='ref-result' style='width: 100%'><tr class='inActiveRow'>";
                        markup1 += "<td><div><b>" + repo.full_name + "</b><b>" + '(' + repo.provider_code + ')' + "</b></div>";
                        markup1 += "<div>" + contactInfo.ADDR1 == undefined ? "" : contactInfo.ADDR1 + contactInfo.ADDR2 == undefined ? "" : ", " + contactInfo.ADDR2 + "</div>";
                        markup1 += "<div>" + contactInfo.CITY == undefined ? "" : contactInfo.CITY + ", " + contactInfo.STATE + contactInfo.ZIP == undefined ? "" : ", " + contactInfo.ZIP + contactInfo.MOBNO == undefined ? "" : ", " + contactInfo.MOBNO + "</div>";
                        markup1 += "</td></tr></table>";
                        return markup1;
                    }
                    else {
                        var markup = "<table class='ref-result' style='width: 100%'><tr>";
                        markup += "<td><div><b>" + repo.full_name + "</b><b>" + '(' + repo.provider_code + ')' + "</b></div>";
                        markup += "<div>" + (contactInfo.ADDR1 == undefined ? "" : contactInfo.ADDR1) + ", " + (contactInfo.ADDR2 == undefined ? "" : contactInfo.ADDR2) + "</div>";
                        markup += "<div>" + (contactInfo.CITY == undefined ? "" : contactInfo.CITY) + ", " + contactInfo.STATE + (contactInfo.ZIP == undefined ? "" : ", " + contactInfo.ZIP) + (contactInfo.MOBNO == undefined ? "" : ", " + contactInfo.MOBNO) + "</div>";
                        markup += "</td></tr></table>"
                        return markup;
                    }
                }
                function formatRepoSelection(res) {
                    if (provider_type == 'PR') {
                        self.ACSelect.readPhy.ID = res.id;
                        self.ACSelect.readPhy.Desc = res.full_name;
                        self.ACSelect.readPhy.Code = res.provider_code;
                        self.ACSelect.readPhy.contact_id = res.provider_contact_id;
                    } else {
                        self.ACSelect.refPhy.ID = res.id;
                        self.ACSelect.refPhy.Desc = res.full_name;
                        self.ACSelect.refPhy.Code = res.provider_code;
                        self.ACSelect.refPhy.contact_id = res.provider_contact_id;
                        if (res.id) {
                            self.updateResponsibleList({
                                payer_type: 'RF',
                                payer_id: res.id,
                                payer_name: res.full_name + '(Referring Provider)'
                            }, null);
                        }
                    }
                    return res.full_name;
                }
            },

            setDiagCodesAutoComplete: function () {
                var self = this;
                $("#ddlMultipleDiagCodes").select2({
                    ajax: {
                        url: "/exa_modules/billing/autoCompleteRouter/icd_codes",
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

                    escapeMarkup: function (markup) { return markup; }, // let our custom formatter work
                    minimumInputLength: 0,
                    templateResult: formatRepo,
                    templateSelection: formatRepoSelection
                });
                function formatRepo(repo) {
                    if (repo.loading) {
                        return repo.text;
                    }
                    var codeValue = repo.code != null ? repo.code : '';
                    codeValue += repo.code_type ? '(' + repo.code_type + ')' : '';

                    var markup = "<table><tr>";
                    if (codeValue != '')
                        markup += "<td title='" + codeValue + (repo.description ? "(" + repo.description + ")" : '') + "'><div>" + codeValue + (repo.description ? "(" + repo.description + ")" : '') + "</div>";
                    else
                        markup += "<td title='" + codeValue + repo.description ? repo.description : '' + "'><div>" + codeValue + repo.description ? repo.description : '' + "</div>";
                    markup += "</td></tr></table>"
                    return markup;

                }
                function formatRepoSelection(res) {
                    self.ICDID = res.id;
                    self.icd_code = res.code;
                    self.icd_description = res.description;
                    return res.code;
                }
                $('#ddlMultipleDiagCodes').off().on('select2:selecting', function (e) {
                    var res = e.params.args.data;
                    if (res.code_type == 'icd9') {
                        var msg = commonjs.geti18NString("messages.confirm.billing.icdConvertion9to10")
                        if (confirm(msg)) {
                            commonjs.showLoading('')
                            self.showIcd9t010Popup(res);
                        }
                    } else {
                        self.ICDID = res.id;
                        self.icd_code = res.code;
                        self.icd_description = res.description;
                    }
                    $('#ddlMultipleDiagCodes').find('option').remove();
                    return res.code;
                });
            },

            showIcd9t010Popup: function (icd9Response) {
                var self = this;
                commonjs.showLoading("messages.loadingMsg.connectingPokitdok");
                self.icd9Code = icd9Response.code;
                $.ajax({
                    url: '/exa_modules/billing/claims/claim/getIcd9To10',
                    type: 'GET',
                    data: {
                        icd9Code: self.icd9Code
                    },
                    success: function (model, response) {

                        // Before getting pokitdok response, showDialog closed means no need to open pokitdok response dialog
                        if (commonjs.hasModalClosed()) {
                            commonjs.hideLoading();
                            return false;
                        }

                        if (model && model.result && typeof model.result === 'string') {
                            var data = JSON.parse(model.result)
                            if (data && data.error && data.error === 'invalid_client')
                                commonjs.showError("messages.errors.invalidPokitdokIp");
                        } else if (model && model.result && model.result.length) {
                            var icdCodes = model.result;
                            var icds = [];
                            for (var i = 0; i < icdCodes.length; i++) {
                                icds.push({
                                    code: icdCodes[i].value,
                                    slNo: i + 1,
                                    description: icdCodes[i].description
                                })
                            }
                            commonjs.showNestedDialog({
                                header: 'ICD10 Codes for ICD9 - ' + self.icd9Code,
                                width: '55%',
                                height: '65%',
                                html: self.icd9to10Template({
                                    icds: icds
                                })
                            });
                            commonjs.processPostRender();
                            $('#btnSaveSelectedIcd').click(function () {
                                self.saveIcd10Codes()
                            })
                        } else if (model && model.result && model.result.data && model.result.data.errors && model.result.data.errors.validation && model.result.data.errors.validation.code && model.result.data.errors.validation.code.length) {
                            var errorMsg = model.result.data.errors.validation.code[0];
                            commonjs.showError(errorMsg)
                        } else if (model && model.result && model.result.data && model.result.data.errors && model.result.data.errors && model.result.data.errors.query) {
                            var errorMsg = model.result.data.errors.query;
                            commonjs.showError(errorMsg)
                        } else if (model && model.result && model.result.err) {
                            commonjs.showError(model.result.err)
                        } else {
                            commonjs.showError('No Matches Found')
                        }
                        commonjs.hideLoading();
                    },
                    error: function (err, response) {
                        commonjs.handleXhrError(err, response);
                    }
                })
            },

            saveIcd10Codes: function () {
                var self = this;
                if ($('input[name=icdCode]:checked').length) {
                    var selected_element = $('input[name=icdCode]:checked').closest('tr');
                    $.ajax({
                        url: '/exa_modules/billing/claims/claim/icdCode',
                        type: 'POST',
                        data: {
                            code: $(selected_element).data('code'),
                            description: $(selected_element).data('description'),
                            code_type: 'icd10',
                            is_active: true
                        },
                        success: function (model, response) {
                            var result = model && model[0] ? model[0] : {};
                            self.ICDID = result.id
                            self.icd_code = result.code ? result.code : $(selected_element).data('code');
                            self.description = result.description ? result.description : $(selected_element).data('description');
                            self.is_active = true;
                            commonjs.hideNestedDialog();
                            self.addDiagCodes(true);
                        },
                        error: function (err, response) {
                            commonjs.handleXhrError(err, response);
                        }
                    })
                }
                else {
                    commonjs.showWarning("messages.warning.claims.selectICDCode");
                    return;
                }
            },

            addDiagCodes: function (isManual) {
                var self = this;
                var curDiagnosis = ($('#hdnDiagCodes').val() !== "") ? $('#hdnDiagCodes').val().split(',') : [];

                if (self.icd_code != '' && self.ICDID != '') {
                    if (curDiagnosis.length < 12) {
                        if (curDiagnosis.indexOf(String(self.ICDID)) > -1) {
                            commonjs.showWarning("messages.warning.shared.problemAlreadyExists");
                            return false;
                        }

                        curDiagnosis.push(self.ICDID);
                        $('#hdnDiagCodes').val(curDiagnosis.join(','));

                        // Adding same ICD after deleted, change[is_deleted,deleted_by] flag from icd list
                        if (_.findIndex(self.claimICDLists, { icd_id: parseInt(self.ICDID) }) > -1) {
                            self.claimICDLists = _.map(self.claimICDLists, function (obj) {
                                if (obj.icd_id === parseInt(self.ICDID)) {
                                    obj.is_deleted = false;
                                }
                                return obj;
                            });
                        } else {
                            self.claimICDLists.push({
                                id: null,
                                icd_id: parseInt(self.ICDID),
                                claim_id: self.claim_Id || null,
                                is_deleted: false
                            });
                        }

                        /* Bind Diagnosis codes */
                        $('#ulSelectedDiagCodes').append(
                            $('<li/>').append($('<span/>').addClass("orderNo").text(curDiagnosis.length + ' )').css('float', 'left')).append(
                                $('<span>').addClass("beautifySpan").text(self.icd_code + '-' + self.icd_description)
                            ).off().click(function () {
                                $('.highlight').removeClass('highlight');
                                $(this).addClass('highlight');
                            }).append(
                                $('<a/>').addClass("remove").attr('data-id', self.ICDID
                                ).append(
                                    $('<span/>').addClass("icon-ic-close").off().click(function (e) {
                                        var curDiagnosis = ($('#hdnDiagCodes').val() !== "") ? $('#hdnDiagCodes').val().split(',') : [],
                                            codeId = $(e.target).parent().attr('data-id');
                                        //self.claimICDLists = _.reject(self.claimICDLists, function (obj) { return parseInt(obj.icd_id) === parseInt(codeId); });
                                        self.claimICDLists = _.map(self.claimICDLists, function (obj) {
                                            if (obj.icd_id === parseInt(codeId)) {
                                                obj.is_deleted = true;
                                            }
                                            return obj;
                                        });
                                        var removePointer = curDiagnosis.indexOf(codeId)
                                        curDiagnosis.splice(removePointer, 1);
                                        $('#hdnDiagCodes').val(curDiagnosis.join(','));
                                        $(this).closest('li').remove();
                                        self.removeAdjustPointers(removePointer + 1)
                                        self.sortDigCodes();
                                    })
                                )
                            )
                        );

                        if (isManual) {
                            var intId = $("#ulSelectedDiagCodes li").length;
                            $("#tBodyCharge").find("tr").each(function (i1, row) {
                                $(row).find("[id^=ddlPointer]").each(function (i2, pointer) {
                                    if ($(pointer).val() == "") {
                                        $(pointer).val(intId);
                                        return false;
                                    }
                                })
                            });
                        }

                        // blur event called because of validate after icd insertion
                        $(".diagCodes").blur();
                        $('#select2-ddlMultipleDiagCodes-container').html('');
                        $('#ddlMultipleDiagCodes').find('option').remove();
                        self.icd_code = '';
                        self.ICDID = '';
                        self.icd_description = '';
                    }
                    else {
                        commonjs.showWarning("messages.warning.shared.icdLimitExists");
                        $('#select2-ddlMultipleDiagCodes-container').html('');
                        self.icd_code = '';
                        self.ICDID  ='';
                        self.icd_description = '';
                    }
                }
            },

            // Remove deleted pointer references and decrement all of the higher numbered pointers so that they continue to match up correctly
            removeAdjustPointers: function (removePointer) {
                var self = this;
                if (isNaN(removePointer) === true) return false;

                $("#tBodyCharge").find("tr").each(function (i1, row) {
                    $(row).find("[id^=ddlPointer]").each(function (i2, pointer) {
                        if (parseInt($(pointer).val()) == parseInt(removePointer)) {
                            $(pointer).val("");
                        }
                        else if (parseInt($(pointer).val()) > parseInt(removePointer)) {
                            $(pointer).val($(pointer).val() - 1);
                        }
                    })
                });
            },

            sortDigCodes: function () {
                var self = this;
                $('ul.icdTagList li span.orderNo').each(function (index, obj) {
                    $(this).text(index + 1 + ')');
                });
            },

            bindExistingPatientInsurance: function (doHide) {
                var self = this;
                self.clearInsuranceFields(false, ['Pri', 'Sec', 'Ter']);
                $.ajax({
                    url: '/exa_modules/billing/claims/claim/patient_insurances',
                    type: 'GET',
                    data: {
                        'patient_id': self.cur_patient_id || 0,
                        'claim_date': self.claim_dt_iso || 'now()',
                        'order_ids': self.selectedOrderIds || [0]
                    },
                    success: function (response) {

                        if (response.length > 0) {
                            self.existingPrimaryInsurance = [];
                            self.existingSecondaryInsurance = [];
                            self.existingTriInsurance = [];
                            var existing_insurance = response[0].existing_insurance || [];
                            var beneficiary_details = response[0].beneficiary_details || [];
                            self.patientAddress = response[0].patient_info ? response[0].patient_info : self.patientAddress;
                            self.npiNo = existing_insurance.length && existing_insurance[0].npi_no ? existing_insurance[0].npi_no : '';
                            self.federalTaxId = existing_insurance.length && existing_insurance[0].federal_tax_id ? existing_insurance[0].federal_tax_id : '';
                            self.enableInsuranceEligibility = existing_insurance.length && existing_insurance[0].enable_insurance_eligibility ? existing_insurance[0].enable_insurance_eligibility : '';
                            self.tradingPartnerId = existing_insurance.length && existing_insurance[0].ins_partner_id ? existing_insurance[0].ins_partner_id : '';

                            $.each(existing_insurance, function (index, value) {
                                switch (value.coverage_level) {
                                    case 'primary':
                                        self.existingPrimaryInsurance.push(value);
                                        break;
                                    case 'secondary':
                                        self.existingSecondaryInsurance.push(value);
                                        break;
                                    case 'tertiary':
                                        self.existingTriInsurance.push(value);
                                }
                            });
                            self.bindExistingInsurance(self.existingPrimaryInsurance, 'ddlExistPriIns')
                            self.bindExistingInsurance(self.existingSecondaryInsurance, 'ddlExistSecIns')
                            self.bindExistingInsurance(self.existingTriInsurance, 'ddlExistTerIns')

                            beneficiary_details = beneficiary_details && beneficiary_details.length ? _.groupBy(beneficiary_details, function (obj) { return obj.coverage_level }) : {};
                            // Canadian config. allow only primary insurances
                            if (app.country_alpha_3_code === 'can') {
                                beneficiary_details = _.pick(beneficiary_details, 'primary');
                            }

                            if (beneficiary_details) {
                                $.each(beneficiary_details, function (index, object) {
                                    var insurance_details = object.length ? _.sortBy(object, "id")[0] : {}
                                    self.bindExistInsurance(insurance_details, insurance_details.coverage_level);
                                });
                            } else {
                                self.clearInsuranceFields(false, ['Pri', 'Sec', 'Ter']);
                            }

                            if (doHide) {
                                $('.claimProcess').prop('disabled', false);
                                commonjs.hideLoading();
                            }
                        }
                    },
                    error: function (err, response) {
                        commonjs.handleXhrError(err, response);
                    }
                })
            },

            bindExistingInsurance: function (array, insurance_id) {
                var self = this;
                var existingInsElement = $('#' + insurance_id);
                existingInsElement.empty();
                existingInsElement.append("<option value=''>SELECT</option>");
                for (var i = 0; i < array.length; i++) {
                    existingInsElement.append($('<option>',
                        {
                            "value": array[i].id,
                            "data-value": array[i].insurance_provider_id
                        }).text(array[i].insurance_name));
                }
            },

            setOrderingFacilityAutoComplete: function () {
                var self = this;
                $("#ddlOrdFacility").select2({
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
                                company_id: app.companyID
                            };
                        },
                        processResults: function (data, params) {
                            return commonjs.getTotalRecords(data, params);
                        },
                        cache: true
                    },
                    placeholder: self.usermessage.selectStudyReadPhysician,
                    escapeMarkup: function (markup) { return markup; }, // let our custom formatter work
                    minimumInputLength: 0,
                    templateResult: formatRepo,
                    templateSelection: formatRepoSelection
                });
                function formatRepo(repo) {
                    if (repo.loading) {
                        return repo.text;
                    }
                    var markup = "<table class='ref-result' style='width: 100%'><tr>";
                    markup += "<td class='movie-info'><div class='movie-title'><b>" + repo.group_name + "</b></div>";
                    markup += "</td></tr></table>";
                    return markup;

                }
                function formatRepoSelection(res) {
                    self.group_name = res.group_name;
                    self.group_id = res.provider_group_id;
                    if (res && res.id) {
                        self.updateResponsibleList({
                            payer_type: 'POF',
                            payer_id: res.provider_group_id,
                            payer_name: res.group_name + '(Service Facility)'
                        }, null);
                    }
                    return res.group_name;
                }
            },

            bindInsuranceAutocomplete: function (element_id) {
                var self = this;
                $("#" + element_id).select2({
                    ajax: {
                        url: "/exa_modules/billing/autoCompleteRouter/insurances",
                        dataType: 'json',
                        delay: 250,
                        data: function (params) {
                            if (params.term === undefined && $select2Container.text())
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
                        self.bindInsurance(element_id, res);
                    return res.insurance_name;
                }
                var $select2Container = $("#" +'select2-'+element_id+'-container');
                $("#" + element_id).on('select2:open', function (event) {
                    commonjs.getPlaceHolderForSearch();
                    if ($select2Container && $select2Container.text())
                        $("#" + element_id).data('select2').dropdown.$search.val($select2Container.text());
                });
            },

            bindInsurance: function (element_id, res) {
                var self = this, payer_type, coverage_level;
                switch (element_id) {
                    case 'ddlPriInsurance':
                        self.priInsID = res.id;
                        self.priInsCode = res.insurance_code;
                        self.priInsName = res.insurance_name;
                        payer_type = 'PIP_P';
                        coverage_level = 'Primary Insurance';
                        // it's remove the existing selected insurances
                        $('#ddlExistPriIns').val('');
                        self.primaryPatientInsuranceId = null;
                        self.updateInsAddress('Pri', res);
                        self.is_primary_available = true;
                        if($('#ddlPriInsurance').val() !='') {
                            $('#chkPriAcptAsmt').prop('checked', true);
                        }
                        self.checkHealthNumberEligiblity();
                        break;
                    case 'ddlSecInsurance':
                        self.secInsID = res.id;
                        self.secInsCode = res.insurance_code;
                        self.secInsName = res.insurance_name;
                        payer_type = 'PIP_S';
                        coverage_level = 'Secondary Insurance';
                        // it's remove the existing selected insurances
                        $('#ddlExistSecIns').val('');
                        self.secondaryPatientInsuranceId = null;
                        self.updateInsAddress('Sec', res);
                        self.is_secondary_available = true;
                        if($('#ddlSecInsurance').val() !='') {
                            $('#chkSecAcptAsmt').prop('checked', true);
                        }
                        break;
                    case 'ddlTerInsurance':
                        self.terInsID = res.id;
                        self.terInsCode = res.insurance_code;
                        self.terInsName = res.insurance_name;
                        payer_type = 'PIP_T';
                        coverage_level = 'Tertiary Insurance';
                        // it's remove the existing selected insurances
                        $('#ddlExistTerIns').val('');
                        self.tertiaryPatientInsuranceId = null;
                        self.updateInsAddress('Ter', res);
                        self.is_tertiary_available = true;
                        if($('#ddlTerInsurance').val() !='') {
                            $('#chkTerAcptAsmt').prop('checked', true);
                        }
                        break;
                }
                self.updateResponsibleList({
                    payer_type: payer_type,
                    payer_id: res.id,
                    payer_name: res.insurance_name + '( ' + coverage_level + ' )',
                    billing_method: res.billing_method || null
                }, null);

                //Assign primary insurance as responsible
                if (payer_type == 'PIP_P' && !self.isEdit) {
                    $('#ddlClaimResponsible').val('PIP_P');
                }
            },

            updateInsAddress: function (level, res) {
                var self = this;
                var insuranceInfo = res.insurance_info || null;
                var csz = insuranceInfo.City + (commonjs.checkNotEmpty(insuranceInfo.State) ? ',' + insuranceInfo.State : "") + (commonjs.checkNotEmpty(insuranceInfo.ZipCode) ? ',' + insuranceInfo.ZipCode : "");

                $('#lbl' + level + 'InsPriAddr').html(insuranceInfo.Address1);

                $('#lbl' + level + 'InsCityStateZip').html(csz);

                $('#lbl' + level + 'PhoneNo').html(insuranceInfo.PhoneNo);
            },

            bindServiceType: function () {
                var self = this;
                var serviceTypeDescription = [];
                var serviceTypeDropDown = $('#ddlServiceType');
                $('#ddlServiceType').empty();

                commonjs.getServiceTypes(function (err, model) {
                    if (err) {
                        return;
                    }

                    var eligibilityServiceTypes = model.eligibility_service_types;

                    $.each(eligibilityServiceTypes, function (index, val) {
                        $('<option/>')
                            .val(val.code)
                            .text(val.description + '(' + val.code + ')')
                            .attr('title', val.description)
                            .appendTo('#ddlServiceType');

                        $('<option/>')
                            .val(val.code)
                            .text(val.description + '(' + val.code + ')')
                            .attr('title', val.description)
                            .appendTo('#ddlServiceType2');

                        $('<option/>')
                            .val(val.code)
                            .text(val.description + '(' + val.code + ')')
                            .attr('title', val.description)
                            .appendTo('#ddlServiceType3');
                    });

                    $('#ddlServiceType, #ddlServiceType2, #ddlServiceType3').multiselect({
                        maxHeight: 200,
                        buttonWidth: '250px',
                        enableFiltering: true,
                        enableCaseInsensitiveFiltering: true
                    });

                    $('.multiselect-container li').css('width', '300px');
                    $('.multiselect-container li a').css('padding', '0');

                    $.each($('.multiselect-item span'), function (index, obj) {
                        $(this).find('.glyphicon-search').removeClass('glyphicon').removeClass('glyphicon-search').addClass('fa fa-search').css('margin', '10px');
                        $(this).find('.glyphicon-remove-circle').removeClass('glyphicon').removeClass('glyphicon-remove-circle').addClass('fa fa-times');
                    });
                });
            },

           assignExistInsurance: function (e) {
                var self = this;
                var id = e.target.id;
                var patientInsID = $('#' + id + ' option:selected').val();

                if (patientInsID > 0) {
                    var self = this;
                    this.patInsModel.set({ id: patientInsID });
                    this.patInsModel.fetch({
                        data: $.param({ id: this.patInsModel.id }),
                        success: function (models, response) {
                            var result = response && response.length ? response[0] : '',
                                coverageLevel = result.coverage_level;
                            self.bindExistInsurance(result, coverageLevel);
                        },
                        error: function (model, response) {
                            commonjs.handleXhrError(model, response);
                        }
                    });
                }
            },

            bindExistInsurance: function (result, coverageLevel) {
                var self = this, flag;
                if (result) {
                    switch (coverageLevel) {
                        case 'primary':
                            self.primaryPatientInsuranceId = result.id;
                            self.priInsID = result.insurance_provider_id;
                            self.priInsCode = result.insurance_code;
                            self.priInsName = result.insurance_name;
                            flag = 'Pri';
                            // append to ResponsibleList
                            self.updateResponsibleList({
                                payer_type: 'PIP_P',
                                payer_id: result.insurance_provider_id,
                                payer_name: result.insurance_name + '( Primary Insurance )',
                                billing_method: result.billing_method
                            }, null);
                            self.is_primary_available = true;
                            self.priClaimInsID = result.id;
                            break;

                        case 'secondary':
                            self.secondaryPatientInsuranceId = result.id;
                            self.secInsID = result.insurance_provider_id;
                            self.secInsCode = result.insurance_code;
                            self.SecInsName = result.insurance_name;
                            flag = 'Sec';
                           // append to ResponsibleList
                            self.updateResponsibleList({
                                payer_type: 'PIP_S',
                                payer_id: result.insurance_provider_id,
                                payer_name: result.insurance_name + '( Secondary Insurance )',
                                billing_method: result.billing_method
                            }, null);
                            self.is_secondary_available = true;
                            self.secClaimInsID = result.id;
                            break;

                        case 'tertiary':
                            self.tertiaryPatientInsuranceId = result.id;
                            self.terInsID = result.insurance_provider_id;
                            self.terInsCode = result.insurance_code;
                            self.terInsName = result.insurance_name;
                            flag = 'Ter';
                            // append to ResponsibleList
                            self.updateResponsibleList({
                                payer_type: 'PIP_T',
                                payer_id: result.insurance_provider_id,
                                payer_name: result.insurance_name + '( Tertiary Insurance )',
                                billing_method: result.billing_method
                            }, null);
                            self.is_tertiary_available = true;
                            self.terClaimInsID = result.id;
                            break;
                    }


                    document.querySelector('#txt' + flag + 'StartDate').value = result.valid_from_date ? moment(result.valid_from_date).format('L') : '';
                    document.querySelector('#txt' + flag + 'ExpDate').value = result.valid_to_date ? moment(result.valid_to_date).format('L') : '';
                    document.querySelector('#txt' + flag + 'DOB').value = result.subscriber_dob ? moment(result.subscriber_dob).format('L') : '';
                    $('#select2-ddl' + flag + 'Insurance-container').html(result.insurance_name);
                    $('#chk' + flag + 'AcptAsmt').prop('checked', true);
                    $('#lbl' + flag + 'InsPriAddr').html(result.ins_pri_address);
                    var csz = result.ins_city + (commonjs.checkNotEmpty(result.ins_state) ? ',' + result.ins_state : "") + (commonjs.checkNotEmpty(result.ins_zip_code) ? ',' + result.ins_zip_code : "");
                    $('#lbl' + flag + 'InsCityStateZip').html(csz);
                    $('#lbl' + flag + 'PhoneNo').html(result.ins_phone_no ? result.ins_phone_no: '');
                    $('#txt' + flag + 'PolicyNo').val(result.policy_number);
                    $('#txt' + flag + 'GroupNo').val(result.group_number);
                    $('#ddl' + flag + 'RelationShip').val(this.checkRelationshipActive(result.subscriber_relationship_id) ? result.subscriber_relationship_id : "");
                    var priSelf = ($('#ddl' + flag + 'RelationShip'+' option:selected').text()).toLowerCase();
                    ($.trim(priSelf) == 'self' || $.trim(priSelf) == 'select') ? $('#show'+ flag + 'Self').hide() : $('#show'+ flag + 'Self').show();
                    $('#txt' + flag + 'SubFirstName').val(result.subscriber_firstname);
                    $('#txt' + flag + 'SubMiName').val(result.subscriber_middlename);
                    $('#txt' + flag + 'SubLastName').val(result.subscriber_lastname);
                    $('#txt' + flag + 'SubSuffix').val(result.subscriber_name_suffix);
                    if (app.gender.indexOf(result.subscriber_gender) > -1) {
                        $('#ddl' + flag + 'Gender').val(result.subscriber_gender);
                    }
                    $('#txt' + flag + 'SubPriAddr').val(result.subscriber_address_line1);
                    $('#txt' + flag + 'SubSecAddr').val(result.subscriber_address_line2);
                     // Append dynamic address details for canadian config
                    var AddressInfoMap = {
                        city: {
                            domId: 'txt' + flag + 'City',
                            infoKey: 'subscriber_city'
                        },
                        state: {
                            domId: 'ddl' + flag + 'State',
                            infoKey: 'subscriber_state'
                        },
                        zipCode: {
                            domId: 'txt' + flag + 'ZipCode',
                            infoKey: 'subscriber_zipcode'
                        }
                    }
                    self.bindCityStateZipTemplate(result, AddressInfoMap, flag);

                    if(result.coverage_level == "secondary" && result.medicare_insurance_type_code != null) {
                        $('#chkSecMedicarePayer').prop('checked',true);
                        $('#selectMedicalPayer').val(result.medicare_insurance_type_code).toggle(true);
                    }
                    setTimeout(function () {
                        if (!self.isEdit) {
                            var responsibleIndex = _.find(self.responsible_list, function (item) { return item.payer_type == 'PIP_P'; });
                            var val = responsibleIndex && responsibleIndex.payer_id ? 'PIP_P' : 'PPP'
                            $('#ddlClaimResponsible').val(val);
                        }
                    }, 200);

                }
            },

            validatePatientAddress: function (level) {
                var patientAddress = this.patientAddress;

                function getValue(value) {
                    if (typeof value === 'undefined' || typeof value === 'object')
                        return "";

                    return value;
                }

                return $(this.elIDs[level + 'InsAddress1']).val() != getValue(patientAddress.c1AddressLine1) ||
                    $(this.elIDs[level + 'InsAddress2']).val() != getValue(patientAddress.c1AddressLine2) ||
                    $(this.elIDs[level + 'InsCity']).val() != getValue(patientAddress.c1City) ||
                    $(this.elIDs[level + 'InsState']).val() != getValue(patientAddress.c1State) ||
                    $(this.elIDs[level + 'InsZipCode']).val() != getValue(patientAddress.c1Zip)
            },

            validateHealthNumberInputCanada: function (_eleId) {
                var self = this;
                var _ele = '#' + _eleId;

                if ($(_ele).val().length > 0 && app.country_alpha_3_code === 'can' && self.patientAddress.c1country === 'can') {
                    var state = self.isUpdatePatientInfo ? $.trim($('#ddlPriState option:selected').val()) : self.patientAddress.c1State;
                    var _obj = _.find(commonjs.healthNumberValidation, { province: state || '' });
                    var pattern = new RegExp(_obj.regexp);
                    return !pattern.test($(_ele).val());
                } else
                    return false;
            },
            setClaimDetails: function () {
                var self = this;
                var claim_model = {}, billingMethod;
                claim_model.insurances = [];
                var isUpdatePatientInfo = false;
                var currentResponsible = _.find(self.responsible_list, function(d) { return d.payer_type == $('#ddlClaimResponsible').val(); });
                var currentPayer_type = $('#ddlClaimResponsible').val().split('_')[0];
                var facility_id = $('#ddlFacility option:selected').val() != '' ? parseInt($('#ddlFacility option:selected').val()) : null;
                if (currentPayer_type == "PIP") {
                    billingMethod = currentResponsible.billing_method || 'direct_billing';
                }
                else if (currentPayer_type == "PPP")
                    billingMethod = 'patient_payment';
                else
                    billingMethod = 'direct_billing';

                if (self.priInsID && self.validatePatientAddress("primary") && confirm(commonjs.geti18NString("messages.confirm.updatePatientAddress"))) {
                    isUpdatePatientInfo = true;
                }

                var primary_insurance_details = {
                    claim_patient_insurance_id: parseInt(self.primaryPatientInsuranceId) || null,
                    claim_insurance_id: parseInt(self.priClaimInsID) || null,
                    patient_id: self.cur_patient_id || null,
                    insurance_provider_id: self.priInsID ? parseInt(self.priInsID) : null,
                    subscriber_relationship_id: $('#ddlPriRelationShip option:selected').val() != '' ? parseInt($('#ddlPriRelationShip option:selected').val()) : null,
                    subscriber_dob: $('#txtPriDOB').val() != '' ? commonjs.getISODateString($('#txtPriDOB').val()) : null,
                    coverage_level: 'primary',
                    policy_number: $('#txtPriPolicyNo').val(),
                    group_number: $('#txtPriGroupNo').val(),
                    subscriber_firstname: $('#txtPriSubFirstName').val(),
                    subscriber_lastname: $('#txtPriSubLastName').val(),
                    subscriber_middlename: $('#txtPriSubMiName').val(),
                    subscriber_name_suffix: $('#txtPriSubSuffix').val(),
                    subscriber_gender: $('#ddlPriGender option:selected').val() || null,
                    subscriber_address_line1: $('#txtPriSubPriAddr').val(),
                    subscriber_address_line2: $('#txtPriSubSecAddr').val(),
                    subscriber_city: $('#txtPriCity').val(),
                    subscriber_state: $('#ddlPriState option:selected').val() || null,
                    subscriber_zipcode: $('#txtPriZipCode').val() != '' ? $('#txtPriZipCode').val() : null,
                    assign_benefits_to_patient: $('#chkPriAcptAsmt').prop("checked"),
                    medicare_insurance_type_code: null,
                    valid_from_date: $('#txtPriStartDate').val() != '' ? commonjs.getISODateString($('#txtPriStartDate').val()) : null,
                    valid_to_date: $('#txtPriExpDate').val() != '' ? commonjs.getISODateString($('#txtPriExpDate').val()) :null,
                    is_deleted: self.priClaimInsID && self.priInsID == '' ? true : false,
                    is_new: !self.priClaimInsID ? !(self.primaryPatientInsuranceId) : false,
                    is_update_patient_info: isUpdatePatientInfo
                },
                secondary_insurance_details = {
                    claim_patient_insurance_id: parseInt(self.secondaryPatientInsuranceId) || null,
                    claim_insurance_id: parseInt(self.secClaimInsID) || null,
                    patient_id: self.cur_patient_id || null,
                    insurance_provider_id: self.secInsID ? parseInt(self.secInsID) : null,
                    subscriber_relationship_id: $('#ddlSecRelationShip option:selected').val() != '' ? parseInt($('#ddlSecRelationShip option:selected').val()) : null,
                    coverage_level: 'secondary',
                    policy_number: $('#txtSecPolicyNo').val(),
                    group_number: $('#txtSecGroupNo').val(),
                    subscriber_firstname: $('#txtSecSubFirstName').val(),
                    subscriber_lastname: $('#txtSecSubLastName').val(),
                    subscriber_middlename: $('#txtSecSubMiName').val(),
                    subscriber_name_suffix: $('#txtSecSubSuffix').val(),
                    subscriber_gender: $('#ddlSecGender option:selected').val() || null,
                    subscriber_address_line1: $('#txtSecSubPriAddr').val(),
                    subscriber_address_line2: $('#txtSecSubSecAddr').val(),
                    subscriber_city: $('#txtSecCity').val(),
                    subscriber_zipcode: $('#txtSecZipCode').val() != '' ? $('#txtSecZipCode').val() : null,
                    subscriber_state: $('#ddlSecState option:selected').val() || null,
                    assign_benefits_to_patient: $('#chkSecAcptAsmt').prop("checked"),
                    subscriber_dob: $('#txtSecDOB').val() != '' ? commonjs.getISODateString($('#txtSecDOB').val()) : null,
                    medicare_insurance_type_code: $('#selectMedicalPayer option:selected').val() != '' ? parseInt($('#selectMedicalPayer option:selected').val()) : null,
                    valid_from_date: $('#txtSecStartDate').val() != '' ? commonjs.getISODateString($('#txtSecStartDate').val()) : null,
                    valid_to_date: $('#txtSecExpDate').val() != '' ? commonjs.getISODateString($('#txtSecExpDate').val()) : null,
                    is_deleted: self.secClaimInsID && self.secInsID == '' ? true : false,
                    is_new: !self.secClaimInsID ? !(self.secondaryPatientInsuranceId) : false,
                    is_update_patient_info: false
                },
                teritiary_insurance_details = {
                    claim_patient_insurance_id: parseInt(self.tertiaryPatientInsuranceId) || null,
                    claim_insurance_id: parseInt(self.terClaimInsID) || null,
                    patient_id: self.cur_patient_id || null,
                    insurance_provider_id: self.terInsID ? parseInt(self.terInsID) : null,
                    coverage_level: 'tertiary',
                    subscriber_relationship_id: $('#ddlTerRelationShip option:selected').val() != '' ? parseInt($('#ddlTerRelationShip option:selected').val()) : null,
                    policy_number: $('#txtTerPolicyNo').val(),
                    group_number: $('#txtTerGroupNo').val(),
                    subscriber_firstname: $('#txtTerSubFirstName').val(),
                    subscriber_lastname: $('#txtTerSubLastName').val(),
                    subscriber_middlename: $('#txtTerSubMiName').val(),
                    subscriber_name_suffix: $('#txtTerSubSuffix').val(),
                    subscriber_gender: $('#ddlTerGender option:selected').val() || null,
                    subscriber_address_line1: $('#txtTerSubPriAddr').val(),
                    subscriber_address_line2: $('#txtTerSubSecAddr').val(),
                    subscriber_city: $('#txtTerCity').val(),
                    subscriber_zipcode: $('#txtTerZipCode').val() != '' ? $('#txtTerZipCode').val() : null,
                    subscriber_state: $('#ddlTerState option:selected').val() || null,
                    assign_benefits_to_patient: $('#chkTerAcptAsmt').prop("checked"),
                    subscriber_dob: $('#txtTerDOB').val() != '' ? commonjs.getISODateString($('#txtTerDOB').val()) : null,
                    medicare_insurance_type_code: null,
                    valid_from_date: $('#txtTerStartDate').val() != '' ? commonjs.getISODateString($('#txtTerStartDate').val()) : null,
                    valid_to_date: $('#txtTerExpDate').val() != '' ? commonjs.getISODateString($('#txtTerExpDate').val()) : null,
                    is_deleted: self.terClaimInsID && self.terInsID == '' ? true : false,
                    is_new: !self.terClaimInsID ? !(self.tertiaryPatientInsuranceId) : false,
                    is_update_patient_info: false
                }

                if (self.is_primary_available || self.priClaimInsID) {
                    claim_model.insurances.push(primary_insurance_details);
                }
                if (app.country_alpha_3_code !== 'can' && (self.is_secondary_available || self.secClaimInsID)) {
                    claim_model.insurances.push(secondary_insurance_details);
                }
                if (app.country_alpha_3_code !== 'can' && (self.is_tertiary_available || self.terClaimInsID)) {
                    claim_model.insurances.push(teritiary_insurance_details);
                }
                claim_model.claims = {
                    claim_id: self.claim_Id,
                    company_id: app.companyID,
                    facility_id: facility_id,
                    patient_id: parseInt(self.cur_patient_id) || null,
                    billing_provider_id: $('#ddlBillingProvider option:selected').val() != '' ? parseInt($('#ddlBillingProvider option:selected').val()) : null,
                    rendering_provider_contact_id: self.ACSelect && self.ACSelect.readPhy ? self.ACSelect.readPhy.contact_id : null,
                    referring_provider_contact_id: self.ACSelect && self.ACSelect.refPhy ? self.ACSelect.refPhy.contact_id : null,
                    ordering_facility_id: self.group_id ? parseInt(self.group_id) : null,
                    place_of_service_id: app.country_alpha_3_code !== 'can' && $('#ddlPOSType option:selected').val() != '' ? parseInt($('#ddlPOSType option:selected').val()) : null,
                    billing_code_id: $('#ddlBillingCode option:selected').val() != '' ? parseInt($('#ddlBillingCode option:selected').val()) : null,
                    billing_class_id: $('#ddlBillingClass option:selected').val() != '' ? parseInt($('#ddlBillingClass option:selected').val()) : null,
                    created_by: app.userID,
                    claim_dt: self.claim_dt_iso || null,
                    current_illness_date: $('#txtDate').val() != '' ? commonjs.getISODateString($('#txtDate').val()) : null,
                    same_illness_first_date: $('#txtOtherDate').val() != '' ? commonjs.getISODateString($('#txtOtherDate').val()) : null,
                    unable_to_work_from_date: $('#txtWCF').val() != '' ? commonjs.getISODateString($('#txtWCF').val()) : null,
                    unable_to_work_to_date: $('#txtWCT').val() != '' ? commonjs.getISODateString($('#txtWCT').val()) : null,
                    hospitalization_from_date: $('#txtHCF').val() != '' ? commonjs.getISODateString($('#txtHCF').val()) : null,
                    hospitalization_to_date: $('#txtHCT').val() != '' ? commonjs.getISODateString($('#txtHCT').val()) : null,
                    payer_type: currentResponsible.payer_type_name || null,
                    billing_method: billingMethod,
                    billing_notes: $.trim($('#txtClaimResponsibleNotes').val()),
                    claim_notes: $.trim($('#txtClaimNotes').val()),
                    original_reference: $.trim($('#txtOriginalRef').val()),
                    authorization_no: $.trim($('#txtAuthorization').val()),
                    frequency: $('#ddlFrequencyCode option:selected').val() != '' ? $('#ddlFrequencyCode option:selected').val() : null,
                    is_auto_accident: $('#chkAutoAccident').is(':checked'),
                    is_other_accident: $('#chkOtherAccident').is(':checked'),
                    is_employed: $('#chkEmployment').is(':checked'),
                    service_by_outside_lab: $('#chkOutSideLab').is(':checked'),
                    claim_status_id: $('#ddlClaimStatus option:selected').val() != '' ? parseInt($('#ddlClaimStatus option:selected').val()) : null,
                    primary_patient_insurance_id: self.is_primary_available && parseInt(self.primaryPatientInsuranceId) || ( self.is_primary_available && parseInt(self.priClaimInsID) || null ),
                    secondary_patient_insurance_id: self.is_secondary_available && parseInt(self.secondaryPatientInsuranceId) || ( self.is_secondary_available && parseInt(self.secClaimInsID) || null ),
                    tertiary_patient_insurance_id: self.is_tertiary_available && parseInt(self.tertiaryPatientInsuranceId) || ( self.is_tertiary_available && parseInt(self.terClaimInsID) || null )

                };

                /*Setting claim charge details*/
                claim_model.charges = [];
                $('#tBodyCharge').find('tr').each(function (index, rowObject) {
                    var id = $(this).attr('data_row_id');
                    var cpt_code_id = $('#lblCptCode_' + id).attr('data_id');
                    var rowData = _.find(self.chargeModel, { 'data_row_id': parseInt(id) });
                    var pointers = [
                        $(this).find("#ddlPointer1_" + index).val() ? $(this).find("#ddlPointer1_" + index).val() : '',
                        $(this).find("#ddlPointer2_" + index).val() ? $(this).find("#ddlPointer2_" + index).val() : '',
                        $(this).find("#ddlPointer3_" + index).val() ? $(this).find("#ddlPointer3_" + index).val() : '',
                        $(this).find("#ddlPointer4_" + index).val() ? $(this).find("#ddlPointer4_" + index).val() : ''
                    ];
                    pointers = _.compact(pointers);
                    claim_model.charges.push({
                        id: rowData.id ? rowData.id : null,
                        claim_id: rowData.claim_id ? parseInt(rowData.claim_id) : null,
                        //line_num: index,
                        cpt_id: parseInt(cpt_code_id),
                        pointer1: pointers[0] || null,
                        pointer2: pointers[1] || null,
                        pointer3: pointers[2] || null,
                        pointer4: pointers[3] || null,
                        modifier1_id: $('#txtModifier1_' + id).attr('data-id') ? parseInt($('#txtModifier1_' + id).attr('data-id')) : null,
                        modifier2_id: $('#txtModifier2_' + id).attr('data-id') ? parseInt($('#txtModifier2_' + id).attr('data-id')) : null,
                        modifier3_id: $('#txtModifier3_' + id).attr('data-id') ? parseInt($('#txtModifier3_' + id).attr('data-id')) : null,
                        modifier4_id: $('#txtModifier4_' + id).attr('data-id') ? parseInt($('#txtModifier4_' + id).attr('data-id')) : null,
                        bill_fee: parseFloat($('#txtBillFee_' + id).val()) || 0.00,
                        allowed_amount: parseFloat($('#txtAllowedFee_' + id).val()) || 0.00,
                        units: app.country_alpha_3_code ==='can' ? parseInt($('#txtUnits_' + id).val()) || 1 : parseFloat($('#txtUnits_' + id).val()) || 1.000,
                        created_by: app.userID,
                        authorization_no: $('#txtAuthInfo_' + id).val() || null,
                        charge_dt: self.claim_dt_iso || null,
                        study_id: rowData.study_id || null,
                        is_deleted: false,
                        isEdit: $('#txtBillFee_' + id).attr('edit'),
                        is_excluded: $('#checkExclude_' + id).is(':checked'),
                        is_canada_billing: app.country_alpha_3_code === 'can'
                    });
                    var charges = claim_model.charges[claim_model.charges.length - 1];
                    if(charges) {
                        if(!self.isEdit && charges.isEdit == "false") {
                            charges.bill_fee = 0.00;
                            charges.allowed_amount = 0.00;
                        }
                    }
                });

                // Assign If any charges removed
                claim_model.removed_charges = self.removedCharges || [];

                /*Setting ICD pointers details*/
                claim_model.claim_icds = self.claimICDLists || [];

                // set claims details
                self.model.set({
                    claim_row_version : self.isEdit ? self.claim_row_version : null,
                    insurances: claim_model.insurances,
                    charges: claim_model.charges,
                    claims: claim_model.claims,
                    claim_icds: claim_model.claim_icds,
                    removed_charges: claim_model.removed_charges
                });

            },

            saveClaimDetails: function () {
                var self = this, saveButton = $('#btnSaveClaim'), $claimProcess = $('.claimProcess');

                var currentFilter = commonjs.studyFilters.find(function (filter) {
                    return filter.filter_id == commonjs.currentStudyFilter;
                });

                if (self.validateClaimData()) {
                    self.setClaimDetails();

                    commonjs.showLoading();
                    saveButton.prop('disabled', true);
                    $claimProcess.prop('disabled', true);

                    self.model.save({}, {
                        success: function (model, response) {
                            if (response && response.message) {
                                commonjs.showWarning(response.message);
                                $claimProcess.prop('disabled', false);
                            } else {

                                if (self.isEdit) {
                                    self.claim_row_version = response && response.length && response[0].result ? response[0].result : null;
                                } else {
                                    self.claim_Id = response && response.length && response[0].result ? response[0].result : null
                                }

                                var tblID = self.options && self.options.grid_id || '';
                                    tblID = tblID.replace(/#/, '');

                                var claimRefreshInterval = setTimeout(function () {
                                    clearTimeout(claimRefreshInterval);
                                    commonjs.showStatus("messages.status.successfullyCompleted");

                                    // Change grid values after claim creation instead of refreshing studies grid
                                    var selectedStudies = self.selectedStudyIds ? self.selectedStudyIds.split(",").map(Number) :
                                        self.cur_study_id ? self.cur_study_id.split(",").map(Number) : null;

                                    if (self.openedFrom === 'studies' && selectedStudies) {

                                        for (var i = 0; i < selectedStudies.length; ++i) {

                                            var billedStatusFilter = $('#gs_billed_status').val();
                                            var $studyGrid = $('#' + tblID + ' tr#' + selectedStudies[i], parent.document);
                                            var $td = $studyGrid.children('td');
                                            // If studies grid has Unbilled filter means remove row from grid
                                            var isBilledStatus = currentFilter.filter_info && currentFilter.filter_info.studyInformation && currentFilter.filter_info.studyInformation.billedstatus === 'unbilled' || false;
                                            var nextStudyGrid = $studyGrid.nextAll().has("input[type=checkbox]")[0];
                                            var prevStudyGrid = $studyGrid.prevAll().has("input[type=checkbox]")[0];
                                            self.nextRow = (nextStudyGrid && nextStudyGrid.id) || self.nextRow || null;
                                            self.previousRow = (prevStudyGrid && prevStudyGrid.id) || self.previousRow || null;
                                            if (billedStatusFilter === 'unbilled' || isBilledStatus) {
                                                $studyGrid.remove();
                                            } else {
                                                // Otherwise done row changes
                                                var colorCodeDetails = commonjs.getClaimColorCodeForStatus('billed', 'study');
                                                var color_code = colorCodeDetails && colorCodeDetails.length && colorCodeDetails[0].color_code || 'transparent';
                                                var cells = [
                                                    {
                                                        'field': 'billed_status',
                                                        'data': 'Billed',
                                                        'css': {
                                                            "backgroundColor": color_code
                                                        }
                                                    },
                                                    {
                                                        'field': 'hidden_claim_id',
                                                        'data': self.claim_Id
                                                    },
                                                    {
                                                        'field': 'as_edit',
                                                        'data': "<i class='icon-ic-edit' i18nt='shared.buttons.edit'></i>"
                                                    }
                                                ];

                                                for (var j = 0; j < cells.length && !self.isEdit; ++j) {

                                                    var $cell = $td.filter('[aria-describedby="' + tblID + '_' + cells[j].field + '"]');
                                                    $cell.html(cells[j].data)
                                                        .attr('title', $.jgrid.stripHtml(cells[j].data));

                                                    if (typeof cells[j].css === 'object') {
                                                        $cell.css(cells[j].css);
                                                    }
                                                }

                                            }
                                        }
                                    }

                                }, 200);

                                var claimHideInterval = setTimeout(function () {
                                    clearTimeout(claimHideInterval);

                                    // Ispopup(showDialog) closed means no need to call edit claim
                                    if (!commonjs.hasModalClosed()) {
                                        $('#chk' + tblID + '_' + self.claim_Id).prop('checked', true);
                                        // Call Edit claim API for rebind after save
                                        commonjs.getClaimStudy(self.claim_Id, function (result) {
                                            self.rendered = false;
                                            self.clearDependentVariables();
                                            self.showEditClaimForm(self.claim_Id, 'reload', {
                                                'study_id': result && result.study_id ? result.study_id : 0,
                                                'patient_name': self.cur_patient_name,
                                                'patient_id': self.cur_patient_id,
                                                'order_id': result && result.order_id ? result.order_id : 0,
                                                'grid_id': self.options && self.options.grid_id || null,
                                                'from': self.options && self.options.from || self.openedFrom || null
                                            });
                                        });
                                    }

                                }, 800);

                            }

                            commonjs.hideLoading();
                        },
                        error: function (model, response) {
                            commonjs.handleXhrError(model, response);
                            saveButton.prop('disabled', false);
                            $claimProcess.prop('disabled', false);
                        }
                    });
                }
                else {
                    saveButton.prop('disabled', false);
                    $claimProcess.prop('disabled', false);
                }
            },

            validateClaimData: function () {
                var self = this;
                self.is_primary_available = false;
                self.is_secondary_available = false;
                self.is_tertiary_available = false;
                self.isUpdatePatientInfo = false;
                /* Claims section */
                if (!$('#txtClaimDate').val()) {
                    commonjs.showWarning("messages.warning.claims.selectClaimDate");
                    $('#txtClaimDate').focus();
                    return false;
                }

                if (!$('#ddlFacility').val()) {
                    commonjs.showWarning("messages.warning.shared.selectfacility");
                    $('#ddlFacility').focus();
                    return false;
                }

                if (!$('#ddlBillingProvider').val()) {
                    commonjs.showWarning("messages.warning.shared.selectbillingProvider");
                    $('#ddlBillingProvider').focus();
                    return false;
                }

                if (!self.ACSelect.readPhy.contact_id && app.country_alpha_3_code === 'can') {
                    commonjs.showWarning("messages.warning.shared.selectRenderingProvider");
                    $('#ddlRenderingProvider').focus();
                    return false;
                }

                /* Insurance section */
                var mandatory_fields = {
                    primaryfields: [
                        $('#ddlPriRelationShip option:selected').val().trim() || '',
                        $('#txtPriSubFirstName').val().trim(),
                        $('#txtPriSubLastName').val().trim(),
                        $('#txtPriDOB').val().trim().trim(),
                        $('#ddlPriGender').val() ? $('#ddlPriGender').val().trim() : '',
                        $('#txtPriSubPriAddr').val().trim(),
                        $('#txtPriCity').val().trim(),
                        $('#ddlPriState option:selected').val() && $('#ddlPriState option:selected').val().trim() || '',
                        $('#txtPriZipCode').val().trim()
                    ],
                    primaryfieldObjs: [
                        { obj: $('#ddlPriRelationShip'), msg: 'messages.warning.claims.selectRelationshipPrimaryInsurance' },
                        { obj: $('#txtPriSubFirstName'), msg: 'messages.warning.claims.enterFirstnamePrimaryInsurance' },
                        { obj: $('#txtPriSubLastName'), msg: 'messages.warning.claims.enterLastnamePrimaryInsurance' },
                        { obj: $('#txtPriDOB'), msg: 'messages.warning.claims.enterDOBPrimaryInsurance' },
                        { obj: $('#ddlPriGender'), msg: 'messages.warning.claims.selectGenderPrimaryInsurance' },
                        { obj: $('#txtPriSubPriAddr'), msg: 'messages.warning.claims.enterAddressPrimaryInsurance' },
                        { obj: $('#txtPriCity'), msg: 'messages.warning.claims.enterCityPrimaryInsurance' },
                        { obj: $('#ddlPriState'), msg: 'messages.warning.claims.selectStatePrimaryInsurance' },
                        { obj: $('#txtPriZipCode'), msg: 'messages.warning.claims.enterZipcodePrimaryInsurance' }
                    ]
                }

                var txtPriPolicyNo = ($('#txtPriPolicyNo').val() && $('#txtPriPolicyNo').val().trim()) || '';

                if (app.country_alpha_3_code === 'can') {
                    if (self.priInsCode && ['HCP', 'WSIB'].indexOf(self.priInsCode.toUpperCase()) >= 0) {
                        if (!txtPriPolicyNo) {
                            commonjs.showWarning('messages.warning.shared.invalidHealthNumber');
                            $('#txtPriPolicyNo').focus();
                            return false;
                        }
                    }
                } else {
                    mandatory_fields.primaryfields.push(txtPriPolicyNo)
                    mandatory_fields.primaryfieldObjs.push(
                        { obj: $('#txtPriPolicyNo'), msg: 'messages.warning.claims.selectPolicyPrimaryInsurance' }
                    );

                    mandatory_fields.secondaryfields = [
                        $('#txtSecPolicyNo').val().trim(),
                        $('#ddlSecRelationShip option:selected').val().trim() || '',
                        $('#txtSecSubFirstName').val().trim(),
                        $('#txtSecSubLastName').val().trim(),
                        $('#ddlSecGender').val() ? $('#ddlSecGender').val().trim() : '',
                        $('#txtSecDOB').val().trim(),
                        $('#txtSecSubPriAddr').val().trim(),
                        $('#txtSecCity').val().trim(),
                        $('#ddlSecState option:selected').val().trim() || '',
                        $('#txtSecZipCode').val().trim()
                    ];
                    mandatory_fields.secondaryfieldObjs = [
                        { obj: $('#txtSecPolicyNo'), msg: 'messages.warning.claims.selectPolicySecondaryInsurance' },
                        { obj: $('#ddlSecRelationShip'), msg: 'messages.warning.claims.selectRelationshipSecondaryInsurance' },
                        { obj: $('#txtSecSubFirstName'), msg: 'messages.warning.claims.enterFirstnameSecondaryInsurance' },
                        { obj: $('#txtSecSubLastName'), msg: 'messages.warning.claims.enterLastnameSecondaryInsurance' },
                        { obj: $('#ddlSecGender'), msg: 'messages.warning.claims.selectGenderSecondaryInsurance' },
                        { obj: $('#txtSecDOB'), msg: 'messages.warning.claims.enterDOBSecondaryInsurance' },
                        { obj: $('#txtSecSubPriAddr'), msg: 'messages.warning.claims.enterAddressSecondaryInsurance' },
                        { obj: $('#txtSecCity'), msg: 'messages.warning.claims.enterCitySecondaryInsurance' },
                        { obj: $('#ddlSecState'), msg: 'messages.warning.claims.selectStateSecondaryInsurance' },
                        { obj: $('#txtSecZipCode'), msg: 'messages.warning.claims.enterZipcodeSecondaryInsurance' }
                    ];
                    mandatory_fields.tertiaryfields = [
                        $('#txtTerPolicyNo').val().trim(),
                        $('#ddlTerRelationShip option:selected').val().trim() || '',
                        $('#txtTerSubFirstName').val().trim(),
                        $('#txtTerSubLastName').val().trim(),
                        $('#ddlTerGender').val() ? $('#ddlTerGender').val().trim() : '',
                        $('#txtTerDOB').val().trim(),
                        $('#txtTerSubPriAddr').val().trim(),
                        $('#txtTerCity').val().trim(),
                        $('#ddlTerState option:selected').val().trim() || '',
                        $('#txtTerZipCode').val().trim()
                    ];
                    mandatory_fields.tertiaryfieldObjs = [
                        { obj: $('#txtTerPolicyNo'), msg: 'messages.warning.claims.selectPolicyTertiaryInsurance' },
                        { obj: $('#ddlTerRelationShip'), msg: 'messages.warning.claims.selectRelationshipTertiaryInsurance' },
                        { obj: $('#txtTerSubFirstName'), msg: 'messages.warning.claims.enterFirstnameTertiaryInsurance' },
                        { obj: $('#txtTerSubLastName'), msg: 'messages.warning.claims.enterLastnameTertiaryInsurance' },
                        { obj: $('#ddlTerGender'), msg: 'messages.warning.claims.selectGenderTertiaryInsurance' },
                        { obj: $('#txtTerDOB'), msg: 'messages.warning.claims.enterDOBTertiaryInsurance' },
                        { obj: $('#txtTerSubPriAddr'), msg: 'messages.warning.claims.enterAddressTertiaryInsurance' },
                        { obj: $('#txtTerCity'), msg: 'messages.warning.claims.enterCityTertiaryInsurance' },
                        { obj: $('#ddlTerState'), msg: 'messages.warning.claims.selectStateTertiaryInsurance' },
                        { obj: $('#txtTerZipCode'), msg: 'messages.warning.claims.enterZipcodeTertiaryInsurance' }
                    ];

                }
                function checkEmpty(val) {
                    return val == '';
                }

                if (self.priInsID || !mandatory_fields.primaryfields.every(checkEmpty)) {

                    if (mandatory_fields.primaryfields.indexOf('') > -1 || mandatory_fields.primaryfields.indexOf(null) > -1) {
                        commonjs.showWarning(mandatory_fields.primaryfieldObjs[mandatory_fields.primaryfields.indexOf('')].msg);
                        mandatory_fields.primaryfieldObjs[mandatory_fields.primaryfields.indexOf('')].obj.focus();
                        return false;
                    }
                    if ($('#ddlPriInsurance').val() == '') {
                        commonjs.showWarning("messages.warning.claims.selectPriInsurance");
                        $('#ddlPriInsurance').focus();
                        return false;
                    }
                    else
                        self.is_primary_available = true;
                }
                if (app.country_alpha_3_code !== 'can' && (self.secInsID || !mandatory_fields.secondaryfields.every(checkEmpty))) {
                    if (!self.priInsID) {

                        commonjs.showWarning("messages.warning.claims.priMissingValidation");
                        return false;
                    }
                    else {

                        if (mandatory_fields.secondaryfields.indexOf('') > -1 || mandatory_fields.secondaryfields.indexOf(null) > -1) {
                            commonjs.showWarning(mandatory_fields.secondaryfieldObjs[mandatory_fields.secondaryfields.indexOf('')].msg);
                            mandatory_fields.secondaryfieldObjs[mandatory_fields.secondaryfields.indexOf('')].obj.focus();
                            // commonjs.showWarning("messages.warning.shared.secInsValidation");
                            return false;
                        }
                        if ($('#s2id_txtSecInsurance a span').html() == 'Search Carrier' || $('#s2id_txtSecInsurance a span').html() == '') {

                            commonjs.showWarning("messages.warning.claims.selectSecInsurance");
                            return false;
                        }
                        else
                            self.is_secondary_available = true;
                    }
                }
                if (app.country_alpha_3_code !== 'can' && (self.terInsID || !mandatory_fields.tertiaryfields.every(checkEmpty))) {
                    if (!self.secInsID) {

                        commonjs.showWarning("messages.warning.claims.secMissingValidation");
                        return false;
                    }
                    else {

                        if (mandatory_fields.tertiaryfields.indexOf('') > -1 || mandatory_fields.tertiaryfields.indexOf(null) > -1) {

                            commonjs.showWarning(mandatory_fields.tertiaryfieldObjs[mandatory_fields.tertiaryfields.indexOf('')].msg);
                            mandatory_fields.tertiaryfieldObjs[mandatory_fields.tertiaryfields.indexOf('')].obj.focus();

                            return false;
                        }
                        if ($('#s2id_txtTerInsurance a span').html() == 'Search Carrier' || $('#s2id_txtTerInsurance a span').html() == '') {

                            commonjs.showWarning("messages.warning.claims.selectSecInsurance");
                            return false;
                        }
                        else
                            self.is_tertiary_available = true;
                    }
                }

                if (self.priInsID && self.validatePatientAddress("primary")) {
                    self.isUpdatePatientInfo = true;
                }

                if (app.country_alpha_3_code === 'can' && self.validateHealthNumberInputCanada("txtPriPolicyNo") ) {
                    commonjs.showWarning('messages.warning.shared.invalidHealthNumber');
                    return false;
                }
                /* Charge section */
                var invalidCount = 0;

                $("#tBodyCharge").find("tr").each(function (index) {

                    var modifiers = [
                        $(this).find("#txtModifier1_" + index).val() ? $(this).find("#txtModifier1_" + index).val() : '',
                        $(this).find("#txtModifier2_" + index).val() ? $(this).find("#txtModifier2_" + index).val() : '',
                        $(this).find("#txtModifier3_" + index).val() ? $(this).find("#txtModifier3_" + index).val() : '',
                        $(this).find("#txtModifier4_" + index).val() ? $(this).find("#txtModifier4_" + index).val() : ''
                    ];

                    if (modifiers[0] == "" && (modifiers[1] != "" || modifiers[2] != "" || modifiers[3] != "")) {
                        $(this).find("#txtModifier1_" + index).focus();
                        invalidCount++;
                        return false;
                    }
                    if (modifiers[1] == "" && (modifiers[2]  != "" || modifiers[3]  != "")) {
                        $(this).find("#txtModifier2_" + index).focus();
                        invalidCount++;
                        return false;
                    }
                    if (modifiers[2]  == "" && (modifiers[3]  != "")) {
                        $(this).find("#txtModifier3_" + index).focus();
                        invalidCount++;
                        return false;
                    }
                });

                if (invalidCount > 0) {
                    commonjs.showWarning("messages.warning.claims.modifiersRequired");
                    return false;
                }
                if (!$('#tBodyCharge tr').length) {
                    commonjs.showWarning("messages.warning.shared.chargeValidation", 'largewarning');
                    return false;
                }
                if ($('.cptcode').hasClass('cptIsExists')) {
                    commonjs.showWarning("messages.warning.claims.selectCPTValidation");
                    return false;
                }
                if ($('.diagCodes').hasClass('invalidCpt')) {
                    commonjs.showWarning("messages.warning.claims.pointerRequired");
                    $('.invalidCpt').focus();
                    return false;
                }
                if ($('.modifiers').hasClass('invalidModifier')) {
                    commonjs.showWarning("messages.warning.claims.modifierValidation");
                    $('.invalidModifier').focus();
                    return false;
                }
                if ($('.units').hasClass('invalidUnites')) {
                    commonjs.showWarning("messages.warning.claims.unitsValidation");
                    $('.invalidUnites').focus();
                    return false;
                }

                /*Billing summary Section*/
                if (!$('#ddlClaimStatus').val()) {
                    commonjs.showWarning("messages.warning.shared.missingClaimStatus");
                    $('#ddlClaimStatus').focus();
                    return false;
                }
                if (!$('#ddlClaimResponsible').val()) {
                    commonjs.showWarning("messages.warning.shared.missingResponsible");
                    $('#ddlClaimResponsible').focus();
                    return false;
                }

                /* Additional Info Section */
                if (self.wcf.date() || self.wct.date()) {
                    if (!self.validateFromAndToDate(self.wcf, self.wct))
                        return false;
                }

                if (self.hcf.date() || self.hct.date()) {
                    if (!self.validateFromAndToDate(self.hcf, self.hct))
                        return false;
                    else
                        return true;
                }
                else
                    return true;

            },

            convertToTimeZone: function (facility_id, date_data) {
                return commonjs.convertToFacilityTimeZone(facility_id, date_data)
            },

            validateFromAndToDate: function (objFromDate, objToDate) {
                var validationResult = commonjs.validateDateTimePickerRange(objFromDate, objToDate, true);
                if (!validationResult.valid) {
                    commonjs.showWarning(validationResult.message);
                    return false;
                }
                return true;
            },

            changeRelationalShip: function (e) {
                var self = this;
                var patID = self.cur_patient_id;
                this.patientmodel = new patientModel();
                var subscriberFlag = false;

                var _targetFlag = $(e.target).attr('id') == "ddlPriRelationShip" || $(e.target).attr('id') == "chkPriSelf" ?
                    'Pri' : $(e.target).attr('id') == "ddlSecRelationShip" || $(e.target).attr('id') == "chkSecSelf" ?
                        'Sec' : 'Ter';

                if (!subscriberFlag) {
                    this.patientmodel.fetch({
                        data: { id: patID },
                        success: function (model, response) {
                            if (response.length) {
                                response = response[0];
                                var contactInfo = commonjs.hstoreParse(response.patient_info);
                                self.patientAddress = contactInfo;
                                self.firstName = response && response && response.first_name;
                                self.lastName = response.last_name;
                                self.mi = response.middle_name;
                                self.suffix = response.suffix_name;
                                self.gender = response.gender;
                                self.address1 = contactInfo.c1AddressLine1;
                                self.address2 = contactInfo.c1AddressLine2;
                                self.city = contactInfo.c1City;
                                self.state = contactInfo.c1State;
                                self.zipCode = contactInfo.c1Zip;
                                document.querySelector('#txt' + _targetFlag + 'DOB').value = response.birth_date ? moment(response.birth_date).format('L') : '';
                                self.homePhone = contactInfo.c1HomePhone;
                                self.workPhone = contactInfo.c1WorkPhone;
                                subscriberFlag = true;
                                self.bindSubscriber(_targetFlag);
                            }
                        }
                    });
                }
                else {
                    self.bindSubscriber(_targetFlag);
                }
            },
            bindSubscriber: function (flag) {
                var self = this;
                var relationalShip = $.trim($('#ddl' + flag + 'RelationShip option:selected').text());
                $('#txt' + flag + 'SubFirstName').val('');
                $('#txt' + flag + 'SubLastName').val('');
                $('#txt' + flag + 'SubMiName').val('');
                $('#txt' + flag + 'SubSuffix').val('');
                $('#ddl' + flag + 'Gender').val('');
                if (self.checkAddressDetails(flag)) {
                    var msg = commonjs.geti18NString("messages.confirm.billing.changeAddressDetails")
                    if (confirm(msg)) {
                        $('#txt' + flag + 'SubPriAddr').val('');
                        $('#txt' + flag + 'SubSecAddr').val('');
                        $('#txt' + flag + 'City').val('');
                        $('#ddl' + flag + 'State').val('');
                        $('#txt' + flag + 'ZipCode').val('');
                    }
                }
                else {
                    $('#txt' + flag + 'SubPriAddr').val(self.address1);
                    $('#txt' + flag + 'SubSecAddr').val(self.address2);
                    $('#txt' + flag + 'City').val(self.city);
                    $('#ddl' + flag + 'State').val(self.state);
                    $('#txt' + flag + 'ZipCode').val(self.zipCode);
                }
                if (relationalShip.toLowerCase() == "self") {
                    $('#txt' + flag + 'SubFirstName').val(self.firstName);
                    $('#txt' + flag + 'SubLastName').val(self.lastName);
                    $('#txt' + flag + 'SubMiName').val(self.mi);
                    $('#txt' + flag + 'SubSuffix').val(self.suffix);
                    $('#ddl' + flag + 'Gender').val(self.gender);
                }
                else
                    document.querySelector('#txt' + flag + 'DOB').value = ""
            },
            checkAddressDetails: function (flag) {
                var chkaddress1 = $('#txt' + flag + 'SubPriAddr').val();
                var chkaddress2 = $('#txt' + flag + 'SubSecAddr').val();
                var chkcity = $('#txt' + flag + 'City').val();
                var chkstate = $('#ddl' + flag + 'State option:selected').val();
                var chkzipcode = $('#txt' + flag + 'ZipCode').val();
                if (chkaddress1 == '' && chkaddress2 == '' && chkcity == '' && (chkstate == '' || chkstate == '0') && chkzipcode == '') {
                    return false;
                }
                else {
                    return true;
                }
            },

            resetInsurances: function (e) {

                var self = this, flag, payer_type;
                var id = e.target.id;

                if (id == 'btnResetPriInsurance') {
                    flag = 'Pri'
                    payer_type = 'PIP_P';
                    self.priInsID = '';
                    self.priInsCode = '';
                    self.priInsName = '';
                    self.is_primary_available = false;
                    self.priClaimInsID = null;

                }
                else if (id == 'btnResetSecInsurance') {
                    flag = 'Sec'
                    payer_type = 'PIP_S';
                    self.secInsID = '';
                    self.secInsName = '';
                    $('#chkSecMedicarePayer').prop('checked', false);
                    $('#selectMedicalPayer').toggle(false);
                    self.is_secondary_available = false;
                    self.secClaimInsID = null;

                }
                else if (id == 'btnResetTerInsurance') {
                    flag = 'Ter'
                    payer_type = 'PIP_T';
                    self.terInsID = '';
                    self.terInsName = '';
                    self.is_tertiary_available = false;
                    self.terClaimInsID = null;

                }

                if (flag && payer_type) {
                    $('#ddlExist' + flag + 'Ins').val('');
                    $('#txt' + flag + 'Insurance').val('');
                    $('#chk' + flag + 'AcptAsmt').prop('checked', false);
                    $('#lbl' + flag + 'InsPriAddr').html('');
                    $('#lbl' + flag + 'InsCityStateZip').html('');
                    $('#lbl' + flag + 'PhoneNo').html('');
                    $('#txt' + flag + 'PolicyNo').val('');
                    $('#txt' + flag + 'GroupNo').val('');
                    $('#ddl' + flag + 'RelationShip').val('');
                    $('#txt' + flag + 'SubFirstName').val('');
                    $('#txt' + flag + 'SubMiName').val('');
                    $('#txt' + flag + 'SubLastName').val('');
                    $('#txt' + flag + 'SubSuffix').val('');
                    $('#ddl' + flag + 'Gender').val('');
                    $('#txt' + flag + 'SubPriAddr').val('');
                    $('#txt' + flag + 'SubSecAddr').val('');
                    $('#txt' + flag + 'City').val('');
                    $('#ddl' + flag + 'State').val('');
                    $('#txt' + flag + 'ZipCode').val('');

                    document.querySelector('#txt' + flag + 'DOB').value = '';
                    document.querySelector('#txt' + flag + 'StartDate').value = '';
                    document.querySelector('#txt' + flag + 'ExpDate').value = '';

                    if(flag == 'Pri'){
                        $('#ddlServiceType').multiselect("deselectAll", false).multiselect("refresh");
                        $('#txtBenefitOnDate').val('');
                    }
                    else if(flag == 'Sec'){
                        $('#ddlServiceType2').multiselect("deselectAll", false).multiselect("refresh");
                        $('#txtBenefitOnDate2').val('');
                    }
                    else {
                         $('#ddlServiceType3').multiselect("deselectAll", false).multiselect("refresh");
                         $('#txtBenefitOnDate3').val('');
                    }
                    $('#ddl' + flag + 'Insurance').empty();
                    $('#select2-ddl' + flag + 'Insurance-container').html(self.usermessage.selectCarrier);

                    // remove from ResponsibleList
                    self.updateResponsibleList({
                        payer_type: payer_type,
                        payer_id: null,
                        payer_name: null,
                        billing_method: null
                    }, null);
                }

            },

            bindProblemsContent: function (problems) {
                var self = this;

                _.each(problems, function (icdObj, index) {

                    // limited DiagnosisCodes upto 12
                    if (index < 12) {
                        self.ICDID = icdObj.id;
                        self.icd_code = icdObj.code;
                        self.icd_description = icdObj.description;
                        self.addDiagCodes(true);
                    }
                });
            },

            validateClaim: function(){
                var self=this;
                var claimIds =[];

                claimIds.push(self.claim_Id);

                if (self.claim_Id && claimIds && claimIds.length == 0) {
                    commonjs.showWarning("messages.errors.errorOnClaimValidation");
                    return false;
                }

                if (app.country_alpha_3_code === 'can' && !self.billing_method) {
                    return commonjs.showWarning('messages.status.pleaseSelectValidClaimsMethod');
                }

                $("#btnValidateClaim").attr("disabled", true);
                $.ajax({
                    url: '/exa_modules/billing/claim_workbench/validate_claims',
                    type: 'POST',
                    data: {
                        claim_ids: claimIds,
                        country: app.country_alpha_3_code
                    },
                    success: function(data, response){
                        $("#btnValidateClaim").prop("disabled", false);
                        if (data) {
                            commonjs.hideLoading();

                            if (!data.invalidClaim_data.length) {
                                commonjs.showStatus("messages.status.validatedSuccessfully");

                                if (data.validClaim_data && data.validClaim_data.rows && data.validClaim_data.rows.length) {
                                    self.claim_row_version = data.validClaim_data.rows[0].claim_row_version || self.claim_row_version;
                                    $('#ddlClaimStatus').val(data.validClaim_data.rows[0].claim_status_id);
                                    var pending_submission_status = app.claim_status.filter(function (obj) {
                                        return obj.id === parseInt(data.validClaim_data.rows[0].claim_status_id)
                                    });
                                    var statusDetail = commonjs.getClaimColorCodeForStatus(pending_submission_status[0].code, 'claim');
                                    var color_code = statusDetail && statusDetail[0] && statusDetail[0].color_code || 'transparent';
                                    var $gridId = self.options && self.options.grid_id || '';
                                    var pageSource = self.options && self.options.from || '';
                                        $gridId = $gridId.replace(/#/, '');

                                    if ($gridId) {
                                        $('#' + $gridId + ' tr#' + self.claim_Id, parent.document).find('td[aria-describedby=' + $gridId + '_claim_status]').text(pending_submission_status && pending_submission_status[0].description).css("background-color", color_code);
                                    } else if (pageSource !== 'patientSearch' && $gridId == '') {
                                        commonjs.showWarning(commonjs.geti18NString("messages.errors.gridIdNotExists"));
                                    }
                                }
                            }
                            else {
                                commonjs.showNestedDialog({ header: 'Validation Results', i18nHeader: 'billing.claims.validationResults', width: '70%', height: '60%', html: self.claimValidation({ response_data: data.invalidClaim_data }) });
                            }
                        }
                    },
                    error: function (err, response) {
                        $("#btnValidateClaim").attr("disabled", false);
                        commonjs.handleXhrError(err, response);
                    }
                })
            },

            processClaim: function (e) {
                var self = this, currentRowID;
                var $tblGrid = self.options.grid_id || null;
                var parentGrid = $($tblGrid, parent.document);
                self.isInitialLoaded = true;

                if (self.openedFrom === 'claims') {
                    currentRowID = self.claim_Id;
                } else if (self.openedFrom === 'studies') {
                    currentRowID = self.options && self.options.study_id;
                }
                if (currentRowID && $tblGrid) {
                    var rowData = parentGrid.has("input[type=checkbox]").find('tr#' + currentRowID);
                    var nextRowData = $(e.target).attr('id') == 'btnPrevClaim' ? rowData.prevAll().has("input[type=checkbox]") : rowData.nextAll().has("input[type=checkbox]");
                    if (rowData.length === 0 && nextRowData.length === 0) {
                        if ($(e.target).attr('id') !== 'btnPrevClaim') {
                            nextRowData = parentGrid.find('tr#' + self.nextRow).has("input[type=checkbox]");
                        } else {
                            nextRowData = parentGrid.find('tr#' + self.previousRow).has("input[type=checkbox]");
                        }
                    }
                    if (nextRowData.attr('id') && nextRowData.length > 0) {
                        var rowId = nextRowData.attr('id');
                        self.clearInsuranceFields(true, ['Pri', 'Sec', 'Ter']);
                        $(e.target).prop('disabled', true);
                        var data = parentGrid.getRowData(rowId);
                        if (data.hidden_claim_id == self.claim_Id) {
                            nextRowData = $(e.target).attr('id') == 'btnPrevClaim' ? nextRowData.prev() : nextRowData.next();
                            rowId = nextRowData.attr('id');
                            data = parentGrid.getRowData(rowId);
                        }

                        if (self.openedFrom === 'studies' && data.billed_status === 'UnBilled') {
                            self.claim_Id = null;
                            self.rendered = false;
                            self.isEdit = false;
                            self.showClaimForm({
                                'from': 'studies',
                                'study_id': rowId,
                                'order_id': data.hidden_order_id,
                                'account_no': data.account_no,
                                'study_date': data.study_dt,
                                'patient_id': data.hidden_patient_id,
                                'facility_id': data.hidden_facility_id,
                                'patient_dob': data.hidden_birth_date,
                                'patient_name': data.patient_name,
                                'accession_no': data.accession_no,
                                'billed_status': data.billed_status,
                                'grid_id': self.options.grid_id || null
                            }, 'studies');
                            // Hide non-edit claim tabs
                            if (!self.isEdit) {
                                $('.editClaimRelated').hide();
                            }
                            self.updateReportURL(data.hidden_patient_id, data.hidden_order_id, rowId);
                        } else if (self.openedFrom === 'claims' || data.billed_status === 'Billed') {
                            rowId = self.openedFrom === 'studies' ? data.hidden_claim_id : rowId;
                            commonjs.getClaimStudy(rowId, function (result) {
                                self.rendered = false;
                                self.clearDependentVariables();
                                var study_id = result && result.study_id ? result.study_id : 0;
                                var patient_id = data.hidden_patient_id;
                                var order_id = result && result.order_id ? result.order_id : 0;
                                self.showEditClaimForm(rowId, null, {
                                    'study_id': self.openedFrom === 'studies' ? data.hidden_study_id : study_id,
                                    'patient_name': data.patient_name,
                                    'patient_id': patient_id,
                                    'order_id': order_id,
                                    'grid_id': self.options.grid_id || null
                                });

                                self.updateReportURL(patient_id, order_id, study_id);
                                $('#modal_div_container').scrollTop(0);
                            });
                        }
                        if (window.patientChartWindow) {
                            commonjs.closePatientChartWindow();
                        }
                    } else {
                        commonjs.showWarning("messages.warning.claims.orderNotFound");
                    }

                } else {
                    commonjs.showWarning("messages.warning.claims.errorOnNextPrev");
                }
            },

            updateReportURL: function (patient_id, order_id, study_id) {
                if (window.reportWindow && window.reportWindow.location.hash) {
                    var queryParams = window.reportWindow.location.hash.split("?")[1];
                    window.reportWindow.location.hash = '#patient/patientReport/all/' + btoa(patient_id) + '/' + btoa(order_id) + '/' + btoa(study_id) + '?' + queryParams;
                }
            },

            bindTabMenuEvents: function () {
                var self = this;

                var tab_menu_link = $('ul#tab_menu li a');
                var tab_menu_item = $('ul#tab_menu li');
                var $root = $('#modal_div_container');

                tab_menu_link.off().click(function (e) {
                    var currId = $(this).attr('href').split('_')[1];
                    tab_menu_item.removeClass('active');
                    e && $(e.target).closest('li').addClass('active');

                    var _height = 0;
                    for (var i = 1; i < currId; i++) {
                        _height += parseInt($('#tab_' + i).height() + 15);
                    }
                    // currentTargetId Example: 4th -BillingSummary & 5th -Payment section
                    if (currId == 4 || currId == 5)
                        _height -= app.country_alpha_3_code !== 'can' ? parseInt($('#divTeritaryInsurances').height() + 15) : parseInt($('#divInsurances').height() + 15);

                    $root.animate({
                        scrollTop: _height
                    }, 100);

                    if ($('#tab_' + currId).find('input[type=text],textarea, select').filter(':input:enabled:visible:first'))
                        $('#tab_' + currId).find('input[type=text],textarea, select').filter(':input:enabled:visible:first').focus();
                    e && e.preventDefault ? e.preventDefault() : e.returnValue = false;
                });

                $('#modal_div_container').scrollTop(0);
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
                        commonjs.showLoading("messages.loadingMsg.searching");
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
                        this.bindPatientGrid(true);
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

            bindPatientGrid: function (isTotalRecordNeeded) {
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
                    patientList.birth_date = moment(patientList.birth_date).format('L');
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

                // $('.selectionpatient').dblclick(function (e) {
                //     self.selectPatient(e);
                // });
                $('.selectionpatient').off().click(function (e) {
                    var $target = $(e.target || e.srcElement).closest('.studyList').length
                    if (!$target && $(e.target || e.srcElement).attr('id') != 'btnClaimWStudy' && $(e.target || e.srcElement).attr('id') != 'btnClaimWOStudy') {
                        self.selectPatient(e);
                        e.stopPropagation();
                    }
                });
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
                    self.bindPatientGrid(false);
                }
            },

            selectPatient: function (e) {
                var tagName = commonjs.getElementFromEventTarget(e).tagName;
                var self = this;
                var patientId = (tagName == 'P') ? (e.target || e.srcElement).parentElement.id.split('_')[2] : (e.target || e.srcElement).id.split('_')[2];
                var $studyDetails = $(e.target || e.srcElement).closest('.selectionpatient').find('.studyDetails');
                var facility_id = $(e.target || e.srcElement).closest('.selectionpatient').data('facility_id');
                self.cur_patient_id = patientId || 0;

                if (!$studyDetails.is(':visible')) {

                    $('.studyDetails').empty();
                    $('.studyDetails').hide();

                    $list = $('<ul class="studyList" style="width: 50%;margin:0px;"></ul>');
                    jQuery.ajax({
                        url: "/exa_modules/billing/claims/claim/studiesby_patient_id",
                        type: "GET",
                        data: {
                            id: patientId,
                            company_id: app.companyID
                        },
                        success: function (data) {
                            var charges = data && data.length && data[0].charges ? data[0].charges : [];
                            var patient_details = data && data.length && data[0].patient_details ? data[0].patient_details : {};

                            if (charges && charges.length) {
                                _.each(charges, function (study) {
                                    study.study_description = study.study_description ? study.study_description : '--';
                                    study.accession_no = study.accession_no ? study.accession_no : '--';
                                    var study_date = commonjs.getConvertedFacilityTime(study.study_dt, app.currentdate, 'L', app.facility_id);
                                    $list.append('<li><input id="studyChk_' + study.id + '" type="checkbox" name="chkStudy" data-study_dt="' + study.study_dt + '" data-accession_no="' + study.accession_no + '" />'+
                                    '<label style="font-weight: bold;overflow-wrap: break-word;"  for="studyChk_' + study.id + '" >' + study.study_description
                                    + ' ( Accession# : ' + study.accession_no + ' , Study.Date: ' + study_date + ')</label></li>');
                                });
                                $studyDetails.append($list);
                                $studyDetails.show();

                                $studyDetails.append($('<button/>').attr({'type':'button','i18n': 'billing.fileInsurance.withStudy','id':'btnClaimWStudy'}).addClass('btn top-buffer processClaim mr-2').css('height','33px'));
                                $studyDetails.append('<button style="height:33px;" type="button" i18n="billing.fileInsurance.createWithoutStudy" class="btn top-buffer processClaim" id="btnClaimWOStudy"></button>');
                                commonjs.updateCulture(app.currentCulture, commonjs.beautifyMe);
                                $('.processClaim').off().click(function (e) {

                                    if ($(e.target).attr('id') == 'btnClaimWStudy') {
                                        var selectedStudies = [];
                                        var $checkedInputs = $studyDetails.find('input').filter('[name=chkStudy]:checked');
                                        var selectedCount = $checkedInputs.length;

                                        if (selectedCount == 0) {
                                            commonjs.showWarning("messages.warning.claims.selectStudyValidation");
                                        } else {

                                            for (var r = 0; r < selectedCount; r++) {
                                                var studyId = $checkedInputs[r] && $checkedInputs[r].id ? $checkedInputs[r].id.split('_')[1] : 0;
                                                var study_dt = $checkedInputs[r] && $checkedInputs[r].dataset ? $checkedInputs[r].dataset.study_dt : null;
                                                var accession_no = $checkedInputs[r] && $checkedInputs[r].dataset ? $checkedInputs[r].dataset.accession_no : null;

                                                var study = {
                                                    study_id: studyId,
                                                    patient_id: patientId,
                                                    facility_id: facility_id,
                                                    study_date: study_dt,
                                                    patient_name: patient_details.patient_name || '',
                                                    account_no: patient_details.patient_account_no || '',
                                                    patient_dob: patient_details.patient_dob || '',
                                                    patient_gender: patient_details.patient_gender || '',
                                                    accession_no: accession_no,
                                                };
                                                selectedStudies.push(study);

                                            }
                                            var studyIds = selectedStudies.map(function(value) { return value.study_id; });
                                            studyIds = studyIds.join();
                                            window.localStorage.setItem('primary_study_details', JSON.stringify(selectedStudies[0]));
                                            window.localStorage.setItem('selected_studies', JSON.stringify(studyIds));

                                            $('#divPageLoading').show();
                                            self.showClaimForm({ from: 'patientSearch' }, 'patientSearch');

                                            setTimeout(function () {
                                                $('#divPageLoading').hide();
                                                $('.woClaimRelated').show();
                                                $('#divPatient').hide();
                                            }, 200);

                                        }

                                    }
                                    else {
                                        self.claimWOStudy(patient_details);
                                    }

                                });
                            } else {
                                var msg = commonjs.geti18NString("messages.confirm.billing.claimWithOutExam")
                                if (confirm(msg)) {
                                    self.claimWOStudy(patient_details);
                                }

                            }

                        },
                        error: function (err) {
                            commonjs.handleXhrError(err);
                        }
                    });
                }

            },

            clearInsuranceFields: function (clearClaimFields, flag) {
                var self = this;
                self.clearDependentVariables();
                if (clearClaimFields) {
                    $('#spTotalBillFeeValue, #spTotalAllowedFeeValue').empty();
                    //clear claim Section
                    $('#ulSelectedDiagCodes').empty();
                    $('#hdnDiagCodes').val('');
                    // clear icd details after bind
                    self.ICDID = self.icd_code = self.icd_description = '';
                    $('#txtClaimDate').empty();
                    $('#ddlFacility option:contains("Select")').prop("selected", true);
                    $('#ddlBillingProvider option:contains("Select")').prop("selected", true);
                    $('#ddlRenderingProvider, #ddlReferringProvider, #ddlOrdFacility').empty();
                    $('#ddlPOSType option:contains("Select")').prop("selected", true);
                    $('#ddlMultipleDiagCodes').find('option').remove();
                }
                //Clearing Primary, Secondary, Tertiary Insurance Fields
                self.priClaimInsID = '';
                self.secClaimInsID = '';
                self.terClaimInsID = '';
                self.primaryPatientInsuranceId = '';
                self.secondaryPatientInsuranceId = '';
                self.tertiaryPatientInsuranceId = '';
                self.priInsCode = '';

                $.each(flag, function (i) {
                    $('label[id="lbl' + flag[i] + 'InsPriAddr"]').text('');
                    $('label[id="lbl' + flag[i] + 'InsCityStateZip"]').text('');
                    $('label[id="lbl' + flag[i] + 'PhoneNo"]').text('');
                    $('#chk' + flag[i] + 'AcptAsmt').prop('checked', false);
                    $('#txt' + flag[i] + 'PolicyNo').val('');
                    $('#txt' + flag[i] + 'GroupNo').val('');
                    $('#txt' + flag[i] + 'StartDate').val('');
                    $('#txt' + flag[i] + 'ExpDate').val('');
                    $('#ddl' + flag[i] + 'RelationShip option:contains("Select")').prop("selected", true);
                    $('#txt' + flag[i] + 'SubFirstName').val('');
                    $('#txt' + flag[i] + 'SubMiName').val('');
                    $('#txt' + flag[i] + 'SubLastName').val('');
                    $('#txt' + flag[i] + 'SubSuffix').val('');
                    $('#txt' + flag[i] + 'DOB').val('');
                    $('#ddl' + flag[i] + 'Gender option:contains("Select")').prop("selected", true);
                    $('#txt' + flag[i] + 'SubPriAddr').val('');
                    $('#txt' + flag[i] + 'SubSecAddr').val('');
                    $('#txt' + flag[i] + 'City').val('');
                    $('#ddl' + flag[i] + 'Insurance').val('').trigger('change');
                    $('#ddl' + flag[i] + 'Insurance').find('option').remove();
                    $('#ddl' + flag[i] + 'State option:contains("Select")').prop("selected", true);
                    $('#txt' + flag[i] + 'ZipCode').val('');
                });
                $("input[id*='txtBenefitOnDate']").val('');

                //clear additional Info Section
                $('#chkEmployment, #chkAutoAccident, #chkOtherAccident, #chkOutSideLab').prop("checked", false);
                $('#txtDate, #txtOtherDate, #txtWCF,#txtWCT, #txtHCF,#txtHCT').val('');
                $('#txtClaimNotes').empty();
                $('#txtOriginalRef, #txtAuthorization').val('');
                $('#ddlFrequencyCode option:contains("Select")').prop("selected", true);

                //clear Billing Section
                $('#spBillFee, #spPatientPaid, #spAdjustment, #spBalance, #spAllowed, #spOthersPaid, #spRefund').val('');
                $('#ddlClaimStatus option:contains("Select")').prop("selected", true);
                $('#txtClaimResponsibleNotes').val('');
                $('#ddlClaimResponsible').empty();
            },

            claimWOStudy:function(patient_details){
                var self = this;
                self.patientAlerts = patient_details.alerts || [];
                // Claim w/o charge code  -- start
                $('#divPageLoading').show();

                // bind claim details
                self.bindDetails();
                $('.claimProcess').hide();
                $('#btPatientDocuemnt').hide();
                $('#btnPatientNotes').hide();

                //binding claim form events
                self.bindTabMenuEvents();
                self.bindclaimFormEvents();

                // Set Default details
                self.updateResponsibleList({
                    payer_type: 'PPP',
                    payer_name: patient_details.patient_name + '( Patient )',
                    payer_id: self.cur_patient_id
                }, null);

                $('#ddlFacility').val(app.facilityID || '');
                $('#ddlClaimStatus').val($("option[data-desc = 'PV']").val());
                $('#ddlClaimResponsible').val('PPP');

                self.claim_dt_iso = commonjs.convertToFacilityTimeZone(app.facilityID, app.currentdate).format('YYYY-MM-DD LT z');
                self.studyDate = commonjs.getConvertedFacilityTime(app.currentdate, '', 'L', app.facilityID);
                document.querySelector('#txtClaimDate').value = self.studyDate;

                // Bind Patient Default details
                var renderingProvider = patient_details.rendering_provider_full_name || self.usermessage.selectStudyReadPhysician;
                var service_facility_name = patient_details.service_facility_name || self.usermessage.selectOrdFacility;
                self.ACSelect.readPhy.contact_id = patient_details.rendering_provider_contact_id || patient_details.rendering_provider_contact_id || null;
                self.group_id = patient_details.service_facility_id ? parseInt(patient_details.service_facility_id) : null;
                self.group_name = service_facility_name;

                $('#ddlPOSType').val(app.country_alpha_3_code !== 'can' && patient_details.fac_place_of_service_id || '');
                $('#ddlBillingProvider').val(patient_details.billing_provider_id || '');
                $('#ddlFacility').val(patient_details.facility_id || '');
                $('#select2-ddlRenderingProvider-container').html(renderingProvider);
                $('#select2-ddlOrdFacility-container').html(service_facility_name);
                $('#select2-ddlReferringProvider-container').html(self.usermessage.selectStudyRefProvider);

                // Claim w/o charge code  -- end

                setTimeout(function () {
                    $('#divPageLoading').hide();
                    self.addPatientHeaderDetails(patient_details, 'create');
                    commonjs.updateCulture(app.currentCulture, commonjs.beautifyMe);
                    $('#divPatient').hide();
                    $('.woClaimRelated').show();
                    self.showAlertBadge();
                    self.getAlertEvent(); // for Patient Alert Button Click event availability
                }, 200);

                self.openedFrom = 'patientSearch';

            },

            showSelf: function() {
                var priSelf = ($('#ddlPriRelationShip option:selected').text()).toLowerCase();
                var secSelf = ($('#ddlSecRelationShip option:selected').text()).toLowerCase();
                var terSelf = ($('#ddlTerRelationShip option:selected').text()).toLowerCase();

                $.trim(priSelf) == 'self' ? $('#showPriSelf').hide() : $('#showPriSelf').show() ;
                $.trim(secSelf) == 'self' ? $('#showSecSelf').hide() : $('#showSecSelf').show() ;
                $.trim(terSelf) == 'self' ? $('#showTerSelf').hide() : $('#showTerSelf').show() ;
            },

            setPriRelationShipSelf: function(e) {
                if($('#chkPriSelf').is(":checked")) {
                    var selfValue = $('#ddlPriRelationShip option').filter(function () {
                        return this.text.toLowerCase() == 'self';
                    } ).attr('value');

                    $('#ddlPriRelationShip').val(selfValue).attr('selected', true);
                    $('#showPriSelf').hide();
                    $('#chkPriSelf').prop('checked', false);
                } else {
                    $("#ddlPriRelationShip option:contains('Selected')").attr('selected', 'selected');
                    $('#showPriSelf').show();
                }

            },

            setSecRelationShipSelf: function(e) {
                if($('#chkSecSelf').is(":checked")) {
                    var selfValue = $('#ddlSecRelationShip option').filter(function () {
                        return this.text.toLowerCase() == 'self';
                    } ).attr('value');

                    $('#ddlSecRelationShip').val(selfValue).attr('selected', true);
                    $('#showSecSelf').hide();
                    $('#chkSecSelf').prop('checked', false);
                } else {
                    $("#ddlSecRelationShip option:contains('Selected')").attr('selected', 'selected');
                    $('#showSecSelf').show();
                }
            },

            setTerRelationShipSelf: function(e) {
                if($('#chkTerSelf').is(":checked")) {
                    var selfValue = $('#ddlTerRelationShip option').filter(function () {
                        return this.text.toLowerCase() == 'self';
                    } ).attr('value');

                    $('#ddlTerRelationShip').val(selfValue).attr('selected', true);
                    $('#showTerSelf').hide();
                    $('#chkTerSelf').prop('checked', false);
                } else {
                    $("#ddlTerRelationShip option:contains('Selected')").attr('selected', 'Selected');
                    $('#showTerSelf').show();
                }
            },

            clearDependentVariables: function () {
                var self = this;
                self.priInsID = '';
                self.priInsName = '';
                self.is_primary_available = false;
                self.secInsID = '';
                self.secInsName = '';
                self.is_secondary_available = false;
                self.terInsID = '';
                self.terInsName = '';
                self.is_tertiary_available = false;
                self.responsible_list = [
                    { payer_type: "PPP", payer_type_name: "patient", payer_id: null, payer_name: null },
                    { payer_type: "PIP_P", payer_type_name: "primary_insurance", payer_id: null, coverage_level: "P", payer_name: null, billing_method: null },
                    { payer_type: "PIP_S", payer_type_name: "secondary_insurance", payer_id: null, coverage_level: "S", payer_name: null, billing_method: null },
                    { payer_type: "PIP_T", payer_type_name: "tertiary_insurance", payer_id: null, coverage_level: "T", payer_name: null, billing_method: null },
                    { payer_type: "POF", payer_type_name: "ordering_facility", payer_id: null, payer_name: null },
                    { payer_type: "RF", payer_type_name: "referring_provider", payer_id: null, payer_name: null }
                ]
            },

            insuranceUpdate:function(e){
                var self =this;

                // before clear check is that current responsible/Not.
                var _currentPayerType = $('#ddlClaimResponsible').data('current-payer') || '';
                var id = e.target.id || '';

                var _isCurrentResponsible = id == 'btnResetPriInsurance' && _currentPayerType == 'primary_insurance' ? true
                    : id == 'btnResetSecInsurance' && _currentPayerType == 'secondary_insurance' ? true
                        : id == 'btnResetTerInsurance' && _currentPayerType == 'tertiary_insurance' ? true
                            : false;
                var _payerType = id == 'btnResetPriInsurance' ? 'primary_insurance'
                    : id == 'btnResetSecInsurance' ? 'secondary_insurance'
                        : 'tertiary_insurance';

                if (self.isEdit) {

                    if(id == 'btnResetPriInsurance' && self.secClaimInsID){
                        commonjs.showWarning("messages.warning.claims.priMissingValidation");
                        return false;
                    }
                    else if(id == 'btnResetSecInsurance' && self.terClaimInsID){
                        commonjs.showWarning("messages.warning.claims.secMissingValidation");
                        return false;
                    }
                    // below conditions check if claim have insurances in DB level using [self.priClaimInsID,self.secClaimInsID,self.terClaimInsID]
                    else if(id == 'btnResetPriInsurance' && !self.priClaimInsID && !_isCurrentResponsible){
                        self.resetInsurances(e);
                        return false;
                    }
                    else if(id == 'btnResetSecInsurance' && !self.secClaimInsID && !_isCurrentResponsible){
                        self.resetInsurances(e);
                        return false;
                    }
                    else if(id == 'btnResetTerInsurance' && !self.terClaimInsID && !_isCurrentResponsible){
                        self.resetInsurances(e);
                        return false;
                    }
                    var msg = _isCurrentResponsible ? commonjs.geti18NString("messages.confirm.billing.insuranceReferencedAreYouSure") : commonjs.geti18NString("messages.confirm.billing.deletionConfirmation");

                    if (confirm(msg)) {
                        $.ajax({
                            url: '/exa_modules/billing/claims/claim/remove_insurance_provider',
                            type: 'POST',
                            data: {
                                claim_id: self.claim_Id,
                                is_current_responsible: _isCurrentResponsible,
                                payer_type: _payerType
                            },
                            success: function (result) {
                                if (result.length) {
                                    commonjs.showStatus("messages.status.successfullyUpdated");
                                    self.resetInsurances(e);
                                    if(_isCurrentResponsible){
                                        $('#ddlClaimResponsible').val('PPP');
                                        commonjs.showStatus("messages.status.responseUpdated");
                                    }
                                    self.claim_row_version = result[0].claim_row_version || self.claim_row_version;
                                    $("#btnClaimsRefresh").click();
                                    $("#btnStudiesRefresh").click();
                                    if (_payerType == 'primary_insurance') {
                                        self.is_primary_available = false;
                                        self.priClaimInsID = null;
                                    }
                                    else if (_payerType == 'secondary_insurance') {
                                        self.is_secondary_available = false;
                                        self.secClaimInsID = null;
                                    }
                                    else if (_payerType == 'tertiary_insurance') {
                                        self.is_tertiary_available = false;
                                        self.terClaimInsID = null;
                                    }
                                }
                            },
                            error: function (err, response) {
                                commonjs.handleXhrError(err, response);
                            }
                        });
                    }

                } else {
                    self.resetInsurances(e);
                }
            },

            showAlertBadge: function() {
                var self = this;
                var predefinedAlerts = self.patientAlerts && self.patientAlerts.alerts || [];
                var otherAlerts = self.patientAlerts && self.patientAlerts.others || [];
                var alertCount = _.size(predefinedAlerts) + _.size(otherAlerts);
                self.alertCount = alertCount || 0;

                if (alertCount > 0) {
                    $(parent.document).find('#alertBadge').html(alertCount).css("visibility", "visible");
                    $("#editClaimShowPatientAlerts").attr("title", "This patient has " + alertCount + " alerts");
                 } else {
                    $("#alertBadge").css("visibility", "hidden");
                    $("#editClaimShowPatientAlerts").attr('title', i18n.get('patient.patient.patientHasNoAlerts'));
                }

            },

            showPatientAlerts: function() {
                var self = this;
                if(self.alertCount <= 0 ) {
                    commonjs.showWarning('patient.patient.patientHasNoAlerts');
                    return false;
                }

                var alerts = self.patientAlerts && self.patientAlerts.alerts || null;
                var others = self.patientAlerts && self.patientAlerts.others || null;
                commonjs.showNestedDialog({ header: 'Patient Alerts', i18nHeader: 'menuTitles.patient.patientAlerts', width: '50%', height: '40%', html: self.patientAlertTemplate({alerts: alerts, others:others}) })
            },

            getAlertEvent: function() {
                var self = this;
                $('#editClaimShowPatientAlerts').off().click(function () {
                    self.showPatientAlerts();
                });
            },

            // Binding Header Patient Details
            addPatientHeaderDetails: function (patient_details, from) {
                var self = this;
                var headerTopic = from === 'create' ? i18n.get('shared.fields.claimCreation') + ' : ' : i18n.get('shared.buttons.edit') + ' : ';

                $(parent.document).find('#spanModalHeader')
                    .text(headerTopic)
                    .append($('<STRONG/>').text(patient_details.patient_name))
                    .append(' Acc#: ')
                    .append(patient_details.patient_account_no + ' ')
                    .append($('<i/>').text(moment(patient_details.patient_dob).format('L')))
                    .append(' ' + patient_details.patient_gender)
                    .append($('<span>').attr({
                        id: 'editClaimShowPatientAlerts',
                        class: 'alertLabel ml-3'
                    })
                        .append($('<a>')
                            .append($('<i>').attr({ class: 'icon-ic-alerts' }))
                            .append($('<span>').attr({'i18n': 'shared.screens.patient.alerts'}))
                            .append($('<div>').attr({ 'id': 'alertBadge', class: 'alertBadge' }))));

                var cssObj = {
                    'color': 'white',
                    'text-decoration': 'none',
                    'border-bottom': '1px solid white'
                };

                $(parent.document).find('#spanModalHeader')
                    .append($('<a/>', { href: "javascript:void(0)" }).attr({ 'i18n': 'menuTitles.patient.patientChart' })
                        .css(cssObj)
                        .click(function () {
                            var url = '/exa#patient/info/edit/' + btoa(self.cur_patient_id);
                            if (window.patientChartWindow && window.patientChartWindow.location.hash) {
                                window.patientChartWindow.location.hash = '#patient/info/edit/' + btoa(self.cur_patient_id);
                            } else {
                                window.patientChartWindow = window.open("about:blank");
                                window.patientChartWindow.location.href = url;
                            }
                        }));
            },

            bindClaimPaymentEvent: function () {
                var self = this;

                $('.paymentApply').off().click(_.debounce(function (e) {
                    var $tr = $(e.target).parents('tr');
                    var gridData;
                    var rowID = parseInt($($tr).attr('data_row_id')) || null;
                    var paymentID = $($tr).attr('data_payment_id') && parseInt($($tr).attr('data_payment_id')) || 0;
                    var paymentApplicationID = $($tr).attr('data_payment_application_id') || 0;
                    var paymentRowData = self.paymentList[rowID - 1] || {};

                    if ((self.chargeModel.length && !self.chargeModel[0].id) || self.chargeModel.length === 0) {
                        commonjs.showWarning("messages.warning.shared.paymentChargeValidation", 'largewarning');
                        return false;
                    }
                    if (!self.validatePaymentEdit(rowID, paymentRowData)) {
                        return false;
                    }

                    var _payerIndex = _.find(self.responsible_list, function (item) { return item.payer_type == $.trim($('#ddlPayerName_' + rowID).val()); });
                        _payerIndex = _payerIndex || {};;
                    var dataParams = {
                        paymentID: paymentID,
                        isFromClaim: true,
                        gridFlag: paymentID ? 'appliedPayments' : 'pendingPayments',
                        payerType: paymentRowData.payer_type || _payerIndex.payer_type_name,
                        claim_id : self.claim_Id,
                        paymentApplicationId : paymentApplicationID
                    };
                    commonjs.showLoading();
                    self.pendingPayments.fetch({
                        data: dataParams,
                        success: function (model, result) {
                            if (result && result.length) {
                                if (paymentID) {
                                    gridData = _.filter(result, { 'payment_application_id': paymentApplicationID });
                                    gridData = gridData.length ? gridData[0] : {};
                                } else {
                                    gridData = result[0];
                                }

                                gridData.isFromClaim = true;
                                gridData.claim_dt = gridData.claim_date;
                                gridData.cas_group_codes = null;
                                gridData.cas_reason_codes = null;
                                self.editPaymentView = new editPaymentView({ el: $('#modal_div_container') });

                                var isModifiedPaymentMode = $('#ddlPaymentMode_' + rowID).attr('data_payment_mode') != $('#ddlPaymentMode_' + rowID).val();
                                var accountingDateObj =  self.dtpAccountingDate[rowID - 1];
                                gridData.newPaymentObj = {
                                    accounting_date: accountingDateObj && accountingDateObj.date() ? accountingDateObj.date().format('YYYY-MM-DD') : null,
                                    notes: null,
                                    amount: 0.00,
                                    invoice_no: null,
                                    display_id: null,
                                    user_id: app.userID,
                                    paymentId: paymentID,
                                    credit_card_name: null,
                                    payment_reason_id: null,
                                    company_id: app.companyID,
                                    facility_id: self.facilityId,
                                    payment_dt: paymentRowData.payment_dt || null,
                                    payment_row_version : gridData.payment_row_version || null,
                                    payment_mode: $('#ddlPaymentMode_' + rowID).val() || null,
                                    credit_card_number: $("#txtCheckCardNo_" + rowID).val() || null,
                                    isPaymentUpdate : accountingDateObj.isModified || isModifiedPaymentMode
                                };

                                if (_payerIndex.payer_type === 'PPP' || paymentRowData.payer_type === 'patient') {
                                    gridData.newPaymentObj.payer_type = 'patient';
                                    gridData.newPaymentObj.patient_id = _payerIndex.payer_id || paymentRowData.payer_info.payer_id;
                                } else if (_payerIndex.payer_type === 'POF' || paymentRowData.payer_type === 'ordering_facility') {
                                    gridData.newPaymentObj.payer_type = 'ordering_facility';
                                    gridData.newPaymentObj.provider_group_id = _payerIndex.payer_id || paymentRowData.payer_info.payer_id;
                                } else if (_payerIndex.payer_type === 'RF' || paymentRowData.payer_type === 'ordering_provider') {
                                    gridData.newPaymentObj.payer_type = 'ordering_provider';
                                    gridData.newPaymentObj.provider_contact_id = _payerIndex.payer_id || paymentRowData.payer_info.payer_id;
                                } else {
                                    gridData.newPaymentObj.payer_type = 'insurance';
                                    gridData.newPaymentObj.insurance_provider_id = _payerIndex.payer_id || paymentRowData.payer_info.payer_id;
                                }
                                //Getting CAS Details before displaying payment popup
                                self.editPaymentView.setCasGroupCodesAndReasonCodes(true, function (cas_response) {
                                    if (cas_response && cas_response.length) {
                                        gridData.cas_group_codes = cas_response[0].cas_group_codes || [];
                                        gridData.cas_reason_codes = cas_response[0].cas_reason_codes || [];
                                    }
                                    // Call payment apply popup
                                    self.editPaymentView.showApplyAndCas(self.claim_Id, paymentID, paymentID ? 'applied' : 'pending', '', gridData, function (err, response) {
                                        if (response && response.payment_id) {
                                            var getPaymentDEtails = {
                                                url: '/exa_modules/billing/claims/claim/get_claim_payments',
                                                type: "GET",
                                                data: {
                                                    id: self.claim_Id
                                                },
                                                success: function (result) {
                                                    commonjs.hideLoading();
                                                    if (result && result.length) {
                                                        // Rebind claim payment table after apply payment popup closed
                                                        var payment_details = result[0].payment_details || [];
                                                        var claimBillingSummary = result[0].claim_fee_details && result[0].claim_fee_details.length && result[0].claim_fee_details[0] || {};
                                                        self.bindClaimPaymentLines(payment_details, true);
                                                        self.bindClaimPaymentEvent();
                                                        // Rebind claim billing summary details after apply payment popup closed
                                                        $('#spBillFee').text(commonjs.roundFee(claimBillingSummary.bill_fee || 0.00));
                                                        $('#spBalance').text(commonjs.roundFee(claimBillingSummary.balance || 0.00));
                                                        $('#spAllowed').text(commonjs.roundFee(claimBillingSummary.allowed || 0.00));
                                                        $('#spPatientPaid').text(commonjs.roundFee(claimBillingSummary.patient_paid || 0.00));
                                                        $('#spOthersPaid').text(commonjs.roundFee(claimBillingSummary.others_paid || 0.00));
                                                        $('#spAdjustment').text(commonjs.roundFee(claimBillingSummary.adjustment || 0.00));
                                                        $('#spRefund').text(commonjs.roundFee(claimBillingSummary.refund_amount || 0.00));
                                                    }
                                                },
                                                error: function (model, response) {
                                                    commonjs.handleXhrError(model, response);
                                                    commonjs.hideLoading();
                                                }
                                            }

                                            $.ajax(getPaymentDEtails);
                                        }
                                    });

                                });
                                commonjs.hideLoading();
                            } else {
                                commonjs.hideLoading();
                                commonjs.showWarning('messages.errors.errorOnClaimPayments');
                            }
                        },
                        error: function (model, response) {
                            commonjs.handleXhrError(model, response);
                            commonjs.hideLoading();
                        }
                    });

                }, 250));

                $('#btnNewPayment, .addPaymentLine').off().click(_.debounce(function (e) {
                    self.addPaymentLine(e)
                }, 250));

                $(".select-payment-mode").off().change(function (e) {
                    var selectedValue = $(e.target).val();
                    var $target = $(e.target).closest('tr').find('.checkcardno').val('');

                    if (['cash', 'eft', 'adjustment'].indexOf(selectedValue) > -1) {
                        $target.prop('disabled', true);
                    } else {
                        $target.prop('disabled', false);
                    }
                });

            },

            validatePaymentEdit: function (rowID, paymentRowData) {
                var self = this;
                var accountingDateObj = self.dtpAccountingDate[rowID - 1];
                var isPaymentUpdate = accountingDateObj.isModified || false;
                var accountingDate = isPaymentUpdate ? accountingDateObj.date().format('YYYY-MM-DD') : ( paymentRowData.accounting_date || accountingDateObj.date().format('YYYY-MM-DD') );
                var startDate = paymentRowData.payment_dt ? moment(paymentRowData.payment_dt).subtract(30, 'days').startOf('day') : moment().subtract(30, 'days').startOf('day');
                var endDate = paymentRowData.payment_dt ? moment(paymentRowData.payment_dt).add(30, 'days').startOf('day') : moment().add(30, 'days').startOf('day');
                var $paymentMode = $('#ddlPaymentMode_' + rowID);
                var $checkCardNo = $('#txtCheckCardNo_' + rowID);

                if ($('#txtAccountingDate_' + rowID).val() === '') {
                    commonjs.showWarning("messages.warning.payments.selectAccountingDate");
                    $('#txtAccountingDate_' + rowID).focus();
                    return false;
                }

                if ($('#ddlPayerName_' + rowID).val() === '') {
                    commonjs.showWarning("messages.warning.payments.selectPayerType");
                    $('#ddlPayerName_' + rowID).focus();
                    return false;
                }

                if ($paymentMode.val() === '') {
                    commonjs.showWarning("messages.warning.payments.selectPaymentMode");
                    $paymentMode.focus();
                    return false;
                }

                if ($paymentMode.val() === 'card' && $.trim($checkCardNo.val()) === "") {
                    commonjs.showWarning('messages.warning.payments.enterCardNo');
                    $checkCardNo.focus();
                    return false;
                }

                if ($paymentMode.val() === 'check' && $.trim($checkCardNo.val()) === "") {
                    commonjs.showWarning('messages.warning.payments.enterCheckNo');
                    $checkCardNo.focus();
                    return false;
                }

                if (!moment(accountingDate).isBetween(startDate, endDate) && accountingDate && isPaymentUpdate) {
                    return confirm(commonjs.geti18NString("messages.confirm.payments.overwriteAccountingDate"));
                }

                return true;
            },

            addPaymentLine: function (e) {
                var self = this;
                var index = $('#tBodyPayment').find('tr').length === 0 ? 1 : $('#tBodyPayment').find('tr').length + 1;
                var facilityTimeZoneObj = commonjs.getFacilityCurrentDateTime(self.facilityId)
                var _rowObj = {
                    accounting_date: commonjs.checkNotEmpty(facilityTimeZoneObj) ? facilityTimeZoneObj : commonjs.getCurrentDate(),
                    payment_application_id: 0,
                    row_index: index,
                    card_number: null,
                    payment_applied: null,
                    adjustment_applied: null,
                    id: null
                }
                var paymentRow = self.paymentRowTemplate({ row: _rowObj });
                $('#tBodyPayment').append(paymentRow);

                var dtp = commonjs.bindDateTimePicker("divAccountingDate_" + index, { format: 'L' });
                dtp.date(facilityTimeZoneObj);
                self.dtpAccountingDate.push(dtp);
                self.dtpAccountingDate[index - 1].isModified = false;
                // Bind claim responsible as payment payers
                self.updateResponsibleList(null, {
                    row_id: index
                });
                // Assign isModified = true for accounting date, Otherwise false
                $('#divAccountingDate_' + index).on("dp.change", function (e) {
                    if (e && e.date && e.oldDate && e.oldDate.format('L') != e.date.format('L')) {
                        self.dtpAccountingDate[index - 1].isModified = true;
                    }
                });
                commonjs.updateCulture(app.currentCulture, commonjs.beautifyMe);

                self.bindClaimPaymentEvent();
            },

            bindClaimPaymentLines: function (payment_details, isInitialLoaded) {
                var self = this;

                if (isInitialLoaded){
                    $('#tBodyPayment').empty();
                    self.dtpAccountingDate = [];
                }
                self.claim_row_version = payment_details.length && payment_details[0].claim_row_version || self.claim_row_version;
                $.each(payment_details, function (index, obj) {

                    if (isInitialLoaded) {
                        var paymentRow = self.paymentRowTemplate({ row: obj });
                        $('#tBodyPayment').append(paymentRow);
                    }

                    var dtp = commonjs.bindDateTimePicker("divAccountingDate_" + obj.row_index, { format: 'L' });
                    var responsibleEle = $('#ddlPayerName_' + obj.row_index);
                    var dllPaymentMode = $('#ddlPaymentMode_' + obj.row_index);
                    var $dllCheckCardNo = $('#txtCheckCardNo_' + obj.row_index);
                    var responsibleIndex = _.findIndex(self.responsible_list, function (item) {
                        if(obj.payer_info.payer_type_name === 'insurance' && ['primary_insurance', 'secondary_insurance', 'tertiary_insurance'].indexOf(item.payer_type_name) > -1){
                            return item.payer_id == obj.payer_info.payer_id;
                        } else {
                            return item.payer_id == obj.payer_info.payer_id && item.payer_type_name === obj.payer_info.payer_type_name;
                        }
                    })

                    if (dtp) {
                        self.dtpAccountingDate.push(dtp);
                        self.dtpAccountingDate[obj.row_index - 1].isModified = false;
                        obj.accounting_date ? self.dtpAccountingDate[index].date(obj.accounting_date) : self.dtpAccountingDate[index].clear();    
                    }
                    obj.data_row_id = obj.row_index;

                    if (responsibleIndex > -1) {
                        var payerDetails = self.responsible_list[responsibleIndex];
                        $(responsibleEle).append($('<option/>').attr('value', payerDetails.payer_type).text(payerDetails.payer_name));
                        $(responsibleEle).val(payerDetails.payer_type);
                    } else {
                        var payer_name = obj.payer_info.payer_name + (obj.payer_type === 'ordering_facility' ? '( Ordering Facility )' :
                            obj.payer_type === 'ordering_provider' ? '( Provider )' : '( ' + obj.payer_type.toUpperCase() + ' )'
                        );
                        $(responsibleEle).append($('<option/>').attr('value', obj.payer_info.payer_id).text(payer_name)).attr('payer-type', obj.payer_type);
                        $(responsibleEle).val(obj.payer_info.payer_id);
                    }
                    $(dllPaymentMode).val(obj.mode);
                    $(dllPaymentMode).attr('data_payment_mode', obj.mode);
                    $(responsibleEle).prop('disabled', true);

                    if (['cash', 'eft', 'adjustment'].indexOf(obj.mode) > -1) {
                        $dllCheckCardNo.prop('disabled', true);
                    } else {
                        $dllCheckCardNo.prop('disabled', false);
                    }

                    $('#divAccountingDate_' + obj.row_index).on("dp.change", function (e) {
                        if (e && e.date && e.oldDate && e.oldDate.format('L') != e.date.format('L')) {
                            self.dtpAccountingDate[obj.row_index - 1].isModified = true;
                        }
                    });

                });
                // Bind current claim responsible after claim payment processed.
                if (isInitialLoaded) {
                    var current_claim_payer_type = payment_details.length && payment_details[0].current_claim_payer_type || null;
                    var claimResponsible = _.find(self.responsible_list, function (item) { return item.payer_type_name === current_claim_payer_type; });
                    $('#ddlClaimResponsible').val(claimResponsible.payer_type || null);
                    $('#ddlClaimResponsible').data('current-payer', claimResponsible.payer_type || null);
                }

                commonjs.updateCulture(app.currentCulture, commonjs.beautifyMe);
            },
            bindCityStateZipTemplate:function(data,AddressInfoMap, flag){

                address.loadCityStateZipTemplate('#div' + flag + 'AddressInfo', data, AddressInfoMap);
                // Adjust the style alignment
                var $addressDiv = $('#div' + flag + 'AddressInfo');
                $addressDiv.find('.city-state-zip-label').removeClass('p-0');
                $addressDiv.find('.city-state-zip-content').addClass('pl-2').removeClass('pl-1');
            },
            checkHealthNumberEligiblity: function () {
                if (app.country_alpha_3_code === 'can') {
                    $('label[for=txtPriPolicyNo] span').remove();
                    if (this.priInsCode && ['HCP', 'WSIB'].indexOf(this.priInsCode.toUpperCase()) >= 0) {
                        $('label[for=txtPriPolicyNo]').append("<span class='Required' style='color: red;padding-left: 5px;'>*</span>");
                    }
                }
            }

        });

        return claimView;
    });
