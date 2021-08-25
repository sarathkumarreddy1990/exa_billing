define(['jquery',
    'immutable',
    'underscore',
    'backbone',
    'jqgrid',
    'jqgridlocale',
    'text!templates/app/payments.html',
    'collections/app/payments',
    'models/pager',
    'views/reports/payments-pdf',
    'text!templates/app/balance-write-off.html',
    'collections/app/patient-claims'
],

    function (jQuery,
        Immutable,
        _,
        Backbone,
        JGrid,
        JGridLocale,
        paymentsGrid,
        paymentsLists,
        ModelPaymentsPager,
        paymentPDF,
        balanceWriteOffTemplate,
        patientClaimLists
        ) {
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
            patientGridLoaded: false,
            formLoaded: false,
            pendPaymentTable: null,
            pendPaymentTable1: null,
            appliedPaymentTable: null,
            isCleared: false,
            paymentsGridTemplate: _.template(paymentsGrid),
            balanceWriteOffTemplate: _.template(balanceWriteOffTemplate),

            events: {
                'click #btnPaymentAdd': 'addNewPayemnt',
                'click #btnStatusSearch': 'searchPayments',
                'click #btnPaymentRefresh': 'refreshPayments',
                "click #btnGenerateExcel": "exportExcel",
                "click #btnGeneratePDF": "generatePDF",
                "change #ulPaymentStatus": 'searchPayments',
                "click #btnTOSPayment": "applyTOSPayment",
                "click #btnAdjustmentWriteOff": "showAdjustmentWriteOff"
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
                var facilities = app.facilities;
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
                this.patientClaimPager = new ModelPaymentsPager();
                this.paymentsList = new paymentsLists();
                this.patientClaimList = new patientClaimLists();
                this.adjustmentCodeList = new modelCollection(adjustment_codes);
                this.claimStatusList = new modelCollection(claim_status);

                commonjs.initHotkeys({
                    NEW_PAYMENT: '#btnPaymentAdd'
                });

                if (app.userInfo.user_type != 'SU') {
                    var rights = (window.appRights).init();
                    this.screenCode = rights.screenCode;
                }
                else {
                    this.screenCode = [];
                }
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
                commonjs.isMaskValidate();
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
                self.isCleared = false;
                $("#divAmountTotal").html(' <i class="fa fa-spinner loading-spinner"></i>');
                $("#divAppliedTotal").html(' <i class="fa fa-spinner loading-spinner"></i>');
                $("#divAdjTotal").html(' <i class="fa fa-spinner loading-spinner"></i>');
                self.pager.set({ "PageNo": 1 });
                self.paymentTable.options.customargs = {
                    paymentStatus: $("#ulPaymentStatus").val(),
                    from: self.from || '',
                    toDate: !self.isCleared ? moment().format('YYYY-MM-DD') : "",
                    fromDate: !self.isCleared ? moment().subtract(29, 'days').format('YYYY-MM-DD') : "",
                    filterByDateType: 'accounting_date'
                };

                self.paymentTable.refreshAll();
            },

            searchPayments: function () {
                var self = this;
                $("#divAmountTotal").html(' <i class="fa fa-spinner loading-spinner"></i>');
                $("#divAppliedTotal").html(' <i class="fa fa-spinner loading-spinner"></i>');
                $("#divAdjTotal").html(' <i class="fa fa-spinner loading-spinner"></i>');

                self.pager.set({ "PageNo": 1 });
                self.paymentTable.options.customargs = {
                    paymentStatus: $("#ulPaymentStatus").val(),
                    from: self.from || '',
                    toDate: !self.isCleared ? moment().format('YYYY-MM-DD') : "",
                    fromDate: !self.isCleared ? moment().subtract(29, 'days').format('YYYY-MM-DD') : "",
                    filterByDateType: 'accounting_date'
                };
                self.pager.set({ "PageNo": 1 });
                self.paymentTable.refresh();
            },

            showGrid: function (filterApplied, from) {

                if(this.screenCode.indexOf('PAYM') > -1 && this.screenCode.indexOf('TOSP') === -1 && from !== 'ris') {
                    commonjs.showError('messages.errors.accessdenied');
                    return false;
                }

                if (!this.rendered)
                    this.render(opener);
                var self = this;
                self.from = from;
                commonjs.isFrom = self.from;
                //Listing all payments
                if (!filterApplied) {
                    commonjs.paymentStatus = [];
                    commonjs.paymentFilterFields = [];
                    self.gridLoaded = false;
                    $('#ulPaymentStatus').multiselect("selectAll", false).multiselect("refresh");
                }
                //If any status filtered previously
                else if (commonjs.paymentStatus && commonjs.paymentStatus.length) {
                    $("#ulPaymentStatus").val(commonjs.paymentStatus);
                    $("#ulPaymentStatus").multiselect("refresh");
                }
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

                var payment_mode = { "": "All", "Cash": "Cash", "Card": "Card", "Check": "Check", "EFT": "EFT", "Adjustment": "Adjustments" };
                var facilities = commonjs.makeValue(commonjs.getActiveFacilities(), ":All;", "id", "facility_name");
                payment_mode.Check = app.country_alpha_3_code === 'can' ? 'Cheque' : payment_mode.Check;

                $('#liPendingPayments').removeClass('active');
                $('#divPayments,#ulPaymentTab #liPayments').addClass('active');
                $('#ulPaymentTab #liPendingPayments').hide();
                $('#divtabPendingPayments').hide();
                $('#ulPaymentTab #liPayments, #payementsFilter').show();
                $('#divtabPayments').show();
                // Hide TOS payment and Small Balance Write off options from fornt desk payment
                if(self.from === 'ris') {
                    $('.tosPayment').hide();
                }
                if (!this.gridLoaded) {
                    this.paymentTable = new customGrid();
                    this.paymentTable.render({
                        gridelementid: '#tblpaymentsGrid',
                        custompager: this.pager,
                        emptyMessage: commonjs.geti18NString("messages.status.noRecordFound"),
                        colNames: ['<span  id="spnStatus" class="icon-ic-worklist" onclick="commonjs.popOverActions(event)" ></span>', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
                        i18nNames: ['', '', '', 'billing.payments.paymentID', '', 'billing.payments.referencePaymentID', 'billing.payments.paymentDate', 'billing.payments.accountingDate', 'billing.payments.payertype', 'billing.payments.payerName', 'billing.payments.patientMRN', 'billing.payments.paymentAmount', 'billing.payments.paymentApplied', 'billing.payments.balance', 'billing.payments.adjustments', 'billing.COB.notes', 'billing.payments.postedBy', 'billing.payments.paymentMode', 'billing.payments.chequeCardNo', 'billing.payments.facility_name', '', '', ''],
                        colModel: [
                            {
                                name: 'edit', width: 50, sortable: false, search: false,
                                className: 'icon-ic-edit',
                                formatter: function (e, model, data) {
                                    return "<i class='icon-ic-edit' i18nt='shared.buttons.edit'></i>";
                                },
                                customAction: function (rowID, e) {
                                    self.editPayment(rowID, self.from);
                                },
                                cellattr: function (rowId, value, rowObject, colModel, arrData) {
                                    return 'style=text-align:center;'
                                }
                            },
                            { name: 'id', index: 'id', key: true, hidden: true },
                            { name: 'current_status', hidden: true },
                            { name: 'payment_id' },
                            { name: 'invoice_no', hidden: true },
                            { name: 'display_id', width: 150 },
                            { name: 'payment_dt', width: 250, formatter: self.paymentDateFormatter },
                            { name: 'accounting_date', width: 250, formatter: self.paymentAccountingDateFormatter },
                            { name: 'payer_type', width: 215, stype: 'select', formatter: self.payerTypeFormatter, searchoptions: { value: payerTypeValue } },
                            { name: 'payer_name', width: 300 },
                            { name: 'account_no', width: 300, formatter: self.accountNumFormatter },
                            { name: 'amount', width: 215, validateMoney : true },
                            { name: 'applied', width: 215, validateMoney: true },
                            { name: 'available_balance', width: 215, validateMoney : true },
                            { name: 'adjustment_amount', width: 215, validateMoney: true },
                            { name: 'notes', width: 215 },
                            { name: 'user_full_name', width: 215 },
                            { name: 'payment_mode', width: 215, stype: 'select', formatter: self.paymentModeFormatter, stype: 'select', "searchoptions": { "value": payment_mode, "tempvalue": payment_mode } },
                            { name: 'card_number', width: 215 },
                            { name: 'facility_name', width: 200, stype: 'select', "searchoptions": { "value": facilities, "tempvalue": facilities } },
                            { name: 'total_amount', hidden: true },
                            { name: 'total_applied', hidden: true },
                            { name: 'total_adjustment', hidden: true }
                        ],
                        customizeSort: true,
                        sortable: {
                            exclude: ',#jqgh_tblpaymentsGrid_edit'
                        },
                        pager: '#gridPager_payments',
                        sortname: "payments.id",
                        sortorder: "desc",
                        caption: "Payments",
                        datastore: self.paymentsList,
                        container: this.el,
                        offsetHeight: 01,
                        dblClickActionIndex: 1,
                        ondblClickRow: function (rowID) {
                            self.editPayment(rowID, self.from);
                        },
                        onaftergridbind: function (model, gridObj) {
                            var paymentsList = _.map(model, function (obj) {
                                return {
                                    id: btoa(obj.id),
                                    payer_type: obj.attributes && obj.attributes.payer_type || ''
                                };
                            });

                            window.localStorage.setItem('payment_list', JSON.stringify(paymentsList));
                            self.bindDateRangeOnSearchBox(gridObj);

                            if (model && model.length) {
                                self.setMoneyMask();
                                self.getTotalAmount(self.from);
                            }
                            else {
                                $("#divAmountTotal").html('$0.00');
                                $("#divAppliedTotal").html('$0.00');
                                $("#divAdjTotal").html('$0.00');
                            }
                        },
                        disablesearch: false,
                        disablesort: false,
                        disablepaging: false,
                        showcaption: false,
                        disableadd: true,
                        disablereload: true,
                        customargs: {
                            paymentStatus: $("#ulPaymentStatus").val(),
                            from: self.from === 'ris' ? 'ris' : '',
                            toDate: !self.isCleared ? moment().format('YYYY-MM-DD') : "",
                            fromDate: !self.isCleared ? moment().subtract(29, 'days').format('YYYY-MM-DD') : "",
                            filterByDateType: 'accounting_date'
                        },
                        afterInsertRow: function (rowid, rowdata) {
                            if (rowdata.current_status) {
                                var status = commonjs.getClaimColorCodeForStatus(rowdata.current_status, 'payment');
                                var statusColor = status[0];
                                if (statusColor)
                                    $("#" + rowid).css({ 'background-color': statusColor.color_code });
                            }
                        },
                        delayedPagerUpdate: true,
                        pagerApiUrl: '/exa_modules/billing/payments/count'
                    });

                    this.gridLoaded = true;
                }
                else {
                    this.paymentTable.refresh();
                }
                commonjs.docResize();
                commonjs.processPostRender({screen: 'Payments'});
            },

            getTotalAmount: function (from) {
                var self = this;
                var dataSet = {
                    paymentStatus: $("#ulPaymentStatus").val(),
                    filterData: JSON.stringify(self.pager.get("FilterData")),
                    filterCol: JSON.stringify(self.pager.get("FilterCol")),
                    sortField: self.pager.get("SortField"),
                    sortOrder: self.pager.get("SortOrder"),
                    default_facility_id: app.userInfo.default_facility_id,
                    from: from,
                    toDate: !self.isCleared ?moment().format('YYYY-MM-DD') : "",
                    fromDate: !self.isCleared ? moment().subtract(29, 'days').format('YYYY-MM-DD') : "",
                    filterByDateType: 'accounting_date'
                };

                jQuery.ajax({
                    url: "/exa_modules/billing/payments/total_amount",
                    type: "GET",
                    data: dataSet,
                    success: function (data, textStatus, jqXHR) {
                        if (data && data.length) {
                            $("#divAmountTotal").html(data[0].total_amount);
                            $("#divAppliedTotal").html(data[0].total_applied);
                            $("#divAdjTotal").html(data[0].total_adjustment);
                        }
                    },
                    error: function (err) {
                        commonjs.handleXhrError(err);
                    }
                });
            },

            setMoneyMask: function (obj1, obj2) {
                var $gridFields = $(".ui-jqgrid-htable thead:first tr.ui-search-toolbar");
                $gridFields.find("input[name=available_balance],[name=applied],[name=amount],[name=adjustment_amount]").addClass('negativeFloatBox');
                $gridFields.find("input[name=payment_id]").addClass('integerbox');
                commonjs.validateControls();
            },

            editPayment: function (rowId, from) {
                commonjs.paymentStatus = $('#ulPaymentStatus').val();
                commonjs.paymentFilterFields = $('#divGrid_payments .ui-search-toolbar th div input, select').map(function () {
                    if (!$(this).is('#ulPaymentStatus'))
                        return $(this).attr('id') + '~' + $(this).val();
                });
                if(from === 'ris')
                    Backbone.history.navigate('#billing/payments/edit/'+ from + '/' + rowId, true);
                else
                    Backbone.history.navigate('#billing/payments/edit/'+ rowId, true);
            },

            accountNumFormatter: function (cellvalue, options, rowObject) {
                return rowObject.payer_type === "patient" ? rowObject.account_no : '';
            },

            paymentDateFormatter: function (cellvalue, options, rowObject) {
                var colValue;
                colValue = (commonjs.checkNotEmpty(rowObject.payment_dt) ? commonjs.convertToFacilityTimeZone(rowObject.facility_id, rowObject.payment_dt).format('L') : '');
                return colValue;
            },

            paymentAccountingDateFormatter: function (cellvalue, options, rowObject) {
                var colValue;
                colValue = (commonjs.checkNotEmpty(rowObject.accounting_date) ? commonjs.getFormattedDate(rowObject.accounting_date) : '');
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

            paymentModeFormatter: function (cellvalue, options, rowObject) {
                var colvalue = '';
                switch (rowObject.payment_mode) {
                    case "cash":
                        colvalue = 'Cash';
                        break;
                    case "eft":
                        colvalue = 'EFT';
                        break;
                    case "check":
                        colvalue = app.country_alpha_3_code === 'can' ? 'Cheque' : 'Check';
                        break;
                    case "card":
                         colvalue = 'Card';
                        break;
                    case "adjustment":
                        colvalue = 'Adjustments';
                        break;


                }
                return colvalue;
            },


            addNewPayemnt: function () {
                if(this.from === 'ris')
                    Backbone.history.navigate('#billing/payments/new/ris', true);
                else
                    Backbone.history.navigate('#billing/payments/new', true);
            },

            generatePDF: function (e) {
                var self = this;
                filterData = JSON.stringify(self.pager.get("FilterData"));
                filterCol = JSON.stringify(self.pager.get("FilterCol"));
                self.paymentPDF = new paymentPDF({ el: $('#modal_div_container') });
                var paymentPDFArgs = {
                    paymentStatus: $("#ulPaymentStatus").val(),
                    'isDateFlag': $('#filterByPostingDt').prop('checked') ? true : false,
                    from: self.from ?self.from: 'Billing',
                    filterData: filterData,
                    filterColumn : filterCol,
                    filterFlag: true,
                    countryCode: app.country_alpha_3_code

                }
                self.paymentPDF.onReportViewClick(e, paymentPDFArgs);
            },

            prepareValueForCSV: function (val) {
                val = '' + val;
                val = val.replace(/"/g, '""');
                return '"' + val + '"';
            },
            exportExcel: function () {
                var self = this;
                filterData = JSON.stringify(self.pager.get("FilterData"));
                filterCol = JSON.stringify(self.pager.get("FilterCol"));
                var searchFilterFlag = grid.getGridParam("postData")._search;
                $('#btnGenerateExcel').prop('disabled', true);
                var facilityTz = app.facilities.map(function (val) { return { 'id': val.id, 'value': val.time_zone } });
                commonjs.showLoading();
                $.ajax({
                    url: "/exa_modules/billing/payments/payments_list",
                    type: 'GET',
                    data: {
                        paymentReportFlag: searchFilterFlag ? false : true,
                        paymentStatus: $("#ulPaymentStatus").val(),
                        from: self.from,
                        filterData: filterData,
                        filterCol: filterCol,
                        toDate: !self.isCleared ? moment().format('YYYY-MM-DD') : "",
                        fromDate: !self.isCleared ? moment().subtract(29, 'days').format('YYYY-MM-DD') : "",
                        filterByDateType: 'accounting_date',
                        country_code: app.country_alpha_3_code
                    },
                    success: function (data, response) {
                        commonjs.prepareCsvWorker({
                            data: data,
                            reportName: 'PAYMENTS',
                            fileName: 'Payments',
                            countryCode: app.country_alpha_3_code,
                            facilities: facilityTz,
                            companyTz: app.company.time_zone
                        }, {
                                afterDownload: function () {
                                    $('#btnGenerateExcel').prop('disabled', false);
                                }
                            });
                    },
                    error: function (err) {
                        commonjs.handleXhrError(err);
                    }
                });
            },

            bindDateRangeOnSearchBox: function (gridObj) {
                var self = this, tabtype = 'order';
                var columnsToBind = ['payment_dt', 'accounting_date']
                var drpOptions = { locale: { format: "L" } };
                var currentFilter = 1;
                _.each(columnsToBind, function (col) {
                    var rangeSetName = "past";
                    var colSelector = '#gs_' + col;

                    var colElement = $(colSelector);
                    if ((col == 'accounting_date') && !colElement.val() && !self.isCleared) {
                        var toDate = moment(),
                            fromDate = moment().subtract(29, 'days');
                        colElement.val(fromDate.format("L") + " - " + toDate.format("L"));
                    }

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
                        self.isCleared = true;
                        self.searchPayments();
                    });
                });
            },

            applyTOSPayment: _.debounce(function (e) {

                var self =this;
                var paymentStatus = $("#ulPaymentStatus").val();
                var payerType = $('#gs_payer_type').val();

                if (!paymentStatus.length) {
                    commonjs.showWarning('messages.warning.payments.selectUnappliedStatus');
                    return false;
                }

                if (payerType != 'patient') {
                    commonjs.showWarning('messages.warning.payments.selectPatientPayerType');
                    return false;
                }

                // Condition : Validate if unapplied status not selected
                if(paymentStatus.length != 1 || paymentStatus.indexOf('unapplied') === -1){
                    commonjs.showWarning('messages.warning.payments.selectUnappliedStatus');
                    return false;
                }

                var filterCol = self.pager.get("FilterCol") || [];
                var filterData = self.pager.get("FilterData") || [];
                var dataSet = {
                    from: 'tos_payment',
                    filterByDateType: 'accounting_date',
                    sortOrder: self.pager.get("SortOrder"),
                    sortField: self.pager.get("SortField"),
                    paymentStatus: paymentStatus,
                    flag : "is_tos_payment"
                };

                if (filterCol.indexOf('accounting_date') === -1) {
                    filterCol.push('accounting_date');
                    filterData.push($('#gs_accounting_date').val());
                }

                _.each(filterCol, function (obj, index) {
                    if (filterData[index]) {
                        dataSet[obj] = filterData[index];
                    }
                });

                var tos_request = {
                    url: '/exa_modules/billing/payments/apply_tos_payments',
                    type: 'POST',
                    data: dataSet,
                    success: function (data, response) {
                        if (data && data.length) {
                            if (data[0].message) {
                                commonjs.showWarning(data[0].message);
                            } else {
                                commonjs.showStatus('messages.status.tosSuccessfullyCompleted');
                                self.paymentTable.refresh();
                            }
                            commonjs.hideLoading();
                        }
                        $('#btnTOSPayment').prop('disabled',false);
                    },
                    error: function (err, response) {
                        commonjs.handleXhrError(err, response);
                        commonjs.hideLoading();
                        $('#btnTOSPayment').prop('disabled',false);
                    }
                };

                $('#btnTOSPayment').prop('disabled',true);
                commonjs.showLoading();
                $.ajax(tos_request);

            }, 500),

            showAdjustmentWriteOff: _.debounce(function (e) {
                var self = this;
                self.patientClaimPager = new ModelPaymentsPager();

                commonjs.showDialog({
                    header: 'Small Balance Adjustment',
                    i18nHeader:'shared.buttons.smallBalanceAdjustment',
                    width: '85%',
                    height: '70%',
                    html: self.balanceWriteOffTemplate(),
                    onHide: function() {
                        self.patientClaimsGrid = null;
                        self.patientGridLoaded = false;
                    }
                });
                $('#siteModal').removeAttr('tabindex'); //removed tabIndex attr on sitemodel for select2 search text area can't editable
                $('#btnNextProcess').off().click(_.debounce(function (e) {
                    // Patient grid bind and refresh
                    if (!self.patientGridLoaded) {
                        self.showPatientsGrid(e);
                    } else {
                        self.patientClaimPager.set({ "PageNo": 1 });
                        self.patientClaimsGrid.options.customargs.writeOffAmount = $('#txtWriteOffAmt').val();
                        self.patientClaimsGrid.refreshAll();
                    }
                }, 250));

                commonjs.validateControls();
                commonjs.isMaskValidate();
            }, 500),

            showPatientsGrid: function (e) {
                var self = this;
                var writeOffAmount =  $('#txtWriteOffAmt').val();
                var $balanceWriteOff = $('#btnBalanceWriteOff');
                var $btnNext =  $('#btnNextProcess');

                if ($.trim(writeOffAmount) === '') {
                    commonjs.showWarning("shared.warning.pleaseEnterAdjustAmount");
                    return false;
                }

                if (!$balanceWriteOff.hasClass('d-none')) {
                    $balanceWriteOff.addClass('d-none');
                }

                self.patientClaimsGrid = new customGrid();
                self.patientClaimsGrid.render({
                    gridelementid: '#tblPatientClaimsGrid',
                    custompager: self.patientClaimPager,
                    emptyMessage: commonjs.geti18NString('messages.status.noRecordFound'),
                    colNames: [
                        '',
                        'Patient Name',
                        'Account No',
                        'DOB',
                        'Patient Balance'
                    ],
                    i18nNames: [
                        '',
                        'billing.refund.patientName',
                        'billing.refund.accountNo',
                        'billing.refund.dob',
                        'order.summary.patientBalance'
                    ],
                    colModel: [
                        { name: 'id', index: 'id', key: true, hidden: true },
                        { name: 'patient_name', width: 100, search: false },
                        { name: 'account_no', width: 200, search: false },
                        {
                            name: 'dob', width: 150, search: false,
                            formatter: function (e, model, data) {
                                return commonjs.getFormattedDate(data.dob);
                            }
                        },
                        { name: 'patient_balance', width: 200, search: false }
                    ],
                    datastore: self.patientClaimList,
                    container: $('#modal_div_container'),
                    cmTemplate: { sortable: false },
                    customizeSort: false,
                    sortname: "p.id",
                    sortorder: "asc",
                    dblClickActionIndex: 1,
                    disablesearch: false,
                    disablesort: false,
                    disablepaging: false,
                    showcaption: false,
                    disableadd: true,
                    disablereload: true,
                    customargs: {
                        writeOffAmount: writeOffAmount,
                        from: 'patients'
                    },
                    pager: '#gridPager_PatientClaims',
                    subGrid: true,
                    subGridInstance: function (subgrid_id, row_id) {
                        var patientClaimInstances = new patientClaimLists();
                        var subgrid_table_id = subgrid_id + "_t";
                        $("#" + subgrid_id).html("<table id='" + subgrid_table_id + "' class='scroll'></table>");
                        var tableid = "#" + subgrid_table_id;
                        var claimTable = new customGrid(patientClaimInstances, tableid);

                        claimTable.render({
                            gridelementid: tableid,
                            custompager: new ModelPaymentsPager(),
                            colNames: [
                                'Claim ID',
                                'Claim Total BillFee',
                                'Claim Total Balance'
                            ],
                            i18nNames: ['',
                                'billing.fileInsurance.claimId',
                                'shared.fields.claimTotalBillFee',
                                'shared.fields.claimTotalBalance'
                            ],
                            colModel: [
                                {
                                    name: 'id',
                                    key: true,
                                    width: 400,
                                    index: 'id',
                                    search: false,
                                    sortable: false
                                },
                                {
                                    name: 'charges_bill_fee_total',
                                    sortable: false,
                                    search: false,
                                    width: 500
                                },
                                {
                                    name: 'claim_balance_total',
                                    sortable: false,
                                    search: false,
                                    width: 500
                                }
                            ],
                            sortname: 'claims.id',
                            sortorder: 'ASC',
                            disablesearch: true,
                            disablesort: false,
                            disablepaging: true,
                            disableadd: true,
                            showcaption: false,
                            dblClickActionIndex: -2,
                            defaultwherefilter: '',
                            customargs: {
                                patientId: row_id,
                                from: 'patient_claims'
                            },
                            isSubGrid: true
                        });
                    },
                    onaftergridbind: function (model, gridObj) {
                        if (model && model.length) {
                            $balanceWriteOff.removeClass('d-none');
                        }

                        $balanceWriteOff.off().click(_.debounce(function (e) {
                            var writeOffAmount = $('#txtWriteOffAmt').val();
                            var msg = commonjs.geti18NString("messages.confirm.payments.writeOffAmountAreYouSure")
                                msg = msg.replace('WRITE_OFF_AMOUNT', writeOffAmount);

                            if (confirm(msg)) {

                                var write_off_request = {
                                    url: '/exa_modules/billing/payments/process_write_off_payments',
                                    type: 'POST',
                                    data: {
                                        defaultFacilityId : app.default_facility_id || app.facilityID || null,
                                        writeOffAmount : writeOffAmount,
                                        companyId : app.companyID,
                                        from : 'write-off'
                                    },
                                    beforeSend: function(){
                                        $balanceWriteOff.prop('disabled',true);
                                        $btnNext.prop('disabled',true);
                                    },
                                    success: function (data, response) {
                                        if (data && data.length) {
                                            commonjs.showStatus('messages.status.tosSuccessfullyCompleted');
                                            commonjs.hideLoading();
                                            $balanceWriteOff.prop('disabled',false);
                                            $balanceWriteOff.addClass('d-none');
                                            $btnNext.prop('disabled',false);
                                            // After write-off close popup
                                            commonjs.hideDialog();
                                        }

                                    },
                                    error: function (err, response) {
                                        commonjs.handleXhrError(err, response);
                                        commonjs.hideLoading();
                                        $balanceWriteOff.prop('disabled',false);
                                        $btnNext.prop('disabled',false);
                                    }
                                };

                                commonjs.showLoading();
                                $.ajax(write_off_request);
                            }

                        }, 250));
                        commonjs.isMaskValidate();
                    },
                    setCustomData: function (){
                        return {
                            writeOffAmount: $('#txtWriteOffAmt').val()
                        }
                    }
                });
                self.patientGridLoaded = true;
                $("#tblPatientClaimsGrid").setGridWidth($(".modal-body").width() - 10);
                $("#tblPatientClaimsGrid").setGridHeight(($(".modal-body").height() - 140));
                $('#txtWriteOffAmt').off("blur").on("blur", function () {
                    if ($("#txtWriteOffAmt").val() != writeOffAmount && !$balanceWriteOff.hasClass('d-none')) {
                        $balanceWriteOff.addClass('d-none');
                    }
                });
            }

        });

        return paymentsView;
    });
