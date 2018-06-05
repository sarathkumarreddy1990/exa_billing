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
            events: {
                'click #btnAddProviderIdCodeQualifiers': 'addNewProviderIdCodeQualifiers',
                'click #btnSaveProviderIdCodeQualifiers': 'saveProviderIdCodeQualifiers',
                'click #btnBackToProviderIdCodeQualifiers': 'backToProviderIdCodeQualifiersGrid',
                'click #btnProviderIdCodeQualifiersRefresh': 'refreshProviderIdCodeQualifiersGrid'
            },

            initialize: function (options) {
                var self = this;
                this.options = options;
                this.model = new ProviderIdCodeQualifiersModel();
                this.providerIdCodeQualifiersList = new ProviderIdCodeQualifiersCollections();
            },

            render: function () {
                var self = this;
                $('#divProviderIdCodeQualifiersGrid').show();
                $('#divProviderIdCodeQualifiersForm').hide();
                $(this.el).html(this.providerIdCodeQualifiersGridTemplate());
                this.providerIdCodeQualifiersTable = new customGrid();
                this.providerIdCodeQualifiersTable.render({
                    gridelementid: '#tblProviderIdCodeQualifiersGrid',
                    custompager: new Pager(),
                    emptyMessage: 'No Record found',
                    colNames: ['', '', '', '', ''],
                    i18nNames: ['', '', '',  'setup.providerIdCodeQualifiers.qualifierCode', 'setup.common.description'],
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
                            route: '#setup/provider_id_code_qualifiers/edit/',
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
                                    var gridData = $('#tblProviderIdCodeQualifiersGrid').jqGrid('getRowData', rowID);
                                    self.model.set({ "id": rowID });
                                    self.model.destroy({
                                        data: $.param({ id: self.model.id}),
                                        success: function (model, response) {
                                            self.providerIdCodeQualifiersTable.refresh();
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
                            name: 'qualifier_code',
                            width: 180
                        },
                        {
                            name: 'description',
                            width: 180
                        }
                    ],
                    datastore: self.providerIdCodeQualifiersList,
                    container: self.el,
                    customizeSort: true,
                    offsetHeight: 01,
                    sortable: {
                        exclude: '#jqgh_tblProviderIdCodeQualifiersGrid,#jqgh_tblProviderIdCodeQualifiersGrid_edit,#jqgh_tblProviderIdCodeQualifiersGrid_del'
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
                $('#divProviderIdCodeQualifiersForm').html(this.providerIdCodeQualifiersFormTemplate());
                if (id > 0) {
                    this.model.set({id: id});
                    this.model.fetch({
                        data: { id: this.model.id},
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
                $('#divProviderIdCodeQualifiersGrid').hide();
                $('#divProviderIdCodeQualifiersForm').show();
                commonjs.processPostRender();
            },

            addNewProviderIdCodeQualifiers: function () {
                location.href = "#setup/provider_id_code_qualifiers/new";
            },

            backToProviderIdCodeQualifiersGrid: function () {
                location.href = "#setup/provider_id_code_qualifiers/list";
            },

            refreshProviderIdCodeQualifiersGrid: function () {
                this.providerIdCodeQualifiersTable.refresh();
            },

            saveProviderIdCodeQualifiers: function () {
                this.model.set({
                    "code": $.trim($('#txtQualifierCode').val()),
                    "description": $.trim($('#txtDescription').val()),
                    "is_active": $('#chkActive').prop('checked'),
                    "company_id" : app.companyID
                });
                this.model.save({

                }, {
                    success: function (model, response) {
                        if (response) {
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



