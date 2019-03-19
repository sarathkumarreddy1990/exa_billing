define([
    'jquery'
    , 'underscore'
    , 'backbone'
    , 'shared/report-utils'
    , 'text!templates/reports/payments-realization-rate-analysis.html'
],
    function ($, _, Backbone, UI, paymentsRealizationRateAnalysisTemplate) {

        var PaymentsRealizationRateAnalysisView = Backbone.View.extend({
            rendered: false,
            expanded: false,
            mainTemplate: _.template(paymentsRealizationRateAnalysisTemplate),
            viewModel: {
                dateFormat: 'MM/DD/YYYY',
                country_alpha_3_code: 'usa',
                billingProvider: null,
                openInNewTab: false,
                reportId: null,
                reportCategory: null,
                reportTitle: null,
                reportFormat: null,
                accountingDateFrom: null,
                accountingDateTo: null,
                serviceDateFrom: null,
                serviceDateTo: null,
                facilities: null,
                insuranceOption: null,
                insuranceIds: null,
                insuranceGroupIds: null,
                allFacilities: false,
                allBillingProvider: false,
                allInsGrpSelection: false,
                insGroupOption: null
            },
            defaultyFacilityId: null,
            dtpAccountingDate: null,
            dtpStudyDate: null,
            selectedFacilityList: [],
            selectedBillingProList: [],
            selectedInsGrpList: [],
            events: {
                'change #ddlBillingProvider': 'billingCheckboxes',
                'change #ddlInsuranceOption': 'onInsuranceOptionChange',
                'click #btnViewReport': 'onReportViewClick',
                'click #btnViewReportNewTabPaymentRateAnalysis': 'onReportViewClick',
                'click #btnPdfReport': 'onReportViewClick',
                'click #btnExcelReport': 'onReportViewClick',
                'click #btnCsvReport': 'onReportViewClick',
                'click #btnXmlReport': 'onReportViewClick',
                "click #chkAllInsGroup": "selectAllInsGroup",
                "change .insGrpChk": "chkInsGroup",
                "click #showInsGroupCheckboxes": "showInsuranceGroupList"
            },

            initialize: function (options) {
                this.showForm();
                this.$el.html(this.mainTemplate(this.viewModel));
                UI.initializeReportingViewModel(options, this.viewModel);

                UI.getReportSetting(this.viewModel, 'all', 'dateFormat'); // Get date format (and current country code) based on current country code saved in sites table(this.viewModel);

                this.viewModel.accountingDateFrom = moment().startOf('month').add(-1, 'month');
                this.viewModel.accountingDateTo = this.viewModel.accountingDateFrom.clone().endOf('month');

                this.viewModel.serviceDateFrom = moment().startOf('month').add(-1, 'month');
                this.viewModel.serviceDateTo = this.viewModel.serviceDateFrom.clone().endOf('month');
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
                this.selectDefaultFacility();
                self.bindDateRangePicker();
                self.dtpAccountingDate.setStartDate(this.viewModel.accountingDateFrom);
                self.dtpAccountingDate.setEndDate(this.viewModel.accountingDateTo);
                self.dtpStudyDate.setStartDate(this.viewModel.serviceDateFrom);
                self.dtpStudyDate.setEndDate(this.viewModel.serviceDateTo);
                $('#ddlFacilityFilter,  #ddlInsuranceOption').multiselect({
                    maxHeight: 200,
                    buttonWidth: '250px',
                    enableFiltering: true,
                    includeSelectAllOption: true,
                    enableCaseInsensitiveFiltering: true
                });
            },

            // Date Range Binding
            bindDateRangePicker: function () {
                var self = this;
                var serviceDate = $('#serviceDateBind');

                //   Service Date Picker
                var drpOptionsServiceDate = { autoUpdateInput: true, locale: { format: this.viewModel.dateFormat } };
                this.dtpAccountingDate = commonjs.bindDateRangePicker(serviceDate, drpOptionsServiceDate, 'past', function (start, end, format) {
                    self.viewModel.serviceDateFrom = start;
                    self.viewModel.serviceDateTo = end;
                });
                serviceDate.on('cancel.daterangepicker', function (ev, drp) {
                    self.viewModel.serviceDateFrom = null;
                    self.viewModel.serviceDateTo = null;
                });

                //   Accounting Date Picker
                var accountingDate = $('#accountingDateBind');
                var drpOptionsAccountingDate = { autoUpdateInput: true, locale: { format: this.viewModel.dateFormat } };
                this.dtpStudyDate = commonjs.bindDateRangePicker(accountingDate, drpOptionsAccountingDate, 'past', function (start, end, format) {
                    self.viewModel.accountingDateFrom = start;
                    self.viewModel.accountingDateTo = end;
                });
                accountingDate.on('cancel.daterangepicker', function (ev, drp) {
                    self.viewModel.serviceDateFrom = null;
                    self.viewModel.serviceDateTo = null;
                });
                commonjs.isMaskValidate();
            },

            onReportViewClick: function (e) {
                var btnClicked = e && e.target ? $(e.target) : null;
                if (btnClicked && btnClicked.prop('tagName') === 'I') {
                    btnClicked = btnClicked.parent(); // in case FA icon 'inside'' button was clicked...
                }
                var rFormat = btnClicked ? btnClicked.attr('data-rformat') : null;
                var openInNewTab = btnClicked ? btnClicked.attr('id') === 'btnViewReportNewTabPaymentRateAnalysis' : false;
                this.viewModel.reportFormat = rFormat;
                this.viewModel.openInNewTab = openInNewTab && rFormat === 'html';

                this.viewModel.insuranceIds = $('ul#ulListInsurance li').map(function () {
                    return this.id;
                }).get();
                this.viewModel.insuranceGroupIds = $('ul#ulListInsuranceProvider li').map(function () {
                    return this.id;
                }).get();
                this.viewModel.insuranceOption = $('#ddlInsuranceOption').val();
                this.viewModel.insGroupOption = $('#insuranceGroupListBoxs').val();
                this.getSelectedFacility();
                this.getBillingProvider();
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
                return true;
            },

            // Insurance List Box for (All, selected Insurance, Insurance Group)
            onInsuranceOptionChange: function () {
                if ($('#ddlInsuranceOption').val() == 'S') {
                    $("#ddlOptionBox").show();
                    $("#ddlOptionBoxList").show();
                    $("#ddlInsuranceGroupBox").hide();
                    $("#ddlInsuranceGroupBoxList").hide();
                    $('input[id=chkAllInsGroup]').prop('checked', false);
                    $('input[class=insGrpChk]').prop('checked', false);
                    $('#ulListInsuranceProvider').empty();
                    this.viewModel.insuranceGroupIds = [];
                    $('#ulListInsurance').data('insuranceGroupIds', []);
                    this.selectedInsGrpList = [];
                }
                else if ($('#ddlInsuranceOption').val() == 'G') {
                    $("#ddlOptionBox").hide();
                    $("#ddlOptionBoxList").hide();
                    $("#ddlInsuranceGroupBox").show();
                    $("#ddlInsuranceGroupBoxList").show();
                    $('#ulListInsurance').empty();
                    $('#ulListInsuranceProvider').empty();
                    this.viewModel.insuranceIds = [];
                    $('#ulListInsurance').data('insuranceIds', []);
                }
                else {
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
                    this.selectedInsGrpList = []; // empty the selected insurance group list
                }
            },

            // Binding selected facility from the check box
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

            // Binding Report Params
            getReportParams: function () {
                return urlParams = {
                    'dateFormat': this.viewModel.dateFormat,
                    'country_alpha_3_code': this.viewModel.country_alpha_3_code,
                    'facilityIds': this.selectedFacilityList || [],
                    'allFacilities': this.viewModel.allFacilities || '',
                    'billingProviders': this.selectedBillingProList || [],
                    'allBillingProvider': this.viewModel.allBillingProvider || '',
                    'accountingDateFrom': this.viewModel.accountingDateFrom.format('MM/DD/YYYY'),
                    'accountingDateTo': this.viewModel.accountingDateTo.format('MM/DD/YYYY'),
                    'serviceDateFrom': this.viewModel.serviceDateFrom.format('MM/DD/YYYY'),
                    'serviceDateTo': this.viewModel.serviceDateTo.format('MM/DD/YYYY'),
                    'insuranceIds': this.viewModel.insuranceIds,
                    'insuranceOption': this.viewModel.insuranceOption || '',
                    'insuranceGroupIds': this.viewModel.insuranceGroupIds,
                    'allInsuranceGroup': this.viewModel.allInsGrpSelection || ''
                };
            },

        });
        return PaymentsRealizationRateAnalysisView;
    });
