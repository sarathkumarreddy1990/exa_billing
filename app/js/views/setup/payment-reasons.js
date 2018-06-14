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
            pager: null,
            events: {
            },

            initialize: function (options) {
                var self = this;
                this.options = options;
                this.model = new PaymentReasonsModel();
                this.pager = new Pager();
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
                    i18nNames: ['', '', '', 'setup.common.reasons', 'setup.common.description'],
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
                                return `<span class='icon-ic-edit' title='click Here to Edit'></span>`;
                            },
                            cellattr: function () {
                                return 'style=text-align:center;cursor:pointer;'
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
                                        success: function (model, response) {
                                            commonjs.showStatus("Deleted Successfully");
                                            self.paymentReasonsTable.refresh();
                                        },
                                        error: function (model, response) {
                                            commonjs.handleXhrError(model, response);
                                        }
                                    });
                                }
                            },

                            formatter: function (e, model, data) {
                                return `<span class='icon-ic-delete' title='click Here to Delete'></span>`;
                            },

                            cellattr: function () {
                                return 'style=text-align:center;cursor:pointer;';
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
                    disablereload: true,
                    pager: '#gridPager_PaymentReasons'
                });

                commonjs.initializeScreen({header: {screen: 'PaymentReasons', ext: 'paymentReasons'}, grid: {id: '#tblPaymentReasonsGrid'}, buttons: [
                    {value: 'Add', class: 'btn btn-danger', i18n: 'shared.buttons.add', clickEvent: function () {
                        Backbone.history.navigate('#setup/payment_reasons/new', true);
                    }},
                    {value: 'Reload', class: 'btn', i18n: 'shared.buttons.reload', clickEvent: function () {
                        self.pager.set({"PageNo": 1});
                        self.paymentReasonsTable.refreshAll();
                        commonjs.showStatus("Reloaded Successfully");
                    }}
                ]});
            },

            showGrid: function () {
                this.render();
            },

            showForm: function (id) {
                var self = this;
                this.renderForm(id);
            },

            renderForm: function (id) {
                var self=this;
                $('#divPaymentReasonsForm').html(this.paymentReasonsFormTemplate());
                if (id > 0) {
                    this.model.set({id: id});
                    this.model.fetch({
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
                commonjs.initializeScreen({header: {screen: 'PaymentReasons', ext: 'paymentReasons'}, buttons: [
                    {value: 'Save', type: 'submit', class: 'btn btn-primary', i18n: 'shared.buttons.save', clickEvent: function () {
                        self.savePaymentReasons();
                    }},
                    {value: 'Back', class: 'btn', i18n: 'shared.buttons.back', clickEvent: function () {
                        Backbone.history.navigate('#setup/payment_reasons/list', true);
                    }}
                ]});

                $('#divPaymentReasonsGrid').hide();
                $('#divPaymentReasonsForm').show();
                commonjs.processPostRender();
            },

            savePaymentReasons: function () {
                var self = this;
                commonjs.validateForm({
                    rules: {
                        name: {
                            required: true
                        },
                        description: {
                            required: true
                        }
                    },
                    messages: {
                        name: commonjs.getMessage("*", "Reason"),
                        description: commonjs.getMessage("*", "Description")
                    },
                    submitHandler: function () {
                        self.save();
                    },
                    formID: '#formPaymentReasons'
                });
                $('#formPaymentReasons').submit();
            },

            save: function() {
                this.model.set({
                    "code": $.trim($('#txtCode').val()),
                    "description": $.trim($('#txtDescription').val()),
                    "isActive": !$('#chkActive').prop('checked'),
                    "company_id": app.companyID
                });
                this.model.save({
                }, {
                    success: function (model, response) {
                        if(response) {
                            commonjs.showStatus("Saved Successfully");
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


