define([
    'jquery'
    , 'underscore'
    , 'backbone'
    , 'modules/reporting/utils/ui'
    , 'text!modules/reporting/templates/billing/claim-inquiry.html'
],
    function ($, _, Backbone, UI, ClaimInquiryTemplate) {

        var ClaimInquiryView = Backbone.View.extend({
            rendered: false,
            expanded: false,
            mainTemplate: _.template(ClaimInquiryTemplate),
            viewModel: {
                sDate: null,
                patientIds: null,
                patientOption: null,
                billingProvider: null,
                minAmount: null,
                openInNewTab: false,
                reportId: null,
                reportCategory: null,
                reportTitle: null,
                reportFormat: null,
                dateFrom: null,
                dateTo: null,
                cmtFromDate: null,
                cmtToDate: null,
                facilityIds: null,
                facilities: null,
                serviceDateFrom: null,
                serviceDateTo: null,
                payDateFrom: null,
                payDateTo: null,
                billCreatedDateFrom: null,
                billCreatedDateTo: null,
                insuranceOption: null,
                referringDoctoreOption: null,
                insuranceIds: null,
                userIds: null,
                userNames: null,
                referringProIds: null,
                allFacilities: false,
                allBillingProvider: false,
                allClaimSelection: false,
                allInsGrpSelection: false,
                insGroupOption: null,
                cptCodeLists: null
            },
            defaultyFacilityId: null,
            drpStudyDt: null,
            commentDate: null,
            selectedFacilityList: [],
            selectedBillingProList: [],
            selectedClaimList: [],
            selectedInsGrpList: [],
            events: {
                'change #ddlBillingProvider': 'billingCheckboxes',
                'change #workedBy': 'onWorkedByChange',
                'change #workedByAll': 'onWorkedByAllChange',
                'change #billingProChk': 'onBillingProviderChange',
                'change #facilityChk': 'onFacilityChange',
                'change #chkServicePayDateCPT': 'onPayDateCPT',
                'change #ddlInsuranceOption': 'onOptionChange',
                'change #ddlReferringPhysicianOption': 'onOptionChangeSelect',
                'change #ddlCPTCodeOption': 'onOptionChangeSelectCPT',
                'click #btnViewReport': 'onReportViewClick',
                'click #btnViewReportNewTab': 'onReportViewClick',
                'click #btnPdfReport': 'onReportViewClick',
                'click #btnExcelReport': 'onReportViewClick',
                'click #btnCsvReport': 'onReportViewClick',
                'click #btnXmlReport': 'onReportViewClick',
                "click #chkAllClaims": "selectAllClaims",
                "click #chkAllInsGroup": "selectAllInsGroup",
                "change .insGrpChk": "chkInsGroup",
                "click #chkAllBillingPro": "selectAllBillingProviders",
                "click #chkAllFacility": "selectAllFacility",
                "click #showCheckboxesClaim": "showCheckboxesClaim",
                "click #showInsGroupCheckboxes": "showInsuranceGroupList",
                'change #ddlUsersOption': 'onOptionChangeSelectUser'
            },

            usermessage: {
                selectPatient: "Search Patient"
            },

            initialize: function (options) {
                this.showForm();
                var modelCollection = Backbone.Collection.extend({
                    model: Backbone.Model.extend({})
                });

                // initialize view model and set any defaults that are not constants
                UI.initializeReportingViewModel(options, this.viewModel);
                //this.viewModel.facilityIds = [];

                this.viewModel.facilities = new modelCollection(commonjs.getCurrentUsersFacilitiesFromAppSettings());

                this.viewModel.dateFrom = moment().startOf('month').add(-1, 'month');    // start of the last month
                this.viewModel.dateTo = this.viewModel.dateFrom.clone().endOf('month');  // end of the last month

                this.viewModel.cmtFromDate = moment().startOf('month').add(-1, 'month');    // start of the last month  (CPT Pay Date)
                this.viewModel.cmtToDate = this.viewModel.cmtFromDate.clone().endOf('month');  // end of the last month

                this.viewModel.billCreatedDateFrom = moment().startOf('month').add(-1, 'month');    // start of the last month  (CPT Pay Date)
                this.viewModel.billCreatedDateTo = this.viewModel.billCreatedDateFrom.clone().endOf('month');  // end of the last month


            },

            showForm: function () {
                if (!this.rendered) {
                    this.render();
                }
                commonjs.initializeScreen({ header: { screen: this.viewModel.reportTitle, ext: this.viewModel.reportId } }); // html title
                UI.setPageTitle(this.viewModel.reportTitle);
              //  this.bindBillingProvider();
                this.bindCPTAutoComplete();   // CPT Code Auto complete

            },
            render: function () {
                var self = this;
                this.rendered = true;
                var insProviderTypes = _.filter(app.adjustmentCodes, {'type': 'INSPYR'});
               // $(this.el).html(this.mainTemplate({facilityList: this.viewModel.facilities.toJSON(), insTypes: insProviderTypes}));
                  this.$el.html(this.mainTemplate(this.viewModel));
                // pre-select default facility
                this.selectDefaultFacility();
                self.bindDateRangePickers();  //  Binding date range pickers
                self.bindInsuranceAutocomplete(); // Insurance Auto complete
                self.bindUserAutocomplete();   // Referring Docotor Auto complete

                //   Service date (Bill) Date Picker
                // self.drpStudyDt.setStartDate(this.viewModel.dateFrom);
                // self.drpStudyDt.setEndDate(this.viewModel.dateTo);

                // //   Comment date  Date Picker
                // self.commentDate.setStartDate(this.viewModel.cmtFromDate);
                // self.commentDate.setEndDate(this.viewModel.cmtToDate);

                // //   Bill Created date  Picker
                // self.billCreatedDate.setStartDate(this.viewModel.billCreatedDateFrom);
                // self.billCreatedDate.setEndDate(this.viewModel.billCreatedDateTo);


                // Default selection
                $('#workedByAll').prop('checked', true);     // For Worked By Drop down
                $('#chkServiceDateBill').attr('checked', true); // For service Date

                // facilityFilter multi select boxes
                // $('#ddlFacilityFilter').multiselect({
                //     maxHeight: 200,
                //     buttonWidth: '250px',
                //     enableFiltering: true,
                //     includeSelectAllOption: true,
                //     enableCaseInsensitiveFiltering: true
                // });
                // // facilityFilter multi select boxes
                // $('#ddlClaimSelectBoxes').multiselect({
                //     maxHeight: 170,
                //     buttonWidth: '170px',
                //     includeSelectAllOption: true
                // });
                // // BillingProvider multi select boxes
                // $('#ddlBillingProvider').empty();
            },
            
            // Date Range Binding
            bindDateRangePickers: function () {
                var self = this;
                var drpEl = $('#serviceDateBill');
                //   Service date (Bill) Date Picker
                var drpOptions = { autoUpdateInput: true, locale: { format: 'L' } };
                this.drpStudyDt = commonjs.bindDateRangePicker(drpEl, drpOptions, 'past', function (start, end, format) {
                    self.viewModel.dateFrom = start;
                    self.viewModel.dateTo = end;
                });
                drpEl.on('cancel.daterangepicker', function (ev, drp) {
                    self.viewModel.dateFrom = null;
                    self.viewModel.dateTo = null;
                });
                //   CPT date  Date Picker
                var cptDate = $('#serviceDateBillCPT');
                var drpOptions = { autoUpdateInput: true, locale: { format: 'L' } };
                this.commentDate = commonjs.bindDateRangePicker(cptDate, drpOptions, 'past', function (start, end, format) {
                    self.viewModel.cmtFromDate = start;
                    self.viewModel.cmtToDate = end;
                });
                cptDate.on('cancel.daterangepicker', function (ev, drp) {
                    self.viewModel.cmtFromDate = null;
                    self.viewModel.cmtToDate = null;
                });
                //   Bill Created date  Picker
                var billCreatedDate = $('#serviceDateBillCreated');
                var drpOptions = { autoUpdateInput: true, locale: { format: 'L' } };
                this.billCreatedDate = commonjs.bindDateRangePicker(billCreatedDate, drpOptions, 'past', function (start, end, format) {
                    self.viewModel.billCreatedDateFrom = start;
                    self.viewModel.billCreatedDateTo = end;
                });
                billCreatedDate.on('cancel.daterangepicker', function (ev, drp) {
                    self.viewModel.billCreatedDateFrom = null;
                    self.viewModel.billCreatedDateTo = null;
                });
            },

            onReportViewClick: function (e) {
                var btnClicked = e && e.target ? $(e.target) : null;
                if (btnClicked && btnClicked.prop('tagName') === 'I') {
                    btnClicked = btnClicked.parent(); // in case FA icon 'inside'' button was clicked...
                }
                var rFormat = btnClicked ? btnClicked.attr('data-rformat') : null;
                var openInNewTab = btnClicked ? btnClicked.attr('id') === 'btnViewReportNewTab' : false;
                this.viewModel.reportFormat = rFormat;
                this.viewModel.openInNewTab = openInNewTab && rFormat === 'html';

                this.viewModel.insuranceIds = $('ul#ulListInsurance li a').map(function () {
                    return this.id;
                }).get();
                this.viewModel.userIds = $('ul#ulListUsers li a').map(function () {
                    return this.id;
                }).get();
                this.viewModel.insuranceOption = $('#ddlInsuranceOption').val();
                this.viewModel.insGroupOption = $('#insuranceGroupListBoxs').val();

                this.viewModel.referringDoctor = $('#ddlReferringPhysicianOption').val();

                this.viewModel.cptCodeLists = $('ul#ulListCPTCodes li a').map(function () {
                    return this.id;
                }).get();

                this.getClaimSelection();
                this.getSelectedFacility();
                this.getBillingProvider();

                //if (this.hasValidViewModel()) {
                    var urlParams = this.getReportParams();
                    UI.showReport(this.viewModel.reportId, this.viewModel.reportCategory, this.viewModel.reportFormat, urlParams, this.viewModel.openInNewTab);
                //}
            },

            hasValidViewModel: function () {
                if (this.viewModel.reportId == null || this.viewModel.reportCategory == null || this.viewModel.reportFormat == null) {
                 //   commonjs.showWarning('Please check report id, category, and/or format!');
                    return false;
                }

                // Billing Provider validataion
                if ($('#billingProChk').attr('checked')) {
                    if ($('#ddlBillingProvider option:selected').length < 1) {
                        //commonjs.showWarning('Please select billing provider in option');
                        return false;
                    }
                }
                // Facility Validataion
                if ($('#facilityChk').attr('checked')) {
                    if ($('#ddlFacilityFilter option:selected').length < 1) {
                       // commonjs.showWarning('Please select facility in option');
                        return false;
                    }
                }

                if( !($('#chkServiceDateBill').attr('checked')) && !($('#chkServicePayDateCPT').attr('checked')) &&!($('#billCreatedDate').attr('checked')) ){
                   // commonjs.showWarning('Please Select Service / Pay / Bill Created Date');
                    return false;
                }

                // claim Selection Validation
                if ($('#ddlClaimSelectBoxes option:selected').length < 1) {
                   // commonjs.showWarning('Please Select Claim Selection');
                    return false;
                }

                // ref.Doctor Selection Validation
                if ($('#ddlReferringPhysicianOption').val() =='S') {
                    if(this.viewModel.referringProIds && this.viewModel.referringProIds.length <  1){
                      //  commonjs.showWarning('Please Add Referring Doctor');
                        return false;
                    }
                }
                return true;
            },

            // Binding Report Params
            getReportParams: function () {
                return urlParams = {
                    'allFacilities': this.viewModel.allFacilities,
                    'facilityIds': this.viewModel.facilityIds,

                    'workedBy': $('#workedBy').prop('checked'),
                    'workedByAll': $('#workedByAll').prop('checked'),

                    'facilityIds': ['1'], //$('#facilityChk').prop('checked') && this.selectedFacilityList ? this.selectedFacilityList : 
                    'allFacilities': this.viewModel.allFacilities ? this.viewModel.allFacilities : '',


                    'billingProvider': this.selectedBillingProList ? this.selectedBillingProList : [],
                    'allBillingProvider': this.viewModel.allBillingProvider ? this.viewModel.allBillingProvider : '',
                     billingProFlag : this.viewModel.allBillingProvider == 'true' ? true : false,

                    'fromDate': ($('#chkServiceDateBill').attr('checked')) ? this.viewModel.dateFrom.format('YYYY-MM-DD') : '',
                    'toDate': ($('#chkServiceDateBill').attr('checked')) ? this.viewModel.dateTo.format('YYYY-MM-DD') : '',

                    'cmtFromDate': ($('#chkServicePayDateCPT').attr('checked')) ? this.viewModel.cmtFromDate.format('YYYY-MM-DD') : '',
                    'cmtToDate': ($('#chkServicePayDateCPT').attr('checked')) ? this.viewModel.cmtToDate.format('YYYY-MM-DD') : '',


                    'billCreatedDateFrom': ($('#billCreatedDate').attr('checked')) ? this.viewModel.billCreatedDateFrom.format('YYYY-MM-DD') : '',
                    'billCreatedDateTo': ($('#billCreatedDate').attr('checked')) ? this.viewModel.billCreatedDateTo.format('YYYY-MM-DD') : '',

                    insuranceIds: this.viewModel.insuranceIds,
                    insuranceOption: this.viewModel.insuranceOption ? this.viewModel.insuranceOption : '',

                    allInsuranceGroup: this.viewModel.allInsGrpSelection ? this.viewModel.allInsGrpSelection : '',
                    insuranceGroupList: this.selectedInsGrpList ? this.selectedInsGrpList : '',

                    userIds: this.viewModel.userIds ? this.viewModel.userIds : '',

                    claimLists: this.selectedClaimList ? this.selectedClaimList : '',
                    allClaimSelection: this.viewModel.allClaimSelection ? this.viewModel.allClaimSelection : '',

                    claimFrom: $('#claimIdFrom').val() ? parseInt($('#claimIdFrom').val()) : '',
                    claimTo: $('#claimIdTo').val() ? parseInt($('#claimIdTo').val()) : '',

                    cptCodeLists: this.viewModel.cptCodeLists ? this.viewModel.cptCodeLists : '',

                    orderBy: $('#ddlOrderBySelection').val() ? $('#ddlOrderBySelection').val() : ''

                };
            },
            // Insurance List Box for (All, selected Insurance, Insurance Group)
            onOptionChange: function () {
                if ($('#ddlInsuranceOption').val() == 'S') {
                    $("#ddlOptionBox").show();
                    $("#ddlInsuranceGroupBox").hide();
                    $("#chkAllInsGroup").attr('checked', false);
                    $('input[class=insGrpChk]').prop('checked', false);
                    this.selectedInsGrpList = []; // empty the selected insurance group list
                }
                else if ($('#ddlInsuranceOption').val() == 'G') {
                    $("#ddlOptionBox").hide();
                    $("#ddlInsuranceGroupBox").show();
                    $('#ulListInsurance').empty();
                    this.viewModel.insuranceIds = [];
                    $('#ulListInsurance').data('insuranceIds',[]);
                }
                else {
                    $("#ddlOptionBox").hide();
                    $("#ddlInsuranceGroupBox").hide();
                    $('#ulListInsurance').empty();
                    this.viewModel.insuranceIds = [];
                    $('#ulListInsurance').data('insuranceIds',[]);
                    $("#chkAllInsGroup").attr('checked', false);
                    $('input[class=insGrpChk]').prop('checked', false);
                    this.selectedInsGrpList = []; // empty the selected insurance group list
                }
            },
            // Referring Physician Value changed
            onOptionChangeSelectUser: function () {
                if ($('#ddlUsersOption').val() == 'S')
                    $("#ddlUsersBox").show();
                else{
                    $("#ddlUsersBox").hide();
                    $('#ulListUsers').empty();
                    this.viewModel.userNames = [];
                    this.viewModel.userIds = [];
                    $('#ulListUsers').data('userIds',[])
                }
            },


            onOptionChangeSelectCPT: function () {
                if ($('#ddlCptCode').val() == 'S')
                    $("#ddlCPTCodeBox").show();
                else
                    $("#ddlCPTCodeBox").hide();
            },
            // CPT code select box binding in list
            onOptionChangeSelectCPT: function () {
                if ($('#ddlCPTCodeOption').val() == 'S')
                    $("#ddlCPTCodeBox").show();
                else {
                    $("#ddlCPTCodeBox").hide();
                    $('#ulListCPTCodes').empty();
                    this.viewModel.cptCodeLists = [];
                    $('#ulListCPTCodes').data('cptIds', []);
                }
            },
            onWorkedByChange: function () {
                $('.facilityAndBillingProChk').show();
                $('#facilityChk').prop('checked', true);
                $('#billingProDropdown').hide();
                $('#facilityDropDown').show();
                $('#billingProDropdown').attr('checked', false);
            },
            // Worked By dropdown Value Ranges
            onWorkedByAllChange: function () {
                $('.facilityAndBillingProChk').hide();
                $('#facilityChk').prop('checked', false);
                $('#billingProChk').prop('checked', false);
                $('#billingProDropdown').hide();
                $('#facilityDropDown').hide();
                $('#billingProDropdown').innerHTML = "";
                $('#facilityDropDown').attr('checked', false);
                $('#billingProDropdown').attr('checked', false);
                $('#chkAllBillingPro').attr('checked', false);
                $('#billingProChk').prop('checked', false)

                $('input[name=allBillingProviders]').prop('checked', false);
                this.viewModel.allBillingProvider = false;
                $('#lblRTFacility').attr('checked', false);
                $('#chkAllFacility').prop('checked', false)
                $('input[name=allInusranceFacilities]').prop('checked', false);
                this.viewModel.allFacilities = false;
              //  $('#ddlBillingProvider').multiselect("deselectAll", false).multiselect("refresh");
             //   $('#ddlFacilityFilter').multiselect("deselectAll", false).multiselect("refresh");

            },
            // Billing Provider Changes -- worked
            onBillingProviderChange: function () {
                $('#billingProDropdown').show();
                $('#facilityDropDown').hide();

                // clear facility filters
             //   $('#ddlFacilityFilter').multiselect("deselectAll", false).multiselect("refresh");
                this.viewModel.allFacilities = false;
            },
            // Facility Changes -- worked
            onFacilityChange: function () {
                $('#billingProDropdown').hide();
                $('#facilityDropDown').show();

                // clear billing provider filters
                $('#ddlBillingProvider').multiselect("deselectAll", false).multiselect("refresh");
                this.viewModel.allBillingProvider = false;

            },
            // Claim Selection and validation -- worked
            getClaimSelection: function () {

               var selected = $("#ddlClaimSelectBoxes option:selected");
               var claimSelections = [];
                   selected.each(function () {
                      claimSelections.push($(this).val());
                   });
               this.selectedClaimList = claimSelections
              // this.viewModel.allClaimSelection = this.selectedClaimList && this.selectedClaimList.length === $('#ddlClaimSelectBoxes option').length;

            },
            // Binding selected facility from the check box - worked
            getSelectedFacility: function (e) {
                var selected = $("#ddlFacilityFilter option:selected");
                var facilities = [];
                selected.each(function () {
                    facilities.push($(this).val());
                });
              //  this.selectedFacilityList = facilities
            //    this.viewModel.allFacilities = this.selectedFacilityList && this.selectedFacilityList.length === $("#ddlFacilityFilter option").length;
            },
            // multi select billing provider - worked
            getBillingProvider: function (e) {
                var billing_pro = []
                var selected = $("#ddlBillingProvider option:selected");
                selected.each(function () {
                    billing_pro.push($(this).val());
                });
                this.selectedBillingProList = billing_pro;
                this.viewModel.allBillingProvider = this.selectedBillingProList && this.selectedBillingProList.length === $("#ddlBillingProvider option").length;
            },

            // multi select insurance provider
            chkInsGroup: function (e) {
                var ins_group = []
                $('#insuranceGroupListBoxs input[type="checkbox"]').each(function () {
                    if ($(this).prop('checked')) {
                        ins_group.push($(this).val());
                    }
                });

                this.selectedInsGrpList = ins_group;
                this.viewModel.allInsGrpSelection = this.selectedInsGrpList && this.selectedInsGrpList.length === $('#insuranceGroupListBoxs').children().length;
                $('#chkAllInsGroup').prop('checked', this.viewModel.allInsGrpSelection);
            },
            // Select All Insurance Group
            selectAllInsGroup: function () {
                if ($('#chkAllInsGroup').attr('checked')) {
                    $('#insuranceGroupListBoxs input[class=insGrpChk]').prop('checked', true);
                    var ins_group = []
                    $('#insuranceGroupListBoxs input[type="checkbox"]').each(function () {
                        if ($(this).prop('checked')) {
                            ins_group.push($(this).val());
                        }
                    });
                    this.viewModel.allInsGrpSelection = true;
                    this.selectedInsGrpList = ins_group;
                }
                else {
                    $('#insuranceGroupListBoxs input[class=insGrpChk]').prop('checked', false);
                    this.viewModel.allInsGrpSelection = false;
                    this.selectedInsGrpList = [];
                }
            },


            selectAllBillingProviders: function (e) {
                if ($('#chkAllBillingPro').attr('checked')) {
                    $('input[name=allBillingProviders]').prop('checked', true);
                    var billing_pro = []
                    $('#billingCheckboxes input[type="checkbox"]').each(function () {
                        if ($(this).prop('checked')) {
                            billing_pro.push($(this).val());
                        }
                    });
                    this.viewModel.allBillingProvider = true;
                    this.selectedBillingProList = billing_pro;
                }
                else {
                    $('input[name=allBillingProviders]').prop('checked', false);
                    this.viewModel.allBillingProvider = false;
                    this.selectedBillingProList = []
                }

            },
            // Binding default facility Group
            selectDefaultFacility: function () {
                // if there is only 1 facility select it, otherwise use default facility id
                //var defFacId = this.viewModel.facilities.length === 1 ? this.viewModel.facilities.at(0).get('id') : app.default_facility_id;
              //  this.defaultyFacilityId = defFacId;
            },
            // Pay Date CPT information
            onPayDateCPT: function () {
                // Show OR Hide accounting date and payment date
                if ($('#chkServicePayDateCPT').attr('checked')) {
                    $('#accountingAndActualPaymentInfo').show();
                    $('#accountingDate').prop('checked', true);
                }
                else {
                    $('#accountingAndActualPaymentInfo').hide();
                    $('#accountingDate').prop('checked', false);
                }
            },

            // Claim all check boxed
            showCheckboxesClaim: function () {
                var claimSelectBoxes = document.getElementById("claimSelectBoxes");
                if (!this.expanded) {
                    claimSelectBoxes.style.display = "block";
                    this.expanded = true;
                }
                else {
                    claimSelectBoxes.style.display = "none";
                    this.expanded = false;
                }
            },
            // Show Insurance Group List
            showInsuranceGroupList: function () {
                var insuracneSelectBox = document.getElementById("insuranceGroupListBoxs");
                if (!this.expanded) {
                    insuracneSelectBox.style.display = "block";
                    this.expanded = true;
                }
                else {
                    insuracneSelectBox.style.display = "none";
                    this.expanded = false;
                }
            },
            // Binding insurance auto complete for drop down
            bindInsuranceAutocomplete: function () {
                var self = this;
                var txtInsuranceName = 'txtInsuranceName';
                // var s2id_txtInsuranceName = 's2id_txtInsuranceName a span';
                // UI.bindInsuranceAutocomplete(txtInsuranceName, s2id_txtInsuranceName, 'Select Insurance', self.defaultyFacilityId, 'btnAddInsurance', 'ulListInsurance');
            },
            // Binding insurance group auto complete drop down. Todo:: Once insurance group screen come in setup then use  this fun.
            bindInsuranceGroupAutocomplete: function () {
                var self = this;
                var txtInsuranceGroupName = 'txtInsuranceGroupName';
                // var s2id_txtInsuranceGroupName = 's2id_txtInsuranceGroupName a span';
                // UI.bindInsuranceProviderGroupAutocomplete(txtInsuranceGroupName, s2id_txtInsuranceGroupName, 'Select Insurance Group', self.defaultyFacilityId, 'btnAddInsurance', 'ulListPatients');
            },
            // Binding user auto complete function
            bindUserAutocomplete: function () {
                var self = this;
                var txtUsersName = 'txtUsers';
                // var s2id_txtInsuranceGroupName = 's2id_txtUsers a span';
                // UI.bindUsersAutoComplete(txtUsersName, 'Select User','btnAddUsers', 'ulListUsers');
            },
            // Binding CPT auto complete for drop down
            bindCPTAutoComplete: function () {
                var self = this;
                var txtCptCode = 'txtCPTCode';
                // var s2id_txtCPTCodeName = 's2id_txtCPTCode a span';
                // UI.bindCptAutocomplete(txtCptCode, s2id_txtCPTCodeName, 'Select CPT Code', self.defaultyFacilityId, 'btnCPTCode', 'ulListCPTCodes');
            }         

        });
        return ClaimInquiryView;
    });
