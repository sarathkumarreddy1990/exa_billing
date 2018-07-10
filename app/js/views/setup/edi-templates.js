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
                'click #aShowEraTemplates': 'showERATemplates'
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
                                        'height': $('#editor').height(),
                                        'overflow-x': 'hidden'
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
                                ace.edit('editor').setValue("{}");
                                if(data && data.error) {
                                    commonjs.showWarning("Unable To Connect EDI Server");
                                }
                            }
                        }
                    },
                    error: function (err) {
                        commonjs.showWarning(err);
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
                        success: function (data, response) {
                            if (data) {
                                ace.edit('editor').setValue(JSON.stringify(data, null, '\t'));
                                if(self.templateFlag == 'edi') {
                                    self.setTemplateInLocalStorage('EDITEMPLATE', templateName);
                                }
                                $('#dropdownMenuButton').html(templateName);
                            }
                        },
                        error: function (err) {
                            commonjs.showWarning(err);
                        }
                    });
                }
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
                $('#lblTempHeader').html("Delete Templates");
                $('#btnTemplateAction').html("DELETE TEMPLATE");
                $('#divTemplateCreator').show();
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
                        commonjs.showWarning(err);
                    }
                });
            },

            deleteTrigger: function (templateName) {
                var self = this;
                $.ajax({
                    url: '/exa_modules/billing/setup/x12/' + this.templateFlag + '/' + templateName,
                    type: 'DELETE',
                    success: function (data, response) {
                        commonjs.showStatus("Deleted Successfully");
                        self.cancel();
                        self.getAllEDITemplates();
                    },
                    error: function (err) {
                        commonjs.showWarning(err);
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

            saveDefinitionData: function () {
                var templateName = $('#dropdownMenuButton').html();
                var editor = ace.edit('editor');
                if (templateName) {
                    $.ajax({
                        url: '/exa_modules/billing/setup/x12/' + this.templateFlag + '/' + templateName,
                        type: 'PUT',
                        data:JSON.stringify({
                            templateBody: JSON.parse(editor.getValue())
                        }),
                        contentType : "application/json",
                        dataType : "json",
                        success: function (data, response) {
                            commonjs.showStatus("UpdatedSuccessfully");
                        },
                        error: function (err) {
                            commonjs.showWarning(err);
                        }
                    });
                }
            }
        });
        return EDITemplatesView;
    });
