define([
    'jquery'
    , 'underscore'
    , 'backbone'
    , 'shared/report-utils'
    , 'text!templates/reports/patient-activity-statement.html'
],
    function ($, _, Backbone, UI, billingPaymentsPDFTemplate) {

        var billingPaymentsPDFView = Backbone.View.extend({
            rendered: false,
            drpStudyDt: null,
            expanded: false,
            mainTemplate: _.template(billingPaymentsPDFTemplate),
            viewModel: {
                facilities: null,
                dateFrom: null,
                dateTo: null,
                allFacilities: false,
                facilityIds: null,
                openInNewTab: false,
                reportId: null,
                reportCategory: null,
                reportTitle: null,
                reportFormat: null,
                paymentOptions: null,
                billingProvider: null,
                allBillingProvider: false,
                allUsers: false,
                userIds: null,
                userNames: null
            },
            selectedBillingProList: [],
            selectedFacilityList: [],
            defaultyFacilityId: null,


            initialize: function (options) {
                this.showForm();
                this.$el.html(this.mainTemplate(this.viewModel));
                UI.initializeReportingViewModel(options, this.viewModel);

                this.viewModel.dateFrom = commonjs.getFacilityCurrentDateTime(1);
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

            },

            onReportViewClick: function (e, reportArgs) {
                var btnClicked = e && e.target ? $(e.target) : null;
                var reportArgsFlag = null
                this.getSelectedFacility();
                this.getBillingProvider();
                if (btnClicked && btnClicked.prop('tagName') === 'I') {
                    btnClicked = btnClicked.parent(); // in case FA icon 'inside'' button was clicked...
                }
                var rFormat = btnClicked ? btnClicked.attr('data-rformat') : null;
                var openInNewTab = btnClicked ? btnClicked.attr('id') === 'btnGeneratePDF' : false;
                this.viewModel.reportFormat = rFormat;
                this.viewModel.openInNewTab = openInNewTab && rFormat === 'pdf';
                this.viewModel.paymentOptions = $('#ddlPaymentOption').val();
                var urlParams = {
                    pamentIds: reportArgs.payment_id,
                    paymentStatus: reportArgs.paymentStatus || " " ,
                    filterFlag: "paymentsExportPDFFlag"                  
                }
                if (reportArgs.flag == 'paymentPDF') {
                    reportArgsFlag = 'payment-print-pdf';

                }
                else if (reportArgs.flag == 'payment-print-pdf') {
                    reportArgsFlag = 'payment-receipt-pdf';
                }
                else {
                    reportArgsFlag = 'payments-pdf';
                }
                UI.showReport(reportArgsFlag, this.viewModel.reportCategory, 'pdf', urlParams, true);
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
                var usersArray = [], userNameArray = [];
                $('#ulListUsers li a').each(function () {
                    usersArray.push(~~$(this).attr('data-id'));
                    userNameArray.push($(this).closest('li').find('span').text());
                });
                return urlParams = {
                    'companyId': 1,
                    'facilityIds': ['1'],
                    'allFacilities': true,
                    'fromDate': '05/12/2017',
                    'toDate': '05/30/2018',
                    'billingProvider': ['3']

                };
            }
        });

        return billingPaymentsPDFView;
    });
