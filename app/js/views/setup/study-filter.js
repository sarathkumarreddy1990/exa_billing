define([
    'jquery',
    'underscore',
    'backbone',
    'jqgrid',
    'jqgridlocale',
    'models/pager',
    'text!templates/setup/study-filter-form.html',
    'text!templates/setup/study-filter-grid.html',
    'models/setup/study-filter',
    'collections/setup/study-filter'
], function (
    $,
    _,
    Backbone,
    JQGrid,
    JGridLocale,
    Pager,
    studyFiltersTemplate,
    studyFiltersGridTemplate,
    studyFiltersModel,
    studyFiltersCollectons) {
        return Backbone.View.extend({
            template: _.template(studyFiltersTemplate),
            studyFiltersGridTemplate: _.template(studyFiltersGridTemplate),
            studyFiltersList: [],

            initialize: function () {
                this.model = new studyFiltersModel();
                this.studyFiltersList = new studyFiltersCollectons();
            },

            showGrid: function () {
                var self = this;
                $('#tblStudyFilterGrid').show();
                $('#divStudyFilterForm').hide();
                $(this.el).html(this.studyFiltersGridTemplate());
                this.studyFilterTable = new customGrid();
                this.studyFilterTable.render({
                    gridelementid: '#tblStudyFilterGrid',
                    custompager: new Pager(),
                    emptyMessage: 'No Record found',
                    colNames: ['', '', '', ''],
                    i18nNames: ['', '', 'filterName', 'filterOrder'],
                    colModel: [
                        {
                            name: 'edit',
                            width: 50,
                            sortable: false,
                            search: false,
                            className: 'icon-ic-edit',
                            customAction: function (rowID) {
                                self.showForm(rowID);
                            },
                            formatter: function (e, model, data) {
                                return `<span class='icon-ic-edit' title='click Here to Edit'></span>`;
                            },
                            cellattr: function () {
                                return 'style=text-align:center;cursor:pointer;'
                            }
                        },
                        {
                            name: 'del', width: 50, sortable: false, search: false,
                            className: 'icon-ic-delete',
                            customAction: function (rowID) {
                                if (confirm("Are you sure want to delete")) {
                                    var gridData = $('#tblStudyFilterGrid').jqGrid('getRowData', rowID);
                                    self.model.set({ "id": rowID });
                                    self.model.destroy({
                                        data: $.param({ id: self.model.id }),
                                        success: function (model, response) {

                                        },
                                        error: function (model, response) {
                                        }
                                    });
                                }
                            },

                            formatter: function (e, model, data) {
                                return `<span class='icon-ic-delete' title='click Here to Delete'></span>`;
                            },

                            cellattr: function () {
                                return 'style=text-align:center;cursor:pointer;';
                            }
                        },
                        {
                            name: 'filter_name',
                            width: 180
                        },
                        {
                            name: 'filter_order',
                            width: 180
                        }

                    ],
                    datastore: self.studyFiltersList,
                    container: self.el,
                    customizeSort: true,
                    offsetHeight: 01,
                    sortname: "id",
                    sortorder: "desc",
                    dblClickActionIndex: 1,
                    disablesearch: false,
                    disablesort: false,
                    disablepaging: false,
                    showcaption: false,
                    disableadd: true,
                    disablereload: true
                });
                setTimeout(function () {
                    $("#tblStudyFilterGrid").setGridWidth($('#divStudyFilterGrid').width(), true);
                }, 200);
                $("#addStudyFilter").unbind().click(function (e) {
                    self.showForm();
                });
                $("#reloadStudyFilter").unbind().click(function (e) {
                    self.showGrid();
                });
            },

            showForm: function (id) {
                var self = this;
                userID = app.userID;
                $('#modal_div_container').empty();
                $('#modal_div_container').append(self.template);
                $('#modal_div_container').show();
                if (id > 0) {
                    this.model = new studyFiltersModel();
                    this.model.set({ id: id });
                    this.model.fetch({
                        data: { id: this.model.id },
                        success: function (model, response) {
                            response = response[0];
                            if (response) {
                                $('#txtFilterName').val(response.filter_name);
                                $('#txtFilterOrder').val(response.filter_order);
                                $('#chkIsActive').prop('checked', response.is_active ? true : false);
                                $('#chkIsGlobalFilter').prop('checked', response.is_global_filter ? true : false);
                                $('#chkDisplayAsTab').prop('checked', response.display_as_tab ? true : false);
                                $('#chkDisplayAsDDL').prop('checked', response.display_in_ddl ? true : false);

                                switch (response.filter_info.date.dateType) {
                                    case "study_dt":
                                        $('#rbtStudyDate').prop('checked', true);
                                        break;
                                    case "study_received_dt":
                                        $('#rbtStudyReceivedDate').prop('checked', true);
                                        break;
                                    case "scheduled_dt":
                                        $('#rbtScheduledDate').prop('checked', true);
                                        break;
                                    default:
                                        $('#rbtStudyDate').prop('checked', true);
                                        break;
                                }
                                switch (response.filter_info.date.condition) {
                                    case "Preformatted":
                                        $('#rbtPreformatted').prop('checked', true);
                                        break;
                                    case "Last":
                                        $('#rbtLast').prop('checked', true);
                                        break;
                                    case "Next":
                                        $('#rbtNext').prop('checked', true);
                                        break;
                                    case "Date":
                                        $('#rbtDate').prop('checked', true);
                                        break;

                                }
                            }
                        }
                    });
                }
                $('#rbtPreformatted').unbind().change(function (e) {
                    $('#ddlDatePreformatted').prop('disabled', false);
                    $('#ddlLast, #txtFromTimeLast, #txtToTimeLast, #txtDateFrom, #txtFromTimeDate, #txtDateTo, #txtToTimeDate, #txtLastTime').prop('disabled', 'disabled');
                });
                $('#rbtLast, #rbtNext').unbind().change(function (e) {
                    $('#txtLastTime, #ddlLast, #txtFromTimeLast, #txtToTimeLast').prop('disabled', false);
                    $('#txtDateFrom, #txtFromTimeDate, #txtDateTo, #txtToTimeDate, #ddlDatePreformatted').prop('disabled', 'disabled');
                });
                $('#rbtDate').unbind().change(function (e) {
                    $('#txtDateFrom, #txtFromTimeDate, #txtDateTo, #txtToTimeDate').prop('disabled', false);
                    $('#txtLastTime, #ddlLast, #txtFromTimeLast, #txtToTimeLast, #ddlDatePreformatted').prop('disabled', 'disabled');
                });
                $('#btnSaveStudyFilter').unbind().click(function (e) {
                    self.saveStudyFilter(id);
                });
                $("#btnBackToGrid").unbind().click(function (e) {
                    self.showGrid();
                });

            },

            saveStudyFilter: function (studyFilterId) {
                var self = this;
                var dateJsonCondition = null;
                if (window.location && window.location.hash.split('/')[1] == 'studies')
                    var filterType = 'studies';
                if (window.location && window.location.hash.split('/')[1] == 'claim_workbench')
                    var filterType = 'claims';
                filterName = $('#txtFilterName').val() ? $('#txtFilterName').val() : '';
                filterOrder = $('#txtFilterOrder').val() ? $('#txtFilterOrder').val() : '';
                isActive = $('#chkIsActive').is(":checked");
                isGlobal = $('#chkIsGlobalFilter').is(":checked");
                isDisplayAsTab = $('#chkDisplayAsTab').is(":checked");
                isDisplayInDropDown = $('#chkDisplayAsDDL').is(":checked");

                if ($('#rbtPreformatted').is(':checked')) {
                    var dateJsonCondition = "Preformatted";
                }
                else if ($('#rbtLast').is(':checked') || $('#rbtNext').is(':checked')) {
                    dateJsonCondition = $('#rbtLast').is(':checked') ? "Last" : "Next";
                }
                else if ($('#rbtDate').is(':checked')) {
                    dateJsonCondition = "Date";
                }
                var jsonData = {
                    date: {
                        preformatted: $.trim($('#ddlDatePreformatted').val()),
                        durationValue: $.trim($('#txtLastTime').val()),
                        duration: $('#ddlLast option:selected').text(),
                        fromTime: $('#txtFromTimeLast').val() ? $('#txtFromTimeLast').val() : null,
                        toTime: $('#txtToTimeLast').val() ? $('#txtToTimeLast').val() : null,
                        fromDate: $('#txtDateFrom').val() ? $('#txtDateFrom').val() : null,
                        fromDateTime: $('#txtFromTimeDate').val() ? $('#txtFromTimeDate').val() : null,
                        toDate: $('#txtDateTo').val() ? $('#txtDateTo').val() : null,
                        toDateTime: $('#txtToTimeDate').val() ? $('#txtToTimeDate').val() : null,
                        isStudyDate: $('#rbtStudyDate').is(":checked"),
                        dateType: $('#rbtStudyDate').is(":checked") ? "study_dt" : $('#rbtStudyReceivedDate').is(":checked") ? "study_received_dt" : $('#rbtScheduledDate').is(":checked") ? "scheduled_dt" : $('#rbtStatusChangeDate').is(":checked") ? "status_last_changed_dt" : "study_dt"
                    }
                };
                this.model.set({
                    userId: app.userID,
                    filterType: filterType,
                    jsonData: JSON.stringify(jsonData),
                    filterName: filterName,
                    filterOrder: filterOrder,
                    isActive: isActive,
                    isGlobal: isGlobal,
                    isDisplayAsTab: isDisplayAsTab,
                    isDisplayInDropDown: isDisplayInDropDown
                });
                this.model.save({},
                    {
                        success: function (model, response) {
                            commonjs.hideLoading();
                            self.showGrid();
                        },
                        error: function (model, response) {
                            commonjs.handleXhrError(model, response);
                        }
                    });
            }
        })
    });