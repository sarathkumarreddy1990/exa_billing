define([
    'jquery'
    , 'underscore'
    , 'backbone'
    , 'shared/report-utils'
    , 'text!templates/reports/payments-by-ins-company.html'
],
    function ($, _, Backbone, UI, paymentsByInsCompanyTemplate) {

        var PaymentsByInsCompanyView = Backbone.View.extend({
            rendered: false,
            expanded: false,
            mainTemplate: _.template(paymentsByInsCompanyTemplate),
            viewModel: {
                facilities: null,
                modalities: null,
                dateFrom: null,
                dateTo: null,
                allFacilities: false,
                facilityIds: null,
                openInNewTab: false,
                reportId: null,
                reportCategory: null,
                reportTitle: null,
                reportFormat: null,
                reportDate: null,
                billingProvider: null,
                allBillingProvider: false,
                insuranceOption: null,
                insuranceIds: null,
                insuranceGroupIds: null
            },
            selectedFacilityListDetail: [],
            defaultyFacilityId: null,
            selectedInsGrpList: [],
            events: {
                'click #btnViewReport': 'onReportViewClick',
                'click #btnViewReportNewTabPayByInsComp': 'onReportViewClick',
                'click #btnPdfReport': 'onReportViewClick',
                'click #btnExcelReport': 'onReportViewClick',
                'click #btnCsvReport': 'onReportViewClick',
                'click #btnXmlReport': 'onReportViewClick',
                'click #showInsGroupCheckboxes': 'showInsuranceGroupList',
                'change #ddlInsuranceOption': 'onInsuranceOptionChange'
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

                // bind DRP and initialize it
                this.bindDateRangePicker();
                this.drpStudyDt.setStartDate(this.viewModel.dateFrom);
                this.drpStudyDt.setEndDate(this.viewModel.dateTo);
                $('#ddlInsuranceOption')
                .append('<option value="All">' + commonjs.geti18NString('shared.buttons.allInsurance'))
                .append('<option value="S">' + commonjs.geti18NString('shared.buttons.insurances'))
                .append('<option value="G">' + commonjs.geti18NString('shared.buttons.insuranceGroup'));

                $('#ddlFacilityFilter').multiselect({
                    maxHeight: 200,
                    buttonWidth: '300px',
                    width: '300px',
                    enableFiltering: true,
                    includeSelectAllOption: true,
                    enableCaseInsensitiveFiltering: true
                });
                $('#ddlInsuranceOption').multiselect({
                    maxHeight: '200px',
                    buttonWidth: '210px',
                    width: '300px'
                });

                UI.bindBillingProvider();
                UI.bindInsuranceAutocomplete(commonjs.geti18NString('report.reportFilter.selectInsurance'), 'btnAddInsurance', 'ulListInsurance');
                UI.bindInsuranceProviderAutocomplete('Select Insurance Group', 'btnAddInsuranceProvider', 'ulListInsuranceProvider');

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

            onReportViewClick: function (e) {
                var btnClicked = e && e.target ? $(e.target) : null;
                this.getSelectedFacility();
                this.getBillingProvider();
                if (btnClicked && btnClicked.prop('tagName') === 'I') {
                    btnClicked = btnClicked.parent(); // in case FA icon 'inside'' button was clicked...
                }
                var rFormat = btnClicked ? btnClicked.attr('data-rformat') : null;
                var openInNewTab = btnClicked ? btnClicked.attr('id') === 'btnViewReportNewTabPayByInsComp' : false;
                this.viewModel.reportFormat = rFormat;
                this.viewModel.openInNewTab = openInNewTab && rFormat === 'html';
                this.viewModel.insuranceIds = $('ul#ulListInsurance li').map(function () {
                    return this.id;
                }).get();
                this.viewModel.insuranceGroupIds = $('ul#ulListInsuranceProvider li').map(function () {
                    return this.id;
                }).get();
                this.viewModel.insuranceOption = $('#ddlInsuranceOption').val();
                if (this.hasValidViewModel()) {
                    var urlParams = this.getReportParams();
                    UI.generateReport(this.viewModel.reportId, this.viewModel.reportCategory, this.viewModel.reportFormat, urlParams);
                }
            },

            hasValidViewModel: function () {
                if (this.viewModel.reportId == null || this.viewModel.reportCategory == null || this.viewModel.reportFormat == null) {
                    commonjs.showWarning('messages.status.pleaseCheckReportIdCategoryandorFormat');
                    return false;
                }

                if (this.viewModel.dateFrom == null || this.viewModel.dateTo == null) {
                    commonjs.showWarning('messages.status.pleaseSelectDateRange');
                    return false;
                }

                return true;
            },

            // multi select facilities - worked
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
                var billing_pro = [];
                var selected = $("#ddlBillingProvider option:selected");
                selected.each(function () {
                    billing_pro.push($(this).val());
                });
                this.selectedBillingProList = billing_pro;
                this.viewModel.allBillingProvider = this.selectedBillingProList && this.selectedBillingProList.length === $("#ddlBillingProvider option").length;
            },

             // Insurance List Box for (All, selected Insurance, Insurance Group)
             onInsuranceOptionChange: function () {
                if ($('#ddlInsuranceOption').val() == 'S') {
                    $("#ddlOptionBox").removeClass('d-none');
                    $("#ddlOptionBoxList").removeClass('d-none');
                    $("#ddlInsuranceGroupBox").addClass('d-none');
                    $("#ddlInsuranceGroupBoxList").addClass('d-none');
                    $('#ulListInsuranceProvider').empty();
                    this.viewModel.insuranceGroupIds = [];
                    $('#ulListInsurance').data('insuranceGroupIds', []);
                    this.selectedInsGrpList = [];
                    $('#txtInsuranceProviderName').empty();
                }
                else if ($('#ddlInsuranceOption').val() == 'G') {
                    $("#ddlOptionBox").addClass('d-none');
                    $("#ddlOptionBoxList").addClass('d-none');
                    $("#ddlInsuranceGroupBox").removeClass('d-none');
                    $("#ddlInsuranceGroupBoxList").removeClass('d-none');
                    $('#ulListInsurance').empty();
                    $('#ulListInsuranceProvider').empty();
                    this.viewModel.insuranceIds = [];
                    $('#ulListInsurance').data('insuranceIds', []);
                    $('#txtInsuranceName').empty()
                }
                else {
                    $("#ddlOptionBox").addClass('d-none');
                    $("#ddlOptionBoxList").addClass('d-none');
                    $("#ddlInsuranceGroupBox").addClass('d-none');
                    $("#ddlInsuranceGroupBoxList").addClass('d-none');
                    $('#ulListInsurance').empty();
                    $('#ulListInsuranceProvider').empty();
                    this.viewModel.insuranceIds = [];
                    this.viewModel.insuranceGroupIds = [];
                    $('#ulListInsurance').data('insuranceIds', []);
                    $('#ulListInsuranceProvider').data('insuranceGroupIds', []);
                    this.selectedInsGrpList = [];
                    $('#txtInsuranceName').empty();
                    $('#txtInsuranceProviderName').empty();
                }
            },

            getReportParams: function () {
                return urlParams = {
                    'facilityIds': this.selectedFacilityList || [],
                    'allFacilities': this.viewModel.allFacilities || '',
                    'fromDate': this.viewModel.dateFrom.format('YYYY-MM-DD'),
                    'toDate': this.viewModel.dateTo.format('YYYY-MM-DD'),
                    'billingProvider': this.selectedBillingProList || [],
                    'allBillingProvider': this.viewModel.allBillingProvider || '',
                    'billingProFlag': this.viewModel.allBillingProvider || '',
                    'countryCode': app.country_alpha_3_code,
                    'insuranceIds': this.viewModel.insuranceIds || '',
                    'insuranceOption': this.viewModel.insuranceOption || '',
                    'insuranceGroupIds': this.viewModel.insuranceGroupIds || ''
                };
            }
        });

        return PaymentsByInsCompanyView;
    });
