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
            entryType: { "": "All", "credit": "Credit", "debit": "Debit" },
            events: {
            },

            initialize: function (options) {
                var self = this;
                this.options = options;
                this.model = new AdjustmentCodesModel();
                this.pager = new Pager();
                this.adjustmentCodesList = new AdjustmentCodesCollections();
            },

            render: function () {
                var self = this;
                $('#divAdjustmentCodesGrid').show();
                $('#divAdjustmentCodesForm').hide();
                $(this.el).html(this.adjustmentCodesGridTemplate());
                this.adjustmentCodesTable = new customGrid();
                this.adjustmentCodesTable.render({
                    gridelementid: '#tblAdjustmentCodesGrid',
                    custompager: new Pager(),
                    emptyMessage: 'No Record found',
                    colNames: ['', '', '', '', '', ''],
                    i18nNames: ['', '', '', 'setup.common.code', 'setup.common.description', 'setup.adjustmentcodes.entryType'],
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
                            width: 20,
                            sortable: false,
                            search: false,
                            className: 'icon-ic-edit',
                            route: '#setup/adjustment_codes/edit/',
                            formatter: function (e, model, data) {
                                return "<span class='icon-ic-edit' title='click Here to Edit'></span>"
                            }
                        },
                        {
                            name: 'del', width: 20, sortable: false, search: false,
                            className: 'icon-ic-delete',
                            customAction: function (rowID) {
                                if (confirm("Are you sure want to delete")) {
                                    var gridData = $('#tblAdjustmentCodesGrid').jqGrid('getRowData', rowID);
                                    self.model.set({ "id": rowID });
                                    self.model.destroy({
                                        success: function (model, response) {
                                            commonjs.showStatus("Deleted Successfully");
                                            self.adjustmentCodesTable.refresh();
                                        },
                                        error: function (model, response) {

                                        }
                                    });
                                }
                            },
                            formatter: function (e, model, data) {
                                return "<span class='icon-ic-delete' title='click Here to Delete'></span>"
                            }
                        },
                        {
                            name: 'code',
                            width: 180,
                            searchFlag: '%'
                        },
                        {
                            name: 'description',
                            width: 180,
                            searchFlag: '%'
                        },
                        {
                            name: 'accounting_entry_type',
                            searchFlag: '%',
                            stype: 'select',
                            formatter: self.entryTypeFormatter,
                            sortable: false,
                            searchoptions: {
                                value: self.entryType
                            },
                            width: 180
                        }
                    ],
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
                $('#divAdjustmentCodesForm').html(this.adjustmentCodesFormTemplate());
                if (id > 0) {
                    this.model.set({ id: id });
                    this.model.fetch({
                        success: function (model, response) {
                            if (response && response.length > 0) {
                                var data = response[0];
                                if (data) {
                                    $('#txtCode').val(data.code ? data.code : '');
                                    $('#txtDescription').val(data.description ? data.description : '');
                                    $('#ddlEntryType').val(data.accounting_entry_type ? data.accounting_entry_type : '');
                                    $('#chkActive').prop('checked', data.inactivated_dt ? true : false);
                                }
                            }
                        }
                    });
                } else {
                    this.model = new AdjustmentCodesModel();
                }

                commonjs.initializeScreen({header: {screen: 'AdjustmentCodes', ext: 'adjustmentCode'}, buttons: [
                    {value: 'Save', type: 'submit', class: 'btn btn-primary', i18n: 'shared.buttons.save', clickEvent: function () {
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
                        adjustmentCode: commonjs.getMessage("*", "Adjustment Code"),
                        description: commonjs.getMessage("*", "Description"),
                        entryType: commonjs.getMessage("*", "Accouting Entry Type")
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
                    "code": $.trim($('#txtCode').val()),
                    "description": $.trim($('#txtDescription').val()),
                    "isActive": !$('#chkActive').prop('checked'),
                    "type": $('#ddlEntryType').val(),
                    "companyId": app.companyID
                });

                this.model.save({
                }, {
                        success: function (model, response) {
                            if (response) {
                                commonjs.showStatus("Saved Successfully");
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
                        default:
                            break;
                    }
                }
                return colName;
            }
        });
        return AdjustmentCodesView;
    });



