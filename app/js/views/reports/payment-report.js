define([
    'jquery'
    , 'underscore'
    , 'backbone'
    , 'shared/report-utils'
    , 'text!templates/reports/payment-report.html'
],
    function ($, _, Backbone, UI, paymentsTemplate) {

        var paymentsView = Backbone.View.extend({
            rendered: false,
            drpStudyDt: null,
            expanded: false,
            mainTemplate: _.template(paymentsTemplate),
            viewModel: {
                facilities: null,
                dateFrom: null,
                dateTo: null,
                allFacilities: false,
                facilityIds: null,
                openInNewTab: false,
                reportId: null,
                reportCategory: null,
                reportTitle: null,
                reportFormat: null,
                paymentOptions: null,
                billingProvider: null,
                allBillingProvider: false,
                allUsers: false,
                userIds: null,
                userNames: null,
                userRoleIds: null,
                UserRoleName: null,
                adjustmentCodeIds : null,
                adjustmentCode: null,
                insuranceOption: null,
                insGroupOption: null,
                insuranceIds: null,
                insuranceGroupIds: null,
                allInsGrpSelection: false
            },
            selectedBillingProList: [],
            selectedFacilityList: [],
            defaultyFacilityId: null,
            ACSelect: { user: {} },
            events: {

                'change #ddlUsersOption': 'onOptionChangeSelectUser',
                'change #ddlUsersRoleOption': 'onOptionChangeSelectUserRole',
                'change #ddlAdjustmentCodeOption': 'onOptionChangeSelectAdjustmentCode',
                'click #btnViewReport': 'onReportViewClick',
                'click #btnViewReportNewTabPaymentRep': 'onReportViewClick',
                'click #btnPdfReport': 'onReportViewClick',
                'click #btnExcelReport': 'onReportViewClick',
                'click #btnCsvReport': 'onReportViewClick',
                'click #btnXmlReport': 'onReportViewClick',
                'change #ddlInsuranceOption': 'onInsuranceOptionChange',
                'change .insGrpChk': 'chkInsGroup',
                'click #showInsGroupCheckboxes': 'showInsuranceGroupList',
                'click #chkAllInsGroup': 'selectAllInsGroup'
            },

            initialize: function (options) {
                this.showForm();
                this.$el.html(this.mainTemplate(this.viewModel));
                UI.initializeReportingViewModel(options, this.viewModel);

                // Set date range to Facility Date
                this.viewModel.dateFrom = commonjs.getFacilityCurrentDateTime(app.facilityID);
                this.viewModel.dateTo = this.viewModel.dateFrom.clone();
            },

            showForm: function () {
                if (!this.rendered) {
                    this.render();
                }
                commonjs.initializeScreen({ header: { screen: this.viewModel.reportTitle, ext: this.viewModel.reportId } }); // html title
                UI.setPageTitle(this.viewModel.reportTitle);
            },

            render: function () {
                var modelCollection = Backbone.Collection.extend({
                    model: Backbone.Model.extend({})
                });
                this.viewModel.facilities = new modelCollection(commonjs.getCurrentUsersFacilitiesFromAppSettings());
                this.$el.html(this.mainTemplate(this.viewModel));

                this.bindDateRangePicker();
                this.drpStudyDt.setStartDate(this.viewModel.dateFrom);
                this.drpStudyDt.setEndDate(this.viewModel.dateTo);
                // For Facility Filter with Multiple Select
                $('#ddlFacilityFilter,  #ddlUsersOption, #ddlUsersRoleOption, #ddlAdjustmentCodeOption, #ddlInsuranceOption').multiselect({
                    maxHeight: 200,
                    buttonWidth: '250px',
                    width: '300px',
                    enableFiltering: true,
                    includeSelectAllOption: true,
                    enableCaseInsensitiveFiltering: true
                });

                // For Payment Option select without Multiple filter
                $('#ddlPaymentOption, #ddlSummaryOption').multiselect({
                    maxHeight: '200px',
                    buttonWidth: '200px',
                    width: '200px'
                });
                // Binding Billing Provider MultiSelect
                UI.bindBillingProvider();
                UI.listUsersAutoComplete('Select Users', 'btnAddUsers', 'ulListUsers');
                UI.listUsersRoleAutoComplete('Select Users Role', 'btnAddUsersRole', 'ulListUsersRole');
                UI.adjustmentCodeAutoComplete('Select Adj Code', 'btnAddAdjustmentCode', 'ulListAdjustmentCode');
                UI.bindInsuranceAutocomplete(commonjs.geti18NString("report.selectInsurance"), 'btnAddInsurance', 'ulListInsurance');
                UI.bindInsuranceProviderAutocomplete(commonjs.geti18NString("report.selectInsuranceProvider"), 'btnAddInsuranceProvider', 'ulListInsuranceProvider');
            },

            bindDateRangePicker: function () {
                var self = this;
                var drpEl = $('#txtDateRangeFromTo');
                var drpOptions = { autoUpdateInput: true, locale: { format: 'L' } };
                this.drpStudyDt = commonjs.bindDateRangePicker(drpEl, drpOptions, 'past', function (start, end, format) {
                    self.viewModel.dateFrom = start;
                    self.viewModel.dateTo = end;
                });
                drpEl.on('cancel.daterangepicker', function (ev, drp) {
                    self.viewModel.dateFrom = null;
                    self.viewModel.dateTo = null;
                });
                commonjs.isMaskValidate();
            },

            onOptionChangeSelectUser: function () {
                var self = this;
                if ($('#ddlUsersOption').val() == 'S') {
                    $("#ddlUsersBox").show();
                    $("#divUsers").show();
                    $('#txtUsers').text("Select User");
                }
                else {
                    $("#ddlUsersBox").hide();
                    $("#divUsers").hide();
                    this.viewModel.userNames = [];
                    this.viewModel.userIds = [];
                    $('#ulListUsers').data('this.viewModel.userIds', []);
                    $('#ulListUsers').html('');
                }
            },

            onOptionChangeSelectUserRole: function () {
                var self = this;
                if ($('#ddlUsersRoleOption').val() == 'S') {
                    $("#ddlUsersRoleBox").show();
                    $("#divUsersRole").show();
                    $('#txtUsersRole').text("Select User");
                }
                else {
                    $("#ddlUsersRoleBox").hide();
                    $("#divUsersRole").hide();
                    this.viewModel.userRoleNames = [];
                    this.viewModel.userRoleIds = [];
                    $('#ulListUsersRole').data('this.viewModel.userRoleIds', []);
                    $('#ulListUsersRole').html('');
                }
            },

            onOptionChangeSelectAdjustmentCode: function () {
                var self = this;
                if ($('#ddlAdjustmentCodeOption').val() == 'S') {
                    $("#ddlAdjustmentCodeBox").show();
                    $("#divAdjustmentCodes").show();
                    $('#txtAdjustmentCode').text("Select Adj Code");
                }
                else {
                    $("#ddlAdjustmentCodeBox").hide();
                    $("#divAdjustmentCodes").hide();
                    this.viewModel.adjustmentCode = [];
                    this.viewModel.adjustmentCodeIds = [];
                    $('#ulListAdjustmentCode').data('this.viewModel.adjustmentCodeIds', []);
                    $('#ulListAdjustmentCode').html('');
                }
            },

            onReportViewClick: function (e) {
                var btnClicked = e && e.target ? $(e.target) : null;
                this.getSelectedFacility();
                this.getBillingProvider();
                if (btnClicked && btnClicked.prop('tagName') === 'I') {
                    btnClicked = btnClicked.parent(); // in case FA icon 'inside'' button was clicked...
                }
                var rFormat = btnClicked ? btnClicked.attr('data-rformat') : null;
                var openInNewTab = btnClicked ? btnClicked.attr('id') === 'btnViewReportNewTabPaymentRep' : false;
                this.viewModel.reportFormat = rFormat;
                this.viewModel.openInNewTab = openInNewTab && rFormat === 'html';
                this.viewModel.paymentOptions = $('#ddlPaymentOption').val();
                this.viewModel.insuranceIds = $('ul#ulListInsurance li').map(function () {
                    return this.id;
                }).get();
                this.viewModel.insuranceGroupIds = $('ul#ulListInsuranceProvider li').map(function () {
                    return this.id;
                }).get();
                this.viewModel.insuranceOption = $('#ddlInsuranceOption').val();
                this.viewModel.insGroupOption = $('#insuranceGroupListBoxs').val();
                if (this.hasValidViewModel()) {
                    var urlParams = this.getReportParams();
                    UI.showReport(this.viewModel.reportId, this.viewModel.reportCategory, this.viewModel.reportFormat, urlParams, this.viewModel.openInNewTab);
                }
            },


            hasValidViewModel: function () {
                if (this.viewModel.reportId == null || this.viewModel.reportCategory == null || this.viewModel.reportFormat == null) {
                    commonjs.showWarning('messages.status.pleaseCheckReportIdCategoryandorFormat');
                    return;
                }

                if (this.viewModel.dateFrom == null || this.viewModel.dateTo == null) {
                    commonjs.showWarning('messages.status.pleaseSelectDateRange');
                    return;
                }
                return true;
            },

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

            onInsuranceOptionChange: function () {
                $("#ddlOptionBox").hide();
                $("#ddlOptionBoxList").hide();
                $("#ddlInsuranceGroupBox").hide();
                $("#ddlInsuranceGroupBoxList").hide();
                $('#ulListInsurance').empty();
                $('#ulListInsuranceProvider').empty();
                this.viewModel.insuranceIds = [];
                this.viewModel.insuranceGroupIds = [];
                $('#ulListInsurance').data('insuranceIds', []);
                $('#ulListInsuranceProvider').data('insuranceGroupIds', []);
                $('input[id=chkAllInsGroup]').prop('checked', false);
                $('input[class=insGrpChk]').prop('checked', false);
                $('#txtInsuranceName').empty();
                $('#txtInsuranceProviderName').empty();
                this.selectedInsGrpList = [];

                if ($('#ddlInsuranceOption').val() == 'S') {
                    $("#ddlOptionBox").show();
                    $("#ddlOptionBoxList").show();
                }
                else if ($('#ddlInsuranceOption').val() == 'G') {
                    $("#ddlInsuranceGroupBox").show();
                    $("#ddlInsuranceGroupBoxList").show();
                }
                else{
                    $("#ddlOptionBox").hide();
                    $("#ddlOptionBoxList").hide();
                    $("#ddlInsuranceGroupBox").hide();
                    $("#ddlInsuranceGroupBoxList").hide();
                }
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

            // Select All Insurance Group
            selectAllInsGroup: function () {
                if ($('#chkAllInsGroup').prop('checked')) {
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

            getReportParams: function () {
                var usersArray = [], userNameArray = [], usersRoleArray = [], userRoleNameArray = [], adjustmentCodeArray = [], adjustmentCodeIds = [];
                $('#ulListUsers li a').each(function () {
                    usersArray.push(~~$(this).attr('data-id'));
                    userNameArray.push($(this).closest('li').find('span').text());
                });

                $('#ulListUsersRole li a').each(function () {
                    usersRoleArray.push(~~$(this).attr('data-id'));
                    userRoleNameArray.push($(this).closest('li').find('span').text());
                });

                $('#ulListAdjustmentCode li a').each(function () {
                    adjustmentCodeIds.push(~~$(this).attr('data-id'));
                    adjustmentCodeArray.push($(this).closest('li').find('span').text());
                });

                return urlParams = {
                    'userIds': $('#ddlUsersOption').val() == 'S' ? usersArray : '',
                    'userName': $('#ddlUsersOption').val() == 'S' ? userNameArray : '',
                    'userRoleIds': $('#ddlUsersRoleOption').val() == 'S' ? usersRoleArray : '',
                    'userRoleName': $('#ddlUsersRoleOption').val() == 'S' ? userRoleNameArray : '',
                    'adjustmentCode': $('#ddlAdjustmentCodeOption').val() == 'S' ? adjustmentCodeArray : '',
                    'adjustmentCodeIds': $('#ddlAdjustmentCodeOption').val() == 'S' ? adjustmentCodeIds : '',
                    'allAdjustmentCode': $('#ddlAdjustmentCodeOption').val() == 'allAdjustment' || '',
                    'facilityIds': this.selectedFacilityList || [],
                    'allFacilities': this.viewModel.allFacilities || '',
                    'fromDate': this.viewModel.dateFrom.format('YYYY-MM-DD'),
                    'toDate': this.viewModel.dateTo.format('YYYY-MM-DD'),
                    'billingProvider': this.selectedBillingProList || [],
                    'allBillingProvider': this.viewModel.allBillingProvider || '',
                    'billingProFlag': this.viewModel.allBillingProvider == 'true' ? true : false,
                    'summaryType': $('#ddlSummaryOption').val(),
                    'paymentStatus':$('#ddlPaymentOption').val(),
                    'insuranceIds': this.viewModel.insuranceIds,
                    'insuranceOption': this.viewModel.insuranceOption || '',
                    'insuranceGroupIds': this.viewModel.insuranceGroupIds,
                    'allInsuranceGroup': this.viewModel.allInsGrpSelection || ''
                };
            }
        });

        return paymentsView;
    });
