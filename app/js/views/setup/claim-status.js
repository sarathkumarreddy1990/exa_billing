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
                this.options = options;
                this.model = new ClaimStatusModel();
                this.pager = new Pager();
                this.claimStatusList = new ClaimStatusCollections();
                $(this.el).html(this.claimStatusGridTemplate());
            },

            render: function () {
                var self = this;
                var confirmDelete = commonjs.geti18NString("messages.status.areYouSureWantToDelete");
                $('#divClaimStatusGrid').show();
                $('#divClaimStatusForm').hide();
                this.claimStatusTable = new customGrid();
                this.claimStatusTable.render({
                    gridelementid: '#tblClaimStatusGrid',
                    custompager: new Pager(),
                    emptyMessage: commonjs.geti18NString("messages.status.noRecordFound"),
                    colNames: ['', '', '', '', '', '', ''],
                    i18nNames: ['', '', '', 'setup.common.code', 'setup.common.description', 'setup.common.displayOrder', 'in_active'],
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
                            route: '#setup/claim_status/edit/',
                            formatter: function () {
                                return "<i class='icon-ic-edit' i18nt='shared.buttons.edit'></i>"
                            }
                        },
                        {
                            name: 'del', width: 10, sortable: false, search: false,
                            className: 'icon-ic-delete',
                            customAction: function (rowID) {
                                if (confirm(confirmDelete)) {
                                    var gridData = $('#tblClaimStatusGrid').jqGrid('getRowData', rowID);
                                    self.model.set({ "id": rowID });
                                    self.model.destroy({
                                        data: $.param({code: gridData.code, description:gridData.description}),
                                        success: function () {
                                            commonjs.showStatus("messages.status.deletedSuccessfully");
                                            self.claimStatusTable.refresh();
                                        },
                                        error: function (model, response) {
                                            commonjs.handleXhrError(model, response);
                                        }
                                    });
                                }
                            },
                            formatter: function () {
                                return "<i class='icon-ic-delete' i18nt='messages.status.clickHereToDelete'></i>"
                            }
                        },
                        {
                            name: 'code'
                        },
                        {
                            name: 'description'
                        },
                        {
                            name: 'display_order',
                        },
                        {
                            name: 'inactivated_dt',
                            hidden: true
                        }
                    ],
                    afterInsertRow: function (rowid, rowdata) {
                        if (rowdata.inactivated_dt) {
                            var $row = $('#tblClaimStatusGrid').find('#' + rowid);
                            $row.css('text-decoration', 'line-through');
                        }
                        if (rowdata.is_system_status) {
                            $('#tblClaimStatusGrid').find('#' + rowid).find('[aria-describedby=tblClaimStatusGrid_del]>i').hide();
                        }
                    },
                    datastore: self.claimStatusList,
                    container: self.el,
                    customizeSort: true,
                    offsetHeight: 1,
                    sortname: "display_order",
                    sortorder: "asc",
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
                    pager: '#gridPager_ClaimStatus',
                    onaftergridbind: function () {
                        $('input[name=display_order]').addClass('integerbox');
                        commonjs.validateControls();
                    }

                });

                commonjs.initializeScreen({header: {screen: 'ClaimStatus', ext: 'claimStatus'}, grid: {id: '#tblClaimStatusGrid'}, buttons: [
                    {value: 'Add', class: 'btn btn-danger', i18n: 'shared.buttons.add', clickEvent: function () {
                        Backbone.history.navigate('#setup/claim_status/new', true);
                    }},
                    {value: 'Reload', class: 'btn', i18n: 'shared.buttons.reload', clickEvent: function () {
                        self.pager.set({"PageNo": 1});
                        self.claimStatusTable.refreshAll();
                        commonjs.showStatus("messages.status.reloadedSuccessfully");
                    }}
                ]});

            },

            showGrid: function () {
                this.render();
            },

            showForm: function (id) {
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
                                $('#txtDispOrder').val(response.display_order);
                                $('#chkActive').prop('checked', !!response.inactivated_dt);
                                $('#chkIsSystemStatus').prop('checked', !!response.is_system_status);
                                if (response.is_system_status) {
                                    $('#txtCode').attr('disabled', 'disabled');
                                    $('#chkActive').attr('disabled', 'disabled');
                                }
                            }
                        }
                    });
                } else {
                    this.model = new ClaimStatusModel();
                }
                commonjs.initializeScreen({header: {screen: 'ClaimStatus', ext: 'claimStatus'}, buttons: [
                    {value: 'Save', type: 'submit', class: 'btn btn-primary', i18n: 'shared.buttons.save', clickEvent: function () {
                        $("#txtCode").val($.trim($('#txtCode').val()) || null);
                        $("#txtDescription").val($.trim($('#txtDescription').val()) || null);
                        $('#txtDispOrder').val($.trim($('#txtDispOrder').val()) || null);
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
                        },
                        displayOrder: {
                            required: true
                        }
                    },
                    messages: {
                        code: commonjs.getMessage("e", "Code"),
                        description: commonjs.getMessage("e", "Description"),
                        displayOrder: commonjs.getMessage("e", "Display Order")
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
                    "code": $('#txtCode').val(),
                    "description": $('#txtDescription').val(),
                    "displayOrder" : $('#txtDispOrder').val(),
                    "isActive": !$('#chkActive').prop('checked'),
                    "isSystemStatus" : $('#chkIsSystemStatus').prop('checked'),
                    "company_id": app.companyID
                });
                this.model.save({
                }, {
                    success: function (model, response) {
                        if(response) {
                            commonjs.showStatus('messages.status.savedSuccessfully');
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
