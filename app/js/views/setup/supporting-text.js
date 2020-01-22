define(['jquery',
    'immutable',
    'underscore',
    'backbone',
    'jqgrid',
    'jqgridlocale',
    'text!templates/setup/supporting-text-grid.html',
    'text!templates/setup/supporting-text-form.html',
    'collections/setup/supporting-text',
    'models/setup/supporting-text',
    'models/pager'
],
    function ($,
              Immutable,
              _,
              Backbone,
              JGrid,
              JGridLocale,
              SupportingTextGrid,
              SupportingTextForm,
              SupportingTextCollections,
              SupportingTextModel,
              Pager
        ) {
        var supportingTextView = Backbone.View.extend({
            supportingTextGridTemplate: _.template(SupportingTextGrid),
            supportingTextTemplate: _.template(SupportingTextForm),
            supportingTextList : [],
            itemTemplateName: '',
            itemSupportingText: '',
            templateAssociatedCptIds: [],
            templateAssociatedModifierIds: [],
            pendingNewCptId: '',
            pendingNewModifierId: '',
            model: null,
            supportingTextTable :null,
            pager: null,
            initialize: function (options) {
                var self = this;
                this.options = options;
                this.model = new SupportingTextModel();
                this.supportingTextList = new SupportingTextCollections();
                this.pager = new Pager();
                self.setEventListeners();
            },

            render: function() {
                var self = this;
                var confirmDelete = commonjs.geti18NString("messages.status.areYouSureWantToDelete");
                $('#divSupportingTextGrid').show();
                $('#divSupportingTextForm').hide();
                $(this.el).html(this.supportingTextGridTemplate({
                    billingRegionCode: app.billingRegionCode
                }));

                this.supportingTextTable = new customGrid();
                this.supportingTextTable.render({
                    gridelementid: '#tblSupportingTextGrid',
                    custompager: new Pager(),
                    emptyMessage: commonjs.geti18NString("messages.status.noRecordFound"),
                    colNames: ['','','','',''],
                    i18nNames: ['', '', '', 'setup.supportingText.templateName', 'setup.supportingText.supportingText' ],
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
                            width: 10,
                            sortable: false,
                            search: false,
                            className:'icon-ic-edit',
                            route: '#setup/supporting_text/edit/',
                            formatter: function(e, model, data) {
                                return "<i class='icon-ic-edit' i18nt='shared.buttons.edit'></i>"
                            }
                        },
                        {
                            name: 'del', width: 10, sortable: false, search: false,
                            className: 'icon-ic-delete',
                            customAction: function (rowID) {
                                if (confirm(confirmDelete)) {
                                    var gridData = $('#tblSupportingTextGrid').jqGrid('getRowData', rowID);
                                    self.model.set({ "id": rowID });
                                    self.model.destroy({
                                        data: $.param({templateName: gridData.template_name, supportingText:gridData.supporting_text}),
                                        success: function (model, response) {
                                            commonjs.showStatus("messages.status.deletedSuccessfully");
                                            self.supportingTextTable.refresh();
                                        },
                                        error: function (model, response) {
                                            commonjs.handleXhrError(model, response);
                                        }
                                    });
                                }
                            },
                            formatter: function(e, model, data) {
                                return "<i class='icon-ic-delete' i18nt='messages.status.clickHereToDelete'></i>"
                            }
                        },
                        {
                            name: 'template_name',
                        },
                        {
                            name: 'supporting_text',
                        }
                    ],
                    afterInsertRow: function (row_id, rData) {
                        commonjs.changeColumnValue('#tblSupportingTextGrid', row_id);
                    },
                    datastore: self.supportingTextList,
                    container:self.el,
                    customizeSort: true,
                    offsetHeight: 01,
                    sortname: "id",
                    sortorder: "desc",
                    sortable: {
                        exclude: '#jqgh_tblSupportingTextGrid,#jqgh_tblSupportingText_edit'
                    },
                    dblClickActionIndex: 1,
                    disablesearch: false,
                    disablesort: false,
                    disablepaging: false,
                    showcaption: false,
                    disableadd: true,
                    disablereload: true,
                    pager: '#gridPager_SupportingText'
                });

                commonjs.initializeScreen({header: {screen: 'SupportingText', ext: 'supportingText'}, grid: {id: '#tblSupportingTextGrid'}, buttons: [
                    {value: 'Add', class: 'btn btn-danger', i18n: 'shared.buttons.add', clickEvent: function () {
                        Backbone.history.navigate('#setup/supporting_text/new', true);
                    }},
                    {value: 'Reload', class: 'btn', i18n: 'shared.buttons.reload', clickEvent: function () {
                        self.pager.set({"PageNo": 1});
                        self.supportingTextTable.refreshAll();
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
                self.templateAssociatedCptIds = [];
                self.templateAssociatedModifierIds = [];
                $('#divSupportingTextForm').html(this.supportingTextTemplate());
                if(id > 0) {
                    this.model.set({id: id});
                    this.model.fetch({
                        success: function (model, response) {
                            $('#textTemplateName').val(response && response[0] ? response[0].template_name : '')
                            $('#textSupportingText').val(response && response[0] ? response[0].supporting_text : '')
                            self.templateAssociatedCptIds = response && response[0] ? response[0].cpt_ids : [],
                            self.templateAssociatedModifierIds = response && response[0] ? response[0].modifier_ids : [],
                            self.refreshTags();
                        }
                    });
                } else {
                    this.model = new SupportingTextModel();
                }

                commonjs.initializeScreen({header: {screen: 'SupportingText', ext: 'supportingText'}, buttons: [
                    {value: 'Save', type: 'submit', class: 'btn btn-primary', i18n: 'shared.buttons.save', clickEvent: function () {
                        self.save();
                    }},
                    {value: 'Back', class: 'btn', i18n: 'shared.buttons.back', clickEvent: function () {
                        Backbone.history.navigate('#setup/supporting_text/list', true);
                    }}
                ]});
                $('#divSupportingTextGrid').hide();
                $('#divSupportingTextForm').show();
                commonjs.processPostRender();

                self.populateCptDropdown();
                self.populateModifierDropdown();

            },

            // BEGIN EVENT LISTENER FUNCTIONS

            setEventListeners: function() {
                var self = this;

                //Adding a new cpt
                $(document).on('click', '#btnAddNewCpt', function() {
                    if (self.pendingNewCptId) {
                        self.addTag('cpt', self.pendingNewCptId);
                        self.pendingNewCptId = '';
                    }
                })

                //Adding a new modifier
                $(document).on('click', '#btnAddNewModifier', function() {
                    if (self.pendingNewModifierId) {
                        self.addTag('modifier', self.pendingNewModifierId);
                        self.pendingNewModifierId = '';
                    }
                })

                //Removing a cpt or modifier
                $(document).on('click', '.remove-tag', function() {
                    if ($(this).attr('data-type') === 'cpt') {
                        self.removeTag('cpt', $(this).attr('data-id') );
                    }
                    else if ($(this).attr('data-type') === 'modifier') {
                        self.removeTag('modifier', $(this).attr('data-id'));
                    }
                })

            },

            // BEGIN AUTOCOMPLETE FUNCTIONS

            populateCptDropdown: function() {
                var self = this;
                var $ddlAssociatedCpts = $('#ddlAssociatedCpts');
                $ddlAssociatedCpts.select2({
                    ajax: {
                        url: "/exa_modules/billing/setup/supporting_text/autocompleteCpts",
                        dataType: 'json',
                        delay: 250,
                        data: function (params) {
                            return {
                                page: params.page || 1,
                                term: params.term || '',
                                pageSize: 10,
                                sortField: "display_code",
                                sortOrder: "ASC",
                                groupType: 'OF',
                                company_id: app.companyID
                            };
                        },
                        processResults: function (data, params) {
                            return commonjs.getTotalRecords(data, params);
                        },
                        cache: true
                    },
                    placeholder: 'CPT Code',
                    escapeMarkup: function (markup) { return markup; },
                    minimumInputLength: 0,
                    templateResult: function(res) {
                        if (res.loading) {
                            return res.text;
                        }
                        var markup = "<table class='ref-result' style='width: 100%'><tr>";
                        markup += "<td><div><b>" + res.short_description + ' (' + res.display_code + ')' + "</b></div>";
                        markup += "</td></tr></table>";
                        return markup;
                    },
                    templateSelection: function(res) {
                        if (res && res.id) {
                            self.pendingNewCptId = parseInt(res.id)
                            return res.short_description;
                        }
                    }
                });
            },

            populateModifierDropdown: function() {
                var self = this;
                var $ddlAssociatedModifiers = $('#ddlAssociatedModifiers');
                $ddlAssociatedModifiers.select2({
                    ajax: {
                        url: "/exa_modules/billing/setup/supporting_text/autocompleteModifiers",
                        dataType: 'json',
                        delay: 250,
                        data: function (params) {
                            return {
                                page: params.page || 1,
                                term: params.term || '',
                                pageSize: 10,
                                sortField: "description",
                                sortOrder: "ASC",
                                company_id: app.companyID
                            };
                        },
                        processResults: function (data, params) {
                            return commonjs.getTotalRecords(data, params);
                        },
                        cache: true
                    },
                    placeholder: 'Modifier',
                    escapeMarkup: function (markup) { return markup; },
                    minimumInputLength: 0,
                    templateResult: function(res) {
                        if (res.loading) {
                            return res.text;
                        }
                        var markup = "<table class='ref-result' style='width: 100%'><tr>";
                        markup += "<td><div><b>" + res.description + "</b></div>";
                        markup += "</td></tr></table>";
                        return markup;
                    },
                    templateSelection: function(res) {
                        if (res && res.id) {
                            self.pendingNewModifierId = parseInt(res.id)
                            return res.description;
                        }
                    }
                });
            },

            // BEGIN TAG FUNCTIONS

            drawTag: function(receivingDivId, type, label, dataId) {
                var $tag = $('<li></li>')
                var $label = $('<span>' + label + '</span>')
                var $deleter = $('<span class="remove-tag" data-type="' + type + '" data-id="' + dataId + '" style="margin-left: 15px">X</span>')

                $tag.append($label)
                $tag.append($deleter)

                $(receivingDivId).append($tag);
            },

            addTag: function(type, value) {
                var self = this;
                if (type === 'cpt' && self.templateAssociatedCptIds.indexOf(value) === -1) {
                    self.templateAssociatedCptIds.push(value)
                }
                else if (type === 'modifier' && self.templateAssociatedModifierIds.indexOf(value) === -1) {
                    self.templateAssociatedModifierIds.push(value)
                }
                self.refreshTags();
            },

            removeTag: function(type, dataId) {
                var self = this;
                if (type === 'cpt') {
                    var idIndex = self.templateAssociatedCptIds.indexOf(parseInt(dataId))
                    if (idIndex !== -1) {
                        self.templateAssociatedCptIds.splice(idIndex, 1)
                    }
                }
                else if (type === 'modifier') {
                    var idIndex = self.templateAssociatedModifierIds.indexOf(parseInt(dataId))
                    if (idIndex !== -1) {
                        self.templateAssociatedModifierIds.splice(idIndex, 1)
                    }
                }
                self.refreshTags();
            },

            refreshTags: function() {
                var self = this;
                console.log('refreshing tags')
                self.expandCptLabels();
                self.expandModifierLabels();
            },

            // BEGIN LABEL FUNCTIONS

            expandCptLabels: function(id) {
                var self = this;
                $.ajax({
                    url: '/exa_modules/billing/setup/supporting_text/labelCpts/',
                    method: 'POST',
                    data: {
                        cpt_ids: self.templateAssociatedCptIds
                    }
                }).then(function (response) {
                    $('#containerAssociatedCptCodes').empty();
                    for (var i = 0; i < response.length; i++) {
                        self.drawTag('#containerAssociatedCptCodes', 'cpt', response[i].short_description + ' (' + response[i].display_code + ')', response[i].id);
                    }
                })
            },

            expandModifierLabels: function(id) {
                var self = this;
                $.ajax({
                    url: '/exa_modules/billing/setup/supporting_text/labelModifiers/',
                    method: 'POST',
                    data: {
                        modifier_ids: self.templateAssociatedModifierIds
                    }
                }).then(function (response) {
                    $('#containerAssociatedModifiers').empty();
                    for (var i = 0; i < response.length; i++) {
                        self.drawTag('#containerAssociatedModifiers', 'modifier', response[i].description, response[i].id);
                    }
                })
            },

            // BEGIN SAVE FUNCTION

            save: function () {
                var self = this;
                this.model.set({
                    "templateName": $.trim($('#textTemplateName').val()),
                    "supportingText": $.trim($('#textSupportingText').val()),
                    "associatedCptsIds": self.templateAssociatedCptIds,
                    "associatedModifiersIds": self.templateAssociatedModifierIds,
                    "companyId" : app.companyID
                });
                this.model.save({
                }, {
                    success: function (model, response) {
                        if(response) {
                            commonjs.showStatus('messages.status.savedSuccessfully');
                            location.href = "#setup/supporting_text/list";
                        }
                    },
                    error: function (model, response) {
                        commonjs.handleXhrError(model, response);
                    }
                });
            }

        });
        return supportingTextView;
    });

