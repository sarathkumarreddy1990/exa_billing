define(['jquery',
    'immutable',
    'underscore',
    'backbone',
    'jqgrid',
    'jqgridlocale',
    'text!templates/setup/billing-codes-grid.html',
    'text!templates/setup/billing-codes-form.html',
    'collections/setup/billing-codes',
    'models/setup/billing-codes',
    'models/pager'
],
    function ($,
              Immutable,
              _,
              Backbone,
              JGrid,
              JGridLocale,
              BillingCodesGrid,
              BillingCodesForm,
              BillingCodesCollections,
              BillingCodesModel,
              Pager
        ) {
        var billingCodesView = Backbone.View.extend({
            billingCodesGridTemplate: _.template(BillingCodesGrid),
            billingCodesFormTemplate: _.template(BillingCodesForm),
            billingCodesList : [],
            model: null,
            billingCodesTable :null,
            events: {
                'click #btnAddBillingCode' : 'addNewBillingCodes',
                'click #btnSaveBillingCode' : 'saveBillingCodes',
                'click #btnBackToBillingCode': 'backToBillingCodeGrid',
                'click #btnRefresh' : 'refreshBillingCodeGrid'

            },
            initialize: function (options) {
                var self = this;
                this.options = options;
                this.model = new BillingCodesModel();
                this.billingCodesList = new BillingCodesCollections();
            },

            render: function() {
                var self = this;
                $('#divBillingCodesGrid').show();
                $('#divBillingCodesForm').hide();
                $(this.el).html(this.billingCodesGridTemplate());
                this.billingCodesTable = new customGrid();
                this.billingCodesTable.render({
                    gridelementid: '#tblBillingCodesGrid',
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
                            route: '#setup/billing_codes/edit/',
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
                                    var gridData = $('#tblBillingCodesGrid').jqGrid('getRowData', rowID);
                                    self.model.set({ "id": rowID });
                                    self.model.destroy({
                                        data: $.param({ id: self.model.id, code: gridData.code, description: gridData.description }),
                                        success: function (model, response) {
                                            self.billingCodesTable.refresh();
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
                    datastore: self.billingCodesList,
                    container:self.el,
                    customizeSort: true,
                    offsetHeight: 01,
                    sortname: "id",
                    sortorder: "desc",
                    sortable: {
                        exclude: '#jqgh_tblBillingCodesGrid,#jqgh_tblBillingCodesGrid_edit,#jqgh_tblBillingCodesGrid_del'
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
                $('#divBillingCodesForm').html(this.billingCodesFormTemplate());
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
                    this.model = new BillingCodesModel();

                }
                $('#divBillingCodesGrid').hide();
                $('#divBillingCodesForm').show();
                commonjs.processPostRender();
            },

            addNewBillingCodes: function() {
                location.href = "#setup/billing_codes/new";
            },

            backToBillingCodeGrid: function() {
                location.href = "#setup/billing_codes/list";
            },

            refreshBillingCodeGrid: function() {
                this.billingCodesTable.refresh();
            },

            saveBillingCodes: function() {
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
                            location.href = "#setup/billing_codes/list";
                        }
                    },
                    error: function (model, response) {
                        commonjs.handleXhrError(model, response);
                    }
                });
            }
        });
        return billingCodesView;
    });



