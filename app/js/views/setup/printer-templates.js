define(['jquery',
    'immutable',
    'underscore',
    'backbone',
    'jqgrid',
    'jqgridlocale',
    'text!templates/setup/printer-templates-grid.html',
    'text!templates/setup/printer-templates-form.html',
    'collections/setup/printer-templates',
    'models/setup/printer-templates',
    'models/pager',
    'ace/ace',
],
    function ($,
        Immutable,
        _,
        Backbone,
        JGrid,
        JGridLocale,
        PaperClaimTemplatesGrid,
        PaperClaimTemplatesForm,
        PaperClaimTemplatesCollections,
        PaperClaimTemplatesModel,
        Pager,
        ace
    ) {
        var PaperClaimTemplatesView = Backbone.View.extend({
            paperClaimTemplatesGridTemplate: _.template(PaperClaimTemplatesGrid),
            paperClaimTemplatesFormTemplate: _.template(PaperClaimTemplatesForm),
            paperClaimTemplatesList: [],
            model: null,
            paperClaimTemplatesTable: null,
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
                this.model = new PaperClaimTemplatesModel();
                this.pager = new Pager();
                this.templateType = [
                    { 'value': "direct_invoice", 'text': "Direct Invoice" },
                    { 'value': "patient_invoice", 'text': "Patient Invoice" },
                    { 'value': "paper_claim_full", 'text': "Paper Claim (B & W)" },
                    { 'value': "paper_claim_original", 'text': "Paper Claim (RED)" }

                ];
                this.paperClaimTemplatesList = new PaperClaimTemplatesCollections();
                $(this.el).html(this.paperClaimTemplatesGridTemplate());
            },

            render: function () {
                var self = this;
                $('#divPaperClaimTemplatesGrid').show();
                $('#divPaperClaimTemplatesForm').hide();

                var templateType = commonjs.buildGridSelectFilter({
                    arrayOfObjects: this.templateType,
                    searchKey: "value",
                    textDescription: "text",
                    sort: true
                });

                this.paperClaimTemplatesTable = new customGrid();
                this.paperClaimTemplatesTable.render({
                    gridelementid: '#tblPaperClaimTemplatesGrid',
                    custompager: new Pager(),
                    emptyMessage: 'No Record found',
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
                            route: '#setup/printer_templates/edit/',
                            formatter: function (e, model, data) {
                                return "<i class='icon-ic-edit' title='Edit'></i>"
                            }
                        },
                        {
                            name: 'del', width: 10, sortable: false, search: false,
                            className: 'icon-ic-delete',
                            customAction: function (rowID) {
                                if (confirm("Are you sure want to delete")) {
                                    var gridData = $('#tblPaperClaimTemplatesGrid').jqGrid('getRowData', rowID);
                                    self.model.set({ "id": rowID });
                                    self.model.destroy({
                                        data: $.param({name: gridData.name, templateType:gridData.template_type}),
                                        success: function (model, response) {
                                            commonjs.showStatus("Deleted Successfully");
                                            self.paperClaimTemplatesTable.refresh();
                                        },
                                        error: function (model, response) {
                                            commonjs.handleXhrError(model, response);
                                        }
                                    });
                                }
                            },
                            formatter: function (e, model, data) {
                                return "<i class='icon-ic-delete' title='Click here to delete'></i>"
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
                            var $row = $('#tblPaperClaimTemplatesGrid').find('#' + rowid);
                            $row.css('text-decoration', 'line-through');
                        }
                    },
                    datastore: self.paperClaimTemplatesList,
                    container: self.el,
                    customizeSort: true,
                    offsetHeight: 01,
                    sortname: "id",
                    sortorder: "desc",
                    sortable: {
                        exclude: '#jqgh_tblPaperClaimTemplatesGrid,#jqgh_tblPaperClaimTemplatesGrid_edit,#jqgh_tblPaperClaimTemplatesGrid_del'
                    },
                    dblClickActionIndex: 1,
                    disablesearch: false,
                    disablesort: false,
                    disablepaging: false,
                    showcaption: false,
                    disableadd: true,
                    disablereload: true,
                    pager: '#gridPager_PaperClaimTemplates'
                });

                commonjs.initializeScreen({
                    header: { screen: 'PaperClaimTemplates', ext: 'paperClaimTemplates' }, grid: { id: '#tblPaperClaimTemplatesGrid' }, buttons: [
                        {
                            value: 'Add', class: 'btn btn-danger', i18n: 'shared.buttons.add', clickEvent: function () {
                                Backbone.history.navigate('#setup/printer_templates/new', true);
                            }
                        },
                        {
                            value: 'Reload', class: 'btn', i18n: 'shared.buttons.reload', clickEvent: function () {
                                self.pager.set({ "PageNo": 1 });
                                self.paperClaimTemplatesTable.refreshAll();
                                commonjs.showStatus("Reloaded Successfully");
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
                $('#divPaperClaimTemplatesForm').html(this.paperClaimTemplatesFormTemplate());
                $('#divPaperClaimTemplatesGrid').hide();
                $('#divPaperClaimTemplatesForm').show();
                if (id > 0) {
                    this.model.set({ id: id });
                    this.model.fetch({
                        success: function (model, response) {
                            if (response && response.length > 0) {
                                var data = self.modelData = response[0];
                                if (data) {
                                    $('#txtTemplateName').val(data.name ? data.name : '');
                                    $('#chkActive').prop('checked', data.inactivated_dt ? true : false);
                                    $('#chkDefault').prop('checked', data.is_default ? true : false);
                                    $('#txtRightMargin').val(data.right_margin ? data.right_margin : 0);
                                    $('#txtLeftMargin').val(data.left_margin ? data.left_margin : 0),
                                        $('#txtTopMargin').val(data.top_margin ? data.top_margin : 0),
                                        $('#txtBottomMargin').val(data.bottom_margin ? data.bottom_margin : 0),
                                        self.templateData = data.template_content ? data.template_content : "{}";
                                    self.setEditorContents(self.templateData);
                                    $('#txtPageHeight').val(data.page_height ? data.page_height : 0);
                                    $('#txtPageWidth').val(data.page_width ? data.page_width : 0);
                                    $('#ddlTemplateType').val(data.template_type ? data.template_type : '');
                                }
                            }
                        }
                    });
                } else {
                    this.model = new PaperClaimTemplatesModel();
                    this.setEditorContents("var dd = { content: 'Test Data' }");
                }
                $('#aShowOriginalForm').parent('li:first').css(this.highlighClass);

                commonjs.initializeScreen({
                    header: { screen: 'PaperClaimTemplates', ext: 'paperClaimTemplates' }, buttons: [
                        {
                            value: 'LoaadDefaultTemplate', type: 'submit', class: 'btn btn-primary', i18n: 'shared.buttons.reloaddefault', clickEvent: function () {
                                self.reloadDefaultTemplate($("#ddlTemplateType").val());
                            }
                        },
                        {
                            value: 'Save', type: 'submit', class: 'btn btn-primary', i18n: 'shared.buttons.save', clickEvent: function () {
                                $("#txtTemplateName").val($.trim($('#txtTemplateName').val()) || null);
                                self.savePaperClaimTemplates(false);
                            }
                        },
                        {
                            value: 'Save and Close', type: 'submit', class: 'btn btn-primary', i18n: 'shared.buttons.saveAndClose', clickEvent: function () {
                                $("#txtTemplateName").val($.trim($('#txtTemplateName').val()) || null);
                                self.savePaperClaimTemplates(true);
                            }
                        },
                        {
                            value: 'Back', class: 'btn', i18n: 'shared.buttons.back', clickEvent: function () {
                                Backbone.history.navigate('#setup/printer_templates/list', true);
                            }
                        }
                    ]
                });
                commonjs.processPostRender();
            },

            savePaperClaimTemplates: function (doGoBack) {
                var self = this;
                self.doGoback = doGoBack;
                commonjs.validateForm({
                    rules: {
                        templateName: {
                            required: true
                        }
                        // templateType: {
                        //     requires: true
                        // }
                        // leftMargin: {
                        //     required: true
                        // },
                        // topMargin: {
                        //     required: true
                        // },
                        // rightMargin: {
                        //     required: true
                        // },
                        // bottomMargin: {
                        //     required: true
                        // }
                    },
                    messages: {
                        templateName: commonjs.getMessage("e", "Template Name")
                        // templateName: commonjs.getMessage("e", "Template type")
                        // leftMargin: commonjs.getMessage("e", "Margin Left"),
                        // topMargin: commonjs.getMessage("e", "Margin Top"),
                        // rightMargin: commonjs.getMessage("e", "Margin Right"),
                        // bottomMargin: commonjs.getMessage("e", "Margin Bottom")
                    },
                    submitHandler: function () {
                        self.save(self.doGoback);
                    },
                    formID: '#formPaperClaimTemplates'
                });
                $('#formPaperClaimTemplates').submit();
            },

            setEditorContents: function (content) {
                var timer;
                var lastGen, lastChanged;
                var self = this;
                var editor = ace.edit('paperClaimEditor');

                editor.setTheme();
                editor.setTheme("ace/theme/monokai");
                editor.getSession().setMode("ace/mode/javascript");
                $('#paperClaimEditor').height($('#data_container').outerHeight() - $('#formPaperClaimTemplates').outerHeight());
                editor.setValue(content);

                var pdfWorker = null;

                try {
                    pdfWorker = new Worker('/exa_modules/billing/static/js/workers/pdf.js');
                } catch (e) {
                    console.error(e);
                }

                generatePreview();

                editor.getSession().on('change', function (e) {
                    if (timer) {
                        clearTimeout(timer);
                    }

                    lastChanged = new Date();

                    timer = setTimeout(function () {
                        if (!lastGen || lastGen < lastChanged) {
                            generatePreview();
                        };
                    }, 300);
                });

                function showStatus(msg) {
                    $('#divPreviewLabel').html(msg);
                    $('#divPreviewLabel').show();
                    $('#ifrTemplatePreview').hide();
                }

                function generatePreview() {
                    lastGen = new Date();

                    try {
                        eval(editor.getSession().getValue());

                        $('#divPreviewLabel').hide();
                        $('#ifrTemplatePreview').show();

                        if (typeof dd === 'undefined') {
                            return showStatus('Invalid template');
                        }

                        if (!pdfWorker) {
                            return showStatus('Unable to render PDF');
                        }

                        pdfWorker.onmessage = function (res) {
                            document.getElementById('ifrTemplatePreview').src = res.data.pdfBlob;
                        };

                        pdfWorker.postMessage(dd);
                        return;

                        // pdfMake.createPdf(dd).getDataUrl(function (outDoc) {
                        //     document.getElementById('ifrTemplatePreview').src = outDoc;
                        // });
                    } catch (err) {
                        showStatus(err);
                        return;
                    }
                }
            },

            reloadDefaultTemplate: function (templateType) {
                var self = this;
                var templateNames = {
                    'direct_invoice': 'direct_invoice.template',
                    'patient_invoice': 'patient_Invoice.template',
                    'paper_claim_full': 'paper_claim_BW.template',
                    'paper_claim_original': 'paper_claim_red.template'
                };

                if (templateType) {
                    commonjs.showLoading();
                    $.ajax({
                        url: '/exa_modules/billing/static/resx/printer_templates/' + templateNames[templateType],
                        success: function (model, response) {
                            self.setEditorContents(model);
                            commonjs.hideLoading();
                        },
                        error: function (err, response) {
                            commonjs.handleXhrError(err, response);
                        }
                    });
                }
                else {
                    commonjs.showWarning('Select Template type');
                }
            },

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
                                commonjs.showStatus("Saved Successfully");
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
        return PaperClaimTemplatesView;
    });



