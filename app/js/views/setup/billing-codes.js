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
            pager: null,
            events: { },
            initialize: function (options) {
                var self = this;
                this.options = options;
                this.model = new BillingCodesModel();
                this.billingCodesList = new BillingCodesCollections();
                this.pager = new Pager();
                $(this.el).html(this.billingCodesGridTemplate());
            },

            render: function() {
                var self = this;
                $('#divBillingCodesGrid').show();
                $('#divBillingCodesForm').hide();
                this.billingCodesTable = new customGrid();
                this.billingCodesTable.render({
                    gridelementid: '#tblBillingCodesGrid',
                    custompager: new Pager(),
                    emptyMessage: 'No Record found',
                    colNames: ['','','','','',''],
                    i18nNames: ['', '', '', 'setup.common.code', 'setup.common.description', 'is_active'],
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
                            route: '#setup/billing_codes/edit/',
                            formatter: function(e, model, data) {
                                return "<span class='icon-ic-edit' title='Edit'></span>"
                            }
                        },
                        {
                            name: 'del', width: 10, sortable: false, search: false,
                            className: 'icon-ic-delete',
                            customAction: function (rowID) {
                                if (confirm("Are you sure want to delete")) {
                                    var gridData = $('#tblBillingCodesGrid').jqGrid('getRowData', rowID);
                                    self.model.set({ "id": rowID });
                                    self.model.destroy({
                                        success: function (model, response) {
                                            commonjs.showStatus("Deleted Successfully");
                                            self.billingCodesTable.refresh();
                                        },
                                        error: function (model, response) {
                                            commonjs.handleXhrError(model, response);
                                        }
                                    });
                                }
                            },
                            formatter: function(e, model, data) {
                                return "<i class='icon-ic-delete' title='Click here to delete'></i>"
                            }
                        },
                        {
                            name: 'code'
                        },
                        {
                            name: 'description'
                        },
                        {
                            name: 'inactivated_dt',
                            hidden: true
                        }
                    ],
                    afterInsertRow: function (rowid, rowdata) {
                        if (rowdata.inactivated_dt) {
                            var $row = $('#tblBillingCodesGrid').find('#' + rowid);
                            $row.css('text-decoration', 'line-through');
                        }
                    },
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
                    disablereload: true,
                    pager: '#gridPager_BillingCodes'
                });

                commonjs.initializeScreen({header: {screen: 'BillingCodes', ext: 'billingCodes'}, grid: {id: '#tblBillingCodesGrid'}, buttons: [
                    {value: 'Add', class: 'btn btn-danger', i18n: 'shared.buttons.add', clickEvent: function () {
                        Backbone.history.navigate('#setup/billing_codes/new', true);
                    }},
                    {value: 'Reload', class: 'btn', i18n: 'shared.buttons.reload', clickEvent: function () {
                        self.pager.set({"PageNo": 1});
                        self.billingCodesTable.refreshAll();
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
                $('#divBillingCodesForm').html(this.billingCodesFormTemplate());
                if(id > 0) {
                    this.model.set({id: id});
                    this.model.fetch({
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

                commonjs.initializeScreen({header: {screen: 'BillingCodes', ext: 'billingCodes'}, buttons: [
                    {value: 'Save', type: 'submit', class: 'btn btn-primary', i18n: 'shared.buttons.save', clickEvent: function () {
                        $("#txtCode").val($.trim($('#txtCode').val()) || null);
                        $("#txtDescription").val($.trim($('#txtDescription').val()) || null);
                        self.saveBillingCodes();
                    }},
                    {value: 'Back', class: 'btn', i18n: 'shared.buttons.back', clickEvent: function () {
                        Backbone.history.navigate('#setup/billing_codes/list', true);
                    }}
                ]});

                $('#divBillingCodesGrid').hide();
                $('#divBillingCodesForm').show();
                commonjs.processPostRender();
            },

            saveBillingCodes: function() {
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
                        code: commonjs.getMessage("e", "Code"),
                        description: commonjs.getMessage("e", "Description")
                    },
                    submitHandler: function () {
                        self.save();
                    },
                    formID: '#formBillingCodes'
                });
                $('#formBillingCodes').submit();
            },

            save: function () {
                this.model.set({
                    "code": $('#txtCode').val(),
                    "description": $('#txtDescription').val(),
                    "isActive" : !$('#chkActive').prop('checked'),
                    "companyId" : app.companyID
                });
                this.model.save({
                }, {
                    success: function (model, response) {
                        if(response) {
                            commonjs.showStatus("Saved Successfully");
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



