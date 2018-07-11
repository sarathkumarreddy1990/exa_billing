define(['jquery',
    'immutable',
    'underscore',
    'backbone',
    'jqgrid',
    'jqgridlocale',
    'text!templates/setup/status-color-codes-grid.html',
    'text!templates/setup/status-color-codes-form.html',
    'collections/setup/status-color-codes',
    'models/setup/status-color-codes',
    'models/pager'
],
    function ($,
              Immutable,
              _,
              Backbone,
              JGrid,
              JGridLocale,
              StatusColorCodesGrid,
              StatusColorCodesForm,
              StatusColorCodesCollections,
              StatusColorCodesModel,
              Pager
        ) {
        var statusColorCodesView = Backbone.View.extend({
            statusColorCodesGridTemplate: _.template(StatusColorCodesGrid),
            statusColorCodesFormTemplate: _.template(StatusColorCodesForm),
            statusColorCodesList : [],
            model: null,
            statusColorCodesTable :null,
            claimStatus : [],
            studyStatus: [
                {
                    description: 'billed'
                }, 
                {
                    description: 'unbilled'
                }
            ],
            paymentStatus: [
                {
                    description: 'unapplied'
                }, 
                {
                    description: 'partially_applied'
                }, 
                {
                    description: 'fully_applied'
                }, 
                {
                    description: 'over_applied'
                }
            ],
            pager: null,
            events: { 
                'change #ddlProcessType' : 'changeProcessType'
            },
            initialize: function (options) {
                var self = this;
                this.options = options;
                this.model = new StatusColorCodesModel();
                this.statusColorCodesList = new StatusColorCodesCollections();
                this.pager = new Pager();
            },

            render: function() {
                var self = this;
                $('#divStatusColorCodesGrid').show();
                $('#divStatusColorCodesForm').hide();
                $(this.el).html(this.statusColorCodesGridTemplate());
                if(this.claimStatus && !this.claimStatus.length) {
                    this.getClaimStatus();
                }
                this.statusColorCodesTable = new customGrid();
                this.statusColorCodesTable.render({
                    gridelementid: '#tblStatusColorCodesGrid',
                    custompager: new Pager(),
                    emptyMessage: 'No Record found',
                    colNames: ['','','','','',''],
                    i18nNames: ['', '', '', 'setup.statusColorCode.processType', 'setup.statusColorCode.processStatus', 'setup.statusColorCode.colorCode' ],
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
                            route: '#setup/status_color_codes/edit/',
                            formatter: function(e, model, data) {
                                return "<span class='icon-ic-edit' title='Edit'></span>"
                            }
                        },
                        {
                            name: 'del', width: 10, sortable: false, search: false,
                            className: 'icon-ic-delete',
                            customAction: function (rowID) {
                                if (confirm("Are you sure want to delete")) {
                                    var gridData = $('#tblStatusColorCodesGrid').jqGrid('getRowData', rowID);
                                    self.model.set({ "id": rowID });
                                    self.model.destroy({
                                        success: function (model, response) {
                                            commonjs.showStatus("Deleted Successfully");
                                            self.statusColorCodesTable.refresh();
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
                            name: 'process_type',
                        },
                        {
                            name: 'process_status',
                        },
                        {
                            name: 'color_code',
                            search: false,
                            cellattr: function (rowId, tv, rawObject) {
                                return 'style="background-color:' + tv + '"';
                            }
                        }
                    ],
                    afterInsertRow: function (row_id, rData) {
                        commonjs.changeColumnValue('#tblStatusColorCodesGrid', row_id, 'color_code', "");
                    },
                    datastore: self.statusColorCodesList,
                    container:self.el,
                    customizeSort: true,
                    offsetHeight: 01,
                    sortname: "id",
                    sortorder: "desc",
                    sortable: {
                        exclude: '#jqgh_tblStatusColorCodesGrid,#jqgh_tblStatusColorCodesGrid_edit'
                    },
                    dblClickActionIndex: 1,
                    disablesearch: false,
                    disablesort: false,
                    disablepaging: false,
                    showcaption: false,
                    disableadd: true,
                    disablereload: true,
                    pager: '#gridPager_StatusColorCodes'
                });

                commonjs.initializeScreen({header: {screen: 'StatusColorCodes', ext: 'statusColorCodes'}, grid: {id: '#tblStatusColorCodesGrid'}, buttons: [
                    {value: 'Add', class: 'btn btn-danger', i18n: 'shared.buttons.add', clickEvent: function () {
                        Backbone.history.navigate('#setup/status_color_codes/new', true);
                    }},
                    {value: 'Reload', class: 'btn', i18n: 'shared.buttons.reload', clickEvent: function () {
                        self.pager.set({"PageNo": 1});
                        self.statusColorCodesTable.refreshAll();
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
                $('#divStatusColorCodesForm').html(this.statusColorCodesFormTemplate());
                if(id > 0) {
                    this.model.set({id: id});
                    this.model.fetch({
                        success: function (model, response) {
                            if (response && response.length > 0) {
                                var data = response[0];
                                if (data) {
                                    $('#ddlProcessType').val(data.process_type ? data.process_type : '');
                                    if(data.process_type == 'payment') {
                                        self.loadProcessStatus(self.paymentStatus);
                                    } else if(data.process_type == 'study') {
                                        self.loadProcessStatus(self.studyStatus);
                                    } else {
                                        self.loadProcessStatus(self.claimStatus);
                                    }
                                    $('#ddlProcessStatus').val(data.process_status ? data.process_status : '');
                                    $('#txtColor').val(data.color_code ? data.color_code : '');
                                    commonjs.processPostRender();
                                }
                            }
                        }
                    });
                } else {
                    this.model = new StatusColorCodesModel();
                }

                commonjs.initializeScreen({header: {screen: 'StatusColorCodes', ext: 'statusColorCodes'}, buttons: [
                    {value: 'Save', type: 'submit', class: 'btn btn-primary', i18n: 'shared.buttons.save', clickEvent: function () {
                        self.saveStatusColorCodes();
                    }},
                    {value: 'Back', class: 'btn', i18n: 'shared.buttons.back', clickEvent: function () {
                        Backbone.history.navigate('#setup/status_color_codes/list', true);
                    }}
                ]});

                $('#divStatusColorCodesGrid').hide();
                $('#divStatusColorCodesForm').show();
                commonjs.processPostRender();
            },

            loadProcessStatus : function(paymentStatusList) {
                var elPaymentStatus = $('#ddlProcessStatus');
                elPaymentStatus.empty();
                for(var i = 0; i < paymentStatusList.length; i++) {
                    $('<option/>',{value:paymentStatusList[i].description}).html(paymentStatusList[i].description).appendTo(elPaymentStatus);
                }
            },

            changeProcessType : function(e) {
                var processType = $('#ddlProcessType').val();
                if (processType == 'claim') {
                    this.loadProcessStatus(this.claimStatus);
                } else if (processType == 'payment') {
                    this.loadProcessStatus(this.paymentStatus);
                } else if (processType == 'study') {
                    this.loadProcessStatus(this.studyStatus);
                } else {
                    $('#ddlProcessStatus').empty();
                }
            },

            saveStatusColorCodes: function() {
                var self = this;
                commonjs.validateForm({
                    rules: {
                        processType: {
                            required: true
                        },
                        processStatus: {
                            required: true
                        }
                    },
                    messages: {
                        processType: commonjs.getMessage("*", "Process Type"),
                        processStatus: commonjs.getMessage("*", "Process Status")
                    },
                    submitHandler: function () {
                        self.save();
                    },
                    formID: '#formStatusColorCodes'
                });
                $('#formStatusColorCodes').submit();
            },

            getClaimStatus : function() {
                 var self = this;
                 $.ajax({
                     url: "/exa_modules/billing/setup/claim_status?isFrom=claimStatus",
                     type: 'GET',
                     success: function (response) {
                         if (response && response.length > 0) {
                             self.claimStatus = response;
                         }
                     },
                     error: function (err) {
                         commonjs.showWarning(err);
                     }
                 });
            },

            save: function () {
                this.model.set({
                    "processType": $.trim($('#ddlProcessType').val()),
                    "processStatus": $.trim($('#ddlProcessStatus').val()),
                    "colorCode" : $('#txtColor').val(),
                    "companyId" : app.companyID
                });
                this.model.save({
                }, {
                    success: function (model, response) {
                        if(response) {
                            commonjs.showStatus("Saved Successfully");
                            location.href = "#setup/status_color_codes/list";
                        }
                    },
                    error: function (model, response) {
                        commonjs.handleXhrError(model, response);
                    }
                });
            }
        });
        return statusColorCodesView;
    });