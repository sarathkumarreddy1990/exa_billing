define
    ([
        'jquery'
        , 'underscore'
        , 'backbone'
        , 'shared/report-utils'
        , 'text!templates/reports/collections.html'
    ],
    function ($, _, Backbone, UI, collectionReportTemplate) {
        var CollectionView = Backbone.View.extend({
            rendered: false,
            drpClaimDate: null,
            expanded: false,
            mainTemplate: _.template(collectionReportTemplate),
            viewModel: {
                facilities: null,
                allFacilities: null,
                facilityIds: null,
                dateFrom: null,
                dateTo: null,
                billingProvider: null,
                allBillingProvider: false,
                openInNewTab: false,
                reportId: null,
                reportCategory: null,
                reportTitle: null,
                reportFormat: null,
                claimsToCollections: false,
                country_alpha_3_code: 'usa'
            },

            events: {
                'click #btnCollectionViewReport': 'onReportViewClick',
                'click #btnViewReportNewTabCollections': 'onReportViewClick',
                'click #btnCollectionPdfReport': 'onReportViewClick',
                'click #btnCollectionExcelReport': 'onReportViewClick',
                'click #btnCollectionCsvReport': 'onReportViewClick',
                'click #btnCollectionXmlReport': 'onReportViewClick'
            },

            initialize: function (options) {
                var self = this;
                self.showForm();
                self.$el.html(self.mainTemplate(self.viewModel));
                UI.initializeReportingViewModel(options, self.viewModel);
                UI.getReportSetting(this.viewModel, 'all', 'dateFormat');
                self.viewModel.dateFrom = commonjs.getFacilityCurrentDateTime(app.facilityID);
                self.viewModel.dateTo = self.viewModel.dateFrom.clone();
            },

            showForm: function () {
                if (!this.rendered) {
                    this.render();
                }
                commonjs.initializeScreen({ header: { screen: this.viewModel.reportTitle, ext: this.viewModel.reportId } });
                UI.setPageTitle(this.viewModel.reportTitle);
            },

            render: function () {
                var self = this;
                var modelCollection = Backbone.Collection.extend({
                    model: Backbone.Model.extend({})
                });
                self.viewModel.facilities = new modelCollection(commonjs.getCurrentUsersFacilitiesFromAppSettings());
                self.$el.html(self.mainTemplate(this.viewModel));
                self.bindDateRangePicker();
                self.drpClaimDate.setStartDate(self.viewModel.dateFrom);
                self.drpClaimDate.setEndDate(self.viewModel.dateTo);
                $('#ddlFacilityFilter').multiselect({
                    maxHeight: 200,
                    buttonWidth: '300px',
                    enableFiltering: true,
                    includeSelectAllOption: true,
                    enableCaseInsensitiveFiltering: true
                });
                UI.bindBillingProvider();
            },

            bindDateRangePicker: function () {
                var self = this;
                var drpEl = $('#txtDateRangeFromTo');
                var dropOPtions = { autoUpdateInput: true, locale: { format: 'L' } };
                self.drpClaimDate = commonjs.bindDateRangePicker(drpEl, dropOPtions, 'past', function (start, end, format) {
                    self.viewModel.dateFrom = start;
                    self.viewModel.dateTo = end;
                });
                drpEl.on('cancel.daterangepicker', function (ev, drp) {
                    self.viewModel.dateFrom = null;
                    self.viewModel.dateTo = null;
                });
                commonjs.isMaskValidate();
            },

            hasValidViewModel: function () {
                var self = this;
                if (!self.viewModel.reportId || !self.viewModel.reportCategory || !self.viewModel.reportFormat) {
                    commonjs.showWarning('messages.status.pleaseCheckReportIdCategoryandorFormat');
                    return;
                }

                if (!self.viewModel.dateFrom || !self.viewModel.dateTo) {
                    commonjs.showWarning('messages.status.pleaseSelectDateRange');
                    return;
                }
                return true;
            },

            getSelectedFacility: function (e) {
                var self = this;
                var selected = $("#ddlFacilityFilter option:selected");
                var facilities = [];
                selected.each(function () {
                    facilities.push($(this).val());
                });
                self.selectedFacilityList = facilities;
                self.viewModel.allFacilities = self.selectedFacilityList && self.selectedFacilityList.length === $("#ddlFacilityFilter option").length;
            },

            getBillingProvider: function (e) {
                var self = this;
                var billing_pro = [];
                var selected = $("#ddlBillingProvider option:selected");
                selected.each(function () {
                    billing_pro.push($(this).val());
                });
                self.selectedBillingProList = billing_pro;
                self.viewModel.allBillingProvider = self.selectedBillingProList && self.selectedBillingProList.length === $('#ddlBillingProvider option').length;
            },

            onReportViewClick: function (e) {
                var self = this;
                var btnClicked = e && e.target ? $(e.target) : null;
                self.getSelectedFacility();
                self.getBillingProvider();
                if (btnClicked && btnClicked.prop('tagName') === 'I') {
                    btnClicked = btnClicked.parent(); // in case FA icon 'inside'' button was clicked...
                }
                var rFormat = btnClicked ? btnClicked.attr('data-rformat') : null;
                var openInNewTab = btnClicked ? btnClicked.attr('id') === 'btnViewReportNewTabCollections' : false;
                self.viewModel.reportFormat = rFormat;
                self.viewModel.openInNewTab = (openInNewTab && rFormat === 'html') ? true : false;
                if ($('#chkSentCollections').prop('checked')) {
                    if (confirm(commonjs.geti18NString("messages.status.areYouSureToSendClaimstoCollections"))) {
                        self.viewModel.claimsToCollections = true;
                    } else {
                        self.viewModel.claimsToCollections = false;
                        UI.clearIframe('reportFrame');
                        return;
                    }
                }
                else {
                    self.viewModel.claimsToCollections = false;
                }
                if (self.hasValidViewModel()) {
                    var urlParams = self.getReportParams();
                    UI.generateReport(self.viewModel.reportId, self.viewModel.reportCategory, self.viewModel.reportFormat, urlParams);
                }
            },

            getReportParams: function () {
                var urlParams = {
                    'facilityIds': this.selectedFacilityList || [],
                    'allFacilities': this.viewModel.allFacilities || '',
                    'fromDate': this.viewModel.dateFrom.format('YYYY-MM-DD'),
                    'toDate': this.viewModel.dateTo.format('YYYY-MM-DD'),
                    'billingProvider': this.selectedBillingProList || [],
                    'allBillingProvider': this.viewModel.allBillingProvider || '',
                    'billingProFlag': this.viewModel.allBillingProvider == 'true' ? true : false,
                    'claimsToCollections': this.viewModel.claimsToCollections,
                    'country_alpha_3_code': this.viewModel.country_alpha_3_code
                }
                return urlParams;
            }

        });
        return CollectionView;
    });
