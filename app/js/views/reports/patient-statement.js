define([
    'jquery'
    , 'underscore'
    , 'backbone'
    , 'shared/report-utils'
    , 'text!templates/reports/patient-statement.html'
    , 'text!templates/reports/patient-activity-statement.html'
],
    function ($, _, Backbone, UI, PatientStatementTemplate, PatientActivityStatementTemplate) {

        var PatientStatementView = Backbone.View.extend({
            rendered: false,
            mainTemplate: _.template(PatientStatementTemplate) || _.template(PatientActivityStatementTemplate),
            viewModel: {
                dateFormat: 'MM/DD/YYYY',
                country_alpha_3_code: 'usa',
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
                allBillingProviders: false,
                patientLastnameFrom: null,
                patientLastnameTo: null,
                mailTo: null
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
                if (!options.isPrintingOutsideReportingModule) {
                    this.showForm();
                }

                Backbone.Collection.extend({
                    model: Backbone.Model.extend({})
                });

                UI.getReportSetting(this.viewModel, 'all', 'dateFormat'); // Get date format (and current country code) based on current country code saved in sites table(this.viewModel);

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
                UI.bindBillingProvider(this.isPrintingOutsideReportingModule);
                UI.bindPatient('txtPatient', this.usermessage.selectPatient, 'btnAddPatient', 'ulListPatients');

                $('#ddlPatientOption')
                .append('<option value="All">' + commonjs.geti18NString('shared.fields.all'))
                .append('<option value="S">' + commonjs.geti18NString('shared.fields.select'))
                .append('<option value="R">' + commonjs.geti18NString('shared.fields.rangeByPatientName'));

                $('#ddlPatientOption').multiselect({
                    maxHeight: '200px',
                    buttonWidth: '220px',
                    width: '200px'
                });

                $('#ddlMailToOption')
                .append('<option value="select">' + commonjs.geti18NString('shared.buttons.select'))
                .append('<option value="patient">' + commonjs.geti18NString('shared.fields.patient'))
                .append('<option value="guarantor">' + commonjs.geti18NString('shared.fields.guarantor'))
                .append('<option value="orderingFacility">' + commonjs.geti18NString('shared.fields.orderingFacility'));

                $('#ddlMailToOption').multiselect({
                    maxHeight: '200px',
                    buttonWidth: '220px',
                    width: '200px'
                });

                this.viewModel.fromDate = commonjs.bindDateTimePicker("txtFromDate", { format: 'L' });
                this.viewModel.fromDate && this.viewModel.fromDate.date(commonjs.getFacilityCurrentDateTime(app.facilityID));

                $('#mailToOption').hide();
                $('#divPatient').hide();

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

            getSelectedFacility: function () {
                var selected = $("#ddlFacilityFilter option:selected");
                var facilities = [];
                selected.each(function () {
                    facilities.push($(this).val());
                });
                this.selectedFacilityList = facilities
                this.viewModel.allFacilities = this.selectedFacilityList && this.selectedFacilityList.length === $("#ddlFacilityFilter option").length;
            },

            onReportViewClick: function (e, patientStatementParams) {
                this.getSelectedFacility();
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
                this.viewModel.billingProvider = $('#ddlBillingProviderReport').val();
                this.viewModel.allBillingProviders = $("#ddlBillingProviderReport option:selected").length === $("#ddlBillingProviderReport option").length;
                this.viewModel.minAmount = $('#minAmount').val() || "0";
                this.viewModel.patientLastnameFrom = $('#patientLastnameFrom').val() === '' ? 'a' : $('#patientLastnameFrom').val();
                this.viewModel.patientLastnameTo = $('#patientLastnameTo').val() === '' ? 'z' : $('#patientLastnameTo').val();
                this.viewModel.mailTo = $('#ddlMailToOption').val() || null;

                if (patientStatementParams && patientStatementParams.flag === 'patientStatement') {
                    var reportName = "patient-statement";
                    var params = {
                        patientIds: patientStatementParams.patientIds,
                        claimId: patientStatementParams.claimId,
                        sDate: moment().format('YYYY-MM-DD'),
                        minAmount: 0,
                        logInClaimInquiry: patientStatementParams.logInClaimInquiry,
                        mailTo: patientStatementParams.mailTo,
                        patientOption: 'S',
                        countryCode: app.country_alpha_3_code
                    };
                    params.dateFormat = this.viewModel.dateFormat;
                    params.async = false;
                    params.save = false;
                    var options = {
                        'id': reportName,
                        'category': this.viewModel.reportCategory,
                        'format': 'pdf',
                        'params': params,
                        'openInNewTab': true,
                        'generateUrl': true
                    };
                    UI.showReport(options);
                }
                else if(this.hasValidViewModel()) {
                    var urlParams = this.getReportParams();
                    UI.generateReport(this.viewModel.reportId, this.viewModel.reportCategory, this.viewModel.reportFormat, urlParams);
                }
            },

            hasValidViewModel: function () {
                var fromDateValue = this.viewModel.fromDate.date();

                if (this.viewModel.reportId == null || this.viewModel.reportCategory == null || this.viewModel.reportFormat == null) {
                    return commonjs.showWarning('messages.status.pleaseCheckReportIdCategoryandorFormat');
                }

                if (!(this.viewModel.fromDate && fromDateValue)) {
                    return commonjs.showWarning('messages.status.pleaseSelectDate');
                }

                if (fromDateValue && !commonjs.validateFutureDate(fromDateValue)) {
                    return commonjs.showWarning('messages.status.pleaseDoNotSelectFutureDate');
                }
                return true;
            },

            getReportParams: function () {
                return {
                    dateFormat: this.viewModel.dateFormat,
                    country_alpha_3_code: this.viewModel.country_alpha_3_code,
                    facilityIds: this.selectedFacilityList ? this.selectedFacilityList : [],
                    allFacilities: this.viewModel.allFacilities ? this.viewModel.allFacilities : '',
                    patientOption: this.viewModel.patientOption,
                    patientIds: this.viewModel.patientIds,
                    minAmount: this.viewModel.minAmount || "0",
                    payToProvider: $('#chkPayToProvider').prop('checked'),
                    sDate: this.viewModel.fromDate.date().format('YYYY-MM-DD'),
                    allBillingProviders: this.viewModel.allBillingProviders,
                    billingProvider: this.viewModel.billingProvider,
                    patientLastnameFrom: this.viewModel.patientLastnameFrom,
                    patientLastnameTo: this.viewModel.patientLastnameTo,
                    logInClaimInquiry: $('#chkLogInClaimInquiry').prop('checked'),
                    countryCode: app.country_alpha_3_code,
                    mailTo:  this.viewModel.mailTo,
                    openInNewTab: this.viewModel.openInNewTab
                };
            },

            onNumberKeyPress: function () {
                var number = document.getElementById('minAmount');

                if (!number) {
                    return;
                }
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

                $('#ddlMailToOption').val('select');
                $("#ddlMailToOption").multiselect("refresh");

                if ($('#ddlPatientOption').val() === 'R') {
                    $('#ddlPatientLastNameBox').show();
                    $('#mailToOption').hide();
                    $('#divPatient').hide();
                }
                else if($('#ddlPatientOption').val() === 'S') {
                    $('#ddlPatientLastNameBox').hide();
                    $('#mailToOption').show();
                    $('#divPatient').show();
                }
                else {
                    $('#ddlPatientLastNameBox').hide();
                    $('#mailToOption').hide();
                    $('#divPatient').hide();
                }
            }
        });

        return PatientStatementView;
    });
