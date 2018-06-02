define([
    'jquery'
    , 'underscore'
    , 'backbone'
    , 'modules/reporting/utils/ui'
    , 'text!modules/reporting/templates/billing/diagnosis-count.html'
],
    function ($, _, Backbone, UI, MainTemplate) {
        var DiagnosisCountView = Backbone.View.extend({
            rendered: false,
            drpStudyDt: null,
            expanded: false,
            mainTemplate: _.template(MainTemplate),
            viewModel: {
                facilities: null,
                //selectedFacilityId: null,
                dateFrom: null,
                dateTo: null,
                allFacilities: false,
                facilityIds: null,
                openInNewTab: false,
                reportId: null,
                reportCategory: null,
                reportTitle: null,
                reportFormat: null,
                billingProvider: null,
                allBillingProvider: false
            },

            events: {
                'click #btnViewReport': 'onReportViewClick',
                'click #btnViewReportNewTab': 'onReportViewClick',
                'click #btnPdfReport': 'onReportViewClick',
                'click #btnExcelReport': 'onReportViewClick',
                'click #btnCsvReport': 'onReportViewClick',
                'click #btnXmlReport': 'onReportViewClick'
            },

            initialize: function (options) {
                this.showForm();
                var modelCollection = Backbone.Collection.extend({
                    model: Backbone.Model.extend({})
                });

                // initialize view model and set any defaults that are not constants
                UI.initializeReportingViewModel(options, this.viewModel);
                this.viewModel.facilities = new modelCollection(commonjs.getCurrentUsersFacilitiesFromAppSettings());
                this.viewModel.dateFrom = moment().startOf('month').add(-1, 'month');    // start of the last month
                this.viewModel.dateTo = this.viewModel.dateFrom.clone().endOf('month');  // end of the last month
            },

            showForm: function () {
                console.log('view - showForm');
                if (!this.rendered) {
                    this.render();
                }
                commonjs.initializeScreen({ header: { screen: this.viewModel.reportTitle, ext: this.viewModel.reportId } }); // html title
                UI.setPageTitle(this.viewModel.reportTitle);
            },

            render: function () {
                console.log('view - render');
                this.$el.html(this.mainTemplate(this.viewModel));

                // bind DRP and initialize it
                this.bindDateRangePicker();
                // this.drpStudyDt.setStartDate(this.viewModel.dateFrom);
                // this.drpStudyDt.setEndDate(this.viewModel.dateTo);

                // pre-select default facility
                this.selectDefaultFacility();
                $('#ddlFacilityFilter').multiselect({
                    maxHeight: 200,
                    buttonWidth: '200px',
                    enableFiltering: true,
                    includeSelectAllOption: true,
                    enableCaseInsensitiveFiltering: true
                });
                UI.bindBillingProvider();
            },

            bindDateRangePicker: function () {
                var self = this;
                var drpEl = $('#txtStudyDtRange');
                var drpOptions = { autoUpdateInput: true, locale: { format: 'L' } };
                this.drpStudyDt = commonjs.bindDateRangePicker(drpEl, drpOptions, 'past', function (start, end, format) {
                    console.info('DRP: ', format, start, end);
                    self.viewModel.dateFrom = start;
                    self.viewModel.dateTo = end;
                });
                // // additional events that will trigger refreshes
                // drpEl.on('apply.daterangepicker', function (ev, drp) {
                //     console.log('on apply.daterangepicker');
                // });
                drpEl.on('cancel.daterangepicker', function (ev, drp) {
                    console.log('on cancel.daterangepicker');
                    self.viewModel.dateFrom = null;
                    self.viewModel.dateTo = null;
                });
            },

            onReportViewClick: function (e) {
                var btnClicked = e && e.target ? $(e.target) : null;
                this.getSelectedFacility();
                this.getBillingProvider();
                if (btnClicked && btnClicked.prop('tagName') === 'I') {
                    btnClicked = btnClicked.parent(); // in case FA icon 'inside'' button was clicked...
                }
                const rFormat = btnClicked ? btnClicked.attr('data-rformat') : null;
                const openInNewTab = btnClicked ? btnClicked.attr('id') === 'btnViewReportNewTab' : false;
                this.viewModel.reportFormat = rFormat;
                this.viewModel.openInNewTab = (openInNewTab && rFormat === 'html') ? true : false;
                //  if (this.hasValidViewModel()) {
                const urlParams = this.getReportParams();
                UI.showReport(this.viewModel.reportId, this.viewModel.reportCategory, this.viewModel.reportFormat, urlParams, this.viewModel.openInNewTab);
                // }
                // document.getElementById("facilityCheckbox").style.display = "none";
                // document.getElementById("billingCheckboxes").style.display = "none";
            },

            selectDefaultFacility: function () {
                // if there is only 1 facility select it, otherwise use default facility id
                //  var defFacId = this.viewModel.facilities.length === 1 ? this.viewModel.facilities.at(0).get('id') : app.default_facility_id;
                // works only if list exists by setting its value to array of selections
                // fires a change event
                // $('#ddlFacilities').val([defFacId]).change();
                //  this.defaultyFacilityId = defFacId;

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
            
            // multi select facilities - worked
            getSelectedFacility: function (e) {
                var selected = $("#ddlFacilityFilter option:selected");
                var facilities = [];
                selected.each(function () {
                    facilities.push($(this).val());
                });
                this.selectedFacilityList = facilities
                //   this.viewModel.allFacilities = this.selectedFacilityList && this.selectedFacilityList.length === $("#ddlFacilityFilter option").length;
            },

            // multi select billing provider - worked
            getBillingProvider: function (e) {
                var billing_pro = []
                var selected = $("#ddlBillingProvider option:selected");
                selected.each(function () {
                    billing_pro.push($(this).val());
                });
                this.selectedBillingProList = billing_pro;
                //this.viewModel.allBillingProvider = this.selectedBillingProList && this.selectedBillingProList.length === $("#ddlBillingProvider option").length;
            },

            getReportParams: function () {
                const urlParams = {
                    'facilityIds': this.selectedFacilityList ? this.selectedFacilityList : [],
                    'allFacilities': this.viewModel.allFacilities ? this.viewModel.allFacilities : '',
                    'fromDate': this.viewModel.dateFrom.format('YYYY-MM-DD'),
                    'toDate': this.viewModel.dateTo.format('YYYY-MM-DD'),
                    'billingProvider': this.selectedBillingProList ? this.selectedBillingProList : [],
                    'allBillingProvider': this.viewModel.allBillingProvider ? this.viewModel.allBillingProvider : '',
                    'billingProFlag': this.viewModel.allBillingProvider == 'true' ? true : false,
                }
                return urlParams;
            }

        });

        return DiagnosisCountView;
    });
