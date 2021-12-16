define([
    'jquery'
    , 'underscore'
    , 'backbone'
    , 'shared/report-utils'
    , 'text!templates/reports/patient-activity-statement.html'
],
    function ($, _, Backbone, UI, patientActivityStatementTemplate) {

        var patientActivityStatementView = Backbone.View.extend({
            rendered: false,
            drpStudyDt: null,
            expanded: false,
            mainTemplate: _.template(patientActivityStatementTemplate),
            viewModel: {
                dateFormat: 'MM/DD/YYYY',
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
                UI.getReportSetting(this.viewModel, 'all', 'dateFormat'); // Get date format (and current country code) based on current country code saved in sites table(this.viewModel);

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

            },

            onReportViewClick: function (e, claimInfo) {
                var btnClicked = e && e.target ? $(e.target) : null;
                this.getSelectedFacility();
                this.getBillingProvider();
                if (btnClicked && btnClicked.prop('tagName') === 'I') {
                    btnClicked = btnClicked.parent(); // in case FA icon 'inside'' button was clicked...
                }
                var rFormat = btnClicked ? btnClicked.attr('data-rformat') : null;
                var openInNewTab = btnClicked ? btnClicked.attr('id') === 'btnCIPatientInquiry' : false;
                this.viewModel.reportFormat = rFormat;
                this.viewModel.openInNewTab = openInNewTab && rFormat === 'pdf';
                this.viewModel.paymentOptions = $('#ddlPaymentOption').val();
                if (claimInfo.flag == "patientInvoice") {
                    reportName = "patient-invoice";
                    var urlParams = {
                        claimIds: claimInfo.claimID,
                        sDate: '2018-06-23'

                    }
                }
                else if (claimInfo.flag == "paymentInvoice"){
                  var reportName = "payment-invoice";
                    var urlParams = {
                        claimIds: claimInfo.claimID,
                        sDate: '2018-06-23'
                    }
                }
                else {
                    var reportName = "patient-activity-statement";
                    var urlParams = {
                        patientIID: claimInfo.patientId,
                        fromDate: claimInfo.fromDate,
                        reportBy: claimInfo.reportByFlag,
                        toDate: claimInfo.toDate,
                        billingProviderIds: claimInfo.billingProId,
                        sDate: moment().format('MM/DD/YYYY'),
                        billingComments: claimInfo.billingComments,
                        billingAddressTaxNpi: claimInfo.billingAddressTaxNpi,
                        claimId : claimInfo.claimID,
                        claimIds: claimInfo.selectedClaimIds || []
                    }
                }

                urlParams.dateFormat = this.viewModel.dateFormat;
                urlParams.async = false;
                urlParams.save = false;
                var options = {
                    'id': reportName,
                    'category': this.viewModel.reportCategory,
                    'format': 'pdf',
                    'params': urlParams,
                    'openInNewTab': true,
                    'generateUrl': true
                };

                UI.showReport(options);
                $('#divPageLoading').hide();
            },

            onReportFaxClick: function (e, claimInfo) {
                var btnClicked = e && e.target ? $(e.target) : null;
                this.getSelectedFacility();
                this.getBillingProvider();
                if (btnClicked && btnClicked.prop('tagName') === 'I') {
                       btnClicked = btnClicked.parent(); // in case FA icon 'inside'' button was clicked...
                  }
                var rFormat = btnClicked ? btnClicked.attr('data-rformat') : 'pdf';
                var openInNewTab = btnClicked ? btnClicked.attr('id') === 'btnCIPatientInquiry' : false;
                this.viewModel.reportFormat = rFormat;
                this.viewModel.openInNewTab = openInNewTab && rFormat === 'pdf';
                this.viewModel.paymentOptions = $('#ddlPaymentOption').val();
                if (claimInfo.flag == "patientInvoice") {
                        reportName = "patient-invoice";
                        var urlParams = {
                                claimIds: claimInfo.claimID,
                                sDate: '2018-06-23',
                                openInNewTab: this.viewModel.openInNewTab

                        }
                    }
                else if (claimInfo.flag == "paymentInvoice"){
                        var reportName = "payment-invoice";
                        var urlParams = {
                                claimIds: claimInfo.claimID,
                                sDate: '2018-06-23',
                                openInNewTab: this.viewModel.openInNewTab
                        }
                    }
                else {
                        var reportName = "patient-activity-statement";
                        var urlParams = {
                                patientIID: claimInfo.patientId,
                                fromDate: claimInfo.fromDate,
                                reportBy: claimInfo.reportByFlag,
                                toDate: claimInfo.toDate,
                                billingProviderIds: claimInfo.billingProId,
                                sDate: moment().format('MM/DD/YYYY'),
                                billingComments: claimInfo.billingComments,
                                claimIds: claimInfo.selectedClaimIds || [],
                                openInNewTab: this.viewModel.openInNewTab
                        }
                    }
                $('#divPageLoading').hide();

                return UI.generateReportUrl(reportName, this.viewModel.reportCategory, rFormat, urlParams);
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
            }
        });

        return patientActivityStatementView;
    });
