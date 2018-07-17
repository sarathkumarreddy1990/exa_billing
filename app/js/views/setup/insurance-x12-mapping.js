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
            ediClearingHouses : [],
            model: null,
            insuranceX12MappingTable :null,
            pager: null,
            events: {
                'change #ddlClaimBillingMethod': 'showHouse'
             },
            initialize: function (options) {
                var self = this;
                this.options = options;
                this.model = new InsuranceX12MappingModel();
                this.insuranceX12MappingList = new InsuranceX12MappingCollections();
                this.pager = new Pager();
                this.billing_method = [
                    { 'value': 'direct_billing', 'text': 'Direct Billing' },
                    { 'value': 'electronic_billing', 'text': 'Electronic Billing' },
                    { 'value': 'patient_payment', 'text': 'Patient Payment' },
                    { 'value': 'paper_claim', 'text': 'Paper Claim' }
                ];
            },

            render: function() {
                var self = this;
                $('#divInsuranceX12MappingGrid').show();
                $('#divInsuranceX12MappingForm').hide();
                $(this.el).html(this.insuranceX12MappingGridTemplate());
                if (this.ediClearingHouses && !this.ediClearingHouses.length)
                    this.getEDIClearingHousesList();

                var billingMethodValue = commonjs.buildGridSelectFilter({
                    arrayOfObjects: this.billing_method,
                    searchKey: 'value',
                    textDescription: 'text',
                    sort: true
                })

                this.insuranceX12MappingTable = new customGrid();
                this.insuranceX12MappingTable.render({
                    gridelementid: '#tblInsuranceX12MappingGrid',
                    custompager: new Pager(),
                    emptyMessage: 'No Record found',
                    colNames: ['','','','',''],
                    i18nNames: ['', '', 'setup.insuranceX12Mapping.insuranceName', 'billing.fileInsurance.billingmethod', 'setup.insuranceX12Mapping.claimClearingHouse'],
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
                            width: 15,
                            sortable: false,
                            search: false,
                            className:'icon-ic-edit',
                            route: '#setup/insurance_x12_mapping/edit/',
                            formatter: function(e, model, data) {
                                return "<i class='icon-ic-edit' title='Edit'></i>"
                            }
                        },
                        {
                            name: 'insurance_name',
                        },
                        {
                            name: 'billing_method',
                            "stype": "select", 
                            searchoptions: { value: billingMethodValue }, 
                            formatter: self.billingMethodFormatter
                        },
                        {
                            name: 'claimclearinghouse',
                            formatter: function(cellvalue, options, rowObject) {
                                var name = "";
                                var clearingHouseID = rowObject.claimclearinghouse;
                                var matchedEDIClearingHouseObj = self.ediClearingHouses.filter(function (obj) {
                                    if (obj.id == clearingHouseID) {
                                        return obj.name;
                                    }
                                });
                                if(matchedEDIClearingHouseObj.length) {
                                    name = matchedEDIClearingHouseObj[0].name;
                                }
                                return name;
                            }
                        }
                    ],
                    afterInsertRow: function (rowid, rowdata) {
                        if (!rowdata.is_active) {
                            var $row = $('#tblInsuranceX12MappingGrid').find('#' + rowid);
                            $row.css('text-decoration', 'line-through');
                        }
                    },
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
                $('#divInsuranceX12MappingForm').html(this.insuranceX12MappingFormTemplate({'ediClearingHouseList' : self.ediClearingHouses}));
                if(id > 0) {
                    this.model.set({id: id});
                    this.model.fetch({
                        success: function (model, response) {
                            if (response && response.length > 0) {
                                var data = response[0];
                                
                                if (data) {
                                    $('#lblInsuranceName ').html(data.insurance_name ? data.insurance_name : '');
                                    $('#ddlClaimClearingHouse').val(data.claimclearinghouse ? data.claimclearinghouse : '');
                                    $('#ddlClaimBillingMethod').val(data.billing_method ? data.billing_method : '');

                                    if(data.billing_method == 'electronic_billing'){
                                        $('#clearingHouse').show();
                                    }
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

            getEDIClearingHousesList: function () {
                var self = this;
                $.ajax({
                    url: '/exa_modules/billing/setup/edi_clearinghouses?isFrom=InsuranceEDIMapping',
                    type: 'GET',
                    success: function (response) {
                        if (response && response.length > 0) {
                            self.ediClearingHouses = response;
                        }
                    },
                    error: function (err) {
                        commonjs.showWarning(err);
                    }
                });
            },

            saveInsuranceX12Mapping: function() {
                var self = this;
                commonjs.validateForm({
                    rules: {
                        name: {
                            required: true
                        },
                        claimBillingMethod: {
                            required: true
                        },
                        claimClearingHouse: {
                            required: true
                        }
                    },
                    messages: {
                        name: commonjs.getMessage("*", "Name"),
                        claimBillingMethod: commonjs.getMessage("*", "claim Billing Method"),
                        claimClearingHouse: commonjs.getMessage("*", "claim Clearing House")
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
                    "claimClearingHouse": ($('#ddlClaimClearingHouse').val() && $('#ddlClaimBillingMethod').val()=='electronic_billing' ) ? $('#ddlClaimClearingHouse').val() : null,
                    "billingMethod": $('#ddlClaimBillingMethod').val()
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
            },

            billingMethodFormatter: function (cellvalue, options, rowObject) {
                var colvalue = ''
                switch (rowObject.billing_method) {
                    case 'direct_billing':
                        colvalue = 'Direct Billing'
                        break
                    case 'electronic_billing':
                        colvalue = 'Electronic Billing'
                        break
                    case 'patient_payment':
                        colvalue = 'Patient Payment'
                        break
                    case 'paper_claim':
                        colvalue = 'Paper Claim'
                }
                return colvalue
            },

            showHouse: function(e) {
                var method = $('#ddlClaimBillingMethod').val();
                if(method == 'electronic_billing'){
                    $('#clearingHouse').show();
                }
                else{
                    $('#clearingHouse').hide();
                }
                    
            }
        });
        return insuranceX12MappingView;
    });