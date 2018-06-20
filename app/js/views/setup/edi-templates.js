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
                $('#editor').height($('#data_container').outerHeight() - ($('#ediHeaders').outerHeight() + $('#eraHeaderButtons').outerHeight() + $('#btnSaveDefinitionData').outerHeight()))
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
                    url: `/exa_modules/billing/setup/x12/${this.templateFlag}`,
                    type: 'GET',
                    success: function (data, response) {
                        if (data && data.length > 0) {
                            $('#ulTemlateList').empty();
                            for (var i = 0; i < data.length; i++) {
                                $('#ulTemlateList').append(
                                    $('<li/>').addClass('list-group-item').text(data[i]).css({ 'cursor': 'pointer' }).click(function () {
                                        self.getEDITemplate($(this).html());
                                    })
                                );
                            }
                            $('#divListTemplateContainer').css({
                                'top': '22%',
                                'left': '1%',
                                'z-index': '10',
                                'overflow-x': 'hidden'
                            });
                            $('#divlist').height($('#editor').height());
                            self.getEDITemplate(data[0]);
                        }
                    },
                    error: function (err) {
                        commonjs.showWarning(err);
                    }
                });
            },

            getEDITemplate: function (templateName) {
                var self = this;
                if (templateName) {
                    $.ajax({
                        url: `/exa_modules/billing/setup/x12/${this.templateFlag}/${templateName}`,
                        type: 'GET',
                        success: function (data, response) {
                            if (data) {
                                ace.edit('editor').setValue(JSON.stringify(data, null, '\t'));
                                $('#spnTemplateText').html(templateName);
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
                    url: `/exa_modules/billing/setup/x12/${this.templateFlag}/${templateName}`,
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
                    url: `/exa_modules/billing/setup/x12/${this.templateFlag}/${templateName}`,
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
                var templateName = $('#spnTemplateText').html();
                var editor = ace.edit('editor');
                if (templateName) {
                    $.ajax({
                        url: `/exa_modules/billing/setup/x12/${this.templateFlag}/${templateName}`,
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
