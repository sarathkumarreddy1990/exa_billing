define([
    'jquery',
    'underscore',
    'backbone',
    'jqgrid',
    'jqgridlocale',
    'text!templates/setup/claim-status-grid.html',
    'text!templates/setup/claim-status-from.html',
    'collections/setup/claim-status',
    'models/setup/claim-status',
    'models/pager'
]
    , function ($, _, Backbone, JQGrid, JGridLocale, ClaimStatusGrid, ClaimStatusForm, ClaimStatusCollections, ClaimStatusModel, Pager) {
        var ClaimStatusView = Backbone.View.extend({
            claimStatusGridTemplate: _.template(ClaimStatusGrid),
            claimStatusFormTemplate: _.template(ClaimStatusForm),
            claimStatusList: [],
            model: null,
            claimStatusTable: null,
            pager: null,
            events: {
            },

            initialize: function (options) {
                var self = this;
                this.options = options;
                this.model = new ClaimStatusModel();
                this.pager = new Pager();
                this.claimStatusList = new ClaimStatusCollections();
            },

            render: function () {
                var self = this;
                $('#divClaimStatusGrid').show();
                $('#divClaimStatusForm').hide();
                $(this.el).html(this.claimStatusGridTemplate());
                this.claimStatusTable = new customGrid();
                this.claimStatusTable.render({
                    gridelementid: '#tblClaimStatusGrid',
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
                            route: '#setup/claim_status/edit/',
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
                                    var gridData = $('#tblClaimStatusGrid').jqGrid('getRowData', rowID);
                                    self.model.set({ "id": rowID });
                                    self.model.destroy({
                                        success: function (model, response) {
                                            commonjs.showStatus("Deleted Successfully");
                                            self.claimStatusTable.refresh();
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
                    datastore: self.claimStatusList,
                    container: self.el,
                    customizeSort: true,
                    offsetHeight: 01,
                    sortname: "id",
                    sortorder: "desc",
                    sortable: {
                        exclude: '#jqgh_tblClaimStatusGrid,#jqgh_tblClaimStatusGrid_edit,#jqgh_tblClaimStatusGrid_del'
                    },
                    dblClickActionIndex: 1,
                    disablesearch: false,
                    disablesort: false,
                    disablepaging: false,
                    showcaption: false,
                    disableadd: true,
                    disablereload: true,
                    pager: '#gridPager_ClaimStatus'
                });

                commonjs.initializeScreen({header: {screen: 'ClaimStatus', ext: 'claimStatus'}, grid: {id: '#tblClaimStatusGrid'}, buttons: [
                    {value: 'Add', class: 'btn btn-danger', i18n: 'shared.buttons.add', clickEvent: function () {
                        Backbone.history.navigate('#setup/claim_status/new', true);
                    }},
                    {value: 'Reload', class: 'btn', i18n: 'shared.buttons.reload', clickEvent: function () {
                        self.pager.set({"PageNo": 1});
                        self.claimStatusTable.refreshAll();
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
                $('#divClaimStatusForm').html(this.claimStatusFormTemplate());
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
                                $('#chkIsSystemStatus').prop('checked', response.is_system_status  ? true : false);
                            }
                        }
                    });
                } else {
                    this.model = new ClaimStatusModel();
                }
                commonjs.initializeScreen({header: {screen: 'ClaimStatus', ext: 'claimStatus'}, buttons: [
                    {value: 'Save', type: 'submit', class: 'btn btn-primary', i18n: 'shared.buttons.save', clickEvent: function () {
                        self.saveClaimStatus();
                    }},
                    {value: 'Back', class: 'btn', i18n: 'shared.buttons.back', clickEvent: function () {
                        Backbone.history.navigate('#setup/claim_status/list', true);
                    }}
                ]});

                $('#divClaimStatusGrid').hide();
                $('#divClaimStatusForm').show();
                commonjs.processPostRender();
            },

            saveClaimStatus: function() {
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
                        code: commonjs.getMessage("*", "Code"),
                        description: commonjs.getMessage("*", "Description")
                    },
                    submitHandler: function () {
                        self.save();
                    },
                    formID: '#formClaimStatus'
                });
                $('#formClaimStatus').submit();
            },

            save: function () {
                this.model.set({
                    "code": $.trim($('#txtCode').val()),
                    "description": $.trim($('#txtDescription').val()),
                    "isActive": !$('#chkActive').prop('checked'),
                    "isSystemStatus" : $('#chkIsSystemStatus').prop('checked') ,
                    "company_id": app.companyID
                });
                this.model.save({
                }, {
                    success: function (model, response) {
                        if(response) {
                            commonjs.showStatus("Saved Successfully");
                            location.href = "#setup/claim_status/list";
                        }
                    },
                    error: function (model, response) {
                        commonjs.handleXhrError(model, response);
                    }
                });
            }
        });
        return ClaimStatusView;
    });
