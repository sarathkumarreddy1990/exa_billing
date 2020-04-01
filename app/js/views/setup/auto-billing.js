define(['jquery',
    'immutable',
    'underscore',
    'backbone',
    'jqgrid',
    'jqgridlocale',
    'text!templates/setup/auto-billing-grid.html',
    'text!templates/setup/auto-billing-form.html',
    'collections/setup/auto-billing',
    'models/setup/auto-billing',
    'models/pager',
    'ace/ace',
],
    function ($,
        Immutable,
        _,
        Backbone,
        JGrid,
        JGridLocale,
        AutoBillingGrid,
        AutoBillingForm,
        AutoBillingCollections,
        AutoBillingModel,
        Pager,
        ace
    ) {


        var formatOptionText = function(descriptionText, codeText) {
            return descriptionText + (codeText ? ' (' + codeText + ')' : '');
        };

        var createOptionElement = function(id, descriptionText, codeText) {
            return '<option value=' + id + '>' + formatOptionText(descriptionText, codeText) + '</option>';
        };

        var getSelectedModalities = function() {
            return _.map($("#listAutoBillingModalities option"), function(option) {
                return option.value;
            });
        };

        var getSelectedCptCodes = function() {
            return _.map($("#listAutoBillingCptCodes option"), function(option) {
                return option.value;
            });
        };

        var getSelectedPayerTypes = function() {
            return _.map($("#listAutoBillingInsuranceProviderPayerTypes option"), function(option) {
                return option.value;
            });
        };
        var getSelectedPayers = function() {
            return _.map($("#listAutoBillingInsuranceProviders option"), function(option) {
                return option.value;
            });
        };


        var toggleCptCodes = function(enabled) {
            $('#divAutoBillingCptCodes .autobilling-input').prop('disabled', !enabled);
        };
        var toggleModalities = function(enabled) {
            $('#divAutoBillingModalities .autobilling-input').prop('disabled', !enabled);
        };

        var togglePayerTypes = function(enabled) {
            $('#divAutoBillingInsuranceProviderPayerTypes .autobilling-input').prop('disabled', !enabled);
        };
        var togglePayers = function(enabled) {
            $('#divAutoBillingInsuranceProviders .autobilling-input').prop('disabled', !enabled);
        };



        var modalitiesChanged = function() {
            if (getSelectedModalities().length) {
                toggleCptCodes(false);
            }
            else {
                toggleCptCodes(true);
            }
        };

        var cptCodesChanged = function() {
            if (getSelectedCptCodes().length) {
                toggleModalities(false);
            }
            else {
                toggleModalities(true);
            }
        };

        var insuranceProviderPayerTypesChanged = function() {
            console.log('insurance provider payer types changed');
            if (getSelectedPayerTypes().length) {
                togglePayers(false);
            }
            else {
                togglePayers(true);
            }
        };

        var insuranceProvidersChanged = function() {
            console.log('insurance provider changed');
            if (getSelectedPayers().length) {
                togglePayerTypes(false);
            }
            else {
                togglePayerTypes(true);
            }
        };





        var loadAutobillingRule = function(response) {
            var data = response[0];

            $("#chkAutobillingRuleIsActive").prop('checked', !data.is_active);
            $("#txtAutoBillingDescription").val(data.autobilling_rule_description);
            $("#ddlAutoBillingClaimStatus").val(data.claim_status_id);

            $("input[name=chkAutoBillingStudyStatus][value='"+ (data.exclude_study_statuses ? 'isNOT' : 'is') +"']").prop('checked', true);
            var ruleStudyStatuses = _.map(data.study_statuses, function(study_status) {
                return $('<option>', {
                    value: study_status.status_code,
                    text: formatOptionText(study_status.status_desc, study_status.status_code)
                });
            });
            $("#listAutoBillingStudyStatuses").append(ruleStudyStatuses);

            if (data.exclude_facilities !== null) {
                $("input[name=chkAutoBillingFacility][value='"+ (data.exclude_facilities ? 'isNOT' : 'is') +"']").prop('checked', true);
                var ruleFacilities = _.map(data.facilities, function(facility) {
                    return $('<option>', {
                        value: facility.id,
                        text: formatOptionText(facility.facility_name, facility.facility_code)
                    });
                });
                $("#listAutoBillingFacilities").append(ruleFacilities);
            }

            if (data.exclude_modalities !== null) {
                $("input[name=chkAutoBillingModality][value='"+ (data.exclude_modalities ? 'isNOT' : 'is') +"']").prop('checked', true);
                var ruleModalities = _.map(data.modalities, function(modality) {
                    return $('<option>', {
                        value: modality.id,
                        text: formatOptionText(modality.modality_name, modality.modality_code)
                    });
                });
                $("#listAutoBillingModalities").append(ruleModalities);
                modalitiesChanged();
            }

            if (data.exclude_cpt_codes !== null) {
                $("input[name=chkAutoBillingCptCode][value='"+ (data.exclude_cpt_codes ? 'isNOT' : 'is') +"']").prop('checked', true);
                var ruleCptCodes = _.map(data.cpt_codes, function(cpt_code) {
                    return $('<option>', {
                        value: cpt_code.id,
                        text: formatOptionText(cpt_code.display_description, cpt_code.display_code)
                    });
                });
                $("#listAutoBillingCptCodes").append(ruleCptCodes);
                cptCodesChanged();
            }

            if (data.exclude_insurance_provider_payer_types !== null) {
                $("input[name=chkAutoBillingInsuranceProviderPayerType][value='"+ (data.exclude_insurance_provider_payer_types ? 'isNOT' : 'is') +"']").prop('checked', true);
                var ruleInsuranceProviderPayerTypes = _.map(data.insurance_provider_payer_types, function(insurance_provider_payer_type) {
                    return $('<option>', {
                        value: insurance_provider_payer_type.id,
                        text: formatOptionText(insurance_provider_payer_type.description, insurance_provider_payer_type.code)
                    });
                });
                $("#listAutoBillingInsuranceProviderPayerTypes").append(ruleInsuranceProviderPayerTypes);
                insuranceProviderPayerTypesChanged();
            }

            if (data.exclude_insurance_providers !== null) {
                $("input[name=chkAutoBillingInsuranceProvider][value='"+ (data.exclude_insurance_providers ? 'isNOT' : 'is') +"']").prop('checked', true);
                var ruleInsuranceProviders = _.map(data.insurance_providers, function(insurance_provider) {
                    return $('<option>', {
                        value: insurance_provider.id,
                        text: formatOptionText(insurance_provider.insurance_name, insurance_provider.insurance_code)
                    });
                });
                $("#listAutoBillingInsuranceProviders").append(ruleInsuranceProviders);
                insuranceProvidersChanged();
            }
        };



        var AutoBillingView = Backbone.View.extend({
            AutoBillingGridTemplate: _.template(AutoBillingGrid),
            AutoBillingFormTemplate: _.template(AutoBillingForm),

            defaultPageHeight: 792,
            defaultPageWidth: 612,
            pager: null,
            templateData: {
                originalForm: "{}",
                fullForm: "{}"
            },
            templateToogleMode: true,
            highlighClass: {
                'background': '#bbddff', 'border-radius': '6px'
            },

            initialize: function (options) {
                var self = this;
                this.options = options;
                this.autoBillingModel = new AutoBillingModel();
                this.pager = new Pager();

                this.autoBillingList = new AutoBillingCollections();
                $(this.el).html(this.AutoBillingGridTemplate());
                self.currentPageHeight = self.defaultPageHeight;
                self.currentPageWidth = self.defaultPageWidth;
            },


            render: function () {
                var self = this;
                var confirmDelete = commonjs.geti18NString("messages.status.areYouSureWantToDelete");
                $('#divAutoBillingGrid').show();
                $('#divAutoBillingForm').hide();

                this.autobillingRulesTable = new customGrid();
                this.autobillingRulesTable.render({
                    gridelementid: '#tblAutoBillingGrid',
                    custompager: new Pager(),
                    emptyMessage: commonjs.geti18NString("messages.status.noRecordFound"),
                    colNames: ['', '', '', '', '', '', ''],
                    i18nNames: ['', '', '', 'setup.common.description', 'setup.autoBilling.studyStatus', 'setup.autoBilling.claimStatus', 'is_active'],
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
                            width: 10,
                            sortable: false,
                            search: false,
                            className: 'icon-ic-edit',
                            route: '#setup/auto_billing/edit/',
                            formatter: function (e, model, data) {
                                return "<i class='icon-ic-edit' i18nt='shared.buttons.edit'></i>"
                            }
                        },
                        {
                            name: 'del', width: 10, sortable: false, search: false,
                            className: 'icon-ic-delete',
                            customAction: function (rowID) {
                                if (confirm(confirmDelete)) {
                                    var gridData = $('#tblAutoBillingGrid').jqGrid('getRowData', rowID);
                                    self.autoBillingModel.set({ "id": rowID });
                                    self.autoBillingModel.destroy({

                                        success: function (model, response) {
                                            commonjs.showStatus("messages.status.deletedSuccessfully");
                                            self.autobillingRulesTable.refresh();
                                        },
                                        error: function (model, response) {
                                            commonjs.handleXhrError(model, response);
                                        }
                                    });
                                }
                            },
                            formatter: function (e, model, data) {
                                return "<i class='icon-ic-delete' i18nt='messages.status.clickHereToDelete'></i>"
                            }
                        },
                        {
                            name: 'autobilling_rule_description',
                            searchFlag: '%'
                        },
                        {
                            name: 'study_status',
                            search: true,
                            stype: 'select',
                            searchoptions: {
                                defaultValue: "",
                                value: _.reduce(app.study_status, function(searchValues, studyStatus) {
                                    searchValues[studyStatus.status_code] = formatOptionText(studyStatus.status_desc, studyStatus.status_code);
                                    return searchValues;
                                }, {"": "All"})
                            },
                            formatter: function(cellvalue, model, data) {
                                return data.study_status_codes.join(', ');
                            }
                        },
                        {
                            name: 'claim_status_id',
                            search: true,
                            stype: 'select',
                            searchoptions: {
                                defaultValue: "0",
                                value: _.reduce(app.claim_status, function(searchValues, claimStatus) {
                                    searchValues[claimStatus.id] = claimStatus.description;
                                    return searchValues;
                                }, {"0": "All"})
                            },
                            formatter: function(cellvalue, model, data) {
                                return data.claim_status_description;
                            }
                        },
                        {
                            name: 'is_active',
                            hidden: true
                        }
                    ],
                    afterInsertRow: function (rowid, rowdata) {
                        if (!rowdata.is_active) {
                            var $row = $('#tblAutoBillingGrid').find('#' + rowid);
                            $row.css('text-decoration', 'line-through');
                        }
                    },
                    datastore: self.autoBillingList,
                    container: self.el,
                    customizeSort: true,
                    offsetHeight: 01,
                    sortname: "id",
                    sortorder: "desc",
                    sortable: {
                        exclude: '#jqgh_tblAutoBillingGrid,#jqgh_tblAutoBillingGrid_edit,#jqgh_tblAutoBillingGrid_del'
                    },
                    dblClickActionIndex: 1,
                    disablesearch: false,
                    disablesort: false,
                    disablepaging: false,
                    showcaption: false,
                    disableadd: true,
                    disablereload: true,
                    pager: '#gridPager_AutoBilling'
                });

                commonjs.initializeScreen({
                    header: { screen: 'AutoBilling', ext: 'autoBilling' }, grid: { id: '#tblAutoBillingGrid' }, buttons: [
                        {
                            value: 'Add', class: 'btn btn-danger', i18n: 'shared.buttons.add', clickEvent: function () {
                                Backbone.history.navigate('#setup/auto_billing/new', true);
                            }
                        },
                        {
                            value: 'Reload', class: 'btn', i18n: 'shared.buttons.reload', clickEvent: function () {
                                self.pager.set({ "PageNo": 1 });
                                self.autobillingRulesTable.refreshAll();
                                commonjs.showStatus("messages.status.reloadedSuccessfully");
                            }
                        }
                    ]
                });
                $('#data_container').height(window.innerHeight - (25 + $('.navbar').outerHeight() + $('#divPageHeaderButtons').outerHeight()));
            },
            showGrid: function () {
                this.render();
            },

            showForm: function (id) {
                var self = this;
                this.renderForm(id);
            },


            renderForm: function (id) {
                var self = this;

                $('#divAutoBillingForm').html(this.AutoBillingFormTemplate());

                self.initDropdowns({
                    facilities: _.map(app.facilities, function(fac) {return fac.id;}),
                    modalities: _.map(app.modalities, function(mod) {return mod.id;})
                });

                // ***************** BEGIN Studies SECTION *********************
                var $ddlAutoBillingStudyStatuses = $('#ddlAutoBillingStudyStatuses');
                var $listAutoBillingStudyStatuses = $('#listAutoBillingStudyStatuses');
                $('#btnAddAutoBillingStudyStatus').off().click(function() {
                    $listAutoBillingStudyStatuses.append(createOptionElement(
                        self.pendingAutoBillingStudyStatus.id,
                        self.pendingAutoBillingStudyStatus.text
                    ));
                    // $ddlAutoBillingStudyStatuses.empty();
                    self.pendingAutoBillingStudyStatus = null;
                });
                $('#btnRemoveAutoBillingStudyStatus').off().click(function() {
                    $listAutoBillingStudyStatuses.find('option:selected').remove();
                });
                // ******************* END Studies SECTION *********************

                // *************** BEGIN Facilities SECTION *********************
                var $ddlAutoBillingFacility = $('#ddlAutoBillingFacility');
                var $listAutoBillingFacilities = $('#listAutoBillingFacilities');
                $('#btnAddAutoBillingFacility').off().click(function() {
                    $listAutoBillingFacilities.append(createOptionElement(
                        self.pendingAutoBillingFacility.id,
                        self.pendingAutoBillingFacility.text
                    ));
                    // $ddlAutoBillingFacility.empty();
                    self.pendingAutoBillingFacility = null;
                });
                $('#btnRemoveAutoBillingFacility').off().click(function() {
                    $listAutoBillingFacilities.find('option:selected').remove();
                });
                // **************** END Facilities SECTION *********************


                // ************** BEGIN Modalities SECTION *********************
                var $ddlAutoBillingModality = $('#ddlAutoBillingModality');
                var $listAutoBillingModalities = $('#listAutoBillingModalities');
                $('#btnAddAutoBillingModality').off().click(function() {
                    $listAutoBillingModalities.append(createOptionElement(
                        self.pendingAutoBillingModality.id,
                        self.pendingAutoBillingModality.text
                    ));
                    self.pendingAutoBillingModality = null;
                    // $ddlAutoBillingModality.empty();
                    modalitiesChanged();
                });
                $('#btnRemoveAutoBillingModality').off().click(function() {
                    $listAutoBillingModalities.find('option:selected').remove();
                    modalitiesChanged();
                });
                // *************** END Modalities SECTION *********************



                // *************** BEGIN CPT Codes SECTION *********************
                var $ddlAutoBillingCptCode = $('#ddlAutoBillingCptCode');
                var $listAutoBillingCptCodes = $('#listAutoBillingCptCodes');
                $('#btnAddAutoBillingCptCode').off().click(function() {
                    $listAutoBillingCptCodes.append(createOptionElement(
                        self.pendingAutoBillingCptCode.id,
                        self.pendingAutoBillingCptCode.display_description,
                        self.pendingAutoBillingCptCode.display_code
                    ));
                    $ddlAutoBillingCptCode.empty();
                    self.pendingAutoBillingCptCode = null;
                    cptCodesChanged();

                });
                $('#btnRemoveAutoBillingCptCode').off().click(function() {
                    $listAutoBillingCptCodes.find('option:selected').remove();
                    cptCodesChanged();
                });
                // ***************** END CPT Codes SECTION *********************


                // ****** BEGIN Insurance Provider Payer Types SECTION *********
                var $ddlAutoBillingInsuranceProviderPayerTypes = $('#ddlAutoBillingInsuranceProviderPayerTypes');
                var $listAutoBillingInsuranceProviderPayerTypes = $('#listAutoBillingInsuranceProviderPayerTypes');
                $('#btnAddAutoBillingInsuranceProviderPayerType').off().click(function() {
                    $listAutoBillingInsuranceProviderPayerTypes.append(createOptionElement(
                        self.pendingAutoBillingInsuranceProviderPayerType.id,
                        self.pendingAutoBillingInsuranceProviderPayerType.description,
                        self.pendingAutoBillingInsuranceProviderPayerType.code
                    ));
                    $ddlAutoBillingInsuranceProviderPayerTypes.empty();
                    self.pendingAutoBillingInsuranceProviderPayerType = null;
                    insuranceProviderPayerTypesChanged();
                });
                $('#btnRemoveAutoBillingInsuranceProviderPayerType').off().click(function() {
                    $listAutoBillingInsuranceProviderPayerTypes.find('option:selected').remove();
                    insuranceProviderPayerTypesChanged();
                });
                // ******** END Insurance Provider Payer Types SECTION *********


                // ************ BEGIN Insurance Providers SECTION **************
                var $ddlAutoBillingInsuranceProviders = $('#ddlAutoBillingInsuranceProviders');
                var $listAutoBillingInsuranceProviders = $('#listAutoBillingInsuranceProviders');
                $('#btnAddAutoBillingInsuranceProvider').off().click(function() {
                    $listAutoBillingInsuranceProviders.append(createOptionElement(
                        self.pendingAutoBillingInsuranceProvider.id,
                        self.pendingAutoBillingInsuranceProvider.insurance_name,
                        self.pendingAutoBillingInsuranceProvider.insurance_code
                    ));
                    $ddlAutoBillingInsuranceProviders.empty();
                    self.pendingAutoBillingInsuranceProvider = null;
                    insuranceProvidersChanged();
                });
                $('#btnRemoveAutoBillingInsuranceProvider').off().click(function() {
                    $listAutoBillingInsuranceProviders.find('option:selected').remove();
                    insuranceProvidersChanged();
                });
                // ************* END Insurance Providers SECTION ***************


                $('#divAutoBillingGrid').hide();
                $('#divAutoBillingForm').show();
                self.currentPageHeight = self.defaultPageHeight;
                self.currentPageWidth = self.defaultPageWidth;
                if (id > 0) {
                    this.autoBillingModel.set({ id: id });
                    this.autoBillingModel.fetch({
                        success: function (model, response) {
                            if (response && response.length > 0) {
                                loadAutobillingRule(response);
                            }
                        }
                    });
                } else {
                    this.autoBillingModel = new AutoBillingModel();
                }

                commonjs.initializeScreen({
                    header: { screen: 'AutoBilling', ext: 'autoBilling' }, buttons: [
                        {
                            value: 'Save', type: 'submit', class: 'btn btn-primary', i18n: 'shared.buttons.save', clickEvent: function () {
                                self.saveAutoBillingRule({});
                            }
                        },
                        {
                            value: 'Save and Close', type: 'submit', class: 'btn btn-primary', i18n: 'shared.buttons.saveAndClose', clickEvent: function () {
                                self.saveAutoBillingRule({
                                    closeOnSuccess: true
                                });
                            }
                        },
                        {
                            value: 'Back', class: 'btn', i18n: 'shared.buttons.back', clickEvent: function () {
                                Backbone.history.navigate('#setup/auto_billing/list', true);
                            }
                        }
                    ]
                });
                commonjs.processPostRender();
            },

            initDropdowns: function(options) {

                var self = this;
                var facilities = options.facilities;
                var modalities = options.modalities;

                $('#ddlAutoBillingStudyStatuses').select2({
                    data: _.map(app.study_status, function(study_status) {
                        return {
                            id: study_status.status_code,
                            text: formatOptionText(study_status.status_desc, study_status.status_code)
                        };
                    }),
                    placeholder: 'Study Status',
                    minimumInputLength: 0,

                    templateSelection: function(res) {
                        if (res && res.id) {
                            self.pendingAutoBillingStudyStatus = res;
                            return res.text;
                        }
                    }
                });

                $('#ddlAutoBillingFacility').select2({
                    data: _.map(app.facilities, function(facility) {
                        return {
                            id: facility.id,
                            text: formatOptionText(facility.facility_name, facility.facility_code)
                        };
                    }),
                    placeholder: 'Facility',

                    templateSelection: function(res) {
                        if (res && res.id) {
                            self.pendingAutoBillingFacility = res;
                            return res.text;
                        }
                    }
                });

                $('#ddlAutoBillingModality').select2({
                    data: _.map(app.modalities, function(modality) {
                        return {
                            id: modality.id,
                            text: formatOptionText(modality.modality_name, modality.modality_code)
                        };
                    }),
                    placeholder: 'Modality',
                    minimumInputLength: 0,

                    templateSelection: function(res) {
                        if (res && res.id) {
                            self.pendingAutoBillingModality = res;
                            return res.text;
                        }
                    }
                });

                $('#ddlAutoBillingCptCode').select2({
                    ajax: {
                        type: 'POST',
                        url: "/cptsAutoComplete",
                        dataType: 'json',
                        delay: 250,
                        data: function (params) {
                            return {
                                pageNo: params.page || 1,
                                q: params.term || '',
                                pageSize: 10,
                                sortField: 'trim(display_description)',
                                sortOrder: "ASC",
                                modalities: modalities,
                                facilities: facilities,
                                from: 'new_order'
                            };
                        },
                        processResults: function (data, params) {
                            return commonjs.getTotalRecords(data.result, params);
                        },
                        cache: true
                    },
                    placeholder: 'CPT Code',
                    escapeMarkup: function (markup) { return markup; },
                    minimumInputLength: 0,

                    templateResult: function(res) {
                        return formatOptionText(res.display_description, res.display_code);
                    },
                    templateSelection: function(res) {
                        if (res && res.id) {
                            self.pendingAutoBillingCptCode = res;
                            return formatOptionText(res.display_description, res.display_code);
                        }
                    }
                });

                $('#ddlAutoBillingInsuranceProviderPayerTypes').select2({
                    ajax: {
                        type: 'GET',
                        url: "/insuranceProviderPayerTypes",
                        dataType: 'json',
                        delay: 250,
                        data: function (params) {
                            return {
                                pageNo: params.page || 1,
                                q: params.term || '',
                                pageSize: 10,
                                sortField: 'trim(description)',
                                sortOrder: "ASC",
                                modalities: modalities,
                                facilities: facilities,
                                from: 'new_order'
                            };
                        },
                        processResults: function (data, params) {
                            return commonjs.getTotalRecords(data.result, params);
                        },
                        cache: true
                    },
                    placeholder: 'Insurance Provider Payer Type',
                    escapeMarkup: function (markup) { return markup; },
                    minimumInputLength: 0,

                    templateResult: function(res) {
                        return formatOptionText(res.description, res.code);
                    },
                    templateSelection: function(res) {
                        if (res && res.id) {
                            self.pendingAutoBillingInsuranceProviderPayerType = res;
                            return formatOptionText(res.description, res.code);
                        }
                    }
                });

                $('#ddlAutoBillingInsuranceProviders').select2({
                    ajax: {
                        type: 'GET',
                        url: "/insuranceProviders",
                        dataType: 'json',
                        delay: 250,
                        data: function (params) {
                            return {
                                pageNo: params.page || 1,
                                q: params.term || '',
                                pageSize: 10,
                                sortField: 'trim(insurance_name)',
                                sortOrder: "ASC",
                                modalities: modalities,
                                facilities: facilities,
                                from: 'new_order'
                            };
                        },
                        processResults: function (data, params) {
                            return commonjs.getTotalRecords(data.result, params);
                        },
                        cache: true
                    },
                    placeholder: 'Insurance Providers',
                    escapeMarkup: function (markup) { return markup; },
                    minimumInputLength: 0,

                    templateResult: function(res) {
                        return formatOptionText(res.insurance_name, res.insurance_code);
                    },
                    templateSelection: function(res) {
                        if (res && res.id) {
                            self.pendingAutoBillingInsuranceProvider = res;
                            return formatOptionText(res.insurance_name, res.insurance_code);
                        }
                    }
                });
            },


            saveAutoBillingRule: function (options) {

                var self = this;

                var autoBillingModelData = {
                    "description": $('#txtAutoBillingDescription').val(),
                    "claim_status_id": $('#ddlAutoBillingClaimStatus').val(),
                    "inactive": $("#chkAutobillingRuleIsActive").prop('checked')
                };

                if (!autoBillingModelData.description) {
                    commonjs.showWarning('setup.autoBilling.providerDescription');
                    return;
                }

                var study_status_codes = _.map($("#listAutoBillingStudyStatuses option"), function(option) {
                    return option.value;
                });

                var exclude_study_statuses = $("input[name=chkAutoBillingStudyStatus]:checked").val();
                if (!study_status_codes.length) {
                    commonjs.showWarning('setup.autoBilling.selectStudyStatus');
                    return;
                }
                if (!exclude_study_statuses){
                    commonjs.showWarning('setup.autoBilling.selectStudyStatusCondition');
                    return;
                }
                autoBillingModelData.study_status_codes = study_status_codes;
                autoBillingModelData.exclude_study_statuses = exclude_study_statuses === "isNOT";

                var facility_ids = _.map($("#listAutoBillingFacilities option"), function(option) {
                    return option.value;
                });
                autoBillingModelData.facility_ids = facility_ids;
                autoBillingModelData.exclude_facilities = $("input[name=chkAutoBillingFacility]:checked").val() === "isNOT";

                var modality_ids = getSelectedModalities();
                autoBillingModelData.modality_ids = modality_ids;
                autoBillingModelData.exclude_modalities = $("input[name=chkAutoBillingModality]:checked").val() === "isNOT";

                var cpt_code_ids = getSelectedCptCodes();
                autoBillingModelData.cpt_code_ids = cpt_code_ids;
                autoBillingModelData.exclude_cpt_codes = $("input[name=chkAutoBillingCptCode]:checked").val() === "isNOT";


                var insurance_provider_payer_type_ids = _.map($("#listAutoBillingInsuranceProviderPayerTypes option"), function(option) {
                    return option.value;
                });
                autoBillingModelData.insurance_provider_payer_type_ids = insurance_provider_payer_type_ids;
                autoBillingModelData.exclude_insurance_provider_payer_types = $("input[name=chkAutoBillingInsuranceProviderPayerType]:checked").val() === "isNOT";

                var insurance_provider_ids = _.map($("#listAutoBillingInsuranceProviders option"), function(option) {
                    return option.value;
                });
                autoBillingModelData.insurance_provider_ids = insurance_provider_ids;
                autoBillingModelData.exclude_insurance_providers = $("input[name=chkAutoBillingInsuranceProvider]:checked").val() === "isNOT";

                this.autoBillingModel.set(autoBillingModelData);

                this.autoBillingModel.save({
                }, {
                    success: function (model, response) {
                        if (response) {
                            commonjs.showStatus('messages.status.savedSuccessfully');
                            if (options.closeOnSuccess) {
                                Backbone.history.navigate('#setup/auto_billing/list', true);
                            }
                            else {
                                var id = response[0] && response[0].id;
                                self.autoBillingModel.set({
                                    id: id
                                });
                            }
                        }
                    },
                    error: function (model, response) {
                        commonjs.handleXhrError(model, response);
                    }
                });
            },


        });
        return AutoBillingView;
    });
