define(['jquery',
    'immutable',
    'underscore',
    'backbone',
    'jqgrid',
    'jqgridlocale',
    'text!templates/census.html',
    'collections/census',
    'models/pager',],
    function ($,
        Immutable,
        _,
        Backbone,
        JGrid,
        JGridLocale,
        censusHTML,
        censusCollection,
        Pager) {

        return Backbone.View.extend({
            currentIdleCallback: null,
            el: null,
            pager: null,
            model: null,
            template: null,
            pagerData: null,
            gridI18nText: [
                '',
                '',
                '',
                '',
                '',
                '',
                '',
                '',
                '',
                '',
                'billing.payments.orderingFacilityLocation',
                'billing.payments.mrn',
                'shared.fields.accessionNumber',
                'billing.fileInsurance.patientNameGrid',
                'report.reportFilter.dateOfService',
                'home.sendStudies.studyDesc',
                'shared.fields.censusType'
            ],
            censusType: [
                { value: '', text: 'shared.options.select' },
                { value: 'global', text: 'shared.fields.global' },
                { value: 'split', text: 'shared.fields.split' },
                { value: 'facility', text: 'shared.screens.setup.facility' },
            ],
            events: {
                'click #btnSelectAllCensus': 'checkAll',
                'click #btnClearAllCensus': 'clearAllChk',
                'change #ddlOrdFacility': 'loadOrderingFacilityNotes',
                'click #btnSaveNotes': 'saveOrderingFacilityNotes',
                'click #btnCreateClaim': 'updateBillingType',
                'click #btnValidateExportCensus': 'exportCensus'
            },

            initialize: function (options) {
                this.options = options;
                var self = this;
                this.censusCollectionList = new censusCollection();
                this.censusPager = new Pager();
                self.routePrefix = '#billing/census/list';
                $(window).on("resize", this.resize.bind(this));
            },

            render: function () {
                var self = this;
                self.template = _.template(censusHTML);
                self.$el.html(self.template());
                var censusHeaders = $('#censusHeaders');
                var censusListTab = $('#censusListTab');
                censusListTab.addClass('active');
                censusHeaders.show();
                commonjs.tinyMceLoad(this.initializeEditor.bind(this));
                $('#btnSaveNotes').attr({ 'disabled': true });
                self.setOrderingFacilityAutoComplete();
                self.showCensusGrid();
                commonjs.processPostRender();
            },

            setOrderingFacilityAutoComplete: function () {
                var self = this;
                $('#ddlOrdFacility').select2({
                    ajax: {
                        url: "/exa_modules/billing/autoCompleteRouter/ordering_facilities",
                        dataType: 'json',
                        delay: 250,
                        data: function (params) {
                            return {
                                page: params.page || 1,
                                q: params.term || '',
                                pageSize: 10,
                                sortField: "name",
                                sortOrder: "ASC",
                                company_id: app.companyID
                            };
                        },
                        processResults: function (data, params) {
                            return commonjs.getTotalRecords(data, params);
                        },
                        cache: true
                    },
                    placeholder: 'Ordering Facility',
                    escapeMarkup: function (markup) { return markup; }, // let our custom formatter work
                    minimumInputLength: 0,
                    templateResult: formatRepo,
                    templateSelection: formatRepoSelection
                });
                function formatRepo(repo) {
                    if (repo.loading) {
                        return repo.text;
                    }
                    var markup = "<table class='ref-result' style='width: 100%'><tr>";
                    markup += "<td data-id='" + repo.id + "' title='" + repo.ordering_facility_name + "class='movie-info'><div class='movie-title'><b>" + repo.ordering_facility_name + "</b></div>";
                    markup += "</td></tr></table>";
                    return markup;
                }
                function formatRepoSelection(res) {
                    self.ordering_facility_name = res.ordering_facility_name;
                    self.ordering_facility_id = res.id;
                    if (res && res.id) {
                        return res.ordering_facility_name;
                    }
                }
            },

            dateFormatter: function (value, data) {
                return commonjs.checkNotEmpty(value) ?
                    commonjs.convertToFacilityTimeZone(app.default_facility_id, value).format('L LT z') : '';
            },

            /**
            * checkAll - used to check all the checkbox in the grid
            */
            checkAll: function () {
                $('#tblGridCensus').find('input:checkbox').each(function () {
                    this.checked = true;
                    $(this).closest('tr').addClass('customRowSelect');
                });
                $('#chkAllCensus').prop('checked', true);
            },

            /**
             * clearAllChk - used to clear all the checkbox in the grid
             */
            clearAllChk: function () {
                $('#tblGridCensus').find('input:checkbox').each(function () {
                    this.checked = false;
                    $(this).closest('tr').removeClass('customRowSelect');
                });
                $('#chkAllCensus').prop('checked', false);
            },

            setCustomArgs: function () {
                var self = this;
                $('#tblGridCensus').jqGrid("setGridParam", {customargs: {
                    orderingFacilityId: $('#ddlOrdFacility').val()
                }});
            },

            showCensusGrid: function () {
                var self = this;
                var censusTypeSelect = "";
                var gridIDPrefix = '#jqgh_tblGridCensus';

                // Defaulting billing type options
                self.censusType.map(function (data) {
                    censusTypeSelect += '<option class="selCensusType" value="' + data.value + '" i18n= ' + data.text + '></option>';
                });

                self.censusTable = new customGrid();
                self.censusTable.render({
                    gridelementid: '#tblGridCensus',
                    emptyMessage: commonjs.geti18NString("messages.status.noRecordFound"),
                    custompager: new Pager(),
                    colNames: ['', '', '', '', '', '', '', '', '', '<input type="checkbox" id="chkAllCensus"  onclick="commonjs.checkMultipleCensus(event)" />', '', '','', '', '', '', ''],
                    i18nNames: self.gridI18nText,
                    colModel: [
                        {
                            name: 'id', hidden: true
                        },
                        {
                            name: 'patient_id', hidden: true
                        },
                        {
                            name: 'facility_id', hidden: true
                        },
                        {
                            name: 'ordering_facility_location_id', hidden: true
                        },
                        {
                            name: 'approving_provider_contact_id', hidden: true
                        },
                        {
                            name: 'study_rendering_provider_contact_id', hidden: true
                        },
                        {
                            name: 'facility_rendering_provider_contact_id', hidden: true
                        },
                        {
                            name: 'claim_insurance_provider_id', hidden: true
                        },
                        {
                            name: 'order_id', hidden: true
                        },
                        {
                            name: 'as_chk',
                            width: 20,
                            sortable: false,
                            resizable: false,
                            search: false,
                            isIconCol: true,
                            formatter: function (cellvalue, option, rowObject) {
                                return '<input type="checkbox" name="chkCensus" class="chkCensus" id="chkCensus_' + rowObject.id + '"/>'

                            },
                            customAction: function (rowID, event) {
                                var checkboxID = $("#chkCensus_" + rowID);
                                if (!checkboxID.is(':checked')) {
                                    $('#chkAllCensus').prop('checked', false);
                                }
                            }
                        },
                        { name: 'location', },
                        {
                            name: 'account_no', search: true,
                        },  {
                            name: 'accession_no', search: true,
                        },
                        {
                            name: 'full_name', search: true,
                        },
                        {
                            name: 'study_dt', search: true, formatter: self.dateFormatter,
                        },
                        {
                            name: 'study_description', search: true,
                        },
                        {
                            name: 'censusType', editable: true, sortable: false,
                            align: 'center',
                            editable: true,
                            cellEdit: true,
                            search: false,
                            formatter: function (cellvalue, option, rowObject) {
                                return '<select class="ui-state-hover selCensusType" id="censusType_' + rowObject.id + '">' + censusTypeSelect + "</select>";
                            }
                        }
                    ],
                    datastore: self.censusCollectionList,
                    sortname: "ps.id",
                    sortorder: "desc",
                    caption: "Census",
                    container: self.el,
                    dblClickActionIndex: 1,
                    disablesearch: false,
                    disablesort: false,
                    disablepaging: false,
                    showcaption: false,
                    shrinkToFit: true,
                    loadonce: false,
                    disableadd: true,
                    disablereload: true,
                    delayedPagerUpdate: true,
                    customizeSort: true,
                    sortable: {
                        exclude: [
                            ',',
                            gridIDPrefix,
                            '_as_chk'

                        ].join('')
                    },
                    pagerApiUrl: '/exa_modules/billing/census/count',
                    pager: '#gridPager_census',
                    customargs: {
                        orderingFacilityId: $('#ddlOrdFacility').val(),
                    },
                    beforeSearch: function () {
                        self.setCustomArgs();
                    },
                    beforeSelectRow: function (id, e) {
                        var targetElement = $(e.target || e.srcElement);
                        var  chkAllCensus = $('#chkAllCensus');
                        if (!targetElement.hasClass('chkCensus') && !targetElement.hasClass('selCensusType')) {
                            var isChecked = $('#chkCensus_' + id).prop('checked');
                            if (isChecked) {
                                chkAllCensus.prop('checked', false);
                            }
                            $('#chkCensus_' + id).prop('checked', !isChecked);
                        } else if(targetElement.hasClass('selCensusType')) {
                            $('#chkCensus_' + id).prop('checked', true);
                        }

                        if ($('.chkCensus:checked').length == $('.chkCensus').length) {
                            chkAllCensus.prop('checked', true);
                        } else {
                            chkAllCensus.prop('checked', false);
                        }
                    },
                    onaftergridbind: function (model, gridObj) {
                        self.bindDateRangeOnSearchBox(gridObj);
                        $('#chkAllCensus').prop('checked', false);
                        self.pagerData = gridObj.pager;
                    }
                });
                self.resize();

            },

            /**
             * initializeEditor - rendering tinymce editor
             */
            initializeEditor: function () {
                var self = this;
                tinymce.remove();
                tinymce.init({
                    selector: 'textarea#txtNotesEditor',
                    plugins: "textcolor colorpicker",
                    toolbar: "undo redo | fontsizeselect | bold italic underline strikethrough forecolor backcolor | removeformat",
                    menubar: false,
                    preview_styles: 'font-size color',
                    setup: function (editor) {
                        editor.on('init', function () {
                            self.resize();
                        })
                    }
                });
            },

            /**
             * resize - resizing the grid on window resize
             */
            resize: function () {
                var dataContainer = $('#data_container');
                var tblGridCensus = $("#tblGridCensus");
                var divCensus = $('#divCensus');
                dataContainer.height(window.innerHeight - (25 + $('.navbar').outerHeight() + $('#divPageHeaderButtons').outerHeight()));
                divCensus.outerWidth(window.innerWidth).outerHeight(dataContainer.outerHeight() - $('.top-nav').outerHeight());
                tblGridCensus.setGridWidth(dataContainer.width() - 20);
                var censusHeight = (divCensus.height() - $('#censusHeaders').outerHeight()) - 100;
                tblGridCensus.setGridHeight(censusHeight);
            },

            loadOrderingFacilityNotes: function () {
                var self = this;
                var orderingFacilityId = $('#ddlOrdFacility').val();
                if (orderingFacilityId) {
                    $.ajax({
                        url: '/orderingFacility/notes',
                        type: 'GET',
                        data: { id: orderingFacilityId },
                        success: function (response) {
                            if (response.status == 'ok') {
                                $('#btnSaveNotes').attr({ 'disabled': false });
                                var editor = tinymce.get('txtNotesEditor');
                                editor.setContent((response.result[0] && response.result[0].note) || '');
                                editor.setDirty(false);
                                self.censusTable.options.customargs.orderingFacilityId = orderingFacilityId;
                                self.censusTable.refresh();
                            } else {
                                editor.setContent('');
                            }
                        },
                        error: function (err, response) {
                            commonjs.handleXhrError(err, response);
                        }
                    });
                } else {
                    $('#btnSaveNotes').attr({ 'disabled': true });
                }
            },

            saveOrderingFacilityNotes: function () {
                var editor = tinymce.get('txtNotesEditor');
                $.ajax({
                    url: '/orderingFacility/notes',
                    type: 'PUT',
                    data: {
                        from: 'census',
                        id: $('#ddlOrdFacility').val(),
                        note: editor.getContent()
                    },
                    success: function (response) {
                        if (response.status == 'ok') {
                            editor.setDirty(false);
                            commonjs.showStatus('billing.payments.orderingFacilityNotesUpdated');
                        }
                    },
                    error: function (err, response) {
                        commonjs.handleXhrError(err, response);
                    }
                });
            },

            updateBillingType: function () {
                var self = this;
                var selectStudies = [];
                var isInvalidCensusType = false;
                var checkedStudies = $("input:checkbox[name=chkCensus]:checked");
                var enableStudiesGrouping = $('#chkCombineSamePatientStudies').is(':checked');

                if(!checkedStudies || !checkedStudies.length){
                    return commonjs.showWarning('messages.warning.oneStudyRequired');
                }

                checkedStudies.each(function () {
                    var id = $(this).attr("id").split('_')[1];
                    var gridData = $('#tblGridCensus').jqGrid('getRowData', id);
                    var censusType = $('#censusType_' + id).val();

                    if (censusType === '') {
                        isInvalidCensusType = true;
                    }

                    selectStudies.push({
                        study_id: id,
                        patient_id: gridData.patient_id,
                        order_id: gridData.order_id,
                        facility_id: gridData.facility_id,
                        rendering_provider_contact_id: gridData.approving_provider_contact_id || gridData.study_rendering_provider_contact_id || gridData.facility_rendering_provider_contact_id || null,
                        ordering_facility_contact_id: gridData.ordering_facility_location_id || null,
                        billing_type: censusType,
                        insurance_provider_id: gridData.claim_insurance_provider_id || null,
                        study_date: commonjs.convertToFacilityTimeZone(gridData.facility_id, gridData.study_dt).format('MM-DD-YYYY'),
                    });
                });

                var groupedStudies = _.groupBy(selectStudies, function(studies) {
                    return studies.patient_id + '_' + studies.facility_id + '_' + studies.study_date + '_' + studies.ordering_facility_contact_id + '_' + studies.rendering_provider_contact_id + '_'  + studies.insurance_provider_id + '_' + studies.billing_type;
                });

                var censusList = _.map(groupedStudies, function(gs) {

                    return {
                        study_id: _.map(gs, 'study_id'),
                        patient_id: gs[0].patient_id,
                        order_id: _.map(gs, 'order_id'),
                        facility_id: gs[0].facility_id,
                        rendering_provider_contact_id: gs[0].rendering_provider_contact_id,
                        ordering_facility_contact_id: gs[0].ordering_facility_contact_id,
                        insurance_provider_id: gs[0].insurance_provider_id,
                        billing_type: gs[0].billing_type,
                        study_date: gs[0].study_date,
                    }
                });

                if (isInvalidCensusType) {
                    return commonjs.showWarning('messages.warning.validCensusType');
                }

                commonjs.showLoading();

                $.ajax({
                    url: '/exa_modules/billing/claim_workbench/claims/batch',
                    type: 'POST',
                    data: {
                        studyDetails: JSON.stringify(censusList),
                        company_id: app.companyID,
                        customScreenName: 'Census',
                        isAllCensus: false,
                        isAllStudies: false,
                        isStudiesGroupingEnabled: enableStudiesGrouping,
                        isMobileBillingEnabled: app.isMobileBillingEnabled,
                        isMobileRadEnabled: app.settings.enableMobileRad
                    },
                    success: function (data) {
                        commonjs.hideLoading();
                        if (data && data.length && (data[0].create_claim_charge)) {
                            commonjs.showStatus("messages.status.successfullyCompleted");
                            self.showCensusGrid();
                        }
                    },
                    error: function (err, response) {
                        commonjs.handleXhrError(err, response);
                    }
                });
            },

            //Bind the date range filter
            bindDateRangeOnSearchBox: function (gridObj) {
                var self = this;
                var columnsToBind = ['study_dt'];
                var drpOptions = {
                    locale: {
                        format: "L"
                    }
                };
                var currentFilter = 1;

                _.each(columnsToBind, function (col) {
                    var colSelector = '#gs_' + col;
                    var colElement = $(colSelector);

                    var drp = commonjs.bindDateRangePicker(colElement, drpOptions, "past", function (start, end, format) {
                        if (start && end) {
                            currentFilter.startDate = start.format('L');
                            currentFilter.endDate = end.format('L');
                            $('input[name=daterangepicker_start]').removeAttr("disabled");
                            $('input[name=daterangepicker_end]').removeAttr("disabled");
                            $('.ranges ul li').each(function (i) {
                                if ($(this).hasClass('active')) {
                                    currentFilter.rangeIndex = i;
                                }
                            });
                        }
                    });
                    colElement.on("apply.daterangepicker", function (obj) {
                        gridObj.refresh();
                    });
                    colElement.on("cancel.daterangepicker", function () {
                        gridObj.refresh();
                    });
                });
            },

            exportCensus: function () {
                var self = this;
                var filterCol = self.pagerData.get('FilterCol') || [];
                var filterData = self.pagerData.get('FilterData') || [];
                var colHeader = [];

                self.gridI18nText.forEach(function (val) {
                    if (val) {
                        colHeader.push(commonjs.geti18NString(val));
                    }
                });

                var params = {
                    "pageNo": self.pagerData.get('PageNo'),
                    "pageSize": self.pagerData.get('PageSize'),
                    "filterData": JSON.stringify(filterData),
                    "filterCol": JSON.stringify(filterCol),
                    "sortField": self.pagerData.get('SortField'),
                    "sortOrder": self.pagerData.get('SortOrder'),
                    "customArgs": {
                        orderingFacilityId: $('#ddlOrdFacility').val()
                    }
                };

                $.ajax({
                    url: '/exa_modules/billing/census',
                    type: 'GET',
                    data: params,
                    success: function (data, response) {
                        commonjs.prepareCsvWorker({
                            data: data,
                            reportName: 'CENSUS',
                            fileName: 'Census',
                            columnHeader: colHeader,
                            countryCode: app.country_alpha_3_code,
                            companyTz: app.company.time_zone
                        }, {
                            afterDownload: function () {
                                $('#btnValidateExportCensus').css('display', 'inline');
                            }
                        });

                    }, error: function (e) {
                        commonjs.handleXhrError(e);
                    }
                });

            }
        });
    });
