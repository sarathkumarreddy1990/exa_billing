define([
    'jquery'
    , 'underscore'
    , 'backbone'
    , 'shared/report-utils'
    , 'text!templates/reports/patient-statement.html'
],
    function ($, _, Backbone, UI, PatientStatementTemplate) {

        var PatientStatementView = Backbone.View.extend({
            rendered: false,
            mainTemplate: _.template(PatientStatementTemplate),
            viewModel: {
                sDate: null,
                patientIds: null,
                patientOption: null,
                billingProvider: null,
                minAmount: null,
                openInNewTab: false,
                reportId: null,
                reportCategory: null,
                reportTitle: null,
                reportFormat: null,
                facilities: null,
                allFacilities: null,
                fromDate: null,
                allBillingProvider: false,
                patientLastnameFrom: null,
                patientLastnameTo: null
            },
            selectedFacilityList: [],
            events: {
                'change #ddlPatientOption': 'onPatientOptionChange',
                'click #btnViewReport': 'onReportViewClick',
                'click #btnViewReportNewTabPatStatement': 'onReportViewClick',
                'click #btnPdfReport': 'onReportViewClick',
                'click #btnExcelReport': 'onReportViewClick',
                'click #btnCsvReport': 'onReportViewClick',
                'click #btnXmlReport': 'onReportViewClick'
            },

            usermessage: {
                selectPatient: "Search Patient"
            },

            initialize: function (options) {
                this.showForm();
                var modelCollection = Backbone.Collection.extend({
                    model: Backbone.Model.extend({})
                });

                // initialize view model and set any defaults that are not constants
                UI.initializeReportingViewModel(options, this.viewModel);
                // Set date range to Facility Date
                this.viewModel.dateFrom = commonjs.getFacilityCurrentDateTime(app.facilityID);
                this.viewModel.dateTo = this.viewModel.dateFrom.clone();
                this.viewModel.patientIds = [];
                this.viewModel.billingProviderId = [];
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
                this.initDatePicker();
                UI.bindBillingProvider();
                UI.bindPatient('txtPatient', this.usermessage.selectPatient, 'btnAddPatient', 'ulListPatients');

                $('#ddlPatientOption').multiselect({
                    maxHeight: '200px',
                    buttonWidth: '220px',
                    width: '200px'
                });

                this.viewModel.fromDate = commonjs.bindDateTimePicker("txtFromDate", { format: "L" });
                this.viewModel.fromDate.date(commonjs.getFacilityCurrentDateTime(app.facilityID));

                $('#ddlFacilityFilter').multiselect({
                    maxHeight: 200,
                    buttonWidth: '300px',
                    width: '300px',
                    enableFiltering: true,
                    includeSelectAllOption: true,
                    enableCaseInsensitiveFiltering: true
                });
                this.onNumberKeyPress();
                commonjs.isMaskValidate();
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

            getBillingProvider: function (e) {
                var billing_pro = []
                var selected = $("#ddlBillingProvider option:selected");
                selected.each(function () {
                    billing_pro.push($(this).val());
                });
                this.selectedBillingProList = billing_pro;
                this.viewModel.allBillingProvider = this.selectedBillingProList && this.selectedBillingProList.length === $("#ddlBillingProvider option").length;
            },
            /**
             * Initialize date pickers for the from and to dates
             */
            initDatePicker: function () {
                this.viewModel.sDate = commonjs.bindDateTimePicker('sDate', { format: 'MM/DD/YYYY', defaultDate: moment() });
            },

            onReportViewClick: function (e) {
                this.getSelectedFacility();
                this.getBillingProvider();
                $('#minAmount').val() == "" ? $('#minAmount').val('0') : $('#minAmount').val();
                var btnClicked = e && e.target ? $(e.target) : null;
                if (btnClicked && btnClicked.prop('tagName') === 'I') {
                    btnClicked = btnClicked.parent(); // in case FA icon 'inside'' button was clicked...
                }
                var rFormat = btnClicked ? btnClicked.attr('data-rformat') : null;
                var openInNewTab = btnClicked ? btnClicked.attr('id') === 'btnViewReportNewTabPatStatement' : false;
                this.viewModel.reportFormat = rFormat;
                this.viewModel.openInNewTab = openInNewTab && rFormat === 'html';

                this.viewModel.patientIds = $('ul#ulListPatients li').map(function () {
                    return this.id;
                }).get();

                this.viewModel.patientOption = $('#ddlPatientOption').val();
                this.viewModel.billingProvider = $('#ddlBillingProvider').val();
                this.viewModel.minAmount = $('#minAmount').val() || "0";
                this.viewModel.patientLastnameFrom = $('#patientLastnameFrom').val() === '' ? 'a' : $('#patientLastnameFrom').val();
                this.viewModel.patientLastnameTo = $('#patientLastnameTo').val() === '' ? 'z' : $('#patientLastnameTo').val();

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

            getReportParams: function () {
                return urlParams = {
                    facilityIds: this.selectedFacilityList ? this.selectedFacilityList : [],
                    allFacilities: this.viewModel.allFacilities ? this.viewModel.allFacilities : '',
                    patientOption: this.viewModel.patientOption,
                    patientIds: this.viewModel.patientIds,
                    billingProviderIds: this.viewModel.billingProvider,
                    minAmount: this.viewModel.minAmount || "0",
                    payToProvider: $('#chkPayToProvider').prop('checked'),
                    sDate: this.viewModel.fromDate.date().format('YYYY-MM-DD'),
                    allBillingProvider: this.viewModel.allBillingProvider ? this.viewModel.allBillingProvider : '',
                    patientLastnameFrom: this.viewModel.patientLastnameFrom,
                    patientLastnameTo: this.viewModel.patientLastnameTo
                };
            },

            onNumberKeyPress: function () {
                var number = document.getElementById('minAmount');
                // Listen for input event on numInput.
                number.onkeydown = function (e) {
                    if (!((e.keyCode > 95 && e.keyCode < 106)
                        || (e.keyCode > 47 && e.keyCode < 58)
                        || e.keyCode == 8)) {
                        return false;
                    }
                }
            },

            onPatientOptionChange: function () {
                UI.hideShowBox('ddlPatient');
                $('#txtPatient').empty();

                if ($('#ddlPatientOption').val() !== 'R') {
                    $('#ddlPatientLastNameBox').hide();
                }
                else {
                    $('#ddlPatientLastNameBox').show();
                }
            }
        });

        return PatientStatementView;
    });
