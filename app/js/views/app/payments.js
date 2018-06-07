define(['jquery', 'immutable', 'underscore', 'backbone', 'jqgrid', 'jqgridlocale', 'text!templates/app/payments.html', 'collections/payments', 'models/pager'],
    function (jQuery, Immutable, _, Backbone, JGrid, JGridLocale, paymentsGrid, paymentsLists, ModelPaymentsPager) {
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
                'click #btnPaymentAdd': 'addNewPayemnt'
            },

            initialize: function (options) {
                var self = this;
                this.options = options;
                var paymentStatus = [
                    { 'value': 'Applied', 'text': 'Applied' },
                    { 'value': 'UnApplied', 'text': 'UnApplied' },
                    { 'value': 'PartialApplied', 'text': 'PartialApplied' },
                    { 'value': 'OverApplied', 'text': 'OverApplied' },
                    { 'value': 'Refund', 'text': 'Refund' }
                ];
                this.payer_type = [
                    { 'value': "PPP", 'text': "Patient" },
                    { 'value': "POF", 'text': "Ordering Facility" },
                    { 'value': "PIP", 'text': "Insurance" },
                    { 'value': "PRP", 'text': "Provider" }
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
                // this.model = new ModelPayments();
                this.paymentsList = new paymentsLists();
                // this.pendingPayments = new pendingPayments();
                // this.folowupPendingPayments = new followupPendingPayments();
                // this.appliedPayments = new appliedPayments();
                // this.paymentspatientList = new paymentspatient();
                this.adjustmentCodeList = new modelCollection(adjustment_codes);
                this.claimStatusList = new modelCollection(claim_status);
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
                        colNames: ['<span  id="spnStatus" class="icon-ic-worklist" onclick="commonjs.popOverActions(event)" ></span>', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
                        i18nNames: ['', 'billing.payments.paymentID', '', '', 'billing.payments.referencePaymentID', 'billing.payments.paymentDate', 'billing.payments.accountingDate', 'billing.payments.payertype', 'billing.payments.payerName', 'billing.payments.paymentAmount', 'billing.payments.paymentApplied', 'billing.payments.balance', 'billing.payments.adjustment', 'billing.payments.postedBy', 'billing.payments.paymentmode', 'billing.payments.facility_name', '', '', ''],
                        colModel: [
                            {
                                name: 'edit', width: 50, sortable: false, search: false,
                                className: 'icon-ic-edit',
                                formatter: function (a, b, c) {
                                    return "<span class='icon-ic-edit' title='click Here to Edit'></span>"                                    
                                    // var url = "#billing/payments/edit/" + b.rowId;
                                    // return '<a href=' + url + '> Edit'
                                },
                                customAction: function (rowID, e) {
                                    self.editPayment(rowID);
                                },
                                cellattr: function (rowId, value, rowObject, colModel, arrData) {
                                    return 'style=text-align:center;'
                                }
                            },
                            { name: 'id', index: 'id', key: true, searchFlag: 'int' },
                            { name: 'current_status', hidden: true },
                            { name: 'invoice_no', hidden: true },
                            { name: 'display_id', width: 215, searchFlag: '%' },
                            { name: 'payment_date', width: 215, searchFlag: 'date_pure', formatter: self.paymentDateFormatter },
                            { name: 'accounting_date', width: 215, searchFlag: 'date_pure', formatter: self.paymentAccountingDateFormatter },
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
                            exclude: ',#jqgh_tblpaymentsGrid_edit,#jqgh_tblpaymentsGrid_del'
                        },
                        pager: '#gridPager_payments',
                        sortname: "id",
                        sortorder: "desc",
                        caption: "Payments",
                        datastore: self.paymentsList,
                        container: this.el,
                        offsetHeight: 01,
                        gridComplete: function () {
                            self.setupActionClickOver();
                        },
                        dblClickActionIndex: 1,
                        ondblClickRow: function (rowID) {
                            self.editPayment(rowID);
                        },
                        afterInsertRow: function (rowid, rowdata) {

                            // if (rowdata.current_status) {
                            //     var statusClass = self.getStatus(rowdata.current_status);
                            //     $("#tblpaymentsGrid").find('#' + rowid).removeClass(statusClass).addClass(statusClass);
                            // }
                            // if (typeof (self.options.afterInsertRow) != 'undefined')
                            //     self.options.afterInsertRow(rowid, rowdata);
                        },
                        onaftergridbind: self.afterGridBind,
                        disablesearch: false,
                        disablesort: false,
                        disablepaging: false,
                        showcaption: false,
                        disableadd: true,
                        disablereload: true,
                        customargs: {
                            filterByDateType: $('input[name=filterByDateType]:checked').val(),
                            fromDate: self.dtpPayFrom && self.dtpPayFrom.date() ? self.dtpPayFrom.date().format('YYYY-MM-DD') : "",
                            toDate: self.dtpPayTo && self.dtpPayTo.date() ? self.dtpPayTo.date().format('YYYY-MM-DD') : "",
                            paymentStatus: $("#ulPaymentStatus").val(),
                            facility_id: $("#ddlPaymentFacility").val()
                        }
                    });

                    this.gridLoaded = true;
                    $("#tblpaymentsGrid").bind("reloadGrid", function (e) {
                        $("#divAmountTotal").html("$0.00");
                        $("#divAppliedTotal").html("$0.00");
                        $("#divAdjTotal").html("$0.00");
                    });

                    $("#tblpaymentsGrid").bind("jqGridAfterGridComplete", function (e) {
                        clearTimeout(self.amountTimer);
                        self.amountTimer = setTimeout(self.calculateAmountTotal, 25);
                        clearTimeout(self.adjustmentTimer);
                        self.adjustmentTimer = setTimeout(self.calculateAdjustmentTotal, 25);
                        clearTimeout(self.appliedTimer);
                        self.appliedTimer = setTimeout(self.calculateAppliedTotal, 25);
                        // $('#tblpaymentsGrid').jqGrid('setGridHeight', '390px');
                    });
                }
                else {
                    this.paymentTable.refresh();
                }

                setTimeout(function () {
                    // $('#tblpaymentsGrid').jqGrid('setGridHeight', '390px');
                }, 100);
            },


            editPayment: function (rowId) {
                Backbone.history.navigate('#billing/payments/edit/' + rowId, true);
            },
            
            paymentDateFormatter: function (cellvalue, options, rowObject) {
                var colValue;
                colValue = (commonjs.checkNotEmpty(rowObject.payment_date) ? moment(rowObject.payment_date).format('L') : '');
                return colValue;
            },
            
            paymentAccountingDateFormatter: function (cellvalue, options, rowObject) {
                var colValue;
                colValue = (commonjs.checkNotEmpty(rowObject.accounting_date) ? moment(rowObject.accounting_date).format('L') : '');
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
                    case "provider":
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
            }
        });

        return paymentsView;
    });