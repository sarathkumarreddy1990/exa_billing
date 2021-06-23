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
            gridI18nText: ['','', '', '', 'billing.payments.orderingFacilityLocation', 'billing.payments.mrn','shared.fields.accessionNumber', 'billing.fileInsurance.patientNameGrid', 'report.reportFilter.dateOfService', 'home.sendStudies.studyDesc', 'shared.fields.censusType'],
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
                'click #btnCreateClaim': 'updateBillingType'
            },

            initialize: function (options) {
                commonjs.tinyMceLoad();
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
                setTimeout(function () {
                    //initializing tinymce editor
                    self.initializeEditor();
                }, 500);
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

            showCensusGrid: function (orderingFacilityId) {
                var self = this;
                var censusTypeSelect = "";

                // Defaulting billing type options
                self.censusType.map(function (data) {
                    censusTypeSelect += '<option class="selCensusType" value="' + data.value + '" i18n= ' + data.text + '></option>';
                });

                self.censusTable = new customGrid();
                self.censusTable.render({
                    gridelementid: '#tblGridCensus',
                    emptyMessage: commonjs.geti18NString("messages.status.noRecordFound"),
                    custompager: new Pager(),
                    colNames: ['','','', '<input type="checkbox" id="chkAllCensus"  onclick="commonjs.checkMultipleCensus(event)" />', '', '','', '', '', '', ''],
                    i18nNames: self.gridI18nText,
                    colModel: [
                        {
                            name: 'id', hidden: true,
                        },{
                            name: 'patient_id', hidden: true,
                        },{
                            name: 'order_id', hidden: true,
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
                    pagerApiUrl: '/exa_modules/billing/census/count',
                    pager: '#gridPager_census',
                    customargs: {
                        orderingFacilityId: orderingFacilityId
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
                                self.showCensusGrid(orderingFacilityId);
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
                        billing_type: censusType
                    });
                });

                if (isInvalidCensusType) {
                    return commonjs.showWarning('messages.warning.validCensusType');
                }
                commonjs.showLoading();

                $.ajax({
                    url: '/exa_modules/billing/claim_workbench/claims/batch',
                    type: 'POST',
                    data: {
                        studyDetails: JSON.stringify(selectStudies),
                        company_id: app.companyID,
                        screenName: 'Census',
                        isAllCensus: false,
                        isAllStudies: false,
                        isMobileBillingEnabled: app.isMobileBillingEnabled
                    },
                    success: function (data) {
                        commonjs.hideLoading();
                        if (data && data.length && (data[0].create_claim_charge)) {
                            commonjs.showStatus("messages.status.successfullyCompleted");
                            self.showCensusGrid($('#ddlOrdFacility').val());
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
            }
        });
    });
