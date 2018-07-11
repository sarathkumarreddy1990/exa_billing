define(['jquery',
    'immutable',
    'underscore',
    'backbone',
    'jqgrid',
    'jqgridlocale',
    'text!templates/setup/billing-messages-grid.html',
    'text!templates/setup/billing-messages-form.html',
    'collections/setup/billing-messages',
    'models/setup/billing-messages',
    'models/pager'
],
    function ($,
              Immutable,
              _,
              Backbone,
              JGrid,
              JGridLocale,
              BillingMessagesGrid,
              BillingMessagesForm,
              BillingMessagesCollections,
              BillingMessagesModel,
              Pager
        ) {
        var billingMessagesView = Backbone.View.extend({
            billingMessagesGridTemplate: _.template(BillingMessagesGrid),
            billingMessagesFormTemplate: _.template(BillingMessagesForm),
            billingMessagesList : [],
            model: null,
            billingMessagesTable :null,
            pager: null,
            events: { },
            initialize: function (options) {
                var self = this;
                this.options = options;
                this.model = new BillingMessagesModel();
                this.billingMessagesList = new BillingMessagesCollections();
                this.pager = new Pager();
                $(this.el).html(this.billingMessagesGridTemplate());
            },

            render: function() {
                var self = this;
                $('#divBillingMessagesGrid').show();
                $('#divBillingMessagesForm').hide();
                this.billingMessagesTable = new customGrid();
                this.billingMessagesTable.render({
                    gridelementid: '#tblBillingMessagesGrid',
                    custompager: new Pager(),
                    emptyMessage: 'No Record found',
                    colNames: ['','','',''],
                    i18nNames: ['', '', 'setup.common.code', 'setup.common.description'],
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
                            route: '#setup/billing_messages/edit/',
                            formatter: function(e, model, data) {
                                return "<span class='icon-ic-edit' title='Edit'></span>"
                            }
                        },
                        {
                            name: 'code',
                        },
                        {
                            name: 'description',
                        }
                    ],
                    datastore: self.billingMessagesList,
                    container:self.el,
                    customizeSort: true,
                    offsetHeight: 01,
                    sortname: "id",
                    sortorder: "desc",
                    sortable: {
                        exclude: '#jqgh_tblBillingMessagesGrid,#jqgh_tblBillingMessagesGrid_edit'
                    },
                    dblClickActionIndex: 1,
                    disablesearch: false,
                    disablesort: false,
                    disablepaging: false,
                    showcaption: false,
                    disableadd: true,
                    disablereload: true,
                    pager: '#gridPager_BillingMessages'
                });

                commonjs.initializeScreen({header: {screen: 'BillingMessages', ext: 'billingMessages'}, grid: {id: '#tblBillingMessagesGrid'}, buttons: [
                    {value: 'Add', class: 'btn btn-danger', i18n: 'shared.buttons.add', clickEvent: function () {
                        Backbone.history.navigate('#setup/billing_messages/new', true);
                    }},
                    {value: 'Reload', class: 'btn', i18n: 'shared.buttons.reload', clickEvent: function () {
                        self.pager.set({"PageNo": 1});
                        self.billingMessagesTable.refreshAll();
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
                $('#divBillingMessagesForm').html(this.billingMessagesFormTemplate());
                if(id > 0) {
                    this.model.set({id: id});
                    this.model.fetch({
                        success: function (model, response) {
                            if (response && response.length > 0) {
                                var data = response[0];
                                if (data) {
                                    $('#ddlCode').val(data.code ? data.code : '');
                                    $('#txtDescription').val(data.description ? data.description : '');
                                }
                            }
                        }
                    });
                } else {
                    this.model = new BillingMessagesModel();
                }

                commonjs.initializeScreen({header: {screen: 'BillingMessages', ext: 'billingMessages'}, buttons: [
                    {value: 'Save', type: 'submit', class: 'btn btn-primary', i18n: 'shared.buttons.save', clickEvent: function () {
                        $("#ddlCode").val($.trim($('#ddlCode').val()) || null);
                        $("#txtDescription").val($.trim($('#txtDescription').val()) || null);
                        self.saveBillingMessages();
                    }},
                    {value: 'Back', class: 'btn', i18n: 'shared.buttons.back', clickEvent: function () {
                        Backbone.history.navigate('#setup/billing_messages/list', true);
                    }}
                ]});

                $('#divBillingMessagesGrid').hide();
                $('#divBillingMessagesForm').show();
                commonjs.processPostRender();
            },

            saveBillingMessages: function() {
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
                    formID: '#formBillingMessages'
                });
                $('#formBillingMessages').submit();
            },

            save: function () {
                this.model.set({
                    "code": $('#ddlCode').val(),
                    "description": $('#txtDescription').val(),
                    "companyId" : app.companyID
                });
                this.model.save({
                }, {
                    success: function (model, response) {
                        if(response) {
                            commonjs.showStatus("Saved Successfully");
                            location.href = "#setup/billing_messages/list";
                        }
                    },
                    error: function (model, response) {
                        commonjs.handleXhrError(model, response);
                    }
                });
            }
        });
        return billingMessagesView;
    });