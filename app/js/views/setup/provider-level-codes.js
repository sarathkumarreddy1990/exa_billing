define(['jquery',
    'immutable',
    'underscore',
    'backbone',
    'jqgrid',
    'jqgridlocale',
    'text!templates/setup/provider-level-codes-grid.html',
    'text!templates/setup/provider-level-codes-form.html',
    'collections/setup/provider-level-codes',
    'models/setup/provider-level-codes',
    'models/pager'
],
    function ($,
              Immutable,
              _,
              Backbone,
              JGrid,
              JGridLocale,
              ProviderLevelCodesGrid,
              ProviderLevelCodesForm,
              ProviderLevelCodesCollections,
              ProviderLevelCodesModel,
              Pager
        ) {
        var providerLevelCodesView = Backbone.View.extend({
            providerLevelCodesGridTemplate: _.template(ProviderLevelCodesGrid),
            providerLevelCodesFormTemplate: _.template(ProviderLevelCodesForm),
            providerLevelCodesList : [],
            model: null,
            providerLevelCodesTable :null,
            events: {
                'click #btnAddProviderLevelCodes' : 'addNewProviderLevelCodes',
                'click #btnSaveProviderLevelCodes' : 'saveProviderLevelCodes',
                'click #btnBackToProviderLevelCodes': 'backToProviderLevelCodesGrid',
                'click #btnRefresh' : 'refreshProviderLevelCodesGrid'

            },
            initialize: function (options) {
                var self = this;
                this.options = options;
                this.model = new ProviderLevelCodesModel();
                this.providerLevelCodesList = new ProviderLevelCodesCollections();
            },

            render: function() {
                var self = this;
                $('#divProviderLevelCodesGrid').show();
                $('#divProviderLevelCodesForm').hide();
                $(this.el).html(this.providerLevelCodesGridTemplate());
                this.providerLevelCodesTable = new customGrid();
                this.providerLevelCodesTable.render({
                    gridelementid: '#tblProviderLevelCodesGrid',
                    custompager: new Pager(),
                    emptyMessage: 'No Record found',
                    colNames: ['','','','','',''],
                    i18nNames: ['', '', '', 'setup.common.code', 'setup.common.description', 'setup.common.readProvPercLvl'],
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
                            route: '#setup/provider_level_codes/edit/',
                            formatter: function (e, model, data) {
                                return "<span class='icon-ic-edit' title='click Here to Edit'></span>"
                            }
                        },
                        {
                            name: 'del', width: 20, sortable: false, search: false,
                            className: 'icon-ic-delete',
                            customAction: function (rowID) {
                                if (confirm("Are you sure want to delete")) {
                                    var gridData = $('#tblProviderLevelCodesGrid').jqGrid('getRowData', rowID);
                                    self.model.set({ "id": rowID });
                                    self.model.destroy({
                                        data: $.param({ id: self.model.id }),
                                        success: function (model, response) {
                                            commonjs.showStatus("Deleted Successfully");
                                            self.providerLevelCodesTable.refresh();
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
                            width: 180
                        },
                        {
                            name: 'description',
                            width: 180
                        },
                        {
                            name: 'reading_provider_percent_level',
                            width: 180
                        }
                    ],
                    datastore: self.providerLevelCodesList,
                    container:self.el,
                    customizeSort: true,
                    offsetHeight: 01,
                    sortable: {
                        exclude: '#jqgh_tblProviderLevelCodesGrid,#jqgh_tblProviderLevelCodesGrid_edit,#jqgh_tblProviderLevelCodesGrid_del'
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
                $('#divProviderLevelCodesForm').html(this.providerLevelCodesFormTemplate());
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
                                    $('#txtReadProvPercLvl').val(data.reading_provider_percent_level ? data.reading_provider_percent_level : 'none');
                                    $('#chkActive').prop('checked', data.inactivated_dt ? true : false);
                                }
                            }
                        }
                    });
                } else {
                    this.model = new ProviderLevelCodesModel();

                }
                $('#divProviderLevelCodesGrid').hide();
                $('#divProviderLevelCodesForm').show();
                commonjs.processPostRender();
            },

            addNewProviderLevelCodes: function() {
                location.href = "#setup/provider_level_codes/new";
            },

            backToProviderLevelCodesGrid: function() {
                location.href = "#setup/provider_level_codes/list";
            },

            refreshProviderLevelCodesGrid: function() {
                this.providerLevelCodesTable.refresh();
            },

            saveProviderLevelCodes: function() {
                this.model.set({
                    "company_id" : app.companyID,
                    "is_active" : !$('#chkActive').prop('checked'),
                    "code": $.trim($('#txtCode').val()),
                    "description": $.trim($('#txtDescription').val()),
                    "reading_provider_percent_level": $.trim($('#txtReadProvPercLvl').val())
                });
                this.model.save({
                }, {
                    success: function (model, response) {
                        if(response) {
                            location.href = "#setup/provider_level_codes/list";
                        }
                    },
                    error: function (model, response) {
                        commonjs.handleXhrError(model, response);
                    }
                });
            }
        });
        return providerLevelCodesView;
    });



