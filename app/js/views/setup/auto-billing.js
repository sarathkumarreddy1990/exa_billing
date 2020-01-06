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

        var formatOptionText = function(descriptionText, codeText) {
            return descriptionText + (codeText ? ' (' + codeText + ')' : '');
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



        var populateBillingProviderPayerTypes = function() {
            $.ajax({
                url: "/insuranceProviderPayerTypes",
                type: "GET",
                async: false,
                data: {
                    company_id: app.companyID
                },
                success: function (model, response) {
                    if (model && model.result && model.result.length > 0) {

                        var $listAutoBillingProviderPayerTypes = $('#listAutoBillingProviderPayerTypes');
                    }
                },
                error: function (err, response) {
                    commonjs.handleXhrError(err, response);
                }
            });
        };

        var populateProvidersFromSelectedProviderTypes = function() {

            console.log($('#listAutoBillingProviderTypes option:selected'));
            // var selectedProviderTypes = _.reduce($('#listAutoBillingProviderTypes option:selected'), function(results, selectedOption) {
            //
            //     console.log('selected provider types:', selectedOption);
            // }, {});

            // .each(function (i, selected) {
            //     var jsonModality = {};
            //     jsonModality.id = $(selected).val();
            //     jsonModality.text = $(selected).text();
            //     arrModality.push(jsonModality);
            // });
        };

        var AutoBillingView = Backbone.View.extend({
            AutoBillingGridTemplate: _.template(AutoBillingGrid),
            AutoBillingFormTemplate: _.template(AutoBillingForm),
            autoBillingList: [],
            model: null,
            // paperClaimTemplatesTable: null,
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
                this.model = new AutoBillingModel();
                this.pager = new Pager();
                this.templateType = [
                    { 'value': "direct_invoice", 'text': "Direct Invoice" },
                    { 'value': "patient_invoice", 'text': "Patient Invoice" },
                    { 'value': "paper_claim_full", 'text': "Paper Claim (B & W)" },
                    { 'value': "paper_claim_original", 'text': "Paper Claim (RED)" }

                ];
                if (app.country_alpha_3_code === 'can') {
                    this.templateType = _.reject(this.templateType, function (item) {
                        return item.value == 'paper_claim_full' || item.value == 'paper_claim_original';
                    })
                }
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

                var templateType = commonjs.buildGridSelectFilter({
                    arrayOfObjects: this.templateType,
                    searchKey: "value",
                    textDescription: "text",
                    sort: true
                });

                this.paperClaimTemplatesTable = new customGrid();
                this.paperClaimTemplatesTable.render({
                    gridelementid: '#tblAutoBillingGrid',
                    custompager: new Pager(),
                    emptyMessage: commonjs.geti18NString("messages.status.noRecordFound"),
                    colNames: ['', '', '', '', '', ''],
                    i18nNames: ['', '', '', 'setup.paperClaimTemplates.templateName', 'setup.paperClaimTemplates.templateType', 'is_active'],
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
                                    self.model.set({ "id": rowID });
                                    // self.model.destroy({
                                    //     data: $.param({name: gridData.name, templateType:gridData.template_type}),
                                    //     success: function (model, response) {
                                    //         commonjs.showStatus("messages.status.deletedSuccessfully");
                                    //         self.paperClaimTemplatesTable.refresh();
                                    //     },
                                    //     error: function (model, response) {
                                    //         commonjs.handleXhrError(model, response);
                                    //     }
                                    // });
                                }
                            },
                            formatter: function (e, model, data) {
                                return "<i class='icon-ic-delete' i18nt='messages.status.clickHereToDelete'></i>"
                            }
                        },
                        {
                            name: 'name',
                            searchFlag: '%'
                        },
                        {
                            name: 'template_type',
                            search: true,
                            stype: 'select',
                            searchoptions: { value: templateType },
                            formatter: self.templateTypeFormatter
                        },
                        {
                            name: 'inactivated_dt',
                            hidden: true
                        }
                    ],
                    afterInsertRow: function (rowid, rowdata) {
                        if (rowdata.inactivated_dt) {
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
                                self.autoBillingTable.refreshAll();
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
                this.templateToogleMode = true;
                $('#divAutoBillingForm').html(this.AutoBillingFormTemplate({
                    insuranceProviderPayerTypes: getOptions(app.insurance_provider_payer_types, 'id', 'description', 'code'),
                    modalities: getOptions(app.modalities, 'modality_code', 'modality_name'),
                    facilities: getOptions(app.facilities, 'facility_code', 'facility_name'),
                    country_alpha_3_code: app.country_alpha_3_code,
                    province_alpha_2_code: app.province_alpha_2_code
                }));
                $('#listAutoBillingProviderTypes').change( populateProvidersFromSelectedProviderTypes);

                $('#divAutoBillingGrid').hide();
                $('#divAutoBillingForm').show();
                self.currentPageHeight = self.defaultPageHeight;
                self.currentPageWidth = self.defaultPageWidth;
                if (id > 0) {
                    this.model.set({ id: id });
                    this.model.fetch({
                        success: function (model, response) {
                            // if (response && response.length > 0) {
                            //     var data = self.modelData = response[0];
                            //     if (data) {
                            //         $('#txtTemplateName').val(data.name ? data.name : '');
                            //         $('#chkActive').prop('checked', data.inactivated_dt ? true : false);
                            //         $('#chkDefault').prop('checked', data.is_default ? true : false);
                            //         $('#txtRightMargin').val(data.right_margin ? data.right_margin : 0);
                            //         $('#txtLeftMargin').val(data.left_margin ? data.left_margin : 0),
                            //             $('#txtTopMargin').val(data.top_margin ? data.top_margin : 0),
                            //             $('#txtBottomMargin').val(data.bottom_margin ? data.bottom_margin : 0),
                            //             self.templateData = data.template_content ? data.template_content : "{}";
                            //         self.setEditorContents(self.templateData);
                            //         $('#txtPageHeight').val(data.page_height ? data.page_height : 0);
                            //         $('#txtPageWidth').val(data.page_width ? data.page_width : 0);
                            //         $('#ddlTemplateType').val(data.template_type ? data.template_type : '');
                            //         self.currentPageHeight = $('#txtPageHeight').val();
                            //         self.currentPageWidth = $('#txtPageWidth').val();
                            //     }
                            // }
                        }
                    });
                } else {
                    this.model = new AutoBillingModel();
                    this.setEditorContents("var dd = { content: 'Test Data' }");
                }
                // $('#aShowOriginalForm').parent('li:first').css(this.highlighClass);

                commonjs.initializeScreen({
                    header: { screen: 'AutoBilling', ext: 'autoBilling' }, buttons: [
                        {
                            value: 'Save', type: 'submit', class: 'btn btn-primary', i18n: 'shared.buttons.save', clickEvent: function () {
                                // self.confirmPaperClaimAlignment(false);
                            }
                        },
                        {
                            value: 'Save and Close', type: 'submit', class: 'btn btn-primary', i18n: 'shared.buttons.saveAndClose', clickEvent: function () {
                                // self.confirmPaperClaimAlignment(true);
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

            // confirmPaperClaimAlignment: function (doGoBack) {
            //     var self = this;
            //     var txtPageHeight = $('#txtPageHeight');
            //     var txtPageWidth = $('#txtPageWidth');
            //     var txtTemplateName = $('#txtTemplateName');
            //     txtTemplateName.val($.trim(txtTemplateName.val()) || null);
            //     if (txtPageHeight.val() != self.currentPageHeight || txtPageWidth.val() != self.currentPageWidth) {
            //         var confirmMsg = commonjs.geti18NString("messages.confirm.alignmentConfirm");
            //         if (confirm(confirmMsg)) {
            //             self.currentPageHeight = txtPageHeight.val();
            //             self.currentPageWidth = txtPageWidth.val();
            //             self.saveAutoBilling(doGoBack);
            //         } else {
            //             txtPageHeight.val(self.currentPageHeight);
            //             txtPageWidth.val(self.currentPageWidth);
            //         }
            //     } else {
            //         self.saveAutoBilling(doGoBack);
            //     }
            // },

            saveAutoBilling: function (doGoBack) {
                var self = this;
                self.doGoback = doGoBack;
                // commonjs.validateForm({
                //     rules: {
                //         templateName: {
                //             required: true
                //         },
                //         templateType: {
                //             required: true
                //         }
                //     },
                //     messages: {
                //         templateName: commonjs.getMessage("e", "Template Name"),
                //         templateType: commonjs.getMessage("e", "Template type")
                //     },
                //     submitHandler: function () {
                //         self.save(self.doGoback);
                //     },
                //     formID: '#formAutoBilling'
                // });
                $('#formAutoBilling').submit();
            },

            setEditorContents: function (content) {
                var timer;
                var lastGen, lastChanged;
                var self = this;
                // var editor = ace.edit('paperClaimEditor');

                // editor.setTheme();
                // editor.setTheme("ace/theme/monokai");
                // editor.getSession().setMode("ace/mode/javascript");
                // $('#paperClaimEditor').height($('#data_container').outerHeight() - $('#formAutoBilling').outerHeight());
                // editor.setValue(content);

                // var pdfWorker = null;
                //
                // try {
                //     pdfWorker = new Worker('/exa_modules/billing/static/js/workers/pdf.js');
                // } catch (e) {
                //     console.error(e);
                // }

                // generatePreview();

                // editor.getSession().on('change', function (e) {
                //     if (timer) {
                //         clearTimeout(timer);
                //     }
                //
                //     lastChanged = new Date();
                //
                //     timer = setTimeout(function () {
                //         if (!lastGen || lastGen < lastChanged) {
                //             generatePreview();
                //         };
                //     }, 300);
                // });

                // function showStatus(msg) {
                //     $('#divPreviewLabel').html(msg);
                //     $('#divPreviewLabel').show();
                //     $('#ifrTemplatePreview').hide();
                // }

                // function generatePreview() {
                //     lastGen = new Date();
                //
                //     try {
                //         eval(editor.getSession().getValue());
                //
                //         $('#divPreviewLabel').hide();
                //         $('#ifrTemplatePreview').show();
                //
                //         if (typeof dd === 'undefined') {
                //             return showStatus('Invalid template');
                //         }
                //
                //         if (!pdfWorker) {
                //             return showStatus('Unable to render PDF');
                //         }
                //
                //         pdfWorker.onmessage = function (res) {
                //             document.getElementById('ifrTemplatePreview').src = res.data.pdfBlob;
                //         };
                //
                //         pdfWorker.postMessage(dd);
                //         return;
                //
                //         // pdfMake.createPdf(dd).getDataUrl(function (outDoc) {
                //         //     document.getElementById('ifrTemplatePreview').src = outDoc;
                //         // });
                //     } catch (err) {
                //         showStatus(err);
                //         return;
                //     }
                // }
            },

            // reloadDefaultTemplate: function (templateType) {
            //     var self = this;
            //     var templateNames = {
            //         'direct_invoice': 'direct_invoice.template',
            //         'patient_invoice': 'patient_Invoice.template',
            //         'paper_claim_full': 'paper_claim_BW.template',
            //         'paper_claim_original': 'paper_claim_red.template'
            //     };
            //
            //     if (templateType) {
            //         commonjs.showLoading();
            //         $.ajax({
            //             url: '/exa_modules/billing/static/resx/printer_templates/' + templateNames[templateType],
            //             success: function (model, response) {
            //                 self.setEditorContents(model);
            //                 commonjs.hideLoading();
            //             },
            //             error: function (err, response) {
            //                 commonjs.handleXhrError(err, response);
            //             }
            //         });
            //     }
            //     else {
            //         commonjs.showWarning('Select Template type');
            //     }
            // },

            save: function (doGoBack) {
                var self = this;
                this.templateData = ace.edit('paperClaimEditor').getValue();
                if(this.templateData === ""){
                    commonjs.showError("Invalid Template");
                    return false;
                }
                this.model.set({
                    "name": $('#txtTemplateName').val(),
                    "isActive": !$('#chkActive').prop('checked'),
                    "isDefault": $('#chkDefault').prop('checked'),
                    "marginRight": $('#txtRightMargin').val() ? $('#txtRightMargin').val() : 0,
                    "marginLeft": $('#txtLeftMargin').val() ? $('#txtLeftMargin').val() : 0,
                    "marginTop": $('#txtTopMargin').val() ? $('#txtTopMargin').val() : 0,
                    "marginBottom": $('#txtBottomMargin').val() ? $('#txtBottomMargin').val() : 0,
                    "templateContent": this.templateData,
                    "companyId": app.companyID,
                    "height": $('#txtPageHeight').val() ? $('#txtPageHeight').val() : 0,
                    "width": $('#txtPageWidth').val() ? $('#txtPageWidth').val() : 0,
                    "type": $('#ddlTemplateType').val()
                });

                this.model.save({
                }, {
                        success: function (model, response) {
                            if (response) {
                                commonjs.showStatus('messages.status.savedSuccessfully');
                                var id = response[0] && response[0].id;
                                if (doGoBack) {
                                    location.href = "#setup/printer_templates/list";
                                } else {
                                    self.model.set({
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

            templateTypeFormatter: function (cellvalue, options, rowObject) {
                var colvalue = '';
                switch (rowObject.template_type) {
                    case "paper_claim_original":
                        colvalue = 'Paper Claim (RED)';
                        break;
                    case "paper_claim_full":
                        colvalue = 'Paper Claim (B & W)';
                        break;
                    case "direct_invoice":
                        colvalue = 'Direct Invoice';
                        break;
                    case "patient_invoice":
                        colvalue = 'Patient Invoice';
                        break;
                }
                return colvalue;
            },

        });
        return AutoBillingView;
    });
