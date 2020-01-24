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
        // var providerTypes = {
        //     "AT": "Attorney",
        //     "LB": "Laboratory",
        //     "NU": "Nurse",
        //     "PR": "Provider-Radiology",
        //     "RF": "Referring Provider",
        //     "TG": "Technologist"
        // };
        //
        var getActiveIds = function(arr) {
            return _.reduce(arr, function(activeResults, current) {
                if (current.is_active && !current.has_deleted) {
                    activeResults.push(current.id);
                }
                return activeResults;
            }, []);
        };

        var formatOptionText = function(descriptionText, codeText) {
            return descriptionText + (codeText ? ' (' + codeText + ')' : '');
        };

        var createOptionElement = function(id, descriptionText, codeText) {
            return '<option value=' + id + '>' + formatOptionText(descriptionText, codeText) + '</option>';
        };

        /**
         * var getOptions - converts an array of objects to an object for the
         * purpose of rendering selection options.
         *
         * @param  {Array} facilitiesArray an array of objects that correspond to
         *                                options within a selection paradigm
         *                                example:
         *                                  [
         *                                      {
         *                                          ...
         *                                          valueField: 'valueField1',
         *                                          textField: 'textField1',
         *                                          ...
         *                                      },
         *                                      {
         *                                          ...
         *                                          valueField: 'valueField2',
         *                                          textField: 'textField2',
         *                                          ...
         *                                      },
         *
         *                                  ]
         * @param  {String} valueField      property name within any object (in
         *                                the array) to be used for the field
         *                                value within an HTML Option tag
         *                                example:
         *                                    <option value="valueField1"></option>
         * @param  {String} textField       property name within any object (in
         *                                the array) to be used for the field
         *                                text within an HTML Option tag
         *                                example:
         *                                    <option>textField1</option>
         * @return {Object}                 an object with field values for keys
         *                                and field texts for values
         *                                example:
         *                                    {
         *                                      valueField1: textField1,
         *                                      valueField2: textField2,
         *                                      valueField3: textField3,
         *                                      ...
         *                                    }
         */
        var getOptions = function(facilitiesArray, valueField, descriptionField, codeField) {
            return _.reduce(facilitiesArray, function(facilityOptions, facility) {
                facilityOptions[facility[valueField]] = formatOptionText(facility[descriptionField], facility[codeField]);
                return facilityOptions;
            }, {});
        };


        var loadAutobillingRule = function(response) {
            var data = response[0];
            console.log('sumbitch')
            $("#chkAutobillingRuleIsActive").prop('checked', !!data.inactivated_dt);
            $("#txtAutoBillingDescription").val(data.description);
            // $("#ddlAutoBillingStudyStatus").val(data.study_status_id);   // TODO
            $("#ddlAutoBillingClaimStatus").val(data.claim_status_id);

            // TODO the rest of the fields
        };

        // TODO figure out how to filter out providers based on selected provider types



        var populateProvidersFromSelectedProviderTypes = function() {

            var $listAutoBillingInsuranceProviderPayerTypes = $('#listAutoBillingInsuranceProviderPayerTypes');

            var payloadData = {};
            var selectedInsuranceProviderPayerTypes = $listAutoBillingInsuranceProviderPayerTypes.val();

            if ($listAutoBillingInsuranceProviderPayerTypes.find('option').length !== selectedInsuranceProviderPayerTypes.length) {
                payloadData.payerTypeIds = selectedInsuranceProviderPayerTypes;
            }
            $('#listAutoBillingInsuranceProviders').empty();

            $.ajax({
                url: "/insuranceProvidersByPayerType",
                type: "GET",
                async: false,
                data: payloadData,
                success: function (model, response) {
                    if (model && model.result && model.result.length > 0) {
                        var options = getOptions(model.result, 'id', 'insurance_name', 'insurance_code');
                        var optionsHTML = _.map(options, function(value, key) {
                            return "<option value=" + key  + ">" + value + "</option>";
                        });
                        $('#listAutoBillingInsuranceProviders').append(optionsHTML);
                    }
                },
                error: function (err, response) {
                    commonjs.handleXhrError(err, response);
                }
            });
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
            events: {
                // 'change #ddlTemplateType' : 'changeTemplateType'
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

            changeTemplateType: function(e) {
                var self = this;
                $('#txtPageHeight').val(self.defaultPageHeight);
                $('#txtPageWidth').val(self.defaultPageWidth);
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
                            name: 'study_status_id',
                            search: true,
                            stype: 'select',
                            searchoptions: {
                                defaultValue: "0",
                                value: _.reduce(app.study_status, function(searchValues, studyStatus) {
                                    searchValues[studyStatus.id] = studyStatus.status_desc;
                                    return searchValues;
                                }, {"0": "All"})
                            },
                            formatter: function(cellvalue, model, data) {
                                return data.study_status_description;
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
                            // stype: 'select',
                            // searchoptions: {
                            //     value: {
                            //         "true": "Yes",
                            //         "": "All",
                            //         "false": "No"
                            //     }
                            // },
                            // formatter: function(cellvalue, model, data) {
                            //     var r = "<div style='text-align: center; color: red;'><span class='fa fa-times'></span></div>"
                            //     if (cellvalue === true) {
                            //         r = "<div style='text-align: center;'><span class='fa fa-check'></span></div>"
                            //     }
                            //     return r;
                            // }
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
                                //self.autoBillingTable.refreshAll();
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

                $('#divAutoBillingForm').html(this.AutoBillingFormTemplate({
                    insuranceProviderPayerTypes: getOptions(app.insurance_provider_payer_types, 'id', 'description', 'code'),
                    modalities: getOptions(app.modalities, 'modality_code', 'modality_name'),
                    facilities: getOptions(app.facilities, 'facility_code', 'facility_name'),
                    country_alpha_3_code: app.country_alpha_3_code,
                    province_alpha_2_code: app.province_alpha_2_code
                }));

                // *************** BEGIN CPT Codes SECTION *********************

                var facilities = _.map(app.facilities, function(fac) {return fac.id;});
                var modalities = _.map(app.modalities, function(mod) {return mod.id;});

                var $ddlAutoBillingCptCode = $('#ddlAutoBillingCptCode');
                $ddlAutoBillingCptCode.select2({
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
                    escapeMarkup: function (markup) { return markup; }, // let our custom formatter work
                    minimumInputLength: 0,

                    templateResult: function(res) {
                        return formatOptionText(res.display_description, res.display_code);
                    },
                    templateSelection: function(res) {
                        if (res && res.id) {
                            self.pendingAutoBillingCptCode = res;
                            // $('#ddlAutoBillingCptCode').val(res.display_code);
                            return formatOptionText(res.display_description, res.display_code);
                        }
                    }
                });

                var $listAutoBillingCptCodes = $('#listAutoBillingCptCodes');
                $('#btnAddAutoBillingCptCode').off().click(function() {
                    $listAutoBillingCptCodes.append(createOptionElement(
                        self.pendingAutoBillingCptCode.id,
                        self.pendingAutoBillingCptCode.display_description,
                        self.pendingAutoBillingCptCode.display_code
                    ));
                    $ddlAutoBillingCptCode.empty();
                    self.pendingAutoBillingCptCode = null;
                });
                $('#btnRemoveAutoBillingCptCode').off().click(function() {
                    $listAutoBillingCptCodes.find('option:selected').remove();
                });
                // ***************** END CPT Codes SECTION *********************


                // ****** BEGIN Insurance Provider Payer Types SECTION *********
                var $ddlAutoBillingInsuranceProviderPayerTypes = $('#ddlAutoBillingInsuranceProviderPayerTypes');
                $ddlAutoBillingInsuranceProviderPayerTypes.select2({
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
                    escapeMarkup: function (markup) { return markup; }, // let our custom formatter work
                    minimumInputLength: 0,

                    templateResult: function(res) {
                        return formatOptionText(res.description, res.code);
                    },
                    templateSelection: function(res) {
                        if (res && res.id) {
                            self.pendingAutoBillingInsuranceProviderPayerType = res;
                            // $('#ddlAutoBillingCptCode').val(res.display_code);
                            return formatOptionText(res.description, res.code);
                        }
                    }
                });

                var $listAutoBillingInsuranceProviderPayerTypes = $('#listAutoBillingInsuranceProviderPayerTypes');
                $('#btnAddAutoBillingInsuranceProviderPayerType').off().click(function() {
                    $listAutoBillingInsuranceProviderPayerTypes.append(createOptionElement(
                        self.pendingAutoBillingInsuranceProviderPayerType.id,
                        self.pendingAutoBillingInsuranceProviderPayerType.description,
                        self.pendingAutoBillingInsuranceProviderPayerType.code
                    ));
                    $ddlAutoBillingInsuranceProviderPayerTypes.empty();
                    self.pendingAutoBillingInsuranceProviderPayerType = null;
                });
                $('#btnRemoveAutoBillingInsuranceProviderPayerType').off().click(function() {
                    $listAutoBillingInsuranceProviderPayerTypes.find('option:selected').remove();
                });
                // ******** END Insurance Provider Payer Types SECTION *********


                // ************ BEGIN Insurance Providers SECTION **************
                var $ddlAutoBillingInsuranceProviders = $('#ddlAutoBillingInsuranceProviders');
                $ddlAutoBillingInsuranceProviders.select2({
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
                    escapeMarkup: function (markup) { return markup; }, // let our custom formatter work
                    minimumInputLength: 0,

                    templateResult: function(res) {
                        return formatOptionText(res.insurance_name, res.insurance_code);
                    },
                    templateSelection: function(res) {
                        if (res && res.id) {
                            self.pendingAutoBillingInsuranceProvider = res;
                            // $('#ddlAutoBillingCptCode').val(res.display_code);
                            return formatOptionText(res.insurance_name, res.insurance_code);
                        }
                    }
                });

                var $listAutoBillingInsuranceProviders = $('#listAutoBillingInsuranceProviders');
                $('#btnAddAutoBillingInsuranceProvider').off().click(function() {
                    $listAutoBillingInsuranceProviders.append(createOptionElement(
                        self.pendingAutoBillingInsuranceProvider.id,
                        self.pendingAutoBillingInsuranceProvider.insurance_name,
                        self.pendingAutoBillingInsuranceProvider.insurance_code
                    ));
                    $ddlAutoBillingInsuranceProviders.empty();
                    self.pendingAutoBillingInsuranceProvider = null;
                });
                $('#btnRemoveAutoBillingInsuranceProvider').off().click(function() {
                    $listAutoBillingInsuranceProviders.find('option:selected').remove();
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
                            console.log(response);
                            if (response && response.length > 0) {
                                loadAutobillingRule(response);
                            }
                        }
                    });
                } else {
                    this.autoBillingModel = new AutoBillingModel();
                }
                // $('#aShowOriginalForm').parent('li:first').css(this.highlighClass);

                commonjs.initializeScreen({
                    header: { screen: 'AutoBilling', ext: 'autoBilling' }, buttons: [
                        {
                            value: 'Save', type: 'submit', class: 'btn btn-primary', i18n: 'shared.buttons.save', clickEvent: function () {
                                self.saveAutoBillingRule();
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
                // $('#ddlTemplateType option[value="patient_invoice"]').prop('selected', app.country_alpha_3_code === 'can');
                commonjs.processPostRender();
            },


            saveAutoBillingRule: function (options) {

                var self = this;

                this.autoBillingModel.set({
                    "description": $('#txtAutoBillingDescription').val(),
                    "claim_status_id": $('#ddlAutoBillingClaimStatus').val(),
                    "study_status_id": 17,  // approved
                    "inactive": $("#chkAutobillingRuleIsActive").prop('checked')

                });

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
            }
        });
        return AutoBillingView;
    });
