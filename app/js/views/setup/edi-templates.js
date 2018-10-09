define([
    'jquery',
    'underscore',
    'backbone',
    'ace/ace',
    'text!templates/setup/edi-templates.html']
    , function ($, _, Backbone, ace, EDITemplates) {
        var EDITemplatesView = Backbone.View.extend({
            ediTemplates: _.template(EDITemplates),
            templateFlag: 'edi',
            templateLists: [],
            highlighClass: {
                'background': '#bbddff', 'border-radius': '6px'
            },
            events: {
                'click #divChooseEDITemplates': 'chooseEDITemplates',
                'click #btnCreateNewTemplate': 'createNewTemplate',
                'click #btnDeleteTemplate': 'deleteTemplate',
                'click #btnTemplateAction': 'templateAction',
                'click #btnCancel': 'cancel',
                'click #btnSaveDefinitionData': 'saveDefinitionData',
                'click #aShowEdiTemplates': 'showEDITemplates',
                'click #aShowEraTemplates': 'showERATemplates',
                'click #btnLoadDefaultTemplate' : 'loadDefaultTemplate'
            },

            initialize: function (options) {
                var self = this;
                this.options = options;
                $('#divPageHeaderButtons').empty();
                $('#data_container').height(window.innerHeight - (20 + $('.navbar').outerHeight() + $('#divPageHeaderButtons').outerHeight() + 20))
            },

            showForm: function (id) {
                var self = this;
                this.renderForm();
            },

            renderForm: function () {
                var self = this;
                $(this.el).html(this.ediTemplates());
                var editor = ace.edit("editor");
                editor.setTheme();
                editor.setTheme("ace/theme/monokai");
                editor.getSession().setMode("ace/mode/javascript");
                $('#editor').height($('#data_container').outerHeight() - ($('#navEraTempltes').outerHeight() + $('#ediHeaders').outerHeight() + $('#eraHeaderButtons').outerHeight() + $('#btnSaveDefinitionData').outerHeight()) - 20)
                commonjs.processPostRender();
                $('#aShowEdiTemplates').parent('li:first').css(this.highlighClass);
                $('#data_container').click(function () {
                    if ($('#divListTemplateContainer').is(':visible'))
                        $('#divListTemplateContainer').hide();
                });
                this.getAllEDITemplates();
            },

            getAllEDITemplates: function () {
                var self = this;
                $.ajax({
                    url: '/exa_modules/billing/setup/x12/' + this.templateFlag,
                    type: 'GET',
                    success: function (data, response) {
                        if (!self.checkEditorIsOn())
                            return;
                            
                        $('#divTemlateList').empty();
                        if (self.templateFlag == 'edi') {
                            if (data && data.length > 0) {
                                $('#dropdownMenuButton').addClass('dropdown-toggle').prop('disabled',false);
                                $('#btnCreateNewTemplate,#btnDeleteTemplate,#dropdownMenuButton').show();
                                self.templateLists = data;
                                for (var i = 0; i < data.length; i++) {
                                    $('#divTemlateList').append(
                                        $('<a/>').attr('href', 'javascript:void(0)').addClass('dropdown-item').text(data[i]).css({
                                            'cursor': 'pointer',
                                            'padding': '5px'
                                        }).click(function () {
                                            self.getEDITemplate($(this).html());
                                        })
                                    );
                                    $('#divTemlateList').css({
                                        'height': 'auto', 'max-height': '200px', 'overflow-x': 'hidden'
                                    });
                                }
                                var ediTemplate = self.getTemplateFromLocalStroage('EDITEMPLATE');
                                if(ediTemplate && !self.templateExists(ediTemplate,self.templateLists)) {
                                    ediTemplate = null;
                                }
                                self.getEDITemplate(ediTemplate ? ediTemplate :self.templateLists[0]);
                            } else {
                                if(data && data.error) {
                                    commonjs.showWarning("Unable To Connect EDI Server");
                                } else {
                                    commonjs.showWarning("No EDI Templates found");
                                }
                            }
                        } else {
                            $('#dropdownMenuButton').prop('disabled',true).removeClass('dropdown-toggle btn-secondary').addClass('btn-primary');
                            $('#btnDeleteTemplate').hide();
                            if (data && data.length > 0) {
                                self.getEDITemplate(data[0]);
                                $('#btnCreateNewTemplate').hide();
                                $('#dropdownMenuButton').show();
                            } else {
                                $('#btnCreateNewTemplate').show();
                                $('#dropdownMenuButton').hide();
                                ace.edit('editor').setValue("{}", 1);
                                if(data && data.error) {
                                    commonjs.showWarning("Unable To Connect EDI Server");
                                } else {
                                    commonjs.showWarning("No ERA Templates found");
                                }
                            }
                        }
                    },
                    error: function (err) {
                        commonjs.handleXhrError(err);
                    }
                });
            },

            templateExists: function (templateName, templateList) {
                var isExists = false;
                var matchedTemplate = templateList.filter(function (template) {
                    return template.toLowerCase() == templateName.toLowerCase();
                });
                if (matchedTemplate && matchedTemplate.length && matchedTemplate[0].toLowerCase() == templateName.toLowerCase()) {
                    isExists = true;
                }
                return isExists;
            },

            setTemplateInLocalStorage: function (flag, template) {
                localStorage.setItem(flag, template);
            },

            getTemplateFromLocalStroage: function (flag) {
                return localStorage.getItem(flag);
            },

            getEDITemplate: function (templateName) {
                var self = this;
                if (templateName) {
                    $.ajax({
                        url: '/exa_modules/billing/setup/x12/' + this.templateFlag + '/' + templateName,
                        type: 'GET',
                        success: function (data) {
                            if (!self.checkEditorIsOn())
                                return;

                            if(data.err) {
                                return commonjs.showWarning(data.err);
                            }
                            if (data) {
                                ace.edit('editor').setValue(JSON.stringify(data, null, '\t'), 1);
                                if(self.templateFlag == 'edi') {
                                    self.setTemplateInLocalStorage('EDITEMPLATE', templateName);
                                }
                                $('#dropdownMenuButton').html(templateName);
                            }
                        },
                        error: function (err) {
                            commonjs.handleXhrError(err);
                        }
                    });
                } else {
                    var data = {};
                    $('#dropdownMenuButton').html("");
                    ace.edit('editor').setValue(JSON.stringify(data, null, '\t'), 1);
                    commonjs.showWarning("No more templates to load");
                }
            },

            loadDefaultTemplate: function() {
                var editerData = ace.edit('editor').getValue();
                if(editerData) {
                    if(confirm(commonjs.geti18NString('setup.ediTemplates.isLoadDefaultTemplate'))) {
                        this.getDefaultTemplate();
                    }
                } else {
                    this.getDefaultTemplate();
                }
            },

            getDefaultTemplate: function() {
                $.ajax({
                    url: '/exa_modules/billing/setup/x12/default/' + this.templateFlag,
                    type: 'GET',
                    success: function (data) {
                        if (!self.checkEditorIsOn())
                            return;

                        if(data && data.err) {
                            return commonjs.showWarning(err);
                        }
                        if (data) {
                            ace.edit('editor').setValue(JSON.stringify(data, null, '\t'), 1);
                            commonjs.showStatus("Default template loaded sucessfully");
                        }
                    },
                    error: function (err) {
                        commonjs.handleXhrError(err);
                    }
                });
            },

            showEDITemplates: function () {
                this.templateFlag = 'edi';
                $('#aShowEdiTemplates').parent('li:first').css(this.highlighClass);
                $('#aShowEraTemplates').parent('li:first').css({ 'background': 'none' });
                this.getAllEDITemplates();
            },

            showERATemplates: function () {
                this.templateFlag = 'era';
                $('#aShowEdiTemplates').parent('li:first').css({ 'background': 'none' });
                $('#aShowEraTemplates').parent('li:first').css(this.highlighClass);
                this.getAllEDITemplates();
            },

            createNewTemplate: function () {
                $('#lblTempHeader').html("Template Creation");
                $('#btnTemplateAction').html("SAVE TEMPLATE");
                $('#divTemplateCreator').show();
            },

            deleteTemplate: function () {
                var templateName = $('#dropdownMenuButton').html();
                if (this.templateExists(templateName, this.templateLists) && confirm("Do you want to delete " + templateName)) {
                    this.deleteTrigger(templateName);
                } else {
                    commonjs.showWarning("No more templates to delete");
                }
            },

            templateAction: function (e) {
                var self = this;
                var templateName = $('#txtTemplateName').val();
                if (templateName) {
                    if ($(e.target).html() == 'SAVE TEMPLATE') {
                        if (self.templateLists && self.templateLists.length && self.templateExists(templateName, self.templateLists)) {
                            $('#txtTemplateName').focus();
                            return commonjs.showWarning("Template name already exists");
                        }
                        self.saveTrigger(templateName);
                    } else {
                        self.deleteTrigger(templateName);
                    }
                } else {
                    commonjs.showWarning("Enter Template Name");
                    $('#txtTemplateName').focus();
                }
            },

            saveTrigger: function (templateName) {
                var self = this;
                $.ajax({
                    url: '/exa_modules/billing/setup/x12/' + this.templateFlag + '/' + templateName,
                    type: 'POST',
                    success: function (data, response) {
                        commonjs.showStatus("Successfully Saved");
                        self.cancel();
                        self.getAllEDITemplates();
                    },
                    error: function (err) {
                        commonjs.handleXhrError(err);
                    }
                });
            },

            deleteTrigger: function (templateName) {
                var self = this;
                $.ajax({
                    url: '/exa_modules/billing/setup/x12/' + this.templateFlag + '/' + templateName,
                    type: 'DELETE',
                    success: function (data, response) {
                        if(data.err){
                            if(data.err.indexOf("edi_clearinghouses_edi_template_id_fk") > -1) {
                                return commonjs.showError('Dependent records found');
                            }
                            commonjs.handleXhrError(data.err);
                        }else{
                            commonjs.showStatus("Deleted Successfully");
                            self.cancel();
                            self.getAllEDITemplates();
                        }
                    },
                    error: function (err) {
                        commonjs.handleXhrError(err);
                    }
                });
            },

            cancel: function () {
                $('#txtTemplateName').val('');
                $('#divTemplateCreator').hide();
            },

            chooseEDITemplates: function (e) {
                e.stopImmediatePropagation();
                $('#divListTemplateContainer').show();
            },

            checkEditorIsOn: function () {
                return $('#editor').length;
            },
               
            saveDefinitionData: function () {
                var templateName = $('#dropdownMenuButton').html();
                var editor = ace.edit('editor');
                var editerData=editor.getValue();
                if(editerData && templateName){
                    try {
                        editerData = JSON.parse(editerData);
                    } catch (e) {
                        commonjs.showWarning("Invalid Json Format");
                        return false;
                    }
                    $.ajax({
                        url: '/exa_modules/billing/setup/x12/' + this.templateFlag + '/' + templateName,
                        type: 'PUT',
                        data:JSON.stringify({
                            templateBody: editerData
                        }),
                        contentType : "application/json",
                        dataType : "json",
                        success: function (data, response) {
                            commonjs.showStatus("UpdatedSuccessfully");
                        },
                        error: function (err) {
                            commonjs.handleXhrError(err);
                        }
                    });
                } else {
                    commonjs.showWarning("Please enter valid json");
                }
            }
        });
        return EDITemplatesView;
    });
