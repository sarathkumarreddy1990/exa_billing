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
                dateFrom: null,
                dateTo: null,
                studyStatusCodes: null,
                openInNewTab: false,
                reportId: null,
                reportCategory: null,
                reportTitle: null,
                reportFormat: null
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

            onReportViewClick: function (e) {
                var btnClicked = e && e.target ? $(e.target) : null;
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
                    commonjs.showWarning('Please check report id, category, and/or format!');
                    return false;
                }
                
                if (this.viewModel.dateFrom == null || this.viewModel.dateTo == null) {
                    commonjs.showWarning('Please select study date range!');
                    return false;
                }
            
                return true;
            },

            getReportParams: function () {
                return urlParams = {
                    'fromDate': this.viewModel.dateFrom.format('YYYY-MM-DD'),
                    'toDate': this.viewModel.dateTo.format('YYYY-MM-DD'),
                    'studyStatusCodes': this.viewModel.studyStatusCodes
                };
            }
        });

        return InsuranceVsLOPView;
    });
