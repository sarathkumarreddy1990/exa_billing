define([
    'jquery'
    , 'underscore'
    , 'backbone'
    , 'shared/report-utils'
    , 'text!templates/reports/procedure-analysis-by-insurance.html'
],
function ($, _, Backbone, UI, MainTemplate) {

    var procedureAnalysisbyInsuranceView = Backbone.View.extend({
        rendered: false,
        drpStudyDt: null,
        expanded: false,
        mainTemplate: _.template(MainTemplate),
        viewModel: {
            dateFormat: 'MM/DD/YYYY',
            i18nColumnHeaderCpt: 'cptCode',
            country_alpha_3_code: 'usa',
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
            allBillingProvider: false,
            cptCodeList: null,
            insuranceOption: null,
            referringDocList: null,
            allRefProList: false,
            refProviderGroupList : null,
            payerTypeList: null
        },
        selectedBillingProList: [],
        selectedFacilityList: [],
        defaultyFacilityId: null,
        events: {
            //'change #ddlFacility': 'onFacilityChange',
            'change #ddlFacilities': 'onFacilitiesChange',
            'change #chkAllFacilities': 'onAllFacilitiesChange',
            'click #btnViewReport': "onReportViewClick",
            'click #btnViewReportNewTabProAnaByIns': "onReportViewClick",
            'click #btnPdfReport': "onReportViewClick",
            'click #btnExcelReport': "onReportViewClick",
            'click #btnCsvReport': "onReportViewClick",
            'click #btnXmlReport': "onReportViewClick",
            'click #showCheckboxes': 'onShowCheckboxes',

            "click #chkAllFacility": "selectAllFacility",
            "click #chkAllBillingProvider": "selectAllBillingProviders",
            "click .chkSelectFacility": "chkSelectFacility",
            "change .billingProviderchkBx": "chkBillingProvider",
            "click #ddlCPTCodeBinding": "onCPTCodeBinding",
            "click #ddlInsuranceBinding": "onInsuranceBinding",
            "click #ddlReferringPhysicianOption": "onReferringDoctorBinding",
            "click #ddlRefProviderGroupOption": "onReferringProviderGroupBinding",
            "click #ddlPayerTypeOption": "onPayerTypeBinding",
            "change #ddlProcedureBySelectBoxes": "onChangeProcedureBy"
        },

        usermessage: {
            selectInsurance: "Search Insurance",
            selectStudyCPT: "Search CPT"
        },

        initialize: function (options) {
            var modelCollection = Backbone.Collection.extend({
                model: Backbone.Model.extend({})
            });

            UI.getReportSetting(this.viewModel, 'all', 'dateFormat');// Get date format (and current country code) based on current country code saved in sites table
            UI.getReportSetting(this.viewModel, 'claim-transaction', 'i18nColumnHeaderCpt');// Get cpt i18n header based on country code

            // initialize view model and set any defaults that are not constants
            UI.initializeReportingViewModel(options, this.viewModel);
            this.viewModel.facilities = new modelCollection(commonjs.getCurrentUsersFacilitiesFromAppSettings());
            this.viewModel.dateFrom = moment().startOf('month').add(-1, 'month');    // start of the last month
            this.viewModel.dateTo = this.viewModel.dateFrom.clone().endOf('month');  // end of the last month
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
            $('#ddlProcedureBySelectBoxes').multiselect({
                maxHeight: 200,
                buttonWidth: 200,
                width: 200
            });
            UI.bindBillingProvider();
            UI.bindReferringPhysicianGroupAutoComplete();
            UI.bindReferringProviderAutoComplete('txtReferringPhysician', 'btnAddReferringPhysician', 'ulListReferringPhysicians');
            UI.bindInsuranceAutocomplete('txtInsuranceName', 'btnAddInsurance', 'ulListInsurance');
            UI.bindCPTCodeInformations('txtCPTCode', 'btnCPTCode', 'ulListCPTCodeDetails');
            UI.bindInsuranceProviderAutocomplete('txtInsuranceProviderName', 'btnAddInsuranceProvider', 'ulListInsuranceProvider')

            var cptLabel = this.viewModel.i18nColumnHeaderCpt;
            var allOption = this.viewModel.i18nColumnHeaderCpt + 'All';

            $("#cptLabel").attr("i18n", cptLabel);
            $("#allOption").attr("i18n", allOption);
            commonjs.updateCulture(app.currentCulture, commonjs.beautifyMe());
        },

        bindDateRangePicker: function () {
            var self = this;
            var drpEl = $('#txtDateRange');
            var drpOptions = {autoUpdateInput: true, locale: {format: this.viewModel.dateFormat }};
            this.drpStudyDt = commonjs.bindDateRangePicker(drpEl, drpOptions, 'past', function (start, end, format) {
                console.info('DRP: ', format, start, end);
                self.viewModel.dateFrom = start;
                self.viewModel.dateTo = end;
            });
            drpEl.on('cancel.daterangepicker', function (ev, drp) {
                self.viewModel.dateFrom = null;
                self.viewModel.dateTo = null;
            });
            commonjs.isMaskValidate();
        },

        onFacilitiesChange: function (e) {
            this.viewModel.facilityIds = $(e.target) && $(e.target).val() ? $(e.target).val() : null; // array
            this.viewModel.allFacilities = this.viewModel.facilityIds && this.viewModel.facilityIds.length === this.viewModel.facilities.length;
            $('#chkAllFacilities').prop('checked', this.viewModel.allFacilities);
            var selCount = this.viewModel.facilityIds ? this.viewModel.facilityIds.length : 0;
            $('#selFacilitiesCount').html(' (' + selCount + ')');
        },

        onAllFacilitiesChange: function (e) {
            if ($(e.target) && $(e.target).prop('checked')) {
                $('#ddlFacilities option').attr('selected', 'selected').parent().change(); // triggers onFacilityChange() for parent
                this.viewModel.allFacilities = true;
            } else {
                $('#ddlFacilities option:selected').removeAttr('selected');
                this.viewModel.allFacilities = false;
                this.selectDefaultFacility();
            }
        },

        onReportViewClick: function (e) {
            var btnClicked = e && e.target ? $(e.target) : null;
            this.getSelectedFacility();
            this.getBillingProvider();
            if (btnClicked && btnClicked.prop('tagName') === 'I') {
                btnClicked = btnClicked.parent(); // in case FA icon 'inside'' button was clicked...
            }
            var rFormat = btnClicked ? btnClicked.attr('data-rformat') : null;
            var openInNewTab = btnClicked ? btnClicked.attr('id') === 'btnViewReportNewTabProAnaByIns' : false;
            this.viewModel.reportFormat = rFormat;
            this.viewModel.openInNewTab = openInNewTab && rFormat === 'html';

            // CPT Code Mapping
            this.viewModel.cptCodeList = $('ul#ulListCPTCodeDetails li').map(function () {
                return this.id;
            }).get();

            //Insurance Mapping
            this.viewModel.insuranceOption = $('ul#ulListInsurance li').map(function () {
                return this.id;
            }).get();

            // Referring Doctor Mapping
            this.viewModel.referringDocList = $('ul#ulListReferringPhysicians li').map(function () {
                return this.id;
            }).get();

            // Referring Provider Group Mapping
            this.viewModel.refProviderGroupList = $('ul#ulListProviderGroup li').map(function () {
                return this.id;
            }).get();

            // Payer Type Mapping
            this.viewModel.payerTypeList = $('ul#ulListInsuranceProvider li').map(function () {
                return this.id;
            }).get();

            this.viewModel.reportFormat = rFormat;
            this.viewModel.openInNewTab = !!((openInNewTab && rFormat === 'html'));
            if (this.hasValidViewModel()) {
                var urlParams = this.getReportParams();
                UI.generateReport(this.viewModel.reportId, this.viewModel.reportCategory, this.viewModel.reportFormat, urlParams);
            }
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
        selectDefaultFacility: function () {
            // if there is only 1 facility select it, otherwise use default facility id
            var defFacId = this.viewModel.facilities.length === 1 ? this.viewModel.facilities.at(0).get('id') : app.default_facility_id;
            // works only if list exists by setting its value to array of selections
            // fires a change event
            $('#ddlFacilities').val([defFacId]).change();
            this.defaultyFacilityId = defFacId;
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
        onShowCheckboxes: function (e) {
            var checkboxes = document.getElementById("facilityCheckbox");
            if (!this.expanded) {
                checkboxes.style.display = "block";
                document.getElementById("billingCheckboxes").style.display = "none";
                this.expanded = true;
            } else {
                checkboxes.style.display = "none";
                this.expanded = false;
            }
        },
        // Select all facility changes
        selectAllFacility: function (e) {
            if ($('#chkAllFacility').attr('checked')) {
                $('input[name=allInusranceFacilities]').prop('checked', true);
                this.viewModel.allFacilities = true;
                document.getElementById("facilityCheckbox").style.display = "block";
            }
            else {
                $('input[name=allInusranceFacilities]').prop('checked', false);
                this.viewModel.allFacilities = false;
                this.selectedFacilityList = [];
            }
            $('#selFacilitiesCount').html('');
        },
        selectAllBillingProviders: function (e) {
            if ($('#chkAllBillingProvider').attr('checked')) {
                $('input[name=allBillingProviders]').prop('checked', true);
                var billing_pro = []
                $('#billingCheckboxes input[type="checkbox"]').each(function () {
                    if ($(this).prop('checked')) {
                        billing_pro.push($(this).val());
                    }
                });
                this.viewModel.allBillingProvider = true;
                this.selectedBillingProList = billing_pro;
                document.getElementById("billingCheckboxes").style.display = "block";
            }
            else {
                $('input[name=allBillingProviders]').prop('checked', false);
                this.viewModel.allBillingProvider = false;
                this.selectedBillingProList = []
            }
            $('#selBillingProviderCount').html('');
        },
        chkSelectFacility: function (e) {
            var facilities = []
            $('#facilityCheckbox input[type="checkbox"]').each(function () {
                if ($(this).prop('checked')) {
                    facilities.push($(this).val());
                }
            });
            this.selectedFacilityList = facilities
            this.viewModel.allFacilities = this.selectedFacilityList && this.selectedFacilityList.length === this.viewModel.facilities.length;
            $('#chkAllFacility').prop('checked', this.viewModel.allFacilities);
            var selCount = this.selectedFacilityList ? this.selectedFacilityList.length : 0;
            $('#selFacilitiesCount').html(' (' + selCount + ')');
        },
        chkBillingProvider: function (e) {
            var billing_pro = []
            $('#billingCheckboxes input[type="checkbox"]').each(function () {
                if ($(this).prop('checked')) {
                    billing_pro.push($(this).val());
                }
            });
            this.selectedBillingProList = billing_pro;

            this.viewModel.allBillingProvider = this.selectedBillingProList && this.selectedBillingProList.length === $('#billingCheckboxes').children().length;
            $('#chkAllBillingProvider').prop('checked', this.viewModel.allBillingProvider);
            var selCountBillingProvider = this.selectedBillingProList ? this.selectedBillingProList.length : 0;
            $('#selBillingProviderCount').html(' (' + selCountBillingProvider + ')');
        },
        onCPTCodeBinding: function () {
            $('#txtCPTCode').empty();
            if ($('#ddlCPTCodeBinding').val() == 'S'){
                $("#ddlCPTCodeBoxDetails").show();
                $("#divCPTCodes").show();
            }
            else {
                $("#ddlCPTCodeBoxDetails").hide();
                $("#divCPTCodes").hide();
                $('#ulListCPTCodeDetails').empty();
                this.viewModel.cptCodeList = [];
                $('#ulListCPTCodeDetails').data('cptIds', []);
            }
        },
        // Binding Insurance information
        onInsuranceBinding: function () {
            $('#txtInsuranceName').empty();
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
        // Binding Referring doctor Auto Completed
        onReferringDoctorBinding: function () {
            $('#txtReferringPhysician').empty();
            if ($('#ddlReferringPhysicianOption').val() == 'S'){
                $('#ddlReferringPhysician').show();
                $('#divReferringPhysician').show();
            }
            else {
                $('#ddlReferringPhysician').hide();
                $('#divReferringPhysician').hide();
                $('#ulListReferringPhysicians').empty();
                this.viewModel.referringDocList = [];
                $('#ulListReferringPhysicians').data('referringPhysicianIds', []);
            }
        },
        // Binding Referring Provider Group Auto Complete
        onReferringProviderGroupBinding: function () {
            $('#txtProviderGroupName').empty();
            if ($('#ddlRefProviderGroupOption').val() == 'S'){
                $('#ddlProviderGroupBox').show();
                $('#divListProviderGroup').show();
            }
            else {
                $('#ddlProviderGroupBox').hide();
                $('#divListProviderGroup').hide();
                $('#ulListProviderGroup').empty();
                this.viewModel.refProviderGroupList = [];
                $('#ulListProviderGroup').data('ids', []);
            }
        },

        // Binding Payer Type Auto Complete
        onPayerTypeBinding: function () {
            $('#txtInsuranceProviderName').empty();
            if ($('#ddlPayerTypeOption').val() == 'S'){
                $('#ddlPayerTypeBox').show();
                $('#divListPayerType').show();
                $('#ulListInsuranceProvider').show();
            }
            else {
                $('#ddlPayerTypeBox').hide();
                $('#divListPayerType').hide();
                $('#ulListInsuranceProvider').hide();
                $('#ulListInsuranceProvider').empty();
                this.viewModel.payerTypeList = [];
                $('#ulListInsuranceProvider').data('ids', []);
            }
        },

        // Procedure By Dropdown Change
        onChangeProcedureBy: function () {
            if ($('#ddlProcedureBySelectBoxes').val() == 'refPro') {
                this.viewModel.allRefProList = true;
                $('#procedureByRefPro').show();
                // Payer Type clear
                $('#payerType').hide();
                $('#ulListInsuranceProvider').empty();
                this.viewModel.payerTypeList = [];
                $('#ulListInsuranceProvider').data('ids', []);
                $('#refProviderGroup').show();
                // Insurance Div Hide
                $('#procedureByInsurance').hide();
                $('#ddlInsuranceOptionBox').hide();
                $('#divListInsurance').hide();
                $('#ddlPayerTypeBox').hide();
                $('#ulListInsurance').empty();
                this.viewModel.insuranceOption = [];
                $('#ulListInsurance').data('insuranceIds', []);
                $('#divListPayerType').show();

                // CPT Code div Hide
                $('#procedureByCPTCodes').hide();
                $("#ddlCPTCodeBoxDetails").hide();
                $("#divCPTCodes").hide();
                $('#ulListCPTCodeDetails').empty();
                this.viewModel.cptCodeList = [];
                $('#ulListCPTCodeDetails').data('cptIds', []);
            }
            else {
                // Referring Provider then hide div
                this.viewModel.allRefProList = false;
                $('#procedureByRefPro').hide();
                $('#ulListProviderGroup').empty();
                this.viewModel.refProviderGroupList= [];
                $('#ulListProviderGroup').data('ids', []);
                $('#payerType').show();
                $('#refProviderGroup').hide();
                $('#ddlReferringPhysician').hide();
                $('#divReferringPhysician').hide();
                $('#ulListReferringPhysicians').empty();
                this.viewModel.referringDocList = [];
                this.viewModel.refProviderGroupList = [];
                this.viewModel.payerTypeList = [];
                $('#ulListReferringPhysicians').data('referringPhysicianIds', []);
                $('#ulListInsuranceProvider').data('ids', []);
                $('#ulListInsuranceProvider').hide();
                $('#ddlProviderGroupBox').hide();
                $('#divListProviderGroup').hide();
                // Insurance Div Show
                $('#procedureByInsurance').show();
                // CPT Div Show
                $('#procedureByCPTCodes').show();

            }
        },

        getReportParams: function () {
            var urlParams = {
                'dateFormat': this.viewModel.dateFormat,
                'country_alpha_3_code': this.viewModel.country_alpha_3_code,
                'allFacilities': this.viewModel.allFacilities ? this.viewModel.allFacilities : 'false',
                'facilityIds': this.selectedFacilityList ? this.selectedFacilityList : [],
                'fromDate': this.viewModel.dateFrom.format('YYYY-MM-DD'),
                'toDate': this.viewModel.dateTo.format('YYYY-MM-DD'),
                'insuranceProviderIds': this.viewModel.insuranceOption ? this.viewModel.insuranceOption : '',
                'cptIds': this.viewModel.cptCodeList ? this.viewModel.cptCodeList : '',
                'billingProvider': this.selectedBillingProList ? this.selectedBillingProList : [],
                'allBillingProvider': this.viewModel.allBillingProvider ? this.viewModel.allBillingProvider : 'false',
                'referringDocList': this.viewModel.referringDocList ? this.viewModel.referringDocList : [],
                'refProviderGroupList': this.viewModel.refProviderGroupList ? this.viewModel.refProviderGroupList : [],
                'payerTypeList': this.viewModel.payerTypeList || [],
                'allRefProList': !!this.viewModel.allRefProList,
                'refProviderFlag': $('#ddlProcedureBySelectBoxes').val() == 'refPro',
                'openInNewTab': this.viewModel.openInNewTab
            }
            return urlParams;
        }
    });

    return procedureAnalysisbyInsuranceView;
});
