define(['jquery',
'moment',
'underscore',
'backbone',
'models/claims',
'models/pager',
'models/patient-insurance',
'models/patient-details',
'text!templates/claims/claim-form.html',
'text!templates/claims/charge-row.html',
'collections/app/patientsearch',
'text!templates/app/patientSearchResult.html',
'text!templates/claims/claim-validation.html',
'text!templates/claims/icd9-icd10.html',
'text!templates/claims/patient-alert.html',
'views/app/payment-edit',
'collections/app/pending-payments',
'text!templates/claims/payment-row.html',
'shared/address',
'text!templates/claims/ahs_charges_today.html',
'text!templates/app/patient-recent-claims.html',
'views/claims/addInjuryDetails',
'views/claims/insuranceEligibility',
'sweetalert2',
'shared/claim-alerts'
],
    function ($,
        moment,
        _,
        Backbone,
        newClaimModel,
        modelPatientPager,
        modelPatientInsurance,
        patientModel,
        claimCreationTemplate,
        chargeRowTemplate,
        patientCollection,
        patSearchContent,
        claimValidation,
        icd9to10Template,
        patientAlertTemplate,
        editPaymentView,
        pendingPayments,
        paymentRowTemplate,
        address,
        patientChargesTemplate,
        patientClaimTemplate,
        injuryDetailsView,
        InsuranceEligibilityView,
        swal2,
        claimAlertsView
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
            patientChargesTemplate: _.template(patientChargesTemplate),
            patientClaimTemplate: _.template(patientClaimTemplate),
            chargeModel: [],
            providerSkillCodesCount:0,
            claimICDLists: [],
            existingPrimaryInsurance: [],
            existingSecondaryInsurance: [],
            existingTriInsurance: [],
            npiNo: '',
            federalTaxId: '',
            tradingPartnerId: '',
            ACSelect: { refPhy: {}, readPhy: {}, skillCodes: {}, patientAltAccNo: {} },
            icd9to10Template : _.template(icd9to10Template),
            responsible_list: [
                { payer_type: "PPP", payer_type_name: "patient", payer_id: null, payer_name: null },
                { payer_type: "PIP_P", payer_type_name: "primary_insurance", payer_id: null, coverage_level: "P", payer_name: null, billing_method: null },
                { payer_type: "PIP_S", payer_type_name: "secondary_insurance", payer_id: null, coverage_level: "S", payer_name: null, billing_method: null },
                { payer_type: "PIP_T", payer_type_name: "tertiary_insurance", payer_id: null, coverage_level: "T", payer_name: null, billing_method: null },
                { payer_type: "POF", payer_type_name: "ordering_facility", payer_id: null, payer_name: null },
                { payer_type: "RF", payer_type_name: "referring_provider", payer_id: null, payer_name: null },
                { payer_type: "PSF", payer_type_name: "service_facility_location", payer_id: null, payer_name: null }
            ],
            usermessage: {
                selectStudyRefProvider: 'Select Refer. Provider',
                selectStudyReadPhysician: 'Select Read. Provider',
                selectDiagnosticCode: 'Select Code',
                selectOrdFacility: 'Select Ordering Facility',
                selectCarrier: '',
                selectcptcode: "Select Cpt Code",
                selectcptdescription: "Select Cpt Description",
                selectSkillCodes:"Select Skill Code"
            },
            patientsPager: null,
            cszFieldMap: [{
                city: {
                    domId: 'txtPriCity',
                    infoKey: 'subscriber_city'
                },
                state: {
                    domId: 'ddlPriState',
                    infoKey: 'subscriber_state'
                },
                zipCode: {
                    domId: 'txtPriZipCode',
                    infoKey: 'subscriber_zipcode'
                },
                zipCodePlus: {
                    domId: 'txtPriZipPlus',
                    infoKey: 'subscriber_zipcode_plus'
                },
                country: {
                    domId: 'ddlPriCountry',
                    infoKey: 'subscriber_country_code'
                }
            },
            {
                city: {
                    domId: 'txtSecCity',
                    infoKey: 'subscriber_city'
                },
                state: {
                    domId: 'ddlSecState',
                    infoKey: 'subscriber_state'
                },
                zipCode: {
                    domId: 'txtSecZipCode',
                    infoKey: 'subscriber_zipcode'
                },
                zipCodePlus: {
                    domId: 'txtSecZipPlus',
                    infoKey: 'subscriber_zipcode_plus'
                },
                country: {
                    domId: 'ddlSecCountry',
                    infoKey: 'subscriber_country_code'
                }
            },
            {
                city: {
                    domId: 'txtTerCity',
                    infoKey: 'subscriber_city'
                },
                state: {
                    domId: 'ddlTerState',
                    infoKey: 'subscriber_state'
                },
                zipCode: {
                    domId: 'txtTerZipCode',
                    infoKey: 'subscriber_zipcode'
                },
                zipCodePlus: {
                    domId: 'txtTerZipPlus',
                    infoKey: 'subscriber_zipcode_plus'
                },
                country: {
                    domId: 'ddlTerCountry',
                    infoKey: 'subscriber_country_code'
                }
            }],
            patientTotalRecords: 0,
            patientAddress: {},
            priInsCode : '',
            isProviderChiropractor: false,
            isClaimStatusUpdated: false,
            claimTotalRecords: 0,
            chargeTotalRecords: 0,
            patientClaimsPager: null,
            claimResponsible: '',
            isSplitClaimEnabled: false,
            enableConfirmAlert: false,
            insuranceEligibilityView: {
                primary: null,
                secondary: null,
                tertiary: null
            },
            elIDs: {
                'primaryInsAddress1': '#txtPriSubPriAddr',
                'primaryInsAddress2': '#txtPriSubSecAddr',
                'primaryInsCountry': '#ddlPriCountry',
                'primaryInsCity': '#txtPriCity',
                'primaryInsState': '#ddlPriState',
                'primaryInsZipCode': '#txtPriZipCode',
                'primaryInsZipPlus': '#txtPriZipPlus'
            },
            events: {
                'click #chkEmployment': 'toggleWCBInjuryTypes'
            },

            initialize: function (options) {
                this.options = options;
                this.model = new newClaimModel();
                this.patInsModel = new modelPatientInsurance();

                this.createShortCut();
                var modelCollection = Backbone.Collection.extend({
                    model: Backbone.Model.extend({})
                });
                this.facilities = new modelCollection(commonjs.bindArray(commonjs.getActiveFacilities(), true, true));

                var country = address.getCountryByAlpha3Code(app.country_alpha_3_code);

                var states = country
                    ? country.provinces
                    : (app.states[ 0 ].app_states || []);

                this.states = new modelCollection(commonjs.bindArray(states, true));
                this.genders = new modelCollection(commonjs.bindArray(app.gender, true));
                this.countries = new modelCollection(app.countries);
                this.claimStatusList = new modelCollection(app.claim_status);
                this.billingCodesList = new modelCollection(app.billing_codes);
                this.billingClassList = new modelCollection(app.billing_classes);
                this.billingProviderList = new modelCollection(app.billing_providers);
                this.claimSubmissionCodes = new modelCollection(app.claim_submission_codes);
                this.patientsPager = new modelPatientPager();
                this.patientListcoll = new patientCollection();
                this.pendingPayments = new pendingPayments();
                this.patientClaimsPager = new modelPatientPager();
                this. screenCode = [];
                if(app.userInfo.user_type != 'SU'){
                    var rights = (window.appRights).init();
                    this.screenCode = rights.screenCode;
                }
                this.claimWorkBench = this.options && this.options.worklist || null;
                this.associatedCpts = [];
                this.associatedModifiers = [];
            },

            urlNavigation: function () { //To restrict the change in URL based on tab selection. Maintain Same URL for every tab in claim creation screen
                var self = this;
                if (!self.isEdit) {
                    history.go(-1);
                    return false
                }
            },

            getClaimChargeFieldDetails: function (billingRegionCode) {
                switch (billingRegionCode) {
                    case 'can_AB':
                        return {
                            pointers: [true, true, true, false],
                            modifiers: [true, true, true, false]
                        }
                    case 'can_BC':
                        return {
                            pointers: [true, true, true, false],
                            modifiers: [true, true, true, true]
                        }
                    case 'can_MB':
                        return {
                            pointers: [true, false, false, false],
                            modifiers: [true, true, true, true]
                        }
                    case 'can_ON':
                        return {
                            pointers: [true, true, true, true],
                            modifiers: [false, false, false, false]
                        }
                    default:
                        return {
                            pointers: [true, true, true, true],
                            modifiers: [true, true, true, true]
                        }
                }
            },

            render: function (isFrom) {
                var self = this;
                var claimSubmissionCodes = _.filter(self.claimSubmissionCodes.toJSON(), function (obj) {
                    return obj.country_code.toLowerCase() === app.country_alpha_3_code && obj.province_code === app.province_alpha_2_code
                });

                self.claimICDLists = [];
                this.rendered = true;
                self.isClaimStatusUpdated = false;
                commonjs.showDialog({
                    header: 'Claim Creation',
                    i18nHeader: 'shared.fields.claimCreation',
                    width: '95%',
                    height: '75%',
                    isFromClaim: true,
                    onHidden: function (options) {
                        var prevValidationResults = commonjs.previousValidationResults;

                        if (prevValidationResults && !options.fromValidate) {
                            if (prevValidationResults.isFromEDI) {
                                self.claimWorkBench.ediResponse(prevValidationResults.result);
                            } else if (prevValidationResults.isFromBC) {
                                self.claimWorkBench.bcResponse(prevValidationResults.result);
                            } else {
                                self.claimWorkBench.showValidationResult(prevValidationResults.result);
                            }
                        }
                        commonjs.closePatientChartWindow();

                        if (window.reportWindow) {
                            window.reportWindow.close();
                        }

                        if(self.isClaimStatusUpdated){
                            $("#btnClaimsRefresh").click();
                        }
                    },
                    html: this.claimCreationTemplate({
                        country_alpha_3_code: app.country_alpha_3_code,
                        province_alpha_2_code: app.province_alpha_2_code,
                        patient_name: self.cur_patient_name,
                        account_no: self.cur_patient_acc_no,
                        dob: self.cur_patient_dob,
                        facilities: self.facilities.toJSON(),
                        genders: self.genders.toJSON(),
                        states: self.states.toJSON(),
                        countries: self.countries.toJSON(),
                        claimStatusList: self.claimStatusList.toJSON(),
                        billingCodesList: self.billingCodesList.toJSON(),
                        billingClassList: self.billingClassList.toJSON(),
                        billingProviderList: self.billingProviderList.toJSON(),
                        submissionCodes: claimSubmissionCodes,
                        posList: app.places_of_service || [],
                        relationshipList: app.relationship_status || [],
                        chargeList: self.claimChargeList || [],
                        injuryList: self.injuryDetailList || [],
                        paymentList: self.paymentList,
                        billingRegionCode: app.billingRegionCode,
                        currentDate: self.studyDate === undefined && self.cur_study_date || self.studyDate,
                        chargeField : self.getClaimChargeFieldDetails(app.billingRegionCode || ''),
                        wcbAreaCode: app.wcb_area_code,
                        wcbNatureCode: app.wcb_nature_code,
                        isSplitClaim: app.isMobileBillingEnabled,
                        delayReasons: app.delay_reasons,
                        can_ab_claim_status: commonjs.can_ab_claim_status,
                        can_ab_wcb_claim_status: commonjs.can_ab_wcb_claim_status,
                        isMobileBillingEnabled: app.isMobileBillingEnabled,
                        isMobileRadEnabled: app.settings.enableMobileRad
                    })
                });

                if(app.isMobileBillingEnabled && app.settings.enableMobileRad) {
                    self.claimResponsible = '(Ordering Facility)';
                    $('#lblOrdFacility').text(commonjs.geti18NString('shared.fields.orderingFacility'));
                } else {
                    self.claimResponsible = '(Service Facility)';
                    $('#lblOrdFacility').text(commonjs.geti18NString('billing.fileInsurance.serviceFacilityLocation'));
                }
                commonjs.updateCulture(app.currentCulture, commonjs.beautifyMe);

                this.renderEligibilityViews();

                address.bindCountrySelectToCityStateZip('#divPriAddressInfo', {}, this.cszFieldMap[0]);
                if (app.country_alpha_3_code !== 'can') {
                    address.bindCountrySelectToCityStateZip('#divSecAddressInfo', {}, this.cszFieldMap[1]);
                    address.bindCountrySelectToCityStateZip('#divTerAddressInfo', {}, this.cszFieldMap[2]);
                }
                if (app.billingRegionCode === 'can_ON' || app.country_alpha_3_code === 'usa') {
                    $('label[for=txtPriPolicyNo]').append("<span class='Required' style='color: red;padding-left: 5px;'>*</span>");
                }

                if (app.billingRegionCode === 'can_ON') {
                    $('#txtPriGroupNo').attr('maxlength', 2);
                }
                var billingRegionCodes = ['can_AB', 'can_MB', 'can_BC'];

                var nextSplitClaimSpan = $('.nextSplitClaimSpan');
                var splitClaimIds = self.options && self.options.split_claim_ids;

                if (splitClaimIds && splitClaimIds.length) {
                    var msg = commonjs.geti18NString('billing.claims.splitClaim');

                    splitClaimIds.forEach(function(value, index) {
                        if (index === 0) {
                            msg = msg.replace('$CLAIM_ID', '<a href="javascript: void(0)" id="nextSplitClaim_' + value + '">' + value + '</a>' + (splitClaimIds.length !== 1 ? '$CLAIM_ID' : '' ));
                            return;
                        }

                        if (index === splitClaimIds.length - 1) {
                            msg = msg.replace('$CLAIM_ID', ' and <a href="javascript: void(0)" id="nextSplitClaim_' + value + '">' + value + '</a>');
                            return;
                        }

                        msg = msg.replace('$CLAIM_ID', ', <a href="javascript: void(0)" id="nextSplitClaim_' + value + '">' + value + '</a>$CLAIM_ID');
                    });

                    nextSplitClaimSpan.removeClass('hidden').append(msg);
                    splitClaimIds.forEach(function(value) {
                        $('#nextSplitClaim_' + value).off().click(function(){
                            self.openSplitClaim($(this).text());
                        });
                    });
                } else {
                    nextSplitClaimSpan.addClass('hidden');
                }

                $('#txtClaimResponsibleNotes').prop('disabled', !(billingRegionCodes.indexOf(app.billingRegionCode) > -1 || app.country_alpha_3_code === 'usa'));

                //EXA-18273 - Move diagnostics codes section under claim for alberta billing
                if(app.billingRegionCode === 'can_AB') {
                    $('#diagnosticsCodes').detach().appendTo('#claimSection').addClass('col-lg-12');
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
                    $('#siteModal .close')[0].title = 'Esc';
                    $('#siteModal .btn-secondary')[0].title = 'Esc';
                    self.bindDetails();
                    self.bindTabMenuEvents();
                }

                if(self.screenCode.indexOf('CLVA') > -1) // this is for validate button rights
                    $('#btnValidateClaim').attr('disabled', true)

                if(self.screenCode.indexOf('PATR') > -1)
                    $('#btPatientDocuemnt').attr('disabled', true)

                if (self.screenCode.indexOf('ECST') > -1) { // If the user don't have rights for edit claim status, claim status change action is disabled.
                    $('#ddlClaimStatus').prop({'disabled': true, 'title': commonjs.geti18NString("messages.errors.accessdenied")});
                }

                self.initializeDateTimePickers();
                $('#modal_div_container').animate({ scrollTop: 0 }, 100);

                // Append dynamic address details for canadian config
                self.bindAddressInfo('Pri');
                if (app.country_alpha_3_code !== 'can') {
                    self.bindAddressInfo('Sec');
                    self.bindAddressInfo('Ter');
                }

                self.bindPatientRecentSearchResult();
            },

            /**
             * Render all of the eligibility views
             */
            renderEligibilityViews: function () {
                var order_id = ~~_.get(this, "options.order_id");

                if (order_id > 0) {
                    this.renderEligibilityView("primary")
                        .renderEligibilityView("secondary")
                        .renderEligibilityView("tertiary");
                }

                return this;
            },

            /**
             * Render an eligibility view
             *
             * @param {string} coverage_level
             */
            renderEligibilityView: function (coverage_level) {
                if (!this.hasEligibilityPermission()) {
                    return this;
                }

                if (coverage_level) {
                    this.insuranceEligibilityView[coverage_level] = new InsuranceEligibilityView({
                        el: "#divEligibility" + _.capitalize(coverage_level)
                    });

                    this.insuranceEligibilityView[coverage_level].render({
                        order_id: this.options.order_id,
                        coverage_level: coverage_level,
                        show_service_type: this.showServiceType(),
                        show_benefits_on_date: this.showBenefitsOnDate(),
                        show_eligibility_status: true,
                        container_class: "col-xs-12",
                        disabled: !app.checkPermissionCode("ELIG"),
                        claim_id: this.claim_Id || 0
                    });
                }

                return this;
            },

            /**
             * Indicates if user has permission for Eligibility or Eligibility (Read only)
             *
             * @returns {boolean}
             */
            hasEligibilityPermission: function () {
                return app.checkPermissionCode("ELIG") || app.checkPermissionCode("ELGR");
            },

            /**
             * Indicates if the Benefits On Date date picker should be rendered
             *
             * @returns {boolean}
             */
            showBenefitsOnDate: function () {
                return !app.insImagineSoftware;
            },

            /**
             * Indicates if the Service Type selector should be rendered
             *
             * @returns {boolean}
             */
            showServiceType: function () {
                return (
                    app.country_alpha_3_code !== "can" &&
                    !app.insImagineSoftware
                );
            },

            /**
             * Bind patient recent search result from bucket
             *
             * Copypasta from web... public/javascripts/views/patient/patientsearchLite.js
             */
            bindPatientRecentSearchResult: function () {
                var self = this;

                // Show recent patient search result
                var patientRecentSearchDetails = localStorage.getItem('patientRecentSearchResult');
                var $results = $('#divPatientRecentSearchResults');
                var $noResults = $('#divNoRecentPatients');

                $results.empty();
                patientRecentSearchDetails = JSON.parse(patientRecentSearchDetails) || [];

                if (!patientRecentSearchDetails.length) {
                    $noResults.show();
                    $('#ulChangeMenu').hide();
                } else {
                    // Bind recent search patient template
                    $noResults.hide();
                    var content = '';
                    var patientList;

                    for (var j = patientRecentSearchDetails.length - 1; j >= 0; j--) {
                        patientList = patientRecentSearchDetails[j];
                        patientList.id = atob(patientList.id);
                        content += self.patSearchContentTemplate({ patient: patientList });
                    }
                    $results.html(content).show();

                    $('.selectionpatient').off().click(function (e) {
                        var $target = $(e.target || e.srcElement).closest('.studyList').length
                        if (!$target && $(e.target || e.srcElement).attr('id') != 'btnClaimWStudy' && $(e.target || e.srcElement).attr('id') != 'btnClaimWOStudy') {
                            self.selectPatient(e);
                            e.stopPropagation();
                        }
                    });
                }
            },

            initializeDateTimePickers: function () {
                var self = this;

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
                commonjs.bindDateTimePicker('divDOF', { format: 'L' });

                if (app.country_alpha_3_code !== 'can') {
                    self.secDOB = commonjs.bindDateTimePicker('divSecDOB', { format: 'L' });
                    self.secDOB.date();
                    self.terDOB = commonjs.bindDateTimePicker('divTerDOB', { format: 'L' });
                    self.terDOB.date();
                }
                commonjs.isMaskValidate();

            },

            bindDetails: function (doHide) {
                var self = this;

                // set all Insurance auto_complete
                self.bindInsuranceAutocomplete('ddlPriInsurance');
                self.bindInsuranceAutocomplete('ddlSecInsurance');
                self.bindInsuranceAutocomplete('ddlTerInsurance');

                self.setProviderAutoComplete('PR'); // rendering provider auto complete
                self.setProviderAutoComplete('RF'); // referring provider auto complete
                self.setDiagCodesAutoComplete();
                self.setOrderingFacilityAutoComplete();
                self.setSkillCodesAutoComplete();
                self.initWCBCodesAutoComplete('wcbNatureOfInjury');
                self.initWCBCodesAutoComplete('wcbAreaOfInjury');
                self.setPatientAltAccountsAutoComplete(); // Patient alternate account number /
                if (!self.isEdit)
                    self.bindExistingPatientInsurance(doHide);

                self.injuryDetailsView = new injuryDetailsView({
                    el: '#tBodyInjury'
                });
                self.injuryDetailsView.render(self.injuryModel || []);

            },

            initializeClaimEditForm: function (isFrom) {
                var self = this;
                if (!this.rendered) {
                    this.render('claim');
                }

                $('#btnSaveClaim').prop('disabled', !isFrom || isFrom === 'reload');

                self.bindclaimFormEvents(isFrom);
            },

            "referralCodesMap": {
                "A": "Referral Req'd by Med, Pod, Midwife, can't be self",
                "B": "Req'd Med,Pod,Dent,NurPrac,Chiro,Midwife,Opto can't be Self-",
                "C": "Referral Req'd by Med, Dental, Podiatry, chiro",
                "D": "RefReqd MEDDS,CHIRDS,DENTDS,PODDS,NRPR,PHTH,SelfRef",
                "E": "Referral required by Med or Dental",
                "F": "Ref Req'd by Med, Dent, Pod, Midwife, can be self",
                "G": "Req'd Med,Midwife,NurPrac,Chiro-can't be Self-Ref",
                "H": "Req'd Med,Midwife,NurPrac,Chiro-can't be Self-Ref",
                "I": "Req'd Med,NurPrac,Chiro-can't be Self-Ref",
                "J": "Req'd by COCTH PSCH SCWK PSNR SLPT can't be self",
                "K": "Req'd Med,Pod,Dent,NurPrac,Midwife,Chiro-can't be Self-Ref",
                "L": "Referral Req'd by Med, Optomery, can't be self",
                "M": "Referral Req'd by Medical, can't be self",
                "N": "No Referral Required",
                "O": "Referral Prac must have OTOL, NEUR, or NUSG skill",
                "P": "Ref Req'd Med,Dent,NursePrac,Pod, HSC is Med can be self-ref",
                "Q": "Ref Req'd Medical,Nurse Practitioner, Midwife - self ref OK",
                "R": "Reqd Med,Pod,Dent,NurPrac,Chiro,Midwife,Opto,Phys can't self",
                "S": "Referral Required - Self Referral is allowed",
                "T": "Referral Req'd by Podiatry - HSC must be Podiatry",
                "U": "Referral Req'd by Med, Podiatry, can't be self",
                "V": "Req'd Med,Pod,Dent,NurPrac,Midwife,Chiro,Phys-can't be self",
                "W": "Ref Req'd Medds,Dentds,NursePrac,Podds,Chirds -Self ref OK",
                "X": "Ref Req'd Med,Chiro,NursePrac,Pod-HSC is Med,can be self-ref",
                "Y": "RefReqd MEDDS,CHIRDS,PODDS HSC-EDDSonly,NRPR,PHTH,SelfRef",
                "Z": "Referral Required, Nurse Practitioner, can be self-ref"
            },

            getDeletedInjuryLevels: function() {
                if (app.billingRegionCode !== "can_AB" || $('#divInjury').is(':hidden')) {
                    return [];
                }

                var levels = [];

                switch (this.injuryDetailsView.injuryDetails.length) {
                    case 0:
                        levels.push('primary');
                        break;
                    case 1:
                        levels.push('secondary');
                        break;
                    case 2:
                        levels.push('tertiary');
                        break;
                    case 3:
                        levels.push('quaternary');
                        break;
                    case 4:
                        levels.push('quinary');
                        break;
                }

                return levels.join('~');
            },

            getPriorityLevel: function(index) {
                var priorityLevel = null;
                switch(index) {
                    case 0:
                        priorityLevel = 'primary';
                    break;
                    case 1:
                        priorityLevel = 'secondary';
                    break;
                    case 2:
                        priorityLevel = 'tertiary';
                    break;
                    case 3:
                        priorityLevel = 'quaternary';
                    break;
                    case 4:
                        priorityLevel = 'quinary';
                    break;
                    default:
                        priorityLevel = 'primary';
                    break;
                }

                return priorityLevel;
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
                self.injuryModel = [];
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
                        id: claim_Id,
                        patient_id: options.patient_id
                    },
                    success: function (model) {

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
                            self.phn = claimDetails.phn_acc_no;
                            self.patient_alt_acc_nos = claimDetails.patient_alt_acc_nos;
                            self.canAhsEncounterNo = claimDetails.can_ahs_encounter_no || 1;
                            $('.claimProcess').prop('disabled', false);
                            /* Bind claim charge Details - start */
                            $('#tBodyCharge').empty();
                            $('.claim-summary').remove();
                            claimDetails.claim_charges = claimDetails.claim_charges || [];
                            claimDetails.injury_details = claimDetails.injury_details || [];

                            self.claimChargeList = [];
                            self.injuryDetailList = [];
                            self.referralCodesList = [];

                            if (app.billingRegionCode === 'can_AB') {
                                $.each(claimDetails.injury_details, function (index, obj) {
                                    self.injuryDetailList.push(obj);
                                    self.injuryModel.push({
                                        id: obj.injury_detail_id || null,
                                        data_row_id: index,
                                        body_part_code: obj.body_part_code,
                                        orientation_code: obj.orientation_code,
                                        injury_id: obj.injury_id,
                                        priority_level: self.getPriorityLevel(index)
                                    });
                                });
                            }

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
                                    cpt_id: obj.cpt_id
                                });

                                if (app.billingRegionCode === 'can_AB'
                                    && claimDetails.billing_method === 'electronic_billing'
                                    && claimDetails.p_insurance_code.toLowerCase() !== 'wcb') {

                                    if ( obj.can_ahs_referral_code ) {
                                        self.referralCodesList.push({
                                            cpt_code: obj.cpt_code,
                                            can_ahs_referral_code: self.referralCodesMap[obj.can_ahs_referral_code]
                                        });
                                    }
                                    if ( obj.can_ahs_supporting_text_required ) {
                                        self.supportingTextRequired = true;
                                    }
                                }
                            });
                            self.identifyAssociatedCptsAndModifiers();

                            /* Bind claim charge Details - end */

                            //EXA-18273 - Bind Charges created on current date for a patient.
                            if(app.billingRegionCode === 'can_AB') {
                                self.getPatientCharges(self.cur_patient_id, self.claimChargeList);
                            }

                            if (commonjs.hasModalClosed() && isFrom === 'reload') {
                                commonjs.hideLoading();
                                return false;
                            }

                            if (isFrom === 'reclaim') {
                                self.options.patient_name = claimDetails.patient_name;
                                self.options.patient_id = claimDetails.patient_id;
                            }

                            self.rendered = false;
                            self.initializeClaimEditForm(isFrom);
                            /* Bind chargeLineItems events - started*/
                            if(self.screenCode.indexOf('DCLM') > -1) {
                                $('span[id^="spDeleteCharge"]').removeClass('removecharge');
                                $('span[id^="spDeleteCharge"]').css('color', '#DCDCDC');
                            }
                            self.assignLineItemsEvents();
                            self.assignModifierEvent();
                            app.modifiers_in_order = true;
                            commonjs.validateControls();
                            commonjs.isMaskValidate();
                            /* Bind chargeLineItems events - Ended */
                            self.addPatientHeaderDetails(claimDetails, 'edit')
                            self.disableElementsForProvince(claimDetails);

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

                            if (self.openedFrom === 'patientSearch' || commonjs.previousValidationResults)
                                $('.claimProcess').hide(); // hide Next/Prev btn if opened from patient search

                            // trigger blur event for update Total bill fee, balance etc.
                            $(".allowedFee, .billFee").blur();
                            $(".diagCodes").blur();

                            /*Bind ICD List if not canadian billing*/
                            claimDetails.claim_icd_data = claimDetails.claim_icd_data || [];
                            self.claimICDLists = [];
                            $('#ulSelectedDiagCodes').empty();
                            $('#hdnDiagCodes').val('');
                            claimDetails.claim_icd_data.forEach(function (obj) {
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
                            self.allExistingInsurances = existing_insurance;

                            self.npiNo = claimDetails.npi_no || '';
                            self.federalTaxId = claimDetails.federal_tax_id || '';

                            $.each(existing_insurance, function (index, value) {
                                if (value.is_active) {
                                    switch (value.coverage_level) {
                                        case 'primary':
                                            existingPrimaryInsurance.push(value);
                                            break;
                                        case 'secondary':
                                            existingSecondaryInsurance.push(value);
                                            break;
                                        case 'tertiary':
                                            existingTriInsurance.push(value);
                                            break;
                                    }
                                }
                            });


                            self.bindExistingInsurance(existingPrimaryInsurance, 'ddlExistPriIns')
                            self.bindExistingInsurance(existingSecondaryInsurance, 'ddlExistSecIns')
                            self.bindExistingInsurance(existingTriInsurance, 'ddlExistTerIns')
                            /* Edit claim bind Existing Insurance List - End */

                            $("#txtClaimDate").attr("disabled", "disabled");
                            $("#txtClaimCreatedDt").prop('disabled', true);

                            if (isFrom === 'reclaim' && app.country_alpha_3_code === 'can') {
                                self.getPatientAltAccNumber({
                                    id: claimDetails.patient_id
                                })
                                .done(function (response) {
                                    claimDetails.patient_alt_acc_nos = response;
                                    self.bindDefaultClaimDetails(claimDetails);
                                })
                                .fail(function(err) {
                                    commonjs.handleXhrError(err);
                                });
                            } else {
                                self.bindDefaultClaimDetails(claimDetails);
                            }

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
                                    $('label[for=txtPriPolicyNo]').append("<span class='Required' style='color: red;padding-left: 5px;'>*</span>");
                                }

                                if ( app.province_alpha_2_code === 'AB' ) {
                                    var referralCodes = self.referralCodesList.map(function (code) {
                                        return code.can_ahs_referral_code + ' (' + code.cpt_code + ')'
                                    });
                                    $('#referralCodeText').html(referralCodes.join('<br />'));
                                    if ( self.supportingTextRequired ) {
                                        $('#lblSupportingText').addClass('field-required');
                                        $('#txtSupportingText').attr('required', 'required');
                                    }
                                }
                            }

                            var editClaimAlerts = claimDetails.edit_claim_alerts || null;

                            if (isFrom !== 'reload' && editClaimAlerts) {
                                claimAlertsView.showClaimAlerts(editClaimAlerts);
                            }

                            self.toggleOtherClaimNumber();
                            self.toggleWCBInjuryTypes();

                        } else {
                            commonjs.showWarning('billing.era.claimNotExists');
                        }
                        commonjs.hideLoading();
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

            getPatientAltAccNumber: function (params) {
                return $.ajax({
                    url: '/exa_modules/billing/claims/claim/getPatientAltAccNumber',
                    type: "GET",
                    data: params
                });
            },

            fetchPlaceOfService: function (params) {
                return $.ajax({
                     url: "/getBillingProviderInfo",
                     type: "GET",
                     data: params
                 });
            },

            isServiceFacilityLocation: function(posCode) {
                var posMap = $("#ddlServiceFacilityLocation option:selected").val();
                return (
                    app.isMobileBillingEnabled
                    && app.settings.enableMobileRad
                    && posCode
                    && posMap
                    && posMap !== "OF"
                );
            },

            appendPOSOptions: function(posCode) {
                var options = [];
                var $ddlServiceFacilityLocation = $('#ddlServiceFacilityLocation');
                $ddlServiceFacilityLocation.empty();
                $ddlServiceFacilityLocation.append($('<option/>', { value: "", text: "Select" }));

                if (this.facilityId) {
                    options.push($('<option/>', {
                        value: 'F',
                        text: $('#ddlFacility option:selected').text()
                    }));
                }

                if (this.cur_patient_id) {
                    options.push($('<option/>', {
                        value: 'PR',
                        text: this.cur_patient_name
                    }));
                }

                if (this.ACSelect.refPhy.contact_id) {
                    options.push($('<option/>', {
                        value: 'OP',
                        text: this.ACSelect.refPhy.Desc
                    }));
                }

                if (['OFP', 'OF'].includes(posCode) && this.hasMatchingOrderingFacility()) {
                    options.push($('<option/>', {
                        value: posCode,
                        text: this.ordering_facility_name
                    }));
                }
                else {
                    if (this.ordering_facility_contact_id) {
                        options.push($('<option/>', {
                            value: 'OF',
                            text: this.ordering_facility_name
                        }));
                    }

                    if (this.ptn_ordering_facility_contact_id && !this.hasMatchingOrderingFacility()) {
                        options.push($('<option/>', {
                            value: 'OFP',
                            text: this.ptn_ordering_facility_name
                        }));
                    }
                }

                $ddlServiceFacilityLocation.append(options);

                if (posCode) {
                    $('#ddlServiceFacilityLocation').val(posCode);
                }

                if (posCode === 'OFP' && this.hasMatchingOrderingFacility()) {
                    $("#ddlClaimResponsible option[value='PSF']").remove();
                    return;
                }

                if (this.isServiceFacilityLocation(posCode)) {
                    this.updateResponsibleList({
                        payer_type: 'PSF',
                        payer_id: $('#ddlServiceFacilityLocation option:selected').val(),
                        payer_name: $('#ddlServiceFacilityLocation option:selected').text() + ' (Service Facility)'
                    }, null);
                }
            },

            /**
             * Indicates study and patient level ordering facilities are same or not
             *
             * @returns {boolean}
             */
            hasMatchingOrderingFacility: function() {
                return ~~this.ptn_ordering_facility_contact_id === ~~this.ordering_facility_contact_id;
            },

            createCptCodesUI: function(rowIndex) {
                $('#divChargeCpt_' + rowIndex)
                    .append($('<div/>', { id: "divCptCode_" + rowIndex }).addClass('pointerCursor select-container').attr('data-type', 'cpt')
                        .append($('<lable/>', { id: "lblCptCode_" + rowIndex }).addClass('cptcode cptIsExists select-container-label').attr('data-type', 'cpt').html("Select")
                                .mousemove(function(e){
                                    var msg = $(e.target).attr('data_code');
                                    $(e.target).attr('title', msg);
                                })));

                $('#divChargeCptDesc_' + rowIndex)
                    .append($('<div/>', { id: "divCptDescription_" + rowIndex }).addClass('pointerCursor select-container').attr('data-type', 'cptdesc')
                        .append($('<lable/>', { id: "lblCptDescription_" + rowIndex }).addClass('cptcode cptIsExists select-container-label').attr('data-type', 'cptdesc').html("Select")
                                .mousemove(function(e){
                                    var msg = $(e.target).attr('data_description');
                                    $(e.target).attr('title', msg);
                                })));
            },

            getPayToValue: function () {
                var payToValue = '';
                var baClaim = this.can_ahs_business_arrangement;
                var locumClaim = this.can_ahs_locum_arrangement;
                var baFacility = this.can_ahs_business_arrangement_facility;
                var locumProvider = this.can_ahs_locum_arrangement_provider;

                if ( baClaim ) {
                    if ( !locumClaim ) {
                        if ( baClaim == baFacility ) {
                            // Pay to practice using practice's submitter
                            payToValue = 'LOC_PP';
                        }
                        else if ( baClaim == locumProvider ) {
                            // Pay to locum using locum's submitter
                            payToValue = 'LOC_LL';
                        }
                    }
                    else {
                        if ( baClaim == baFacility && locumClaim == locumProvider ) {
                            // Pay to practice using locum's submitter
                            payToValue = 'LOC_PL';
                        }
                        else if ( baClaim == locumProvider && locumClaim == locumProvider ) {
                            // Pay to locum using practice's submitter
                            payToValue = 'LOC_LP';
                        }
                    }
                }
                else {
                    // Pay to practice using practice's submitter (default)
                    payToValue = 'LOC_PP';
                }

                return payToValue;
            },

            setBusinessArrangement: function ( payToValue ) {
                switch ( payToValue ) {
                    case 'LOC_PP':
                        this.can_ahs_business_arrangement = this.can_ahs_business_arrangement_facility;
                        this.can_ahs_locum_arrangement = null;
                        break;

                    case 'LOC_LL':
                        this.can_ahs_business_arrangement = this.can_ahs_locum_arrangement_provider;
                        this.can_ahs_locum_arrangement = null;
                        break;

                    case 'LOC_PL':
                        this.can_ahs_business_arrangement = this.can_ahs_business_arrangement_facility;
                        this.can_ahs_locum_arrangement = this.can_ahs_locum_arrangement_provider;
                        break;

                    case 'LOC_LP':
                        this.can_ahs_business_arrangement = this.can_ahs_locum_arrangement_provider;
                        this.can_ahs_locum_arrangement = this.can_ahs_business_arrangement_facility;
                        break;

                    default:
                        break;
                }
            },

            isPaymentTypeReadOnly: function ( statusId ) {
                var status = app.claim_status.find(function ( status ) {
                    return status.id == statusId;
                });

                if ( !status ) {
                    return false;
                }

                return /^PIF|OP|InsOP|PatOP|AOP$/.test(status.code);
            },

            bindDefaultClaimDetails: function (claim_data) {
                var self = this;

                /* Claim section start*/

                var renderingProviderFullName = claim_data.fac_reading_phy_full_name || claim_data.reading_phy_full_name;
                var renderingProviderNpi = claim_data.fac_reading_phy_full_name
                        ? claim_data.fac_rendering_prov_npi_no
                        : claim_data.rendering_prov_npi_no;

                if (renderingProviderFullName && renderingProviderNpi) {
                    renderingProviderFullName +=  ' ' + renderingProviderNpi;
                }

                var skillCode = claim_data.skill_code || self.usermessage.selectSkillCodes;
                var renderingProvider = renderingProviderFullName || self.usermessage.selectStudyReadPhysician;

                self.ordering_facility_name = claim_data.ordering_facility_name || claim_data.service_facility_name;
                var orderingFacilityName  = self.ordering_facility_name
                    ? self.ordering_facility_name + ' (' + claim_data.location + ')' + (claim_data.ordering_facility_type ? ' (' + claim_data.ordering_facility_type + ')' : '')
                    : self.usermessage.selectOrdFacility;

                var referringProviderNpi;
                var is_pri_ref_contact;

                if (claim_data.ordering_provider_contact_id) {
                    self.ACSelect.refPhy.contact_id = claim_data.ordering_provider_contact_id || null;
                    self.ACSelect.refPhy.Code = claim_data.ord_prov_code || null;
                    self.ACSelect.refPhy.Desc = claim_data.ord_prov_full_name;
                    referringProviderNpi = claim_data.ordering_prov_npi_no;
                    is_pri_ref_contact = claim_data.is_pri_ord_provider;
                } else {
                    self.ACSelect.refPhy.contact_id = claim_data.referring_provider_contact_id || null;
                    self.ACSelect.refPhy.Code = claim_data.ref_prov_code || null;
                    self.ACSelect.refPhy.Desc = claim_data.ref_prov_full_name;
                    referringProviderNpi = claim_data.referring_prov_npi_no;
                    is_pri_ref_contact = claim_data.is_pri_ref_provider;
                }

                var referringProviderFullName = self.ACSelect.refPhy.Desc;

                if (referringProviderFullName && referringProviderNpi) {
                    referringProviderFullName = referringProviderFullName + ' ' + referringProviderNpi;
                }

                var referringProvider;

                if (app.billingRegionCode !== 'can_AB') {
                    referringProvider = referringProviderFullName || self.usermessage.selectStudyRefProvider;
                } else {
                    referringProvider = is_pri_ref_contact
                        ? referringProviderFullName
                        : self.usermessage.selectStudyRefProvider;
                }

                self.ACSelect.readPhy.contact_id = claim_data.rendering_provider_contact_id || claim_data.fac_rendering_provider_contact_id || null;
                self.facility_rendering_provider_contact_id = claim_data.fac_rendering_provider_contact_id || null;
                self.study_rendering_provider_contact_id = claim_data.rendering_provider_contact_id || null;
                self.ACSelect.skillCodes.ID = claim_data.can_ahs_skill_code_id || null;

                if ((!claim_data.rendering_provider_contact_id || !claim_data.can_ahs_skill_code_id) && claim_data.fac_rendering_provider_contact_id ) {
                    self.toggleSkillCodeSection();
                }

                self.ordering_facility_id = claim_data.ordering_facility_id || claim_data.service_facility_id || null;
                self.ordering_facility_contact_id = claim_data.ordering_facility_contact_id || claim_data.service_facility_contact_id || null;

                self.ptn_ordering_facility_contact_id = claim_data.ptn_ordering_facility_contact_id || null;
                self.ptn_ordering_facility_name = claim_data.ptn_ordering_facility_name;

                self.billing_type = claim_data.billing_type || 'global';
                var patientAltAaccNo;
                if (claim_data.patient_alt_acc_nos && app.country_alpha_3_code === 'can') {
                    patientAltAaccNo = claim_data.can_issuer_id
                        ? self.getDefaultPatientAltAccNoById(claim_data.patient_alt_acc_nos, claim_data.can_issuer_id)
                        : self.getDefaultPatientAltAccNo(claim_data.patient_alt_acc_nos);
                }

                $('#ddlBillingProvider').val(claim_data.fac_billing_provider_id || claim_data.billing_provider_id || '');
                $('#ddlDelayReasons').val(claim_data.delay_reason_id || '');
                $('#ddlFacility').val(claim_data.facility_id || '');
                $('#select2-ddlRenderingProvider-container').html(renderingProvider);
                $('#select2-ddlSkillCodes-container').html(skillCode);
                $('#select2-ddlReferringProvider-container').html(referringProvider);
                $('#select2-ddlOrdFacility-container').html(orderingFacilityName);
                $('#select2-ddlPhnUli-container').html(patientAltAaccNo);

                // Alberta
                if ( claim_data.can_ahs_pay_to_code ) {
                    $('#ddlPayToCode').val(claim_data.can_ahs_pay_to_code).change();
                }
                $('#txtPayToUli').val(claim_data.can_ahs_pay_to_uli);
                self.blurPayToUli(claim_data.can_ahs_pay_to_uli);

                $('#chkClaimedAmountIndicator').prop('checked', claim_data.can_ahs_claimed_amount_indicator);
                $('#chkConfidential').prop('checked', claim_data.can_confidential);
                $('#chkwcbRejected').prop('checked', claim_data.can_wcb_rejected);
                $('#ddlNewbornCode').val(claim_data.can_ahs_newborn_code).change();
                $('#txtReasonAdditionalCompensation').val(claim_data.can_ahs_emsaf_reason);
                $('#chkSupportingDocumentationSeparate').prop('checked', claim_data.can_ahs_paper_supporting_docs);
                $('#txtSupportingText').val(claim_data.can_supporting_text);
                $('#spChartNumber').text(claim_data.claim_id);
                $('#microFilmNumber').val(claim_data.can_mhs_microfilm_no || '');
                $('#receiptDate').val(claim_data.can_mhs_receipt_date ? moment(claim_data.can_mhs_receipt_date).format('L') : '');

                var pay_to_details = claim_data.can_ahs_pay_to_details || {};
                $('#ddlPayToDetailsPersonType').val(pay_to_details.person_type).change();
                $('#txtPayToDetailsFirstName').val(pay_to_details.first_name);
                $('#txtPayToDetailsMiddleName').val(pay_to_details.middle_name);
                $('#txtPayToDetailsLastName').val(pay_to_details.last_name);
                $('#txtPayToDetailsDOB').val(pay_to_details.birth_date ? moment(pay_to_details.birth_date, 'YYYYMMDD').format('L') : '');
                $('#ddlPayToDetailsGender').val(pay_to_details.gender_code).change();
                $('#txtPayToDetailsAddr1').val(pay_to_details.address1);
                $('#txtPayToDetailsAddr2').val(pay_to_details.address2);
                $('#txtPayToDetailsAddr3').val(pay_to_details.address3);
                $('#txtPayToDetailsCity').val(pay_to_details.city);
                $('#ddlPayToDetailsProvince').val(pay_to_details.province_code).change();
                $('#txtPayToDetailsPostalCode').val(pay_to_details.postal_code);
                $('#ddlPayToDetailsCountryCode').val(pay_to_details.country_code).change();
                $('#txtEncounterNo').val(claim_data.can_ahs_encounter_no || 1)

                var $businessArrangement = $('input[name="BusinessArrangement"]');

                self.can_ahs_business_arrangement = claim_data.can_ahs_business_arrangement;
                self.can_ahs_locum_arrangement = claim_data.can_ahs_locum_arrangement;
                self.can_ahs_business_arrangement_facility = claim_data.can_ahs_business_arrangement_facility;
                self.can_ahs_locum_arrangement_provider = claim_data.can_ahs_locum_arrangement_provider;

                /* Locum Payment Type / Business Arrangement is read-only when claim is...
                 *   Paid in Full
                 *   Over Payment
                 *   Insurance Over Payment
                 *   Patient Over Payment
                 *   AHS Over Paid
                 */
                if ( self.isPaymentTypeReadOnly(claim_data.claim_status_id) ) {
                    $businessArrangement.each(function (index, el) {
                        var $radio = $(el);
                        var $container = $radio.closest('div');
                        var $label = $container.find("label");

                        $label.removeAttr('for');  // Remove 'for' attribute so that clicking the label won't select the associated radio button
                        $radio.hide();

                        // If the radio button is selected, show the checkmark
                        if ($radio.prop('checked')) {
                            $container.find(".check-mark").show();
                        }
                    });
                }
                else {
                    var payToValue = self.getPayToValue();

                    $businessArrangement
                        .off('change')
                        .on('change', function () {
                            if ( this.checked ) {
                                var value = $(this).val();
                                self.setBusinessArrangement(value);
                            }
                        })
                        .val([ payToValue ]);

                    // If this is a new/unsaved claim, do initial trigger to set proper vals.
                    // Otherwise, the vals are already set and only need changing if input changes.
                    if ( !self.can_ahs_business_arrangement ) {
                        $businessArrangement.trigger('change');
                    }
                }

                if (claim_data.can_ahs_pay_to_code === 'RECP') {
                    $businessArrangement.prop('checked', false);
                    $businessArrangement.prop('disabled', true);
                }

                /* Claim section end */
                /* Additional info start*/

                claim_data.hospitalization_from_date ? self.hcf.date(claim_data.hospitalization_from_date) : self.hcf.clear();
                claim_data.hospitalization_to_date ? self.hct.date(claim_data.hospitalization_to_date) :self.hct.clear();
                claim_data.unable_to_work_from_date ? self.wcf.date(claim_data.unable_to_work_from_date) : self.wcf.clear();
                claim_data.unable_to_work_to_date ? self.wct.date(claim_data.unable_to_work_to_date ) :self.wct.clear();
                document.querySelector('#txtOtherDate').value = claim_data.same_illness_first_date ? moment(claim_data.same_illness_first_date).format('L') : '';
                document.querySelector('#txtDate').value = claim_data.current_illness_date ? moment(claim_data.current_illness_date).format('L') : '';
                var isCauseCode = (claim_data.is_employed || claim_data.is_auto_accident || claim_data.is_other_accident);

                if (claim_data.claim_charges) {
                    var isProfessionalClaim = claim_data.claim_charges.some(function(ch) {
                        var modifier1_code = self.getModifierCode(ch.modifier1_id);
                        var modifier2_code = self.getModifierCode(ch.modifier2_id);
                        var modifier3_code = self.getModifierCode(ch.modifier3_id);
                        var modifier4_code = self.getModifierCode(ch.modifier4_id);
                        return [modifier1_code, modifier2_code, modifier3_code, modifier4_code].includes('26');
                    });
                    var isOutsideLabClaim = isProfessionalClaim && (
                            ['split_p', 'split'].includes(claim_data.claim_billing_type)
                            || (claim_data.claim_billing_type === 'global' && claim_data.is_split_claim_enabled)
                        );
                }

                $('input[name="outSideLab"]').prop('checked', claim_data.service_by_outside_lab || isOutsideLabClaim);
                $('input[name="employment"]').prop('checked', claim_data.is_employed);
                $('input[name="autoAccident"]').prop('checked', claim_data.is_auto_accident);
                $('input[name="manualReviewIndicator"]').prop('checked', claim_data.manual_review_indicator);
                $('input[name="otherAccident"]').prop('checked', claim_data.is_other_accident);
                $('#txtOriginalRef').val(claim_data.original_reference || '');
                $('#txtAuthorization').val(claim_data.authorization_no || '');
                $('#frequency').val(claim_data.frequency || '');
                $('#selAccidentState').val(claim_data.accident_state).prop('disabled', !isCauseCode);
                $('#txtDateOfReferral').val(moment(claim_data.can_wcb_referral_date).format('L') || '');

                if (['can_BC', 'can_AB'].indexOf(app.billingRegionCode) !== -1) {

                    var areaOfInjuryCode = _.find(app.wcb_area_code, {
                        id: ~~claim_data.area_of_injury_code_id
                        }) || {};
                    var natureOfInjuryCode = _.find(app.wcb_nature_code, {
                        id: ~~claim_data.nature_of_injury_code_id
                        }) || {};
                    var areaOfInjuryContainer = $("#select2-wcbAreaOfInjury-container");
                    var natureOfInjuryContainer = $("#select2-wcbNatureOfInjury-container");

                    if (_.isEmpty(areaOfInjuryCode)) {
                        areaOfInjuryContainer.text(commonjs.geti18NString('messages.warning.shared.selectWcbAreaCode'));
                    } else {
                        areaOfInjuryContainer.text(areaOfInjuryCode.code + ' - ' + areaOfInjuryCode.description);
                    }

                    if (_.isEmpty(natureOfInjuryCode)) {
                        natureOfInjuryContainer.text(commonjs.geti18NString('messages.warning.shared.selectWcbNatureCode'));
                    } else {
                        natureOfInjuryContainer.text(natureOfInjuryCode.code + ' - ' + natureOfInjuryCode.description);
                    }
                    self.wcbNatureCodeId = claim_data.nature_of_injury_code_id || null;
                    self.wcbAreaCodeId = claim_data.area_of_injury_code_id || null;
                }

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

                if (self.ordering_facility_contact_id) {
                    self.updateResponsibleList({
                        payer_type: 'POF',
                        payer_id: self.ordering_facility_id,
                        payer_name: self.ordering_facility_name + self.claimResponsible
                    }, null);
                }

                if (self.ACSelect.refPhy.contact_id || null) {
                    self.updateResponsibleList({
                        payer_type: 'RF',
                        payer_id: self.ACSelect.refPhy.contact_id,
                        payer_name: self.ACSelect.refPhy.Desc + '(Referring Provider)'
                    }, null);
                }

                if (app.isMobileBillingEnabled && app.settings.enableMobileRad) {
                    self.appendPOSOptions(claim_data.pos_map_code);
                }

                /* ResponsibleList End*/
                /* Common Details Edit & Claim creation */
                var responsibleIndex;
                if (self.isEdit) {
                    self.bindEditClaimInsuranceDetails(claim_data);
                    responsibleIndex = _.find(self.responsible_list, function (item) { return item.payer_type_name == claim_data.payer_type; });
                    $('#ddlClaimResponsible').val(responsibleIndex.payer_type);
                    $('#ddlClaimResponsible').data('current-payer', claim_data.payer_type);
                    $('#ddlClaimStatus').val(claim_data.claim_status_id || '');
                    $('#ddlFrequencyCode').val(claim_data.frequency || '')
                    $('#ddlSubmissionCode').val(claim_data.can_submission_code_id || '');
                    $('#ddlPOSType').val(["can_MB", "can_ON"].indexOf(app.billingRegionCode) === -1 && claim_data.place_of_service_id || '');
                    document.querySelector('#txtClaimDate').value = claim_data.claim_dt ? self.convertToTimeZone(claim_data.facility_id, claim_data.claim_dt).format('L') : '';
                    $('#txtClaimCreatedDt').val(claim_data.created_dt ? self.convertToTimeZone(claim_data.facility_id, claim_data.created_dt).format('L') : '');
                    self.displayClaimStatusByProvider(claim_data.p_insurance_code);
                } else {
                    responsibleIndex = _.find(self.responsible_list, function (item) {
                        if (app.isMobileBillingEnabled && claim_data.billing_type == 'facility') {
                            return item.payer_type == 'POF';
                        }
                        return item.payer_type == 'PIP_P';

                    });
                    if (responsibleIndex && responsibleIndex.payer_id && responsibleIndex.payer_type) {
                        $('#ddlClaimResponsible').val(responsibleIndex.payer_type);
                    } else {
                        $('#ddlClaimResponsible').val('PPP');
                    }
                    $('#ddlClaimStatus').val($("option[data-desc = 'PV']").val());

                    if (app.billingRegionCode !== 'can_AB') {
                        $('#ddlFrequencyCode').val(claim_data.frequency || '');
                    }

                    var ddlPOSType = $('#ddlPOSType');

                    if (claim_data.pos_type_code && app.isMobileBillingEnabled && ["can_MB", "can_ON"].indexOf(app.billingRegionCode) === -1) {
                        ddlPOSType.val($('option[data-code = ' + claim_data.pos_type_code.trim() + ']').val());
                    } else if (app.isMobileBillingEnabled && ['facility', 'global'].indexOf(claim_data.billing_type) > -1) {
                        ddlPOSType.val(claim_data.ord_fac_place_of_service || '');
                    } else if (app.country_alpha_3_code !== 'can') {
                        ddlPOSType.val(claim_data.fac_place_of_service_id || '');
                    }
                    var currentDate = new Date();
                    var defaultStudyDate = moment(currentDate).format('L');
                    var lineItemStudyDate = self.studyDate && self.studyDate != '' ?  self.studyDate : '';
                    $('#txtClaimDate').val(self.studyDate ? lineItemStudyDate : defaultStudyDate);
                    $('#divClaimDate').hide();
                }

                if (app.billingRegionCode === 'can_BC') {
                    self.isProviderChiropractor = _.some(claim_data.specialities, function(val) {
                        return val.toLowerCase() === 'chiropractor';
                    }) || false;

                    if (!self.isEdit && self.isProviderChiropractor && (!self.priInsCode || self.priInsCode.toLowerCase() === 'msp') ) {
                        $('#ddlClaimResponsible').val('PPP');
                    }
                }
                self.toggleWCBInjuryTypes();
                self.toggleOtherClaimNumber();
                self.disableElementsForProvince(claim_data);
                /* Common Details end */

                //upate total billfee and balance
                $(".allowedFee, .billFee").blur();
                $(".diagCodes").blur();

                if (claim_data.facility_id) {
                    $('#btnSaveClaim').prop('disabled', false);
                }
            },

            // enable/disable elements Based on billing province.
            disableElementsForProvince: function (data) {
                var self = this;

                if (app.billingRegionCode === 'can_AB') {
                    var removeChargeIcons = $('#tblCharge').find('th.addCharge, th.removeCharge');
                    var btnCreateCharge = $('#createNewCharge');
                    if (self.isEdit) {
                        // Choose default frequency code on edit claim
                        var frequencyElement = $('#ddlFrequencyCode');
                        var isRejectedClaimStatus = ['R', 'BR', 'D'].indexOf(data.claim_status_code) !== -1;
                        var actionCode = commonjs.isValidClaimStatusToSubmit('change', data.claim_status_code)
                        ? 'corrected'
                        : isRejectedClaimStatus
                            ? ''
                            : data.frequency;
                        var disableCorrected = isRejectedClaimStatus || !actionCode;
                        var invalidClaimStatusArray = ['DEL', 'ISS', 'PAE', 'PGA', 'PGD', 'REJ', 'REQ'];
                        var disableClaimStatus = (
                            self.priInsCode && self.priInsCode.toLowerCase() === 'ahs' &&
                            invalidClaimStatusArray.indexOf(data.claim_status_code) !== -1
                        ) || false;

                        frequencyElement.find('option[value=""]').prop('disabled', !disableCorrected);
                        frequencyElement.find('option[value="corrected"]').prop('disabled', disableCorrected);
                        frequencyElement.find('option[value="'+ actionCode +'"]').prop('selected', 'selected');
                        $('#ddlClaimStatus').prop('disabled', disableClaimStatus);

                        //EXA-18272 - Restrict to add/remove new charge on edit claim for alberta billing
                        $("td span.addChargeLine").parent().remove();
                        $('td span.removecharge').parent().remove();
                        removeChargeIcons.hide();
                        btnCreateCharge.prop('disabled', true);
                        $('.extra-span').hide();
                    } else {
                        //EXA-18272 - AHS - claims to only have one charge / CPT each
                        removeChargeIcons.show();
                        btnCreateCharge.prop('disabled', false);
                        $('.extra-span').show();
                    }

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

                    if (!['MPP', 'OP'].includes(data.claim_status_code)) {
                        queryStatusEle.hide();
                    } else {
                        queryStatusEle.show();
                    }

                    if (data.claim_status_code === 'P77') {
                        $('#btnNewPayment, .paymentApply').prop('disabled', true);
                        $('#btnSaveClaim').hide();
                    } else {
                        p77StatusEle.hide();
                        $('#btnSaveClaimNotes').hide();
                    }
                } else if (app.billingRegionCode === 'can_BC')  {
                    if (data.claim_status_code === 'OH') {
                        $('#btnNewPayment, .paymentApply').prop('disabled', true);
                        $('#btnSaveClaim').hide();

                    } else {
                        var ohClaimStatus = _.find(app.claim_status, { code: 'OH'});

                        if (ohClaimStatus) {
                            $('#ddlClaimStatus option[value="' + ohClaimStatus.id + '"]').hide();
                        }

                        $('#btnSaveClaimNotes').hide();
                    }
                }
            },

            checkRelationshipActive: function (id) {
                return $.grep(app.relationship_status, function (relationship) {
                    return id == relationship.id;
                }).length;
            },

            /**
            * Setting default autocomplete for wcb codes
            * This autocomplete returns the response as res.wcb code
            */
            initWCBCodesAutoComplete: function (containerID) {
                var self = this;
                var wcbCodeType = containerID === 'wcbNatureOfInjury' ? 'n' : 'a';
                $('#' + containerID).select2({
                    ajax: {
                        url: "/exa_modules/billing/autoCompleteRouter/wcb_codes",
                        dataType: 'json',
                        delay: 250,
                        data: function (params) {
                            return {
                                page: params.page || 1,
                                codeType: wcbCodeType,
                                q: params.term || '',
                                pageSize: 10,
                                sortField: "code",
                                sortOrder: "asc",
                                company_id: app.companyID
                            };
                        },
                        processResults: function (data, params) {
                            return commonjs.getTotalRecords(data, params);
                        },
                        cache: true
                    },
                    minimumInputLength: 0,
                    placeholder: wcbCodeType === 'n'
                        ? commonjs.geti18NString('messages.warning.shared.selectWcbNatureCode')
                        : commonjs.geti18NString('messages.warning.shared.selectWcbAreaCode'),
                    escapeMarkup: function (markup) { return markup; },
                    templateResult: formatRepo,
                    templateSelection: formatRepoSelection,
                });
                function formatRepo(res) {
                    if (res.loading) {
                        return res.text;
                    }

                    var markup = "<table><tr>";
                    markup += "<td title='" + res.code + " - " + res.description + "'><div>" + res.code + " - " + res.description + "</div>";
                    markup += "</td></tr></table>";
                    return markup;
                }
                function formatRepoSelection(res) {
                    if (!res.id) {
                        return res.text;
                    }
                    self.bindWCBDetails(containerID, res);
                    return res.code + ' - ' + res.description;
                }
            },

            onChangeServiceLocation: function () {
                var posMap = $("#ddlServiceFacilityLocation option:selected").val();

                if (posMap === 'OFP' && this.hasMatchingOrderingFacility()) {
                    $("#ddlClaimResponsible  option[value='PSF']").remove();
                    return;
                }

                if (posMap && posMap !== "OF") {
                    this.updateResponsibleList({
                        payer_type: 'PSF',
                        payer_id: $('#ddlServiceFacilityLocation option:selected').val(),
                        payer_name: $('#ddlServiceFacilityLocation option:selected').text() + '(Service Facility)'
                    }, null);
                } else {
                    $("#ddlClaimResponsible  option[value='PSF']").remove();
                }

            },

            toggleWCBInjuryTypes: function() {
                var dateOfReferral = $('#dateOfReferralDiv');
                if ($('#chkEmployment').is(':checked')) {
                    $('#natureOfInjuryDiv').show();
                    $('#areaOfInjuryDiv').show();
                    dateOfReferral.show();
                    $('#divInjury').show();
                    $('#tblInjury').show();

                } else {
                    $('#natureOfInjuryDiv').hide();
                    $('#areaOfInjuryDiv').hide();
                    dateOfReferral.hide();
                    $('#tblInjury').hide();
                }
            },

            /**
             * Show/Hide Zip plus field based on the subscriber country
             */
            showZipPlus: function ($ele, country) {
                country === 'usa'
                    ? $ele.show()
                    : $ele.val('').hide();

                return this;
            },

            bindEditClaimInsuranceDetails: function (claimData) {
                var self = this;

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
                    $('#ddlPriCountry').val(claimData.p_subscriber_country_code || app.country_alpha_3_code);
                    self.showZipPlus($('#txtPriZipPlus'), $('#ddlPriCountry').val());

                    // Append dynamic address details for canadian config
                    self.bindAddressInfo('Pri', claimData, 'p');
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
                    $('#chkSecMedicarePayer').prop('checked', !!claimData.s_medicare_insurance_type_code);
                    $('#selectMedicalPayer').toggle(!!claimData.s_medicare_insurance_type_code);
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
                    $('#ddlSecCountry').val(claimData.s_subscriber_country_code || app.country_alpha_3_code);
                    $('#txtSecCity').val(claimData.s_subscriber_city);
                    //$('#ddlSecState').val(claimData.s_subscriber_state);
                    $('#txtSecZipCode').val(claimData.s_subscriber_zipcode);
                    self.showZipPlus($('#txtSecZipPlus'), $('#ddlSecCountry').val());
                    $('#txtSecZipPlus').val(claimData.s_subscriber_zipcode_plus);

                    if (self.states.indexOf(claimData.s_subscriber_state) > -1) {
                        $('#ddlSecState').val(claimData.s_subscriber_state);
                    }

                    self.bindAddressInfo('Sec', claimData, 's');
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
                    $('#ddlTerCountry').val(claimData.t_subscriber_country_code || app.country_alpha_3_code);
                    $('#txtTerCity').val(claimData.t_subscriber_city);
                    //$('#ddlTerState').val(claimData.t_subscriber_state);
                    $('#txtTerZipCode').val(claimData.t_subscriber_zipcode);
                    self.showZipPlus($('#txtTerZipPlus'), $('#ddlTerCountry').val());
                    $('#txtTerZipPlus').val(claimData.t_subscriber_zipcode_plus);

                    if (self.states.indexOf(claimData.t_subscriber_state) > -1) {
                        $('#ddlTerState').val(claimData.t_subscriber_state);
                    }

                    self.bindAddressInfo('Ter', claimData, 't');
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
                self.cur_study_date =  primaryStudyDetails.study_date ? moment.utc(primaryStudyDetails.study_date).format('L') : '';
                self.cur_patient_dob = primaryStudyDetails.patient_dob ? moment.utc(primaryStudyDetails.patient_dob).format('L') : null;
                self.pri_accession_no = primaryStudyDetails.accession_no || null;
                self.cur_study_id = primaryStudyDetails.study_id || null;
                self.isEdit = !!self.claim_Id;
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
                        $('#patientStudyDate').text(self.cur_study_date || self.studyDate);
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

                $('#anc_first_page, #anc_previous_page, #anc_next_page, #anc_last_page').off().click(function (e) {
                    self.onClaimPaging(e);
                });

                if (app.billingRegionCode === 'can_MB') {
                    var p77ClaimStatus = _.find(app.claim_status, function(item) {
                        return item.code === 'P77'
                    });

                    if (p77ClaimStatus) {
                        $('#ddlClaimStatus option[value="' + p77ClaimStatus.id + '"]').hide();
                    }

                    $('#btnSaveClaimNotes').hide();
                } else if (app.billingRegionCode === 'can_BC') {
                    var ohClaimStatus = _.find(app.claim_status, function(item) {
                        return item.code === 'OH'
                    });

                    if (ohClaimStatus) {
                        $('#ddlClaimStatus option[value="' + ohClaimStatus.id + '"]').hide();
                    }

                    $('#btnSaveClaimNotes').hide();
                }
            },

            toggleOtherClaimNumber: function() {
                var $chkEmployment = $('#chkEmployment');
                var $lblOriginalRef = $("#lblOriginalRef");
                var $txtOriginalRef = $("#txtOriginalRef");
                var can_AB_show_original_ref = app.billingRegionCode === "can_AB" && $chkEmployment.prop('checked');
                var can_BC_show_original_ref = app.billingRegionCode === "can_BC" && ($chkEmployment.prop('checked') || $('#chkAutoAccident').prop('checked'));

                if (can_AB_show_original_ref || can_BC_show_original_ref) {
                    $lblOriginalRef.addClass("field-required");
                    can_BC_show_original_ref && $txtOriginalRef.attr('maxlength', 8);
                }
                else {
                    $lblOriginalRef.removeClass("field-required");
                    $txtOriginalRef.removeAttr('maxlength');
                }
                commonjs.updateCulture(app.currentCulture, commonjs.beautifyMe);
            },

            bindclaimFormEvents: function (isFrom) {
                var self = this;

                $("#ddlClaimResponsible").off().change(function () {
                    self.getBillFee();
                });

                $("#createNewCharge").off().click(function (e) {
                    self.addChargeLine(e);
                });

                $("#btnAddDiagCode").off().click(function () {
                    self.addDiagCodes(true);
                });

                $("#btnSaveClaim").off().click(function (e) {
                    self.saveClaimDetails(e);
                });

                $('#btnSaveClaimNotes').off().click(function (e) {
                    self.updateNotes(e);
                });

                $("#ddlExistTerIns, #ddlExistSecIns, #ddlExistPriIns").off().change(function (e) {
                    self.assignExistInsurance(e);
                });

                $("#ddlPriRelationShip, #ddlSecRelationShip, #ddlTerRelationShip").off().change(function (e) {
                    self.showSelf(e);
                    self.changeRelationalShip(e);
                });

                $(".closePopup").off().click(function () {
                    $('#site_modal_div_container').empty().hide();
                });

                $("#chkSecMedicarePayer").off().change(function () {
                    $('#selectMedicalPayer').toggle($('#chkSecMedicarePayer').is(':checked')).val('');
                });

                $("#btnResetPriInsurance, #btnResetSecInsurance, #btnResetTerInsurance").off().click(function (e) {
                   self.insuranceUpdate(e);
                });

                $("#btnValidateClaim").off().click(function () {
                    self.validateClaim();
                });

                $("#btPatientDocuemnt").off().click(function () {
                   commonjs.openDocumentsAndReports(self.options);
                });

                $("#btnPatientNotes").off().click(function () {
                    commonjs.openNotes(self.options);
                });

                $(".claimProcess").off().click(function (e) {
                    if (app.billingRegionCode === "can_AB" && commonjs.hasWCBUnsavedChanges && !self.enableConfirmAlert) {
                        self.openUnSavedChangesModal('prevNext', e);
                    } else {
                        self.processClaim(e);
                    }
                });

                $("#siteModal .modal-header button, #siteModal .modal-footer button").off().click(function () {
                    if (app.billingRegionCode === "can_AB" && commonjs.hasWCBUnsavedChanges && !self.enableConfirmAlert) {
                        $(this).removeAttr('data-dismiss');
                        self.openUnSavedChangesModal('close', $(this));
                    }
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

                $('#chkEmployment, #chkAutoAccident, #chkOtherAccident').off().change(function () {
                    var isCauseCode = $('#chkEmployment').prop('checked') || $('#chkAutoAccident').prop('checked') || $('#chkOtherAccident').prop('checked');
                    var $accidentState = $("#selAccidentState");
                    $accidentState.prop("disabled", !isCauseCode);

                    if (!isCauseCode) {
                        $accidentState.val('');
                    }
                    self.toggleOtherClaimNumber();
                    self.toggleWCBInjuryTypes();
                });

                $('#ddlPayToCode').off().change(function (e) {
                    var val = e && e.target && e.target.value || "";
                    self.changePayToCode(val);
                });

                $('#txtPayToUli').off().blur(function (e) {
                    var val = e && e.target && e.target.value || "";
                    self.blurPayToUli(val);
                });

                $("#btnAddSupportingText").off().click(function () {
                    self.insertSupportingText();
                });

                $('#ddlServiceFacilityLocation').off().change(function () {
                    self.onChangeServiceLocation();
                });

            },

            getBillFee: function () {
                var self = this;
                var facility_id = $('#ddlFacility option:selected').val() != '' ? parseInt($('#ddlFacility option:selected').val()) : null;
                var currentResponsible = _.find(this.responsible_list, function(d) { return d.payer_type === $('#ddlClaimResponsible').val(); });
                var arrBillFee = [];

                $('#tBodyCharge').find('tr').each(function () {
                    var dataRowId = $(this).attr('data_row_id');
                    var chargeData = _.find(self.chargeModel, { 'data_row_id': parseInt(dataRowId) });

                    arrBillFee.push({
                        row_id: dataRowId,
                        claim_id: chargeData.claim_id || null,
                        cpt_id: $('#lblCptCode_' + dataRowId).attr('data_id'),
                        modifier1_id: $('#txtModifier1_' + dataRowId).attr('data-id') || null,
                        modifier2_id: $('#txtModifier2_' + dataRowId).attr('data-id') || null,
                        modifier3_id: $('#txtModifier3_' + dataRowId).attr('data-id') || null,
                        modifier4_id: $('#txtModifier4_' + dataRowId).attr('data-id') || null,
                        payer_type: currentResponsible.payer_type_name,
                        payer_id: currentResponsible.payer_id,
                        facility_id: facility_id,
                        study_id: chargeData.study_id || null,
                        charge_dt: commonjs.shiftToFacilityTimeZone(facility_id, $('#txtScheduleDate_' + dataRowId).val()).format('YYYY-MM-DD LT z') || null
                    });
                });

                $.ajax({
                    type: 'GET',
                    url: '/exa_modules/billing/claims/claim/billingFee',
                    contentType: 'application/json',
                    dataType: 'json',
                    data: {
                        arrBillFee: JSON.stringify(arrBillFee)
                    },
                    success: function (data) {
                        var billFeeData = {};
                        for (var i = 0; i < data.length; i++) {
                            billFeeData = data[i];
                            $('#txtBillFee_' + billFeeData.row_id).val(billFeeData.computed_bill_fee);
                            $('#txtBillFee_' + billFeeData.row_id).blur();
                        }
                    },
                    error: function (err, response) {
                        commonjs.handleXhrError(err, response);
                    }
                })
            },

            openUnSavedChangesModal: function (isFrom, e) {
                var self = this;

                swal2.fire({
                    type: 'warning',
                    titleText: i18n.get('messages.confirm.unsavedWCBChanges'),
                    showCancelButton: true,
                    onOpen: function () {
                        $('.swal2-checkbox').addClass('d-none');
                    }
                }).then(function (res) {
                    if (isFrom === 'close') {
                        e.attr('data-dismiss', 'modal');

                        if (res.value) {
                            $("#siteModal").hide();
                            $("#siteModal").modal("hide");
                            self.enableConfirmAlert = true;
                            return true;
                        }
                    } else {
                        if (res.value) {
                            self.processClaim(e);
                        }
                    }
                });
            },

            getLineItemsAndBind: function (selectedStudyIds) {
                var self = this;
                self.chargeModel = [];
                self.injuryModel = [];
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
                            isMobileBillingEnabled: app.isMobileBillingEnabled,
                            billingRegionCode: app.billingRegionCode,
                        },
                        success: function (model) {
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

                                self.technicalPlaceOfService = _defaultDetails.ord_fac_place_of_service;
                                self.claim_dt_iso = modelDetails && commonjs.checkNotEmpty(modelDetails.study_dt)
                                        ? commonjs.convertToFacilityTimeZone(self.facilityId, modelDetails.study_dt)
                                        : commonjs.convertToFacilityTimeZone(app.facilityID, app.currentdate);
                                self.studyDate = self.claim_dt_iso ? self.claim_dt_iso.format('L') : self.studyDate;
                                $('#txtClaimDate').val(self.studyDate || '');
                                self.claim_dt_iso = self.claim_dt_iso.format('YYYY-MM-DD LT z');
                                self.is_split_claim = _defaultDetails.is_split_claim;
                                self.isSplitClaimEnabled = _defaultDetails.is_split_claim_enabled;
                                if(app.isMobileBillingEnabled) {
                                    $('.splitNotification').removeClass('hidden');
                                }

                                //EXA-18273 - Bind Charges created on current date for a patient - Alberta billing specification.
                                if(app.billingRegionCode === 'can_AB'){
                                    self.getPatientCharges(self.cur_patient_id, modelDetails.charges);
                                }

                                _.each(modelDetails.injury_details, function (obj, index) {
                                    self.injuryModel.push({
                                        id: null,
                                        study_id: obj.study_id,
                                        body_part_code: obj.body_part_code,
                                        orientation_code: obj.orientation_code,
                                        injury_id: obj.injury_id,
                                        priority_level: self.getPriorityLevel(index)
                                    });
                                });

                                _.each(modelDetails.charges, function (item) {
                                    var index = $('#tBodyCharge').find('tr').length;
                                    item.data_row_id = index;
                                    item.is_custom_bill_fee = item.is_custom_bill_fee || false;
                                    self.addLineItems(item, index, true);

                                    self.chargeModel.push({
                                        id: null,
                                        claim_id: null,
                                        ref_charge_id: item.study_cpt_id,
                                        accession_no: item.accession_no,
                                        study_id: item.study_id,
                                        data_row_id: index,
                                        cpt_id: item.cpt_id,
                                        is_custom_bill_fee: item.is_custom_bill_fee || false,
                                        is_billing_rule_applied: item.is_billing_rule_applied || false,
                                        is_billing_rule_cpt_add_fee: item.is_billing_rule_cpt_add_fee || false,
                                        billing_rule_fee: item.billing_rule_fee
                                    });
                                });

                                if (app.country_alpha_3_code !== 'can' || (['can_AB', 'can_BC', 'can_ON'].indexOf(app.billingRegionCode) > -1)) {
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
                                    $('span[id^="spDeleteCharge"]').css('color', '#DCDCDC');
                                }

                                self.assignLineItemsEvents();
                                self.assignModifierEvent();
                                if (app.billingRegionCode == "can_AB") {
                                    self.injuryDetailsView.render(self.injuryModel || []);
                                }
                                app.modifiers_in_order = true;
                                commonjs.enableModifiersOnbind('M'); // Modifier
                                commonjs.enableModifiersOnbind('P'); // Diagnostic Pointer
                                commonjs.validateControls();
                                commonjs.isMaskValidate();
                                /* Bind chargeLineItems events - Ended */

                                self.getAlertEvent(); // for Patient Alert Button Click event availability

                                $("#txtClaimDate").attr("disabled", "disabled");
                                $("#txtClaimCreatedDt").prop('disabled', true);
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

            updateNotes: function () {
                $('#btnSaveClaimNotes').prop('disabled', true);
                $('.claimProcess').prop('disabled', true);

                $.ajax({
                    url: '/exa_modules/billing/claims/claim/notes/' + this.claim_Id,
                    type: 'PUT',
                    data: {
                        billingRegionCode: app.billingRegionCode,
                        claimNotes: $.trim($('#txtClaimNotes').val()),
                        billingNotes: $.trim($('#txtClaimResponsibleNotes').val()),
                        canSupportingText: $.trim($.trim($('#txtSupportingText').val()).replace(/\n/g, ' '))
                    },
                    success: function (response) {
                        if (response && response.length) {
                            commonjs.showStatus("messages.status.successfullyCompleted");
                            $('#btnSaveClaimNotes').prop('disabled', false);
                            $('.claimProcess').prop('disabled', false);
                        }
                    },
                    error: function (err, response) {
                        $('#btnSaveClaimNotes').prop('disabled', false);
                        $('.claimProcess').prop('disabled', false);
                        commonjs.handleXhrError(err, response);
                    }
                });
            },

            addChargeLine: function (e) {
                e.stopImmediatePropagation();
                var self = this;
                var _targetId = $(e.target || e.srcElement).attr('id');
                var index;
                var rowData;
                var _rowObj;
                if (_targetId == "createNewCharge") {
                    index = $('#tBodyCharge tr:last').attr('data_row_id') ? $('#tBodyCharge tr:last').attr('data_row_id') : -1;
                    rowData = _.find(self.chargeModel, { 'data_row_id': parseInt(index) });
                    _rowObj = {
                        id: null,
                        claim_id: self.claim_Id || null,
                        ref_charge_id: null,
                        study_id: self.isEdit ? (rowData && rowData.study_id || null) : (self.cur_study_id || null),
                        accession_no: $('#tBodyCharge tr:first').length > 0 ? $('#tBodyCharge tr:first').find('.charges__accession-num').text().trim() : (self.pri_accession_no || null),
                        data_row_id: parseInt(index) + 1,
                        is_billable: true,
                        is_custom_bill_fee: false
                    }
                } else {
                    var rowObj = $(e.target || e.srcElement).closest('tr');
                    index = rowObj.length > 0 ? $('#tBodyCharge tr:last').attr('data_row_id') : 0;
                    rowData = _.find(self.chargeModel, { 'data_row_id': parseInt(rowObj.attr('data_row_id')) });
                    _rowObj = {
                        id: null,
                        claim_id: rowData.claim_id ? rowData.claim_id : null,
                        ref_charge_id: null,
                        study_id: rowData.study_id,
                        accession_no: rowData.accession_no,
                        data_row_id: parseInt(index) + 1,
                        is_billable: true,
                        is_custom_bill_fee: false
                    }
                }

                if (app.billingRegionCode === 'can_AB' && index >= 25) {
                    return commonjs.showWarning("messages.warning.claims.maxChargeLimit");
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
                function data (id) {
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
                    province_alpha_2_code: app.province_alpha_2_code,
                    billing_region_code: app.billingRegionCode,
                    chargeField : self.getClaimChargeFieldDetails(app.billingRegionCode || ''),
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
                    // bind default pointer from line items
                    if (isDefault) {
                        var _pointer = data.icd_pointers && data.icd_pointers[m - 1] ? data.icd_pointers[m - 1] : '';
                        $('#ddlPointer' + m + '_' + index).val(_pointer);
                        $('#txtModifier' + m + '_' + index).val(data['m' + m] ? self.getModifierCode(data['m' + m]) : "").attr('data-id', data['m' + m]);
                    }else{
                        $('#ddlPointer' + m + '_' + index).val(data['pointer' + m]);
                        // ToDo:: Once modifiers dropdown added have to bind
                        $('#txtModifier' + m + '_' + index).val(data['modifier' + m +'_id'] ? self.getModifierCode(data['modifier' + m +'_id']) : null).attr('data-id', data['modifier' + m +'_id']);
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
                    .append($('<div/>', {id:'divSelCptCode_' + rowIndex})
                    .append($('<select/>', {id:'txtCptCode_' + rowIndex})));
                } else {
                    $('#divChargeCptDesc_' + rowIndex)
                    .append($('<div/>', {id:'divSelCptDescription_' + rowIndex})
                    .append($('<select/>', {id:'txtCptDescription_' + rowIndex})));
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
                        self.checkInputModifiersValues(e, _isFrom, null, 'change');
                    })
                    .on("blur", function (e) {
                        var _isFrom = $(e.target).hasClass('diagCodes') ? 'P' : 'M';
                        self.checkInputModifiersValues(e, _isFrom, null, 'blur');
                        var content = $(e.target).val();
                        if(_isFrom == 'M') {
                            var validContent = app.modifiers.filter(function(modifier) {
                                return modifier.code == content;
                            });
                            if(validContent && validContent.length > 0) {
                                $(e.target).attr('data-id', validContent[0].id);
                            } else {
                                $(e.target).attr('data-id', null);
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

                var dataContent;
                var modifierLevel;
                var existData;
                if (isFrom == 'P') { // Diagnostic Pointer

                    if (isEdit) { // for edit purpose Billing flag
                        dataContent = $(e.target).val();
                        modifierLevel = $(e.target).attr('data-type');
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
                        var _pointers = [];
                        var iterator = 1;
                        jQuery.grep($('.diagCodes'), function (value) {
                            count = count ? count : self.icdCodeListLength;
                            var val = $(value).val() ? $(value).val() : 0;
                            var _id = $(value).attr('id');
                            var maxIterator;

                            switch (app.billingRegionCode) {
                                case 'can_MB':
                                    maxIterator = 1;
                                    break;
                                case 'can_AB':
                                    maxIterator = 3;
                                    break;
                                default:
                                    maxIterator = 4;
                            }

                            if (val != '') {
                                if (val <= count && val != 0) {
                                    $('#' + _id).css('border-color', '')
                                    $('#' + _id).removeClass('invalidCpt')
                                    if (_pointers.indexOf(val) != -1 && iterator <= maxIterator)
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
                            if (iterator >= maxIterator) {
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

                    dataContent = $(e.target).val();
                    modifierLevel = $(e.target).attr('data-type');
                    modifierLevel = modifierLevel.replace('M', 'modifier');
                    existData = [];
                    if (dataContent != '') {
                        existData = jQuery.grep(app.modifiers, function (value) {
                            return (value.code.toLowerCase().indexOf(dataContent.toLowerCase()) > -1 && (value[modifierLevel] == true || value[modifierLevel] == 'true'));
                        });

                        if (existData.length > 0 && (app.billingRegionCode === 'can_AB' || dataContent && dataContent.length == 2)) {
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
                $(e.target).parent().append($('<div/>', {id:'divModifierList'}));
                var divModifierList = $('#divModifierList');
                divModifierList.empty();
                var modifierEl = $('<div/>').addClass('dropdown-menu');
                divModifierList.append(modifierEl);
                for(var i = 0; i < existData.length; i++) {
                     modifierEl
                        .append($('<div/>').addClass('dropdown-item').hover(function() {
                            $(this).css({'background-color':'#337ab7'});
                        }, function(){
                            $(this).css({'background-color':'transparent'});
                        })
                        .mousedown(function() {
                            $(e.target).val($(this).html());
                            $('#divModifierList').remove();
                        })
                        .html(existData[i].code));
                }
                $(e.target).css('border-color', '')
                $(e.target).removeClass('invalidModifier');
                divModifierList.css({'position':'relative', 'display':'block'});
                modifierEl.css({'display':'block', 'z-index':'10001'});
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
                    //EXA-18273-Remove highlighted color of removed cpt in patient charges section.
                    if(app.billingRegionCode ==='can_AB') {
                        $('#patientChargesBody #cpt_' + rowData.cpt_id).css('background', 'none');
                    }

                    if (rowData.id) {
                        $.ajax({
                            url: '/exa_modules/billing/claim_workbench/charge_check_payment_details',
                            type: 'GET',
                            data: {
                                charge_id: rowData.id,
                            },
                            success: function (data) {
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
                    $('#txtBillFee_' + index).attr({ disabled: false, "data-edit": true }).focus();
                    $('#txtAllowedFee_' + index).attr({ disabled: false });
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

                $.ajax({
                    type: 'PUT',
                    url: '/exa_modules/billing/claim_workbench/claim_charge/delete',
                    data: {
                        target_id: chargeId,
                        type: 'charge',
                        screenName: 'claims'
                    },
                    success: function (model) {
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
                var total_bill_fee = 0.0;
                var total_allowed = 0.0;
                var patient_paid = 0.0;
                var others_paid = 0.0;

                if (!commonjs.checkNotEmpty($(e.target || e.srcElement).val())) {
                    $(e.target || e.srcElement).hasClass('units')
                        ? $(e.target || e.srcElement).val('1.000')
                        : $(e.target || e.srcElement).val('0.00');
                }

                if (commonjs.checkNotEmpty($(e.target || e.srcElement).val()) &&
                    !$(e.target || e.srcElement).hasClass('units')) {
                    var billingNumber = $(e.target || e.srcElement).val()
                    $(e.target || e.srcElement).val(parseFloat(billingNumber).toFixed(2));
                }

                var rowID = $(e.target || e.srcElement).closest('tr').attr('data_row_id');
                var totalBillFee = parseFloat($('#txtUnits_' + rowID).val()) * parseFloat($('#txtBillFee_' + rowID).val());
                $('#txtTotalBillFee_' + rowID).val(totalBillFee.toFixed(2));

                var totalAllowedFee = parseFloat($('#txtUnits_' + rowID).val()) * parseFloat($('#txtAllowedFee_' + rowID).val());
                $('#txtTotalAllowedFee_' + rowID).val(totalAllowedFee.toFixed(2));

                $("#tBodyCharge").find("tr").each(function (index) {
                    var $totalbillFee = $(this).find("#txtTotalBillFee_" + index);
                    var thisTotalBillFee = $totalbillFee.val() || 0.00;
                    total_bill_fee = total_bill_fee + parseFloat(thisTotalBillFee);

                    var $totalAllowedFee = $(this).find("#txtTotalAllowedFee_" + index);
                    var thisTotalAllowed = $totalAllowedFee.val() || 0.00;
                    total_allowed = total_allowed + parseFloat(thisTotalAllowed);
                });

                patient_paid = parseFloat($('#spPatientPaid').text());
                others_paid = parseFloat($('#spOthersPaid').text());
                var refund_amount = parseFloat($('#spRefund').text());
                var adjustment_amount = parseFloat($('#spAdjustment').text());
                var balance = total_bill_fee - (patient_paid + others_paid + adjustment_amount + refund_amount);

                $('#spTotalBillFeeValue').text(commonjs.roundFee(total_bill_fee));
                $('#spBillFee').text(commonjs.roundFee(total_bill_fee));
                $('#spBalance').text(commonjs.roundFee(balance));
                $('#spTotalAllowedFeeValue').text(commonjs.roundFee(total_allowed));
                $('#spAllowed').text(commonjs.roundFee(total_allowed));
            },

            updateResponsibleList: function (payer_details, paymentDetails) {
                var self = this;
                var index;
                var responsibleEle;
                var selected_opt;
                var paymentPayerEle = $('#tBodyPayment tr').find("[id^=ddlPayerName]").filter(':input:enabled');
                // Inner function used to create dynamic options;
                function getOption (obj){
                    return $('<option/>').attr('value', obj.payer_type).text(obj.payer_name);
                }

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
                        if (paymentPayerEle.length && payer_details.payer_type !== 'PSF') {
                            $(paymentPayerEle).append(getOption(payer_details));
                        }
                    }
                } else {
                    // Append claim responsible as payment payer
                    responsibleEle = $('#ddlPayerName_' + paymentDetails.row_id);
                    $.each(self.responsible_list, function (index, obj) {
                        if (obj.payer_id && obj.payer_type !== 'PSF') {
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

                        var markup1 = "<table><tr class='inActiveRow'>";
                        if (repo.display_code != '')
                            markup1 += "<td title='" + repo.display_code + "(" + repo.display_description + ")" + "'><div>" + repo.display_code + "(" + repo.display_description + ")" + "</div>";
                        else
                            markup += "<td title='" + repo.display_code + repo.display_description + "'><div>" + repo.display_code + repo.display_description + "</div>";
                        markup1 += "</td></tr></table>"
                        return markup1;

                }
                $('#' + id).select2('open');
                $('#' + id).on('select2:selecting', function(e) {
                    var res = e.params.args.data;
                     if (res.id) {
                        var duration = (res.duration > 0) ? res.duration : 15;
                        var units = (res.units > 0) ? parseFloat(res.units) : 1.0;
                        var fee = (res.globalfee > 0) ? parseFloat(res.globalfee) : 0.0;

                        //Push cpt_id for newly added CPT into Model
                         if (app.billingRegionCode === 'can_AB') {
                             self.chargeModel[rowIndex].cpt_id = res.id;
                         }

                        if(self.isCptAlreadyExists(res.id, rowIndex)) {
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

            isCptAlreadyExists: function(cptID, rowID) {
                var isExists = false;
                 $('#tBodyCharge').find('tr').each(function () {
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

            clearProviderSkillCodes: function () {
                $('#select2-ddlSkillCodes-container').html(this.usermessage.selectSkillCodes);
                $("#ddlSkillCodes").attr('value', '');
            },

            setCptValues: function (rowIndex, res, duration, units, fee) {
                $('#chargeType_' + rowIndex).text(res.charge_type);
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

                //Highlight selected CPT/charge in patient charges for alberta
                if (app.billingRegionCode === 'can_AB') {
                    $('#patientChargesBody #cpt_' + res.id).css('background', 'antiquewhite');
                }
            },

            setProviderAutoComplete: function (provider_type) {
                var self = this;
                var _id;

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
                                company_id: app.companyID,
                                billingRegion: app.billingRegionCode
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
                        markup1 += "<td><div><b>" + repo.full_name + "</b><b>" + '(' + repo.provider_code + ') ' + repo.npi_no + "</b></div>";
                        markup1 += "<div>" + contactInfo.ADDR1 == undefined ? "" : contactInfo.ADDR1 + contactInfo.ADDR2 == undefined ? "" : ", " + contactInfo.ADDR2 + "</div>";
                        markup1 += "<div>" + contactInfo.CITY == undefined ? "" : contactInfo.CITY + ", " + contactInfo.STATE + contactInfo.ZIP == undefined ? "" : ", " + contactInfo.ZIP + contactInfo.MOBNO == undefined ? "" : ", " + contactInfo.MOBNO + "</div>";
                        markup1 += "</td></tr></table>";
                        return markup1;
                    }

                        var markup = "<table class='ref-result' style='width: 100%'><tr>";
                        markup += "<td><div><b>" + repo.full_name + "</b><b>" + '(' + repo.provider_code + ') ' + repo.npi_no + "</b></div>";
                        markup += "<div>" + (contactInfo.ADDR1 == undefined ? "" : contactInfo.ADDR1) + ", " + (contactInfo.ADDR2 == undefined ? "" : contactInfo.ADDR2) + "</div>";
                        markup += "<div>" + (contactInfo.CITY == undefined ? "" : contactInfo.CITY) + ", " + contactInfo.STATE + (contactInfo.ZIP == undefined ? "" : ", " + contactInfo.ZIP) + (contactInfo.MOBNO == undefined ? "" : ", " + contactInfo.MOBNO) + "</div>";
                        markup += "</td></tr></table>"
                        return markup;

                }
                function formatRepoSelection(res) {
                    if (provider_type == 'PR') {
                        self.ACSelect.readPhy.ID = res.id;
                        self.ACSelect.readPhy.Desc = res.full_name;
                        self.ACSelect.readPhy.Code = res.provider_code;
                        self.ACSelect.readPhy.contact_id = res.provider_contact_id;
                        self.clearProviderSkillCodes();
                        self.toggleSkillCodeSection();
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

                            if (app.isMobileBillingEnabled && app.settings.enableMobileRad) {
                                self.appendPOSOptions($('#ddlServiceFacilityLocation').val());
                            }

                        }
                    }
                    return res.full_name + ' ' + res.npi_no;
                }
            },

            toggleSkillCodeSection: function () {
                var self = this;
                if (self.ACSelect.readPhy.contact_id > 0) {
                    $.ajax({
                        type: 'GET',
                        url: '/getProviderSkillCodes',
                        data: {
                            reading_physician_id: self.ACSelect.readPhy.contact_id
                        },
                        success: function (data) {
                            var skillCodes = data && data.result || [];
                            self.providerSkillCodesCount = skillCodes.length;
                            self.ACSelect.skillCodes.ID = null;
                            if (skillCodes.length === 1) {
                                $('#select2-ddlSkillCodes-container').text(skillCodes[0].code);
                                self.ACSelect.skillCodes.ID = skillCodes[0].skill_code_id;
                            }
                        }
                    })
                }
            },

            setSkillCodesAutoComplete: function () {
                var self = this;

                $("#ddlSkillCodes").select2({
                    ajax: {
                        url: "/exa_modules/billing/autoCompleteRouter/getProviderSkillCodes",
                        dataType: 'json',
                        delay: 250,
                        data: function ( params ) {
                            return {
                                page: params.page || 1,
                                q: params.term || '',
                                reading_physician_id: self.ACSelect.readPhy.contact_id || 0,
                                pageSize: 10,
                                sortField: "sc.code",
                                sortOrder: "asc",
                                company_id: app.companyID
                            };
                        },
                        processResults: function (data, params) {
                            self.providerSkillCodesCount = data[0] && data[0].total_records ? data[0].total_records : 0;
                            return commonjs.getTotalRecords(data, params);
                        },
                        cache: true
                    },
                    escapeMarkup: function (markup) { return markup; },
                    minimumInputLength: 0,
                    templateResult: formatRepo,
                    templateSelection: formatRepoSelection
                });
                function formatRepo(repo) {
                    if (repo.loading) {
                        return repo.text;
                    }
                    var markup = "<table class='ref-result' style='width: 100%'><tr>";
                    markup += "<td><div><b>" + repo.code + "</b></div>";
                    markup += "</td></tr></table>"
                    return markup;
                }
                function formatRepoSelection(res) {
                    self.ACSelect.skillCodes.ID = res.id;
                    self.ACSelect.skillCodes.code = res.code;
                    return res.code;
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
                                company_id: app.companyID,
                                page: params.page,
                                term: params.term
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
                    var ask_confirm = (
                        res.code_type === 'icd9' &&
                        app.icd9_to_icd10 &&
                        !(app.country_alpha_3_code === 'can' && app.province_alpha_2_code === 'AB')
                    );

                    if (ask_confirm && confirm(commonjs.geti18NString("messages.confirm.billing.icdConvertion9to10"))) {
                        commonjs.showLoading('')
                        return self.showIcd9t010Popup(res);
                    }

                    self.ICDID = res.id;
                    self.icd_code = res.code;
                    self.icd_description = res.description;
                    $('#ddlMultipleDiagCodes').find('option').remove();
                    $('#select2-ddlMultipleDiagCodes-container').html(res.code);
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
                    success: function (model) {

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
                            var validationErrorMessage = model.result.data.errors.validation.code[0];
                            commonjs.showError(validationErrorMessage);
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
                        success: function (model) {
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

                if (this.maxDiagCodesReached(isManual)) {
                    return;
                }

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

            // Alberta accepts a maximum of 3 ICDs
            maxDiagCodesReached: function (isManual) {
                if (app.country_alpha_3_code === 'can' && app.province_alpha_2_code === 'AB') {
                    var maxIcds = (isManual) ? 3 : 4;  // Adds on load are pushed to array before tag is added. Manually added happens after.
                    var activeIcdList = this.claimICDLists.filter(function (icd) {
                        return !icd.is_deleted;
                    });

                    if (activeIcdList.length >= maxIcds) {
                        commonjs.showWarning("messages.status.maxDiagCodesReached");
                        return true;
                    }
                }
                return false;
            },

            // Remove deleted pointer references and decrement all of the higher numbered pointers so that they continue to match up correctly
            removeAdjustPointers: function (removePointer) {
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
                $('ul.icdTagList li span.orderNo').each(function (index) {
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
                        'claim_date': self.claim_dt_iso || self.cur_study_date || 'now()',
                        'order_ids': self.selectedOrderIds || [0]
                    },
                    success: function (response) {

                        if (response.length > 0) {
                            self.existingPrimaryInsurance = [];
                            self.existingSecondaryInsurance = [];
                            self.existingTriInsurance = [];
                            var existing_insurance = response[0].existing_insurance || [];
                            self.allExistingInsurances = existing_insurance;
                            var beneficiary_details = response[0].beneficiary_details || [];
                            self.patientAddress = response[0].patient_info ? response[0].patient_info : self.patientAddress;
                            self.npiNo = existing_insurance.length && existing_insurance[0].npi_no ? existing_insurance[0].npi_no : '';
                            self.federalTaxId = existing_insurance.length && existing_insurance[0].federal_tax_id ? existing_insurance[0].federal_tax_id : '';
                            self.tradingPartnerId = existing_insurance.length && existing_insurance[0].ins_partner_id ? existing_insurance[0].ins_partner_id : '';

                            $.each(existing_insurance, function (index, value) {
                                if (value.is_active) {
                                    switch (value.coverage_level) {
                                        case 'primary':
                                            self.existingPrimaryInsurance.push(value);
                                            break;
                                        case 'secondary':
                                            self.existingSecondaryInsurance.push(value);
                                            break;
                                        case 'tertiary':
                                            self.existingTriInsurance.push(value);
                                            break;
                                    }
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

            changeMobileBillingDefaultValues: function (currentBillingType) {
                var ddlClaimResponsible = $('#ddlClaimResponsible');

                if (currentBillingType === 'facility') {
                    ddlClaimResponsible.val("POF").change();
                } else {
                    var defaultResponsible = ddlClaimResponsible.find('option[value="PIP_P"]').length
                        ? 'PIP_P' : 'PPP';
                    ddlClaimResponsible.val(defaultResponsible).change();
                }
                this.is_split_claim = currentBillingType === 'split';
                this.billing_type = currentBillingType || 'global';
            },

            setOrderingFacilityAutoComplete: function () {
                var self = this;
                $("#ddlOrdFacility").select2({
                    ajax: {
                        url: "/exa_modules/billing/autoCompleteRouter/ordering_facility_contacts",
                        dataType: 'json',
                        delay: 250,
                        data: function (params) {
                            return {
                                page: params.page || 1,
                                q: params.term || '',
                                pageSize: 10,
                                sortField: "location",
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
                    markup += "<td title='" + repo.ordering_facility_code + "(" + repo.ordering_facility_name + ")'><div>" + repo.ordering_facility_name + "</div>"
                    markup += "<div> Location: " + repo.location + (repo.ordering_facility_type ? "(" + repo.ordering_facility_type + ")" : "") + "</div>";
                    markup += "<div> Address: " + repo.address_line_1 + ' ' + repo.address_line_2 + "</div>";
                    if (repo.city) {
                        markup += "<div>" + repo.city + ', '
                    }
                    markup += (repo.state || '') + ' ' + repo.zip_code
                    if (repo.zip_plus) {
                        markup += '-' + repo.zip_plus + "</div>";
                    }
                    markup += "<div> Phone: " + (repo.phone_number || '') + "</div>";
                    markup += "<div> Fax: " + (repo.fax_number || '') + "</div>";
                    markup += "</td></tr></table>";
                    return markup;

                }
                function formatRepoSelection(res) {
                    self.ordering_facility_name = res.ordering_facility_name;
                    self.ordering_facility_id = res.ordering_facility_id;
                    self.ordering_facility_contact_id = res.id || null;

                    if (app.isMobileBillingEnabled && res.billing_type != self.billing_type) {
                        self.changeMobileBillingDefaultValues(res.billing_type);
                    }

                    self.billing_type = res.billing_type;

                    if (res && res.id) {
                        self.updateResponsibleList({
                            payer_type: 'POF',
                            payer_id: res.ordering_facility_id,
                            payer_name: res.ordering_facility_name + self.claimResponsible
                        }, null);

                        if(app.isMobileBillingEnabled && res.billing_type === 'facility'){
                            $('#ddlClaimResponsible').val("POF").change();
                        }

                        if(app.isMobileBillingEnabled && app.settings.enableMobileRad) {
                            self.appendPOSOptions($('#ddlServiceFacilityLocation').val());
                        }
                    }
                    return res.ordering_facility_name + ' (' + res.location + ')' + (res.ordering_facility_type ? " (" + res.ordering_facility_type + ")" : "");
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
                $("#" + element_id).on('select2:open', function () {
                    commonjs.getPlaceHolderForSearch();
                    if ($select2Container && $select2Container.text())
                        $("#" + element_id).data('select2').dropdown.$search.val($select2Container.text());
                });

                if (app.billingRegionCode === 'can_AB') {
                    $('#' + element_id).on('select2:select', function (e) {
                        var data = e.params && e.params.data;
                        var enableFlag = data.insurance_code.toLowerCase() === 'ahs';
                        $('#chkPriSelf').prop('checked', enableFlag).trigger('change'); // Bind Patient Details when AHS insurance is set.
                        $('#ddlClaimStatus').prop('disabled', enableFlag);
                    });
                }

            },

            bindWCBDetails: function(elementId, res) {
                var self = this;
                if (elementId === 'wcbNatureOfInjury') {
                    self.wcbNatureCodeId = res.id;
                    self.wcbNatureCode = res.code || null;
                    self.wcbNatureDescription = res.description || null;
                } else {
                    self.wcbAreaCodeId = res.id;
                    self.wcbAreaCode = res.code || null;
                    self.wcbAreaDescription = res.description || null;
                }
            },

            bindInsurance: function (element_id, res) {
                var self = this;
                var payer_type;
                var coverage_level;
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
                        self.displayClaimStatusByProvider(self.priInsCode);
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

                if (app.billingRegionCode === 'can_BC' && self.isProviderChiropractor && res.insurance_code.toLowerCase() === 'msp') {
                    $('#ddlClaimResponsible').val('PPP');
                }

                self.isSplitClaimEnabled = res.is_split_claim_enabled;
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

            updateInsAddress: function (level, res) {
                var insuranceInfo = res.insurance_info || null;
                var csz = insuranceInfo.City + (commonjs.checkNotEmpty(insuranceInfo.State) ? ',' + insuranceInfo.State : "") + (commonjs.checkNotEmpty(insuranceInfo.ZipCode) ? ',' + insuranceInfo.ZipCode : "");

                $('#lbl' + level + 'InsPriAddr').html(insuranceInfo.Address1);

                $('#lbl' + level + 'InsCityStateZip').html(csz);

                $('#lbl' + level + 'PhoneNo').html(insuranceInfo.PhoneNo);
            },

            assignExistInsurance: function (e) {
                var self = this;
                var id = e.target.id;
                var patientInsID = $('#' + id + ' option:selected').val();

                if (patientInsID > 0) {
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
                var self = this;
                var flag;
                if (result) {
                    switch (coverageLevel) {
                        case 'primary':
                            this.primaryPatientInsuranceId = result.id;
                            this.priInsID = result.insurance_provider_id;
                            this.priInsCode = result.insurance_code;
                            this.priInsName = result.insurance_name;
                            flag = 'Pri';
                            // append to ResponsibleList
                            this.updateResponsibleList({
                                payer_type: 'PIP_P',
                                payer_id: result.insurance_provider_id,
                                payer_name: result.insurance_name + '( Primary Insurance )',
                                billing_method: result.billing_method
                            }, null);
                            this.is_primary_available = true;
                            this.priClaimInsID = result.id;
                            this.isSplitClaimEnabled = result.is_split_claim_enabled;
                            this.displayClaimStatusByProvider(this.priInsCode);
                            break;

                        case 'secondary':
                            this.secondaryPatientInsuranceId = result.id;
                            this.secInsID = result.insurance_provider_id;
                            this.secInsCode = result.insurance_code;
                            this.SecInsName = result.insurance_name;
                            flag = 'Sec';
                           // append to ResponsibleList
                            this.updateResponsibleList({
                                payer_type: 'PIP_S',
                                payer_id: result.insurance_provider_id,
                                payer_name: result.insurance_name + '( Secondary Insurance )',
                                billing_method: result.billing_method
                            }, null);
                            this.is_secondary_available = true;
                            this.secClaimInsID = result.id;
                            break;

                        case 'tertiary':
                            this.tertiaryPatientInsuranceId = result.id;
                            this.terInsID = result.insurance_provider_id;
                            this.terInsCode = result.insurance_code;
                            this.terInsName = result.insurance_name;
                            flag = 'Ter';
                            // append to ResponsibleList
                            this.updateResponsibleList({
                                payer_type: 'PIP_T',
                                payer_id: result.insurance_provider_id,
                                payer_name: result.insurance_name + '( Tertiary Insurance )',
                                billing_method: result.billing_method
                            }, null);
                            this.is_tertiary_available = true;
                            this.terClaimInsID = result.id;
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
                    $('#ddl' + flag + 'Country').val(result.subscriber_country_code);
                     // Append dynamic address details for canadian config
                    var AddressInfoMap = {
                        country: {
                            domId: 'ddl' + flag + 'Country',
                            infoKey: 'subscriber_country_code'
                        },
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
                        },
                        zipCodePlus: {
                            domId: 'txt' + flag + 'ZipPlus',
                            infoKey: 'subscriber_zipcode_plus'
                        }
                    }
                    this.bindCityStateZipTemplate(result, AddressInfoMap, flag);

                    if(result.coverage_level == "secondary" && result.medicare_insurance_type_code != null) {
                        $('#chkSecMedicarePayer').prop('checked', true);
                        $('#selectMedicalPayer').val(result.medicare_insurance_type_code).toggle(true);
                    }
                    setTimeout(function () {
                        if (!self.isEdit) {
                            var responsibleEle = $('#ddlClaimResponsible');
                            var responsibleIndex = _.find(self.responsible_list, function (item) { return item.payer_type == 'PIP_P'; });
                            var val = responsibleIndex && responsibleIndex.payer_id ? 'PIP_P' : 'PPP'

                            if (app.billingRegionCode === 'can_BC' && self.isProviderChiropractor && (!self.priInsCode || self.priInsCode.toLowerCase() === 'msp')) {
                                responsibleEle.val('PPP');
                            }
                            else if (self.ordering_facility_contact_id && app.isMobileBillingEnabled && self.billing_type === 'facility') {
                                responsibleEle.val('POF');
                            }
                            else {
                                responsibleEle.val(val);
                            }
                        }
                    }, 200);

                }
            },

            validatePatientAddress: function (level) {
                var patientAddress = this.patientAddress;
                var isZipPlusExist = false;

                if (getValue(patientAddress.c1country) === 'usa') {
                    isZipPlusExist = ($(this.elIDs[level + 'InsZipPlus']).val() != getValue(patientAddress.c1ZipPlus));
                }

                function getValue(value) {
                    if (typeof value === 'undefined' || typeof value === 'object')
                        return "";

                    return value;
                }

                return $(this.elIDs[level + 'InsAddress1']).val() != getValue(patientAddress.c1AddressLine1) ||
                    $(this.elIDs[level + 'InsAddress2']).val() != getValue(patientAddress.c1AddressLine2) ||
                    $(this.elIDs[level + 'InsCountry']).val() != getValue(patientAddress.c1country) ||
                    $(this.elIDs[level + 'InsCity']).val() != getValue(patientAddress.c1City) ||
                    $(this.elIDs[level + 'InsState']).val() != getValue(patientAddress.c1State) ||
                    $(this.elIDs[level + 'InsZipCode']).val() != getValue(patientAddress.c1Zip) || isZipPlusExist
            },

            validateHealthNumberInputCanada: function (_eleId) {
                var self = this;
                var _ele = '#' + _eleId;

                if ($(_ele).val().length > 0 && app.country_alpha_3_code === 'can' && self.patientAddress.c1country === 'can') {
                    var state = self.isUpdatePatientInfo ? $.trim($('#ddlPriState option:selected').val()) : self.patientAddress.c1State;
                    var _obj = _.find(commonjs.healthNumberValidation, { province_code: state || '' });

                    if (_obj) {
                        var pattern = new RegExp(_obj.regexp);
                        return !pattern.test($(_ele).val());
                    }
                    return true;
                }

                return false;
            },

            getSkillCodeId: function() {
                var can_ahs_skill_code_id = null;

                if (app.billingRegionCode === 'can_AB') {
                    can_ahs_skill_code_id = this.ACSelect && this.ACSelect.skillCodes ? this.ACSelect.skillCodes.ID : null;
                }

                return can_ahs_skill_code_id;
            },

            setClaimDetails: function () {
                var self = this;
                var claim_model = {};
                var billingMethod;
                claim_model.insurances = [];
                var isUpdatePatientInfo = false;
                var currentResponsible = _.find(self.responsible_list, function(d) { return d.payer_type == $('#ddlClaimResponsible').val(); });
                var currentPayer_type = $('#ddlClaimResponsible').val().split('_')[0];
                var facility_id = $('#ddlFacility option:selected').val() != '' ? parseInt($('#ddlFacility option:selected').val()) : null;
                var isCauseCode = $('#chkEmployment').prop('checked') || $('#chkAutoAccident').prop('checked') || $('#chkOtherAccident').prop('checked');
                var submissionCodeId = parseInt($('#ddlSubmissionCode').val()) || null;
                var isEmployed = $('#chkEmployment').prop('checked');
                var autoAccident = $('#chkAutoAccident').prop('checked');
                var claimSubmissionCodes = this.claimSubmissionCodes.toJSON();

                if (!submissionCodeId) {
                    var submissionCode = '0';

                    if (isEmployed) {
                        submissionCode = 'W';
                    } else if (autoAccident) {
                        submissionCode = 'I';
                    }

                    claimSubmissionCodes && claimSubmissionCodes.forEach(function (ele) {
                        if (ele.code === submissionCode) {
                            submissionCodeId = ele.id;
                        }
                    });
                }

                if (currentPayer_type == "PIP") {
                    billingMethod = currentResponsible.billing_method || null;
                } else if (currentPayer_type == "PPP") {
                    billingMethod = 'patient_payment';
                } else {
                    billingMethod = 'direct_billing';
                }

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
                    subscriber_country_code: $('#ddlPriCountry').val(),
                    subscriber_city: $('#txtPriCity').val(),
                    subscriber_state: $('#ddlPriState option:selected').val() || null,
                    subscriber_zipcode: $('#txtPriZipCode').val() != '' ? $('#txtPriZipCode').val() : null,
                    subscriber_zipcode_plus: $('#ddlPriCountry').val() === "usa" ? $.trim($('#txtPriZipPlus').val()) : null,
                    assign_benefits_to_patient: $('#chkPriAcptAsmt').prop("checked"),
                    medicare_insurance_type_code: null,
                    valid_from_date: $('#txtPriStartDate').val() != '' ? commonjs.getISODateString($('#txtPriStartDate').val()) : null,
                    valid_to_date: $('#txtPriExpDate').val() != '' ? commonjs.getISODateString($('#txtPriExpDate').val()) :null,
                    is_deleted: !!(self.priClaimInsID && self.priInsID == ''),
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
                    subscriber_country_code: $('#ddlSecCountry').val(),
                    subscriber_city: $('#txtSecCity').val(),
                    subscriber_zipcode: $('#txtSecZipCode').val() != '' ? $('#txtSecZipCode').val() : null,
                    subscriber_zipcode_plus: $('#ddlSecCountry').val() ? $.trim($('#txtSecZipPlus').val()) : null,
                    subscriber_state: $('#ddlSecState option:selected').val() || null,
                    assign_benefits_to_patient: $('#chkSecAcptAsmt').prop("checked"),
                    subscriber_dob: $('#txtSecDOB').val() != '' ? commonjs.getISODateString($('#txtSecDOB').val()) : null,
                    medicare_insurance_type_code: $('#selectMedicalPayer option:selected').val() != '' ? parseInt($('#selectMedicalPayer option:selected').val()) : null,
                    valid_from_date: $('#txtSecStartDate').val() != '' ? commonjs.getISODateString($('#txtSecStartDate').val()) : null,
                    valid_to_date: $('#txtSecExpDate').val() != '' ? commonjs.getISODateString($('#txtSecExpDate').val()) : null,
                    is_deleted: !!(self.secClaimInsID && self.secInsID == ''),
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
                    subscriber_country_code: $('#ddlTerCountry').val(),
                    subscriber_city: $('#txtTerCity').val(),
                    subscriber_zipcode: $('#txtTerZipCode').val() != '' ? $('#txtTerZipCode').val() : null,
                    subscriber_zipcode_plus: $('#ddlTerCountry').val() === "usa" ? $.trim($('#txtTerZipPlus').val()) : null,
                    subscriber_state: $('#ddlTerState option:selected').val() || null,
                    assign_benefits_to_patient: $('#chkTerAcptAsmt').prop("checked"),
                    subscriber_dob: $('#txtTerDOB').val() != '' ? commonjs.getISODateString($('#txtTerDOB').val()) : null,
                    medicare_insurance_type_code: null,
                    valid_from_date: $('#txtTerStartDate').val() != '' ? commonjs.getISODateString($('#txtTerStartDate').val()) : null,
                    valid_to_date: $('#txtTerExpDate').val() != '' ? commonjs.getISODateString($('#txtTerExpDate').val()) : null,
                    is_deleted: !!(self.terClaimInsID && self.terInsID == ''),
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

                var can_ahs_skill_code_id = self.getSkillCodeId(currentPayer_type);

                var can_ahs_pay_to_code = $('#ddlPayToCode').val();
                var claim_status_id = ~~$('#ddlClaimStatus').val() || null;
                var claim_Study_date = $('#txtClaimDate').val();
                var delayReasonId = $('#ddlDelayReasons option:selected').val();
                var dateOfReferral = $('#txtDateOfReferral').val();
                var injury_details = app.billingRegionCode === "can_AB" && !$('#divInjury').is(':hidden')
                    ? _.filter(self.injuryDetailsView.injuryDetails, function (data) {
                            return data.injury_id && data.body_part_code;
                        })
                    : [];

                claim_model.claims = {
                    claim_id: self.claim_Id,
                    company_id: app.companyID,
                    facility_id: facility_id,
                    patient_id: parseInt(self.cur_patient_id) || null,
                    billing_provider_id: $('#ddlBillingProvider option:selected').val() != '' ? parseInt($('#ddlBillingProvider option:selected').val()) : null,
                    delay_reason_id: delayReasonId != '' ? parseInt(delayReasonId) : null,
                    rendering_provider_contact_id: self.ACSelect && self.ACSelect.readPhy ? self.ACSelect.readPhy.contact_id : null,
                    facility_rendering_provider_contact_id: self.facility_rendering_provider_contact_id || null,
                    study_rendering_provider_contact_id: self.study_rendering_provider_contact_id || null,
                    can_ahs_skill_code_id: can_ahs_skill_code_id || null,
                    referring_provider_contact_id: self.ACSelect && self.ACSelect.refPhy ? self.ACSelect.refPhy.contact_id : null,
                    ordering_facility_contact_id: self.ordering_facility_contact_id || null,
                    place_of_service_id: ["can_MB", "can_ON"].indexOf(app.billingRegionCode) === -1 && $('#ddlPOSType option:selected').val() != '' ? parseInt($('#ddlPOSType option:selected').val()) : null,
                    technical_place_of_service: app.isMobileBillingEnabled && self.is_split_claim && self.technicalPlaceOfService || '',
                    billing_code_id: $('#ddlBillingCode option:selected').val() != '' ? parseInt($('#ddlBillingCode option:selected').val()) : null,
                    billing_class_id: $('#ddlBillingClass option:selected').val() != '' ? parseInt($('#ddlBillingClass option:selected').val()) : null,
                    created_by: app.userID,
                    claim_dt: $("#txtClaimDate").prop('disabled') ? self.claim_dt_iso : commonjs.shiftToFacilityTimeZone(facility_id, claim_Study_date).format('YYYY-MM-DD LT z'),
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
                    manual_review_indicator: $('#chkManualReviewIndicator').prop('checked'),
                    original_reference: $.trim($('#txtOriginalRef').val()),
                    authorization_no: $.trim($('#txtAuthorization').val()),
                    frequency: $('#ddlFrequencyCode option:selected').val() != '' ? $('#ddlFrequencyCode option:selected').val() : null,
                    can_submission_code_id: submissionCodeId,
                    is_auto_accident: $('#chkAutoAccident').prop('checked'),
                    is_other_accident: $('#chkOtherAccident').prop('checked'),
                    is_employed: $('#chkEmployment').prop('checked'),
                    can_wcb_referral_date: commonjs.checkNotEmpty(dateOfReferral) ? commonjs.getISODateString(dateOfReferral) : null,
                    accident_state: isCauseCode && $('#selAccidentState').val() || null,
                    service_by_outside_lab: $('#chkOutSideLab').prop('checked'),
                    claim_status_id: claim_status_id,
                    primary_patient_insurance_id: self.is_primary_available && parseInt(self.primaryPatientInsuranceId) || ( self.is_primary_available && parseInt(self.priClaimInsID) || null ),
                    secondary_patient_insurance_id: self.is_secondary_available && parseInt(self.secondaryPatientInsuranceId) || ( self.is_secondary_available && parseInt(self.secClaimInsID) || null ),
                    tertiary_patient_insurance_id: self.is_tertiary_available && parseInt(self.tertiaryPatientInsuranceId) || ( self.is_tertiary_available && parseInt(self.terClaimInsID) || null ),
                    can_ahs_pay_to_code: can_ahs_pay_to_code,
                    can_ahs_pay_to_uli: "",
                    can_ahs_pay_to_details: null,
                    can_ahs_business_arrangement: self.can_ahs_business_arrangement || null,
                    can_ahs_locum_arrangement: self.can_ahs_locum_arrangement || null,
                    can_ahs_claimed_amount_indicator: $('#chkClaimedAmountIndicator').prop('checked') || false,
                    can_confidential: $('#chkConfidential').prop('checked') || false,
                    can_ahs_paper_supporting_docs: $('#chkSupportingDocumentationSeparate').prop('checked') || false,
                    can_ahs_newborn_code: $.trim($('#ddlNewbornCode option:selected').val()) || null,
                    can_ahs_emsaf_reason: $.trim($('#txtReasonAdditionalCompensation').val()) || null,
                    can_supporting_text: $.trim($.trim($('#txtSupportingText').val()).replace(/\n/g, ' ')),
                    can_wcb_rejected: $("#chkwcbRejected").prop('checked') || false,
                    wcb_injury_area_code: self.wcbAreaCodeId || null,
                    wcb_injury_nature_code: self.wcbNatureCodeId || null,
                    billing_type: (app.isMobileBillingEnabled && self.billing_type) || 'global',
                    is_split_claim: app.isMobileBillingEnabled && self.is_split_claim,
                    order_id: self.options && self.options.order_id,
                    is_mobile_billing_enabled: app.isMobileBillingEnabled,
                    is_split_claim_enabled: self.is_primary_available && self.isSplitClaimEnabled,
                    can_ahs_encounter_no: $('#txtEncounterNo').val(),
                    can_issuer_id: self.ACSelect && self.ACSelect.patientAltAccNo
                        ? self.ACSelect.patientAltAccNo.issuer_id
                        : null,
                    wcb_injury_details: JSON.stringify(injury_details),
                    deleted_injury_level: self.getDeletedInjuryLevels(),
                    pos_map_code: $('#ddlServiceFacilityLocation option:selected').val() || null
                };

                // Pay-to Details are only saved when Pay-to Code is Other
                if (can_ahs_pay_to_code === "OTHR") {
                    var can_ahs_pay_to_uli = $.trim($('#txtPayToUli').val());
                    var can_ahs_pay_to_details = null;

                    if (!can_ahs_pay_to_uli) {
                        var birth_date = $.trim($('#txtPayToDetailsDOB').val());
                        can_ahs_pay_to_details = {
                            person_type: $.trim($('#ddlPayToDetailsPersonType').val()),
                            first_name: $.trim($('#txtPayToDetailsFirstName').val()),
                            middle_name: $.trim($('#txtPayToDetailsMiddleName').val()),
                            last_name: $.trim($('#txtPayToDetailsLastName').val()),
                            birth_date: birth_date ? moment(birth_date, 'L').format('YYYYMMDD') : '',
                            gender_code: $.trim($('#ddlPayToDetailsGender').val()),
                            address1: $.trim($('#txtPayToDetailsAddr1').val()),
                            address2: $.trim($('#txtPayToDetailsAddr2').val()),
                            address3: $.trim($('#txtPayToDetailsAddr3').val()),
                            city: $.trim($('#txtPayToDetailsCity').val()),
                            province_code: $.trim($('#ddlPayToDetailsProvince').val()),
                            postal_code: $.trim($('#txtPayToDetailsPostalCode').val()),
                            country_code: $.trim($('#ddlPayToDetailsCountryCode').val())
                        }

                        // If every property is empty, reset to null
                        if (Object.values(can_ahs_pay_to_details).every(function (x) { return !x })) {
                            can_ahs_pay_to_details = null;
                        }
                    }

                    // Assign these
                    claim_model.claims = Object.assign(claim_model.claims, {
                        can_ahs_pay_to_uli: can_ahs_pay_to_uli,
                        can_ahs_pay_to_details: can_ahs_pay_to_details
                    });
                }

                /*Setting claim charge details*/
                claim_model.charges = [];
                $('#tBodyCharge').find('tr').each(function (index) {
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
                        charge_dt: commonjs.shiftToFacilityTimeZone(facility_id, $('#txtScheduleDate_' + id).val()).format('YYYY-MM-DD LT z') || null,
                        study_id: rowData.study_id || null,
                        is_deleted: false,
                        is_custom_bill_fee: rowData.is_custom_bill_fee || $('#txtBillFee_' + id).attr('data-edit') !== 'false',
                        is_billing_rule_applied: rowData.is_billing_rule_applied || false,
                        is_billing_rule_cpt_add_fee: rowData.is_billing_rule_cpt_add_fee || false,
                        billing_rule_fee: rowData.billing_rule_fee,
                        is_excluded: $('#checkExclude_' + id).is(':checked'),
                        is_canada_billing: app.country_alpha_3_code === 'can',
                        study_cpt_id: rowData.ref_charge_id || null,
                        charge_type: $('#chargeType_' + id).text()
                    });
                    var charges = claim_model.charges[claim_model.charges.length - 1];
                    if(charges) {
                        if(!self.isEdit && charges.isEdit == "false") {
                            charges.bill_fee = 0.00;
                            charges.allowed_amount = 0.00;
                        }
                    }
                });

                // Change Claim status to Pending Submission after correction
                if (app.billingRegionCode === 'can_AB' && self.isEdit) {
                    var claimData = claim_model && claim_model.claims || null;
                    var claimStatusObj = app.claim_status.find(function(e) {
                        return e.id == claimData.claim_status_id;
                    });
                    var pendingSubmissionObj = app.claim_status.find(function(e) {
                        return e.code === 'PS';
                    });

                    claimData.claim_status_id = ['AZP', 'BR', 'R', 'D'].indexOf(claimStatusObj.code) !== -1 ? pendingSubmissionObj.id : claim_status_id;
                }


                // Assign If any charges removed
                claim_model.removed_charges = self.removedCharges || [];

                /*Setting ICD pointers details*/
                claim_model.claim_icds = self.claimICDLists || [];
                // set study Id in claims
                claim_model.claims.study_id = claim_model.charges[0].study_id || null;
                // set claims details
                self.model.set({
                    claim_row_version : self.isEdit ? self.claim_row_version : null,
                    insurances: claim_model.insurances,
                    charges: claim_model.charges,
                    claims: claim_model.claims,
                    claim_icds: claim_model.claim_icds,
                    removed_charges: claim_model.removed_charges,
                    is_alberta_billing: app.billingRegionCode === 'can_AB',
                    isMobileBillingEnabled: app.isMobileBillingEnabled,
                    is_ohip_billing: app.billingRegionCode === 'can_ON',
                    is_us_billing: app.country_alpha_3_code === 'usa',
                    isMobileRadEnabled: app.settings.enableMobileRad,
                    study_cpt_id: claim_model.ref_charge_id || 0
                });

            },

            saveClaimDetails: function () {
                var self = this;
                var saveButton = $('#btnSaveClaim');
                var $claimProcess = $('.claimProcess');

                var currentFilter = commonjs.studyFilters.find(function (filter) {
                    return filter.filter_id == commonjs.currentStudyFilter;
                });

                if (self.validateClaimData()) {
                    self.setClaimDetails();

                    if (!this.hasClaimStudyOrderingFacility()) {
                        return;
                    }

                    $('#divPageLoading').hide();
                    commonjs.showLoading();
                    saveButton.prop('disabled', true);
                    $claimProcess.prop('disabled', true);

                    self.model.save({}, {
                        success: function (model, response) {
                            if (response && response.message) {
                                commonjs.showWarning(response.message);
                                $claimProcess.prop('disabled', false);
                            } else {
                                var result = _.get(response, '[0].result');

                                if (self.isEdit) {
                                    self.claim_row_version = result || null;
                                } else {
                                    self.claim_Id = (_.isArray(result) ? result[0] : result) || null;
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
                                    } else {
                                        $("#btnClaimsRefresh").click();
                                        $("#btnStudiesRefresh").click();
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
                                                'from': self.options && self.options.from || self.openedFrom || null,
                                                split_claim_ids: result && result.split_claim_ids
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

            /**
             * Ensures that the user doesn't manually re-add an inactive insurance
             *
             * @param {string} policy
             * @param {number} provider
             * @param {number} id
             * @param {string} coverage_level
             * @returns {boolean}
             */
            checkForExistingInsurance: function ( policy, provider, id, coverage_level ) {
                var insurances = this.allExistingInsurances;
                if ( !Array.isArray(insurances) ) {
                    return false;
                }
                return insurances.some(function ( info ) {
                    var sameProvider = info.insurance_provider_id === ~~provider;
                    var samePolicy = info.policy_number === policy;
                    var sameCoverageLevel = info.coverage_level === coverage_level;
                    var sameRecord = info.id === ~~id;
                    return sameProvider && samePolicy && sameCoverageLevel && !sameRecord;
                });
            },

            /**
             * Validates insurance to ensure that the user didn't enter the same carrier and policy number for multiple
             * coverage levels (ie. entered the same policy for both primary and secondary coverage)
             *
             * @returns {boolean}
             */
            validateInsuranceDuplication: function () {
                var primary_id = ~~this.priInsID;
                var secondary_id = ~~this.secInsID;
                var tertiary_id = ~~this.terInsID;
                var primary_policy = ($("#txtPriPolicyNo").val() && $("#txtPriPolicyNo").val().trim()) || "";
                var secondary_policy = ($("#txtSecPolicyNo").val() && $("#txtSecPolicyNo").val().trim()) || "";
                var tertiary_policy = ($("#txtTerPolicyNo").val() && $("#txtTerPolicyNo").val().trim()) || "";
                var insurance_dupe_check_array = [];

                if (primary_id > 0) {
                    insurance_dupe_check_array.push(primary_id + "-" + primary_policy);
                }

                if (secondary_id > 0) {
                    insurance_dupe_check_array.push(secondary_id + "-" + secondary_policy);
                }

                if (tertiary_id > 0) {
                    insurance_dupe_check_array.push(tertiary_id + "-" + tertiary_policy);
                }

                return _.isEqual(insurance_dupe_check_array, _.uniq(insurance_dupe_check_array));
            },

            validateClaimData: function () {
                var self = this;
                self.is_primary_available = false;
                self.is_secondary_available = false;
                self.is_tertiary_available = false;
                self.isUpdatePatientInfo = false;
                var isRMBInsurance = self.priInsCode && self.priInsCode.toLowerCase() === 'rmb';
                /* Claims section */
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

                if (!self.ACSelect.refPhy.contact_id && app.billingRegionCode === 'can_AB') {
                    commonjs.showWarning("messages.warning.shared.selectReferringProvider");
                    $('#ddlReferringProvider').focus();
                    return false;
                }

                if ( self.supportingTextRequired && app.country_alpha_3_code === 'can' && app.province_alpha_2_code === 'AB' && !$.trim($.trim($('#txtSupportingText').val()).replace(/\n/g, ' ')) ) {
                    commonjs.showWarning("messages.warning.shared.supportingTextRequired");
                    $('#txtSupportingText').focus();
                    return false;
                }

                if (app.billingRegionCode === 'can_BC') {

                    if (self.isProviderChiropractor && (!self.priInsCode || self.priInsCode.toLowerCase() === 'msp') && $('#ddlClaimResponsible').val() !== 'PPP') {
                        alert(commonjs.geti18NString('messages.warning.shared.responsiblePartyMustBePatient'));
                    }

                    if ($('#chkEmployment').prop('checked') || $('#chkAutoAccident').prop('checked')) {
                        if (!commonjs.checkNotEmpty($('#txtOriginalRef').val())) {
                            commonjs.showWarning("messages.warning.shared.otherClaimNumber");
                            $('#txtOriginalRef').focus();
                            return false;
                        }
                    }
                }

                if (app.billingRegionCode === 'can_AB' && $('#chkEmployment').prop('checked') && !commonjs.checkNotEmpty($('#txtOriginalRef').val())) {
                    commonjs.showWarning("messages.warning.shared.originalRef");
                    $('#txtOriginalRef').focus();
                    return false;
                }

                if ((!$('#txtEncounterNo').val() || $('#txtEncounterNo').val() == 0) && app.billingRegionCode === 'can_AB') {
                    return commonjs.showWarning("messages.warning.shared.pleaseEnterEncounterNumber");
                }

                if (app.isMobileBillingEnabled && self.billing_type === 'census') {
                    return commonjs.showWarning("messages.warning.validBillingType");
                }

                if (app.isMobileBillingEnabled && self.is_split_claim && !self.ordering_facility_contact_id) {
                    var msg = commonjs.geti18NString("messages.confirm.splitClaim").replace('$ACCESSION_NO', self.pri_accession_no);

                    if (!confirm(msg)) {
                        return false;
                    }
                    self.is_split_claim = false;
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
                        $('#txtPriZipCode').val().trim(),
                        $('#select2-ddlPriInsurance-container').text().trim() || ''
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
                        { obj: $('#txtPriZipCode'), msg: 'messages.warning.claims.enterZipcodePrimaryInsurance' },
                        { obj: $('#ddlPriInsurance'), msg: 'messages.warning.claims.selectCarrierPrimaryInsurance' }
                    ]
                }

                var txtPriPolicyNo = ($('#txtPriPolicyNo').val() && $('#txtPriPolicyNo').val().trim()) || '';
                var txtSecPolicyNo = ($('#txtSecPolicyNo').val() && $('#txtSecPolicyNo').val().trim()) || '';
                var txtTerPolicyNo = ($('#txtTerPolicyNo').val() && $('#txtTerPolicyNo').val().trim()) || '';

                if (app.country_alpha_3_code === 'can') {
                    if ( app.province_alpha_2_code === 'ON' && self.priInsCode && ['HCP', 'WSIB'].indexOf(self.priInsCode.toUpperCase()) >= 0) {
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
                        $.trim($('#txtSecPolicyNo').val()),
                        $.trim($('#ddlSecRelationShip option:selected').val()),
                        $.trim($('#txtSecSubFirstName').val()),
                        $.trim($('#txtSecSubLastName').val()),
                        $.trim($('#ddlSecGender').val()),
                        $.trim($('#txtSecDOB').val()),
                        $.trim($('#txtSecSubPriAddr').val()),
                        $.trim($('#txtSecCity').val()),
                        $.trim($('#ddlSecState option:selected').val()),
                        $.trim($('#txtSecZipCode').val()),
                        $.trim($('#select2-ddlSecInsurance-container').text())
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
                        { obj: $('#txtSecZipCode'), msg: 'messages.warning.claims.enterZipcodeSecondaryInsurance' },
                        { obj: $('#ddlSecInsurance'), msg: 'messages.warning.claims.selectCarrierSecondaryInsurance' }
                    ];
                    mandatory_fields.tertiaryfields = [
                        $.trim($('#txtTerPolicyNo').val()),
                        $.trim($('#ddlTerRelationShip option:selected').val()),
                        $.trim($('#txtTerSubFirstName').val()),
                        $.trim($('#txtTerSubLastName').val()),
                        $.trim($('#ddlTerGender').val()),
                        $.trim($('#txtTerDOB').val()),
                        $.trim($('#txtTerSubPriAddr').val()),
                        $.trim($('#txtTerCity').val()),
                        $.trim($('#ddlTerState option:selected').val()),
                        $.trim($('#txtTerZipCode').val()),
                        $.trim($('#select2-ddlTerInsurance-container').text())
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
                        { obj: $('#txtTerZipCode'), msg: 'messages.warning.claims.enterZipcodeTertiaryInsurance' },
                        { obj: $('#ddlTerInsurance'), msg: 'messages.warning.claims.selectCarrierTertiaryInsurance' }
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
                    if (!commonjs.validateFutureDate(commonjs.getISODateString($('#txtPriDOB').val()))) {
                        $("#txtPriDOB").focus();
                        commonjs.showWarning('messages.warning.shared.entervaliddob');
                        return false;
                    }
                    if ( txtPriPolicyNo && self.priInsID > 0 ) {
                        var primaryExists = self.checkForExistingInsurance(txtPriPolicyNo, self.priInsID, self.priClaimInsID, "primary");
                        if ( primaryExists ) {
                            commonjs.showWarning('messages.warning.existsInsurance');
                            $('#txtPriPolicyNo').focus();
                            return false;
                        }
                    }
                    self.is_primary_available = true;
                }
                if (app.country_alpha_3_code !== 'can' && (self.secInsID || !mandatory_fields.secondaryfields.every(checkEmpty))) {
                    if (!self.priInsID) {

                        commonjs.showWarning("messages.warning.claims.priMissingValidation");
                        return false;
                    }


                    if (mandatory_fields.secondaryfields.indexOf('') > -1 || mandatory_fields.secondaryfields.indexOf(null) > -1) {
                        commonjs.showWarning(mandatory_fields.secondaryfieldObjs[mandatory_fields.secondaryfields.indexOf('')].msg);
                        mandatory_fields.secondaryfieldObjs[mandatory_fields.secondaryfields.indexOf('')].obj.focus();
                        // commonjs.showWarning("messages.warning.shared.secInsValidation");
                        return false;
                    }
                    if (!commonjs.validateFutureDate(commonjs.getISODateString($('#txtSecDOB').val()))) {
                        $("#txtSecDOB").focus();
                        commonjs.showWarning('messages.warning.shared.entervaliddob');
                        return false;
                    }
                    if ( txtSecPolicyNo && self.secInsID > 0 ) {
                        var secondaryExists = self.checkForExistingInsurance(txtSecPolicyNo, self.secInsID, self.secClaimInsID, "secondary");
                        if ( secondaryExists ) {
                            commonjs.showWarning('messages.warning.existsInsurance');
                            $('#txtSecPolicyNo').focus();
                            return false;
                        }
                    }
                    self.is_secondary_available = true;

                }
                if (app.country_alpha_3_code !== 'can' && (self.terInsID || !mandatory_fields.tertiaryfields.every(checkEmpty))) {
                    if (!self.secInsID) {

                        commonjs.showWarning("messages.warning.claims.secMissingValidation");
                        return false;
                    }


                        if (mandatory_fields.tertiaryfields.indexOf('') > -1 || mandatory_fields.tertiaryfields.indexOf(null) > -1) {

                            commonjs.showWarning(mandatory_fields.tertiaryfieldObjs[mandatory_fields.tertiaryfields.indexOf('')].msg);
                            mandatory_fields.tertiaryfieldObjs[mandatory_fields.tertiaryfields.indexOf('')].obj.focus();

                            return false;
                        }
                        if (!commonjs.validateFutureDate(commonjs.getISODateString($('#txtTerDOB').val()))) {
                            $("#txtTerDOB").focus();
                            commonjs.showWarning('messages.warning.shared.entervaliddob');
                            return false;
                        }
                        if ( txtTerPolicyNo && self.terInsID > 0 ) {
                            var tertiaryExists = self.checkForExistingInsurance(txtTerPolicyNo, self.terInsID, self.terClaimInsID, "tertiary");
                            if ( tertiaryExists ) {
                                commonjs.showWarning('messages.warning.existsInsurance');
                                $('#txtTerPolicyNo').focus();
                                return false;
                            }
                        }
                        self.is_tertiary_available = true;

                }

                if (!self.validateInsuranceDuplication()) {
                    commonjs.showWarning("messages.warning.order.existsDifferentCoverageLevel", "largewarning");
                    return false;
                }

                if (!self.validateInsuranceDuplication()) {
                    commonjs.showWarning("messages.warning.order.existsDifferentCoverageLevel", "largewarning");
                    return false;
                }

                if (self.priInsID && self.validatePatientAddress("primary")) {
                    self.isUpdatePatientInfo = true;
                }

                if (app.country_alpha_3_code === 'can' && !isRMBInsurance && self.validateHealthNumberInputCanada("txtPriPolicyNo") ) {
                    commonjs.showWarning('messages.warning.shared.invalidHealthNumber');
                    return false;
                }
                /* Charge section */
                var invalidCount = 0;
                var invalidCptDateCount = 0;
                var unmatchedChargeDates = [];

                $("#tBodyCharge").find("tr").each(function (index) {
                    var id = $(this).attr('data_row_id');
                    var $curChargeDt = $(this).find("#txtScheduleDate_" + id);

                    if (!$curChargeDt.val() || !moment($curChargeDt.val()).isValid()) {
                        $curChargeDt.focus();
                        invalidCptDateCount++;
                        return false;
                    }

                    if ($curChargeDt.val() !== $('#txtClaimDate').val()) {
                        unmatchedChargeDates.push(id);
                    }

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

                if (invalidCptDateCount) {
                    return commonjs.showWarning("messages.warning.claims.selectCPTDate");
                }

                if (unmatchedChargeDates.length && !confirm(commonjs.geti18NString('messages.confirm.billing.confirmServiceDateMismatch'))) {
                    return;
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
                var accidentState = $('#selAccidentState');

                if (accidentState.val() && accidentState.val().length === 1) {
                    commonjs.showWarning("order.additionalInfo.accidentStateValidation");
                    accidentState.focus();
                    return false;
                }

                if (app.billingRegionCode === "can_AB" && $('#chkEmployment').prop('checked') && !$('#divInjury').is(':hidden')
                    && self.injuryDetailsView.injuryDetails && self.injuryDetailsView.injuryDetails.length > 0) {
                    var is_injury_detail_empty = false;
                    self.injuryDetailsView.injuryDetails.forEach(function(injury_detail) {
                        if (!is_injury_detail_empty) {
                            is_injury_detail_empty = (!injury_detail.body_part_code || !injury_detail.injury_id
                                                    || (injury_detail.has_orientation && !injury_detail.orientation_code))
                        }
                    });

                    if (is_injury_detail_empty ) {
                        return commonjs.showWarning('messages.warning.shared.selectInjury', 'mediumwarning');
                    }
                }

                if (self.wcf.date() || self.wct.date()) {
                    if (!self.validateFromAndToDate(self.wcf, self.wct))
                        return false;
                }

                if (self.hcf.date() || self.hct.date()) {
                    if (!self.validateFromAndToDate(self.hcf, self.hct))
                        return false;
                    return true;
                }
                return true;

            },

            hasClaimStudyOrderingFacility: function () {
                var charges = _.get(this, "model.attributes.charges");

                for (var i = 0; i < charges.length; i++) {
                    if (charges[i].charge_type === 'ordering_facility_invoice' && !this.ordering_facility_contact_id) {
                        commonjs.showWarning("billing.payments.selectChargeOrderingFacility");
                        $('#ddlOrdFacility').focus();
                        return false;
                    }
                }

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
                                self.subscriber_country_code = contactInfo.c1country;
                                self.city = contactInfo.c1City;
                                self.state = contactInfo.c1State;
                                self.zipCode = contactInfo.c1Zip;
                                self.zipCodePlus = contactInfo.c1ZipPlus;
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

            // Pay-to Code changed
            changePayToCode: function (val) {
                var $businessArrangement = $('input[name="BusinessArrangement"]');

                if (val === 'RECP') {
                    $businessArrangement.prop('checked', false);
                    $businessArrangement.prop('disabled', true);
                    self.can_ahs_business_arrangement = null;
                    self.can_ahs_locum_arrangement = null;
                } else if ($businessArrangement.prop("disabled")) {
                    $businessArrangement.prop('disabled', false);
                    var payToValue = this.getPayToValue();
                    $businessArrangement.val([payToValue]);
                }
                (val === 'OTHR')
                    ? $('#divPayToDetails').show()
                    : $('#divPayToDetails').hide();
            },

            // Pay-to ULI lost focus and form load
            blurPayToUli: function (val) {
                (val === '')
                    ? $('#divPayToDetailsNoUli').show()
                    : $('#divPayToDetailsNoUli').hide();
            },

            bindSubscriber: function (flag) {
                var self = this;
                var level = null;
                switch (flag) {
                    case 'Pri': level = 0; break;
                    case 'Sec': level = 1; break;
                    case 'Ter': level = 2; break;
                }
                var relationShip = $.trim($('#ddl' + flag + 'RelationShip option:selected').text().toLowerCase());
                $('#txt' + flag + 'SubFirstName').val('');
                $('#txt' + flag + 'SubLastName').val('');
                $('#txt' + flag + 'SubMiName').val('');
                $('#txt' + flag + 'SubSuffix').val('');
                $('#ddl' + flag + 'Gender').val('');

                self.showZipPlus($('#txt' + flag + 'ZipPlus'), $('#ddl' + flag + 'Country').val());

                if (self.checkAddressDetails(flag)) {
                    var msg = commonjs.geti18NString("messages.confirm.billing.changeAddressDetails");

                    if (confirm(msg)) {
                        $('#txt' + flag + 'SubPriAddr').val('');
                        $('#txt' + flag + 'SubSecAddr').val('');
                        $('#ddl' + flag + 'Country').val('');
                        $('#txt' + flag + 'City').val('');
                        $('#ddl' + flag + 'State').val('');
                        $('#txt' + flag + 'ZipCode').val('');
                        $('#txt' + flag + 'ZipPlus').val('');

                        if (relationShip === "self") {
                            $('#txt' + flag + 'SubPriAddr').val(self.address1);
                            $('#txt' + flag + 'SubSecAddr').val(self.address2);
                        }
                    }
                }
                else {
                    $('#txt' + flag + 'SubPriAddr').val(self.address1);
                    $('#txt' + flag + 'SubSecAddr').val(self.address2);
                    $('#ddl' + flag + 'Country').val(self.subscriber_country_code);
                    $('#txt' + flag + 'City').val(self.city);
                    $('#ddl' + flag + 'State').val(self.state);
                    $('#txt' + flag + 'ZipCode').val(self.zipCode);
                }
                if (relationShip == "self") {
                    $('#txt' + flag + 'SubFirstName').val(self.firstName);
                    $('#txt' + flag + 'SubLastName').val(self.lastName);
                    $('#txt' + flag + 'SubMiName').val(self.mi);
                    $('#txt' + flag + 'SubSuffix').val(self.suffix);
                    $('#ddl' + flag + 'Gender').val(self.gender);
                    $('#ddl' + flag + 'Country').val(self.subscriber_country_code);

                    self.bindCityStateZipTemplate(self, this.cszFieldMap[level], flag);
                    $('#txt' + flag + 'City').val(self.city);
                    $('#ddl' + flag + 'State').val(self.state);
                    $('#txt' + flag + 'ZipCode').val(self.zipCode);
                    $('#txt' + flag + 'ZipPlus').val(self.zipCodePlus);
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

                return true;

            },

            resetInsurances: function (e) {

                var self = this;
                var flag;
                var payer_type;
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
                    $('#txt' + flag + 'ZipPlus').val('');

                    document.querySelector('#txt' + flag + 'DOB').value = '';
                    document.querySelector('#txt' + flag + 'StartDate').value = '';
                    document.querySelector('#txt' + flag + 'ExpDate').value = '';

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
                        country: app.country_alpha_3_code,
                        billingRegionCode: app.billingRegionCode
                    },
                    success: function(data){
                        $("#btnValidateClaim").prop("disabled", false);
                        if (data) {
                            commonjs.hideLoading();
                            var isPreviousValidationResultExist = commonjs.previousValidationResults && commonjs.previousValidationResults.result && commonjs.previousValidationResults.result.length || 0;

                            if (!data.invalidClaim_data.length) {
                                commonjs.showStatus("messages.status.validatedSuccessfully");

                                if (data.validClaim_data && data.validClaim_data.rows && data.validClaim_data.rows.length) {
                                    var validClaimData = data.validClaim_data.rows[0] || {};

                                    self.claim_row_version = validClaimData.claim_row_version || self.claim_row_version;
                                    $('#ddlClaimStatus').val(validClaimData.claim_status_id);
                                    var pending_submission_status = app.claim_status.filter(function (obj) {
                                        return obj.id === parseInt(validClaimData.claim_status_id)
                                    });
                                    var statusDetail = commonjs.getClaimColorCodeForStatus(pending_submission_status[0].code, 'claim');
                                    var color_code = statusDetail && statusDetail[0] && statusDetail[0].color_code || 'transparent';
                                    var $gridId = self.options && self.options.grid_id || '';
                                    var pageSource = self.options && self.options.from || '';
                                        $gridId = $gridId.replace(/#/, '');

                                    if ($gridId) {
                                        $('#' + $gridId + ' tr#' + self.claim_Id, parent.document).find('td[aria-describedby=' + $gridId + '_claim_status]').text(pending_submission_status && pending_submission_status[0].description).css("background-color", color_code);
                                        self.isClaimStatusUpdated =  true;
                                    } else if (pageSource !== 'patientSearch' && $gridId == '') {
                                        commonjs.showWarning(commonjs.geti18NString("messages.errors.gridIdNotExists"));
                                    }

                                    // Removed Validated claim data from Invalid validation bucket list
                                    if (isPreviousValidationResultExist) {
                                        commonjs.previousValidationResults.result = _.reject(commonjs.previousValidationResults.result, { id: validClaimData.id });
                                    }
                                }
                            }
                            else {
                                var inValidClaimData = data.invalidClaim_data[0] || {};

                                if (isPreviousValidationResultExist) {
                                    // Assign the re-validated claim result to the invalid bucket list. Modified object reference data, so no variable allocation is required.
                                    _.map(commonjs.previousValidationResults.result, function (obj) {
                                        if (obj.id === inValidClaimData.id) {
                                            Object.assign(obj, inValidClaimData)
                                        }
                                        return obj;
                                    });
                                }

                                commonjs.showNestedDialog({
                                    header: 'Validation Results',
                                    i18nHeader: 'billing.claims.validationResults',
                                    width: '70%',
                                    height: '60%',
                                    html: self.claimValidation({ response_data: data.invalidClaim_data }),
                                    onShown: function () {
                                        $('#revalidateClaim').hide();
                                        $('.processClaimEdit').removeClass('processClaimEdit');
                                    }
                                 });
                            }
                        }
                    },
                    error: function (err, response) {
                        $("#btnValidateClaim").attr("disabled", false);
                        commonjs.handleXhrError(err, response);
                    }
                })
            },

            //EXA-18273 - Getting charges created for a patient on current date will be displayed for alberta billing
            getPatientCharges: function (id, selectedCharges) {
                var self = this;

                $.ajax({
                    url: '/exa_modules/billing/claims/claim/get_patient_charges',
                    type: 'GET',
                    data: {
                        patient_id: id,
                        current_date: moment(self.studyDate, 'L').format('YYYY-MM-DD')
                    },
                    success: function (data) {
                        var chargeRow;
                        // Bind Study date of the current claim for the patient
                        $('#patientStudyDate').text(self.studyDate || '');
                        if (!data || !data.length) {
                            chargeRow = self.patientChargesTemplate({row: []});
                        } else {
                            var cpts_selected = _.map(selectedCharges, 'cpt_id');

                            _.each(data, function (obj, index) {
                                obj.data_row_id = index;
                                obj.cpt_available = cpts_selected.indexOf(obj.cpt_id) !== -1;
                                obj.study_time = obj.study_time && commonjs.convertToFacilityTimeZone(app.default_facility_id, obj.study_time).format('hh:mm A');
                            });
                            chargeRow = self.patientChargesTemplate({
                                row: data,
                                selected_charges: selectedCharges
                            });
                        }

                        $('#patientChargesBody').empty().append(chargeRow);
                        commonjs.updateCulture(app.current_culture, commonjs.beautifyMe);
                    },
                    error: function (err, response) {
                        commonjs.handleXhrError(err, response);
                    }
                });
            },

            triggerBusinessArrangement: function () {
                var self = this;

                self.can_ahs_business_arrangement = '';
                self.can_ahs_locum_arrangement = '';
                var $businessArrangement = $('input[name="BusinessArrangement"]');
                var payToValue = self.getPayToValue();

                $businessArrangement
                    .off('change')
                    .on('change', function () {
                        if (this.checked) {
                            var value = $(this).val();
                            self.setBusinessArrangement(value);
                        }
                    })
                    .val([payToValue]);

                $businessArrangement.trigger('change');
            },

            getBusinessArrangement: function (facility_id, rendering_provider_id) {
                var self = this;

                if (!facility_id || !rendering_provider_id) {
                    self.can_ahs_business_arrangement_facility = '';
                    self.can_ahs_locum_arrangement_provider = '';
                    self.triggerBusinessArrangement();
                    return;
                }

                $.ajax({
                    url: '/exa_modules/billing/claims/claim/business_arrangement',
                    type: 'GET',
                    data: {
                        facility_id: facility_id,
                        rendering_provider_id: rendering_provider_id
                    },
                    success: function (data) {
                        self.can_ahs_business_arrangement_facility = data[0].can_ahs_business_arrangement_facility;
                        self.can_ahs_locum_arrangement_provider = data[0].can_ahs_locum_arrangement_provider;

                        self.triggerBusinessArrangement();
                    },
                    error: function (err, response) {
                        commonjs.handleXhrError(err, response);
                    }
                })
            },

            processClaim: function (e) {
                var self = this;
                var currentRowID;
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
                        $(e.target).prop('disabled', true);
                        $('#btnSaveClaim').prop('disabled', true);
                        var data = parentGrid.getRowData(rowId);
                        if (data.hidden_claim_id == self.claim_Id) {
                            nextRowData = $(e.target).attr('id') == 'btnPrevClaim' ? nextRowData.prev() : nextRowData.next();
                            rowId = nextRowData.attr('id');
                            data = parentGrid.getRowData(rowId);
                            if(!rowId) {
                                commonjs.showWarning("messages.warning.claims.orderNotFound");
                                $(e.target).prop('disabled', false);
                                return;
                            }
                        }
                        self.clearInsuranceFields(true, ['Pri', 'Sec', 'Ter']);

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
                            self.updateReportURL();
                            self.disableElementsForProvince(data);
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
                                    'grid_id': self.options.grid_id || null,
                                    split_claim_ids: result && result.split_claim_ids
                                });

                                self.updateReportURL();
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

            updateReportURL: function () {
                if (window.reportWindow && window.reportWindow.location.hash) {
                    commonjs.openDocumentsAndReports(this.options);
                }
            },

            bindTabMenuEvents: function () {
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
                    $("#div_patient_claims").hide();
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
                    patientList.birth_date = moment(patientList.birth_date).format('L');
                    var patient_info = commonjs.hstoreParse(patientList.patient_info);
                    var owner_info = commonjs.hstoreParse(patientList.owner_info);
                    patientList.phone = (patient_info.c1HomePhone) ? patient_info.c1HomePhone : '';
                    patientList.address1 = (patient_info.c1AddressLine1) ? patient_info.c1AddressLine1 : '';
                    patientList.address2 = (patient_info.c1AddressLine2) ? patient_info.c1AddressLine2 : '';
                    patientList.country = (patient_info.c1country) ? patient_info.c1country : '';
                    patientList.zip = (patient_info.c1Zip) ? patient_info.c1Zip : '';
                    patientList.zipplus = patient_info.c1ZipPlus || '';
                    patientList.country = (patient_info.c1country) ? patient_info.c1country : '';
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
                var $target = $(e.target || e.srcElement).closest('#patient-search-result');

                self.cur_patient_id = patientId || 0;

                if (!$studyDetails.is(':visible')) {

                    $('.studyDetails').empty();
                    $('.studyDetails').hide();

                    if ($target.length) {
                        $('#div_patient_recent_search').removeClass('col-5').addClass('col-2');
                        $('#patient-search-result').removeClass('col-2').addClass('col-5');
                    } else {
                        $('#div_patient_recent_search').removeClass('col-2').addClass('col-5');
                        $('#patient-search-result').removeClass('col-5').addClass('col-2');
                    }

                    var $list = $('<ul class="studyList"></ul>');
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

                            var patient_info = commonjs.hstoreParse(patient_details.patient_info);
                            var patientDetailsFormatted = {
                                owner_id: 0,
                                showOwner: false,
                                is_active: patient_details.is_active,
                                id: btoa(patient_details.patient_id) || '',
                                last_name: patient_details.last_name || '',
                                full_name: patient_details.patient_name || '',
                                account_no: patient_details.patient_account_no || '',
                                first_name: patient_details.first_name || '',
                                facility_id: patient_details.facility_id || '',
                                alt_account_no: patient_details.alt_account_no || '',
                                dicom_patient_id: patient_details.dicom_patient_id || '',
                                phone: patient_info.c1HomePhone || '',
                                home: patient_info.c1HomePhone || '',
                                work: patient_info.c1WorkPhone || '',
                                mobile: patient_info.c1MobilePhone || '',
                                address1: patient_info.c1AddressLine1 || '',
                                address2: patient_info.c1AddressLine2 || '',
                                zip: patient_info.c1Zip || '',
                                city: patient_info.c1City || '',
                                state: patient_info.c1State || '',
                                birth_date: moment(commonjs.getDateFormat(patient_details.patient_dob)).format('L')
                            };

                            if (charges && charges.length) {
                                $studyDetails.empty();
                                $list.empty();
                                _.each(charges, function (study) {
                                    study.study_description = study.study_description ? study.study_description : '--';
                                    study.accession_no = study.accession_no ? study.accession_no : '--';
                                    study.billing_type = app.isMobileBillingEnabled && study.billing_type ? study.billing_type : 'global';
                                    var study_date = commonjs.getConvertedFacilityTime(study.study_dt, app.currentdate, 'L', app.facility_id);
                                    $list.append('<li><input class="processStudy" id="studyChk_' + study.id + '" type="checkbox" name="chkStudy" data-study_dt="' + study.study_dt + '" data-accession_no="' + study.accession_no
                                    + '" data-billing_type="' + study.billing_type + '" data-facility_id="' + study.facility_id + '" />' +
                                    '<label style="font-weight: bold;overflow-wrap: break-word;"  for="studyChk_' + study.id + '" >' + study.study_description
                                    + ' ( Accession# : ' + study.accession_no + ' , Study.Date: ' + study_date + ')</label></li>');
                                });
                                $studyDetails.append($list);
                                $studyDetails.show();

                                $studyDetails.append($('<button/>').attr({'type':'button', 'i18n': 'billing.fileInsurance.withStudy', 'id':'btnClaimWStudy'}).addClass('btn top-buffer processClaim mr-2').css('height', '33px'));
                                $studyDetails.append('<button style="height:33px;" type="button" i18n="billing.fileInsurance.createWithoutStudy" class="btn top-buffer processClaim" id="btnClaimWOStudy"></button>');
                                commonjs.updateCulture(app.currentCulture, commonjs.beautifyMe);

                                $('.processStudy').click(function () {
                                    var $checkedInputs = $studyDetails.find('input').filter('[name=chkStudy]:checked');
                                    $('#btnClaimWOStudy').prop('disabled', $checkedInputs.length || false);
                                });

                                $('.processClaim').off().click(function (e) {

                                    if ($(e.target).attr('id') == 'btnClaimWStudy') {
                                        var selectedStudies = [];
                                        var $checkedInputs = $studyDetails.find('input').filter('[name=chkStudy]:checked');
                                        var selectedCount = $checkedInputs.length;

                                        if (selectedCount == 0) {
                                            commonjs.showWarning("messages.warning.claims.selectStudyValidation");
                                        } else {
                                            for (var r = 0; r < selectedCount; r++) {
                                                var selectedStudy = $checkedInputs[r];
                                                var studyId = selectedStudy && selectedStudy.id
                                                    ? selectedStudy.id.split('_')[1]
                                                    : 0;
                                                var dataset = selectedStudy && selectedStudy.dataset;
                                                var study_dt = dataset && dataset.study_dt || null;
                                                var accession_no = dataset && dataset.accession_no || null;
                                                var billing_type = dataset && dataset.billing_type || null;
                                                var facilityId = dataset && dataset.facility_id || facility_id;

                                                if (app.isMobileBillingEnabled && billing_type === 'census') {
                                                    return commonjs.showWarning("messages.warning.validBillingType");
                                                }

                                                var study = {
                                                    study_id: studyId,
                                                    patient_id: patientId,
                                                    facility_id: facilityId,
                                                    study_date: commonjs.convertToFacilityTimeZone(facility_id, study_dt).format('MM/DD/YYYY'),
                                                    patient_name: patient_details.patient_name || '',
                                                    account_no: patient_details.patient_account_no || '',
                                                    patient_dob: patient_details.patient_dob || '',
                                                    patient_gender: patient_details.patient_gender || '',
                                                    accession_no: accession_no,
                                                    billing_type: billing_type
                                                };

                                                selectedStudies.push(study);
                                            }

                                            var studyDtGroup = _.groupBy(selectedStudies, 'study_date');
                                            var isStudyDateNotMatched = Object.keys(studyDtGroup).length > 1;

                                            var facilityGroup = _.groupBy(selectedStudies, 'facility_id');
                                            var isFacilityNotMatched = Object.keys(facilityGroup).length > 1;

                                            var billingTypeGroup = _.groupBy(selectedStudies, 'billing_type');
                                            var isBillingTypeNotMatched = Object.keys(billingTypeGroup).length > 1;

                                            if (isStudyDateNotMatched) {
                                                return commonjs.showWarning('messages.warning.claims.sameStudyDtValidate');
                                            }

                                            if (isFacilityNotMatched) {
                                                return commonjs.showWarning('messages.warning.claims.sameFacilityValidate');
                                            }

                                            if (isBillingTypeNotMatched) {
                                                return commonjs.showWarning('messages.warning.claims.sameBillingTypeValidation');
                                            }

                                            var studyIds = selectedStudies.map(function(value) { return value.study_id; });
                                            studyIds = studyIds.join();
                                            window.localStorage.setItem('primary_study_details', JSON.stringify(selectedStudies[0]));
                                            window.localStorage.setItem('selected_studies', JSON.stringify(studyIds));

                                            $('#divPageLoading').show();
                                            commonjs.patientRecentSearchResult(~~patientId, 'addSearchResult', null, patientDetailsFormatted);
                                            self.showClaimForm({ from: 'patientSearch' }, 'patientSearch');

                                            setTimeout(function () {
                                                $('#divPageLoading').hide();
                                                $('.woClaimRelated').show();
                                                $('#divPatient').hide();
                                            }, 200);

                                        }

                                    }
                                    else {
                                        commonjs.patientRecentSearchResult(~~patientId, 'addSearchResult', null, patientDetailsFormatted);
                                        self.claimWOStudy(patient_details);
                                    }

                                });
                            } else {
                                var msg = commonjs.geti18NString("messages.confirm.billing.claimWithOutExam")
                                if (confirm(msg)) {
                                    commonjs.patientRecentSearchResult(~~patientId, 'addSearchResult', null, patientDetailsFormatted);
                                    self.claimWOStudy(patient_details);
                                }

                            }

                        },
                        error: function (err) {
                            commonjs.handleXhrError(err);
                        }
                    });

                    self.patientClaimsPager.set({ "pageNo": 1 });
                    self.getPatientClaims(self.cur_patient_id, true);

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
                    $('#txtClaimCreatedDt').empty();
                    $('#ddlFacility option:contains("Select")').prop("selected", true);
                    $('#ddlBillingProvider option:contains("Select")').prop("selected", true);
                    $('#ddlRenderingProvider, #ddlReferringProvider, #ddlOrdFacility, #ddlSkillCodes, #ddlPhnUli').empty();
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
                    $('#ddl' + flag[i] + 'Country').val(app.country_alpha_3_code);
                    $('#txt' + flag[i] + 'City').val('');
                    $('#ddl' + flag[i] + 'Insurance').val('').trigger('change');
                    $('#ddl' + flag[i] + 'Insurance').find('option').remove();
                    $('#ddl' + flag[i] + 'State option:contains("Select")').prop("selected", true);
                    $('#txt' + flag[i] + 'ZipCode').val('');
                    $('#txt' + flag[i] + 'ZipPlus').val('');
                });

                //clear additional Info Section
                $('#chkEmployment, #chkAutoAccident, #chkOtherAccident, #chkOutSideLab').prop("checked", false);
                $('#txtDate, #txtOtherDate, #txtWCF,#txtWCT, #txtHCF,#txtHCT').val('');
                $('#txtClaimNotes').empty();
                $('#txtOriginalRef, #txtAuthorization, #selAccidentState').val('');
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
                self.toggleWCBInjuryTypes();

                //EXA-18273 - Bind Charges created on current date for a patient.
                if (app.billingRegionCode === 'can_AB') {
                    var $ddlRenderingProvider = $("#ddlRenderingProvider");
                    var $ddlFacility = $("#ddlFacility");

                    $ddlRenderingProvider.on("change", function () {
                        self.RenderingProviderID = $ddlRenderingProvider.val();
                        self.getBusinessArrangement(self.facilityID, self.RenderingProviderID);
                    });

                    $ddlFacility.on("change", function () {
                        self.facilityID = $ddlFacility.val();
                        self.getBusinessArrangement(self.facilityID, self.RenderingProviderID);
                    });

                    self.RenderingProviderID = patient_details.rendering_provider_id;
                    self.facilityID = patient_details.facility_id;
                    self.getBusinessArrangement(self.facilityID, self.RenderingProviderID);
                }

                // Set Default details
                self.updateResponsibleList({
                    payer_type: 'PPP',
                    payer_name: patient_details.patient_name + '( Patient )',
                    payer_id: self.cur_patient_id
                }, null);

                $('#ddlFacility').val(app.facilityID || '');
                $('#ddlClaimStatus').val($("option[data-desc = 'PV']").val());
                $('#txtEncounterNo').val(1); // encounter number always 1 for new claim

                if (patient_details.service_facility_contact_id) {
                    self.updateResponsibleList({
                        payer_type: 'POF',
                        payer_id: patient_details.service_facility_id,
                        payer_name: patient_details.service_facility_name + self.claimResponsible
                    }, null);
                }
                var claimResponsibleEle = $('#ddlClaimResponsible');
                if (patient_details.service_facility_name) {
                    claimResponsibleEle.val('POF');
                }
                else {
                    claimResponsibleEle.val('PPP');
                }

                self.claim_dt_iso = commonjs.convertToFacilityTimeZone(app.facilityID, app.currentdate).format('YYYY-MM-DD LT z');
                self.studyDate = commonjs.getConvertedFacilityTime(app.currentdate, '', 'L', app.facilityID);
                document.querySelector('#txtClaimDate').value = self.studyDate;

                // Bind Patient Default details
                var renderingProvider = patient_details.rendering_provider_full_name || self.usermessage.selectStudyReadPhysician;
                self.ACSelect.readPhy.contact_id = patient_details.rendering_provider_contact_id || null;
                self.facility_rendering_provider_contact_id = patient_details.rendering_provider_contact_id || null;
                self.study_rendering_provider_contact_id = null;
                self.ordering_facility_id = patient_details.service_facility_id || null;
                self.ordering_facility_contact_id = patient_details.service_facility_contact_id || null;
                self.billing_type = patient_details.billing_type || null;
                self.ordering_facility_name = patient_details.service_facility_name;
                self.isClaimWOStudy = true;

                var orderingFacilityName  = self.ordering_facility_name
                    ? self.ordering_facility_name + ' (' + patient_details.service_facility_contact_name + ')' + (patient_details.ordering_facility_type ? ' (' + patient_details.ordering_facility_type + ')' : '')
                    : self.usermessage.selectOrdFacility;

                if (app.isMobileBillingEnabled) {
                    $('.splitNotification').removeClass('hidden');
                }

                if (patient_details.rendering_provider_id) {
                    self.toggleSkillCodeSection();
                }

                if (["can_AB", "can_MB", "can_ON"].indexOf(app.billingRegionCode) === -1) {
                    $('#ddlPOSType').val(patient_details.ord_fac_place_of_service_id || patient_details.fac_place_of_service_id || '');
                }

                $('#ddlBillingProvider').val(patient_details.billing_provider_id || '');
                $('#ddlFacility').val(patient_details.facility_id || '');
                $('#select2-ddlRenderingProvider-container').html(renderingProvider);
                $('#select2-ddlOrdFacility-container').html(orderingFacilityName);
                $('#select2-ddlReferringProvider-container').html(self.usermessage.selectStudyRefProvider);

                var claimDate = commonjs.getConvertedFacilityTime(app.currentdate, '', 'L', app.facilityID);
                $("#txtClaimCreatedDt").val(claimDate);
                $("#txtClaimCreatedDt").prop('disabled', true);

                self.facilityId = patient_details.facility_id;
                self.cur_patient_name = patient_details.patient_name;

                if (app.isMobileBillingEnabled && app.settings.enableMobileRad) {
                    self.appendPOSOptions(patient_details.pos_map_code);
                }

                if (patient_details.patient_alt_acc_nos && app.country_alpha_3_code === 'can') {
                    var patientAltAccNo = self.getDefaultPatientAltAccNo(patient_details.patient_alt_acc_nos);
                    $('#select2-ddlPhnUli-container').text(patientAltAccNo);
                }

                // Claim w/o charge code  -- end

                setTimeout(function () {
                    $('#divPageLoading').hide();
                    self.addPatientHeaderDetails(patient_details, 'create');
                    commonjs.updateCulture(app.currentCulture, commonjs.beautifyMe);
                    $('#divPatient').hide();
                    $('.woClaimRelated').show();
                    self.showAlertBadge();
                    self.getAlertEvent(); // for Patient Alert Button Click event availability

                    var isInsuranceExist = self.responsible_list.filter(function (obj) {
                        return obj.payer_name && ["tertiary_insurance", "secondary_insurance", "primary_insurance"].includes(obj.payer_type_name);
                    }).length > 0;

                    if (!isInsuranceExist) {
                        claimResponsibleEle.val('PPP');
                    }
                }, 200);

                self.openedFrom = 'patientSearch';
                commonjs.validateControls();
            },

            showSelf: function() {
                var priSelf = ($('#ddlPriRelationShip option:selected').text()).toLowerCase();
                var secSelf = ($('#ddlSecRelationShip option:selected').text()).toLowerCase();
                var terSelf = ($('#ddlTerRelationShip option:selected').text()).toLowerCase();

                $.trim(priSelf) == 'self' ? $('#showPriSelf').hide() : $('#showPriSelf').show() ;
                $.trim(secSelf) == 'self' ? $('#showSecSelf').hide() : $('#showSecSelf').show() ;
                $.trim(terSelf) == 'self' ? $('#showTerSelf').hide() : $('#showTerSelf').show() ;
            },

            setPriRelationShipSelf: function() {
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

            setSecRelationShipSelf: function() {
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

            setTerRelationShipSelf: function() {
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
                    { payer_type: "RF", payer_type_name: "referring_provider", payer_id: null, payer_name: null },
                    { payer_type: "PSF", payer_type_name: "service_facility_location", payer_id: null, payer_name: null }
                ]
            },

            insuranceUpdate:function(e){
                var self =this;

                // before clear check is that current responsible/Not.
                var _currentPayerType = $('#ddlClaimResponsible').data('current-payer') || '';
                var id = e.target.id || '';

                var _isCurrentResponsible = id == 'btnResetPriInsurance' && _currentPayerType == 'primary_insurance' ? true
                    : id == 'btnResetSecInsurance' && _currentPayerType == 'secondary_insurance' ? true
                        : !!(id == 'btnResetTerInsurance' && _currentPayerType == 'tertiary_insurance');
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
                var notes = self.patientAlerts && self.patientAlerts.notes || null;
                commonjs.showNestedDialog({
                    header: 'Patient Alerts',
                    i18nHeader: 'menuTitles.patient.patientAlerts',
                    width: '50%',
                    height: '40%',
                    html: self.patientAlertTemplate({ alerts: alerts, others: others, notes: notes })
                });
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

                var modalHeader = $(parent.document).find('#spanModalHeader');

                modalHeader.append($('<a/>', { href: "javascript:void(0)" }).attr({ 'i18n': 'menuTitles.patient.patientChart' })
                        .css(cssObj)
                        .click(function () {
                            var url = '/exa#patient/info/edit/' + btoa(self.cur_patient_id);
                            if (window.patientChartWindow && window.patientChartWindow.location.hash) {
                                window.patientChartWindow.location.hash = '#patient/info/edit/' + btoa(self.cur_patient_id);
                            } else {
                                window.patientChartWindow = window.open("about:blank");
                                window.patientChartWindow.location.href = url;
                                commonjs.bindWindowUnload(window.patientChartWindow, commonjs.closePatientChartWindow);
                            }
                        }));

                if (app.country_alpha_3_code === 'can') {
                    modalHeader.append($('<span>').attr({'i18n': 'patient.advancedSearch.phn', class: 'pl-3'}))
                        .append(':' +  (app.billingRegionCode === 'can_ON' ?
                            (patient_details.p_policy_number || '') :
                            (patient_details && patient_details.phn_acc_no && patient_details.phn_acc_no.alt_account_no || '')));
                }

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
                        _payerIndex = _payerIndex || {};
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
                                    gridData.newPaymentObj.ordering_facility_id = _payerIndex.payer_id || paymentRowData.payer_info.payer_id;
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
                                                    self.createShortCut();
                                                }
                                            }

                                            $.ajax(getPaymentDEtails);
                                        } else {
                                            self.createShortCut();
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

                    if (['cash', 'adjustment'].indexOf(selectedValue) > -1) {
                        $target.prop('disabled', true);
                    } else {
                        $target.prop('disabled', false);
                    }
                });

                self.createShortCut();
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

            addPaymentLine: function () {
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

                self.checkAccountingDateChangePermission(index);
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
                $('#ddlPayerName_' + index).focus();
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

                    self.checkAccountingDateChangePermission(obj.row_index);
                    var dtp = commonjs.bindDateTimePicker("divAccountingDate_" + obj.row_index, { format: 'L' });
                    var responsibleEle = $('#ddlPayerName_' + obj.row_index);
                    var dllPaymentMode = $('#ddlPaymentMode_' + obj.row_index);
                    var $dllCheckCardNo = $('#txtCheckCardNo_' + obj.row_index);
                    var responsibleIndex = _.findIndex(self.responsible_list, function (item) {
                        if(obj.payer_info.payer_type_name === 'insurance' && ['primary_insurance', 'secondary_insurance', 'tertiary_insurance'].indexOf(item.payer_type_name) > -1){
                            return item.payer_id == obj.payer_info.payer_id;
                        }
                            return item.payer_id == obj.payer_info.payer_id && item.payer_type_name === obj.payer_info.payer_type_name;

                    })

                    if (dtp) {
                        self.dtpAccountingDate.push(dtp);
                        self.dtpAccountingDate[index].isModified = false;
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

                    if (['cash', 'adjustment'].indexOf(obj.mode) > -1) {
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

            bindCityStateZipTemplate:function(data, AddressInfoMap, flag){
                address.bindCountrySelectToCityStateZip('#div' + flag + 'AddressInfo', data, AddressInfoMap);
            },

            checkHealthNumberEligiblity: function () {
                if (app.country_alpha_3_code === 'can') {
                    $('label[for=txtPriPolicyNo] span').remove();
                    if (this.priInsCode && ['HCP', 'WSIB'].indexOf(this.priInsCode.toUpperCase()) >= 0) {
                        $('label[for=txtPriPolicyNo]').append("<span class='Required' style='color: red;padding-left: 5px;'>*</span>");
                    }
                }
            },

            checkAccountingDateChangePermission: function (index) {
                var changeAccountingDates = app.userInfo.user_settings && app.userInfo.user_settings.userCanChangeAccountingDates;
                if (!changeAccountingDates || changeAccountingDates === 'false') {
                    $("#txtAccountingDate_" + index).prop('disabled', true);
                    $("#divAccountingDate_" + index + " span").off().on('click', function () {
                        commonjs.showWarning('messages.errors.accessdenied');
                    });
                }
            },

            bindShortCutEvent: function (e) {
                if (!$('.woClaimRelated').length) {
                    return;
                }

                var keyCode = e.keyCode || e.which;
                var isAltkey = e.altKey && !e.ctrlKey;
                var altKey = isAltkey && !e.shiftKey;
                var shiftAlt = e.shiftKey && isAltkey;
                var activeElement;

                switch (keyCode) {
                    case 27:
                        if (!altKey && !shiftAlt) {
                            $('#siteModal').modal('hide');
                            $('#siteModalNested').modal('hide');
                        }
                        break;
                    case 65:
                        activeElement = altKey && 'newClaimNavAddInfo';
                        break;
                    case 66:
                        activeElement = altKey && 'newClaimNavBillSummary';
                        break;
                    case 67:
                        activeElement = shiftAlt ? 'newClaimNavClaims' : altKey && 'newClaimNavCharge';
                        break;
                    case 68:
                        activeElement = altKey && 'btPatientDocuemnt';
                        break;
                    case 73:
                        activeElement = altKey && 'newClaimNavIns';
                        break;
                    case 78:
                        activeElement = shiftAlt ? 'btnNextClaim' : altKey && 'btnPatientNotes';
                        break;
                    case 80:
                        activeElement = shiftAlt ? 'btnPrevClaim' : altKey && 'newClaimNavPayments';
                        break;
                    case 83:
                        activeElement = altKey && 'btnSaveClaim';
                        break;
                    case 86:
                        activeElement = altKey && 'btnValidateClaim';
                        break;
                    case 107:
                        activeElement = altKey && 'btnNewPayment';
                }

                if (activeElement) {
                    $('#' + activeElement).trigger('click');
                }
            },

            createShortCut: function () {
                $document
                    .off('keydown', this.bindShortCutEvent)
                    .on('keydown', this.bindShortCutEvent);
            },

            bindAddressInfo: function (id, data, key) { // Append dynamic address details for canadian config
                var AddressInfoMap = {
                    country: {
                        domId: 'ddl' + id + 'Country',
                        infoKey: (key && key + '_subscriber_country_code') || 'subscriber_country_code'
                    },
                    city: {
                        domId: 'txt' + id + 'City',
                        infoKey: (key && key + '_subscriber_city') || 'subscriber_city'
                    },
                    state: {
                        domId: 'ddl' + id + 'State',
                        infoKey: (key && key + '_subscriber_state') || 'subscriber_state'
                    },
                    zipCode: {
                        domId: 'txt' + id + 'ZipCode',
                        infoKey: (key && key + '_subscriber_zipcode') || 'subscriber_zipcode'
                    },
                    zipCodePlus: {
                        domId: 'txt' + id + 'ZipPlus',
                        infoKey: (key && key + '_subscriber_zipcode_plus') || 'subscriber_zipcode_plus'
                    }
                }
                this.bindCityStateZipTemplate(data || {}, AddressInfoMap, id);
            },

            findRelevantTemplates: function() {
                var self = this;

                $.ajax({
                    url: '/exa_modules/billing/setup/supporting_text/findRelevantTemplates',
                    method: 'POST',
                    data: {
                        cpts: self.associatedCpts,
                        modifiers: self.associatedModifiers
                    }
                }).then(function(response) {
                    var $templateDropdown = $('#ddlSupportingTextOptions');
                    $templateDropdown.empty();
                    $templateDropdown.append('<option value="" i18n="shared.buttons.select">Select</option>');
                    if (response.length > 0) {
                        for (var i = 0; i < response.length; i++) {
                            $templateDropdown.append('<option value="' + response[i].supporting_text + '">' + response[i].template_name + '</option');
                        }
                    } else {
                        $templateDropdown.append('<option disabled value="">' + '(No applicable templates)' + '</option');
                    }
                })
            },

            insertSupportingText: function() {
                var txtSupportingText = $('#txtSupportingText');
                var ddlSupportingTextOptions = $('#ddlSupportingTextOptions');
                var updatedSupportingText = txtSupportingText.val() ? txtSupportingText.val() + ' ' + ddlSupportingTextOptions.val() : ddlSupportingTextOptions.val();

                if (app.billingRegionCode === 'can_BC' && updatedSupportingText.length > 400) {
                    return commonjs.showWarning('messages.warning.shared.supportingText');
                }
                txtSupportingText.val(updatedSupportingText);
            },

            identifyAssociatedCptsAndModifiers: function() {
                var self = this;
                this.associatedCpts = [];
                this.associatedModifiers = [];
                for (var i = 0; i < self.claimChargeList.length; i++) {
                    var index = self.claimChargeList[i];
                    if (index.cpt_id) {
                        self.associatedCpts.push(index.cpt_id);
                    }
                    if (index.modifier1_id) {
                        self.associatedModifiers.push(index.modifier1_id);
                    }
                    if (index.modifier2_id) {
                        self.associatedModifiers.push(index.modifier2_id);
                    }
                    if (index.modifier3_id) {
                        self.associatedModifiers.push(index.modifier3_id);
                    }
                    if (index.modifier4_id) {
                        self.associatedModifiers.push(index.modifier4_id);
                    }
                }
                self.findRelevantTemplates();
            },

            insuranceEligibilityBC: function () {
                var self = this;

                if ($('#txtPriPolicyNo').val().length == 0 && self.priInsCode != '' && 'msp' != self.priInsCode.toLowerCase()) {
                    return commonjs.showWarning('messages.warning.shared.invalidHealthNumber');
                }

                if (!self.phn) {
                    return commonjs.showWarning('messages.warning.phn');
                }
                $.ajax({
                    url: '/exa_modules/billing/bc/validateHealthCard',
                    type: "GET",
                    data: {
                        patient_id: self.cur_patient_id,
                        patient_insurance_id: self.priClaimInsID || self.primaryPatientInsuranceId,
                        eligibility_dt: self.benefitDate1 && self.benefitDate1.date() ? self.benefitDate1.date().format('YYYY-MM-DD') : null,
                        phn: self.phn && self.phn.alt_account_no,
                        birth_date: self.cur_patient_dob,
                        facility_id: self.facilityId || app.default_facility_id
                    },
                    success: function (result) {
                        var data = result.data;
                        var responseCode = result.responseCode;
                        if (responseCode) {
                            switch (responseCode) {
                                case 'error':
                                    commonjs.showWarning('messages.status.communicationError');
                                    break;

                                case 'isDownTime':
                                    commonjs.showWarning('messages.status.downTime');
                                    break;
                            }
                        } else if (data) {
                            var eligibility = _.get(data, "results[0]") || _.get(data, "err[0]") || {};
                            eligibility.BIRTHDATE = (eligibility.BIRTHDATE && commonjs.getFormattedDate(eligibility.BIRTHDATE)) || '';
                            eligibility.DOS = (eligibility.DOS && commonjs.getFormattedDate(eligibility.DOS)) || '';
                            commonjs.showDialog({
                                header: 'Healthcard Eligibility Result',
                                i18nHeader: 'menuTitles.patient.patientInsuranceEligibility',
                                height: '70%',
                                width: '70%',
                                html: self.insuranceBCTemplate({
                                    insuranceData: eligibility,
                                    firstName: self.cur_patient_patient_first_name,
                                    lastName: self.cur_patient_patient_last_name,
                                    healthNumber: self.phn && self.phn.alt_account_no,
                                    gender: self.cur_patient_gender
                                })
                            });
                        }
                    },
                    error: function (request) {
                        commonjs.handleXhrError(request);
                    }
                });
            },

            openSplitClaim: function (id){
                var self = this;
                if (!commonjs.hasModalClosed()) {
                    self.claim_Id = id;
                    commonjs.getClaimStudy(self.claim_Id, function (result) {
                        self.rendered = false;
                        self.clearDependentVariables();

                        self.showEditClaimForm(self.claim_Id, 'reload', {
                            study_id: self.options && self.options.study_id || 0,
                            patient_name: self.options && self.options.patient_name,
                            patient_id: self.options && self.options.patient_id,
                            order_id: self.options && self.options.order_id,
                            grid_id: self.options && self.options.grid_id || null,
                            from: self.options && self.options.from || self.openedFrom || null,
                            split_claim_ids: result && result.split_claim_ids
                        });
                    });
                }
            },

            renderClaimPage: function (claimList, isTotalRecordNeeded) {
                var self = this;

                if (!isTotalRecordNeeded) {
                    self.patientClaimsPager.set({ "chargeTotalRecords": self.chargeTotalRecords });
                    self.patientClaimsPager.set({ "lastPageNo": Math.ceil(self.chargeTotalRecords / self.patientClaimsPager.get('pageSize')) });
                    self.setClaimPaging();
                } else {
                    jQuery.ajax({
                        url: "/exa_modules/billing/claims/claim/claimsby_patient",
                        type: "GET",
                        data: {
                            id: self.cur_patient_id,
                            countFlag: true
                        },
                        success: function (response) {
                            if (response && response.length) {
                                self.claimTotalRecords =  response[0].claims_total_records;
                                self.chargeTotalRecords =  response[0].charges_total_records;
                                self.patientClaimsPager.set({ "lastPageNo": Math.ceil(self.chargeTotalRecords / self.patientClaimsPager.get('pageSize')) });
                                self.setClaimPaging();
                            }
                        },
                        error: function (err) {
                            commonjs.handleXhrError(err);
                        }
                    });
                }

                $('.divPatientClaims').empty();
                $('.divPatientClaims').hide();

                var patClaim = self.patientClaimTemplate({ claimList, facilityId: app.facilityID });
                $('.divPatientClaims').append(patClaim);

                $('.divPatientClaims').show();
                $("#div_patient_claims").show();
                $("#divNoClaims").hide();
            },

            setClaimPaging: function () {

                if (parseInt(this.patientClaimsPager.get('pageNo')) == 1) {
                    this.patientClaimsPager.set({ "previousPageNo": 1 });
                }
                else {
                    this.patientClaimsPager.set({ "previousPageNo": (parseInt(this.patientClaimsPager.get('pageNo'))) - 1 });
                }

                if (parseInt(this.patientClaimsPager.get('pageNo')) >= this.patientClaimsPager.get('lastPageNo')) {
                    this.patientClaimsPager.set({ "nextPageNo": this.patientClaimsPager.get('lastPageNo') });
                }
                else {
                    this.patientClaimsPager.set({ "nextPageNo": (parseInt(this.patientClaimsPager.get('pageNo'))) + 1 });
                }

                if (this.patientClaimsPager.get('pageNo') == 1) {
                    $('#li_first_page').addClass('disabled').attr('disabled', 'disabled');
                    $('#li_previous_page').addClass('disabled').attr('disabled', 'disabled');
                }
                else {
                    $('#li_first_page').removeClass('disabled').removeAttr('disabled');
                    $('#li_previous_page').removeClass('disabled').removeAttr('disabled');
                }

                if (this.patientClaimsPager.get('pageNo') == this.patientClaimsPager.get('lastPageNo')) {
                    $('#li_next_page').addClass('disabled').attr('disabled', 'disabled');
                    $('#li_last_page').addClass('disabled').attr('disabled', 'disabled');
                }
                else {
                    $('#li_next_page').removeClass('disabled').removeAttr('disabled');
                    $('#li_last_page').removeClass('disabled').removeAttr('disabled');
                }

                $('#claimTotalRecords').html(this.claimTotalRecords);
                $('#claimCurrentPage').html(this.patientClaimsPager.get('pageNo'));
                $('#claimTotalPage').html(this.patientClaimsPager.get('lastPageNo'));
            },

            onClaimPaging: function (e) {
                var self = this;
                var id = ((e.target || e.srcElement).tagName == 'I') ? (e.target || e.srcElement).parentElement.id : (e.target || e.srcElement).id;

                if ($('#' + id).closest("li").attr('disabled') != 'disabled') {
                    switch (id) {
                        case "anc_first_page":
                            this.patientClaimsPager.set({ "pageNo": 1 });
                            break;
                        case "anc_previous_page":
                            if ((this.patientClaimsPager.get("pageNo") - 1) == 1) {
                                this.patientClaimsPager.set({ "pageNo": 1 });
                            }
                            else {
                                this.patientClaimsPager.set({ "pageNo": this.patientClaimsPager.get('previousPageNo') });
                            }
                            break;

                        case "anc_next_page":
                            if ((this.patientClaimsPager.get("pageNo") + 1) == this.patientClaimsPager.get('lastPageNo')) {
                                this.patientClaimsPager.set({ "pageNo": this.patientClaimsPager.get('lastPageNo') });
                            }
                            else {
                                this.patientClaimsPager.set({ "pageNo": this.patientClaimsPager.get('nextPageNo') });
                            }
                            break;
                        case "anc_last_page":
                            this.patientClaimsPager.set({ "pageNo": this.patientClaimsPager.get('lastPageNo') });
                            break;
                    }
                    self.getPatientClaims(self.cur_patient_id, false);
                }
            },

            getPatientClaims: function(patientId, isTotalRecordNeeded) {
                var self = this;

                jQuery.ajax({
                    url: "/exa_modules/billing/claims/claim/claimsby_patient",
                    type: "GET",
                    data: {
                        id: patientId,
                        countFlag: false,
                        pageNo: this.patientClaimsPager.get('pageNo'),
                        pageSize: this.patientClaimsPager.get('pageSize')
                    },
                    success: function (response) {
                        if (response && response.length) {
                            self.renderClaimPage(response, isTotalRecordNeeded);
                        } else {
                            $("#divNoClaims").show();
                            $("#div_patient_claims").hide();
                        }
                    },
                    error: function (err) {
                        commonjs.handleXhrError(err);
                    }
                });
            },

            setPatientAltAccountsAutoComplete: function () {
                if (app.country_alpha_3_code !== 'can') {
                    return;
                }

                var self = this;
                $("#ddlPhnUli").select2({
                    ajax: {
                        url: "/exa_modules/billing/autoCompleteRouter/patientAltAccounts",
                        dataType: 'json',
                        delay: 250,
                        data: function (params) {
                            return {
                                page: params.page || 1,
                                q: params.term || '',
                                pageSize: 10,
                                sortField: "id",
                                sortOrder: "desc",
                                company_id: app.companyID,
                                patient_id: self.cur_patient_id
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

                    var issuerType = self.getIssuerType(parseInt(repo.issuer_id) - 1);
                    var markup = "<table><tr>";
                    markup += "<td><div>" + issuerType + ", " + repo.alt_account_no + "</div>";
                    markup += "</td></tr></table>";
                    return markup;
                }
                function formatRepoSelection(res) {
                    if (res.issuer_id && res.alt_account_no) {
                        self.ACSelect.patientAltAccNo.issuer_id = res.issuer_id;
                        self.ACSelect.patientAltAccNo.alt_account_no = res.alt_account_no;
                        var issuerType = res.issuer_id
                            ? self.getIssuerType(parseInt(res.issuer_id) - 1)
                            : res.issuer_id;

                        return issuerType + ', ' + res.alt_account_no;
                    }

                    return "";
                }
            },

            getIssuerType: function (index) {
                if (index >= 0) {
                    var issuerTypes = [
                        'ULI/PHN',
                        'ULI/PHN (parent/guardian)',
                        'Registration Number',
                        'Registration Number (parent/guardian)',
                        'PID'
                    ];

                    return issuerTypes[index];
                }

                return '';
            },

            getDefaultPatientAltAccNo: function (patientAltAccNos) {
                var defaultPatientAltAccNo = "";
                if (patientAltAccNos) {
                    // If the patient has a registration number issuer type this should always be the default used on the claim.
                    // The priority for the issuer id's
                    // Registration Number - id = 3
                    // Registration Number(parent / guardian) - id = 4
                    // ULI / PHN - id = 1
                    // ULI / PHN(parent / guardian) - id = 2
                    // PID - id = 5
                    var issuerIds = [3, 4, 1, 2, 5];
                    for (var index = 0; index < issuerIds.length; index++) {
                        var issuerId = issuerIds[index];
                        defaultPatientAltAccNo = this.getDefaultPatientAltAccNoById(patientAltAccNos, issuerId);
                        if (defaultPatientAltAccNo) {
                            break;
                        }
                    }
                }

                return defaultPatientAltAccNo;
            },

            getDefaultPatientAltAccNoById: function (patientAltAccNos, issuerId) {
                if (patientAltAccNos) {
                    var patientAltAccNo = patientAltAccNos.find(function (patientAltAccNo) {
                        return patientAltAccNo.issuer_id === issuerId;
                    });

                    if (patientAltAccNo) {
                        var issuerType = patientAltAccNo.issuer_id
                            ? this.getIssuerType(parseInt(patientAltAccNo.issuer_id) - 1)
                            : patientAltAccNo.issuer_id;
                        var defaultPatientAltAccNo = issuerType + ', ' + patientAltAccNo.alt_account_no;
                        this.ACSelect.patientAltAccNo.issuer_id = patientAltAccNo.issuer_id;
                        this.ACSelect.patientAltAccNo.alt_account_no = patientAltAccNo.alt_account_no;
                        return defaultPatientAltAccNo;
                    }
                }

                return "";
            }
        });

        return claimView;
    });
