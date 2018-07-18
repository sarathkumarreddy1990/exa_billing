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
'shared/permissions'],
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
        Permission) {
        var claimView = Backbone.View.extend({
            el: null,
            rendered: false,
            claimCreationTemplate: _.template(claimCreationTemplate),
            chargerowtemplate: _.template(chargeRowTemplate),
            patSearchContentTemplate: _.template(patSearchContent),
            claimValidation: _.template(claimValidation),
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
                this. screenCode = [];
                if(app.userInfo.user_type != 'SU'){
                    var rights = (new Permission()).init();
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
                    width: '95%',
                    height: '75%',
                    html: this.claimCreationTemplate({
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
                        chargeList: self.claimChargeList || []
                    })
                });


                // Hide non-edit tabs
                if (!self.isEdit) {
                    $('.editClaimRelated').hide();
                }

                if (isFrom == 'patient') {
                    $('.woClaimRelated').hide();
                } else {
                    $('#divPatient').hide();
                }

                $('#siteModal').removeAttr('tabindex'); //removed tabIndex attr for select2 search text can't editable

                if (isFrom != 'patient') {
                    self.bindDetails();
                    self.bindTabMenuEvents();
                }

                if(self.screenCode.indexOf('CLVA') > -1) // this is for validate button rights
                    $('#btnValidateClaim').attr('disabled', true)   
                
                if(self.screenCode.indexOf('PATR') > -1) 
                    $('#btPatientDocuemnt').attr('disabled', true)   
                    
                self.initializeDateTimePickers();
                
            },

            initializeDateTimePickers: function () {
                var self = this;

                self.benefitDate1 = commonjs.bindDateTimePicker('divBOD1', { format: 'L' });
                self.benefitDate1.date(moment().format('L'));
                self.benefitDate2 = commonjs.bindDateTimePicker('divBOD2', { format: 'L' });
                self.benefitDate2.date(moment().format('L'));
                self.benefitDate3 = commonjs.bindDateTimePicker('divBOD3', { format: 'L' });
                self.benefitDate3.date(moment().format('L'));
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
                self.secDOB = commonjs.bindDateTimePicker('divSecDOB', { format: 'L' });
                self.secDOB.date(); 
                self.terDOB = commonjs.bindDateTimePicker('divTerDOB', { format: 'L' });
                self.terDOB.date();
                 
            },

            checkInsuranceEligibility: function (e) {
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

               
                if (!$('#ddlServiceType'+ins+' :selected').length) {
                    commonjs.showWarning('shared.warning.selectservicetype');
                    return;
                }

                if (!$('#txtBenefitOnDate' + ins).val()) {
                    commonjs.showWarning('shared.warning.selectbenefitondate');
                    return;
                }

                if (!self.npiNo) {
                    commonjs.showWarning('shared.warning.npinumbernotpresent');
                    return;
                }

                if (!self.federalTaxId) {
                    commonjs.showWarning('shared.warning.federaltaxidnotpresent');
                    return;
                }

                if (!self.enableInsuranceEligibility) {
                    commonjs.showWarning('shared.warning.eligibilitycheckdisabled');
                    return;
                } 


                $.each($('#ddlServiceType'+ins+' :selected'), function (index, value) {
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
                    eligibilityData.birthDate = document.querySelector('#txtPriDOB').value;
                    eligibilityData.lastName = $('#txtPriSubLastName').val() ? $('#txtPriSubLastName').val() : null;
                    eligibilityData.firstName = $('#txtPriSubFirstName').val() ? $('#txtPriSubFirstName').val() : null;
                } else if (ins == 2) { // Secondary insurance        
                    eligibilityData.insuranceProviderId = self.secInsID;
                    eligibilityData.relationshipCode = $('#ddlSecRelationShip').val() ? $('#ddlSecRelationShip').val() : eligibilityData.relationshipCode;
                    eligibilityData.policyNo = $('#txtSecPolicyNo').val() ? $('#txtSecPolicyNo').val() : null;
                    eligibilityData.benefitOnDate = $('#txtBenefitOnDate2').val() ? $('#txtBenefitOnDate2').val() : null;
                    eligibilityData.birthDate = document.querySelector('#txtSecDOB').value;
                    eligibilityData.lastName = $('#txtSecSubLastName').val() ? $('#txtSecSubLastName').val() : null;
                    eligibilityData.firstName = $('#txtSecSubFirstName').val() ? $('#txtSecSubFirstName').val() : null;
                }
                else if (ins == 3) { // Teritary insurance        
                    eligibilityData.insuranceProviderId = self.terInsID;
                    eligibilityData.relationshipCode = $('#ddlTerRelationShip').val() ? $('#ddlTerRelationShip').val() : eligibilityData.relationshipCode;
                    eligibilityData.policyNo = $('#txtTerPolicyNo').val() ? $('#txtTerPolicyNo').val() : null;
                    eligibilityData.benefitOnDate = $('#txtBenefitOnDate3').val() ? $('#txtBenefitOnDate3').val() : null;
                    eligibilityData.birthDate = document.querySelector('#txtTerDOB').value;
                    eligibilityData.lastName = $('#txtTerSubLastName').val() ? $('#txtTerSubLastName').val() : null;
                    eligibilityData.firstName = $('#txtTerSubFirstName').val() ? $('#txtTerSubFirstName').val() : null;
                }     

                $('#btnCheckEligibility' + ins).prop('disabled',true);
                $('#imgLoading').show();
                

                commonjs.showLoading('Connecting pokitdok. please wait');
                $('#divPokidokResponse').empty();
                $.ajax({
                    url: '/exa_modules/billing/claims/claim/eligibility',
                    type: "POST",
                    dataType: "json",
                    data: eligibilityData,
                    success: function (response) {
                        commonjs.hideLoading();

                        data = response.data;
                        $('#btnCheckEligibility' + ins).prop('disabled',false);
                        if (data && data.errors) {
                            commonjs.showWarning(data.errors.query ? data.errors.query : 'ERR: ' + JSON.stringify(data.errors) + '..');
                            return;
                        }
                        else if (!data.errors && response.insPokitdok == true) {
                            commonjs.showNestedDialog({ header: 'Pokitdok Response', width: '80%', height: '70%', html: $(self.InsurancePokitdokTemplateForm({'InsuranceData': response.data, 'InsuranceDatavalue': response.meta})) });
                        }

                        $('#divCoPayDetails').height('400px');

                        $.each($('#divPokitdok table td'), function (index, obj) {
                            $(obj).attr('title', $(obj).text().replace(/[*$-]/,'').trim());
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

            bindDetails: function () {
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
                if(!self.isEdit)
                    self.bindExistingPatientInsurance();
            },

            initializeClaimEditForm: function () {
                var self = this;
                if (!this.rendered)
                    this.render('claim');
                self.bindclaimFormEvents();
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
                            self.cur_patient_name = claimDetails.patient_full_name;
                            self.cur_patient_dob = claimDetails.patient_dob;
                            self.cur_patient_id = claimDetails.patient_id ? parseInt(claimDetails.patient_id) : null;
                            self.cur_study_date = (commonjs.checkNotEmpty(claimDetails.claim_dt) ? commonjs.convertToFacilityTimeZone(claimDetails.facility_id, claimDetails.claim_dt).format('L LT z') : '');
                            self.priClaimInsID = claimDetails.primary_patient_insurance_id || null;
                            self.secClaimInsID = claimDetails.secondary_patient_insurance_id || null;
                            self.terClaimInsID = claimDetails.tertiary_patient_insurance_id || null;
                            self.claim_row_version = claimDetails.claim_row_version || null;

                            self.facilityId = claimDetails.facility_id; // claim facility_date
                            self.studyDate = self.cur_study_date; // Assign claim data as studyDate variable to newly adding charges
                            /* Bind claim charge Details*/
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

                            self.initializeClaimEditForm();

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

                            /* Header Details */
                            $(parent.document).find('#spanModalHeader').html('Edit : <STRONG>' + claimDetails.patient_full_name + '</STRONG> (Acc#:' + claimDetails.patient_account_no + '), ' + moment(claimDetails.patient_dob).format('L') + ', ' + claimDetails.patient_gender);
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

                                $('#txtModifier1_' + index).val(data.modifier1_id ? self.getModifierCode(data.modifier1_id) : "").attr('data-id',data.modifier1_id);
                                $('#txtModifier2_' + index).val(data.modifier2_id ? self.getModifierCode(data.modifier2_id) : "").attr('data-id',data.modifier2_id);
                                $('#txtModifier3_' + index).val(data.modifier3_id ? self.getModifierCode(data.modifier3_id) : "").attr('data-id',data.modifier3_id);
                                $('#txtModifier4_' + index).val(data.modifier1_id ? self.getModifierCode(data.modifier4_id) : "").attr('data-id',data.modifier4_id);
                            });
                           
                            if (isFrom && isFrom == 'studies')
                                $('.claimProcess').hide(); // hide Next/Prev btn if opened from studies worklist

                            // trigger blur event for update Total bill fee, balance etc.
                            $(".allowedFee").blur();
                            $(".diagCodes").blur();

                            /*Bind ICD List*/
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

                            commonjs.hideLoading();
                        }
                    },
                    error: function (model, response) {
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
                    .append($('<div/>', { id: "divCptCode_" + rowIndex }).addClass('pointerCursor').attr('data-type','cpt')
                        .append($('<lable/>', { id: "lblCptCode_" + rowIndex }).addClass('cptcode cptIsExists').attr('data-type','cpt').html("Select")
                                .mousemove(function(e){
                                    var msg = $(e.target).attr('data_code');
                                    $(e.target).attr('title',msg);
                                })));

                $('#divChargeCptDesc_' + rowIndex)
                    .append($('<div/>', { id: "divCptDescription_" + rowIndex }).addClass('pointerCursor').attr('data-type','cptdesc')
                        .append($('<lable/>', { id: "lblCptDescription_" + rowIndex }).addClass('cptcode cptIsExists').attr('data-type','cptdesc').html("Select")
                                .mousemove(function(e){
                                    var msg = $(e.target).attr('data_description');
                                    $(e.target).attr('title',msg);
                                })));
            },  

            bindDefaultClaimDetails: function (claim_data) {
                var self = this;

                /* Claim section start*/

                var renderingProvider = claim_data.reading_phy_full_name || claim_data.fac_reading_phy_full_name || self.usermessage.selectStudyReadPhysician;
                var referringProvider = claim_data.ref_prov_full_name || self.usermessage.selectStudyRefProvider;
                var orderingFacility = claim_data.ordering_facility_name || claim_data.service_facility_name || self.usermessage.selectOrdFacility;

                self.ACSelect.readPhy.contact_id = claim_data.rendering_provider_contact_id || claim_data.fac_rendering_provider_contact_id || null;
                self.ACSelect.refPhy.contact_id = claim_data.referring_provider_contact_id || null;
                self.ACSelect.refPhy.Code = claim_data.ref_prov_code || null;
                self.ACSelect.refPhy.Desc = referringProvider;
                self.group_id = claim_data.ordering_facility_id ? parseInt(claim_data.ordering_facility_id || claim_data.service_facility_id) : null;
                self.group_name = orderingFacility;

                $('#ddlBillingProvider').val(claim_data.billing_provider_id ||claim_data.fac_billing_provider_id || '');
                $('#ddlFacility').val(claim_data.facility_id || '');
                $('#select2-ddlRenderingProvider-container').html(renderingProvider);
                $('#select2-ddlReferringProvider-container').html(referringProvider);
                $('#select2-ddlOrdFacility-container').html(orderingFacility);

                /* Claim section end */
                /* Additional info start*/

                document.querySelector('#txtHCT').value = claim_data.hospitalization_to_date ? moment(claim_data.hospitalization_to_date).format('L') : '';
                document.querySelector('#txtHCF').value = claim_data.hospitalization_from_date ? moment(claim_data.hospitalization_from_date).format('L') : '';
                document.querySelector('#txtWCF').value = claim_data.unable_to_work_from_date ? moment(claim_data.unable_to_work_from_date).format('L') : '';
                document.querySelector('#txtWCT').value = claim_data.unable_to_work_to_date ? moment(claim_data.unable_to_work_to_date).format('L') : '';
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
                $('#txtResponsibleNotes').val(claim_data.billing_notes || '')
                
                var claim_fee_details = claim_data.claim_fee_details && claim_data.claim_fee_details.length ? claim_data.claim_fee_details[0] : {};
                
                $('#spBillFee').text(commonjs.roundFee(claim_fee_details.bill_fee || 0.00));
                $('#spBalance').text(commonjs.roundFee(claim_fee_details.balance || 0.00));
                $('#spAllowed').text(commonjs.roundFee(claim_fee_details.allowed || 0.00));
                $('#spPatientPaid').text(commonjs.roundFee(claim_fee_details.patient_paid || 0.00));
                $('#spOthersPaid').text(commonjs.roundFee(claim_fee_details.others_paid || 0.00));
                $('#spAdjustment').text(commonjs.roundFee(claim_fee_details.adjustment || 0.00));
                $('#spRefund').text(commonjs.roundFee(claim_fee_details.refund_amount || 0.00));                

                /* Billing summary end */

                /* ResponsibleList start*/

                self.updateResponsibleList({
                    payer_type: 'PPP',
                    payer_name: self.cur_patient_name + '( Patient )',
                    payer_id: self.cur_patient_id
                });

                var facility = $('#ddlFacility option:selected').val();
                if (self.group_id || null) {
                    self.updateResponsibleList({
                        payer_type: 'POF',
                        payer_id: self.group_id,
                        payer_name: self.group_name + '(Service Facility)'
                    });
                }

                if (self.ACSelect.refPhy.contact_id || null) {
                    self.updateResponsibleList({
                        payer_type: 'RF',
                        payer_id: self.ACSelect.refPhy.contact_id,
                        payer_name: self.ACSelect.refPhy.Desc + '(Referring Provider)'
                    });
                }
                /* ResponsibleList End*/
                /* Common Details Edit & Claim creation */
                if (self.isEdit) {
                    self.bindEditClaimInsuranceDetails(claim_data);
                    var responsibleIndex = _.find(self.responsible_list, function (item) { return item.payer_type_name == claim_data.payer_type; });
                    $('#ddlResponsible').val(responsibleIndex.payer_type);
                    $('#ddlClaimStatus').val(claim_data.claim_status_id || '');
                    $('#ddlFrequencyCode').val(claim_data.frequency || '')
                    $('#ddlPOSType').val(claim_data.place_of_service_id || '');
                    document.querySelector('#txtClaimDate').value = claim_data.claim_dt ? self.convertToTimeZone(claim_data.facility_id, claim_data.claim_dt).format('L') : '';
                } else {
                    $('#ddlResponsible').val('PPP');
                    $('#ddlClaimStatus').val($("option[data-desc = 'PV']").val());
                    var frequency = [{ code: 7, desc: 'corrected' }, { code: 8, desc: 'void' }, { code: 1, desc: 'original' }];
                    if (claim_data.frequency) {
                        var code = _.find(frequency, function (item) { return item.code == parseInt(claim_data.frequency); });
                        $('#ddlFrequencyCode').val(code.desc || '');
                    }
                    if (claim_data.pos_type_code && claim_data.pos_type_code != '') {
                        $('#ddlPOSType').val($('option[data-code = ' + claim_data.pos_type_code.trim() + ']').val());
                    }
                    var currentDate = new Date();
                    var defaultStudyDate = moment(currentDate).format('L');
                    var lineItemStudyDate = self.studyDate && self.studyDate != '' ? self.convertToTimeZone(claim_data.facility_id, self.studyDate).format('L') : '';
                    $('#txtClaimDate').val(self.studyDate ? lineItemStudyDate : defaultStudyDate);
                }
                /* Common Details end */
               
                //upate total billfee and balance
                $(".allowedFee").blur();
                $(".diagCodes").blur();

            },

            bindEditClaimInsuranceDetails: function (claimData) {
                var self = this;


                if (claimData.p_insurance_provider_id || null) {

                    self.priInsID = claimData.p_insurance_provider_id
                    self.priInsName = claimData.p_insurance_name;
                    $('#select2-ddlPriInsurance-container').html(claimData.p_insurance_name);
                    $('#chkPriAcptAsmt').prop('checked', claimData.p_assign_benefits_to_patient);
                    $('#lblPriInsPriAddr').html(claimData.p_address1);
                    var pri_csz = $.grep([claimData.p_city, claimData.p_state, claimData.p_zip], Boolean).join(", ");
                    $('#lblPriInsCityStateZip').html(pri_csz);
                    $('#lblPriPhoenNo').html(claimData.p_phone_no);
                    $('#txtPriPolicyNo').val(claimData.p_policy_number);
                    $('#txtPriGroupNo').val(claimData.p_group_number);
                    $("#ddlPriRelationShip").val(claimData.p_subscriber_relationship_id);
                    var priSelf = ($('#ddlPriRelationShip option:selected').text()).toLowerCase();
                    ($.trim(priSelf) == 'self' || $.trim(priSelf) == 'select') ? $('#showPriSelf').hide() : $('#showPriSelf').show();
                    $('#txtPriSubFirstName').val(claimData.p_subscriber_firstname);
                    $('#txtPriSubMiName').val(claimData.p_subscriber_middlename);
                    $('#txtPriSubLastName').val(claimData.p_subscriber_lastname);
                    $('#txtPriSubSuffix').val(claimData.p_subscriber_name_suffix);
                    $('#ddlPriGender').val(claimData.p_subscriber_gender);
                    $('#txtPriSubPriAddr').val(claimData.p_subscriber_address_line1);
                    $('#txtPriSubSecAddr').val(claimData.p_subscriber_address_line2);
                    $('#txtPriCity').val(claimData.p_subscriber_city);
                    var states = app.states && app.states.length && app.states[0].app_states;
                    if (states && states.indexOf(claimData.p_subscriber_state) > -1) {
                        $('#ddlPriState').val(claimData.p_subscriber_state);
                    }
                    
                    $('#txtPriZipCode').val(claimData.p_subscriber_zipcode);
                    document.querySelector('#txtPriDOB').value = claimData.p_subscriber_dob ? moment(claimData.p_subscriber_dob).format('L') : '';
                    document.querySelector('#txtPriStartDate').value = claimData.p_valid_from_date ? moment(claimData.p_valid_from_date).format('L') : '';
                    document.querySelector('#txtPriExpDate').value = claimData.p_valid_to_date ? moment(claimData.p_valid_to_date).format('L') : '';

                    // append to ResponsibleList
                    self.updateResponsibleList({
                        payer_type: 'PIP_P',
                        payer_id: claimData.p_insurance_provider_id,
                        payer_name: claimData.p_insurance_name + '( Primary Insurance )',
                        billing_method: claimData.p_billing_method
                    });
                }

                if (claimData.s_insurance_provider_id || null) {
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
                    $('#lblSecPhoenNo').html(claimData.s_phone_no);
                    $('#txtSecPolicyNo').val(claimData.s_policy_number);
                    $('#txtSecGroupNo').val(claimData.s_group_number);
                    $("#ddlSecRelationShip").val(claimData.s_subscriber_relationship_id);
                    var secSelf = ($('#ddlSecRelationShip option:selected').text()).toLowerCase();   
                    ($.trim(secSelf) == 'self' || $.trim(secSelf) == 'select') ? $('#showSecSelf').hide() : $('#showSecSelf').show();                 
                    $('#txtSecSubFirstName').val(claimData.s_subscriber_firstname);
                    $('#txtSecSubMiName').val(claimData.s_subscriber_middlename);
                    $('#ddlSecGender').val(claimData.s_subscriber_gender);
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
                    });
                }

                if (claimData.t_insurance_provider_id || null) {
                    self.terInsID = claimData.t_insurance_provider_id
                    self.terInsName = claimData.t_insurance_name;
                    $('#select2-ddlTerInsurance-container').html(claimData.t_insurance_name);
                    $('#chkTerAcptAsmt').prop('checked', claimData.t_assign_benefits_to_patient);
                    $('#lblTerInsPriAddr').html(claimData.t_address1);                    
                    var ter_csz = $.grep([claimData.t_city, claimData.t_state, claimData.t_zip], Boolean).join(", ");
                    $('#lblTerInsCityStateZip').html(ter_csz);
                    $('#lblTerPhoenNo').html(claimData.t_phone_no);
                    $('#txtTerPolicyNo').val(claimData.t_policy_number);
                    $('#txtTerGroupNo').val(claimData.t_group_number);
                    $("#ddlTerRelationShip").val(claimData.t_subscriber_relationship_id);
                    var terSelf = ($('#ddlTerRelationShip option:selected').text()).toLowerCase();  
                    ($.trim(terSelf) == 'self' || $.trim(terSelf) == 'select') ? $('#showTerSelf').hide() : $('#showTerSelf').show();                  
                    $('#txtTerSubFirstName').val(claimData.t_subscriber_firstname);
                    $('#txtTerSubMiName').val(claimData.t_subscriber_middlename);
                    $('#ddlTerGender').val(claimData.t_subscriber_gender);
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
                    });
                }

            },

            showClaimForm: function (options) {
                var self = this;
                var selectedStudyIds = JSON.parse(window.localStorage.getItem('selected_studies'));
                var primaryStudyDetails = JSON.parse(window.localStorage.getItem('primary_study_details'));
                self.cur_patient_id = primaryStudyDetails.patient_id ? parseInt(primaryStudyDetails.patient_id) : null;
                self.cur_patient_name = primaryStudyDetails.patient_name;
                self.cur_patient_acc_no = primaryStudyDetails.account_no;
                self.cur_patient_dob = primaryStudyDetails.patient_dob ? moment.utc(primaryStudyDetails.patient_dob).format('L') : null;
                self.cur_study_date = (primaryStudyDetails.study_date !='null' && commonjs.checkNotEmpty(primaryStudyDetails.study_date) ? commonjs.convertToFacilityTimeZone(primaryStudyDetails.facility_id, primaryStudyDetails.study_date).format('L LT z') : '');
                self.pri_accession_no = primaryStudyDetails.accession_no || null;
                self.cur_study_id = primaryStudyDetails.study_id || null;
                self.isEdit = self.claim_Id ? true : false;
                self.facilityId = primaryStudyDetails.facility_id;
                if (!this.rendered)
                    this.render('claim');

                self.getLineItemsAndBind(selectedStudyIds);
                if(options && options == 'patientSearch'){
                    self.bindDetails();
                    self.bindTabMenuEvents();
                }
                self.updateResponsibleList({
                    payer_type: 'PPP',
                    payer_name: self.cur_patient_name + '( Patient )',
                    payer_id: self.cur_patient_id
                });

                self.bindclaimFormEvents();
            },

            showPatientForm: function () {
                var self = this;

                if (!this.rendered)
                    this.render('patient');

                // Patient search events
                $('#anc_first, #anc_previous, #anc_next, #anc_last').off().click(function (e) {
                    self.onpaging(e);
                });

                $('.search-field').off().keyup(function (e) {
                    self.applySearch(e);
                });
            },

            bindclaimFormEvents: function () {

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
                    self.resetInsurances(e);
                });

                $("#btnValidateClaim").off().click(function (e) {
                    self.validateClaim();
                });

                $("#btPatientDocuemnt").off().click(function (e) {
                   commonjs.openDocumentsAndReports(self.options);
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

                $('#modal_div_container').animate({scrollTop: 0}, 100);
            },
            getLineItemsAndBind: function (selectedStudyIds) {
                var self = this;
                self.chargeModel = [];
                if (selectedStudyIds) {

                    $.ajax({
                        type: 'GET',
                        url: '/exa_modules/billing/claims/claim/line_items',
                        data: {
                            from: 'claimCreation',
                            study_ids: selectedStudyIds
                        },
                        success: function (model, response) {
                            if (model && model.length > 0) {
                                $('#tBodyCharge').empty();
                                var modelDetails = model[0];
                                self.studyDate = modelDetails && modelDetails.charges && modelDetails.charges.length && modelDetails.charges[0].study_dt ? modelDetails.charges[0].study_dt : self.cur_study_date ;
                                self.facilityId = modelDetails && modelDetails.charges && modelDetails.charges.length && modelDetails.charges[0].facility_id ? modelDetails.charges[0].facility_id : self.facilityId ;
                                var _defaultDetails = modelDetails.claim_details && modelDetails.claim_details.length > 0 ? modelDetails.claim_details[0] : {};
                                var _diagnosisProblems = modelDetails.problems && modelDetails.problems.length > 0 ? modelDetails.problems : [];
                                var diagnosisCodes = [];
                                $(parent.document).find('#spanModalHeader').html('Claim Creation : <STRONG>' + _defaultDetails.patient_name + '</STRONG> (Acc#:' + _defaultDetails.patient_account_no + '), <i>' + _defaultDetails.patient_dob + '</i>,  ' + _defaultDetails.patient_gender);

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

                                _.each(_diagnosisProblems, function (item) {

                                    if (_.findIndex(diagnosisCodes, { id: item.id }) == -1) {
                                        diagnosisCodes.push({ id: item.id, code: item.code , description: item.description });
                                    }

                                });
                               
                                setTimeout(function () {
                                    self.bindDefaultClaimDetails(_defaultDetails);
                                }, 200);
                                
                                self.bindProblemsContent(diagnosisCodes);

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

                                $("#txtClaimDate").attr("disabled", "disabled"); 
                            }                            
                        },
                        error: function (model, response) {
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

                data.charge_dt = commonjs.checkNotEmpty(self.studyDate) ? commonjs.convertToFacilityTimeZone(self.facilityId, self.studyDate).format('L') : '--';
                self.bindModifiersData(data);
                var chargeTableRow = self.chargerowtemplate({ row: data });
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
                        commonjs.showWarning("Claim need minimum one charge required");
                        return false;
                    }
                    if (rowData.id) {
                        if (confirm('Are you sure to delete charge ?')) {
                            if (rowData.payment_exists) {
                                if (confirm('Payment exists for this charge, Confirm to delete')) {
                                    self.removeChargeFromDB(rowData.id, function (response) {
                                        if (response && response.status)
                                            removeCharge(rowData, rowId, rowObj);
                                        else
                                            commonjs.showWarning('Error on deleting charge');
                                    });
                                }
                            } else {
                                self.removeChargeFromDB(rowData.id, function (response) {
                                    if (response && response.status)
                                        removeCharge(rowData, rowId, rowObj);
                                    else
                                        commonjs.showWarning('Error on deleting charge');
                                });
                            }
                        }
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
                    ///this.value = this.value.replace(/[^0-9\.]/g, '');
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
                    $(".allowedFee").blur();

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
                var totalAllowedFee = parseFloat($('#txtUnits_' + rowID).val()) * parseFloat($('#txtAllowedFee_' + rowID).val());
                $('#txtTotalAllowedFee_' + rowID).val(totalAllowedFee.toFixed(2));
                $('#txtTotalBillFee_' + rowID).val(totalBillFee.toFixed(2));

                $("#tBodyCharge").find("tr").each(function (index) {

                    var thisTotalBillFee = $(this).find('td:nth-child(17)>input').val() ? $(this).find('td:nth-child(17)>input').val() : 0.00;
                    var thisTotalAllowed = $(this).find('td:nth-child(19)>input').val() ? $(this).find('td:nth-child(19)>input').val() : 0.00;
                    total_bill_fee = total_bill_fee + parseFloat(thisTotalBillFee);
                    total_allowed = total_allowed + parseFloat(thisTotalAllowed);
                });
                var patient_paid = parseFloat($('#spPatientPaid').text());
                var others_paid = parseFloat($('#spOthersPaid').text());
                var refund_amount = parseFloat($('#spRefund').text()); 
                var adjustment_amount = parseFloat($('#spAdjustment').text()); 
                $('#spTotalBillFeeValue').text(commonjs.roundFee(total_bill_fee));
                $('#spBillFee').text(commonjs.roundFee(total_bill_fee));
                $('#spTotalAllowedFeeValue').text(commonjs.roundFee(total_allowed));
                $('#spAllowed').text(commonjs.roundFee(total_allowed));
                var balance = total_bill_fee - (patient_paid + others_paid + adjustment_amount + refund_amount);
                $('#spBalance').text(commonjs.roundFee(balance));
            },

            updateResponsibleList: function (payer_details) {
                var self = this, index, responsibleEle, selected_opt;
                index = _.findIndex(self.responsible_list, function(item) { return item.payer_type == payer_details.payer_type;});
                if (index > -1) {
                    self.responsible_list[index].payer_id = payer_details.payer_id;
                    self.responsible_list[index].payer_name = payer_details.payer_name;
                    self.responsible_list[index].billing_method = payer_details.billing_method;
                }
                responsibleEle = $('#ddlResponsible');
                selected_opt = responsibleEle.find('option[value="' + payer_details.payer_type + '"]');
                if (!payer_details.payer_name)
                    selected_opt.remove();
                else if (selected_opt && selected_opt.length && payer_details.payer_name)
                    $(selected_opt).text(payer_details.payer_name)
                else
                    $(responsibleEle).append($('<option/>').attr('value', payer_details.payer_type).text(payer_details.payer_name));
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
                            if(confirm("Code already exists. Do you want to add")) {
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
                $('#txtAllowedFee_' + rowIndex).val(parseFloat(fee).toFixed(2));
                $('#txtTotalAllowedFee_' + rowIndex).val(parseFloat(units * fee).toFixed(2));
                $('#txtTotalBillFee_' + rowIndex).val(parseFloat(units * fee).toFixed(2));
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
                            });
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
            },

            addDiagCodes: function (isManual) {
                var self = this;
                var curDiagnosis = ($('#hdnDiagCodes').val() !== "") ? $('#hdnDiagCodes').val().split(',') : [];

                if (self.icd_code != '' && self.ICDID != '') {
                    if (curDiagnosis.length < 12) {
                        if (curDiagnosis.indexOf(String(self.ICDID)) > -1) {
                            commonjs.showWarning("shared.warning.problemAlreadyExists");
                            return false;
                        }

                        curDiagnosis.push(self.ICDID);
                        $('#hdnDiagCodes').val(curDiagnosis.join(','));

                        // Adding same ICD after deleted, change[is_deleted,deleted_by] flag from icd list
                        if (_.findIndex(self.claimICDLists, { icd_id: self.ICDID }) > -1) {
                            self.claimICDLists = _.map(self.claimICDLists, function (obj) {
                                if (obj.icd_id === parseInt(self.ICDID)) {
                                    obj.is_deleted = false;
                                }
                                return obj;
                            });
                        } else {
                            self.claimICDLists.push({
                                id: null,
                                icd_id: self.ICDID,
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
                        self.icd_code = '';
                        self.ICDID  ='';
                        self.icd_description = '';
                    }
                    else {
                        commonjs.showWarning("shared.warning.icdLimitExists");
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

            bindExistingPatientInsurance: function () {
                var self = this;
                $.ajax({
                    url: '/exa_modules/billing/claims/claim/patient_insurances',
                    type: 'GET',
                    data: {
                        'patient_id': self.cur_patient_id || 0,
                        'claim_date': self.cur_study_date || 'now()'
                    },
                    success: function (response) {

                        if (response.length > 0) {

                            self.existingPrimaryInsurance = [];
                            self.existingSecondaryInsurance = [];
                            self.existingTriInsurance = [];
                            var existing_insurance = response[0].existing_insurance || [];
                            var beneficiary_details = response[0].beneficiary_details || [];

                            self.npiNo = existing_insurance.length &&  existing_insurance[0].npi_no ? existing_insurance[0].npi_no : '';
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
                            setTimeout(function () {
                                $.each(beneficiary_details, function (index, object) {
                                    var insurance_details = object.length ? _.sortBy(object, "id")[0] : {}
                                    self.bindExistInsurance(insurance_details, insurance_details.coverage_level);
                                });
                            }, 200);
                            
                           
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
                        });
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
                        $('#ddlExistPriIns').val(0);
                        self.updateInsAddress('Pri', res);
                        self.is_primary_available = true;
                        if($('#ddlPriInsurance').val() !='') {
                            $('#chkPriAcptAsmt').prop('checked', true);
                        }
                        break;
                    case 'ddlSecInsurance':
                        self.secInsID = res.id;
                        self.secInsCode = res.insurance_code;
                        self.secInsName = res.insurance_name;
                        payer_type = 'PIP_S';
                        coverage_level = 'Secondary Insurance';
                        // it's remove the existing selected insurances
                        $('#ddlExistSecIns').val(0);
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
                        $('#ddlExistTerIns').val(0);
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
                });
                
                //Assign primary insurance as responsible
                if(payer_type == 'PIP_P'){
                    $('#ddlResponsible').val('PIP_P');
                }
            },

            updateInsAddress: function (level, res) {
                var self = this;
                var insuranceInfo = res.insurance_info || null;
                var csz = insuranceInfo.City + (commonjs.checkNotEmpty(insuranceInfo.State) ? ',' + insuranceInfo.State : "") + (commonjs.checkNotEmpty(insuranceInfo.ZipCode) ? ',' + insuranceInfo.ZipCode : "");

                $('#lbl' + level + 'InsPriAddr').html(insuranceInfo.Address1);

                $('#lbl' + level + 'InsCityStateZip').html(csz);

                $('#lbl' + level + 'PhoenNo').html(insuranceInfo.PhoneNo);
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
                    $('label').css('color', 'black');
                    $('.multiselect-container li a').css('padding', '0');
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
                            });
                            self.is_primary_available = true;
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
                            });
                            self.is_secondary_available = true;
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
                            });
                            self.is_tertiary_available = true;
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
                    $('#lbl' + flag + 'PhoenNo').html(result.ins_phone_no ? result.ins_phone_no: '');
                    $('#txt' + flag + 'PolicyNo').val(result.policy_number);
                    $('#txt' + flag + 'GroupNo').val(result.group_number);
                    $('#ddl' + flag + 'RelationShip').val(result.subscriber_relationship_id);
                    var priSelf = ($('#ddl' + flag + 'RelationShip'+' option:selected').text()).toLowerCase();
                    ($.trim(priSelf) == 'self' || $.trim(priSelf) == 'select') ? $('#show'+ flag + 'Self').hide() : $('#show'+ flag + 'Self').show();                    
                    $('#txt' + flag + 'SubFirstName').val(result.subscriber_firstname);
                    $('#txt' + flag + 'MiddleName').val(result.subscriber_middlename);
                    $('#txt' + flag + 'SubLastName').val(result.subscriber_lastname);
                    $('#txt' + flag + 'SubSuffix').val(result.subscriber_name_suffix);
                    if (app.gender.indexOf(result.subscriber_gender) > -1) {
                        $('#ddl' + flag + 'Gender').val(result.subscriber_gender);
                    }
                    $('#txt' + flag + 'SubPriAddr').val(result.subscriber_address_line1);
                    $('#txt' + flag + 'SubSecAddr').val(result.subscriber_address_line2);
                    $('#txt' + flag + 'City').val(result.subscriber_city);
                    var states = app.states && app.states.length && app.states[0].app_states;
                    if (states && states.indexOf(result.subscriber_state) > -1) {
                        $('#ddl' + flag + 'State').val(result.subscriber_state);
                    }
                    $('#txt' + flag + 'ZipCode').val(result.subscriber_zipcode);
                    if(result.coverage_level == "secondary" && result.medicare_insurance_type_code != null) {
                        $('#chkSecMedicarePayer').prop('checked',true);
                        $('#selectMedicalPayer').val(result.medicare_insurance_type_code).toggle(true);
                    }
                    setTimeout(function () {
                        if (!self.isEdit)
                            $('#ddlResponsible').val('PIP_P');
                    }, 200);
                    
                }
            },

            setClaimDetails: function () {
                var self = this;
                var claim_model = {}, billingMethod;
                claim_model.insurances = [];
                var currentResponsible = _.find(self.responsible_list, function(d) { return d.payer_type == $('#ddlResponsible').val(); });
                var currentPayer_type = $('#ddlResponsible').val().split('_')[0];
                var facility_id = $('#ddlFacility option:selected').val() != '' ? parseInt($('#ddlFacility option:selected').val()) : null;
                if (currentPayer_type == "PIP") {
                    billingMethod = currentResponsible.billing_method || 'direct_billing';
                }
                else if (currentPayer_type == "PPP")
                    billingMethod = 'patient_payment';
                else
                    billingMethod = 'direct_billing';
                var primary_insurance_details = {
                    claim_patient_insurance_id: self.primaryPatientInsuranceId || null,
                    claim_insurance_id: self.priClaimInsID ? parseInt(self.priClaimInsID) : null,
                    patient_id: self.cur_patient_id || null,
                    insurance_provider_id: self.priInsID ? parseInt(self.priInsID) : null,
                    subscriber_relationship_id: $('#ddlPriRelationShip option:selected').val() != '' ? parseInt($('#ddlPriRelationShip option:selected').val()) : null,
                    subscriber_dob: $('#txtPriDOB').val() != '' ? self.convertToTimeZone(facility_id, moment($('#txtPriDOB').val()).format('YYYY-MM-DD')) : null,
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
                    valid_from_date: $('#txtPriStartDate').val() != '' ? $('#txtPriStartDate').val() : null,
                    valid_to_date: $('#txtPriExpDate').val() != '' ? $('#txtPriExpDate').val() :null,
                    is_deleted: self.priClaimInsID && self.priInsID == '' ? true : false
                },
                secondary_insurance_details = {
                    claim_patient_insurance_id: self.secondaryPatientInsuranceId || null,
                    claim_insurance_id: self.secClaimInsID ? parseInt(self.secClaimInsID) : null,
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
                    subscriber_dob: $('#txtSecDOB').val() != '' ? self.convertToTimeZone(facility_id, moment($('#txtSecDOB').val()).format('YYYY-MM-DD')) : null,
                    medicare_insurance_type_code: $('#selectMedicalPayer option:selected').val() != '' ? parseInt($('#selectMedicalPayer option:selected').val()) : null,
                    valid_from_date: $('#txtSecStartDate').val() != '' ? $('#txtSecStartDate').val() : null,
                    valid_to_date: $('#txtSecExpDate').val() != '' ? $('#txtSecExpDate').val() : null,
                    is_deleted: self.secClaimInsID && self.secInsID == '' ? true : false
                },
                teritiary_insurance_details = {
                    claim_patient_insurance_id: self.tertiaryPatientInsuranceId || null,
                    claim_insurance_id: self.terClaimInsID ? parseInt(self.terClaimInsID) : null,
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
                    subscriber_dob: $('#txtTerDOB').val() != '' ? self.convertToTimeZone(facility_id, moment($('#txtTerDOB').val()).format('YYYY-MM-DD')) : null,
                    medicare_insurance_type_code: null,
                    valid_from_date: $('#txtTerStartDate').val() != '' ? $('#txtTerStartDate').val() : null,
                    valid_to_date: $('#txtTerExpDate').val() != '' ? $('#txtTerExpDate').val() : null,
                    is_deleted: self.terClaimInsID && self.terInsID == '' ? true : false
                }
                if (self.is_primary_available || self.priClaimInsID)
                    claim_model.insurances.push(primary_insurance_details);
                if (self.is_secondary_available || self.secClaimInsID)
                    claim_model.insurances.push(secondary_insurance_details);
                if (self.is_tertiary_available || self.terClaimInsID)
                    claim_model.insurances.push(teritiary_insurance_details);
                claim_model.claims = {
                    claim_id: self.claim_Id,
                    company_id: app.companyID,
                    facility_id: facility_id,
                    patient_id: parseInt(self.cur_patient_id) || null,
                    billing_provider_id: $('#ddlBillingProvider option:selected').val() != '' ? parseInt($('#ddlBillingProvider option:selected').val()) : null,
                    rendering_provider_contact_id: self.ACSelect && self.ACSelect.readPhy ? self.ACSelect.readPhy.contact_id : null,
                    referring_provider_contact_id: self.ACSelect && self.ACSelect.refPhy ? self.ACSelect.refPhy.contact_id : null,
                    ordering_facility_id: self.group_id ? parseInt(self.group_id) : null,
                    place_of_service_id: $('#ddlPOSType option:selected').val() != '' ? parseInt($('#ddlPOSType option:selected').val()) : null,
                    billing_code_id: $('#ddlBillingCode option:selected').val() != '' ? parseInt($('#ddlBillingCode option:selected').val()) : null,
                    billing_class_id: $('#ddlBillingClass option:selected').val() != '' ? parseInt($('#ddlBillingClass option:selected').val()) : null,
                    created_by: app.userID,
                    claim_dt: self.cur_study_date ? self.cur_study_date : null,
                    current_illness_date: $('#txtDate').val() != '' ? self.convertToTimeZone(facility_id, moment($('#txtDate').val()).format('YYYY-MM-DD')) : null,
                    same_illness_first_date: $('#txtOtherDate').val() != '' ? self.convertToTimeZone(facility_id, moment($('#txtOtherDate').val()).format('YYYY-MM-DD')) : null,
                    unable_to_work_from_date: $('#txtWCF').val() != '' ? self.convertToTimeZone(facility_id, moment($('#txtWCF').val()).format('YYYY-MM-DD')) : null,
                    unable_to_work_to_date: $('#txtWCT').val() != '' ? self.convertToTimeZone(facility_id, moment($('#txtWCT').val()).format('YYYY-MM-DD')) : null,
                    hospitalization_from_date: $('#txtHCF').val() != '' ? self.convertToTimeZone(facility_id, moment($('#txtHCF').val()).format('YYYY-MM-DD')) : null,
                    hospitalization_to_date: $('#txtHCT').val() != '' ? self.convertToTimeZone(facility_id, moment($('#txtHCT').val()).format('YYYY-MM-DD')) : null,
                    payer_type: currentResponsible.payer_type_name || null,
                    billing_method: billingMethod,
                    billing_notes: $.trim($('#txtResponsibleNotes').val()),
                    claim_notes: $.trim($('#txtClaimNotes').val()),
                    original_reference: $.trim($('#txtOriginalRef').val()),
                    authorization_no: $.trim($('#txtAuthorization').val()),
                    frequency: $('#ddlFrequencyCode option:selected').val() != '' ? $('#ddlFrequencyCode option:selected').val() : null,
                    is_auto_accident: $('#chkAutoAccident').is(':checked'),
                    is_other_accident: $('#chkOtherAccident').is(':checked'),
                    is_employed: $('#chkEmployment').is(':checked'),
                    service_by_outside_lab: $('#chkOutSideLab').is(':checked'),
                    claim_status_id: $('#ddlClaimStatus option:selected').val() != '' ? parseInt($('#ddlClaimStatus option:selected').val()) : null,
                    primary_patient_insurance_id: self.is_primary_available && self.priClaimInsID ? parseInt(self.priClaimInsID) : null,
                    secondary_patient_insurance_id: self.is_secondary_available && self.secClaimInsID ? parseInt(self.secClaimInsID) : null,
                    tertiary_patient_insurance_id: self.is_tertiary_available && self.terClaimInsID ? parseInt(self.terClaimInsID) : null

                }

                /*Setting claim charge details*/
                claim_model.charges = [];
                $('#tBodyCharge').find('tr').each(function (index, rowObject) {
                    var id = $(this).attr('data_row_id');
                    var cpt_code_id = $('#lblCptCode_' + id).attr('data_id');
                    var rowData = _.find(self.chargeModel, { 'data_row_id': parseInt(id) });
                    claim_model.charges.push({
                        id: rowData.id ? rowData.id : null,
                        claim_id: rowData.claim_id ? parseInt(rowData.claim_id) : null,
                        //line_num: index,
                        cpt_id: parseInt(cpt_code_id),
                        pointer1: $('#ddlPointer1_' + id).val() || null,
                        pointer2: $('#ddlPointer2_' + id).val() || null,
                        pointer3: $('#ddlPointer3_' + id).val() || null,
                        pointer4: $('#ddlPointer4_' + id).val() || null,
                        modifier1_id: $('#txtModifier1_' + id).attr('data-id') ? parseInt($('#txtModifier1_' + id).attr('data-id')) : null,
                        modifier2_id: $('#txtModifier2_' + id).attr('data-id') ? parseInt($('#txtModifier2_' + id).attr('data-id')) : null,
                        modifier3_id: $('#txtModifier3_' + id).attr('data-id') ? parseInt($('#txtModifier3_' + id).attr('data-id')) : null,
                        modifier4_id: $('#txtModifier4_' + id).attr('data-id') ? parseInt($('#txtModifier4_' + id).attr('data-id')) : null,
                        bill_fee: parseFloat($('#txtBillFee_' + id).val()) || 0.00,
                        allowed_amount: parseFloat($('#txtAllowedFee_' + id).val()) || 0.00,
                        units: parseFloat($('#txtUnits_' + id).val()),
                        created_by: 1,
                        authorization_no: $('#txtAuthInfo_' + id).val() || null,
                        charge_dt: self.cur_study_date || null,
                        study_id: rowData.study_id || null,
                        is_deleted: false,
                        isEdit: !!$('#txtBillFee_' + id).attr('edit')
                    });
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
                var self = this, saveButton = $('#btnSaveClaim');

                if (self.validateClaimData()) {
                    self.setClaimDetails();

                    commonjs.showLoading();
                    saveButton.attr('disabled', true);
                    
                    self.model.save({}, {
                        success: function (model, response) {
                            commonjs.hideLoading();

                            if (response && response.message) {
                                commonjs.showWarning(response.message);
                                saveButton.attr('disabled', false);
                            } else {

                                var claimRefreshInterval = setTimeout(function () {
                                    clearTimeout(claimRefreshInterval);

                                    commonjs.showStatus("messages.status.successfullyCompleted");
                                    console.log(self.claim_Id);
                                    $("#btnClaimsRefresh").click();
                                    $("#btnStudiesRefresh").click();
                                }, 200);
                                
                                var time = self.isEdit ? 800 : 100;
                                var claimHideInterval = setTimeout(function () {
                                    clearTimeout(claimHideInterval);
                                    if(self.isEdit){
                                        self.claim_row_version = response && response.length && response[0].result ? response[0].result : null;  
                                        saveButton.attr('disabled', false);
                                        $('#chktblClaimGridAll_Claims_' + self.claim_Id).prop('checked', true);
                                    }else{
                                        commonjs.hideDialog();
                                    }
                                }, time);
                            }
                        },
                        error: function (model, response) {
                            commonjs.handleXhrError(model, response);
                            saveButton.attr('disabled', false);
                        }
                    });
                }
                else
                    saveButton.attr('disabled', false);
            },

            validateClaimData: function () {
                var self = this;
                self.is_primary_available = false;
                self.is_secondary_available = false;
                self.is_tertiary_available = false;

                /* Claims section */
                if (!$('#txtClaimDate').val()) {
                    commonjs.showWarning("Please select claim date");
                    $('#txtClaimDate').focus();
                    return false;
                }

                if (!$('#ddlFacility').val()) {
                    commonjs.showWarning("shared.warning.selectfacility");
                    $('#ddlFacility').focus();
                    return false;
                }

                if (!$('#ddlBillingProvider').val()) {
                    commonjs.showWarning("shared.warning.selectbillingProvider");
                    $('#ddlBillingProvider').focus();
                    return false;
                }

                /* Insurance section */
                var mandatory_fields = {
                    primaryfields: [
                        $('#txtPriPolicyNo').val().trim(),
                        $('#txtPriSubFirstName').val().trim(),
                        $('#txtPriSubLastName').val().trim(),
                        $('#ddlPriGender').val() ? $('#ddlPriGender').val().trim() : '',
                        $('#txtPriSubPriAddr').val().trim(),
                        $('#ddlPriRelationShip option:selected').val().trim() || '',
                        $('#txtPriDOB').val().trim().trim(),
                        $('#txtPriCity').val().trim(),
                        $('#ddlPriState option:selected').val().trim() || '',
                        $('#txtPriZipCode').val().trim()
                    ],
                    secondaryfields: [
                        $('#txtSecPolicyNo').val().trim(),
                        $('#txtSecSubFirstName').val().trim(),
                        $('#txtSecSubLastName').val().trim(),
                        $('#ddlSecGender').val() ? $('#ddlSecGender').val().trim() : '',
                        $('#txtSecSubPriAddr').val().trim(),
                        $('#ddlSecRelationShip option:selected').val().trim() || '',
                        $('#txtSecDOB').val().trim(),
                        $('#txtSecCity').val().trim(),
                        $('#ddlSecState option:selected').val().trim() || '',
                        $('#txtSecZipCode').val().trim()
                    ],
                    tertiaryfields: [
                        $('#txtTerPolicyNo').val().trim(),
                        $('#txtTerSubFirstName').val().trim(),
                        $('#txtTerSubLastName').val().trim(),
                        $('#ddlTerGender').val() ? $('#ddlTerGender').val().trim() : '',
                        $('#txtTerSubPriAddr').val().trim(),
                        $('#ddlTerRelationShip option:selected').val().trim() || '',
                        $('#txtTerDOB').val().trim(),
                        $('#txtTerCity').val().trim(),
                        $('#ddlTerState option:selected').val().trim() || '',
                        $('#txtTerZipCode').val().trim()
                    ]
                }

                function checkEmpty(val) {
                    return val == '';
                }

                if (self.priInsID || !mandatory_fields.primaryfields.every(checkEmpty)) {

                    if (mandatory_fields.primaryfields.indexOf('') > -1 || mandatory_fields.primaryfields.indexOf(null) > -1) {
                        commonjs.showWarning("shared.warning.priInsValidation");
                        return false;
                    }
                    if ($('#ddlPriInsurance').val() == '') {
                        commonjs.showWarning("Please select primary insurance");
                        $('#ddlPriInsurance').focus();
                        return false;
                    }
                    else
                        self.is_primary_available = true;
                }
                if (self.secInsID || !mandatory_fields.secondaryfields.every(checkEmpty)) {
                    if (!self.priInsID) {

                        commonjs.showWarning("shared.warning.priMissingValidation");
                        return false;
                    }
                    else {

                        if (mandatory_fields.secondaryfields.indexOf('') > -1 || mandatory_fields.secondaryfields.indexOf(null) > -1) {

                            commonjs.showWarning("shared.warning.secInsValidation");
                            return false;
                        }
                        if ($('#s2id_txtSecInsurance a span').html() == 'Search Carrier' || $('#s2id_txtSecInsurance a span').html() == '') {

                            commonjs.showWarning("Please select secondary insurance");
                            return false;
                        }
                        else
                            self.is_secondary_available = true;
                    }
                }
                if (self.terInsID || !mandatory_fields.tertiaryfields.every(checkEmpty)) {
                    if (!self.secInsID) {

                        commonjs.showWarning("shared.warning.secMissingValidation");
                        return false;
                    }
                    else {

                        if (mandatory_fields.tertiaryfields.indexOf('') > -1 || mandatory_fields.tertiaryfields.indexOf(null) > -1) {

                            commonjs.showWarning("shared.warning.terInsValidation");
                            return false;
                        }
                        if ($('#s2id_txtTerInsurance a span').html() == 'Search Carrier' || $('#s2id_txtTerInsurance a span').html() == '') {

                            commonjs.showWarning("Please select secondary insurance");
                            return false;
                        }
                        else
                            self.is_tertiary_available = true;
                    }
                }

                /* Charge section */

                if (!$('#tBodyCharge tr').length) {
                    commonjs.showWarning("shared.warning.chargeValidation", 'largewarning');
                    return false;
                }
                if ($('.cptcode').hasClass('cptIsExists')) {
                    commonjs.showWarning('Please select any cpt code in added line items');
                    return false;
                }
                if ($('.diagCodes').hasClass('invalidCpt')) {
                    commonjs.showWarning('Please enter valid pointer');
                    $('.invalidCpt').focus();
                    return false;
                }
                if ($('.modifiers').hasClass('invalidModifier')) {
                    commonjs.showWarning('Please enter valid modifier');
                    $('.invalidModifier').focus();
                    return false;
                }
                if ($('.units').hasClass('invalidUnites')) {
                    commonjs.showWarning('Please enter valid unit(s)');
                    $('.invalidUnites').focus();
                    return false;
                }

                /*Billing summary Section*/
                if (!$('#ddlClaimStatus').val()) {
                    commonjs.showWarning("shared.warning.missingClaimStatus");
                    $('#ddlClaimStatus').focus();
                    return false;
                }
                if (!$('#ddlResponsible').val()) {
                    commonjs.showWarning("shared.warning.missingResponsible");
                    $('#ddlResponsible').focus();
                    return false;
                }

                /* Additional Info Section */
                if ($('#txtWCF').val() || $('#txtWCT').val()) {
                    if (!self.validateFromAndToDate($('#txtWCF').val(), $('#txtWCT').val()))
                        return false;
                }

                if ($('#txtHCF').val() || $('#txtHCT').val()) {
                    if (!self.validateFromAndToDate($('#txtHCF').val(), $('#txtHCT').val()))
                        return false;
                    else
                        return true;
                }
                else
                    return true;

            },

            convertToTimeZone: function (facility_id, date_data) {
                return moment.tz(date_data, "YYYY-MM-DD HH:mm a", commonjs.getFacilityTimeZone(facility_id));
            },

            validateFromAndToDate: function (objFromDate, objToDate) {
                var validationResult = commonjs.validateDateTimePickerRange(moment(objFromDate), moment(objToDate), true);
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
                    if (confirm("You Need to Change address details?")) {
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
                    self.priInsName = '';
                    self.is_primary_available = false;

                }
                else if (id == 'btnResetSecInsurance') {
                    flag = 'Sec'
                    payer_type = 'PIP_S';
                    self.secInsID = '';
                    self.secInsName = '';
                    $('#chkSecMedicarePayer').prop('checked', false);
                    $('#selectMedicalPayer').toggle(false);
                    self.is_secondary_available = false;

                }
                else if (id == 'btnResetTerInsurance') {
                    flag = 'Ter'
                    payer_type = 'PIP_T';
                    self.terInsID = '';
                    self.terInsName = '';
                    self.is_tertiary_available = false;

                }

                if (flag && payer_type) {
                    $('#ddlExist' + flag + 'Ins').val('');
                    $('#txt' + flag + 'Insurance').val('');
                    $('#chk' + flag + 'AcptAsmt').prop('checked', false);
                    $('#lbl' + flag + 'InsPriAddr').html('');
                    $('#lbl' + flag + 'InsCityStateZip').html('');
                    $('#lbl' + flag + 'PhoenNo').html('');
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
                    });
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
                    commonjs.showWarning('Error on claim validation');
                    return false;
                }
                $("#btnValidateClaim").attr("disabled", true);
                $.ajax({
                    url: '/exa_modules/billing/claim_workbench/validate_claims',
                    type: 'POST',
                    data: {
                        claim_ids: claimIds 
                    },
                    success: function(data, response){
                        $("#btnValidateClaim").attr("disabled", false);
                        if (data) {
                            commonjs.hideLoading();

                            if (!data.invalidClaim_data.length)
                                commonjs.showStatus(commonjs.geti18NString("messages.status.validatedSuccessfully"));
                            else
                                commonjs.showNestedDialog({ header: 'Validation Results', i18nHeader: 'billing.claims.validationResults', width: '70%', height: '60%', html: self.claimValidation({ response_data: data.invalidClaim_data }) });  
                        }
                    },
                    error: function (err, response) {
                        $("#btnValidateClaim").attr("disabled", false);
                        commonjs.handleXhrError(err, response);
                    }
                })
            },

            processClaim: function (e) {
                var self = this;
                var $tblGrid = $('#tblClaimGridAll_Claims');

                if (self.claim_Id) {

                    var rowData = $($tblGrid, parent.document).find('tr#' + self.claim_Id);
                    var nextRowData = $(e.target).attr('id') == 'btnPrevClaim' ? rowData.prev() : rowData.next();

                    if (nextRowData.attr('id') && nextRowData.length > 0) {
                        var rowId = nextRowData.attr('id');
                        $(e.target).prop('disabled', true);
                        var data = $($tblGrid, parent.document).getRowData(rowId);
                        commonjs.getClaimStudy(rowId, function (result) {
                            self.rendered = false;
                            self.clearDependentVariables();
                            self.showEditClaimForm(rowId, null, {
                                'study_id': result && result.study_id ? result.study_id : 0,
                                'patient_name': data.patient_name,
                                'patient_id': data.patient_id,
                                'order_id': result && result.order_id ? result.order_id : 0
                            });

                            $('#modal_div_container').scrollTop(0); 
                        });
                    } else {
                        commonjs.showWarning('No more order found')
                    }

                } else {
                    commonjs.showWarning('Error on process claim');
                }
            },
            
            bindTabMenuEvents: function () {
                var self = this;

                var tab_menu_link = $('ul#tab_menu li a');
                var tab_menu_item = $('ul#tab_menu li');
                var $root = $('#modal_div_container');

                tab_menu_link.click(function (e) {
                    var currId = $(this).attr('href').split('_')[1];
                    tab_menu_item.removeClass('active');
                    e && $(e.target).closest('li').addClass('active');

                    var _height = 0;
                    for (var i = 1; i < currId; i++) {
                        _height += parseInt($('#tab_' + i).height() + 15);
                    }
                    if (currId == 4)
                        _height -= parseInt($('#divTeritaryInsurances').height() + 15);

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
                                    var study_date = study.study_dt ? commonjs.convertToFacilityTimeZone(app.facilityID, moment(study.study_dt)).format('L LT z') : '--'
                                    $list.append('<li><input id="studyChk_' + study.id + '" type="checkbox" name="chkStudy" data-study_dt="' + study.study_dt + '" data-accession_no="' + study.accession_no + '" />'+
                                    '<label style="font-weight: bold;overflow-wrap: break-word;"  for="studyChk_' + study.id + '" >' + study.study_description
                                    + ' ( Accession# : ' + study.accession_no + ' , Study.Date: ' + study_date + ')</label></li>');
                                });
                                $studyDetails.append($list);
                                $studyDetails.show();

                                $studyDetails.append('<button style="height:33px;margin-right:5px;" type="button" class="btn top-buffer processClaim" id="btnClaimWStudy">With Study</button>');
                                $studyDetails.append('<button style="height:33px;" type="button" class="btn top-buffer processClaim" id="btnClaimWOStudy">Create Without Study</button>');
                                $('.processClaim').off().click(function (e) {

                                    if ($(e.target).attr('id') == 'btnClaimWStudy') {
                                        var selectedStudies = [];
                                        var $checkedInputs = $studyDetails.find('input').filter('[name=chkStudy]:checked');
                                        var selectedCount = $checkedInputs.length;

                                        if (selectedCount == 0) {
                                            commonjs.showWarning('Please select Study');
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
                                            self.showClaimForm('patientSearch');

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

                                if (confirm("Selected patient don't have study. Are you sure to process without study? ")) {
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
            claimWOStudy:function(patient_details){
                var self = this;

                // Claim w/o charge code  -- start
                $('#divPageLoading').show();

                // bind claim details
                self.bindDetails();

                //binding claim form events
                self.bindTabMenuEvents();
                self.bindclaimFormEvents();

                // Set Default details
                self.updateResponsibleList({
                    payer_type: 'PPP',
                    payer_name: patient_details.patient_name + '( Patient )',
                    payer_id: self.cur_patient_id
                });
                
                $('#ddlFacility').val(app.facilityID || '');
                $('#ddlClaimStatus').val($("option[data-desc = 'PV']").val());
                $('#ddlResponsible').val('PPP');

                self.cur_study_date = commonjs.convertToFacilityTimeZone(app.facilityID, moment()).format('L LT z')
                document.querySelector('#txtClaimDate').value = moment().format('YYYY-MM-DD');

                // Bind Patient Default details
                var renderingProvider = patient_details.rendering_provider_full_name || self.usermessage.selectStudyReadPhysician;
                var service_facility_name = patient_details.service_facility_name || self.usermessage.selectOrdFacility;
                self.ACSelect.readPhy.contact_id = patient_details.rendering_provider_contact_id || patient_details.rendering_provider_contact_id || null;
                self.group_id = patient_details.service_facility_id ? parseInt(patient_details.service_facility_id) : null;
                self.group_name = service_facility_name;

                $('#ddlBillingProvider').val(patient_details.billing_provider_id || '');
                $('#ddlFacility').val(patient_details.facility_id || '');
                $('#select2-ddlRenderingProvider-container').html(renderingProvider);
                $('#select2-ddlOrdFacility-container').html(service_facility_name);

                // Claim w/o charge code  -- end

                setTimeout(function () {
                    $('#divPageLoading').hide();
                    $(parent.document).find('#spanModalHeader').html('Claim Creation : <STRONG>' + patient_details.patient_name + '</STRONG> (Acc#:' + patient_details.patient_account_no + '), <i>' + patient_details.patient_dob + '</i>, '+ patient_details.patient_gender);
                    $('#divPatient').hide();
                    $('.woClaimRelated').show();
                }, 200);

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
                    var selfValue = $("#ddlPriRelationShip option:contains('Self')").val();
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
                    var selfValue = $("#ddlSecRelationShip option:contains('Self')").val();
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
                    var selfValue = $("#ddlTerRelationShip option:contains('Self')").val();
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
            }

        });
        return claimView;
    });

