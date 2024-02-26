define([
    'jquery',
    'underscore',
    'backbone',
    'text!templates/setup/auto-billing-grid.html',
    'text!templates/setup/auto-billing-form.html',
    'collections/setup/auto-billing',
    'models/setup/auto-billing',
    'models/pager'
], function (
    $,
    _,
    Backbone,
    AutoBillingGrid,
    AutoBillingForm,
    AutoBillingCollections,
    AutoBillingModel,
    Pager
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
        toggleCptCodes(!getSelectedModalities().length);
    };

    var cptCodesChanged = function() {
        toggleModalities(!getSelectedCptCodes().length);
    };

    var insuranceProviderPayerTypesChanged = function() {
        togglePayers(!getSelectedPayerTypes().length);
    };

    var insuranceProvidersChanged = function() {
        togglePayerTypes(!getSelectedPayers().length);
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

        if (data.exclude_ordering_facilities !== null) {
            $("input[name=chkAutoBillingOrderingFacility][value='"+ (data.exclude_ordering_facilities ? 'isNOT' : 'is') +"']").prop('checked', true);
            var ruleorderingFacilities = _.map(data.ordering_facilities, function(ordering_facility) {
                return $('<option>', {
                    value: ordering_facility.id,
                    text: formatOptionText(ordering_facility.ordering_facility_name, ordering_facility.ordering_facility_code)
                });
            });
            $("#listAutoBillingOrderingFacilities").append(ruleorderingFacilities);
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
            this.options = options;
            this.autoBillingModel = new AutoBillingModel();
            this.pager = new Pager();

            this.autoBillingList = new AutoBillingCollections();
            $(this.el).html(this.AutoBillingGridTemplate());
            this.currentPageHeight = this.defaultPageHeight;
            this.currentPageWidth = this.defaultPageWidth;
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
                        formatter: function () {
                            return "<i class='icon-ic-edit' i18nt='shared.buttons.edit'></i>";
                        }
                    },
                    {
                        name: 'del', width: 10, sortable: false, search: false,
                        className: 'icon-ic-delete',
                        customAction: function (rowID) {
                            if (confirm(confirmDelete)) {
                                $('#tblAutoBillingGrid').jqGrid('getRowData', rowID);
                                self.autoBillingModel.set({ "id": rowID });
                                self.autoBillingModel.destroy({

                                    success: function () {
                                        commonjs.showStatus("messages.status.deletedSuccessfully");
                                        self.autobillingRulesTable.refresh();
                                    },
                                    error: function (model, response) {
                                        commonjs.handleXhrError(model, response);
                                    }
                                });
                            }
                        },
                        formatter: function () {
                            return "<i class='icon-ic-delete' i18nt='messages.status.clickHereToDelete'></i>";
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
                offsetHeight: 1,
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
            this.renderForm(id);
        },

        renderForm: function (id) {
            var self = this;
            $('#divAutoBillingForm').html(this.AutoBillingFormTemplate({ claim_status: app.claim_status }));

            this.initDropdowns({
                facilities: _.map(app.facilities, function(fac) {return fac.id;}),
                ordering_facilities: _.map(app.ordering_facilities, function(ofac) {return ofac.id;}),
                modalities: _.map(app.modalities, function(mod) {return mod.id;})
            });

            this.addRemoveRule({
                $btnAdd: $('#btnAddAutoBillingStudyStatus'),
                $btnRemove: $('#btnRemoveAutoBillingStudyStatus'),
                $listBox: $('#listAutoBillingStudyStatuses'),
                selectErrorMessage: 'messages.warning.setup.pleaseSelectStudyStatus',
                existsErrorMessage: 'messages.warning.setup.studyStatusAlreadyExists'
            });

            this.addRemoveRule({
                $btnAdd: $('#btnAddAutoBillingFacility'),
                $btnRemove: $('#btnRemoveAutoBillingFacility'),
                $listBox: $('#listAutoBillingFacilities'),
                selectErrorMessage: 'messages.warning.setup.pleaseSelectFacility',
                existsErrorMessage: 'messages.warning.setup.facilityAlreadyExists'
            });

            this.addRemoveRule({
                $btnAdd: $('#btnAddAutoBillingOrderingFacility'),
                $btnRemove: $('#btnRemoveAutoBillingOrderingFacility'),
                $listBox: $('#listAutoBillingOrderingFacilities'),
                selectErrorMessage: 'order.newOrder.warning.pleaseSelectOrderingFacility',
                existsErrorMessage: 'messages.warning.shared.orderingFacilityAlreadyExist'
            });

            this.addRemoveRule({
                $btnAdd: $('#btnAddAutoBillingModality'),
                $btnRemove: $('#btnRemoveAutoBillingModality'),
                $listBox: $('#listAutoBillingModalities'),
                selectErrorMessage: 'messages.warning.setup.pleaseSelectModality',
                existsErrorMessage: 'messages.warning.setup.modalityAlreadyExists',
                codeChangedCallback: modalitiesChanged
            });

            this.addRemoveRule({
                $btnAdd: $('#btnAddAutoBillingCptCode'),
                $btnRemove: $('#btnRemoveAutoBillingCptCode'),
                $listBox: $('#listAutoBillingCptCodes'),
                selectErrorMessage: 'messages.status.pleaseSelectCPTCodes',
                existsErrorMessage: 'messages.warning.shared.cptCodeAlreadyExist',
                codeChangedCallback: cptCodesChanged
            });

            this.addRemoveRule({
                $btnAdd: $('#btnAddAutoBillingInsuranceProviderPayerType'),
                $btnRemove: $('#btnRemoveAutoBillingInsuranceProviderPayerType'),
                $listBox: $('#listAutoBillingInsuranceProviderPayerTypes'),
                selectErrorMessage: 'messages.status.pleaseSelectInsuranceProviderType',
                existsErrorMessage: 'messages.warning.shared.insuranceProviderTypeAlreadyExist',
                codeChangedCallback: insuranceProviderPayerTypesChanged
            });

            this.addRemoveRule({
                $btnAdd: $('#btnAddAutoBillingInsuranceProvider'),
                $btnRemove: $('#btnRemoveAutoBillingInsuranceProvider'),
                $listBox: $('#listAutoBillingInsuranceProviders'),
                selectErrorMessage: 'messages.status.pleaseSelectInsuranceProvider',
                existsErrorMessage: 'messages.warning.shared.insuranceProviderAlreadyExist',
                codeChangedCallback: insuranceProvidersChanged
            });

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
                data: _.map(_.uniqBy(app.study_status, 'status_code'), function(study_status) {
                    return {
                        id: study_status.status_code,
                        text: formatOptionText(study_status.status_desc, study_status.status_code)
                    };
                }),
                placeholder: 'Study Status',
                minimumInputLength: 0,

                templateSelection: function(res) {
                    return self.getTextAdded({
                        idAdded: _.get(res, 'id'),
                        name: _.get(res, 'text'),
                        code: '',
                        $btnAdd: $('#btnAddAutoBillingStudyStatus')
                    });
                }
            });

            $('#ddlAutoBillingFacility').select2({
                data: _.map(commonjs.getActiveFacilities(), function(facility) {
                    return {
                        id: facility.id,
                        text: formatOptionText(facility.facility_name, facility.facility_code)
                    };
                }),
                placeholder: 'Facility',

                templateSelection: function(res) {
                    return self.getTextAdded({
                        idAdded: _.get(res, 'id'),
                        name: _.get(res, 'text'),
                        code: '',
                        $btnAdd: $('#btnAddAutoBillingFacility')
                    });
                }
            });

            $('#ddlAutoBillingOrderingFacility').select2({
                data: _.map(app.ordering_facilities, function(orderingFacility) {
                    return {
                        id: orderingFacility.id,
                        text: formatOptionText(orderingFacility.ordering_facility_name, orderingFacility.ordering_facility_code)
                    };
                }),
                placeholder: 'ordering Facility',

                templateSelection: function(res) {
                    return self.getTextAdded({
                        idAdded: _.get(res, 'id'),
                        name: _.get(res, 'text'),
                        code: '',
                        $btnAdd: $('#btnAddAutoBillingOrderingFacility')
                    });
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
                    return self.getTextAdded({
                        idAdded: _.get(res, 'id'),
                        name: _.get(res, 'text'),
                        code: '',
                        $btnAdd: $('#btnAddAutoBillingModality')
                    });
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
                minimumInputLength: 0,

                escapeMarkup: function (markup) {
                    return markup;
                },

                templateResult: function(res) {
                    return formatOptionText(res.display_description, res.display_code);
                },

                templateSelection: function(res) {
                    return self.getTextAdded({
                        idAdded: _.get(res, 'id'),
                        name: _.get(res, 'display_description'),
                        code: _.get(res, 'display_code'),
                        $btnAdd: $('#btnAddAutoBillingCptCode')
                    });
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
                    return self.getTextAdded({
                        idAdded: _.get(res, 'id'),
                        name: _.get(res, 'description'),
                        code: _.get(res, 'code'),
                        $btnAdd: $('#btnAddAutoBillingInsuranceProviderPayerType')
                    });
                }
            });

            $('#ddlAutoBillingInsuranceProviders').select2({
                ajax: {
                    type: 'POST',
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
                    return self.getTextAdded({
                        idAdded: _.get(res, 'id'),
                        name: _.get(res, 'insurance_name'),
                        code: _.get(res, 'insurance_code'),
                        $btnAdd: $('#btnAddAutoBillingInsuranceProvider')
                    });
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
            $('#btnSaveautoBilling').prop('disabled', true);
            autoBillingModelData.study_status_codes = _.uniq(study_status_codes);
            autoBillingModelData.exclude_study_statuses = exclude_study_statuses === "isNOT";

            var facility_ids = _.map($("#listAutoBillingFacilities option"), function(option) {
                return option.value;
            });
            autoBillingModelData.facility_ids = _.uniq(facility_ids);
            autoBillingModelData.exclude_facilities = $("input[name=chkAutoBillingFacility]:checked").val() === "isNOT";

            var ordering_facility_ids = _.map($("#listAutoBillingOrderingFacilities option"), function(option) {
                return option.value;
            });
            autoBillingModelData.ordering_facility_ids = _.uniq(ordering_facility_ids);
            autoBillingModelData.exclude_ordering_facilities = $("input[name=chkAutoBillingOrderingFacility]:checked").val() === "isNOT";

            var modality_ids = getSelectedModalities();
            autoBillingModelData.modality_ids = _.uniq(modality_ids);
            autoBillingModelData.exclude_modalities = $("input[name=chkAutoBillingModality]:checked").val() === "isNOT";

            var cpt_code_ids = getSelectedCptCodes();
            autoBillingModelData.cpt_code_ids = _.uniq(cpt_code_ids);
            autoBillingModelData.exclude_cpt_codes = $("input[name=chkAutoBillingCptCode]:checked").val() === "isNOT";


            var insurance_provider_payer_type_ids = _.map($("#listAutoBillingInsuranceProviderPayerTypes option"), function(option) {
                return option.value;
            });
            autoBillingModelData.insurance_provider_payer_type_ids = _.uniq(insurance_provider_payer_type_ids);
            autoBillingModelData.exclude_insurance_provider_payer_types = $("input[name=chkAutoBillingInsuranceProviderPayerType]:checked").val() === "isNOT";

            var insurance_provider_ids = _.map($("#listAutoBillingInsuranceProviders option"), function(option) {
                return option.value;
            });
            autoBillingModelData.insurance_provider_ids = _.uniq(insurance_provider_ids);
            autoBillingModelData.exclude_insurance_providers = $("input[name=chkAutoBillingInsuranceProvider]:checked").val() === "isNOT";

            this.autoBillingModel.set(autoBillingModelData);

            this.autoBillingModel.save({
            }, {
                success: function (model, response) {
                    $('#btnSaveautoBilling').prop('disabled', false);
                    if (response) {
                        if (response.length && response[0].status === 'EXISTS') {
                            commonjs.showWarning('messages.warning.shared.alreadyexists');
                            return;
                        }

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
                    $('#btnSaveautoBilling').prop('disabled', false);
                    commonjs.handleXhrError(model, response);
                }
            });
        },

        /**
         * Get the text added to the list box rule from
         * the selected option of the dropdown rules
         *
         * @param {string|number} idAdded - identification of rule that is saved in the
         *                                  html button to be processed later
         * @param {string} name - name of the rule to be formatted as return text
         *                        together with the code
         * @param {string} code - code of the rule to be formatted as return text
         *                        together with the name
         * @param {object} $btnAdd - button element used to add the rule for processing
         * @returns - text formatted as rule name and code
         */
        getTextAdded: function(options) {
            var {
                idAdded,
                name,
                code = '',
                $btnAdd
            } = options;

            if (idAdded) {
                var textAdded = formatOptionText(name, code);

                $btnAdd.data('idAdded', idAdded);
                $btnAdd.data('textAdded', textAdded);

                return textAdded;
            }
        },

        /**
         * Set the add and remove rule button
         *
         * @param {object} $btnAdd - button element used to add the rule to the list box
         * @param {object} $btnRemove - button element used to remove the rule from the list box
         * @param {object} $listBox - list box element used for the rules
         * @param {string} selectErrorMessage - i18n error message for no selected option in dropdown
         * @param {string} existsErrorMessage - i18n error message that option is already in the list box
         * @param {function} codeChangedCallback - optional function that runs after adding or removing the rule
         * @returns - null
         */
        addRemoveRule: function (options) {
            var {
                $btnAdd,
                $btnRemove,
                $listBox,
                selectErrorMessage,
                existsErrorMessage,
                codeChangedCallback,
            } = options;

            $btnAdd.off().click(function () {
                var idAdded = $(this).data('idAdded');
                var textAdded = $(this).data('textAdded');

                if (!idAdded) {
                    commonjs.showWarning(selectErrorMessage);
                    return;
                }

                var optionExists = $listBox.find(`option[value="${idAdded}"]`).length > 0;

                if (optionExists) {
                    commonjs.showWarning(existsErrorMessage || 'messages.warning.shared.alreadyexists');
                    return;
                }

                $listBox.append(createOptionElement(idAdded, textAdded));

                if (codeChangedCallback) {
                    codeChangedCallback();
                }
            });

            $btnRemove.off().click(function() {
                $listBox.find('option:selected').remove();

                if (codeChangedCallback) {
                    codeChangedCallback();
                }
            });
        }
    });

    return AutoBillingView;
});
