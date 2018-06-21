define(['jquery',
    'immutable',
    'underscore',
    'backbone',
    'jqgrid',
    'jqgridlocale',
    'text!templates/setup/insurance-x12-mapping-grid.html',
    'text!templates/setup/insurance-x12-mapping-form.html',
    'collections/setup/insurance-x12-mapping',
    'models/setup/insurance-x12-mapping',
    'models/pager'
],
    function ($,
              Immutable,
              _,
              Backbone,
              JGrid,
              JGridLocale,
              InsuranceX12MappingGrid,
              InsuranceX12MappingForm,
              InsuranceX12MappingCollections,
              InsuranceX12MappingModel,
              Pager
        ) {
        var insuranceX12MappingView = Backbone.View.extend({
            insuranceX12MappingGridTemplate: _.template(InsuranceX12MappingGrid),
            insuranceX12MappingFormTemplate: _.template(InsuranceX12MappingForm),
            insuranceX12MappingList : [],
            model: null,
            insuranceX12MappingTable :null,
            pager: null,
            events: { },
            initialize: function (options) {
                var self = this;
                this.options = options;
                this.model = new InsuranceX12MappingModel();
                this.insuranceX12MappingList = new InsuranceX12MappingCollections();
                this.pager = new Pager();
            },

            render: function() {
                var self = this;
                $('#divInsuranceX12MappingGrid').show();
                $('#divInsuranceX12MappingForm').hide();
                $(this.el).html(this.insuranceX12MappingGridTemplate());
                this.insuranceX12MappingTable = new customGrid();
                this.insuranceX12MappingTable.render({
                    gridelementid: '#tblInsuranceX12MappingGrid',
                    custompager: new Pager(),
                    emptyMessage: 'No Record found',
                    colNames: ['','','','',''],
                    i18nNames: ['', '', '', 'setup.insuranceX12Mapping.insuranceName', 'setup.insuranceX12Mapping.claimClearingHouse'],
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
                            route: '#setup/insurance_x12_mapping/edit/',
                            formatter: function(e, model, data) {
                                return "<span class='icon-ic-edit' title='click here to Edit'></span>"
                            }
                        },
                        {
                            name: 'del', width: 10, sortable: false, search: false,
                            className: 'icon-ic-delete',
                            customAction: function (rowID) {
                                if (confirm("Are you sure want to delete")) {
                                    var gridData = $('#tblinsuranceX12MappingGrid').jqGrid('getRowData', rowID);
                                    self.model.set({ "id": rowID });
                                    self.model.destroy({
                                        success: function (model, response) {
                                            commonjs.showStatus("Deleted Successfully");
                                            self.insuranceX12MappingTable.refresh();
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
                            name: 'insurance_name',
                        },
                        {
                            name: 'claimClearingHouse',
                        }
                    ],
                    datastore: self.insuranceX12MappingList,
                    container:self.el,
                    customizeSort: true,
                    offsetHeight: 01,
                    sortname: "id",
                    sortorder: "desc",
                    sortable: {
                        exclude: '#jqgh_tblInsuranceX12MappingGrid,#jqgh_tblInsuranceX12MappingGrid_edit,#jqgh_tblInsuranceX12MappingGrid_del'
                    },
                    dblClickActionIndex: 1,
                    disablesearch: false,
                    disablesort: false,
                    disablepaging: false,
                    showcaption: false,
                    disableadd: true,
                    disablereload: true,
                    pager: '#gridPager_InsuranceX12Mapping'
                });

                commonjs.initializeScreen({header: {screen: 'InsuranceX12Mapping', ext: 'insuranceX12Mapping'}, grid: {id: '#tblInsuranceX12MappingGrid'}, buttons: [
                    {value: 'Add', class: 'btn btn-danger', i18n: 'shared.buttons.add', clickEvent: function () {
                        Backbone.history.navigate('#setup/insurance_x12_mapping/new', true);
                    }},
                    {value: 'Reload', class: 'btn', i18n: 'shared.buttons.reload', clickEvent: function () {
                        self.pager.set({"PageNo": 1});
                        self.insuranceX12MappingTable.refreshAll();
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
                $('#divInsuranceX12MappingForm').html(this.insuranceX12MappingFormTemplate());
                if(id > 0) {
                    this.model.set({id: id});
                    this.model.fetch({
                        success: function (model, response) {
                            if (response && response.length > 0) {
                                var data = response[0];
                                if (data) {
                                    $('#txtName').val(data.name ? data.name : '');
                                    $('#txtClaimClearingHouse').val(data.claimClearingHouse ? data.claimClearingHouse : '');
                                    $('#chkActive').prop('checked', data.inactivated_dt ? true : false);
                                }
                            }
                        }
                    });
                } else {
                    this.model = new InsuranceX12MappingModel();
                }

                commonjs.initializeScreen({header: {screen: 'InsuranceX12Mapping', ext: 'insuranceX12Mapping'}, buttons: [
                    {value: 'Save', type: 'submit', class: 'btn btn-primary', i18n: 'shared.buttons.save', clickEvent: function () {
                        self.saveInsuranceX12Mapping();
                    }},
                    {value: 'Back', class: 'btn', i18n: 'shared.buttons.back', clickEvent: function () {
                        Backbone.history.navigate('#setup/insurance_x12_mapping/list', true);
                    }}
                ]});

                $('#divInsuranceX12MappingGrid').hide();
                $('#divInsuranceX12MappingForm').show();
                commonjs.processPostRender();
            },

            saveInsuranceX12Mapping: function() {
                var self = this;
                commonjs.validateForm({
                    rules: {
                        name: {
                            required: true
                        },
                        claimClearingHouse: {
                            required: true
                        }
                    },
                    messages: {
                        name: commonjs.getMessage("*", "Name"),
                        claimClearingHouse: commonjs.getMessage("*", "claimClearingHouse")
                    },
                    submitHandler: function () {
                        self.save();
                    },
                    formID: '#formInsuranceX12Mapping'
                });
                $('#formInsuranceX12Mapping').submit();
            },

            save: function () {
                this.model.set({
                    "name": $.trim($('#txtName').val()),
                    "claimClearingHouse": $.trim($('#txtClaimClearingHouse').val()),
                    "isActive" : !$('#chkActive').prop('checked'),
                    "companyId" : app.companyID
                });
                this.model.save({
                }, {
                    success: function (model, response) {
                        if(response) {
                            commonjs.showStatus("Saved Successfully");
                            location.href = "#setup/insurance_x12_mapping/list";
                        }
                    },
                    error: function (model, response) {
                        commonjs.handleXhrError(model, response);
                    }
                });
            }
        });
        return insuranceX12MappingView;
    });