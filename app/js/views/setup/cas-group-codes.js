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
            events: {
                'click #btnAddCasGroupCode' : 'addNewCasGroupCodes',
                'click #btnSaveCasGroupCode' : 'saveCasGroupCodes',
                'click #btnBackToCasGroupCode': 'backToCasGroupCodeGrid',
                'click #btnRefresh' : 'refreshCasGroupCodeGrid'

            },
            initialize: function (options) {
                var self = this;
                this.options = options;
                this.model = new CasGroupCodesModel();
                this.casGroupCodesList = new CasGroupCodesCollections();
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
                    colNames: ['','','','','',''],
                    i18nNames: ['', '', '', 'setup.common.code', 'setup.common.name', 'setup.common.description'],
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
                            width: 50,
                            sortable: false,
                            search: false,
                            className:'icon-ic-edit',
                            route: '#setup/cas_group_codes/edit/',
                            formatter: function(e, model, data) {
                                return `<span>Edit</span>`;
                            },
                            cellattr: function() {
                                return 'style=text-align:center;text-decoration: underline;cursor:pointer;'
                            }
                        },
                        {
                            name: 'del', width: 50, sortable: false, search: false,
                            className: 'icon-ic-delete',
                            customAction: function (rowID) {
                                if (confirm("Are you sure want to delete")) {
                                    var gridData = $('#tblCasGroupCodesGrid').jqGrid('getRowData', rowID);
                                    self.model.set({ "id": rowID });
                                    self.model.destroy({
                                        data: $.param({ id: self.model.id, code: gridData.code, description: gridData.description, name: gridData.name }),
                                        success: function (model, response) {
                                            self.casGroupCodesTable.refresh();
                                        },
                                        error: function (model, response) {
                                            
                                        }
                                    });
                                }
                            },
                            formatter: function(e, model, data) {
                                return `<span>Delete</span>`;
                            },
                            cellattr: function() {
                                return 'style=text-align:center;text-decoration: underline;cursor:pointer;';
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
                        }
                    ],
                    datastore: self.casGroupCodesList,
                    container:self.el,
                    customizeSort: true,
                    offsetHeight: 01,
                    sortable: {
                        exclude: '#jqgh_tblCasGroupCodesGrid,#jqgh_tblCasGroupCodesGrid_edit,#jqgh_tblCasGroupCodesGrid_del'
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

            renderForm: function(id) {
                $('#divCasGroupCodesForm').html(this.casGroupCodesFormTemplate());
                if(id > 0) {
                    this.model.set({id: id});
                    this.model.fetch({
                        data: { id: this.model.id},
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
            },

            saveCasGroupCodes: function() {
                this.model.set({
                    "code": $.trim($('#txtCode').val()),
                    "description": $.trim($('#txtDescription').val()),
                    "name": $.trim($('#txtName').val()),
                    "is_active" : !$('#chkActive').prop('checked'),
                    "company_id" : app.companyID
                });
                this.model.save({
                }, {
                    success: function (model, response) {
                        if(response) {
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



