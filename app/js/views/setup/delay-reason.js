define(['jquery',
    'immutable',
    'underscore',
    'backbone',
    'jqgrid',
    'jqgridlocale',
    'text!templates/setup/delay-reason-grid.html',
    'text!templates/setup/delay-reason-form.html',
    'collections/setup/delay-reason',
    'models/setup/delay-reasons',
    'models/pager'
],
    function ($,
        Immutable,
        _,
        Backbone,
        JGrid,
        JGridLocale,
        DelayReasonGrid,
        DelayReasonForm,
        DelayReasonCollections,
        DelayReasonModel,
        Pager
    ) {

        var DelayReasonView = Backbone.View.extend({
            activeFilter: { "": "All", "true": "Yes", "false": "No"},
            delayReasonGridTemplate: _.template(DelayReasonGrid),
            delayReasonForm: _.template(DelayReasonForm),
            pager: null,
            delayReasonPager: null,
            delayReasonTable: null,
            model: null,
            events: {
            },

            initialize: function (options) {
                this.options = options;
                this.model = new DelayReasonModel();
                this.pager = new Pager();
                this.delayReasonPager = new Pager();
                this.delayReasonList = new DelayReasonCollections();
                $(this.el).html(this.delayReasonGridTemplate());
            },

            showGrid: function () {
                var self = this;
                var confirmDelete = commonjs.geti18NString("messages.status.areYouSureWantToDelete");
                $('#divDelayReasonGrid').show();
                $('#divDelayReasonForm').hide();
                this.delayReasonTable = new customGrid();
                this.delayReasonTable.render({
                    gridelementid: '#tblDelayReasonGrid',
                    custompager: this.delayReasonPager,
                    emptyMessage: commonjs.geti18NString("messages.status.noRecordFound"),
                    colNames: ['', '', '', '', '', ''],
                    i18nNames: ['', '', '', 'shared.fields.active', 'setup.common.code', 'setup.common.description'],
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
                            width: 5,
                            sortable: false,
                            search: false,
                            className: 'icon-ic-edit',
                            route: '#setup/delay_reason/edit/',
                            formatter: function () {
                                return "<i class='icon-ic-edit' i18nt='shared.buttons.edit'></i>"
                            }
                        },
                        {
                            name: 'del', width: 5, sortable: false, search: false,
                            className: 'icon-ic-delete',
                            customAction: function (rowID) {
                                if (confirm(confirmDelete)) {
                                    var gridData = $('#tblDelayReasonGrid').jqGrid('getRowData', rowID);
                                    self.model.set({ "id": rowID });
                                    self.model.destroy({
                                        data: $.param({code: gridData.code, description:gridData.description}),
                                        success: function () {
                                            commonjs.showStatus("messages.status.deletedSuccessfully");
                                            self.delayReasonTable.refresh();
                                        },
                                        error: function (model, response) {
                                            commonjs.handleXhrError(model, response);
                                        }
                                    });
                                }
                            },
                            formatter: function (e, model, data) {
                                return data.is_system_code == true ? '' :  "<i class='icon-ic-delete' i18nt='messages.status.clickHereToDelete'></i>"
                            }
                        },
                        {
                            name: 'is_active', width: 10, stype: 'select', searchoptions: { value: self.activeFilter },
                            formatter: function (cellvalue) {
                                var r = "<div style='text-align: center; color: red;'><span class='fa fa-times'></span></div>"
                                if (cellvalue == true) {
                                    r = "<div style='text-align: center;'><span class='fa fa-check'></span></div>"
                                }
                                return r;
                            }
                        },
                        { name: 'code', width: 20, searchFlag: '%'},
                        { name: 'description', width: 100, searchFlag: '%' }

                    ],
                    datastore: self.delayReasonList,
                    container: self.el,
                    customizeSort: true,
                    offsetHeight: 1,
                    sortname: "id",
                    sortorder: "desc",
                    dblClickActionIndex: 1,
                    disablesearch: false,
                    disablesort: false,
                    sortable: {
                        exclude: '#jqgh_tblDelayReasonGrid,#jqgh_tblDelayReasonGrid_edit,#jqgh_tblDelayReasonGrid_del'
                    },
                    customargs: {},
                    disablepaging: false,
                    showcaption: false,
                    disableadd: true,
                    disablereload: true,
                    pager: '#gridPager_DelayReason',
                    delayedPagerUpdate: true,
                    pagerApiUrl: '/exa_modules/billing/setup/delay_reasons/count'
                });

                commonjs.initializeScreen({
                    header: { screen: 'delayReasons', ext: 'delayReasons' }, grid: { id: '#tblDelayReasonGrid' }, buttons: [
                        {
                            value: 'Add', class: 'btn btn-danger', i18n: 'shared.buttons.add', clickEvent: function () {
                                Backbone.history.navigate('#setup/delay_reason/new', true);
                            }
                        },
                        {
                            value: 'Reload', class: 'btn', i18n: 'shared.buttons.reload', clickEvent: function () {
                                self.pager.set({ "PageNo": 1 });
                                self.delayReasonTable.refreshAll();
                                commonjs.showStatus("messages.status.reloadedSuccessfully");
                            }
                        }
                    ]
                });
                commonjs.processPostRender();
            },

            showForm: function (id) {
                this.renderForm(id);
            },

            renderForm: function (id) {
                var self = this;
                $('#divDelayReasonForm').html(this.delayReasonForm());
                if(id > 0) {
                    this.model.set({id: id});
                    this.model.fetch({
                        success: function (model, response) {
                            if (response && response.length > 0) {
                                var data = response[0];
                                if (data) {
                                    $('#txtCode').val(data.code || '');
                                    $('#txtDescription').val(data.description || '');
                                    $('#chkActive').prop('checked', !!data.inactivated_dt);

                                    if (data.is_system_code) {
                                        $('#txtCode').prop('disabled', data.is_system_code);
                                    }
                                }
                            }
                        }
                    });
                } else {
                    this.model = new DelayReasonModel();
                }

                commonjs.isMaskValidate();
                commonjs.initializeScreen({header: {screen: 'delayReasons', ext: 'delayReasons'}, buttons: [
                    {value: 'Save', type: 'submit', class: 'btn btn-primary', i18n: 'shared.buttons.save', clickEvent: function () {
                        self.saveDelayReason();
                    }},
                    {value: 'Back', class: 'btn', i18n: 'shared.buttons.back', clickEvent: function () {
                        Backbone.history.navigate('#setup/delay_reason/list', true);
                    }}
                ]});
                $('#divDelayReasonGrid').hide();
                $('#divDelayReasonForm').show();
                commonjs.processPostRender();
            },

            saveDelayReason: function() {
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
                    formID: '#formDelayCodes'
                });
                $('#formDelayCodes').submit();
            },

            save: function(){
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
                            commonjs.showStatus('messages.status.savedSuccessfully');
                            location.href = "#setup/delay_reason/list";
                        }
                    },
                    error: function (model, response) {
                        commonjs.handleXhrError(model, response);
                    }
                });
            }

        });

        return DelayReasonView;
    });
