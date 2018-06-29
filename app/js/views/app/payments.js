define(['jquery',
    'immutable',
    'underscore',
    'backbone',
    'jqgrid',
    'jqgridlocale',
    'text!templates/app/payments.html',
    'collections/app/payments',
    'models/pager',
    'views/reports/payments-pdf'],

    function (jQuery,
        Immutable,
        _,
        Backbone,
        JGrid,
        JGridLocale,
        paymentsGrid,
        paymentsLists,
        ModelPaymentsPager,
        paymentPDF)
    {
        var paymentsView = Backbone.View.extend({
            el: null,
            pager: null,
            model: null,
            pendPager: null,
            pendPaymtPager: null,
            appliedPager: null,
            paymentTable: null,
            rendered: false,
            gridLoaded: false,
            formLoaded: false,
            pendPaymentTable: null,
            pendPaymentTable1: null,
            appliedPaymentTable: null,
            paymentsGridTemplate: _.template(paymentsGrid),

            events: {
                'click #btnPaymentAdd': 'addNewPayemnt',
                'click #btnStatusSearch': 'searchPayments',
                'click #btnPaymentRefresh': 'refreshPayments',
                "click #btnGenerateExcel": "exportExcel",
                "click #btnGeneratePDF": "generatePDF",
                "change #ulPaymentStatus": 'searchPayments'
            },

            initialize: function (options) {

                this.options = options;
                var paymentStatus = [
                    { 'value': 'fully_applied', 'text': 'Applied' },
                    { 'value': 'unapplied', 'text': 'Unapplied' },
                    { 'value': 'partially_applied', 'text': 'Partial Applied' },
                    { 'value': 'over_applied', 'text': 'Over Applied' }
                ];
                this.payer_type = [
                    { 'value': "patient", 'text': "Patient" },
                    { 'value': "ordering_facility", 'text': "Ordering Facility" },
                    { 'value': "insurance", 'text': "Insurance" },
                    { 'value': "ordering_provider", 'text': "Provider" }
                ];
                this.billing_method = [
                    { 'value': "DB", 'text': "Direct Billing(Invoice)" },
                    { 'value': "EB", 'text': "Electronic" },
                    { 'value': "PP", 'text': "Patient Payment" }
                ];

                var modelCollection = Backbone.Collection.extend({
                    model: Backbone.Model.extend({})
                });

                this.paymentStatusList = new modelCollection(paymentStatus);
                var facilities = (app.userInfo.user_type == "SU") ? app.facilities : app.userfacilities;
                var adjustment_codes = jQuery.grep([], function (obj, i) {
                    return (obj.type == "ADJCDE" || obj.type == "REFADJ");
                });
                var claim_status = jQuery.grep([], function (obj, i) {
                    return (obj.type == "CLMSTS");
                });
                this.facilityList = new modelCollection(commonjs.bindArray(facilities, false, true, true));
                this.facilityAdd = new modelCollection(commonjs.bindArray(facilities, true, true, false));
                this.paidlocation = new modelCollection(commonjs.bindArray(facilities, false, true, false));
                this.paymentReasons = new modelCollection([]);
                this.pager = new ModelPaymentsPager();
                this.pendPager = new ModelPaymentsPager();
                this.pendPaymtPager = new ModelPaymentsPager();
                this.appliedPager = new ModelPaymentsPager();
                this.patientPager = new ModelPaymentsPager();
                this.paymentsList = new paymentsLists();
                this.adjustmentCodeList = new modelCollection(adjustment_codes);
                this.claimStatusList = new modelCollection(claim_status);
            },

            initializeDateTimePickers: function () {
                var self = this;
                var companyCurrentDateTime = commonjs.getCompanyCurrentDateTime();
                var startFrom = moment(companyCurrentDateTime).subtract(2, 'months');
                var endTo = companyCurrentDateTime;
                self.dtpPayFrom = commonjs.bindDateTimePicker("divPaymentFromDate", { format: 'L', useCurrent: false });
                self.dtpPayTo = commonjs.bindDateTimePicker("divPaymentToDate", { format: 'L', useCurrent: false });
                self.dtpPayFrom.date(startFrom);
                self.dtpPayTo.date(endTo);
            },

            render: function (opener) {
                var self = this;
                self.defalutCASArray = [0, 1, 2, 3, 4, 5, 6];
                $(this.el).html(this.paymentsGridTemplate({ paymentStatus: this.paymentStatusList.toJSON(), facilityList: this.facilityList.toJSON(), 'casArray': self.defalutCASArray, adjustmentCodes: self.adjustmentCodeList.toJSON(), 'claimStatusList': this.claimStatusList.toJSON() }));
                this.rendered = true;
                $('#select2-drop').css('z-index', '10000');
                $('#billingDropdown').find('li.active').removeClass('active');
                $('#liPayments').addClass('active');
                $('#btnTabNavPayLeft').click(function () {
                    $('#divPaymentTabsContainer').scrollTo({ top: '0px', left: '-=70' }, 300);
                });
                $('#btnTabNavPayRight').click(function () {
                    $('#divPaymentTabsContainer').scrollTo({ top: '0px', left: '+=70' }, 300);
                });
                $('#ulPaymentStatus').multiselect({
                    maxHeight: 300,
                    selectAllText: true,
                    numberDisplayed: 2,
                    selectAllValue: 'multiselect-all'
                });                
            },

            refreshPayments: function () {
                var self = this;
                self.pager.set({ "PageNo": 1 });
                self.paymentTable.refreshAll();
            },

            searchPayments: function () {
                var self = this;
                self.paymentTable.options.customargs = {
                    paymentStatus: $("#ulPaymentStatus").val()
                };
                self.pager.set({ "PageNo": 1 });
                self.paymentTable.refresh();
            },

            showGrid: function (opener) {
                if (!this.rendered)
                    this.render(opener);

                var self = this;

                // Grid Filter Dropdowns
                var payerTypeValue = commonjs.buildGridSelectFilter({
                    arrayOfObjects: this.payer_type,
                    searchKey: "value",
                    textDescription: "text",
                    sort: true
                });

                var billingMethodValue = commonjs.buildGridSelectFilter({
                    arrayOfObjects: this.billing_method,
                    searchKey: "value",
                    textDescription: "text",
                    sort: true
                });

                $('#liPendingPayments').removeClass('active');
                $('#divPayments,#ulPaymentTab #liPayments').addClass('active');
                $('#ulPaymentTab #liPendingPayments').hide();
                $('#divtabPendingPayments').hide();
                $('#ulPaymentTab #liPayments, #payementsFilter').show();
                $('#divtabPayments').show();
                if (!this.gridLoaded) {
                    this.paymentTable = new customGrid();
                    this.paymentTable.render({
                        gridelementid: '#tblpaymentsGrid',
                        custompager: this.pager,
                        emptyMessage: 'No Record found',
                        colNames: ['<span  id="spnStatus" class="icon-ic-worklist" onclick="commonjs.popOverActions(event)" ></span>','', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
                        i18nNames: ['','', '', 'billing.payments.paymentID', '', 'billing.payments.referencePaymentID', 'billing.payments.paymentDate', 'billing.payments.accountingDate', 'billing.payments.payertype', 'billing.payments.payerName', 'billing.payments.paymentAmount', 'billing.payments.paymentApplied', 'billing.payments.balance', 'billing.payments.adjustment', 'billing.payments.postedBy', 'billing.payments.paymentmode', 'billing.payments.facility_name', '', '', ''],
                        colModel: [
                            {
                                name: 'edit', width: 50, sortable: false, search: false,
                                className: 'icon-ic-edit',
                                formatter: function (a, b, c) {
                                    return "<span class='icon-ic-edit' title='click Here to Edit'></span>";
                                },
                                customAction: function (rowID, e) {
                                    self.editPayment(rowID);
                                },
                                cellattr: function (rowId, value, rowObject, colModel, arrData) {
                                    return 'style=text-align:center;'
                                }
                            },
                            { name: 'id', index: 'id', key: true, searchFlag: 'int',hidden: true  },
                            { name: 'current_status', hidden: true },
                            { name: 'payment_id',  searchFlag: 'int' },
                            { name: 'invoice_no', hidden: true },
                            { name: 'display_id', width: 150, searchFlag: '%' },
                            { name: 'payment_dt', width: 250, searchFlag: 'date_pure', formatter: self.paymentDateFormatter },
                            { name: 'accounting_dt', width: 250, searchFlag: 'date_pure', formatter: self.paymentAccountingDateFormatter },
                            { name: 'payer_type', width: 215, searchFlag: '%', stype: 'select', formatter: self.payerTypeFormatter, searchoptions: { value: payerTypeValue } },
                            { name: 'payer_name', width: 300, searchFlag: 'hstore' },
                            { name: 'amount', width: 215, searchFlag: '%' },
                            { name: 'applied', width: 215, searchFlag: '%' },
                            { name: 'available_balance', width: 215, searchFlag: '%' },
                            { name: 'adjustment_amount', width: 215, searchFlag: 'hstore', searchColumn: ['payment_info->adjustment_amount'] },
                            { name: 'user_full_name', width: 215, searchFlag: '%', searchColumn: ['users.last_name'] },
                            { name: 'payment_mode', width: 200, searchFlag: 'hstore', searchColumn: ['payment_info->payment_mode'] },
                            { name: 'facility_name', width: 200, searchFlag: '%', searchColumn: ['facility_name'] },
                            { name: 'total_amount', hidden: true },
                            { name: 'total_applied', hidden: true },
                            { name: 'total_adjustment', hidden: true }
                        ],
                        customizeSort: true,
                        sortable: {
                            exclude: ',#jqgh_tblpaymentsGrid_edit'
                        },
                        pager: '#gridPager_payments',
                        sortname: "id",
                        sortorder: "desc",
                        caption: "Payments",
                        datastore: self.paymentsList,
                        container: this.el,
                        offsetHeight: 01,
                        dblClickActionIndex: 1,
                        ondblClickRow: function (rowID) {
                            self.editPayment(rowID);
                        },
                        onaftergridbind: function (model, gridObj) {
                            self.bindDateRangeOnSearchBox(gridObj);
                        },
                        disablesearch: false,
                        disablesort: false,
                        disablepaging: false,
                        showcaption: false,
                        disableadd: true,
                        disablereload: true,
                        customargs: {
                            paymentStatus: $("#ulPaymentStatus").val()
                        },
                        afterInsertRow: function (rowid, rowdata) {
                            if (rowdata.current_status) {
                                var status = commonjs.getClaimColorCodeForStatus(rowdata.current_status, 'payment');
                                var statusColor = status[0];
                                if (statusColor)
                                    $("#" + rowid).css({ 'background-color': statusColor.color_code });
                            }
                        }
                    });

                    this.gridLoaded = true;

                    $("#tblpaymentsGrid").bind("jqGridAfterGridComplete", function (e) {
                        clearTimeout(self.amountTimer);
                        self.amountTimer = setTimeout(self.calculateAmountTotal, 25);
                        clearTimeout(self.adjustmentTimer);
                        self.adjustmentTimer = setTimeout(self.calculateAdjustmentTotal, 25);
                        clearTimeout(self.appliedTimer);
                        self.appliedTimer = setTimeout(self.calculateAppliedTotal, 25);
                        let dataSet={
                            paymentStatus: $("#ulPaymentStatus").val(),
                            filterData:JSON.stringify(self.pager.get("FilterData")),
                            filterCol:JSON.stringify(self.pager.get("FilterCol")),
                            sortField:self.pager.get("SortField"), 
                            sortOrder:self.pager.get("SortOrder"), 
                        };

                        jQuery.ajax({
                            url: "/exa_modules/billing/payments/total_amount",
                            type: "GET",
                            data: dataSet,
                            success: function (data, textStatus, jqXHR) {
                               if(data &&data.length){
                                $("#divAmountTotal").html(data[0].total_amount);
                                $("#divAppliedTotal").html(data[0].total_applied);
                                $("#divAdjTotal").html(data[0].total_adjustment);   
                               }
                            },
                            error: function (err) {
                                commonjs.handleXhrError(err);
                            }
                        });
                        commonjs.docResize();
                    });
                }
                else {
                    this.paymentTable.refresh();
                }
            },
            
            editPayment: function (rowId) {
                Backbone.history.navigate('#billing/payments/edit/' + rowId, true);
            },

            paymentDateFormatter: function (cellvalue, options, rowObject) {
                var colValue;
                colValue = (commonjs.checkNotEmpty(rowObject.payment_dt) ? commonjs.getFormattedUtcDate(rowObject.payment_dt) : '');
                return colValue;
            },

            paymentAccountingDateFormatter: function (cellvalue, options, rowObject) {
                var colValue;
                colValue = (commonjs.checkNotEmpty(rowObject.accounting_dt) ? commonjs.getFormattedUtcDate(rowObject.accounting_dt) : '');
                return colValue;
            },

            payerTypeFormatter: function (cellvalue, options, rowObject) {
                var colvalue = '';
                switch (rowObject.payer_type) {
                    case "insurance":
                        colvalue = 'Insurance';
                        break;
                    case "patient":
                        colvalue = 'Patient';
                        break;
                    case "ordering_provider":
                        colvalue = 'Provider';
                        break;
                    case "ordering_facility":
                        colvalue = 'Ordering Facility';
                        break;

                }
                return colvalue;
            },

            addNewPayemnt: function () {
                Backbone.history.navigate('#billing/payments/new', true);
            },

            generatePDF: function (e) {
                var self = this;
                self.paymentPDF = new paymentPDF({ el: $('#modal_div_container') });
                var paymentPDFArgs = {                   
                    'isDateFlag': $('#filterByPostingDt').prop('checked') ? true : false
                }
                self.paymentPDF.onReportViewClick(e, paymentPDFArgs);
            },

            prepareValueForCSV(val) {
                val = '' + val;
                val = val.replace(/"/g, '""');
                return '"' + val + '"';
            },

            exportExcel: function () {
                var self = this;
                var responseJSON = self.paymentsList;
                var ReportTitle = 'Payment';
                var ShowLabel = 'Payment';
                var paymentExcelData = typeof responseJSON != 'object' ? JSON.parse(responseJSON) : responseJSON;
                var CSV = '';
                CSV += ReportTitle + '\r';
                if (ShowLabel) {
                    var row = "";

                    row += 'PAYMENT ID' + ',';
                    row += 'REF. PAYMENT ID' + ',';
                    row += 'PAYMENT DATE' + ',';
                    row += 'ACCOUNTING DATE' + ',';
                    row += 'PAYER TYPE' + ',';
                    row += 'PAYER NAME' + ',';
                    row += 'PAYMENT AMOUNT' + ',';
                    row += 'PAYMENT APPLIED' + ',';
                    row += 'BALANCE' + ',';
                    row += 'ADJUSTMENT' + ',';
                    row += 'POSTED BY' + ',';
                    row += 'PAYMENT MODE' + ',';
                    row += 'FACILITY' + ',';
                }
                row = row.slice(0, -1);
                CSV += row + '\r\n';

                for (var i = 0; i < paymentExcelData.models.length; i++) {
                    var row = "";
                    var paymentResult = paymentExcelData.models[i].attributes;
                    row += '"' + paymentResult.id + '",';
                    row += '"' + (paymentResult.display_id > 0) ? paymentResult.display_id : '0' + '",';
                    row += '"' + moment(paymentResult.payment_dt).format('L') + '",';
                    row += '"' + moment(paymentResult.accounting_dt).format('L') + '",';
                    row += '"' + paymentResult.payer_type + '",';
                    row += '"' + paymentResult.payer_name + '",';
                    row += '"' + paymentResult.amount + '",';
                    row += '"' + paymentResult.applied + '",';
                    row += '"' + paymentResult.available_balance + '",';
                    row += '"' + paymentResult.adjustment_amount + '",';
                    row += '"' + paymentResult.user_full_name + '",';
                    row += '"' + paymentResult.payment_mode + '",';
                    row += '"' + paymentResult.facility_name + '",';
                    row.slice(0, row.length - 1);
                    CSV += row + '\r\n';
                }

                if (CSV == '') {
                    alert("Invalid data");
                    return;
                }
                var fileName = "";
                fileName += ReportTitle.replace(/ /g, "_");
                var uri = 'data:text/csv;charset=utf-8,' + escape(CSV);
                var link = document.createElement("a");
                link.href = uri;
                link.style = "visibility:hidden";
                link.download = fileName + ".csv";
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            },
            
            bindDateRangeOnSearchBox: function (gridObj) {
                var self = this, tabtype = 'order';
                var columnsToBind = ['payment_dt', 'accounting_dt']
                var drpOptions = { locale: { format: "L" } };
                var currentFilter = 1;
                _.each(columnsToBind, function (col) {
                    var rangeSetName = "past";
                    var colSelector = '#gs_' + col;

                    var colElement = $(colSelector);
     
                    var drp = commonjs.bindDateRangePicker(colElement, drpOptions, rangeSetName, function (start, end, format) {
                        if (start && end) {
                            currentFilter.startDate = start.format('L');
                            currentFilter.endDate = end.format('L');
                            $('input[name=daterangepicker_start]').removeAttr("disabled");
                            $('input[name=daterangepicker_end]').removeAttr("disabled");
                            $('.ranges ul li').each(function (i) {
                                if ($(this).hasClass('active')) {
                                    currentFilter.rangeIndex = i;
                                }
                            });
                        }
                    });
                    colElement.on("apply.daterangepicker", function (ev, drp) {
                        gridObj.refresh();
                    });
                    colElement.on("cancel.daterangepicker", function (ev, drp) {
                    });
                });
            }

        });

        return paymentsView;
    });