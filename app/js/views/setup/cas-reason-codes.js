define([
    'jquery',
    'underscore',
    'backbone',
    'jqgrid',
    'jqgridlocale',
    'text!templates/setup/cas-reason-codes-grid.html',
    'text!templates/setup/cas-reason-codes-form.html',
    'collections/setup/cas-reason-codes',
    'models/setup/cas-reason-codes',
    'models/pager'
]
    , function ($, _, Backbone, JQGrid, JGridLocale, CasReasonCodesGrid, CasReasonCodesForm, CasReasonCodesCollections, CasReasonCodesModel, Pager) {
        var CasReasonCodesView = Backbone.View.extend({
            casReasonCodesGridTemplate: _.template(CasReasonCodesGrid),
            casReasonCodesFormTemplate: _.template(CasReasonCodesForm),
            casReasonCodesList: [],
            model: null,
            casReasonCodesTable: null,
            pager: null,
            events: {
            },

            initialize: function (options) {
                var self = this;
                this.options = options;
                this.model = new CasReasonCodesModel();
                this.pager = new Pager();
                this.casReasonCodesList = new CasReasonCodesCollections();
                $(this.el).html(this.casReasonCodesGridTemplate());
            },

            render: function () {
                var self = this;
                $('#divCasReasonCodesGrid').show();
                $('#divCasReasonCodesForm').hide();
                this.casReasonCodesTable = new customGrid();
                this.casReasonCodesTable.render({
                    gridelementid: '#tblCasReasonCodesGrid',
                    custompager: new Pager(),
                    emptyMessage: 'No Record found',
                    colNames: ['', '', '', '', '', ''],
                    i18nNames: ['', '', '', 'setup.common.code', 'setup.common.description', 'in_active'],
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
                            width: 10,
                            sortable: false,
                            search: false,
                            className: 'icon-ic-edit',
                            route: '#setup/cas_reason_codes/edit/',
                            formatter: function (e, model, data) {
                                return "<i class='icon-ic-edit' title='click Here to Edit'></i>";
                            }
                        },
                        {
                            name: 'del', width: 10, sortable: false, search: false,
                            className: 'icon-ic-delete',
                            customAction: function (rowID) {
                                if (confirm("Are you sure want to delete")) {
                                    var gridData = $('#tblCasReasonCodesGrid').jqGrid('getRowData', rowID);
                                    self.model.set({ "id": rowID });
                                    self.model.destroy({
                                        success: function (model, response) {
                                            commonjs.showStatus("Deleted Successfully");
                                            self.casReasonCodesTable.refresh();
                                        },
                                        error: function (model, response) {
                                            commonjs.handleXhrError(model, response);
                                        }
                                    });
                                }
                            },

                            formatter: function (e, model, data) {
                                return "<i class='icon-ic-delete' title='click Here to Delete'></i>";
                            }
                        },
                        {
                            name: 'code'
                        },
                        {
                            name: 'description'
                        },
                        {
                            name: 'inactivated_dt',
                            hidden: true
                        }
                    ],
                    afterInsertRow: function (rowid, rowdata) {
                        if (rowdata.inactivated_dt) {
                            var $row = $('#tblCasReasonCodesGrid').find('#' + rowid);
                            $row.css('text-decoration', 'line-through');
                        }
                    },
                    datastore: self.casReasonCodesList,
                    container: self.el,
                    customizeSort: true,
                    offsetHeight: 01,
                    sortname: "id",
                    sortorder: "desc",
                    sortable: {
                        exclude: '#jqgh_tblCasReasonCodesGrid,#jqgh_tblCasReasonCodesGrid_edit,#jqgh_tblCasReasonCodesGrid_del'
                    },
                    dblClickActionIndex: 1,
                    disablesearch: false,
                    disablesort: false,
                    disablepaging: false,
                    showcaption: false,
                    disableadd: true,
                    disablereload: true,
                    pager: '#gridPager_CasReasonCodes'
                });

                commonjs.initializeScreen({header: {screen: 'CasReasonCodes', ext: 'casReasonCodes'}, grid: {id: '#tblCasReasonCodesGrid'}, buttons: [
                    {value: 'Add', class: 'btn btn-danger', i18n: 'shared.buttons.add', clickEvent: function () {
                        Backbone.history.navigate('#setup/cas_reason_codes/new', true);
                    }},
                    {value: 'Reload', class: 'btn', i18n: 'shared.buttons.reload', clickEvent: function () {
                        self.pager.set({"PageNo": 1});
                        self.casReasonCodesTable.refreshAll();
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
                $('#divCasReasonCodesForm').html(this.casReasonCodesFormTemplate());
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
                    this.model = new CasReasonCodesModel();
                }
                commonjs.initializeScreen({header: {screen: 'CasReasonCodes', ext: 'casReasonCodes'}, buttons: [
                    {value: 'Save', type: 'submit', class: 'btn btn-primary', i18n: 'shared.buttons.save', clickEvent: function () {
                        $("#txtCode").val($.trim($('#txtCode').val()) || null);
                        $("#txtDescription").val($.trim($('#txtDescription').val()) || null);
                        self.saveCasReasonCodes();
                    }},
                    {value: 'Back', class: 'btn', i18n: 'shared.buttons.back', clickEvent: function () {
                        Backbone.history.navigate('#setup/cas_reason_codes/list', true);
                    }}
                ]});
                $('#divCasReasonCodesGrid').hide();
                $('#divCasReasonCodesForm').show();
                commonjs.processPostRender();
            },

            saveCasReasonCodes: function () {
                var self = this;
                commonjs.validateForm({
                    rules: {
                        code: {
                            required: true
                        },
                        description: {
                            required: true
                        }
                    },
                    messages: {
                        code: commonjs.getMessage("e", "Code"),
                        description: commonjs.getMessage("e", "Description")
                    },
                    submitHandler: function () {
                        self.save();
                    },
                    formID: '#formCasReasonCodes'
                });
                $('#formCasReasonCodes').submit();
            },

            save: function() {
                this.model.set({
                    "code": $('#txtCode').val(),
                    "description": $('#txtDescription').val(),
                    "isActive": !$('#chkActive').prop('checked'),
                    "company_id" : app.companyID
                });
                this.model.save({
                }, {
                    success: function (model, response) {
                        if(response) {
                            commonjs.showStatus("Saved Successfully");
                            location.href = "#setup/cas_reason_codes/list";
                        }
                    },
                    error: function (model, response) {
                        commonjs.handleXhrError(model, response);
                    }
                });
            }
        });
        return CasReasonCodesView;
    });


