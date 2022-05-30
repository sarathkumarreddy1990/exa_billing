define(['jquery',
    'immutable',
    'underscore',
    'backbone',
    'jqgrid',
    'jqgridlocale',
    'text!templates/setup/adjustment-codes-grid.html',
    'text!templates/setup/adjustment-codes-form.html',
    'collections/setup/adjustment-codes',
    'models/setup/adjustment-codes',
    'models/pager'
],
    function ($,
        Immutable,
        _,
        Backbone,
        JGrid,
        JGridLocale,
        AdjustmentCodesGrid,
        AdjustmentCodesForm,
        AdjustmentCodesCollections,
        AdjustmentCodesModel,
        Pager
    ) {
        var AdjustmentCodesView = Backbone.View.extend({
            adjustmentCodesGridTemplate: _.template(AdjustmentCodesGrid),
            adjustmentCodesFormTemplate: _.template(AdjustmentCodesForm),
            adjustmentCodesList: [],
            model: null,
            adjustmentCodesTable: null,
            pager: null,
            entryType: { "": "All", "credit": "Credit", "debit": "Debit", "refund_debit": "Refund Debit", "recoupment_debit": "Recoupment Debit" },
            events: {
            },

            initialize: function (options) {
                var self = this;
                this.options = options;
                this.model = new AdjustmentCodesModel();
                this.pager = new Pager();
                this.adjustmentCodesList = new AdjustmentCodesCollections();
                $(this.el).html(this.adjustmentCodesGridTemplate());
            },

            render: function () {
                var self = this;
                var confirmDelete = commonjs.geti18NString("messages.status.areYouSureWantToDelete");
                $('#divAdjustmentCodesGrid').show();
                $('#divAdjustmentCodesForm').hide();
                this.adjustmentCodesTable = new customGrid();
                this.adjustmentCodesTable.render({
                    gridelementid: '#tblAdjustmentCodesGrid',
                    custompager: new Pager(),
                    emptyMessage: commonjs.geti18NString("messages.status.noRecordFound"),
                    colNames: ['', '', '', '', '', '', ''],
                    i18nNames: ['', '', '', 'setup.common.code', 'setup.common.description', 'setup.adjustmentCode.entryType', 'is_active'],
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
                            width: 15,
                            sortable: false,
                            search: false,
                            className: 'icon-ic-edit',
                            route: '#setup/adjustment_codes/edit/',
                            formatter: function (e, model, data) {
                                return "<i class='icon-ic-edit' i18nt='shared.buttons.edit'></i>"
                            }
                        },
                        {
                            name: 'del', width: 15, sortable: false, search: false,
                            className: 'icon-ic-delete',
                            customAction: function (rowID) {
                                if (confirm(confirmDelete)) {
                                    var gridData = $('#tblAdjustmentCodesGrid').jqGrid('getRowData', rowID);
                                    self.model.set({ "id": rowID });
                                    self.model.destroy({
                                        data: $.param({code: gridData.code, description:gridData.description}),
                                        success: function (model, response) {
                                            commonjs.showStatus("messages.status.deletedSuccessfully");
                                            self.adjustmentCodesTable.refresh();
                                        },
                                        error: function (model, response) {
                                            commonjs.handleXhrError(model, response);
                                        }
                                    });
                                }
                            },
                            formatter: function (e, model, data) {
                                return "<i class='icon-ic-delete' i18nt='messages.status.clickHereToDelete'></i>"
                            }
                        },
                        {
                            name: 'code',
                            searchFlag: '%'
                        },
                        {
                            name: 'description',
                            searchFlag: '%'
                        },
                        {
                            name: 'accounting_entry_type',
                            searchFlag: '%',
                            stype: 'select',
                            formatter: self.entryTypeFormatter,
                            searchoptions: {
                                value: self.entryType
                            },
                        },
                        {
                            name: 'inactivated_dt',
                            hidden: true
                        }
                    ],
                    afterInsertRow: function (rowId, rowData) {
                        var gridRow = $('#tblAdjustmentCodesGrid #' + rowId);

                        if (rowData.inactivated_dt) {
                            gridRow.css('text-decoration', 'line-through');
                        }

                        if (rowData.is_system_code) {
                            gridRow.find('.icon-ic-delete').hide();
                        }
                    },
                    datastore: self.adjustmentCodesList,
                    container: self.el,
                    customizeSort: true,
                    offsetHeight: 01,
                    sortname: "id",
                    sortorder: "desc",
                    sortable: {
                        exclude: '#jqgh_tblAdjustmentCodesGrid,#jqgh_tblAdjustmentCodesGrid_edit,#jqgh_tblAdjustmentCodesGrid_del'
                    },
                    dblClickActionIndex: 1,
                    disablesearch: false,
                    disablesort: false,
                    disablepaging: false,
                    showcaption: false,
                    disableadd: true,
                    disablereload: true,
                    pager: '#gridPager_AdjustmentCodes'
                });

                commonjs.initializeScreen({header: {screen: 'AdjustmentCodes', ext: 'adjustmentCodes'}, grid: {id: '#tblAdjustmentCodesGrid'}, buttons: [
                    {value: 'Add', class: 'btn btn-danger', i18n: 'shared.buttons.add', clickEvent: function () {
                        Backbone.history.navigate('#setup/adjustment_codes/new', true);
                    }},
                    {value: 'Reload', class: 'btn', i18n: 'shared.buttons.reload', clickEvent: function () {
                        self.pager.set({"PageNo": 1});
                        self.adjustmentCodesTable.refreshAll();
                        commonjs.showStatus('messages.status.reloadedSuccessfully');
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
                var self = this;
                $('#divAdjustmentCodesForm').html(this.adjustmentCodesFormTemplate());
                if (id > 0) {
                    this.model.set({ id: id });
                    this.model.fetch({
                        success: function (model, response) {
                            if (response && response.length > 0) {
                                var data = response[0];

                                if (data) {
                                    $('#txtCode').val(data.code || '');
                                    $('#txtDescription').val(data.description || '');
                                    $('#ddlEntryType').val(data.accounting_entry_type || '');
                                    $('#chkActive').prop('checked', data.inactivated_dt || false);
                                    $('#txtCode, #ddlEntryType, #chkActive').attr('disabled', data.is_system_code);
                                }
                            }
                        }
                    });
                } else {
                    this.model = new AdjustmentCodesModel();
                }

                commonjs.initializeScreen({header: {screen: 'AdjustmentCodes', ext: 'adjustmentCode'}, buttons: [
                    {value: 'Save', type: 'submit', class: 'btn btn-primary', i18n: 'shared.buttons.save', clickEvent: function () {
                        $("#txtCode").val($.trim($('#txtCode').val()) || null);
                        $("#txtDescription").val($.trim($('#txtDescription').val()) || null);
                        self.saveAdjustmentCodes();
                    }},
                    {value: 'Back', class: 'btn', i18n: 'shared.buttons.back', clickEvent: function () {
                        Backbone.history.navigate('#setup/adjustment_codes/list', true);
                    }}
                ]});
                $('#divAdjustmentCodesGrid').hide();
                $('#divAdjustmentCodesForm').show();
                commonjs.processPostRender();
            },

            saveAdjustmentCodes : function() {
                var self = this;
                commonjs.validateForm({
                    rules: {
                        adjustmentCode: {
                            required: true
                        },
                        description: {
                            required: true
                        },
                        entryType: {
                            required: true
                        }
                    },
                    messages: {
                        adjustmentCode: commonjs.getMessage("e", "Adjustment Code"),
                        description: commonjs.getMessage("e", "Description"),
                        entryType: commonjs.getMessage("*", "Accounting Entry Type")
                    },
                    submitHandler: function () {
                        self.save();
                    },
                    formID: '#formAdjustmentCodes'
                });
                $('#formAdjustmentCodes').submit();
            },

            save: function () {
                this.model.set({
                    "code": $('#txtCode').val(),
                    "description": $('#txtDescription').val(),
                    "isActive": !$('#chkActive').prop('checked'),
                    "type": $('#ddlEntryType').val(),
                    "companyId": app.companyID
                });

                this.model.save({
                }, {
                        success: function (model, response) {
                            if (response) {
                                commonjs.showStatus("messages.status.savedSuccessfully");
                                location.href = "#setup/adjustment_codes/list";
                            }
                        },
                        error: function (model, response) {
                            commonjs.handleXhrError(model, response);
                        }
                    });
            },

            entryTypeFormatter: function (cellvalue, options, rowObject) {
                var self = this;
                var colName = "";
                if (rowObject.accounting_entry_type != null) {
                    switch (rowObject.accounting_entry_type) {
                        case 'credit':
                            colName = 'Credit';
                            break;
                        case 'debit':
                            colName = 'Debit';
                            break;
                        case 'refund_debit':
                            colName = 'Refund Debit';
                            break;
                        case 'recoupment_debit':
                            colName = 'Recoupment Debit';
                            break;
                        default:
                            break;
                    }
                }
                return colName;
            }
        });
        return AdjustmentCodesView;
    });



