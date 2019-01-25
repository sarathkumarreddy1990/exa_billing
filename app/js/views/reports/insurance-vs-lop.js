define([
    'jquery'
    , 'underscore'
    , 'backbone'
    , 'shared/report-utils'
    , 'text!templates/reports/insurance-vs-lop.html'
],
    function ($, _, Backbone, UI, InsuranceVsLOPTemplate) {

        var InsuranceVsLOPView = Backbone.View.extend({
            rendered: false,
            drpStudyDt: null,
            mainTemplate: _.template(InsuranceVsLOPTemplate),
            viewModel: {
                selectedStudyStatusList: null,
                allStudyStatuses: false,
                dateFrom: null,
                dateTo: null,
                studyStatusCodes: null,
                openInNewTab: false,
                reportId: null,
                reportCategory: null,
                reportTitle: null,
                reportFormat: null,
                facilities: null,
                allFacilities: false,
                facilityIds: null,
                billingProvider: null,
                allBillingProvider: false
            },

            events: {
                'change #ddlStudyStatuses': 'onStudyStatusesChange',
                'click #btnViewReport': 'onReportViewClick',
                'click #btnViewReportNewTabInsVsLop': 'onReportViewClick',
                'click #btnPdfReport': 'onReportViewClick',
                'click #btnExcelReport': 'onReportViewClick',
                'click #btnCsvReport': 'onReportViewClick',
                'click #btnXmlReport': 'onReportViewClick'
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
                $('#ddlFacilityFilter').multiselect({
                    maxHeight: 200,
                    buttonWidth: '300px',
                    width: '300px',
                    enableFiltering: true,
                    includeSelectAllOption: true,
                    enableCaseInsensitiveFiltering: true
                });
                // Binding Billing Provider MultiSelect
                UI.bindBillingProvider();
                UI.bindStudyStatus();
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

            onStudyStatusesChange: function (e) {
                e.stopPropagation();
                this.viewModel.studyStatusCodes = $(e.target) && $(e.target).val() ? $(e.target).val() : null; // array
                var selCount = this.viewModel.studyStatusCodes ? this.viewModel.studyStatusCodes.length : 0;
                $('#selStudyStatusesCount').html(' (' + selCount + ')');
            },

            getStudyStatuses: function (facilityIds, allFacilities) {
                UI.bindStatusesToMultiselect('#ddlStudyStatuses', facilityIds, function (err, ddlEl) {
                    if (!err) {
                        ddlEl.val(['APP']).change();
                    }
                }, allFacilities);
            },

            // multi select facilities - worked
            getSelectedStudyStatus: function (e) {
                var selected = $("#ddlStudyStatus option:selected");
                var studyStatuses = [];
                selected.each(function () {
                    studyStatuses.push($(this).val());
                });
                this.selectedStudyStatusList = studyStatuses;
                this.viewModel.allStudyStatuses = this.selectedStudyStatusList && this.selectedStudyStatusList.length === $("#ddlStudyStatus option").length;
            },

            // multi select facilities - worked
            getSelectedFacility: function (e) {
                var selected = $("#ddlFacilityFilter option:selected");
                var facilities = [];
                selected.each(function () {
                    facilities.push($(this).val());
                });
                this.selectedFacilityList = facilities;
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

            onReportViewClick: function (e) {
                var btnClicked = e && e.target ? $(e.target) : null;
                this.getSelectedFacility();
                this.getBillingProvider();
                this.getSelectedStudyStatus();
                if (btnClicked && btnClicked.prop('tagName') === 'I') {
                    btnClicked = btnClicked.parent(); // in case FA icon 'inside'' button was clicked...
                }
                var rFormat = btnClicked ? btnClicked.attr('data-rformat') : null;
                var openInNewTab = btnClicked ? btnClicked.attr('id') === 'btnViewReportNewTabInsVsLop' : false;
                this.viewModel.reportFormat = rFormat;
                this.viewModel.openInNewTab = openInNewTab && rFormat === 'html';
                if (this.hasValidViewModel()) {
                    var urlParams = this.getReportParams();
                    UI.showReport(this.viewModel.reportId, this.viewModel.reportCategory, this.viewModel.reportFormat, urlParams, this.viewModel.openInNewTab);
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

            getReportParams: function () {
                return urlParams = {
                    'studyStatusCodes': this.selectedStudyStatusList || [],
                    'allStudyStatuses': this.viewModel.allStudyStatuses || '',
                    'fromDate': this.viewModel.dateFrom.format('YYYY-MM-DD'),
                    'toDate': this.viewModel.dateTo.format('YYYY-MM-DD'),
                    'facilityIds': this.selectedFacilityList ? this.selectedFacilityList : [],
                    'allFacilities': this.viewModel.allFacilities ? this.viewModel.allFacilities : '',
                    'billingProvider': this.selectedBillingProList ? this.selectedBillingProList : [],
                    'allBillingProvider': this.viewModel.allBillingProvider ? this.viewModel.allBillingProvider : '',
                    'billingProFlag': this.viewModel.allBillingProvider == 'true' ? true : false
                };
            }
        });

return InsuranceVsLOPView;
    });
