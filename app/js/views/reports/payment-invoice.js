define([
    'jquery'
    , 'underscore'
    , 'backbone'
    , 'shared/report-utils'
    , 'text!templates/reports/patient-activity-statement.html'
],
    function ($, _, Backbone, UI, paymentInvoiceTemplate) {

        var paymentInvoiceView = Backbone.View.extend({
            rendered: false,
            drpStudyDt: null,
            expanded: false,
            mainTemplate: _.template(paymentInvoiceTemplate),
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
           
            onReportViewClick: function (e) {
                var btnClicked = e && e.target ? $(e.target) : null;
                this.getSelectedFacility();
                this.getBillingProvider();
                if (btnClicked && btnClicked.prop('tagName') === 'I') {
                    btnClicked = btnClicked.parent(); // in case FA icon 'inside'' button was clicked...
                }
                var rFormat = btnClicked ? btnClicked.attr('data-rformat') : null;
                var openInNewTab = btnClicked ? btnClicked.attr('id') === 'btnCIPrintInvoice' : false;
                this.viewModel.reportFormat = rFormat;
                this.viewModel.openInNewTab = openInNewTab && rFormat === 'pdf';
                this.viewModel.paymentOptions = $('#ddlPaymentOption').val();
                    var urlParams = this.getReportParams();
                    UI.showReport('payment-invoice', this.viewModel.reportCategory, this.viewModel.reportFormat, urlParams, this.viewModel.openInNewTab);
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
                    // 'facilityIds': this.selectedFacilityList ? this.selectedFacilityList : [],
                    // 'allFacilities': this.viewModel.allFacilities ? this.viewModel.allFacilities : '',
                    // 'fromDate': this.viewModel.dateFrom.format('YYYY-MM-DD'),
                    // 'toDate': this.viewModel.dateTo.format('YYYY-MM-DD'),
                    // 'summaryFlag': $('#chkSummary').prop('checked'),
                    // 'detailsFlag': $('#chkDetails').prop('checked'),
                    // 'paymentOption': this.viewModel.paymentOptions ? this.viewModel.paymentOptions : '',
                    // 'billingProvider': this.selectedBillingProList ? this.selectedBillingProList : [],
                    // 'allBillingProvider': this.viewModel.allBillingProvider ? this.viewModel.allBillingProvider : '',
                    // 'billingProFlag': this.viewModel.allBillingProvider == 'true' ? true : false,
                    // 'userIds': $('#ddlUsersOption').val() == 'S' ? usersArray : '',
                    // 'userName': $('#ddlUsersOption').val() == 'S' ? userNameArray : ''
                    
                    'facilityIds': this.selectedFacilityList ? this.selectedFacilityList : [],
                    'allFacilities': this.viewModel.allFacilities ? this.viewModel.allFacilities : '',
                    'sDate': '2018-06-23'
                   
                };
            }
        });

        return paymentInvoiceView;
    });
