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
                reportFormat: null
            },

            events: {
                'change #ddlOption': 'onOptionChange',
                'click #btnViewReport': 'onReportViewClick',
                'click #btnViewReportNewTab': 'onReportViewClick',
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
                this.$el.html(this.mainTemplate(this.viewModel));

                this.initDatePicker();
                UI.bindBillingProvider();
                UI.bindPatient('txtPatient',this.usermessage.selectPatient,'btnAddPatient','ulListPatients');

                $('#ddlOption').multiselect({
                    maxHeight: '200px',
                    buttonWidth: '220px',
                    width: '200px'
                });
            },

            /**
             * Initialize date pickers for the from and to dates
             */
            initDatePicker: function () {
                this.viewModel.sDate = commonjs.bindDateTimePicker('sDate', { format: 'MM/DD/YYYY', defaultDate: moment() });
            },

            onReportViewClick: function (e) {
                var btnClicked = e && e.target ? $(e.target) : null;
                if (btnClicked && btnClicked.prop('tagName') === 'I') {
                    btnClicked = btnClicked.parent(); // in case FA icon 'inside'' button was clicked...
                }
                var rFormat = btnClicked ? btnClicked.attr('data-rformat') : null;
                var openInNewTab = btnClicked ? btnClicked.attr('id') === 'btnViewReportNewTab' : false;
                this.viewModel.reportFormat = rFormat;
                this.viewModel.openInNewTab = openInNewTab && rFormat === 'html';

                this.viewModel.patientIds = $('ul#ulListPatients li').map(function () {
                    return this.id;
                }).get();

                this.viewModel.patientOption = $('#ddlOption').val();
                this.viewModel.billingProvider = $('#ddlBillingProvider').val();
                this.viewModel.minAmount = $('#minAmount').val();

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
                if ($('#txtDateRangeFrom').val() == "" ) {
                    alert('Please select date range!')
                    commonjs.showWarning('Please select date range!');
                    return false;
                }
                
                if (isNaN(this.viewModel.minAmount) || this.viewModel.minAmount === '') {
                     commonjs.showWarning('Please enter minimum amount!');
                    return false;
                }
                if (this.viewModel.minAmount < 0) {
                     commonjs.showWarning('Please enter minimum amount greater than or equal to 0!');
                    return false;
                }
                return true;
            },

            getReportParams: function () {
                return urlParams = {
                    patientOption: this.viewModel.patientOption,
                    patientIds: this.viewModel.patientIds,
                    billingProviderIds: this.viewModel.billingProvider,
                    minAmount: this.viewModel.minAmount,
                    sDate: moment($('#txtDateRangeFrom').val()).format('L'),
                    payToProvider: $('#chkPayToProvider').prop('checked')
                };
            },

            onOptionChange: function () {
                if ($('#ddlOption').val() !== 'S')
                    $("#ddlOptionBox").hide();
                else $("#ddlOptionBox").show();
            }

        });

        return PatientStatementView;
    });
