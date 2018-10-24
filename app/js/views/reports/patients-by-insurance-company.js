/**
 * Author  : Vengadesh
 * Created : 01/09/17
 * ----------------------------------------------------------------------
 * Copyright © EMD Systems Software Private Ltd.  All rights reserved.
 * This file is subject to the terms and conditions defined in
 * file 'LICENSE.txt', which is part of this source code package.
 * All other rights reserved.
 * ----------------------------------------------------------------------
 */
define([
    'jquery'
    , 'underscore'
    , 'backbone'
    , 'shared/report-utils'
    , 'text!templates/reports/patients-by-insurance-company.html'
],
    function ($, _, Backbone, UI, patientsByInsuranceCompanyTemplate) {

        var PatientsByInsuranceCompanyView = Backbone.View.extend({
            rendered: false,
            expanded: false,
            mainTemplate: _.template(patientsByInsuranceCompanyTemplate),
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
                insuranceOption: null
            },
            selectedFacilityListDetail: [],
            events: {
                'click #btnViewReport': 'onReportViewClick',
                'click #btnViewReportNewTabPatByIns': 'onReportViewClick',
                'click #btnPdfReport': 'onReportViewClick',
                'click #btnExcelReport': 'onReportViewClick',
                'click #btnCsvReport': 'onReportViewClick',
                'click #btnXmlReport': 'onReportViewClick',
                "change #ddlInsuranceBinding": "onInsuranceBinding",
                'change #noDateSpecify': 'onNoDateSpecified',
                'change #claimDateDiv': 'onClaimDateSearch',
                'change .chkInsurance': 'onInsuranceIsActive'
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
                $('#ddlFacilityFilter, #ddlInsuranceBinding').multiselect({
                    maxHeight: 200,
                    buttonWidth: '300px',
                    width: '300px',
                    enableFiltering: true,
                    includeSelectAllOption: true,
                    enableCaseInsensitiveFiltering: true
                });
                // Binding Billing Provider MultiSelect
                UI.bindBillingProvider();
                UI.bindInsuranceAutocomplete('txtInsuranceName', 'btnAddInsurance', 'ulListInsurance', false);
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

             // Binding Insurance information
        onInsuranceBinding: function () {
            if ($('#ddlInsuranceBinding').val() == 'S'){
                $('#ddlInsuranceOptionBox').show();
                $('#divListInsurance').show();
            }
            else {
                $('#ddlInsuranceOptionBox').hide();
                $('#divListInsurance').hide();
                $('#ulListInsurance').empty();
                this.viewModel.insuranceOption = [];
                $('#ulListInsurance').data('insuranceIds', []);
            }
        },       

            onReportViewClick: function (e) {
                  //Insurance Mapping
            this.viewModel.insuranceOption = $('ul#ulListInsurance li').map(function () {
                return this.id;
            }).get();

                var btnClicked = e && e.target ? $(e.target) : null;
                this.getSelectedFacility();
                this.getBillingProvider();
                if (btnClicked && btnClicked.prop('tagName') === 'I') {
                    btnClicked = btnClicked.parent(); // in case FA icon 'inside'' button was clicked...
                }
                var rFormat = btnClicked ? btnClicked.attr('data-rformat') : null;
                var openInNewTab = btnClicked ? btnClicked.attr('id') === 'btnViewReportNewTabPatByIns' : false;
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
                    commonjs.showWarning('Please select date range!');
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
                var billing_pro = []
                var selected = $("#ddlBillingProvider option:selected");
                selected.each(function () {
                    billing_pro.push($(this).val());
                });
                this.selectedBillingProList = billing_pro;
                this.viewModel.allBillingProvider = this.selectedBillingProList && this.selectedBillingProList.length === $("#ddlBillingProvider option").length;
            },

            onNoDateSpecified: function(){
              $('#divReportDate').hide();
              $('#optionComment').show();
              this.viewModel.dateFrom = "";
              this.viewModel.dateTo="";
            },

            onInsuranceIsActive: function () {
                var insuranceActive = $("#insuranceActive").is(':checked');
                UI.bindInsuranceAutocomplete('txtInsuranceName', 'btnAddInsurance', 'ulListInsurance', insuranceActive);
                $('#ulListInsurance').empty();
                this.viewModel.insuranceOption = [];
                $('#ulListInsurance').data('insuranceIds', []);
            },

            onClaimDateSearch: function(){
              $('#divReportDate').show();
              $('#optionComment').hide();
              this.viewModel.dateFrom = commonjs.getFacilityCurrentDateTime(app.facilityID);
              this.viewModel.dateTo = this.viewModel.dateFrom.clone();
            },

            getReportParams: function () {
                return urlParams = {
                    'facilityIds': this.selectedFacilityList || [],
                    'allFacilities': this.viewModel.allFacilities || '',
                    'fromDate': this.viewModel && this.viewModel.dateFrom && this.viewModel.dateFrom.format('YYYY-MM-DD'),
                    'toDate': this.viewModel && this.viewModel.dateTo && this.viewModel.dateTo.format('YYYY-MM-DD'),
                    'billingProvider': this.selectedBillingProList || [],
                    'allBillingProvider': this.viewModel.allBillingProvider || '',
                    'billingProFlag': this.viewModel.allBillingProvider == 'true' ? true : false,
                    'insuranceProviderIds': this.viewModel.insuranceOption || '',
                    'insuranceActive': $("#insuranceActive").is(':checked')
                };
            }
        });

        return PatientsByInsuranceCompanyView;
    });
