define(['jquery', 'immutable', 'underscore', 'backbone', 'jqgrid', 'jqgridlocale', 'text!templates/app/payment-edit.html', 'models/payment', 'models/pager', 'text!templates/payments-payer.html', 'collections/pending-payments', 'collections/applied-payments', 'text!templates/app/payment-apply-cas.html', 'text!templates/app/apply-payment.html'],
    function (jQuery, Immutable, _, Backbone, JGrid, JGridLocale, editPayment, ModelPayments, ModelPaymentsPager, paymentsGridHtml, pendingPayments, appliedPayments, ApplyCasHtml, ApplyPaymentTemplate) {
        return Backbone.View.extend({
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
            gridPendLoaded: false,
            pendPaymentTable: null,
            pendPaymentTable1: null,
            appliedPaymentTable: null,
            paymentsEditTemplate: _.template(editPayment),
            paymentsGridTemplate: _.template(paymentsGridHtml),
            applyCasTemplate: _.template(ApplyCasHtml),
            applyPaymentTemplate: _.template(ApplyPaymentTemplate),

            events: {
                'click #btnPaymentSave': 'savePayment',
                'click .applyCAS': 'applyPaymentsCAS'
            },

            initialize: function (options) {
                var self = this;
                this.options = options;
                var paymentId = options.id;
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

                app.adjustmentCodes = [];
                this.paidlocation = new modelCollection(app.facilities);
                this.facilityAdd = new modelCollection(commonjs.bindArray([app.facilities], true, true, false));
                var facilities = (app.userInfo.user_type == "SU") ? app.facilities : app.userfacilities;
                var adjustment_codes = jQuery.grep(app.adjustmentCodes, function (obj, i) {
                    return (obj.type == "ADJCDE" || obj.type == "REFADJ");
                });
                var claim_status = jQuery.grep(app.adjustmentCodes, function (obj, i) {
                    return (obj.type == "CLMSTS");
                });
                this.facilityList = new modelCollection(commonjs.bindArray([app.facilities], false, true, true));
                this.adjustmentCodeList = new modelCollection(adjustment_codes);
                this.claimStatusList = new modelCollection(claim_status);
                this.paymentReasons = new modelCollection([]);
                this.model = new ModelPayments();
                this.pager = new ModelPaymentsPager();
                this.pendPager = new ModelPaymentsPager();
                this.pendPaymtPager = new ModelPaymentsPager();
                this.appliedPager = new ModelPaymentsPager();
                this.patientPager = new ModelPaymentsPager();
                this.pendingPayments = new pendingPayments();
                this.appliedPayments = new appliedPayments();

                self.render(paymentId);
            },

            returnDoubleDigits: function (str) {
                str = str.toString();
                return str.length === 1 ? '0' + str : str;
            },

            render: function (paymentId) {
                var self = this;
                self.defalutCASArray = [0, 1, 2, 3, 4, 5, 6];

                var yearValue = moment().year();
                var expiryYear = [];
                var expiryMonth = [];
                expiryYear.push({ value: yearValue, text: yearValue })
                for (var i = 0; i < 20; i++) {
                    yearValue = yearValue + 1;
                    expiryYear.push({ value: yearValue, text: yearValue })
                }
                for (var j = 1; j < 13; j++) {
                    expiryMonth.push({ value: self.returnDoubleDigits(j), text: self.returnDoubleDigits(j) });
                }
                $(this.el).html(this.paymentsEditTemplate({ expiryYear: expiryYear, expiryMonth: expiryMonth, paidlocation: this.paidlocation.toJSON(), facilityAdd: this.paidlocation.toJSON(), paymentReasons: this.paymentReasons.toJSON(), id: self.payemntId }));
                this.rendered = true;
                self.showBillingForm(paymentId);
                self.showPaymentsGrid(paymentId)
                //                commonjs.processPostRender();
            },

            showPaymentsGrid: function () {
                var ipForm1 = $('#divPendingPay');
                ipForm1.html(this.paymentsGridTemplate());
            },

            showBillingForm: function (paymentID) {
                var self = this;
                if (paymentID == 0) {
                    this.model = new ModelPayments();
                    $('#btnPaymentClear').show();
                }
                else {
                    this.model.set({ id: paymentID });
                    $('#btnPaymentClear').hide();
                }
                this.model.fetch({
                    data: { id: this.model.id },
                    success: function (model, result) {
                        if (result && result.length) {
                            self.bindpayments(result[0], paymentID);
                        }
                    }
                });
            },

            bindpayments: function (response, paymentID) {
                var self = this;
                self.order_id = (response.order_id) ? response.order_id : 0;
                self.study_id = (response.study_id) ? response.study_id : 0;
                $('#lblPayerID').html(response.id);
                $('#referencePaymentID_').val(response.display_id);
                $('#ddlPaidLocation_').val(response.paid_facility_id);
                $("input:radio[name=payertype][value=" + response.payer_type + "]").prop("checked", true);
                $("input:radio[name=billingMethod][value=" + response.billing_method + "]").prop("checked", true);
                if (response.billing_method && response.billing_method == "DB")
                    $('#chkDirectingBillingCon').show();
                // self.bindPayerType(response.result.payer_type, paymentID, response.result);

                $('#txtInvoice').val(response.invoice_no);
                $('#txtAmount').val(response.amount.substr(1));
                $('#lblApplied').html(response.applied.substr(1));
                $('#lblBalance').html(response.available_balance.substr(1));
                var payment_info = commonjs.hstoreParse(response.payment_info);
                // self.changePayerMode('', true, payment_info.payment_mode, paymentID);
                $("#txtCheque").val(payment_info.cheque_card_number);
                $("#txtCardName").val(payment_info.cheque_card_name);
                $("#ddlCardType").val(payment_info.credit_card_type);
                $("#txtCVN").val(payment_info.security_code);
                $("#paymentExpiryMonth").val(payment_info.credit_card_expiration_month);
                $("#paymentExpiryYear").val(payment_info.credit_card_expiration_year);
                $("#ddlpaymentReason").val(payment_info.reason)
                $("#txtNotes").val(response.notes)
                $("input:radio[name=payerMode][value=" + response.payment_mode + "]").prop("checked", true);
                $('#txtAccountingDate').val(moment(response.accounting_date).format('L'))

                self.payer_type = response.payer_type;
                self.payment_id = paymentID;
                self.patient_id = response.patient_id;
                self.payer_id = 303078;
                self.provider_id = response.provider_contact_id;
                self.provider_group_id = response.provider_group_id;
                self.insurance_provider_id = response.insurance_provider_id;

                self.showPendingPaymentsGrid(paymentID);
                self.showAppliedByPaymentsGrid(paymentID);
            },

            savePayment: function () {
                var self = this;
                var applied = 0;
                var balance = 0;
                var amount = $.trim($('#txtAmount').val().replace(',', ''));
                var amountValue = amount ? parseFloat(amount.replace(/[^0-9\.]+/g, "")).toFixed(2) : 0.00;
                var applied = $.trim($('#lblApplied').html());
                var appliedValue = applied ? parseFloat(applied.replace(/[^0-9\.]+/g, "")).toFixed(2) : 0.00;
                var balance = (parseFloat(amountValue).toFixed(2) - parseFloat(appliedValue).toFixed(2)) + 0.00;
                var totalbalance = balance ? parseFloat(balance).toFixed(2) : '0.00';
                this.model.set({
                    display_id: $.trim($('#referencePaymentID').val()) || 0,
                    paid_facility_id: $.trim($('#ddlPaidLocation').val()),
                    payer_type: $('input:radio[name=payertype]:checked').val(),
                    billing_office_id: $.trim($('#ddlBillingOffice').val()) ? $.trim($('#ddlBillingOffice').val()) : 0,
                    amount: $.trim($('#txtAmount').val().replace(',', '')),
                    applied: applied ? applied : 0.00,
                    available_balance: balance ? balance : 0.00,
                    is_refund: false,
                    payer: self.patient_id ? 'Patient' : self.provider_id ? 'Provider' : self.provider_group_id ? 'Ordering Facility' : 'Insurance',
                    payer_name: self.patient_id ? 'Patient' : self.provider_id ? 'Provider' : self.provider_group_id ? 'Ordering Facility' : 'Insurance',
                    current_status: 'UnApplied',
                    accounting_date: self.dtpAccountingDate && self.dtpAccountingDate.date() ? self.dtpAccountingDate.date().format('YYYY-MM-DD') : null,
                    patient_id: self.patient_id,
                    payer_id: self.payer_id,
                    provider_id: self.provider_id,
                    provider_group_id: self.provider_group_id,
                    credit_card_type: $("#ddlCardType").val(),
                    security_code: $("#txtCVN").val() || '',
                    credit_card_number: $("#txtCheque").val() || '',
                    credit_card_name: $("#txtCardName").val() || '',
                    payment_mode: $("input:radio[name=payerMode]:checked").val() ? $("input:radio[name=payerMode]:checked").val() : '',
                    reason: $("#ddlpaymentReason").val(),
                    is_copay: $("#ddlpaymentReason").attr('data-copay'),
                    user_name: app.userInfo.userFullName,
                    user_id: app.userID,
                    notes: ($("#txtNotes").val()).replace(/(\r\n|\n|\r)/gm, ""),
                    paymentId: self.payment_id,
                    insurance_provider_id: self.insurance_provider_id
                });
                this.model.save({
                }, {
                        success: function (model, response) {
                            alert('Payment has been updated successfully');
                        },
                        error: function (model, response) {
                            commonjs.handleXhrError(model, response);
                        }
                    });
            },

            showPendingPaymentsGrid: function (paymentID) {
                var self = this;
                this.pendPaymentTable = new customGrid();
                this.pendPaymentTable.render({
                    gridelementid: '#tblpendPaymentsGrid',
                    custompager: this.pendPaymtPager,
                    emptyMessage: 'No Record found',
                    colNames: ['', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
                    i18nNames: ['', '', '', '', '', 'billing.fileInsurance.claimNo', 'billing.fileInsurance.invoiceNo', 'billing.payments.patient', 'home.pendingStudies.studyDate', 'billing.payments.billFee', 'billing.payments.balance', 'order.summary.cptCodes', 'setup.studyFilters.accountNo', 'patient_id', 'facility_id'],
                    colModel: [
                        {
                            name: 'edit', width: 20, sortable: false, search: false,
                            className: 'icon-ic-edit',
                            formatter: function (a, b, c) {
                                return "<span class='icon-ic-edit' title='click Here to Edit'></span>"
                                // var url = "#app/payments/edit/" + b.rowId;
                                // return '<a href=' + url + '> Edit'
                            },
                            customAction: function (rowID, e) {
                                var gridData = $('#tblpendPaymentsGrid').jqGrid('getRowData', rowID);
                                self.order_payment_id = 0;
                                self.showApplyAndCas(rowID, paymentID);
                            }
                        },
                        {
                            name: 'claim_inquiry', width: 20, sortable: false, search: false,
                            className: 'icon-ic-raw-transctipt',
                            formatter: function () {
                                return "<span class='icon-ic-raw-transctipt' title='click Here to view Claim inquiry'></span>"
                            },
                            customAction: function (rowID, e) {
                                var gridData = $('#tblpendPaymentsGrid').jqGrid('getRowData', rowID);
                                commonjs.showDialog({ header: 'Claim Inquiry', i18nHeader: 'menuTitles.rightClickMenu.claimInquiry', onLoad: 'removeIframeHeader()', width: '85%', height: '75%', url: '/vieworder#patient/paymentDetails/' + gridData.order_id + '/' + gridData.patient_id });
                            }
                        },
                        { name: 'id', index: 'id', key: true, searchFlag: 'int', hidden: true },
                        { name: 'order_id', hidden: true },
                        { name: 'study_id', hidden: true },
                        { name: 'claim_id', searchColumn: ['orders.id'], searchFlag: '%' },
                        { name: 'invoice_no', searchFlag: '%', sortable: false },
                        { name: 'full_name', searchFlag: '%', searchColumn: ['patients.full_name'] },
                        { name: 'study_date', searchFlag: 'datetime', formatter: self.studyDateFormatter },
                        { name: 'billing_fee', searchFlag: 'int', formatter: self.billingFeeFormatter },
                        { name: 'balance', searchFlag: 'int', formatter: self.balanceFormatter },
                        { name: 'display_description', searchFlag: '%' },
                        { name: 'account_no', searchFlag: '%' },
                        { name: 'patient_id', key: true, hidden: true },
                        { name: 'facility_id', key: true, hidden: true },
                    ],
                    customizeSort: true,
                    sortable: {
                        exclude: ',#jqgh_tblpendPaymentsGrid_edit'
                    },
                    pager: '#gridPager_pendPayments',
                    sortname: "patients.full_name",
                    sortorder: "ASC",
                    caption: "Pending Payments",
                    datastore: self.pendingPayments,
                    container: this.el,
                    ondblClickRow: function (rowID) {
                        self.order_payment_id = 0;
                        var gridData = $('#tblpendPaymentsGrid').jqGrid('getRowData', rowID);
                        self.showApplyAndCas(rowID);
                    },
                    disablesearch: false,
                    disablesort: false,
                    disablepaging: false,
                    showcaption: false,
                    disableadd: true,
                    disablereload: true,
                    onbeforegridbind: self.updateCollection,
                    customargs: {
                        gridFlag: 'pendingPayments',
                        paymentID: paymentID,
                        payerId: self.payer_id,
                        payerType: self.payer_type
                    }
                });

                if (self.options.customargs) {
                    self.options.customargs.fromDate = null;
                    self.options.customargs.toDate = null;
                    self.options.customargs.facility_id = null;
                    self.options.customargs.payer_type = payerFlag;
                    self.options.customargs.payer_id = payer_id;
                    self.options.invoice_no = invoice_no ? invoice_no : 0
                }
            },

            showAppliedByPaymentsGrid: function (paymentID) {
                var self = this;
                this.appliedPaymentTable = new customGrid();
                this.appliedPaymentTable.render({
                    gridelementid: '#tblAppliedPaymentsGrid',
                    custompager: this.appliedPager,
                    emptyMessage: 'No Record found',
                    colNames: ['', '', '', '', '', 'Order Payment Ref', '', '', '', '', '', '', '', '', '', '', '', '', ''],
                    i18nNames: ['', '', '', '', '', '', 'billing.fileInsurance.claimNo', 'billing.fileInsurance.invoiceNo', 'billing.payments.patient', 'home.pendingStudies.studyDate', 'billing.payments.billFee', 'billing.payments.patientPaid', 'billing.payments.payerPaid', 'billing.payments.adjustment', 'billing.payments.thisPayment', 'billing.payments.balance', 'billing.payments.cptCodes', 'patient_id', 'facility_id'],
                    colModel: [
                        {
                            name: 'edit', width: 20, sortable: false, search: false,
                            className: 'icon-ic-edit',
                            formatter: function (a, b, c) {
                                return "<span class='icon-ic-edit' title='click Here to Edit'></span>"
                                // var url = "#app/payments/edit/" + b.rowId;
                                // return '<a href=' + url + '> Edit'
                            },
                            customAction: function (rowID, e) {
                                var gridData = $('#tblAppliedPaymentsGrid').jqGrid('getRowData', rowID);
                                self.showApplyAndCas(rowID, paymentID);
                            }
                        },
                        {
                            name: 'claim_inquiry', width: 20, sortable: false, search: false,
                            className: 'icon-ic-raw-transctipt',
                            formatter: function () {
                                return "<span class='icon-ic-raw-transctipt' title='click Here to view Claim inquiry'></span>"
                            },
                            customAction: function (rowID, e) {
                                var gridData = $('#tblAppliedPaymentsGrid').jqGrid('getRowData', rowID);
                                commonjs.showDialog({ header: 'Claim Inquiry', i18nHeader: 'menuTitles.rightClickMenu.claimInquiry', onLoad: 'removeIframeHeader()', width: '85%', height: '75%', url: '/vieworder#patient/paymentDetails/' + gridData.order_id + '/' + gridData.patient_id });
                            }
                        },
                        { name: 'id', index: 'id', key: true, searchFlag: 'int', hidden: true },
                        { name: 'order_id', hidden: true },
                        { name: 'study_id', hidden: true },
                        { name: 'order_payment_ref', searchColumn: ['orders.id'], searchFlag: '%', width: 120 },
                        { name: 'order_id_grid', searchColumn: ['orders.id'], searchFlag: '%', width: 50 },
                        { name: 'invoice_no', searchFlag: '%', sortable: false, width: 50 },
                        { name: 'full_name', searchFlag: '%', searchColumn: ['patients.full_name'], width: 150 },
                        { name: 'study_date', searchFlag: 'datetime', formatter: self.studyDateFormatter, width: 200 },
                        { name: 'bill_fee', searchFlag: 'hstore', searchColumn: ['order_info->bill_fee'], formatter: self.appliedBillFeeFormatter, width: 80 },
                        { name: 'patient_paid', searchFlag: 'hstore', searchColumn: ['more_info->patient_paid'], formatter: self.appliedPatPaidFormatter, width: 80 },
                        { name: 'others_paid', searchFlag: 'hstore', searchColumn: ['more_info->payer_paid'], formatter: self.appliedPayerPaidFormatter, width: 80 },
                        { name: 'adjustment', searchFlag: 'hstore', searchColumn: ['order_info->adjustment'], formatter: self.appliedAdjustmentFormatter, width: 80 },
                        { name: 'amount_paid', searchFlag: 'money', formatter: self.paymentApplied, width: 80 },
                        { name: 'balance', searchFlag: 'hstore', searchColumn: ['order_info->balance'], formatter: self.appliedBalanceFormatter, width: 80 },
                        { name: 'display_description', search: false, searchFlag: '%', width: 200 },
                        { name: 'patient_id', key: true, hidden: true },
                        { name: 'facility_id', key: true, hidden: true }

                    ],
                    customizeSort: true,
                    sortable: {
                        exclude: ',#jqgh_tblAppliedPaymentsGrid_edit'
                    },
                    pager: '#gridPager_appliedPayments',
                    sortname: "full_name",
                    sortorder: "ASC",
                    caption: "Applied Payments",
                    datastore: self.appliedPayments,
                    container: this.el,
                    ondblClickRow: function (rowID) {
                        var gridData = $('#tblAppliedPaymentsGrid').jqGrid('getRowData', rowID);
                        self.showApplyAndCas(rowID, paymentID);
                    },
                    disablesearch: false,
                    disablesort: false,
                    disablepaging: false,
                    showcaption: false,
                    disableadd: true,
                    disablereload: true,
                    customargs: {
                        gridFlag: 'appliedPayments',
                        paymentID: paymentID,
                        payerId: self.payer_id,
                        payerType: self.payer_type
                    }
                });
            },

            showApplyAndCas: function (claimId, paymentID) {
                var self = this;
                self.defalutCASArray = [0, 1, 2, 3, 4, 5, 6];
                $('<div/>').css({ top: '10%', height: '80%', "left": '5%', "overflow": "auto", "width": "90%", "left": "5%", "position": "absolute", 'border': '1px solid black', 'background-color': 'white' })
                    .appendTo('body')
                    .attr('id', 'divPaymentApply')
                    .html(self.applyCasTemplate({ 'casArray': self.defalutCASArray, adjustmentCodes: self.adjustmentCodeList.toJSON(), 'claimStatusList': this.claimStatusList.toJSON() }));
                commonjs.processPostRender();
            
                $('#btnCloseAppliedPendingPayments,#btnCloseApplyPaymentPopup').unbind().bind('click', function (e) {
                    $('#divPaymentApply').remove();
                    $('#siteModal').hide();
                });
                self.getClaimBasedCharges(claimId, paymentID);
            },

            getClaimBasedCharges: function (claimId, payment_id) {
                var self = this;
                self.casSave = [];
                $.ajax({
                    url: '/exa_modules/billing/pending_payments/getClaimBasedCharges',
                    type: 'GET',
                    data: {
                        claimId: claimId
                    },
                    success: function (data, response) {
                        var payments = data;
                        $.each(payments, function (index, payment) {
                            var paymentDet = {}
                            paymentDet.index = index;
                            paymentDet.payment_reconciliations_id = payment.payment_reconciliations_id ? payment.payment_reconciliations_id : null;
                            paymentDet.study_id = payment.study_id ? payment.study_id : null;
                            paymentDet.payment_id = payment_id;
                            // paymentDet.order_id = order_id;
                            paymentDet.study_cpt_id = payment.study_cpt_id ? payment.study_cpt_id : null;
                            paymentDet.cpt_code_id = payment.cpt_code_id ? payment.cpt_code_id : null;
                            // paymentDet.scheduled_dt = scheduled_date;
                            paymentDet.cpt_code = payment.cpt_code;
                            paymentDet.cpt_description = payment.cpt_description;
                            paymentDet.payment_amount = payment.current_payment ? parseFloat(payment.current_payment).toFixed(2) : 0.00;
                            paymentDet.other_payment = payment.other_payment && !isNaN(payment.other_payment) ? parseFloat(payment.other_payment).toFixed(2) : 0.00;
                            paymentDet.other_adjustment = payment.other_adjustment && !isNaN(payment.other_adjustment) ? parseFloat(payment.other_adjustment).toFixed(2) : 0.00;
                            paymentDet.adjustment = payment.current_adj ? parseFloat(payment.current_adj).toFixed(2) : 0.0;
                            paymentDet.bill_fee = payment.bill_fee ? parseFloat(payment.bill_fee).toFixed(2) : 0.00
                            paymentDet.allowed_fee = 0.00;
                            var balance = parseFloat(paymentDet.bill_fee) - (parseFloat(paymentDet.other_payment) + parseFloat(paymentDet.other_adjustment) + parseFloat(paymentDet.adjustment) + parseFloat(paymentDet.payment_amount)).toFixed(2);
                            paymentDet.balance = parseFloat(balance).toFixed(2);
                            var applyPaymentRow = self.applyPaymentTemplate({ payment: paymentDet });
                            $('#tBodyApplyPendingPayment').append(applyPaymentRow);
                            $('.this_pay,.this_adjustment').unbind().blur(function (e) {
                                self.updatePaymentAdjustment();
                            });
                            $('.this_allowed').unbind().blur(function (e) {
                                self.calculateAdjustment(e)
                            });
                            var cas_arr_obj = [];
                            var cas_arr_obj = payment.cas_arr_obj ? JSON.parse(payment.cas_arr_obj) : [];
                            self.casSave[index] = cas_arr_obj;
                        });
                    },
                    error: function (err, response) {

                    }
                });
            },

            applyPaymentsCAS: function () {
                
            }
        });
    });