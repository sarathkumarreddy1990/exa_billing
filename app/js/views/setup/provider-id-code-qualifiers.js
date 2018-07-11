define([
    'jquery',
    'underscore',
    'backbone',
    'jqgrid',
    'jqgridlocale',
    'text!templates/setup/provider-id-code-qualifiers-grid.html',
    'text!templates/setup/provider-id-code-qualifiers-form.html',
    'collections/setup/provider-id-code-qualifiers',
    'models/setup/provider-id-code-qualifiers',
    'models/pager'
]
    , function ($, _, Backbone, JQGrid, JGridLocale, ProviderIdCodeQualifiersGrid, ProviderIdCodeQualifiersForm, ProviderIdCodeQualifiersCollections, ProviderIdCodeQualifiersModel, Pager) {
        var ProviderIdCodeQualifiersView = Backbone.View.extend({
            providerIdCodeQualifiersGridTemplate: _.template(ProviderIdCodeQualifiersGrid),
            providerIdCodeQualifiersFormTemplate: _.template(ProviderIdCodeQualifiersForm),
            providerIdCodeQualifiersList: [],
            model: null,
            providerIdCodeQualifiersTable: null,
            pager: null,
            events: {
            },

            initialize: function (options) {
                var self = this;
                this.options = options;
                this.model = new ProviderIdCodeQualifiersModel();
                this.pager = new Pager();
                this.providerIdCodeQualifiersList = new ProviderIdCodeQualifiersCollections();
                $(this.el).html(this.providerIdCodeQualifiersGridTemplate());
            },

            render: function () {
                var self = this;
                $('#divProviderIdCodeQualifiersGrid').show();
                $('#divProviderIdCodeQualifiersForm').hide();
                this.providerIdCodeQualifiersTable = new customGrid();
                this.providerIdCodeQualifiersTable.render({
                    gridelementid: '#tblProviderIdCodeQualifiersGrid',
                    custompager: new Pager(),
                    emptyMessage: 'No Record found',
                    colNames: ['', '', '', '', '', ''],
                    i18nNames: ['', '', '',  'setup.providerIdCodeQualifiers.qualifierCode', 'setup.common.description', 'in_active'],
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
                            route: '#setup/provider_id_code_qualifiers/edit/',
                            formatter: function (e, model, data) {
                                return "<i class='icon-ic-edit' title='Click here to edit'></i>"
                            }
                        },
                        {
                            name: 'del', width: 10, sortable: false, search: false,
                            className: 'icon-ic-delete',
                            customAction: function (rowID) {
                                if (confirm("Are you sure want to delete")) {
                                    var gridData = $('#tblProviderIdCodeQualifiersGrid').jqGrid('getRowData', rowID);
                                    self.model.set({ "id": rowID });
                                    self.model.destroy({
                                        success: function (model, response) {
                                            commonjs.showStatus("Deleted Successfully");
                                            self.providerIdCodeQualifiersTable.refresh();
                                        },
                                        error: function (model, response) {
                                            commonjs.handleXhrError(model, response);
                                        }
                                    });
                                }
                            },
                            formatter: function (e, model, data) {
                                return "<i class='icon-ic-delete' title='Click here to delete'></i>"
                            }
                        },
                        {
                            name: 'qualifier_code'
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
                            var $row = $('#tblProviderIdCodeQualifiersGrid').find('#' + rowid);
                            $row.css('text-decoration', 'line-through');
                        }
                    },
                    datastore: self.providerIdCodeQualifiersList,
                    container: self.el,
                    customizeSort: true,
                    offsetHeight: 01,
                    sortname: "id",
                    sortorder: "desc",
                    sortable: {
                        exclude: '#jqgh_tblProviderIdCodeQualifiersGrid,#jqgh_tblProviderIdCodeQualifiersGrid_edit,#jqgh_tblProviderIdCodeQualifiersGrid_del'
                    },
                    dblClickActionIndex: 1,
                    disablesearch: false,
                    disablesort: false,
                    disablepaging: false,
                    showcaption: false,
                    disableadd: true,
                    disablereload: true,
                    pager: '#gridPager_ProviderIdCodeQualifiers'
                });

                commonjs.initializeScreen({header: {screen: 'ProviderIdCodeQualifiers', ext: 'providerIdCodeQualifiers'}, grid: {id: '#tblProviderIdCodeQualifiersGrid'}, buttons: [
                    {value: 'Add', class: 'btn btn-danger', i18n: 'shared.buttons.add', clickEvent: function () {
                        Backbone.history.navigate('#setup/provider_id_code_qualifiers/new', true);
                    }},
                    {value: 'Reload', class: 'btn', i18n: 'shared.buttons.reload', clickEvent: function () {
                        self.pager.set({"PageNo": 1});
                        self.providerIdCodeQualifiersTable.refreshAll();
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
                $('#divProviderIdCodeQualifiersForm').html(this.providerIdCodeQualifiersFormTemplate());
                if (id > 0) {
                    this.model.set({id: id});
                    this.model.fetch({
                        success: function (model, response) {
                            response = response[0];
                            if (response) {
                                $('#txtQualifierCode').val(response.qualifier_code);
                                $('#txtDescription').val(response.description);
                                $('#chkActive').prop('checked', response.inactivated_dt ? true : false);
                            }
                        }
                    });
                } else {
                    this.model = new ProviderIdCodeQualifiersModel();
                }
                commonjs.initializeScreen({header: {screen: 'ProviderIdCodeQualifiers', ext: 'providerIdCodeQualifiers'}, buttons: [
                    {value: 'Save', type: 'submit', class: 'btn btn-primary', i18n: 'shared.buttons.save', clickEvent: function () {
                        $("#txtQualifierCode").val($.trim($('#txtQualifierCode').val()) || null);
                        $("#txtDescription").val($.trim($('#txtDescription').val()) || null);
                        self.saveProviderIdCodeQualifiers();
                    }},
                    {value: 'Back', class: 'btn', i18n: 'shared.buttons.back', clickEvent: function () {
                        Backbone.history.navigate('#setup/provider_id_code_qualifiers/list', true);
                    }}
                ]});
                $('#divProviderIdCodeQualifiersGrid').hide();
                $('#divProviderIdCodeQualifiersForm').show();
                commonjs.processPostRender();
            },

            saveProviderIdCodeQualifiers: function () {
                var self = this;
                commonjs.validateForm({
                    rules: {
                        qualifierCode: {
                            required: true
                        },
                        description: {
                            required: true
                        }
                    },
                    messages: {
                        qualifierCode: commonjs.getMessage("e", "Qualifier Code"),
                        description: commonjs.getMessage("e", "Description")
                    },
                    submitHandler: function () {
                        self.save();
                    },
                    formID: '#formProviderIdCodeQualifiers'
                });
                $('#formProviderIdCodeQualifiers').submit();
            },

            save: function() {
                this.model.set({
                    "code": $('#txtQualifierCode').val(),
                    "description": $('#txtDescription').val(),
                    "isActive": !($('#chkActive').prop('checked')),
                    "company_id" : app.companyID
                });
                this.model.save({
                }, {
                    success: function (model, response) {
                        if(response) {
                            commonjs.showStatus("Saved Successfully");
                            location.href = "#setup/provider_id_code_qualifiers/list";
                        }
                    },
                    error: function (model, response) {
                        commonjs.handleXhrError(model, response);
                    }
                });
            }
        });
        return ProviderIdCodeQualifiersView;
    });



