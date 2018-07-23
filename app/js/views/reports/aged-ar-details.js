define(['jquery',
    'underscore',
    'backbone',
    'shared/report-utils',
    'text!templates/reports/aged-ar-details.html',
],
    function ($,
        _,
        Backbone,
        UI,
        AgedARDetailsTemplate
    ) {
        var AgedARDetailView = Backbone.View.extend({
            rendered: false,
            dtpEndMonth: null,
            expanded: false,
            mainTemplate: _.template(AgedARDetailsTemplate),
            viewModel: {
                facilities: null,
                allFacilities: false,
                facilityIds: null,
                studyStatusCodes: null,
                openInNewTab: false,
                reportId: null,
                reportCategory: null,
                reportTitle: null,
                reportFormat: null,
                billingProvider: null,
                allBillingProvider: false,
                excelExtended: false
            },
            selectedBillingProList: [],
            selectedFacilityList: [],
            defaultyFacilityId: null,
            events: {
                'click #btnViewReport': 'onReportViewClick',
                'click #btnViewReportNewTabAgedArDetails': 'onReportViewClick',
                'click #btnPdfReport': 'onReportViewClick',
                'click #btnExcelReport': 'onReportViewClick',
                'click #btnExcelReportExtended': 'onReportViewClick',
                'click #btnCsvReport': 'onReportViewClick',
                'click #btnXmlReport': 'onReportViewClick'
            },

            initialize: function (options) {
                this.showForm();
                var modelCollection = Backbone.Collection.extend({
                    model: Backbone.Model.extend({})
                });
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
                // this.bindDateRangePicker();
                // this.drpStudyDt.setStartDate(this.viewModel.dateFrom);
                // this.drpStudyDt.setEndDate(this.viewModel.dateTo);
                this.viewModel.fromDate = commonjs.bindDateTimePicker("txtFromDate", { format: "L" });
                this.viewModel.fromDate.date(commonjs.getFacilityCurrentDateTime(app.facilityID));

                UI.bindBillingProvider();
                $('#ddlFacilityFilter').multiselect({
                    maxHeight: 200,
                    buttonWidth: '250px',
                    width: '300px',
                    enableFiltering: true,
                    includeSelectAllOption: true,
                    enableCaseInsensitiveFiltering: true
                });
            },


            onReportViewClick: function (e) {
                var btnClicked = e && e.target ? $(e.target) : null; 
                this.getSelectedFacility();
                this.getBillingProvider();
                if (btnClicked && btnClicked.prop('tagName') === 'I') {
                    btnClicked = btnClicked.parent(); // in case FA icon 'inside'' button was clicked...
                }
                var rFormat = btnClicked ? btnClicked.attr('data-rformat') : null;
                var openInNewTab = btnClicked ? btnClicked.attr('id') === 'btnViewReportNewTabAgedArDetails' : false;
                this.excelExtended = btnClicked ? btnClicked.attr('id') === 'btnExcelReportExtended' : false;
                this.viewModel.reportFormat = rFormat;
                this.viewModel.openInNewTab = (openInNewTab && rFormat === 'html') ? true : false;
             //   if (this.hasValidViewModel()) {
                    var urlParams = this.getReportParams();
                    UI.showReport('aged-ar-details', 'billing', this.viewModel.reportFormat, urlParams, this.viewModel.openInNewTab);
             //   }             
            },


            hasValidViewModel: function () {
                // if (this.viewModel.reportId == null || this.viewModel.reportCategory == null || this.viewModel.reportFormat == null) {
                //     commonjs.showWarning('Please check report id, category, and/or format!');
                //     return false;
                // }
                if (!(this.viewModel.fromDate && this.viewModel.fromDate.date())) {
                    commonjs.showWarning('Please select date!');
                    return false;
                }
                if (this.viewModel.fromDate.date().diff(commonjs.getFacilityCurrentDateTime(app.facilityID)) > 0) {
                    commonjs.showWarning('Please do not select future date ');
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

            getReportParams: function () {
                var urlParams = {                    
                    'fromDate': this.viewModel.fromDate.date().format('YYYY-MM-DD'),                   
                    'incPatDetail': $('#byPrimaryPayer').prop('checked'),
                    'excCreditBal': $('#excCreBal').prop('checked'),
                    'excelExtended': this.excelExtended ? this.excelExtended : 'false',
                    'changeByPayer': $('#byPrimaryPayer').prop('checked'),
                    'allFacilities': this.viewModel.allFacilities,
                    'facilityIds': this.selectedFacilityList ? this.selectedFacilityList : [],
                    'billingProvider': this.selectedBillingProList ? this.selectedBillingProList : [],
                    'allBillingProvider': this.viewModel.allBillingProvider ? this.viewModel.allBillingProvider : '',
                }
                return urlParams;
            }

        });

        return AgedARDetailView;
    });
