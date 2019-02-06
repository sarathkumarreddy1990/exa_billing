define([
    'jquery'
    , 'underscore'
    , 'backbone'
    , 'shared/report-utils'
    , 'text!templates/reports/aged-ar-summary.html',
],
    function ($, _, Backbone, UI, MainTemplate) {

        var AgedARSummaryView = Backbone.View.extend({
            rendered: false,
            dtpEndMonth: null,
            expanded: false,
            mainTemplate: _.template(MainTemplate),
            viewModel: {
                facilities: null,
                allFacilities: false,
                facilityIds: null,
                openInNewTab: false,
                reportId: null,
                reportCategory: null,
                reportTitle: null,
                reportFormat: null,
                billingProvider: null,
                billingProviders: null,
                allBillingProvider: false,
                excelExtended: false,
                fromDate: null,
                insuranceOption: null,
                insGroupOption: null,
                insuranceIds: null,
                insuranceGroupIds: null,
                allInsGrpSelection: false,
            },
            selectedBillingProList: [],
            selectedFacilityList: [],
            defaultyFacilityId: null,
            events: {
                'click #btnViewReport': 'onReportViewClick',
                'click #btnViewReportNewTabAgedSummary': 'onReportViewClick',
                'click #btnPdfReport': 'onReportViewClick',
                'click #btnExcelReport': 'onReportViewClick',
                'click #btnExcelReportExtended': 'onReportViewClick',
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
                this.viewModel.facilities = new modelCollection(commonjs.getCurrentUsersFacilitiesFromAppSettings(app.facilityID));
                this.$el.html(this.mainTemplate(this.viewModel));
                // bind DRP and initialize it
                // this.bindDateRangePicker();
                // this.drpStudyDt.setStartDate(this.viewModel.dateFrom);
                // this.drpStudyDt.setEndDate(this.viewModel.dateTo);

                this.viewModel.fromDate = commonjs.bindDateTimePicker("txtFromDate", { format: "L" });
                this.viewModel.fromDate.date(commonjs.getFacilityCurrentDateTime(app.facilityID));
                UI.bindInsuranceAutocomplete(commonjs.geti18NString("report.reportFilter.selectInsurance"), 'btnAddInsurance', 'ulListInsurance');
                UI.bindInsuranceProviderAutocomplete(commonjs.geti18NString("report.reportFilter.selectInsuranceProvider"), 'btnAddInsuranceProvider', 'ulListInsuranceProvider');
                UI.bindBillingProvider();
                $('#ddlFacilityFilter,  #ddlInsuranceOption').multiselect({
                    maxHeight: 200,
                    buttonWidth: '250px',
                    width: '300px',
                    enableFiltering: true,
                    includeSelectAllOption: true,
                    enableCaseInsensitiveFiltering: true
                });
                commonjs.isMaskValidate();
                $('#btnAddInsuranceProvider, #btnAddInsurance').attr("title", commonjs.geti18NString("report.reportFilter.addInsurance"));
            },

            onReportViewClick: function (e) {
                var btnClicked = e && e.target ? $(e.target) : null;
                this.getSelectedFacility();
                this.getBillingProvider();
                if (btnClicked && btnClicked.prop('tagName') === 'I') {
                    btnClicked = btnClicked.parent(); // in case FA icon 'inside'' button was clicked...
                }
                var rFormat = btnClicked ? btnClicked.attr('data-rformat') : null;
                var openInNewTab = btnClicked ? btnClicked.attr('id') === 'btnViewReportNewTabAgedSummary' : false;
                this.excelExtended = btnClicked ? btnClicked.attr('id') === 'btnExcelReportExtended' : false;
                this.viewModel.reportFormat = rFormat;
                this.viewModel.openInNewTab = (openInNewTab && rFormat === 'html') ? true : false;
                this.viewModel.insuranceIds = $('ul#ulListInsurance li').map(function () {
                    return this.id;
                }).get();
                this.viewModel.insuranceGroupIds = $('ul#ulListInsuranceProvider li').map(function () {
                    return this.id;
                }).get();
                this.viewModel.insuranceOption = $('#ddlInsuranceOption').val();
                this.viewModel.insGroupOption = $('#insuranceGroupListBoxs').val();
                    var urlParams = this.getReportParams();
                    UI.showReport(this.viewModel.reportId, this.viewModel.reportCategory, this.viewModel.reportFormat, urlParams, this.viewModel.openInNewTab);
            },

            bindDateRangePicker: function () {
                var self = this;
                var drpEl = $('#txtDateRangeFromTo');
                var drpOptions = { autoUpdateInput: false, locale: { format: 'L' } };
                this.drpStudyDt = commonjs.bindDateRangePicker(drpEl, drpOptions, 'past', function (start, format) {
                    self.viewModel.dateFrom = start;
                    //  self.viewModel.dateTo = end;
                });
                drpEl.on('cancel.daterangepicker', function (ev, drp) {
                    self.viewModel.dateFrom = null;
                    //   self.viewModel.dateTo = null;
                });
                commonjs.isMaskValidate();
            },

            hasValidViewModel: function () {
                if (this.viewModel.reportId == null || this.viewModel.reportCategory == null || this.viewModel.reportFormat == null) {
                    commonjs.showWarning('messages.status.pleaseCheckReportIdCategoryandorFormat');
                    return false;
                }
                if (!(this.viewModel.fromDate && this.viewModel.fromDate.date())) {
                    commonjs.showWarning('messages.status.pleaseSelectDate');
                    return false;
                }
                if (this.viewModel.fromDate.date().diff(commonjs.getFacilityCurrentDateTime(app.facilityID)) > 0) {
                    commonjs.showWarning('messages.status.pleaseDoNotSelectFutureDate');
                    return false;
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
                var urlParams = {
                    'facilityIds': this.selectedFacilityList || [],
                    'allFacilities': this.viewModel.allFacilities ||'',
                    'fromDate': this.viewModel.fromDate.date().format('YYYY-MM-DD'),
                    'billingProvider': this.selectedBillingProList ||  [],
                    'allBillingProvider': this.viewModel.allBillingProvider || '',
                     'billingProFlag': this.viewModel.allBillingProvider == 'true' ? true : false,
                    'incPatDetail': $('#incPat').prop('checked'),
                    'excCreditBal': $('#excCreBal').prop('checked'),
                    'excelExtended': this.excelExtended ? this.excelExtended : '',
                    'insuranceIds': this.viewModel.insuranceIds,
                    'insuranceOption': this.viewModel.insuranceOption || '',
                    'insuranceGroupIds': this.viewModel.insuranceGroupIds,
                    'allInsuranceGroup': this.viewModel.allInsGrpSelection || ''
                }
                return urlParams;
            }

        });

        return AgedARSummaryView;
    });
