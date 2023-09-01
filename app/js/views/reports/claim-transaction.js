define([
    'jquery'
    , 'underscore'
    , 'backbone'
    , 'shared/report-utils'
    , 'text!templates/reports/claim-transaction.html'
],
    function ($, _, Backbone, UI, claimTransactionTemplate) {

        var ClaimTransactionView = Backbone.View.extend({
            rendered: false,
            expanded: false,
            mainTemplate: _.template(claimTransactionTemplate),
            viewModel: {
                dateFormat: 'MM/DD/YYYY',
                country_alpha_3_code: 'usa',
                i18nColumnHeaderCpt: 'cptCode',
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
                facilities: null,
                serviceDateFrom: null,
                serviceDateTo: null,
                payDateFrom: null,
                payDateTo: null,
                billCreatedDateFrom: null,
                billCreatedDateTo: null,
                chkServiceDateBill: null,
                insuranceOption: null,
                referringDoctoreOption: null,
                insuranceIds: null,
                insuranceGroupIds: null,
                userIds: null,
                userNames: null,
                refPhyId: null,
                refProName: null,
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
                'click #btnViewReportNewTabClaimTransaction': 'onReportViewClick',
                'click #btnPdfReport': 'onReportViewClick',
                'click #btnExcelReport': 'onReportViewClick',
                'click #btnCsvReport': 'onReportViewClick',
                'click #btnXmlReport': 'onReportViewClick',
                "click #chkAllClaims": "selectAllClaims",
                "click #chkAllInsGroup": "selectAllInsGroup",
                "change .insGrpChk": "chkInsGroup",
                "click #chkAllFacility": "selectAllFacility",
                "click #showCheckboxesClaim": "showCheckboxesClaim",
                "click #showInsGroupCheckboxes": "showInsuranceGroupList",
                'change #ddlUsersOption': 'onOptionChangeSelectUser',
                'change #ddlReferringPhysicianOption': 'onOptionChangeSelectRefPhysician'
            },

            usermessage: {
                selectPatient: "Search Patient"
            },

            initialize: function (options) {
                this.showForm();
                this.$el.html(this.mainTemplate(this.viewModel));
                UI.initializeReportingViewModel(options, this.viewModel);

                UI.getReportSetting(this.viewModel, 'all', 'dateFormat'); // Get date format (and current country code) based on current country code saved in sites table
                UI.getReportSetting(this.viewModel, 'claim-transaction', 'i18nColumnHeaderCpt'); // Get cpt i18n header based on country code

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
            },

            render: function () {
                var self = this;
                var modelCollection = Backbone.Collection.extend({
                    model: Backbone.Model.extend({})
                });
                this.viewModel.facilities = new modelCollection(commonjs.getCurrentUsersFacilitiesFromAppSettings());
                this.$el.html(this.mainTemplate(this.viewModel));
                UI.bindBillingProvider();
                UI.bindInsuranceAutocomplete('Select Insurance', 'btnAddInsurance', 'ulListInsurance');
                UI.bindInsuranceProviderAutocomplete('Select Insurance Provider', 'btnAddInsuranceProvider', 'ulListInsuranceProvider');
                UI.listUsersAutoComplete('Select User', 'btnAddUsers', 'ulListUsers');
                UI.bindCPTCodeInformations('txtCPTCode', 'btnCPTCode', 'ulListCPTCodeDetails');
                UI.bindReferringProviderAutoComplete('txtReferringPhysician', 'btnAddReferringPhysician', 'ulListReferringPhysicians');

                // pre-select default facility
                this.selectDefaultFacility();
                self.bindDateRangePicker();  //  Binding date range pickers
                self.bindUserAutocomplete();   // Referring Docotor Auto complete

                //   Service date (Bill) Date Picker
                self.drpStudyDt.setStartDate(this.viewModel.dateFrom);
                self.drpStudyDt.setEndDate(this.viewModel.dateTo);

                // //   Comment date  Date Picker
                self.commentDate.setStartDate(this.viewModel.cmtFromDate);
                self.commentDate.setEndDate(this.viewModel.cmtToDate);

                // //   Bill Created date  Picker
                self.billCreatedDate.setStartDate(this.viewModel.billCreatedDateFrom);
                self.billCreatedDate.setEndDate(this.viewModel.billCreatedDateTo);


                // Default selection
                $('#workedByAll').prop('checked', true);     // For Worked By Drop down
                $('#chkServiceDateBill').attr('checked', true); // For service Date

                // facilityFilter multi select boxes
                $('#ddlFacilityFilter,  #ddlInsuranceOption, #ddlUsersOption , #ddlOrderBySelection, #ddlReferringPhysicianOption').multiselect({
                    maxHeight: 200,
                    buttonWidth: '250px',
                    enableFiltering: true,
                    includeSelectAllOption: true,
                    enableCaseInsensitiveFiltering: true
                });

                $('#ddlClaimSelectBoxes').multiselect({
                    maxHeight: 170,
                    buttonWidth: '200px'
                });

                $("#selectedLabel").attr("i18n", 'shared.fields.cptCodeSelected');
                $("#selectLabel").attr("i18n", 'shared.fields.cptCodeSelect');
                $("#cptLabel").attr("i18n", 'shared.fields.cptCode');

                commonjs.updateCulture(app.currentCulture, commonjs.beautifyMe());
            },

            // comment
            // Date Range Binding
            bindDateRangePicker: function () {
                var self = this;
                var drpEl = $('#serviceDateBill');

                //   Service date (Bill) Date Picker
                var drpOptions = { autoUpdateInput: true, locale: { format: this.viewModel.dateFormat } };
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
                var drpOptions = { autoUpdateInput: true, locale: { format: this.viewModel.dateFormat } };
                this.commentDate = commonjs.bindDateRangePicker(cptDate, drpOptions, 'past', function (start, end, format) {
                    self.viewModel.cmtFromDate = start;
                    self.viewModel.cmtToDate = end;
                });
                cptDate.on('cancel.daterangepicker', function (ev, drp) {
                    self.viewModel.cmtFromDate = null;
                    self.viewModel.cmtToDate = null;
                });

                var billCreatedDate = $('#serviceDateBillCreated');
                var drpOptions = { autoUpdateInput: true, locale: { format: this.viewModel.dateFormat } };
                this.billCreatedDate = commonjs.bindDateRangePicker(billCreatedDate, drpOptions, 'past', function (start, end, format) {
                    self.viewModel.billCreatedDateFrom = start;
                    self.viewModel.billCreatedDateTo = end;
                });
                billCreatedDate.on('cancel.daterangepicker', function (ev, drp) {
                    self.viewModel.billCreatedDateFrom = null;
                    self.viewModel.billCreatedDateTo = null;
                });
                commonjs.isMaskValidate();
            },

            onReportViewClick: function (e) {
                var btnClicked = e && e.target ? $(e.target) : null;
                if (btnClicked && btnClicked.prop('tagName') === 'I') {
                    btnClicked = btnClicked.parent(); // in case FA icon 'inside'' button was clicked...
                }
                var rFormat = btnClicked ? btnClicked.attr('data-rformat') : null;
                var openInNewTab = btnClicked ? btnClicked.attr('id') === 'btnViewReportNewTabClaimTransaction' : false;
                this.viewModel.reportFormat = rFormat;
                this.viewModel.openInNewTab = openInNewTab && rFormat === 'html';

                this.viewModel.insuranceIds = $('ul#ulListInsurance li').map(function () {
                    return this.id;
                }).get();
                this.viewModel.insuranceGroupList = $('ul#ulListInsuranceProvider li').map(function () {
                    return this.id;
                }).get();
                this.viewModel.userIds = $('ul#ulListUsers li').map(function () {
                    return this.id;
                }).get();
                this.viewModel.refPhyId = $('ul#ulListReferringPhysicians li').map(function () {
                    return this.id;
                }).get();
                this.viewModel.insuranceOption = $('#ddlInsuranceOption').val();
                this.viewModel.insGroupOption = $('#insuranceGroupListBoxs').val();

                this.viewModel.referringDoctor = $('#ddlReferringPhysicianOption').val();

                this.viewModel.cptCodeLists = $('ul#ulListCPTCodeDetails li').map(function () {
                    return this.id;
                }).get();

                this.getClaimSelection();
                this.getSelectedFacility();
                this.getBillingProvider();

                if (this.hasValidViewModel()) {
                    var urlParams = this.getReportParams();
                    UI.generateReport(this.viewModel.reportId, this.viewModel.reportCategory, this.viewModel.reportFormat, urlParams);
                }
            },

            hasValidViewModel: function () {
                if (this.viewModel.reportId == null || this.viewModel.reportCategory == null || this.viewModel.reportFormat == null) {
                    return commonjs.showWarning('messages.status.pleaseCheckReportIdCategoryandorFormat');
                }

                // Claim # validatation for from# &  To #
                if ($('#claimIdFrom').val() != '' && $('#claimIdTo').val() == "") {
                    return commonjs.showWarning('messages.status.pleaseEnterToRangeClaim');
                }
                if ($('#claimIdTo').val() != '' && $('#claimIdFrom').val() == "") {
                    return commonjs.showWarning('messages.status.pleaseEnterFromRangeClaim');
                }

                if (parseInt($('#claimIdFrom').val()) > parseInt($('#claimIdTo').val())) {
                    return commonjs.showWarning('messages.status.claimFromNotGreaterThanTo');
                }

                if (!this.viewModel.dateFrom || !this.viewModel.dateTo) {
                    return commonjs.showWarning('messages.status.pleaseSelectDateRange');
                }
                if (!this.viewModel.cmtFromDate || !this.viewModel.cmtToDate) {
                    return commonjs.showWarning('messages.status.commentDateRange');
                }
                if (!this.viewModel.billCreatedDateFrom || !this.viewModel.billCreatedDateTo) {
                    return commonjs.showWarning('messages.status.bill-created-date');
                }

                if ($("#ddlClaimSelectBoxes option:selected").length < 1) {
                    return commonjs.showWarning('messages.status.claimSelection');
                }
                return true;
            },

            // Binding Report Params
            getReportParams: function () {
                var isWorkedByAll = $('#workedByAll').prop('checked') || false;

                return urlParams = {
                    'dateFormat': this.viewModel.dateFormat,
                    'country_alpha_3_code': this.viewModel.country_alpha_3_code,
                    'allFacilities': this.viewModel.allFacilities,

                    'workedBy': $('#workedBy').prop('checked'),
                    'workedByAll': isWorkedByAll,
                    'facilityIds': !isWorkedByAll && this.selectedFacilityList || [],
                    'allFacilities': this.viewModel.allFacilities ? this.viewModel.allFacilities : '',

                    'billingProvider': !isWorkedByAll && this.selectedBillingProList || [],
                    'allBillingProvider': this.viewModel.allBillingProvider ? this.viewModel.allBillingProvider : '',
                    billingProFlag: this.viewModel.allBillingProvider == 'true',

                    'fromDate': ($('#chkServiceDateBill').prop('checked')) == true && this.viewModel.dateFrom ? this.viewModel.dateFrom.format('MM/DD/YYYY') : '',
                    'toDate': ($('#chkServiceDateBill').prop('checked')) == true && this.viewModel.dateTo ? this.viewModel.dateTo.format('MM/DD/YYYY') : '',

                    'cmtFromDate': ($('#chkServicePayDateCPT').prop('checked')) == true && this.viewModel.cmtFromDate ? this.viewModel.cmtFromDate.format('MM/DD/YYYY') : '',
                    'cmtToDate': ($('#chkServicePayDateCPT').prop('checked')) == true && this.viewModel.cmtToDate ? this.viewModel.cmtToDate.format('MM/DD/YYYY') : '',
                    'cptDateOption': $('#chkServicePayDateCPT').is(':checked') ? $("input[name='accountingAndActualPayment']:checked").val() : '',

                    'billCreatedDateFrom': ($('#billCreatedDate').prop('checked')) == true && this.viewModel.billCreatedDateFrom ? this.viewModel.billCreatedDateFrom.format('MM/DD/YYYY') : '',
                    'billCreatedDateTo': ($('#billCreatedDate').prop('checked')) == true && this.viewModel.billCreatedDateTo ? this.viewModel.billCreatedDateTo.format('MM/DD/YYYY') : '',

                    insuranceIds: this.viewModel.insuranceIds,
                    insuranceOption: this.viewModel.insuranceOption ? this.viewModel.insuranceOption : '',
                    'insuranceGroupList': this.viewModel.insuranceGroupList,

                    allInsuranceGroup: this.viewModel.allInsGrpSelection ? this.viewModel.allInsGrpSelection : '',

                    userIds: this.viewModel.userIds ? this.viewModel.userIds : '',
                    referringProIds: this.viewModel.refPhyId ? this.viewModel.refPhyId : '',

                    claimLists: this.selectedClaimList ? this.selectedClaimList : '',
                    allClaimSelection: this.viewModel.allClaimSelection ? this.viewModel.allClaimSelection : '',

                    claimFrom: $('#claimIdFrom').val() ? parseInt($('#claimIdFrom').val()) : '',
                    claimTo: $('#claimIdTo').val() ? parseInt($('#claimIdTo').val()) : '',

                    cptCodeLists: this.viewModel.cptCodeLists ? this.viewModel.cptCodeLists : '',

                    orderBy: $('#ddlOrderBySelection').val() ? $('#ddlOrderBySelection').val() : '',
                    insurancePayerTypeOption: $('#ddlClaimSelectBoxes').val() || '',
                    openInNewTab: this.viewModel.openInNewTab

                };
            },
            // Insurance List Box for (All, selected Insurance, Insurance Group)
            onOptionChange: function () {
                if ($('#ddlInsuranceOption').val() == 'S') {
                    $('#txtInsuranceName').empty();
                    $("#ddlOptionBox").show();
                    $("#ddlOptionBoxList").show();
                    $("#ddlInsuranceGroupBox").hide();
                    $("#ddlInsuranceGroupBoxList").hide();
                    $("#chkAllInsGroup").attr('checked', false);
                    $('input[class=insGrpChk]').prop('checked', false);
                    this.selectedInsGrpList = []; // empty the selected insurance group list
                }
                else if ($('#ddlInsuranceOption').val() == 'G') {
                    $('#txtInsuranceProviderName').empty();
                    $("#ddlOptionBox").hide();
                    $("#ddlOptionBoxList").hide();
                    $("#ddlInsuranceGroupBox").show();
                    $("#ddlInsuranceGroupBoxList").show();
                    $('#ulListInsurance').empty();
                    $('#ulListInsuranceProvider').empty();
                    this.viewModel.insuranceIds = [];
                    $('#ulListInsurance').data('insuranceGroupList', []);
                }
                else {
                    $("#ddlOptionBox").hide();
                    $("#ddlOptionBoxList").hide();
                    $("#ddlInsuranceGroupBox").hide();
                    $("#ddlInsuranceGroupBoxList").hide();
                    $('#ulListInsurance').empty();
                    $('#ulListInsuranceProvider').empty();
                    this.viewModel.insuranceIds = [];
                    this.viewModel.insuranceGroupList = [];
                    $('#ulListInsurance').data('insuranceIds', []);
                    $('#ulListInsuranceProvider').data('insuranceGroupList', []);
                    $("#chkAllInsGroup").attr('checked', false);
                    $('input[class=insGrpChk]').prop('checked', false);
                    this.selectedInsGrpList = []; // empty the selected insurance group list
                }
            },

            onOptionChangeSelectUser: function () {
                if ($('#ddlUsersOption').val() == 'S') {
                    $("#ddlUsersBox").show();
                    $("#divUsers").show();
                }
                else {
                    $("#ddlUsersBox").hide();
                    $("#divUsers").hide();
                    $('#ulListUsers').empty();
                    this.viewModel.userNames = [];
                    this.viewModel.userIds = [];
                    $('#ulListUsers').data('userIds', []);
                    $('#ulListCPTCodeDetails').empty();
                    this.viewModel.cptCodeLists = [];
                    $('#ulListCPTCodeDetails').data('cptIds', []);
                }
            },

            onOptionChangeSelectRefPhysician: function () {
                $('#txtReferringPhysician').empty();
                if ($('#ddlReferringPhysicianOption').val() == 'S') {
                    $("#ddlReferringPhysicianBox").show();
                    $("#divReferringPhysician").show();
                }
                else {
                    $("#ddlReferringPhysicianBox").hide();
                    $("#divReferringPhysician").hide();
                    $('#ulListReferringPhysicians').empty();
                    this.viewModel.refProName = [];
                    this.viewModel.refPhyId = [];
                    $('#ulListReferringPhysicians').data('refPhyId', [])
                }
            },


            onOptionChangeSelectCPT: function () {
                $('#txtCPTCode').empty();
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
                $('#facilityDiv').show();
                $('#billingProviderDiv').show();
                $('#workedByAll').prop('checked', false);
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
                $('#facilityDiv').hide();
                $('#billingProviderDiv').hide();
            },

            // Billing Provider Changes -- worked
            onBillingProviderChange: function () {
                $('#billingProDropdown').show();
                $('#facilityDropDown').hide();

                // clear facility filters
                $('#ddlFacilityFilter').multiselect("deselectAll", false).multiselect("refresh");
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
                this.selectedClaimList = claimSelections;
                // this.viewModel.allClaimSelection = this.selectedClaimList && this.selectedClaimList.length === $('#ddlClaimSelectBoxes option').length;

            },
            // Binding selected facility from the check box - worked
            getSelectedFacility: function (e) {
                var selected = $("#ddlFacilityFilter option:selected");
                var facilities = [];
                selected.each(function () {
                    facilities.push($(this).val());
                });
                this.selectedFacilityList = facilities
                this.viewModel.allFacilities = this.selectedFacilityList && this.selectedFacilityList.length === $("#ddlFacilityFilter option").length;
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
                var defFacId = this.viewModel.facilities.length === 1 ? this.viewModel.facilities.at(0).get('id') : app.default_facility_id;
                this.defaultyFacilityId = defFacId;
            },
            // Pay Date CPT information
            onPayDateCPT: function () {
                // Show OR Hide accounting date and payment date
                if ($('#chkServicePayDateCPT').prop('checked')) {
                    $('#accountingAndActualPaymentInfo').show();
                    $('#divAccountingDate').css('visibility', 'visible');
                    $('#accountingDate').prop('checked', true);
                }
                else {
                    $('#divAccountingDate').css('visibility', 'hidden');
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
        return ClaimTransactionView;
    });
