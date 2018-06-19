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
                var self = this;
                this.options = options;
                this.model = new CasGroupCodesModel();
                this.casGroupCodesList = new CasGroupCodesCollections();
                this.pager = new Pager();
            },

            render: function() {
                var self = this;
                $('#divCasGroupCodesGrid').show();
                $('#divCasGroupCodesForm').hide();
                $(this.el).html(this.casGroupCodesGridTemplate());
                this.casGroupCodesTable = new customGrid();
                this.casGroupCodesTable.render({
                    gridelementid: '#tblCasGroupCodesGrid',
                    custompager: new Pager(),
                    emptyMessage: 'No Record found',
                    colNames: ['','','','','','', ''],
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
                            formatter: function (e, model, data) {
                                return "<span class='icon-ic-edit' title='click Here to Edit'></span>"
                            }
                        },
                        {
                            name: 'del', width: 20, sortable: false, search: false,
                            className: 'icon-ic-delete',
                            customAction: function (rowID) {
                                if (confirm("Are you sure want to delete")) {
                                    var gridData = $('#tblCasGroupCodesGrid').jqGrid('getRowData', rowID);
                                    self.model.destroy({
                                        data: $.param({ id: self.model.id }),
                                        success: function (model, response) {
                                            commonjs.showStatus("Deleted Successfully");
                                            self.casGroupCodesTable.refresh();
                                        },
                                        error: function (model, response) {
                                            commonjs.handleXhrError(model, response);
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
                    offsetHeight: 01,
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
                                    $('#chkActive').prop('checked', data.inactivated_dt ? true : false);
                                }
                            }
                        }
                    });
                } else {
                    this.model = new CasGroupCodesModel();

                }
                commonjs.initializeScreen({header: {screen: 'CasGroupCodes', ext: 'casGroupCodes'}, buttons: [
                    {value: 'Save', type: 'submit', class: 'btn btn-primary', i18n: 'shared.buttons.save', clickEvent: function () {
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
                commonjs.showStatus("Reloaded Successfully");
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
                        casGroupCode: commonjs.getMessage("*", "Cas Group Code"),
                        casGroupCodeName: commonjs.getMessage("*", "Cas Group Code Name"),
                        description: commonjs.getMessage("*", "Description")
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
                    "code": $.trim($('#txtCode').val()),
                    "description": $.trim($('#txtDescription').val()),
                    "name": $.trim($('#txtName').val()),
                    "isActive" : !$('#chkActive').prop('checked'),
                    "companyId" : app.companyID
                });
                this.model.save({
                }, {
                    success: function (model, response) {
                        if(response) {
                            commonjs.showStatus("Saved Successfully");
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



