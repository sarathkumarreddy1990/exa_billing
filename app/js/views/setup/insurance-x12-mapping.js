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

                if (app.country_alpha_3_code === "can") {
                    self.billing_method = _.reject(self.billing_method, function (field) {
                        return (field && (field.value == "paper_claim" || field.value == "patient_payment"))
                    }) || [];
                }
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
                    emptyMessage: commonjs.geti18NString("messages.status.noRecordFound"),
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
                                return "<i class='icon-ic-edit' i18nt='shared.buttons.edit'></i>"
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
                            hidden: app.country_alpha_3_code === "can",
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
                        commonjs.showStatus("messages.status.reloadedSuccessfully");
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
                $('#divInsuranceX12MappingForm').html(this.insuranceX12MappingFormTemplate({
                    country_alpha_3_code: app.country_alpha_3_code,
                    'ediClearingHouseList' : self.ediClearingHouses
                }));
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
                                    $('#txtClaimFileIndicatorCode').val(data.indicator_code ? data.indicator_code : '');
                                    $('#selectPayerEDICode').val(data.edi_code ? data.edi_code : '');
                                    self.isdefaultPayer = data.is_default_payer;
                                    $('input:checkbox[name=defaultPayer]').prop('checked', self.isdefaultPayer );
                                    if (data.billing_method == 'electronic_billing') {
                                        $('#clearingHouse').show();
                                        $('#dPayer').show();
                                    }
                                    else {
                                        $('#clearingHouse').hide();
                                        $('#dPayer').hide();
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
                $('#selectPayerEDICode').change(function(){
                    self.changeEDICode();
                });
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
                if (self.isdefaultPayer && !$('input:checkbox[name=defaultPayer]').prop('checked')) {
                    commonjs.showWarning('messages.warning.shared.defaultPayer');
                    return false;
                }
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
                    "billingMethod": $('#ddlClaimBillingMethod').val(),
                    "indicatorCode": $('#txtClaimFileIndicatorCode').val(),
                    "ediCode": $("#selectPayerEDICode").val(),
                    "is_default_payer": $('input:checkbox[name=defaultPayer]').prop('checked')
                });
                this.model.save({
                }, {
                    success: function (model, response) {
                        if(response) {
                            commonjs.showStatus('messages.status.savedSuccessfully');
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

            showHouse: function (e) {
                var method = $('#ddlClaimBillingMethod').val();
                if (method == 'electronic_billing') {
                    $('#clearingHouse').show();
                    $('#dPayer').show();
                }
                else {
                    $('#clearingHouse').hide();
                    $('#dPayer').hide();
                }
            },

            changeEDICode: function () {
                var ediCode = $('#selectPayerEDICode').val();
                var ediVal = '';
                switch (ediCode) {
                    case 'A':
                        ediVal = 'AT'
                        break;
                    case 'C':
                        ediVal = 'MB'
                        break;
                    case 'D':
                        ediVal = 'MC'
                        break;
                    case 'F':
                        ediVal = 'CI'
                        break;
                    case 'G':
                        ediVal = 'BL'
                        break;
                    case 'R':
                        ediVal = 'MB'
                        break;
                    case 'W':
                        ediVal = 'WC'
                        break;
                    case 'X':
                        ediVal = 'CH'
                        break;
                    case 'Y':
                        ediVal = 'YFAC'
                        break;
                    case 'default':
                        ediVal = ''
                        break;
                }
                $('#txtClaimFileIndicatorCode').val(ediVal);
            }
        });
        return insuranceX12MappingView;
    });
