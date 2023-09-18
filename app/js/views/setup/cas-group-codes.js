define(['jquery',
    'immutable',
    'underscore',
    'backbone',
    'jqgrid',
    'jqgridlocale',
    'text!templates/setup/cas-group-codes-grid.html',
    'text!templates/setup/cas-group-codes-form.html',
    'collections/setup/cas-group-codes',
    'models/setup/cas-group-codes',
    'models/pager'
],
    function ($,
        Immutable,
        _,
        Backbone,
        JGrid,
        JGridLocale,
        CasGroupCodesGrid,
        CasGroupCodesForm,
        CasGroupCodesCollections,
        CasGroupCodesModel,
        Pager
    ) {
        var casGroupCodesView = Backbone.View.extend({
            casGroupCodesGridTemplate: _.template(CasGroupCodesGrid),
            casGroupCodesFormTemplate: _.template(CasGroupCodesForm),
            casGroupCodesList : [],
            model: null,
            casGroupCodesTable :null,
            pager: null,
            events: {
            },
            initialize: function (options) {
                this.options = options;
                this.model = new CasGroupCodesModel();
                this.casGroupCodesList = new CasGroupCodesCollections();
                this.pager = new Pager();
                $(this.el).html(this.casGroupCodesGridTemplate());
            },

            render: function() {
                var self = this;
                var confirmDelete = commonjs.geti18NString("messages.status.areYouSureWantToDelete");
                $('#divCasGroupCodesGrid').show();
                $('#divCasGroupCodesForm').hide();
                this.casGroupCodesTable = new customGrid();
                this.casGroupCodesTable.render({
                    gridelementid: '#tblCasGroupCodesGrid',
                    custompager: new Pager(),
                    emptyMessage: commonjs.geti18NString("messages.status.noRecordFound"),
                    colNames: ['', '', '', '', '', '', ''],
                    i18nNames: ['', '', '', 'setup.common.code', 'setup.common.name', 'setup.common.description', 'in_active'],
                    colModel: [
                        {
                            name: 'id',
                            index: 'id',
                            key:true,
                            hidden:true,
                            search:false
                        },
                        {
                            name: 'edit',
                            width: 20,
                            sortable: false,
                            search: false,
                            className: 'icon-ic-edit',
                            route: '#setup/cas_group_codes/edit/',
                            formatter: function () {
                                return "<i class='icon-ic-edit' i18nt='shared.buttons.edit'></i>"
                            }
                        },
                        {
                            name: 'del', width: 20, sortable: false, search: false,
                            className: 'icon-ic-delete',
                            customAction: function (rowID) {
                                if (confirm(confirmDelete)) {
                                    var gridData = $('#tblCasGroupCodesGrid').jqGrid('getRowData', rowID);
                                    self.model.set({ "id": rowID });
                                    self.model.destroy({
                                        data: $.param({code: gridData.code, description:gridData.description}),
                                        success: function () {
                                            commonjs.showStatus("messages.status.deletedSuccessfully");
                                            self.casGroupCodesTable.refresh();
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
                            name: 'code',
                             width: 180
                        },
                        {
                            name: 'name',
                             width: 180
                        },
                        {
                            name: 'description',
                             width: 180
                        },
                        {
                            name: 'inactivated_dt',
                            hidden: true
                        }
                    ],
                    afterInsertRow: function (rowid, rowdata) {
                        if (rowdata.inactivated_dt) {
                            var $row = $('#tblCasGroupCodesGrid').find('#' + rowid);
                            $row.css('text-decoration', 'line-through');
                        }
                    },
                    datastore: self.casGroupCodesList,
                    container:self.el,
                    customizeSort: true,
                    offsetHeight: 1,
                    sortname: "id",
                    sortorder: "desc",
                    sortable: {
                        exclude: '#jqgh_tblCasGroupCodesGrid,#jqgh_tblCasGroupCodesGrid_edit,#jqgh_tblCasGroupCodesGrid_del'
                    },
                    dblClickActionIndex: 1,
                    disablesearch: false,
                    disablesort: false,
                    disablepaging: false,
                    showcaption: false,
                    disableadd: true,
                    disablereload: true,
                    pager: '#gridPager_CasGroupCodes'
                });
                commonjs.initializeScreen({header: {screen: 'CasGroupCodes', ext: 'casGroupCodes'}, grid: {id: '#tblCasGroupCodesGrid'}, buttons: [
                    {value: 'Add', class: 'btn btn-danger', i18n: 'shared.buttons.add', clickEvent: function () {
                        Backbone.history.navigate('#setup/cas_group_codes/new', true);
                    }},
                    {value: 'Reload', class: 'btn', i18n: 'shared.buttons.reload', clickEvent: function () {
                        self.pager.set({"PageNo": 1});
                        self.casGroupCodesTable.refreshAll();
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

            renderForm: function(id) {
                var self = this;
                $('#divCasGroupCodesForm').html(this.casGroupCodesFormTemplate());
                if(id > 0) {
                    this.model.set({id: id});
                    this.model.fetch({
                        success: function (model, response) {
                            if (response && response.length > 0) {
                                var data = response[0];
                                if (data) {
                                    $('#txtCode').val(data.code ? data.code : '');
                                    $('#txtDescription').val(data.description ? data.description : '');
                                    $('#txtName').val(data.name ? data.name : '');
                                    $('#chkActive').prop('checked', !!data.inactivated_dt);
                                }
                            }
                        }
                    });
                } else {
                    this.model = new CasGroupCodesModel();

                }
                commonjs.initializeScreen({header: {screen: 'CasGroupCodes', ext: 'casGroupCodes'}, buttons: [
                    {value: 'Save', type: 'submit', class: 'btn btn-primary', i18n: 'shared.buttons.save', clickEvent: function () {
                        $("#txtCode").val($.trim($('#txtCode').val()) || null);
                        $("#txtDescription").val($.trim($('#txtDescription').val()) || null);
                        $("#txtName").val($.trim($('#txtName').val()) || null);
                        self.saveCasGroupCodes();
                    }},
                    {value: 'Back', class: 'btn', i18n: 'shared.buttons.back', clickEvent: function () {
                        Backbone.history.navigate('#setup/cas_group_codes/list', true);
                    }}
                ]});
                $('#divCasGroupCodesGrid').hide();
                $('#divCasGroupCodesForm').show();
                commonjs.processPostRender();
            },

            addNewCasGroupCodes: function() {
                location.href = "#setup/cas_group_codes/new";
            },

            backToCasGroupCodeGrid: function() {
                location.href = "#setup/cas_group_codes/list";
            },

            refreshCasGroupCodeGrid: function() {
                this.casGroupCodesTable.refresh();
                commonjs.showStatus("messages.status.reloadedSuccessfully");
            },

            saveCasGroupCodes: function () {
                var self = this;
                commonjs.validateForm({
                    rules: {
                        casGroupCode: {
                            required: true
                        },
                        casGroupCodeName: {
                            required: true
                        },
                        description: {
                            required: true
                        }
                    },
                    messages: {
                        casGroupCode: commonjs.getMessage("e", "Cas Group Code"),
                        casGroupCodeName: commonjs.getMessage("e", "Cas Group Code Name"),
                        description: commonjs.getMessage("e", "Description")
                    },
                    submitHandler: function () {
                        self.save();
                    },
                    formID: '#formCasGroupCodes'
                });
                $('#formCasGroupCodes').submit();
            },

            save: function() {
                this.model.set({
                    "code": $('#txtCode').val(),
                    "description": $('#txtDescription').val(),
                    "name": $('#txtName').val(),
                    "isActive" : !$('#chkActive').prop('checked'),
                    "companyId" : app.companyID
                });
                this.model.save({
                }, {
                    success: function (model, response) {
                        if(response) {
                            commonjs.showStatus('messages.status.savedSuccessfully');
                            location.href = "#setup/cas_group_codes/list";
                        }
                    },
                    error: function (model, response) {
                        commonjs.handleXhrError(model, response);
                    }
                });
            }
        });
        return casGroupCodesView;
    });



