define(['jquery',
    'immutable',
    'underscore',
    'backbone',
    'jqgrid',
    'jqgridlocale',
    'text!templates/setup/billing-classes-grid.html',
    'text!templates/setup/billing-classes-form.html',
    'collections/setup/billing-classes',
    'models/setup/billing-classes',
    'models/pager'
],
    function ($,
              Immutable,
              _,
              Backbone,
              JGrid,
              JGridLocale,
              BillingClassesGrid,
              BillingClassesForm,
              BillingClassesCollections,
              BillingClassesModel,
              Pager
        ) {
        var billingClassesView = Backbone.View.extend({
            billingClassesGridTemplate: _.template(BillingClassesGrid),
            billingClassesFormTemplate: _.template(BillingClassesForm),
            billingClassesList : [],
            model: null,
            billingClassesTable :null,
            events: {
                'click #btnAddBillingClass' : 'addNewBillingClass',
                'click #btnSaveBillingClass' : 'saveBillingClass',
                'click #btnBackToBillingClasses': 'backToBillingClassesGrid',
                'click #btnRefresh' : 'refreshBillingClassesGrid'

            },
            initialize: function (options) {
                var self = this;
                this.options = options;
                this.model = new BillingClassesModel();
                this.billingClassesList = new BillingClassesCollections();
            },

            render: function() {
                var self = this;
                $('#divBillingClassesGrid').show();
                $('#divBillingClassesForm').hide();
                $(this.el).html(this.billingClassesGridTemplate());
                this.billingClassesTable = new customGrid();
                this.billingClassesTable.render({
                    gridelementid: '#tblBillingClassesGrid',
                    custompager: new Pager(),
                    emptyMessage: 'No Record found',
                    colNames: ['','','','',''],
                    i18nNames: ['', '', '', 'setup.common.code', 'setup.common.description'],
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
                            route: '#setup/billing_classes/edit/',
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
                                    var gridData = $('#tblBillingClassesGrid').jqGrid('getRowData', rowID);
                                    self.model.set({ "id": rowID });
                                    self.model.destroy({
                                        data: $.param({ id: self.model.id, code: gridData.code, description: gridData.description }),
                                        success: function (model, response) {
                                            self.billingClassesTable.refresh();
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
                            name: 'description',
                            width: 180
                        }
                    ],
                    datastore: self.billingClassesList,
                    container:self.el,
                    customizeSort: true,
                    offsetHeight: 01,
                    sortname: "id",
                    sortorder: "desc",
                    sortable: {
                        exclude: '#jqgh_tblBillingClassesGrid,#jqgh_tblBillingClassesGrid_edit,#jqgh_tblBillingClassesGrid_del'
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
                $('#divBillingClassesForm').html(this.billingClassesFormTemplate());
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
                                    $('#chkActive').prop('checked', data.inactivated_dt ? true : false);
                                }
                            }
                        }
                    });
                } else {
                    this.model = new BillingClassesModel();

                }
                $('#divBillingClassesGrid').hide();
                $('#divBillingClassesForm').show();
                commonjs.processPostRender();
            },

            addNewBillingClass: function() {
                location.href = "#setup/billing_classes/new";
            },

            backToBillingClassesGrid: function() {
                location.href = "#setup/billing_classes/list";
            },

            refreshBillingClassesGrid: function() {
                this.billingClassesTable.refresh();
            },

            saveBillingClass: function() {
                this.model.set({
                    "code": $.trim($('#txtCode').val()),
                    "description": $.trim($('#txtDescription').val()),
                    "isActive" : !$('#chkActive').prop('checked'),
                    "companyId" : app.companyID
                });
                this.model.save({
                }, {
                    success: function (model, response) {
                        if(response) {
                            location.href = "#setup/billing_classes/list";
                        }
                    },
                    error: function (model, response) {
                        commonjs.handleXhrError(model, response);
                    }
                });
            }
        });
        return billingClassesView;
    });



