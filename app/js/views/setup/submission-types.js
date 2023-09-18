define(['jquery',
    'underscore',
    'backbone',
    'text!templates/setup/submission-types-grid.html',
    'text!templates/setup/submission-types-form.html',
    'collections/setup/submission-types',
    'models/setup/submission-types',
    'models/pager',
    'text!templates/provinceSelect.html',
    '../../shared/address'
],
    function ($,
        _,
        Backbone,
        SubmissionTypesGrid,
        SubmissionTypesForm,
        SubmissionTypesCollections,
        SubmissionTypesModel,
        Pager,
        ProvinceSelect,
        Address
    ) {
        var submissionTypesView = Backbone.View.extend({
            submissionTypesGridTemplate: _.template(SubmissionTypesGrid),
            submissionTypesFormTemplate: _.template(SubmissionTypesForm),
            provinceSelectTemplate: _.template(ProvinceSelect),
            model: null,
            submissionTypesTable: null,
            pager: null,
            countries: { '': 'All', 'USA': 'United States', 'CAN': 'Canada'},
            provincesForCanada: ["AB", "BC", "MB", "ON", "QC"],
            events: {
                'change #ddlCountry': 'onChangeCountry'
            },

            initialize: function (options) {
                this.options = options;
                this.model = new SubmissionTypesModel();
                this.pager = new Pager();
                this.submissionTypesList = new SubmissionTypesCollections();
                $(this.el).html(this.submissionTypesGridTemplate());
            },

            render: function () {
                var self = this;
                var confirmDelete = commonjs.geti18NString("messages.status.areYouSureWantToDelete");

                $('#divSubmissionTypesGrid').show();
                $('#divSubmissionTypesForm').hide();
                this.submissionTypesTable = new customGrid();

                this.submissionTypesTable.render({
                    gridelementid: '#tblSubmissionTypesGrid',
                    custompager: new Pager(),
                    emptyMessage: commonjs.geti18NString("messages.status.noRecordFound"),
                    colNames: ['', '', '', '', '', '', '', ''],
                    i18nNames: ['', '', '', 'setup.common.code', 'setup.common.description', 'setup.common.country', 'setup.common.province', 'is_active'],
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
                            width: 25,
                            sortable: false,
                            search: false,
                            className: 'icon-ic-edit',
                            route: '#setup/submission_types/edit/',
                            formatter: function () {
                                return "<i class='icon-ic-edit' i18nt='shared.buttons.edit'></i>"
                            }
                        },
                        {
                            name: 'del', width: 25, sortable: false, search: false,
                            className: 'icon-ic-delete',
                            customAction: function (rowID) {
                                if (confirm(confirmDelete)) {
                                    var gridData = $('#tblSubmissionTypesGrid').jqGrid('getRowData', rowID);
                                    self.model.set({ "id": rowID });
                                    self.model.destroy({
                                        data: $.param({ code: gridData.code }),
                                        success: function () {
                                            commonjs.showStatus("messages.status.deletedSuccessfully");
                                            self.submissionTypesTable.refresh();
                                        },
                                        error: function (model, response) {
                                            commonjs.handleXhrError(model, response);
                                        }
                                    });
                                }
                            },
                            formatter: function () {
                                return "<i class='icon-ic-delete' i18nt='messages.status.clickHereToDelete'></i>"
                            }
                        },
                        {
                            name: 'code',
                            searchFlag: '%'
                        },
                        {
                            name: 'description',
                            searchFlag: '%'
                        },
                        {
                            name: 'country_code',
                            searchFlag: '%',
                            stype: 'select',
                            searchoptions: {
                                value: self.countries,
                                dataEvents: [
                                    { type: 'change', fn: function (e) { self.onChangeCountryGrid(e.target.value); }}
                                ]
                            }
                        },
                        {
                            name: 'province_code',
                            searchFlag: '%',
                            stype: 'select',
                            searchoptions: {
                                value: this.getProvinces()
                            }
                        },
                        {
                            name: 'inactivated_dt',
                            hidden: true
                        }
                    ],
                    afterInsertRow: function (rowId, rowData) {
                        var gridRow = $('#tblSubmissionTypesGrid #' + rowId);

                        if (rowData.inactivated_dt) {
                            gridRow.css('text-decoration', 'line-through');
                        }
                    },
                    datastore: self.submissionTypesList,
                    container: self.el,
                    customizeSort: true,
                    offsetHeight: 1,
                    sortname: "id",
                    sortorder: "desc",
                    sortable: {
                        exclude: '#jqgh_tblSubmissionTypesGrid,#jqgh_tblSubmissionTypesGrid_edit,#jqgh_tblSubmissionTypesGrid_del'
                    },
                    dblClickActionIndex: 1,
                    disablesearch: false,
                    disablesort: false,
                    disablepaging: false,
                    showcaption: false,
                    disableadd: true,
                    disablereload: true,
                    pager: '#gridPager_SubmissionTypes'
                });

                commonjs.initializeScreen({header: {screen: 'SubmissionTypes', ext: 'submissionTypes'}, grid: {id: '#tblSubmissionTypesGrid'}, buttons: [
                    {value: 'Add', class: 'btn btn-danger', i18n: 'shared.buttons.add', clickEvent: function () {
                        Backbone.history.navigate('#setup/submission_types/new', true);
                    }},
                    {value: 'Reload', class: 'btn', i18n: 'shared.buttons.reload', clickEvent: function () {
                        self.pager.set({"PageNo": 1});
                        self.submissionTypesTable.refreshAll();
                        commonjs.showStatus("messages.status.reloadedSuccessfully");
                    }}
                ]});
            },

            renderForm: function(id) {
                var self = this;

                if (id) {
                    this.model.set({id: id});
                    this.model.fetch({
                        success: function (model, response) {
                            if (response && response.length) {
                                var data = response[0];

                                if (data) {
                                    self.bindForm(data.country_code);

                                    $('#txtCode').val(data.code || '');
                                    $('#txtDescription').val(data.description || '');
                                    $('#ddlCountry').val(data.country_code || '');
                                    $('#ddlProvince').val(data.province_code || '');
                                    $('#chkInActive').prop('checked', data.inactivated_dt || false);
                                }
                            }
                        }
                    });
                } else {
                    this.bindForm('USA');
                    this.model = new SubmissionTypesModel();
                }

                commonjs.initializeScreen({header: {screen: 'SupportingText', ext: 'supportingText'}, buttons: [
                    {value: 'Save', type: 'submit', class: 'btn btn-primary', i18n: 'shared.buttons.save', clickEvent: function () {
                        self.save();
                    }},
                    {value: 'Back', class: 'btn', i18n: 'shared.buttons.back', clickEvent: function () {
                        Backbone.history.navigate('#setup/submission_types/list', true);
                    }}
                ]});

                $('#divSubmissionTypesGrid').hide();
                $('#divSubmissionTypesForm').show();
            },

            bindForm: function (countryCode) {
                $('#divSubmissionTypesForm').html(this.submissionTypesFormTemplate({
                    billingRegionCode: app.billingRegionCode,
                    countryCode: app.country_alpha_3_code,
                    countries: app.countries
                }));

                this.bindProvinceSelect(countryCode);
            },

            onChangeCountry: function (e) {
                $('#ddlProvince').empty();
                this.bindProvinceSelect(e.target.value);
            },

            bindProvinceSelect: function (countryCode) {
                $('#subTypesProvinceSelect').html(this.provinceSelectTemplate({
                    provinces: this.getProvinces(countryCode)
                }));
                commonjs.processPostRender();
            },

            onChangeCountryGrid: function (value) {
                var provinces = this.getProvinces(value);
                var provinceSelectOptions;

                _.each(provinces, function (value, key) {
                    provinceSelectOptions += '<option value="' + key + '">' + value + '</option>';
                });

                $('#gs_province_code').empty().html(provinceSelectOptions);
            },

            getProvinces: function(value) {
                var provincesArray = (value === 'CAN' && this.provincesForCanada) || (value === 'USA' && Address.getCountryByAlpha3Code('usa').provinces)
                                || Address.getCountryByAlpha3Code('usa').provinces.concat(this.provincesForCanada);

                var provinces =  _.reduce(provincesArray, function (result, data) {
                    result[data] = data;
                    return result;
                }, {});

                return _.extend({'': 'All'}, provinces);
            },

            save: function () {
                var submissionTypesData = {
                    code: $('#txtCode').val(),
                    description: $('#txtDescription').val(),
                    countryCode: $('#ddlCountry').val(),
                    provinceCode: $('#ddlProvince').val()
                };

                var missingField = _.findKey(submissionTypesData, function (value) {
                    return !value;
                });

                if (missingField) {
                    commonjs.showWarning('setup.submissionTypes.' + missingField);
                    return;
                }

                this.model.set({
                    "code": submissionTypesData.code,
                    "description": submissionTypesData.description,
                    "country_code": submissionTypesData.countryCode,
                    "province_code": submissionTypesData.provinceCode,
                    "isInActive": $('#chkInActive').prop('checked'),
                    "companyId": app.companyID
                });

                this.model.save({
                }, {
                        success: function (model, response) {
                            if (response) {
                                commonjs.showStatus("messages.status.savedSuccessfully");
                                location.href = "#setup/submission_types/list";
                            }
                        },
                        error: function (model, response) {
                            commonjs.handleXhrError(model, response);
                        }
                    });
            }
        });

        return submissionTypesView;
    });



