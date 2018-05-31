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
            events: {
                'click #btnAddCasReasonCode': 'addNewCasReasonCodes',
                'click #btnSaveCasReasonCodes': 'saveCasReasonCodes',
                'click #btnBackToCasReasonCodes': 'backToCasReasonCodeGrid',
                'click #btnCasReasonCodeRefresh': 'refreshCasReasonCodeGrid'
            },

            initialize: function (options) {
                var self = this;
                this.options = options;
                this.model = new CasReasonCodesModel();
                this.casReasonCodesList = new CasReasonCodesCollections();
            },

            render: function () {
                var self = this;
                $('#divCasReasonCodesGrid').show();
                $('#divCasReasonCodesForm').hide();
                $(this.el).html(this.casReasonCodesGridTemplate());
                this.casReasonCodesTable = new customGrid();
                this.casReasonCodesTable.render({
                    gridelementid: '#tblCasReasonCodesGrid',
                    custompager: new Pager(),
                    emptyMessage: 'No Record found',
                    colNames: ['', '', '', '', ''],
                    i18nNames: ['', '', '', 'setup.common.code', 'setup.common.description'],
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
                            route: '#setup/cas_group_codes/edit/',
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
                                    var gridData = $('#tblCasReasonCodesGrid').jqGrid('getRowData', rowID);
                                    self.model.set({ "id": rowID });
                                    self.model.destroy({
                                        data: $.param({ id: self.model.id, code: gridData.code, description: gridData.description, name: gridData.name }),
                                        success: function (model, response) {
                                            self.casReasonCodesTable.refresh();
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
                    datastore: self.casReasonCodesList,
                    container: self.el,
                    customizeSort: true,
                    offsetHeight: 01,
                    sortable: {
                        exclude: '#jqgh_tblCasReasonCodesGrid,#jqgh_tblCasReasonCodesGrid_edit,#jqgh_tblCasReasonCodesGrid_del'
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
                $('#divCasReasonCodesForm').html(this.casReasonCodesFormTemplate());
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
                    this.model = new CasReasonCodesModel();
                }
                $('#divCasReasonCodesGrid').hide();
                $('#divCasReasonCodesForm').show();
                commonjs.processPostRender();
            },

            addNewCasReasonCodes: function () {
                location.href = "#setup/cas_reason_codes/new";
            },

            backToCasReasonCodeGrid: function () {
                location.href = "#setup/cas_reason_codes/list";
            },

            refreshCasReasonCodeGrid: function () {
                this.casReasonCodesTable.refresh();
            },

            saveCasReasonCodes: function () {
                this.model.set({
                    "code": $.trim($('#txtCode').val()),
                    "description": $.trim($('#txtDescription').val()),
                    "is_active": $('#chkActive').prop('checked'),
                    "company_id" : app.companyID
                });
                this.model.save({

                }, {
                    success: function (model, response) {
                        if (response) {
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


