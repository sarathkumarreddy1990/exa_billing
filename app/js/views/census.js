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
            selectedRows: [],
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
                'click #btnUpdate': 'updateBillingType'
            },

            initialize: function (options) {
                this.options = options;
                var self = this;
                this.censusCollectionList = new censusCollection();
                this.censusPager = new Pager();
                self.routePrefix = '#billing/census/list';
                $(window).on("resize", this.resize.bind(this));
                this.loadTinyMc();
                this.selectedRows = [];
            },

            render: function () {
                var self = this;
                self.template = _.template(censusHTML);
                self.$el.html(self.template());
                setTimeout(function () {
                    //initializing tinymce editor
                    self.initializeEditor();
                }, 200)
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
                                pageNo: params.page || 1,
                                q: params.term || '',
                                pageSize: 10,
                                sortField: "ordering_facility_name",
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
                    censusTypeSelect += '<option value="' + data.value + '" i18n= ' + data.text + '></option>';
                });

                self.censusTable = new customGrid();
                self.censusTable.render({
                    gridelementid: '#tblGridCensus',
                    emptyMessage: commonjs.geti18NString("messages.status.noRecordFound"),
                    custompager: new Pager(),
                    colNames: ['', '<input type="checkbox" id="chkAllCensus"  onclick="commonjs.checkMultipleCensus(event)" />', '', '', '', '', '', ''],
                    i18nNames: ['', '', 'order.newOrder.locations', 'billing.payments.mrn', 'billing.fileInsurance.patientNameGrid', 'report.reportFilter.dateOfService', 'home.sendStudies.studyDesc', 'shared.fields.censusType'],
                    colModel: [
                        {
                            name: 'id', hidden: true,
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
                            name: 'censusType', editable: true, sortable: true,
                            align: 'center',
                            editable: true,
                            cellEdit: true,
                            search: false,
                            formatter: function (cellvalue, option, rowObject) {
                                return '<select class=" ui-state-hover selCensusType" id="censusType_' + rowObject.id + '">' + censusTypeSelect + "</select>";
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
                        facilityId: orderingFacilityId
                    },
                    beforeSelectRow: function (id, e) {
                        if (!$(e.target || e.srcElement).hasClass('chkCensus')) {
                            var isChecked = $('#chkCensus_' + id).prop('checked');
                            if (isChecked) {
                                $('#chkAllCensus').prop('checked', false);
                                self.selectedRows = _.without(self.selectedRows, id);
                            } else {
                                self.selectedRows.push(id);
                            }
                            $('#chkCensus_' + id).prop('checked', !isChecked);
                        }
                    },
                    onaftergridbind: function (model, gridObj) {
                        self.bindDateRangeOnSearchBox(gridObj);
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

            loadTinyMc: function () {
               
                if (typeof window.scriptFlag === 'undefined') {
                    var script = document.createElement('script');
                    script.type = "text/javascript";
                    script.src = " /tinymce/tinymce.min.js";
                    document.body.appendChild(script);
                    window.scriptFlag = true;
                }
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
                tblGridCensus.setGridHeight((divCensus.height() - $('#censusHeaders').outerHeight()) - 100);
            },

            loadOrderingFacilityNotes: function () {
                var self = this;
                var orderingFacilityId = $('#ddlOrdFacility').val();
                if (orderingFacilityId) {
                    $.ajax({
                        url: '/providerGroup',
                        type: 'GET',
                        data: { id: $('#ddlOrdFacility').val() },
                        success: function (response) {
                            if (response.status == 'ok') {
                                $('#btnSaveNotes').attr({ 'disabled': false });
                                var editor = tinymce.get('txtNotesEditor');
                                editor.setContent(response.result.note || '');
                                editor.setDirty(false);
                                self.showCensusGrid(orderingFacilityId);
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
                    url: '/orderingFacilityNotes',
                    type: 'PUT',
                    data: {
                        provider_group_id: $('#ddlOrdFacility').val(),
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
                //TO-DO update the billing type to studies 
                this.selectedRows.every(function (rowId) {
                    if ($('#censusType_' + rowId).val() === '') {
                        commonjs.showWarning('messages.warning.validCensusType');
                        return false;
                    } return true;
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
        });
    });
