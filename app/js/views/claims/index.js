define(['jquery', 'underscore', 'backbone', 'models/claims', 'models/patient-insurance','models/patient-details', 'text!templates/claims/claim-form.html', 'text!templates/claims/charge-row.html'],
    function ($, _, Backbone, newClaimModel, modelPatientInsurance, patientModel, claimCreationTemplate, chargeRowTemplate) {
        var claimView = Backbone.View.extend({
            el: null,
            rendered: false,
            claimCreationTemplate: _.template(claimCreationTemplate),
            chargerowtemplate: _.template(chargeRowTemplate),
            updateResponsibleList: [],
            chargeModel: [],
            claimICDLists: [],
            existingPrimaryInsurance: [],
            existingSecondaryInsurance: [],
            existingTriInsurance: [],
            ACSelect: { refPhy: {}, readPhy: {} },
            responsible_list: [
                { payer_type: "PPP", payer_type_name: "patient", payer_id: null, payer_name: null },
                { payer_type: "PIP_P", payer_type_name: "primary_insurance", payer_id: null, coverage_level: "P", payer_name: null, billing_method: null },
                { payer_type: "PIP_S", payer_type_name: "secondary_insurance", payer_id: null, coverage_level: "S", payer_name: null, billing_method: null },
                { payer_type: "PIP_T", payer_type_name: "tertiary_insurance", payer_id: null, coverage_level: "T", payer_name: null, billing_method: null },
                { payer_type: "POF", payer_type_name: "ordering_facility", payer_id: null, payer_name: null },
                { payer_type: "PR", payer_type_name: "referring_provider", payer_id: null, payer_name: null },
                { payer_type: "PF", payer_type_name: "facility", payer_id: null, payer_name: null }
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
            initialize: function (options) {
                this.options = options;
                this.model = new newClaimModel();
                this.patInsModel = new modelPatientInsurance();
                var planName = [
                    { value: '', 'text': 'Select' },
                    { value: 'Health', 'text': 'Health' },
                    { value: 'Retried', 'text': 'Retried' },
                    { value: 'Education', 'text': 'Education' }
                ];
                var modelCollection = Backbone.Collection.extend({
                    model: Backbone.Model.extend({})
                });
                this.facilities = new modelCollection(commonjs.bindArray(app.facilities, true, true));
                this.states = new modelCollection(commonjs.bindArray(app.states[0].app_states, true));
                this.genders = new modelCollection(commonjs.bindArray(app.gender, true));
                this.empStatus = new modelCollection(app.employment_status);
                this.planList = new modelCollection(planName);
                this.claimStatusList = new modelCollection(app.claim_status);
                this.billingCodesList = new modelCollection(app.billing_codes);
                this.billingClassList = new modelCollection(app.billing_classes);

            },

            render: function () {

                var self = this;
                var curClaimDetails = JSON.parse(window.localStorage.getItem('selected_studies'));
                self.cur_patient_id = curClaimDetails.patient_id ? parseInt(curClaimDetails.patient_id) : null;
                self.cur_patient_name = curClaimDetails.patient_name;
                self.cur_patient_acc_no = curClaimDetails.account_no;
                self.cur_patient_dob = curClaimDetails.patient_dob ? moment.utc(curClaimDetails.patient_dob).format('L') : null;
                self.cur_study_date = (commonjs.checkNotEmpty(curClaimDetails.study_date) ? commonjs.convertToFacilityTimeZone(curClaimDetails.facility_id, curClaimDetails.study_date).format('L LT z') : '');
                self.pri_accession_no = curClaimDetails.accession_no || null;
                self.cur_study_id = curClaimDetails.study_id || null;
                self.isEdit = self.claim_Id ? true : false;

                this.$el.html(this.claimCreationTemplate({
                    patient_name: self.cur_patient_name,
                    account_no: self.cur_patient_acc_no,
                    dob: self.cur_patient_dob,
                    planname: self.planList.toJSON(),
                    facilities: self.facilities.toJSON(),
                    empStatus: self.empStatus.toJSON(),
                    genders: self.genders.toJSON(),
                    states: self.states.toJSON(),
                    claimStatusList: self.claimStatusList.toJSON(),
                    billingCodesList: self.billingCodesList.toJSON(),
                    billingClassList: self.billingClassList.toJSON()
                })); 

                self.bindDetails();
                // Hide non-edit tabs
                // if (!self.isEdit)
                $('.editClaimRelated').hide();

                self.getLineItemsAndBind(curClaimDetails);
                self.updateResponsibleList({
                    payer_type: 'PPP',
                    payer_name: self.cur_patient_name + '( Patient )',
                    payer_id: self.cur_patient_id
                });
                self.bindclaimFormEvents();
                
            },

            bindDetails: function () {
                var self = this;
                self.setProviderAutoComplete('PR'); // rendering provider auto complete
                self.setProviderAutoComplete('RF'); // referring provider auto complete
                self.setDiagCodesAutoComplete();
                self.bindExistingPatientInsurance();
                self.setOrderingFacilityAutoComplete();
                // set all Insurance auto_complete
                self.bindInsuranceAutocomplete('ddlPriInsurance');
                self.bindInsuranceAutocomplete('ddlSecInsurance');
                self.bindInsuranceAutocomplete('ddlTerInsurance');
                self.bindBillingSummary();
            },

            initializeClaimEditForm: function () {
                var self = this;
                if (!this.rendered)
                    this.render();
                self.bindclaimFormEvents();
            },

            /* Get claim edit details function*/
            showEditClaimForm: function (claim_Id, IsUpdated) {
                var self = this, _claimMgmtStatus = {
                    'rv': 'Ready To Validate',
                    'rd': 'Ready To File',
                    'st': 'Submitted'
                };
                self.claim_Id = claim_Id;
                self.isEdit = true;
                self.claimICDLists = [];
                self.removedCharges = [];
                self.chargeModel = [];

                $.ajax({
                    type: 'GET',
                    url: '/exa_modules/billing/claims',
                    data: {
                        id: claim_Id
                    },
                    success: function (model, response) {

                        if (model && model.length > 0) {
                            var claimDetails = model[0];
                            /* Header Details */
                            // $(parent.document).find('#spanModalHeader').html('Edit: <STRONG>' + claimDetails.patient_full_name + '</STRONG> (Acc#:' + claimDetails.patient_account_no + '), <i>' + claimDetails.patient_dob + '</i>  ');
                            self.cur_patient_acc_no = claimDetails.patient_account_no;
                            self.cur_patient_name = claimDetails.patient_full_name;
                            self.cur_patient_dob = claimDetails.patient_dob;
                            self.cur_patient_id = claimDetails.patient_id ? parseInt(claimDetails.patient_id) : null;
                            self.cur_study_date = (commonjs.checkNotEmpty(claimDetails.claim_dt) ? commonjs.convertToFacilityTimeZone(claimDetails.facility_id, claimDetails.claim_dt).format('L LT z') : '');
                            self.priClaimInsID = claimDetails.primary_patient_insurance_id || null;
                            self.secClaimInsID = claimDetails.secondary_patient_insurance_id || null;
                            self.terClaimInsID = claimDetails.tertiary_patient_insurance_id || null;
                            
                            self.initializeClaimEditForm();

                            /* Bind claim charge Details*/
                            $('#tBodyCharge').empty();
                            claimDetails.claim_charges = claimDetails.claim_charges || [];
                            $.each(claimDetails.claim_charges, function (index, obj) {
                                obj.claim_dt = claimDetails.claim_dt;
                                obj.facility_id = claimDetails.facility_id;
                                obj.data_row_id = index;
                                self.addLineItems(obj, index, false);
                                self.chargeModel.push({
                                    id: obj.id,
                                    data_row_id: index,
                                    ref_charge_id: null,
                                    claim_id: obj.claim_id,
                                    study_id: obj.study_id,
                                    accession_no: obj.accession_no,
                                    is_deleted: false
                                });
                            });

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
                                self.addDiagCodes();
                            });

                            // clear icd details after bind
                            self.ICDID = self.icd_code = self.icd_description = '';

                            $('#ddlClaimManagement').text(_claimMgmtStatus[claimDetails.file_status]);
                            $('#spClaimId').text(claimDetails.id);
                            $('#btnSaveClaim').attr('disabled', false);

                            setTimeout(function () {
                                self.bindDefaultClaimDetails(claimDetails);
                            }, 200);
                        }
                    },
                    error: function (model, response) {
                        commonjs.handleXhrError(model, response);
                    }

                });
            },

            bindDefaultClaimDetails: function (claim_data) {
                var self = this;

                /* Claim section start*/

                var renderingProvider = claim_data.reading_phy_full_name || self.usermessage.selectStudyReadPhysician;
                var referringProvider = claim_data.ref_prov_full_name || self.usermessage.selectStudyRefProvider;
                var orderingFacility = claim_data.service_facility_name || self.usermessage.selectOrdFacility;

                self.ACSelect.readPhy.contact_id = claim_data.rendering_provider_contact_id || null;
                self.ACSelect.refPhy.contact_id = claim_data.referring_provider_contact_id || null;
                self.ACSelect.refPhy.Code = claim_data.ref_prov_code || null;
                self.ACSelect.refPhy.Desc = referringProvider;
                self.group_id = claim_data.service_facility_id ? parseInt(claim_data.service_facility_id) : null;
                self.group_name = orderingFacility;

                $('#ddlBillingProvider').val(claim_data.billing_provider_id || '');
                $('#ddlFacility').val(claim_data.facility_id || '');
                $('#select2-ddlRenderingProvider-container').html(renderingProvider);
                $('#select2-ddlReferringProvider-container').html(referringProvider);
                $('#select2-ddlOrdFacility-container').html(orderingFacility);

                /* Claim section end */
                /* Additional info start*/

                document.querySelector('#txtHCT').value = claim_data.hospitalization_to_date ? moment(claim_data.hospitalization_to_date).format('YYYY-MM-DD') : '';
                document.querySelector('#txtHCF').value = claim_data.hospitalization_from_date ? moment(claim_data.hospitalization_from_date).format('YYYY-MM-DD') : '';
                document.querySelector('#txtWCT').value = claim_data.unable_to_work_from_date ? moment(claim_data.unable_to_work_from_date).format('YYYY-MM-DD') : '';
                document.querySelector('#txtWCF').value = claim_data.unable_to_work_to_date ? moment(claim_data.unable_to_work_to_date).format('YYYY-MM-DD') : '';
                document.querySelector('#txtOtherDate').value = claim_data.same_illness_first_date ? moment(claim_data.same_illness_first_date).format('YYYY-MM-DD') : '';
                document.querySelector('#txtDate').value = claim_data.current_illness_date ? moment(claim_data.current_illness_date).format('YYYY-MM-DD') : '';
                document.querySelector('#txtClaimDate').value = claim_data.claim_dt ? moment(claim_data.claim_dt).format('YYYY-MM-DD') : '';

                $('input[name="outSideLab"]').attr('checked', claim_data.service_by_outside_lab);
                $('input[name="employment"]').attr('checked', claim_data.is_employed);
                $('input[name="autoAccident"]').attr('checked', claim_data.is_auto_accident);
                $('input[name="otherAccident"]').attr('checked', claim_data.is_other_accident);
                $('#txtOriginalRef').val(claim_data.original_reference ? claim_data.original_reference : '');
                $('#txtAuthorization').val(claim_data.authorization_no ? claim_data.authorization_no : '');
                $('#frequency').val(claim_data.frequency ? claim_data.frequency : '');

                /* Additional info end */
                /* Billing summary start */

                $('#txtClaimNotes').val(claim_data.claim_notes || '');
                $('#ddlBillingCode').val(claim_data.billing_code_id || '');
                $('#ddlBillingClass').val(claim_data.billing_class_id || '');
                $('#txtResponsibleNotes').val(claim_data.billing_notes || '')

                /* Billing summary end */
                /* ResponsibleList start*/

                self.updateResponsibleList({
                    payer_type: 'PPP',
                    payer_name: self.cur_patient_name + '( Patient )',
                    payer_id: self.cur_patient_id
                });

                var facility = $('#ddlFacility option:selected').val();
                if (facility != '') {
                    self.updateResponsibleList({
                        payer_type: 'PF',
                        payer_id: facility,
                        payer_name: $('#ddlFacility option:selected').text().trim() + '( Facility )'
                    });
                }

                if (self.group_id || null) {
                    self.updateResponsibleList({
                        payer_type: 'POF',
                        payer_id: self.group_id,
                        payer_name: self.group_name + '(Service Facility)'
                    });
                }

                if (self.ACSelect.refPhy.contact_id || null) {
                    self.updateResponsibleList({
                        payer_type: 'PR',
                        payer_id: self.ACSelect.refPhy.contact_id,
                        payer_name: self.ACSelect.refPhy.Desc + '(Referring Provider)'
                    });
                }
                /* ResponsibleList End*/
                /* Common Details Edit & Claim creation */
                if (self.isEdit) {
                    self.bindEditClaimInsuranceDetails(claim_data);
                    var responsibleIndex = _.find(self.responsible_list, (item) => item.payer_type_name == claim_data.payer_type);
                    $('#ddlResponsible').val(responsibleIndex.payer_type);
                    $('#ddlClaimStatus').val(claim_data.claim_status_id || '');
                    $('#ddlFrequencyCode').val(claim_data.frequency || '')
                    $('#ddlPOSType').val(claim_data.place_of_service_id || '');
                } else {
                    $('#ddlResponsible').val('PPP');
                    $('#ddlClaimStatus').val($("option[data-desc = 'PP']").val());
                    $('#ddlFrequencyCode').val(claim_data.frequency);
                    var _posCode = claim_data.pos_type_code ? claim_data.pos_type_code.trim() : '';
                    $('#ddlPOSType').val($('option[data-code = ' + _posCode + ']').val());
                }
                /* Common Details end */
                // trigger blur event for update Total bill fee, balance etc.
                $(".allowedFee").blur();

            },

            bindEditClaimInsuranceDetails: function (claimData) {
                var self = this;

                if (claimData.p_insurance_provider_id || null) {

                    self.priInsID = claimData.p_insurance_provider_id
                    self.priInsName = claimData.p_insurance_name;
                    $('#select2-ddlPriInsurance-container').html(claimData.p_insurance_name);
                    $('#chkPriAcptAsmt').prop('checked', claimData.p_assign_benefits_to_patient);
                    $('#lblPriInsPriAddr').html(claimData.p_address1);
                    var pri_csz = claimData.p_city || '' + (commonjs.checkNotEmpty(claimData.p_state) ? ',' + claimData.p_state : "") + (commonjs.checkNotEmpty(claimData.p_zip) ? ',' + claimData.p_zip : "");
                    $('#lblPriInsCityStateZip').html(pri_csz);
                    $('#lblPriInsCityStateZip').show()
                    $('#lblPriInsPriAddr').show()
                    $('#txtPriPolicyNo').val(claimData.p_policy_number);
                    $('#txtPriGroupNo').val(claimData.p_group_number);
                    $('#ddlPriEmpStatus').val(claimData.p_subscriber_employment_status_id);
                    $("#ddlPriRelationShip").val(claimData.p_subscriber_relationship_id);
                    $('#txtPriSubFirstName').val(claimData.p_subscriber_firstname);
                    $('#txtPriSubMiName').val(claimData.p_subscriber_middlename);
                    $('#txtPriSubLastName').val(claimData.p_subscriber_lastname);
                    $('#txtPriSubSuffix').val(claimData.p_subscriber_name_suffix);
                    $('#ddlPriGender').val(claimData.p_subscriber_gender);
                    $('#txtPriSubPriAddr').val(claimData.p_subscriber_address_line1);
                    $('#txtPriSubSecAddr').val(claimData.p_subscriber_address_line2);
                    $('#txtPriCity').val(claimData.p_subscriber_city);
                    $('#ddlPriState').val(claimData.p_subscriber_state);
                    $('#txtPriZipCode').val(claimData.p_subscriber_zipcode);
                    document.querySelector('#txtPriDOB').value = claimData.p_subscriber_dob ? moment(claimData.p_subscriber_dob).format('YYYY-MM-DD') : '';

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
                    var sec_csz = claimData.s_city || '' + (commonjs.checkNotEmpty(claimData.s_state) ? ',' + claimData.s_state : "") + (commonjs.checkNotEmpty(claimData.s_zip) ? ',' + claimData.s_zip : "");
                    $('#lblSecInsCityStateZip').html(sec_csz);
                    $('#lblSecInsCityStateZip').show();
                    $('#lblSecInsPriAddr').show();
                    $('#txtSecPolicyNo').val(claimData.s_policy_number);
                    $('#txtSecGroupNo').val(claimData.s_group_number);
                    $('#ddlSecEmpStatus').val(claimData.s_subscriber_employment_status_id);
                    $("#ddlSecRelationShip").val(claimData.s_subscriber_relationship_id);
                    $('#txtSecSubFirstName').val(claimData.s_subscriber_firstname);
                    $('#txtSubMiName').val(claimData.s_subscriber_middlename);
                    $('#ddlSecGender').val(claimData.s_subscriber_gender);
                    $('#txtSecSubLastName').val(claimData.s_subscriber_lastname);
                    $('#txtSecSubSuffix').val(claimData.s_subscriber_name_suffix);
                    $('#txtSecSubPriAddr').val(claimData.s_subscriber_address_line1);
                    $('#txtSecSubSecAddr').val(claimData.s_subscriber_address_line2);
                    $('#txtSecCity').val(claimData.s_subscriber_city);
                    $('#ddlSecState').val(claimData.s_subscriber_state);
                    $('#txtSecZipCode').val(claimData.s_subscriber_zipcode);
                    document.querySelector('#txtSecDOB').value = claimData.p_subscriber_dob ? moment(claimData.p_subscriber_dob).format('YYYY-MM-DD') : '';
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
                    var ter_csz = claimData.t_city || '' + (commonjs.checkNotEmpty(claimData.t_state) ? ',' + claimData.t_state : "") + (commonjs.checkNotEmpty(claimData.t_zip) ? ',' + claimData.t_zip : "");
                    $('#lblTerInsCityStateZip').html(ter_csz);
                    $('#lblTerInsCityStateZip').show()
                    $('#lblTerInsPriAddr').show();
                    $('#txtTerPolicyNo').val(claimData.t_policy_number);
                    $('#txtTerGroupNo').val(claimData.t_group_number);
                    $('#ddlTerEmpStatus').val(claimData.t_subscriber_employment_status_id);
                    $("#ddlTerRelationShip").val(claimData.t_subscriber_relationship_id);
                    $('#txtTerSubFirstName').val(claimData.t_subscriber_firstname);
                    $('#txtTerSubMiName').val(claimData.t_subscriber_middlename);
                    $('#ddlTerGender').val(claimData.t_subscriber_gender);
                    $('#txtTerSubLastName').val(claimData.t_subscriber_lastname);
                    $('#txtTerSubSuffix').val(claimData.t_subscriber_name_suffix);
                    $('#txtTerSubPriAddr').val(claimData.t_subscriber_address_line1);
                    $('#txtTerSubSecAddr').val(claimData.t_subscriber_address_line2);
                    $('#txtTerCity').val(claimData.t_subscriber_city);
                    $('#ddlTerState').val(claimData.t_subscriber_state);
                    $('#txtTerZipCode').val(claimData.t_subscriber_zipcode);
                    document.querySelector('#txtTerDOB').value = claimData.p_subscriber_dob ? moment(claimData.p_subscriber_dob).format('YYYY-MM-DD') : '';
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
                var curClaimDetails = JSON.parse(window.localStorage.getItem('selected_studies'));
                self.cur_patient_id = curClaimDetails.patient_id ? parseInt(curClaimDetails.patient_id) : null;
                self.cur_patient_name = curClaimDetails.patient_name;
                self.cur_patient_acc_no = curClaimDetails.account_no;
                self.cur_patient_dob = curClaimDetails.patient_dob ? moment.utc(curClaimDetails.patient_dob).format('L') : null;
                self.cur_study_date = (commonjs.checkNotEmpty(curClaimDetails.study_date) ? commonjs.convertToFacilityTimeZone(curClaimDetails.facility_id, curClaimDetails.study_date).format('L LT z') : '');
                self.pri_accession_no = curClaimDetails.accession_no || null;
                self.cur_study_id = curClaimDetails.study_id || null;
                self.isEdit = self.claim_Id ? true : false;

                if (!this.rendered)
                    this.render();

                self.getLineItemsAndBind(curClaimDetails);
                self.updateResponsibleList({
                    payer_type: 'PPP',
                    payer_name: self.cur_patient_name + '( Patient )',
                    payer_id: self.cur_patient_id
                });

                self.bindclaimFormEvents();
            },

            bindclaimFormEvents: function () {

                var self = this;
                $("#createNewCharge").off().click(function (e) {
                    self.addChargeLine(e);
                });

                $("#btnAddDiagCode").off().click(function (e) {
                    self.addDiagCodes(e);
                });

                $("#btnSaveClaim").off().click(function (e) {
                    self.saveClaimDetails(e);
                });

                $("#ddlExistTerIns, #ddlExistSecIns, #ddlExistPriIns").off().change(function (e) {
                    self.assignExistInsurance(e);
                });

                $("#ddlPriRelationShip, #ddlSecRelationShip, #ddlTerRelationShip").off().change(function (e) {
                    self.changeRelationalShip(e);
                });

                $(".closePopup").off().click(function (e) {
                    $('#site_modal_div_container').empty().hide();
                });

                $("#chkSecMedicarePayer").off().change(function (e) {
                    $('#selectMedicalPayer').toggle($('#chkSecMedicarePayer').is(':checked')).val('');
                });

            },
            getLineItemsAndBind: function (curClaimDetails) {
                var self = this, study_ids;
                if ($.isArray(curClaimDetails)) {
                    study_ids = self.getSelectedStudyID(curClaimDetails);
                    self.study_ids = study_ids;
                    study_ids = study_ids.join('~');
                } else {
                    study_ids = curClaimDetails.study_id;
                }
                if (study_ids) {

                    $.ajax({
                        type: 'GET',
                        url: '/exa_modules/billing/claims/get_line_items',
                        data: {
                            from: 'claimCreation',
                            study_ids: study_ids
                        },
                        success: function (model, response) {
                            if (model && model.length > 0) {
                                $('#tBodyCharge').empty();
                                var modelDetails = model[0];
                                _.each(modelDetails.charges, function (item) {
                                    var index = $('#tBodyCharge').find('tr').length;
                                    item.data_row_id = index;
                                    self.addLineItems(item, index);

                                    self.chargeModel.push({
                                        id: null,
                                        claim_id: null,
                                        ref_charge_id: item.study_cpt_id,
                                        accession_no: item.accession_no,
                                        study_id: item.study_id,
                                        data_row_id: index
                                    });
                                });

                                var _defaultDetails = modelDetails.claim_details && modelDetails.claim_details.length > 0 ? modelDetails.claim_details[0] : {};
                                self.bindDefaultClaimDetails(_defaultDetails)
                            }
                        },
                        error: function (model, response) {
                            commonjs.handleXhrError(model, response);
                        }
                    })

                }

            },

            getSelectedStudyID: function (curClaimDetails) {
                var studyIds = [];
                $.each(curClaimDetails, function (index, obj) {
                    if (obj.study_id != '' && studyIds.indexOf(parseInt(obj.study_id)) == -1) {
                        studyIds.push(parseInt(obj.study_id))
                    }
                })
                return studyIds;
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
                        study_id: self.isEdit ? (rowData.study_id || null) : (self.cur_study_id || null),
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

                self.addLineItems(_rowObj, _rowObj.data_row_id, true);
                self.chargeModel.push(_rowObj);

            },

            addLineItems: function (data, index, isNew) {
                var self = this;

                data.claim_dt = (commonjs.checkNotEmpty(self.cur_study_date) ? self.cur_study_date : '');
                var chargeTableRow = self.chargerowtemplate({ row: data });
                $('#tBodyCharge').append(chargeTableRow);
                self.setChargeAutoComplete(index, 'code');
                self.setChargeAutoComplete(index, 'description');

                /* Bind charge table data*/
                if (data.cpt_code || data.display_description) {
                    $('#select2-txtCptCode_' + index + '-container').html(data.cpt_code).prop('title', data.cpt_code).attr({ 'data_code': data.cpt_code, 'data_description': data.display_description, 'data_id': data.cpt_id }).css('min-width', '80');
                    $('#select2-txtCptDescription_' + index + '-container').html(data.display_description).prop('title', data.display_description).attr({ 'data_code': data.cpt_code, 'data_description': data.display_description, 'data_id': data.cpt_id });
                    $('#txtCptCode_' + index).removeClass('cptIsExists');
                }

                self.assignModifierEvent();
                self.assignLineItemsEvents(index);
                commonjs.enableModifiersOnbind('M'); // Modifier
                commonjs.enableModifiersOnbind('P'); // Diagnostic Pointer
                commonjs.validateControls();

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
                        commonjs.activateInputModifiers(_isFrom, e.target);

                    })
                    .on("change", function (e) {
                        var _isFrom = $(e.target).hasClass('diagCodes') ? 'P' : 'M';
                        self.checkInputModifiersValues(e, _isFrom);
                        commonjs.activateInputModifiers(_isFrom, e.target);
                    })
                    .on("blur", function (e) {
                        var _isFrom = $(e.target).hasClass('diagCodes') ? 'P' : 'M';
                        self.checkInputModifiersValues(e, _isFrom);
                        commonjs.activateInputModifiers(_isFrom, e.target);
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

            checkInputModifiersValues: function (e, isFrom, isEdit) {
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
                }
                else if (isFrom == 'M') { // Modifiers

                    var dataContent = $(e.target).val();
                    var modifierLevel = $(e.target).attr('data-type');
                    if (dataContent != '') {
                        var existData = jQuery.grep(app.modifiers, function (value) {
                            return (value.code == dataContent && (value[modifierLevel] == true || value[modifierLevel] == 'true'));
                        });
                        if (existData.length > 0) {
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
                    }
                }

            },

            assignLineItemsEvents: function (index) {
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

                    if (rowData.id || null) {
                        self.removedCharges.push({
                            id: parseInt(rowData.id),
                            claim_id: rowData.claim_id ? rowData.claim_id : null,
                            last_updated_by: app.userID,
                            deleted_by: app.userID,
                            is_deleted: true
                        });
                    }
                    self.chargeModel = _.reject(self.chargeModel, (d) => d.data_row_id === rowId);
                    rowObj.remove();
                    // trigger blur event for update Total bill fee, balance etc.
                    $(".allowedFee").blur();
                });
                // Enable bill_fee 
                $('#editBillFee_' + index).off().click(function (e) {
                    $('#txtBillFee_' + index).attr({ disabled: false, edit: true }).focus();
                    $('#txtAllowedFee_' + index).attr({ disabled: false, edit: true });
                });
                // changeFee details on keup
                $(".units, .billFee, .allowedFee").off().blur(function (e) {
                    ///this.value = this.value.replace(/[^0-9\.]/g, '');
                    self.changeFeeData(e)
                });

            },

            changeFeeData: function (e) {
                var self = this, total_bill_fee = 0.0, total_allowed = 0.0;
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

                $('#spTotalBillFeeValue').text(commonjs.roundFee(total_bill_fee));
                $('#spBillFee').text(commonjs.roundFee(total_bill_fee));
                $('#spBalance').text(commonjs.roundFee(total_bill_fee));
                $('#spTotalAllowedFeeValue').text(commonjs.roundFee(total_allowed));
                $('#spAllowed').text(commonjs.roundFee(total_allowed));

            },

            updateResponsibleList: function (payer_details) {
                var self = this, index, responsibleEle, selected_opt;
                index = _.findIndex(self.responsible_list, (item) => item.payer_type == payer_details.payer_type);
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
                                page: params.page || 20,
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
                    templateResult: formatRepo,
                    templateSelection: formatRepoSelection
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
                function formatRepoSelection(res) {
                    if (res.id) {
                        var duration = (res.duration > 0) ? res.duration : 15;
                        var units = (res.units > 0) ? parseFloat(res.units) : 1.0;
                        var fee = (res.globalfee > 0) ? parseFloat(res.globalfee) : 0.0;
                        self.setCptValues(rowIndex, txtCptCode, txtCptDescription, res, duration, units, fee);
                    }
                    return type == 'code' ? res.display_code : res.display_description;
                }
            },

            setCptValues: function (rowIndex, txtCptCode, txtCptDescription, res, duration, units, fee) {
                var self = this;
                $('#select2-' + txtCptCode + '-container').html(res.display_code).attr('title', res.display_code);
                $('#select2-' + txtCptCode + '-container').attr('data_code', res.display_code);
                $('#select2-' + txtCptCode + '-container').attr('data_description', res.display_description);
                $('#select2-' + txtCptCode + '-container').attr('data_id', res.id);

                $('#select2-' + txtCptDescription + '-container').html(res.display_description).attr('title', res.display_description);
                $('#select2-' + txtCptDescription + '-container').attr('data_code', res.display_code);
                $('#select2-' + txtCptDescription + '-container').attr('data_description', res.display_description);
                $('#select2-' + txtCptDescription + '-container').attr('data_id', res.id);

                $('#txtUnits_' + rowIndex).val(units);
                $('#txtBillFee_' + rowIndex).val(parseFloat(fee).toFixed(2));
                $('#txtAllowedFee_' + rowIndex).val(parseFloat(fee).toFixed(2));
                $('#txtTotalAllowedFee_' + rowIndex).val(parseFloat(units * fee).toFixed(2));
                $('#txtTotalBillFee_' + rowIndex).val(parseFloat(units * fee).toFixed(2));

                // this class used to validate if cpt choosen or not
                $('#' + txtCptCode).removeClass('cptIsExists');

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
                                page: params.page || 20,
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
                        markup1 += "<div>" + contactInfo.ADDR1 == "undefined" ? "" : contactInfo.ADDR1 + contactInfo.ADDR2 == "undefined" ? "" : ", " + contactInfo.ADDR2 + "</div>";
                        markup1 += "<div>" + contactInfo.CITY == "undefined" ? "" : contactInfo.CITY + ", " + contactInfo.STATE + contactInfo.ZIP == "undefined" ? "" : ", " + contactInfo.ZIP + contactInfo.MOBNO == "undefined" ? "" : ", " + contactInfo.MOBNO + "</div>";
                        markup1 += "</td></tr></table>";
                        return markup1;
                    }
                    else {
                        var markup = "<table class='ref-result' style='width: 100%'><tr>";
                        markup += "<td><div><b>" + repo.full_name + "</b><b>" + '(' + repo.provider_code + ')' + "</b></div>";
                        markup += "<div>" + (contactInfo.ADDR1 == "undefined" ? "" : contactInfo.ADDR1) + ", " + (contactInfo.ADDR2 == "undefined" ? "" : contactInfo.ADDR2) + "</div>";
                        markup += "<div>" + (contactInfo.CITY == "undefined" ? "" : contactInfo.CITY) + ", " + contactInfo.STATE + (contactInfo.ZIP == "undefined" ? "" : ", " + contactInfo.ZIP) + (contactInfo.MOBNO == "undefined" ? "" : ", " + contactInfo.MOBNO) + "</div>";
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
                                page: params.page || 20,
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

            addDiagCodes: function () {
                var self = this;
                var curDiagnosis = ($('#hdnDiagCodes').val() !== "") ? $('#hdnDiagCodes').val().split(',') : [];

                if (self.icd_code && curDiagnosis.length < 12) {

                    if (curDiagnosis.indexOf(String(self.ICDID)) > -1) {
                        alert("Problem already exists");
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
                        $('<li/>').append(
                            $('<span>').addClass("beautifySpan").text(self.icd_code + '-' + self.icd_description).append(
                                $('<span/>').addClass("orderNo").text(curDiagnosis.length + ' )').css('float', 'left')
                            )
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
                                    self.sortDigCodes();
                                })
                            )
                        )
                    );
                }
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
                    url: '/exa_modules/billing/claims/get_patient_insurances',
                    type: 'GET',
                    data: {
                        'patient_id': self.cur_patient_id || 0
                    },
                    success: function (response) {
                        self.existingPrimaryInsurance = [];
                        self.existingSecondaryInsurance = [];
                        self.existingTriInsurance = [];
                        if (response.length > 0) {
                            var existing_insurance = response || [];
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
                                page: params.page || 20,
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
                        self.bindInsurance(element_id, res);
                    return res.insurance_name;
                }
            },

            bindInsurance: function (element_id, res) {
                var self = this, payer_typ, coverage_level;
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
                        break;
                }
                self.updateResponsibleList({
                    payer_type: payer_type,
                    payer_id: res.id,
                    payer_name: res.insurance_name + '( ' + coverage_level + ' )',
                    billing_method: res.insurance_info && res.insurance_info.billingMethod ? res.insurance_info.billingMethod : null
                });
            },

            updateInsAddress: function (level, res) {
                var self = this;
                var insuranceInfo = res.insurance_info || null;
                var csz = insuranceInfo.City + (commonjs.checkNotEmpty(insuranceInfo.State) ? ',' + insuranceInfo.State : "") + (commonjs.checkNotEmpty(insuranceInfo.ZipCode) ? ',' + insuranceInfo.ZipCode : "");

                if (insuranceInfo && insuranceInfo.Address1 != '')
                    $('#lbl' + level + 'InsPriAddr').html(insuranceInfo.Address1);
                else
                    $('#lbl' + level + 'InsPriAddr').hide();

                if (csz != '')
                    $('#lbl' + level + 'InsCityStateZip').html(csz);
                else
                    $('#lbl' + level + 'InsCityStateZip').hide();

            },

            bindBillingSummary: function () {
                var self = this;
                $.ajax({
                    type: 'GET',
                    url: '/exa_modules/billing/claims/get_masterdetails',
                    data: {
                        patient_id: self.cur_patient_id,
                        company_id: 1
                    },
                    success: function (model, response) {
                        if (model && model.length) {
                            /* Billing providers drop down*/
                            var billingProviders = model[0].billingProvidersList;
                            var ddlBillingProvider = $('#ddlBillingProvider');
                            ddlBillingProvider.empty();
                            ddlBillingProvider.append($('<option/>', { value: "", text: "Select" }));
                            if (billingProviders && billingProviders.length > 0) {
                                for (var b = 0; b < billingProviders.length; b++) {
                                    ddlBillingProvider.append($('<option/>', {
                                        value: billingProviders[b].id,
                                        text: billingProviders[b].full_name
                                    }));
                                }
                            }

                            /* palce of service dropdown */
                            var ddlPosType = $('#ddlPOSType');
                            var posList = model[0].posList ? model[0].posList : [];
                            ddlPosType.empty();
                            ddlPosType.append($('<option/>', { value: "", text: "Select" }));
                            if (posList.length > 0) {
                                for (var e = 0; e < posList.length; e++) {
                                    ddlPosType.append($('<option/>', { value: posList[e].id, text: posList[e].code }).attr('data-code', posList[e].code));
                                }
                            }

                            /* relationship dropdown */
                            var ddlPriRelationShip = $('#ddlPriRelationShip');
                            var ddlSecRelationShip = $('#ddlSecRelationShip');
                            var ddlTerRelationShip = $('#ddlTerRelationShip');
                            var relationships = model[0].relationships || [];
                            $('#ddlPriRelationShip, #ddlSecRelationShip, #ddlTerRelationShip').empty();
                            $('#ddlPriRelationShip, #ddlSecRelationShip, #ddlTerRelationShip').append($('<option/>', {
                                value: "",
                                text: "Select"
                            }));
                            if (relationships.length > 0) {
                                for (var f = 0; f < relationships.length; f++) {
                                    ddlPriRelationShip.append($('<option/>', {
                                        value: relationships[f].id,
                                        text: relationships[f].description
                                    }));
                                    ddlSecRelationShip.append($('<option/>', {
                                        value: relationships[f].id,
                                        text: relationships[f].description
                                    }));
                                    ddlTerRelationShip.append($('<option/>', {
                                        value: relationships[f].id,
                                        text: relationships[f].description
                                    }));
                                }
                            }

                        }
                    },
                    error: function (model, response) {
                        commonjs.handleXhrError(model, response);
                    }
                })
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
                            self.priInsID = result.insurance_provider_id
                            self.priInsCode = result.insurance_code;
                            self.priInsName = result.insurance_name;
                            flag = 'Pri';
                            //commonjs.checkNotEmpty(result.subscriber_dob) ? self.dtpPriDOBDate.date(result.subscriber_dob) : self.dtpPriDOBDate.clear();
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
                            self.secInsID = result.insurance_provider_id
                            self.secInsCode = result.insurance_code;
                            self.SecInsName = result.insurance_name;
                            flag = 'Sec';
                            //commonjs.checkNotEmpty(result.subscriber_dob) ? self.dtpSecDOBDate.date(result.subscriber_dob) : self.dtpSecDOBDate.clear();
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
                            self.terInsID = result.insurance_provider_id
                            self.terInsCode = result.insurance_code;
                            self.terInsName = result.insurance_name;
                            flag = 'Ter';
                            //commonjs.checkNotEmpty(result.sub_dob) ? self.dtpTerDOBDate.date(result.sub_dob) : self.dtpTerDOBDate.clear();
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
                    $('#select2-ddl' + flag + 'Insurance-container').html(result.insurance_name);
                    $('#chk' + flag + 'AcptAsmt').prop('checked', result.assign_benefits_to_patient == "true");
                    $('#lbl' + flag + 'InsPriAddr').html(result.ins_pri_address);
                    var csz = result.ins_city + (commonjs.checkNotEmpty(result.ins_state) ? ',' + result.ins_state : "") + (commonjs.checkNotEmpty(result.ins_zip_code) ? ',' + result.ins_zip_code : "");
                    $('#lbl' + flag + 'InsCityStateZip').html(csz);
                    $('#lbl' + flag + 'InsPriAddr').show()
                    $('#lbl' + flag + 'InsCityStateZip').show()
                    $('#txt' + flag + 'PolicyNo').val(result.policy_number);
                    $('#txt' + flag + 'GroupNo').val(result.group_number);
                    //$('#ddl' + flag + 'PlanName').val(result.plan_name);
                    $('#ddl' + flag + 'EmpStatus').val(result.subscriber_employment_status_id);
                    $('#ddl' + flag + 'RelationShip').val(result.subscriber_relationship_id);
                    $('#txt' + flag + 'SubFirstName').val(result.subscriber_firstname);
                    $('#txt' + flag + 'MiddleName').val(result.subscriber_middlename);
                    $('#txt' + flag + 'SubLastName').val(result.subscriber_lastname);
                    $('#txt' + flag + 'SubSuffix').val(result.subscriber_name_suffix);
                    $('#ddl' + flag + 'Gender').val(result.subscriber_gender);
                    $('#txt' + flag + 'SubPriAddr').val(result.subscriber_address_line1);
                    $('#txt' + flag + 'SubSecAddr').val(result.subscriber_address_line2);
                    $('#txt' + flag + 'City').val(result.subscriber_city);
                    $('#txt' + flag + 'State').val(result.subscriber_state);
                    $('#txt' + flag + 'ZipCode').val(result.subscriber_zipcode);

                }
            },

            setClaimDetails: function () {
                var self = this;
                var claim_model = {}, billingMethod;
                self.claimModel = new newClaimModel();
                claim_model.insurances = [];

                var currentResponsible = _.find(self.responsible_list, d => d.payer_type == $('#ddlResponsible').val());
                var currentPayer_type = $('#ddlResponsible').val().split('_')[0];
                var facility_id = $('#ddlFacility option:selected').val() != '' ? parseInt($('#ddlFacility option:selected').val()) : null;
                if (currentPayer_type == "PIP") {
                    billingMethod = currentResponsible.billing_method == 'PC' ? 'paper_claim' : 'electronic_billing'
                }
                else if (currentPayer_type == "PPP")
                    billingMethod = 'patient_payment';
                else
                    billingMethod = 'direct_billing';
                var primary_insurance_details = {
                    claim_insurance_id: self.priClaimInsID ? parseInt(self.priClaimInsID) : null,
                    patient_id: self.cur_patient_id || null,
                    insurance_provider_id: self.priInsID ? parseInt(self.priInsID) : null,
                    subscriber_relationship_id: $('#ddlPriRelationShip option:selected').val() != '' ? parseInt($('#ddlPriRelationShip option:selected').val()) : null,
                    subscriber_employment_status_id: $('#ddlPriEmpStatus option:selected').val() || null,
                    subscriber_dob: $('#txtPriDOB').val() != '' ? self.convertToTimeZone(facility_id, moment($('#txtPriDOB').val()).format('YYYY-MM-DD')) : null,
                    coverage_level: 'primary',
                    policy_number: $('#txtPriPolicyNo').val(),
                    group_number: $('#txtPriGroupNo').val(),
                    //plan_name: $('#ddlPriPlanName option:selected').val() || null,
                    subscriber_firstname: $('#txtPriSubFirstName').val(),
                    subscriber_lastname: $('#txtPriSubLastName').val(),
                    subscriber_middlename: $('#txtPriSubMiName').val(),
                    subscriber_name_suffix: $('#txtPriSubSuffix').val(),
                    subscriber_gender: 'Female',//$('#ddlPriGender option:selected').val() || null,
                    subscriber_address_line1: $('#txtPriSubPriAddr').val(),
                    subscriber_address_line2: $('#txtPriSubSecAddr').val(),
                    subscriber_city: $('#txtPriCity').val(),
                    subscriber_state: 'TN',//$('#ddlPriState option:selected').val() || null,
                    subscriber_zipcode: $('#txtPriZipCode').val() != '' ? parseInt($('#txtPriZipCode').val()) : null,
                    assign_benefits_to_patient: $('#chkPriAcptAsmt').prop("checked"),
                    medicare_insurance_type_code: null,
                    is_deleted: self.priClaimInsID && self.priInsID == '' ? true : false
                },
                    secondary_insurance_details = {
                        claim_insurance_id: self.secClaimInsID ? parseInt(self.secClaimInsID) : null,
                        patient_id: self.cur_patient_id || null,
                        insurance_provider_id: self.secInsID ? parseInt(self.secInsID) : null,
                        subscriber_relationship_id: $('#ddlSecRelationShip option:selected').val() != '' ? parseInt($('#ddlSecRelationShip option:selected').val()) : null,
                        subscriber_employment_status_id: $('#ddlSecEmpStatus option:selected').val() || null,
                        coverage_level: 'secondary',
                        policy_number: $('#txtSecPolicyNo').val(),
                        group_number: $('#txtSecGroupNo').val(),
                        //plan_name: $('#ddlSecPlanName option:selected').val() || null,
                        subscriber_firstname: $('#txtSecSubFirstName').val(),
                        subscriber_lastname: $('#txtSecSubLastName').val(),
                        subscriber_middlename: $('#txtSecSubMiName').val(),
                        subscriber_name_suffix: $('#txtSecSubSuffix').val(),
                        subscriber_gender: 'Female',//$('#ddlPriGender option:selected').val() || null,
                        subscriber_address_line1: $('#txtSecSubPriAddr').val(),
                        subscriber_address_line2: $('#txtSecSubSecAddr').val(),
                        subscriber_city: $('#txtSecCity').val(),
                        subscriber_zipcode: $('#txtSecZipCode').val() != '' ? parseInt($('#txtSecZipCode').val()) : null,
                        subscriber_state: 'TN',//$('#ddlPriState option:selected').val() || null,
                        assign_benefits_to_patient: $('#chkSecAcptAsmt').prop("checked"),
                        subscriber_dob: $('#txtSecDOB').val() != '' ? self.convertToTimeZone(facility_id, moment($('#txtSecDOB').val()).format('YYYY-MM-DD')) : null,
                        medicare_insurance_type_code: $('#selectMedicalPayer option:selected').val() != '' ? parseInt($('#selectMedicalPayer option:selected').val()) : null,
                        is_deleted: self.secClaimInsID && self.secInsID == '' ? true : false
                    },
                    teritiary_insurance_details = {
                        claim_insurance_id: self.terClaimInsID ? parseInt(self.terClaimInsID) : null,
                        patient_id: self.cur_patient_id || null,
                        insurance_provider_id: self.terInsID ? parseInt(self.terInsID) : null,
                        coverage_level: 'tertiary',
                        subscriber_relationship_id: $('#ddlTerRelationShip option:selected').val() != '' ? parseInt($('#ddlTerRelationShip option:selected').val()) : null,
                        policy_number: $('#txtTerPolicyNo').val(),
                        group_number: $('#txtTerGroupNo').val(),
                        //plan_name: $('#ddlTerPlanName option:selected').val() || null,
                        subscriber_employment_status_id: $('#ddlTerEmpStatus option:selected').val() || null,
                        subscriber_firstname: $('#txtTerSubFirstName').val(),
                        subscriber_lastname: $('#txtTerSubLastName').val(),
                        subscriber_middlename: $('#txtTerSubMiName').val(),
                        subscriber_name_suffix: $('#txtTerSubSuffix').val(),
                        subscriber_gender: 'Female',//$('#ddlPriGender option:selected').val() || null,
                        subscriber_address_line1: $('#txtTerSubPriAddr').val(),
                        subscriber_address_line2: $('#txtTerSubSecAddr').val(),
                        subscriber_city: $('#txtTerCity').val(),
                        subscriber_zipcode: $('#txtTerZipCode').val() != '' ? parseInt($('#txtTerZipCode').val()) : null,
                        subscriber_state: 'TN',//$('#ddlPriState option:selected').val() || null,
                        assign_benefits_to_patient: $('#chkTerAcptAsmt').prop("checked"),
                        subscriber_dob: $('#txtTerDOB').val() != '' ? self.convertToTimeZone(facility_id, moment($('#txtTerDOB').val()).format('YYYY-MM-DD')) : null,
                        medicare_insurance_type_code: null,
                        is_deleted: self.terClaimInsID && self.terInsID == '' ? true : false
                    }
                if (self.is_primary_available || self.priClaimInsID)
                    claim_model.insurances.push(primary_insurance_details);
                if (self.is_secondary_available || self.secClaimInsID)
                    claim_model.insurances.push(secondary_insurance_details);
                if (self.is_tertiary_available || self.terClaimInsID)
                    claim_model.insurances.push(teritiary_insurance_details);
                claim_model.claims = {
                    claim_id :self.claim_Id,
                    company_id: app.companyID,
                    facility_id: facility_id,
                    patient_id: parseInt(self.cur_patient_id) || null,
                    billing_provider_id: $('#ddlBillingProvider option:selected').val() != '' ? parseInt($('#ddlBillingProvider option:selected').val()) : null,
                    rendering_provider_contact_id: self.ACSelect && self.ACSelect.readPhy ? self.ACSelect.readPhy.contact_id : null,
                    referring_provider_contact_id: self.ACSelect && self.ACSelect.refPhy ? self.ACSelect.refPhy.contact_id : null,
                    ordering_facility_id: $('#ddlOrdFacility option:selected').val() != '' ? parseInt($('#ddlOrdFacility option:selected').val()) : null,
                    place_of_service_id: $('#ddlPOSType option:selected').val() != '' ? parseInt($('#ddlPOSType option:selected').val()) : null,
                    billing_code_id: $('#ddlBillingCode option:selected').val() != '' ? parseInt($('#ddlBillingCode option:selected').val()) : null,
                    billing_class_id: $('#ddlBillingClass option:selected').val() != '' ? parseInt($('#ddlBillingClass option:selected').val()) : null,
                    created_by: 1,
                    claim_dt: $('#txtClaimDate').val() != '' ? self.convertToTimeZone(facility_id, moment($('#txtClaimDate').val()).format('YYYY-MM-DD hh:mm a')) : null,
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
                    frequency: $('#ddlFrequencyCode option:selected').val() != '' ? $('#ddlFrequencyCode option:selected').val() != '' : null,
                    is_auto_accident: $('#chkAutoAccident').is(':checked'),
                    is_other_accident: $('#chkOtherAccident').is(':checked'),
                    is_employed: $('#chkEmployment').is(':checked'),
                    service_by_outside_lab: $('#chkOutSideLab').is(':checked'),
                    claim_status_id: $('#ddlClaimStatus option:selected').val() != '' ? parseInt($('#ddlClaimStatus option:selected').val()) : null,
                    primary_patient_insurance_id: self.priClaimInsID ? parseInt(self.priClaimInsID) : null,
                    secondary_patient_insurance_id: self.secClaimInsID ? parseInt(self.secClaimInsID) : null,
                    tertiary_patient_insurance_id: self.terClaimInsID ? parseInt(self.terClaimInsID) : null
                    
                }

                /*Setting claim charge details*/
                claim_model.charges = [];
                $('#tBodyCharge').find('tr').each(function (index, rowObject) {
                    var id = $(this).attr('data_row_id');
                    var cpt_code_id = $('#select2-txtCptCode_' + id + '-container').attr('data_id');
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
                        modifier1_id: null,
                        modifier2_id: null,
                        modifier3_id: null,
                        modifier4_id: null,
                        bill_fee: parseFloat($('#txtBillFee_' + id).val()) || null,
                        allowed_amount: parseFloat($('#txtAllowedFee_' + id).val()),
                        units: parseFloat($('#txtUnits_' + id).val()),
                        created_by: 1,
                        authorization_no: $('#txtAuthInfo_' + id).val() || null,
                        charge_dt: self.cur_study_date || null,
                        study_id: rowData.study_id || null,
                        is_deleted: false
                    });
                });

                // Assign If any charges removed
                claim_model.removed_charges = self.removedCharges || [];

                /*Setting ICD pointers details*/
                claim_model.claim_icds = self.claimICDLists || [];

                // set claims details
                self.claimModel.set({
                    insurances: claim_model.insurances,
                    charges: claim_model.charges,
                    claims: claim_model.claims,
                    claim_icds: claim_model.claim_icds,
                    removed_charges: claim_model.removed_charges
                });

            },

            saveClaimDetails: function () {
                var self = this, saveButton = $('#btnSaveClaim');

                //saveButton.attr('disabled', true);
                if (self.validateClaimData()) {
                    self.setClaimDetails();
                    commonjs.showLoading();
                    if (self.isEdit) {
                        this.claimModel.set({ id: self.claim_Id })
                    }
                    // save function
                    self.claimModel.save({}, {
                        success: function (model, response) {
                            //if (response && response.length > 0) {
                            alert('Claim Created successfully');
                            $('#site_modal_div_container').empty().hide();
                            //}
                        },
                        error: function (model, response) {
                            commonjs.handleXhrError(model, response);
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
                    return false;
                }

                if (!$('#ddlFacility').val()) {

                    commonjs.showWarning("messages.warning.claims.selectfacility");
                    return false;
                }

                if (!$('#ddlBillingProvider').val()) {

                    commonjs.showWarning("messages.warning.claims.selectbillingProvider");
                    return false;
                }

                /* Insurance section */
                var mandatory_fields = {
                    primaryfields: [
                        $('#txtPriPolicyNo').val(),
                        $('#txtPriSubFirstName').val(),
                        $('#txtPriSubLastName').val(),
                        $('#ddlPriGender option:selected').val(),
                        $('#txtPriSubPriAddr').val(),
                        $('#ddlPriRelationShip option:selected').val(),
                        $('#ddlPriEmpStatus option:selected').val(),
                        $('#txtPriDOB').val()
                    ],
                    secondaryfields: [
                        $('#txtSecPolicyNo').val(),
                        $('#txtSecSubFirstName').val(),
                        $('#txtSecSubLastName').val(),
                        $('#ddlSecGender option:selected').val(),
                        $('#txtSecSubPriAddr').val(),
                        $('#ddlSecRelationShip option:selected').val(),
                        $('#ddlSecEmpStatus option:selected').val(),
                        $('#txtSecDOB').val()
                    ],
                    tertiaryfields: [
                        $('#txtTerPolicyNo').val(),
                        $('#txtTerSubFirstName').val(),
                        $('#txtTerSubLastName').val(),
                        $('#ddlTerGender option:selected').val(),
                        $('#txtTerSubPriAddr').val(),
                        $('#ddlTerRelationShip option:selected').val(),
                        $('#ddlSecEmpStatus option:selected').val(),
                        $('#txtTerDOB').val()
                    ]
                }

                function checkEmpty(val) {
                    return val == '';
                }

                if (self.priInsID || !mandatory_fields.primaryfields.every(checkEmpty)) {

                    if (mandatory_fields.primaryfields.indexOf('') > -1 || mandatory_fields.primaryfields.indexOf(null) > -1) {
                        commonjs.showWarning("messages.warning.claims.priInsValidation");
                        return false;
                    }
                    if ($('#ddlPriInsurance').val() == '') {
                        commonjs.showWarning("Please select primary insurance");
                        return false;
                    }
                    else
                        self.is_primary_available = true;
                }
                if (self.secInsID || !mandatory_fields.secondaryfields.every(checkEmpty)) {
                    if (!self.priInsID) {

                        commonjs.showWarning("messages.warning.claims.priMissingValidation");
                        return false;
                    }
                    else {

                        if (mandatory_fields.secondaryfields.indexOf('') > -1 || mandatory_fields.secondaryfields.indexOf(null) > -1) {

                            commonjs.showWarning("messages.warning.claims.secInsValidation");
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

                        commonjs.showWarning("messages.warning.claims.secMissingValidation");
                        return false;
                    }
                    else {

                        if (mandatory_fields.tertiaryfields.indexOf('') > -1 || mandatory_fields.tertiaryfields.indexOf(null) > -1) {

                            commonjs.showWarning("messages.warning.claims.terInsValidation");
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
                    commonjs.showWarning("messages.warning.claims.chargeValidation", 'largewarning');
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
                    commonjs.showWarning("messages.warning.claims.missingClaimStatus");
                    return false;
                }
                if (!$('#ddlResponsible').val()) {
                    commonjs.showWarning("messages.warning.claims.missingResponsible");
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
                var _targetFlag = $(e.target).attr('id') == "ddlPriRelationShip" ? 'Pri' : ( $(e.target).attr('id') == "ddlSecRelationShip" ? 'Sec' : 'Ter' ) ;
                if (!subscriberFlag) {
                    this.patientmodel.fetch({
                        data: { id: patID},
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
                                //commonjs.checkNotEmpty(response.birth_date) ? self.dtpDOBDate.date(response.birth_date) : self.dtpDOBDate.clear();
                                self.homePhone = contactInfo.c1HomePhone;
                                self.workPhone = contactInfo.c1WorkPhone;
                                self.empStatus = contactInfo.empStatus;
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
                var relationalShip = $.trim($('#ddl'+flag+'RelationShip option:selected').text());
                $('#txt'+flag+'SubFirstName').val('');
                $('#txt'+flag+'SubLastName').val('');
                $('#txt'+flag+'SubMiName').val('');
                $('#txt'+flag+'SubSuffix').val('');
                $('#ddl'+flag+'Gender').val('');
                if(self.checkAddressDetails(flag)){
                    if(confirm("You Need to Change address details?")){
                        $('#txt'+flag+'SubPriAddr').val('');
                        $('#txt'+flag+'SubSecAddr').val('');
                        $('#txt'+flag+'City').val('');
                        $('#ddl'+flag+'State').val('');
                        $('#txt'+flag+'ZipCode').val('');
                    }
                }
                else{
                $('#txt'+flag+'SubPriAddr').val(self.address1);
                $('#txt'+flag+'SubSecAddr').val(self.address2);
                $('#txt'+flag+'City').val(self.city);
                $('#ddl'+flag+'State').val(self.state);
                $('#txt'+flag+'ZipCode').val(self.zipCode);
                }
                $('#ddl'+flag+'EmpStatus').val(self.empStatus);

                if (relationalShip.toLowerCase() == "self") {
                    $('#txt'+flag+'SubFirstName').val(self.firstName);
                    $('#txt'+flag+'SubLastName').val(self.lastName);
                    $('#txt'+flag+'SubMiName').val(self.mi);
                    $('#txt'+flag+'SubSuffix').val(self.suffix);
                    $('#ddl'+flag+'Gender').val(self.gender);
                }
                else 
                  document.querySelector('#txt'+flag+'DOB').value = ""
            },
            checkAddressDetails: function(flag)
            {
                var chkaddress1 = $('#txt'+flag+'Address1').val();
                var chkaddress2 =  $('#txt'+flag+'Address2').val();
                var chkcity =  $('#txt'+flag+'City').val();
                var chkstate =  $('#ddl'+flag+'State').val();
                var chkzipcode = $('#txt'+flag+'ZipCode').val();
                if(chkaddress1==''&& chkaddress2==''&&chkcity=='' && chkstate=='' && chkzipcode==''){
                    return false;}
                else{
                    return true;}
            }

        });
        return claimView;
    });

