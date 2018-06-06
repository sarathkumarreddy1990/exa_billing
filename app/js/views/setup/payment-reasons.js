define([
    'jquery',
    'underscore',
    'backbone',
    'jqgrid',
    'jqgridlocale',
    'text!templates/setup/payment-reasons-grid.html',
    'text!templates/setup/payment-reasons-form.html',
    'collections/setup/payment-reasons',
    'models/setup/payment-reasons',
    'models/pager'
]
    , function ($, _, Backbone, JQGrid, JGridLocale, PaymentReasonsGrid, PaymentReasonsForm, PaymentReasonsCollections, PaymentReasonsModel, Pager) {
        var PaymentReasonsView = Backbone.View.extend({
            paymentReasonsGridTemplate: _.template(PaymentReasonsGrid),
            paymentReasonsFormTemplate: _.template(PaymentReasonsForm),
            paymentReasonsList: [],
            model: null,
            paymentReasonsTable: null,
            events: {
                'click #btnAddPaymentReasons': 'addNewPaymentReasons',
                'click #btnSavePaymentReasons': 'savePaymentReasons',
                'click #btnBackToPaymentReasons': 'backToPaymentReasonsGrid',
                'click #btnPaymentReasonsRefresh': 'refreshPaymentReasonsGrid'
            },

            initialize: function (options) {
                var self = this;
                this.options = options;
                this.model = new PaymentReasonsModel();
                this.paymentReasonsList = new PaymentReasonsCollections();
            },

            render: function () {
                var self = this;
                $('#divPaymentReasonsGrid').show();
                $('#divPaymentReasonsForm').hide();
                $(this.el).html(this.paymentReasonsGridTemplate());
                this.paymentReasonsTable = new customGrid();
                this.paymentReasonsTable.render({
                    gridelementid: '#tblPaymentReasonsGrid',
                    custompager: new Pager(),
                    emptyMessage: 'No Record found',
                    colNames: ['', '', '', '', ''],
                    i18nNames: ['', '', '', 'setup.paymentReasons.Reasons', 'setup.common.description'],
                    colModel: [
                        {
                            name: 'id',
                            index: 'id',
                            key: true,
                            hidden: true,
                            search: false
                        },
                        {
                            name: 'edit',
                            width: 50,
                            sortable: false,
                            search: false,
                            className: 'icon-ic-edit',
                            route: '#setup/payment_reasons/edit/',
                            formatter: function (e, model, data) {
                                return `<span>Edit</span>`;
                            },
                            cellattr: function () {
                                return 'style=text-align:center;text-decoration: underline;cursor:pointer;'
                            }
                        },
                        {
                            name: 'del', width: 50, sortable: false, search: false,
                            className: 'icon-ic-delete',
                            customAction: function (rowID) {
                                if (confirm("Are you sure want to delete")) {
                                    var gridData = $('#tblPaymentReasonsGrid').jqGrid('getRowData', rowID);
                                    self.model.set({ "id": rowID });
                                    self.model.destroy({
                                        data: $.param({ id: self.model.id, code: gridData.code, description: gridData.description, name: gridData.name }),
                                        success: function (model, response) {
                                            self.paymentReasonsTable.refresh();
                                        },
                                        error: function (model, response) {
                                        }
                                    });
                                }
                            },

                            formatter: function (e, model, data) {
                                return `<span>Delete</span>`;
                            },

                            cellattr: function () {
                                return 'style=text-align:center;text-decoration: underline;cursor:pointer;';
                            }
                        },
                        {
                            name: 'code',
                            width: 180
                        },
                        {
                            name: 'description',
                            width: 180
                        }
                    ],
                    datastore: self.paymentReasonsList,
                    container: self.el,
                    customizeSort: true,
                    offsetHeight: 01,
                    sortname: "id",
                    sortorder: "desc",
                    sortable: {
                        exclude: '#jqgh_tblPaymentReasonsGrid,#jqgh_tblPaymentReasonsGrid_edit,#jqgh_tblPaymentReasonsGrid_del'
                    },
                    dblClickActionIndex: 1,
                    disablesearch: false,
                    disablesort: false,
                    disablepaging: false,
                    showcaption: false,
                    disableadd: true,
                    disablereload: true
                });
            },

            showGrid: function () {
                this.render();
            },

            showForm: function (id) {
                var self = this;
                this.renderForm(id);
            },

            renderForm: function (id) {
                $('#divPaymentReasonsForm').html(this.paymentReasonsFormTemplate());
                if (id > 0) {
                    this.model.set({id: id});
                    this.model.fetch({
                        data: { id: this.model.id},
                        success: function (model, response) {
                            response = response[0];
                            if (response) {
                                $('#txtCode').val(response.code);
                                $('#txtDescription').val(response.description);
                                $('#chkActive').prop('checked', response.inactivated_dt ? true : false);
                            }
                        }
                    });
                } else {
                    this.model = new PaymentReasonsModel();
                }
                $('#divPaymentReasonsGrid').hide();
                $('#divPaymentReasonsForm').show();
                commonjs.processPostRender();
            },

            addNewPaymentReasons: function () {
                location.href = "#setup/payment_reasons/new";
            },

            backToPaymentReasonsGrid: function () {
                location.href = "#setup/payment_reasons/list";
            },

            refreshPaymentReasonsGrid: function () {
                this.paymentReasonsTable.refresh();
            },

            savePaymentReasons: function () {
                this.model.set({
                    "code": $.trim($('#txtCode').val()),
                    "description": $.trim($('#txtDescription').val()),
                    "isActive": !$('#chkActive').prop('checked'),
                    "company_id": app.companyID
                });
                this.model.save({

                }, {
                    success: function (model, response) {
                        if (response) {
                            location.href = "#setup/payment_reasons/list";
                        }
                    },
                    error: function (model, response) {
                        commonjs.handleXhrError(model, response);
                    }
                });
            }
        });
        return PaymentReasonsView;
    });


