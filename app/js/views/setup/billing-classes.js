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
            pager: null,
            events: { },
            initialize: function (options) {
                var self = this;
                this.options = options;
                this.model = new BillingClassesModel();
                this.pager = new Pager();
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
                            width: 10,
                            sortable: false,
                            search: false,
                            className:'icon-ic-edit',
                            route: '#setup/billing_classes/edit/',
                            formatter: function(e, model, data) {
                                return "<span class='icon-ic-edit' title='click here to Edit'></span>"
                            }
                        },
                        {
                            name: 'del', width: 10, sortable: false, search: false,
                            className: 'icon-ic-delete',
                            customAction: function (rowID) {
                                if (confirm("Are you sure want to delete")) {
                                    var gridData = $('#tblBillingClassesGrid').jqGrid('getRowData', rowID);
                                    self.model.set({ "id": rowID });
                                    self.model.destroy({
                                        data: $.param({ id: self.model.id, code: gridData.code, description: gridData.description }),
                                        success: function (model, response) {
                                            commonjs.showStatus("Deleted Successfully");
                                            self.billingClassesTable.refresh();
                                        },
                                        error: function (model, response) {
                                            commonjs.handleXhrError(model, response);
                                        }
                                    });
                                }
                            },
                            formatter: function(e, model, data) {
                                return "<span class='icon-ic-delete' title='click here to Delete'></span>"
                            }
                        },
                        {
                            name: 'code',
                        },
                        {
                            name: 'description',
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
                    disablereload: true,
                    pager: '#gridPager_BillingClasses'
                });

                commonjs.initializeScreen({header: {screen: 'BillingClasses', ext: 'billingClasses'}, grid: {id: '#tblBillingClassesGrid'}, buttons: [
                    {value: 'Add', class: 'btn btn-danger', i18n: 'shared.buttons.add', clickEvent: function () {
                        Backbone.history.navigate('#setup/billing_classes/new', true);
                    }},
                    {value: 'Reload', class: 'btn', i18n: 'shared.buttons.reload', clickEvent: function () {
                        self.pager.set({"PageNo": 1});
                        self.billingClassesTable.refreshAll();
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

                commonjs.initializeScreen({header: {screen: 'BillingClasses', ext: 'billingClasses'}, buttons: [
                    {value: 'Save', type: 'submit', class: 'btn btn-primary', i18n: 'shared.buttons.save', clickEvent: function () {
                        self.saveBillingClasses();
                    }},
                    {value: 'Back', class: 'btn', i18n: 'shared.buttons.back', clickEvent: function () {
                        Backbone.history.navigate('#setup/billing_classes/list', true);
                    }}
                ]});

                $('#divBillingClassesGrid').hide();
                $('#divBillingClassesForm').show();
                commonjs.processPostRender();
            },

            saveBillingClasses: function() {
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
                    formID: '#formBillingClasses'
                });
                $('#formBillingClasses').submit();
            },

            save: function () {
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
                            commonjs.showStatus("Saved Successfully");
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



