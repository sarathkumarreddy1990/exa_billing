define(['jquery',
    'underscore',
    'backbone',
    'jqgrid',
    'jqgridlocale',
    'models/pager',
    'text!templates/app/unapplied-payment.html',
    'collections/app/payments'],
function (
    $,
    _,
    Backbone,
    JGrid,
    JGridLocale,
    Pager,
    unappliedTemaplte,
    unappliedPaymentList
    ) {
    return Backbone.View.extend({
        el: null,
        pager: null,
        unappliedTemplate: _.template(unappliedTemaplte),

        initialize: function(options) {
            this.options = options;
            this.pager = new Pager();
            this.unappliedPaymentList = new unappliedPaymentList();
        },

        render: function (patientID) {
            this.rendered = true;
            commonjs.showNestedDialog({
                header: 'Unapplied Payments',
                width: '80%',
                height: '55%',
                html: this.unappliedTemplate()
            });
            this.bindGrid(patientID);
        },

        // showUnappliedPayment: function(patientID) {
        //     var self = this;

        //     if (!self.rendered)
        //         self.render();
            
                
        // },

        bindGrid: function (patientID) {

            var self = this;

            if (!self.gridLoaded) {
                self.paymentTable = new customGrid();
                self.paymentTable.render({
                    gridelementid: '#tblUnAppliedpaymentsGrid',
                    custompager: self.pager,
                    emptyMessage: 'No Record found',
                    colNames: [ '', '', '',  '', '', '', '', '', ''],
                    i18nNames: ['', 'billing.payments.paymentID', 'billing.payments.referencePaymentID', 'billing.payments.paymentDate', 'billing.payments.accountingDate', 'billing.payments.payertype', 'billing.payments.payerName', 'billing.payments.paymentAmount', 'billing.payments.balance'],
                    colModel: [
                        { name: 'id', index: 'id', key: true, searchFlag: 'int', hidden: true },
                        { name: 'payment_id', width: 100, search: false },
                        { name: 'display_id', width: 200, search: false  },
                        { name: 'payment_dt', width: 150, search: false, formatter: self.paymentDateFormatter },
                        { name: 'accounting_dt', width: 200, search: false , formatter: self.paymentAccountingDateFormatter },
                        { name: 'payer_type', width: 200, search: false , formatter: self.payerTypeFormatter },
                        { name: 'payer_name', width: 300 },
                        { name: 'amount', width: 150, search: false  },
                        { name: 'available_balance', width: 150, search: false  }
                    ],

                    datastore: self.unappliedPaymentList,
                    container: self.el,
                    cmTemplate: { sortable: false },
                    customizeSort: false,
                    sortname: "id",
                    sortorder: "desc",
                    dblClickActionIndex: 1,
                    disablesearch: true,
                    disablesort: false,
                    disablepaging: false,
                    showcaption: false,
                    disableadd: true,
                    disablereload: true,
                    customargs: {
                        patientID: patientID,
                        from: 'patient_claim'
                    },
                    pager: '#gridPager_UnAppliedpayments' 
                });
                setTimeout(function () {
                    $("#tblUnAppliedpaymentsGrid").setGridWidth($(".modal-body").width()-100);
                    $("#tblUnAppliedpaymentsGrid").setGridHeight(($(window).height() - 500));
                }, 200);
            }
            commonjs.initializeScreen({ header: { screen: 'Unapplied Payment', ext: 'Unapplied Payment' } });
            self.gridLoaded = true;
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
        }
    });
});