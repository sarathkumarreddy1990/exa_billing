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
                userNames: null,
                countryCode: null
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

            onReportViewClick: function (e, reportArgs) {
                var btnClicked = e && e.target ? $(e.target) : null;
                var reportArgsFlag = null;
                var countryFlag = app.country_alpha_3_code;
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
                if (reportArgs && reportArgs.flag == 'RISPrintReceipt') {
                    var urlParams = {
                        studyIds: reportArgs.studyIds,
                        studyCptIds: reportArgs.studyCptIds,
                        patient_id: reportArgs.patient_id,
                        payment_id: reportArgs.payment_id,
                        countryCode: countryFlag
                    }
                }
                else {
                    if (reportArgs && reportArgs.filterFlag == true) {
                        var defaultDateRange = moment().subtract(29, 'days').format('YYYY-MM-DD') + ' - ' + moment().format('YYYY-MM-DD'),
                            reportArgsFilterData = JSON.parse(reportArgs.filterData),
                            reportArgsFilterColumn = JSON.parse(reportArgs.filterColumn);
                            if (reportArgsFilterData["length"] == 1 && reportArgs.from == "ris") {
                                reportArgsFilterData.push(defaultDateRange);
                                reportArgsFilterColumn.push("accounting_date");
                              }

                            if (!reportArgsFilterData["length"]) {
                                reportArgsFilterData.push(defaultDateRange);
                                reportArgsFilterColumn = ["accounting_date"];
                              }

                        var urlParams = {
                            pamentIds: reportArgs.payment_id,
                            paymentStatus: reportArgs.paymentStatus || " ",
                            filterFlag: "paymentsExportPDFFlag",
                            filterData: reportArgsFilterData,
                            filterColumn: reportArgsFilterColumn,
                            from: reportArgs.from || '',
                            countryCode: countryFlag
                        }
                    }
                    else {
                        var urlParams = {
                            pamentIds: reportArgs.payment_id,
                            paymentStatus: reportArgs.paymentStatus || " ",
                            filterFlag: "paymentsExportPDFFlag",
                            patient_id: reportArgs.patient_id,
                            countryCode: countryFlag
                        }
                    }
                }

                if (reportArgs.flag == 'paymentPDF') {
                    reportArgsFlag = 'payment-print-pdf';

                }
                else if (reportArgs.flag == 'RISPrintReceipt') {
                    reportArgsFlag = 'print-receipt';
                }
                else if (reportArgs.flag == 'payment-print-pdf') {
                     if(reportArgs.patient_id  == null)
                     {
                        commonjs.showWarning('messages.status.patientNotAvailable');
                        return;
                     }
                    reportArgsFlag = 'payment-receipt-pdf';
                }
                else {
                    reportArgsFlag = 'payments-pdf';
                }

                urlParams.dateFormat = this.viewModel.dateFormat;
                urlParams.async = false;
                urlParams.save = false;
                var options = {
                    'id': reportArgsFlag,
                    'category': this.viewModel.reportCategory,
                    'format': 'pdf',
                    'params': urlParams,
                    'openInNewTab': true,
                    'generateUrl': true
                };

                UI.showReport(options);
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
                var usersArray = [];
                var userNameArray = [];
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
