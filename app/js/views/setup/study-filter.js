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
    var defaultBillingMethod = [
        {
            "code": "direct_billing",
            "desc": "Direct Billing"
        },
        {
            "code": "paper_claim",
            "desc": "Paper Claim"
        },
        {
            "code": "electronic_billing",
            "desc": "Electronic Billing"
        },
        {
            "code": "patient_payment",
            "desc": "Patient Payment"
        }
    ];
    var defaultPayerType=[
        {
            "code":"patient",
            "desc":"Patient"
        },
        {
            "code":"referring_provider",
            "desc":"Referring Provider"
        },
        {
            "code":"ordering_facility",
            "desc":"Ordering Facility"
        },
        {
            "code":"primary_insurance",
            "desc":"Primary Insurance"
        },
        {
            "code":"secondary_insurance",
            "desc":"Secondary Insurance"
        },
        {
            "code":"teritary_insurance",
            "desc":"Tertiary Insurance"
        }
    ];
    var defaultStatusArray = [
        {
            'status_code': 'SCH',
            'status_desc': 'Scheduled'
        },
        {
            'status_code': 'PR',
            'status_desc': 'Precheckin'
        },
        {
            'status_code': 'RSCH',
            'status_desc': 'Rescheduled'
        },
        {
            'status_code': 'NOS',
            'status_desc': 'No Shows'
        },
        {
            'status_code': 'CON',
            'status_desc': 'Confirmed'
        },
        {
            'status_code': 'CHI',
            'status_desc': 'Check-In'
        },
        {
            'status_code': 'TS',
            'status_desc': 'Tech Start'
        },
        {
            'status_code': 'TE',
            'status_desc': 'Tech End'
        },
        {
            'status_code': 'CHO',
            'status_desc': 'Check-Out'
        },
        {
            'status_code': 'INC',
            'status_desc': 'Incomplete'
        },
        {
            'status_code': 'UNR',
            'status_desc': 'UnRead'
        },
        {
            'status_code': 'RE',
            'status_desc': 'Read'
        },
        {
            'status_code': 'DIC',
            'status_desc': 'Dictated'
        },
        {
            'status_code': 'DRFT',
            'status_desc': 'Draft'
        },
        {
            'status_code': 'APP',
            'status_desc': 'Approved'
        },
        {
            'status_code': 'PRAP',
            'status_desc': 'Pre-Approved'
        },
        {
            'status_code': 'TRAN',
            'status_desc': 'Transcribed'
        },
        {
            'status_code': 'CAN',
            'status_desc': 'Cancelled'
        }
    ];

    var listTools = function (textProp, idProp) {
        var _STRING = 'string';
        var _BLANK = '';
        idProp = idProp || 'id';
        var fixString = function (val) {
            return typeof val === _STRING ?
                val.toUpperCase() :
                _BLANK;
        };

        var deDup = function (current) {
            return textProp ?
                function (iteratee) {
                    return iteratee[idProp] === current[idProp];
                } :
                function (iteratee) {
                    return iteratee === current;
                };
        };

        var trimTheFat = function (array, current) {
            if (array && current && !current.deleted && !array.some(deDup(current))) {
                array[array.length] = current;
            }
            return array;
        };

        var sortList = textProp ?
            function (aObj, bObj) {
                var aVal = fixString(aObj[textProp]);
                var bVal = fixString(bObj[textProp]);
                if (aVal < bVal) {
                    return -1;
                }
                if (aVal > bVal) {
                    return 1;
                }
                return 0;
            } :
            function (a, b) {
                var aVal = fixString(a);
                var bVal = fixString(b);
                if (aVal < bVal) {
                    return -1;
                }
                if (aVal > bVal) {
                    return 1;
                }
                return 0;
            };

        var _selectElementSetup = function (elementID, sortedArray) {
            var count = sortedArray.length;
            if (count > 0) {
                var i = 0;
                var listElement = document.getElementById(elementID);
                var frag = document.createDocumentFragment();

                // Do check for `textProp` outside of loop for efficiency
                if (textProp) {
                    for (; i < count; ++i) {
                        var current = sortedArray[i];
                        var option = document.createElement('option');
                        option.text = current[textProp];
                        option.value = current[idProp];
                        frag.appendChild(option);
                    }
                }
                else {
                    for (; i < count; ++i) {
                        current = sortedArray[i];
                        option = document.createElement('option');
                        option.text = current;
                        option.value = i;
                        frag.appendChild(option);
                    }
                }
                listElement.appendChild(frag);
            }
        };

        return {
            'fixString': fixString,
            'trimTheFat': trimTheFat,
            'sortList': sortList,
            'setup': _selectElementSetup
        };
    };
    var setupList = function (elementID, listArray, textProp, idProp) {
        if (Array.isArray(listArray)) {
            var tools = listTools(textProp, idProp);
            tools.setup(
                elementID,
                listArray
                    .reduce(tools.trimTheFat, [])
                    .sort(tools.sortList)
            );
        }
    };

    var toggleOption = function ( id, state ) {
        var element = document.getElementById(id);
        if ( element ) {
            var label = element.parentNode.querySelector('#' + id + ' + label');
            if ( state === true ) {
                element.setAttribute('disabled', true);
                element.classList.add('disabled');
                if ( label ) {
                    label.classList.add('disabled');
                }
            }
            else {
                element.removeAttribute('disabled');
                element.classList.remove('disabled');
                if ( label ) {
                    label.classList.remove('disabled');
                }
            }
            element.checked = false;
        }
    };

        return Backbone.View.extend({
            template: _.template(studyFiltersTemplate),
            studyFiltersGridTemplate: _.template(studyFiltersGridTemplate),
            studyFiltersList: [],
            previous: "",
            opener: "",
            events: {
                "click #tabDateTime": "tabClick",
                "click #tabPatientInformation": "tabClick",
                "click #tabStudyInformation": "tabClick",
                "click #tabPhysician": "tabClick",
                "click #tabInsurance": "tabClick",
                "click #tabAssignToUser": "tabClick",
                "click #btnAddPatientName": "addItemToList",
                "click #btnAddPatientID": "addItemToList",
                "click #btnRemovePatientName": "removeItemFromList",
                "click #btnRemovePatientID": "removeItemFromList",
                "click #btnAddReadPhy": "addItemToList",
                "click #btnAddRefPhy": "addItemToList",
                "click #btnAddInsurance": "addItemToList",
                "click #btnRemoveReadPhy": "removeItemFromList",
                "click #btnRemoveRefPhy": "removeItemFromList",
                "click #btnRemoveInsurance": "removeItemFromList",
                "click #btnInsurance": "removeItemFromList",
                "click #rbtPreformatted": "changeDateTimeStdFilter",
                "click #rbtLast": "changeDateTimeStdFilter",
                "click #rbtNext": "changeDateTimeStdFilter",
                "click #rbtDate": "changeDateTimeStdFilter",
                "click #btnAddInstitutionStudyFilter": "addInstitutionList",
                "click #btnRemoveInstitutionStudyFilter": 'removeInstitutionList',
                "click #btnAddClaimInfo": "addItemToList",
                "click #btnRemoveClaimInfo": "removeItemFromList",
                "click #btnAddBillingMethod": "addItemToList",
                "click #btnRemoveBillingMethod": "removeItemFromList",
                "click #btnAddPayerType": "addItemToList",
                "click #btnRemovePayerType": "removeItemFromList",
                "click #btnAddBalance": "addItemToList",
                "click #btnRemoveBalance": "removeItemFromList"
            },

            initialize: function () {
                if (window.location && window.location.hash.split('/')[1] == 'claim_workbench')
                    this.opener = 'claims';
                else
                    this.opener = 'studies';
                this.model = new studyFiltersModel();
                this.studyFiltersList = new studyFiltersCollectons();
            },

            changeDateTimeStdFilter: function () {
                if ($('#rbtLast').is(':checked') || $('#rbtNext').is(':checked')) {
                    this.disablePreformatted();
                    this.clearAndDisableDateFrom();
                    this.enableLastNext();
                }
                else if ($('#rbtPreformatted').is(':checked')) {
                    this.clearAndDisableLastNext();
                    this.clearAndDisableDateFrom();
                    this.enablePreformatted();
                }
                else {
                    this.disablePreformatted();
                    this.clearAndDisableLastNext();
                    this.enableDateFrom();
                }
            },

            disablePreformatted: function () {
                $("#ddlDatePreformatted").prop('disabled', true);
            },

            enablePreformatted: function () {
                $("#ddlDatePreformatted").prop('disabled', false);
            },

            clearAndDisableLastNext: function () {
                $('#txtLastTime').val('');
                $('#txtFromTimeLast, #txtToTimeLast, #txtLastTime, #ddlLast').val('');
                $('#txtFromTimeLast, #txtToTimeLast, #ddlLast, #txtLastTime').prop('disabled', 'disabled');
            },

            enableLastNext: function () {
                $("#ddlLast").prop('disabled', false);
                $("#txtLastTime").prop('disabled', false);
                $('#txtFromTimeLast, #txtToTimeLast, #ddlLast, #txtLastTime').prop('disabled', false);
            },

            clearAndDisableDateFrom: function () {
                $('#txtDateFrom, #txtFromTimeDate, #txtDateTo, #txtToTimeDate').val('');
                $('#txtDateFrom, #txtFromTimeDate, #txtDateTo, #txtToTimeDate').prop('disabled', 'disabled');
            },

            enableDateFrom: function () {
                $('#txtDateFrom, #txtFromTimeDate, #txtDateTo, #txtToTimeDate').prop('disabled', false);
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
                    i18nNames: ['', '', 'setup.studyFilters.filterName', 'setup.studyFilters.filterOrder'],
                    colModel: [
                        {
                            name: 'edit',
                            width: 10,
                            sortable: false,
                            search: false,
                            className: 'icon-ic-edit',
                            customAction: function (rowID) {
                                self.showForm(rowID);
                            },
                            formatter: function (e, model, data) {
                                return "<i class='icon-ic-edit' title='Edit'></i>";
                            },
                            cellattr: function () {
                                return 'style=text-align:center;cursor:pointer;'
                            }
                        },
                        {
                            name: 'del', width: 10, sortable: false, search: false,
                            className: 'icon-ic-delete',
                            customAction: function (rowID) {
                                if (confirm("Are you sure want to delete")) {
                                    var gridData = $('#tblStudyFilterGrid').jqGrid('getRowData', rowID);
                                    self.model.set({ "id": rowID, "filter_name": gridData.filter_name });
                                    self.model.destroy({
                                        data: $.param({ id: self.model.id, name: gridData.filter_name }),
                                        success: function (model, response) {
                                            self.studyFilterTable.refreshAll();
                                            commonjs.showStatus("Deleted Succesfully")
                                        },
                                        error: function (model, response) {
                                        }
                                    });
                                }
                            },

                            formatter: function (e, model, data) {
                                return "<i class='icon-ic-delete' title='Click here to delete'></i>";
                            },

                            cellattr: function () {
                                return 'style=text-align:center;cursor:pointer;';
                            }
                        },
                        {
                            name: 'filter_name',
                        },
                        {
                            name: 'filter_order',
                        }

                    ],
                    afterInsertRow: function (rowid, rowdata) {
                        if (!rowdata.is_active) {
                            var $row = $('#tblStudyFilterGrid').find('#' + rowid);
                            $row.css('text-decoration', 'line-through');
                        }
                    },
                    datastore: self.studyFiltersList,
                    container: self.el,
                    customizeSort: true,
                    offsetHeight: 01,
                    sortname: "id",
                    sortorder: "desc",
                    ondblClickRow: function (rowID) {
                        self.showForm(rowID);
                    },
                    disablesearch: false,
                    disablesort: false,
                    disablepaging: false,
                    showcaption: false,
                    disableadd: true,
                    disablereload: true,
                    customargs:{
                        filter_type: self.opener
                    },
                    pager: '#gridPager_studyFilter'
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
                if (this.opener == "studies")
                    $('#divTab').show();
                else {
                    $("#claimFilter").show();
                    $("#divDateTime>table").appendTo("#divClaimDateTime");
                    $("#divClaimDateTime>table").css({'height':'125px','margin-left': '3%'});
                }
                var dtpDateOptions = { format: "L", useCurrent: false };
                self.dtpFromDate = commonjs.bindDateTimePicker("divDateFrom", dtpDateOptions);
                self.dtpToDate = commonjs.bindDateTimePicker("divDateTo", dtpDateOptions);

                var dtpTimeOptions = { format: "LT", useCurrent: false, ignoreReadonly: true };
                self.dtpFromTime = commonjs.bindDateTimePicker("divFromTime", dtpTimeOptions);
                self.dtpToTime = commonjs.bindDateTimePicker("divToTime", dtpTimeOptions);
                self.dtpFromTimeLast = commonjs.bindDateTimePicker("divFromTimeLast", dtpTimeOptions);
                self.dtpToTimeLast = commonjs.bindDateTimePicker("divToTimeLast", dtpTimeOptions);

                this.setupLists();
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
                $('#btnClearData').unbind().click(function (e) {
                    self.resetForm();
                });
                $("#btnBackToGrid").unbind().click(function (e) {
                    self.previous = "";
                    self.showGrid();
                });

                if (this.opener == "studies") {
                    /* Bind tag remove - SMH */
                    $('#ulListOrdFacility').delegate('a.remove', 'click', function () {
                        $('#listOrdFacility option[value="' + $(this).attr('data-id') + '"]').prop('selected', false);
                        $(this).closest('li').remove();
                    });

                    /* Bind add button for ordering facilities - SMH */
                    $('#btnAddOrdFacility').unbind('click').click(function () {
                        if($('#select2-ddlOrdFacility-container').text() === '') return;
                        if ($('#s2id_txtListOrdFacility > a.select2-default').length > 0) {
                            return false;
                        }

                        if ($('#listOrdFacility option[value="' + $(this).attr('data-id') + '"]').prop('selected') === true) {
                            commonjs.showError("Ordering Facility is already selected");
                            return false;
                        }

                        $('#listOrdFacility option[value="' + $(this).attr('data-id') + '"]').prop('selected', true);
                        $('#ulListOrdFacility').append('<li><span>' + $('#select2-ddlOrdFacility-container').text() + '</span><a class="remove" data-id="' + $(this).attr('data-id') + '"><span class="icon-ic-close"></span></a></li>')
                        $('#select2-ddlOrdFacility-container').text('');
                    });
                    $('#ulListStudyDescriptions').delegate('a.remove', 'click', function () {
                        $(this).closest('li').remove();
                        $('#txtStudyDescription').focus();
                    });

                    $('#btnAddStudyDescription').unbind('click').click(function () {
                        if ($('#txtStudyDescription').val().length === 0) {
                            $('#txtStudyDescription').focus();
                            return false;
                        }

                        $('#ulListStudyDescriptions').append('<li><span>' + $('#txtStudyDescription').val() + '</span><a class="remove" data-id="' + $('#txtStudyDescription').val() + '" id="' + $('#txtStudyDescription').val() + '"><span class="icon-ic-close"></span></a></li>')
                        $('#txtStudyDescription').val('');
                        $('#txtStudyDescription').focus();

                    });

                    $('#ulListAttorneys').delegate('a.remove', 'click', function () {
                        $(this).closest('li').remove();
                        $('#txtAttorney').focus();
                    });

                    $('#btnAddAttorney').unbind('click').click(function () {
                        if ($('#txtAttorney').val().length === 0) {
                            $('#txtAttorney').focus();
                            return false;
                        }

                        $('#ulListAttorneys').append('<li><span>' + $('#txtAttorney').val() + '</span><a class="remove" data-id="' + $('#txtAttorney').val() + '" id="' + $('#txtAttorney').val() + '"><span class="icon-ic-close"></span></a></li>')
                        $('#txtAttorney').val('');
                        $('#txtAttorney').focus();

                    });
                }

                if (id > 0) {
                    this.model.set({id: id});
                    this.model.fetch({
                        data: {id: this.model.id},
                        success: function (model, response) {
                            response = response[0];
                            if (response) {
                                $('#txtFilterName').val(response.filter_name);
                                $('#txtFilterOrder').val(response.filter_order);
                                $('#chkIsActive').prop('checked', response.is_active ? false : true);
                                $('#chkIsGlobalFilter').prop('checked', response.is_global_filter ? true : false);
                                $('#chkDisplayAsTab').prop('checked', response.display_as_tab ? true : false);
                                $('#chkDisplayAsDDL').prop('checked', response.display_in_ddl ? true : false);

                                var dateJson = response.filter_info.date;
                                if (dateJson) {
                                    switch (dateJson.dateType) {
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
                                    switch (dateJson.condition) {
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

                                    $('#ddlDatePreformatted').val(dateJson.preformatted)
                                    $('#txtLastTime').val(dateJson.durationValue);
                                    $('#ddlLast').val(dateJson.duration);

                                    dateJson.fromDate ? $('#txtDateFrom').val(dateJson.fromDate) : $('#txtDateFrom').val('');
                                    dateJson.toDate ? $('#txtDateTo').val(dateJson.toDate) : $('#txtDateTo').val('');
                                    dateJson.fromDateTime ? $('#txtFromTimeDate').val(dateJson.fromDateTime) : $('#txtFromTimeDate').val('');
                                    dateJson.toDateTime ? $('#txtToTimeDate').val(dateJson.toDateTime) : $('#txtToTimeDate').val('');
                                    dateJson.fromTime ? $('#txtFromTimeLast').val(dateJson.fromTime) : $('#txtFromTimeLast').val('');
                                    dateJson.toTime ? $('#txtToTimeLast').val(dateJson.toTime) : $('#txtToTimeLast').val('');

                                    self.changeDateTimeStdFilter();
                                }
                                if (self.opener == "studies") {
                                    var patientNameJson = response.filter_info.patientInformation.patientName;
                                    for (var i = 0; i < patientNameJson.length; i++) {
                                        var opt = document.createElement('Option');
                                        opt.text = 'Name' + " " + patientNameJson[i].condition + " " + patientNameJson[i].value;
                                        opt.value = patientNameJson[i].condition + '~' + patientNameJson[i].value;
                                        $("input:radio[name=PatientName][value=" + patientNameJson[i].condition + "]").prop('checked', true);
                                        document.getElementById('listPatientName').options.add(opt);
                                    }
                                    var patientIDJson = response.filter_info.patientInformation.patientID;
                                    for (var i = 0; i < patientIDJson.length; i++) {
                                        var opt = document.createElement('Option');
                                        opt.text = "Account# " + " " + patientIDJson[i].condition + " " + " " + patientIDJson[i].value;
                                        opt.value = patientIDJson[i].condition + '~' + patientIDJson[i].value;
                                        $("input:radio[name=PatientID][value=" + patientIDJson[i].condition + "]").prop('checked', true);
                                        document.getElementById('listPatientID').options.add(opt);
                                    }
                                    var readPhy = response.filter_info.physician.readPhy;
                                    for (var i = 0; i < readPhy.length; i++) {
                                        var opt = document.createElement('Option');
                                        opt.text = "ReadPhy" + " " + readPhy[i].condition + " " + readPhy[i].value;
                                        opt.value = readPhy[i].condition + '~' + readPhy[i].value;
                                        $("input:radio[name=ReadPhy][value=" + readPhy[i].condition + "]").prop('checked', true);
                                        document.getElementById('listReadPhy').options.add(opt);
                                    }
                                    var refPhy = response.filter_info.physician.refPhy;
                                    for (var i = 0; i < refPhy.length; i++) {
                                        var opt = document.createElement('Option');
                                        opt.text = 'RefPhy' + " " + refPhy[i].condition + " " + refPhy[i].value;
                                        opt.value = refPhy[i].condition + '~' + refPhy[i].value;
                                        $("input:radio[name=RefPhy][value=" + refPhy[i].condition + "]").prop('checked', true);
                                        document.getElementById('listRefPhy').options.add(opt);
                                    }
                                    var imageDelivery = response.filter_info.physician.imageDelivery || {
                                            list: [],
                                            condition: ''
                                        };
                                    var imageDeliveryList = imageDelivery.list || [];
                                    var imageDeliveryCondition = imageDelivery.condition;
                                    $("input:radio[name=ImageDelivery][value=" + imageDeliveryCondition + "]").prop('checked', true);
                                    $('#listImageDelivery').val(imageDeliveryList);

                                    var insProv = response.filter_info.insurance && Array.isArray(response.filter_info.insurance.insProv)
                                        ? response.filter_info.insurance.insProv
                                        : [];
                                    for (var i = 0; i < insProv.length; i++) {
                                        var opt = document.createElement('Option');
                                        opt.text = 'InsProv' + " " + insProv[i].condition + " " + insProv[i].value;
                                        opt.value = insProv[i].condition + '~' + insProv[i].value;
                                        $("input:radio[name=InsProv][value=" + insProv[i].condition + "]").prop('checked', true);
                                        document.getElementById('listInsurance').options.add(opt);
                                    }

                                    var studyInfoJson = response.filter_info.studyInformation;
                                    $("input:radio[name=StudyID][value=" + studyInfoJson.studyID.condition + "]").prop('checked', true);
                                    $('#txtStudyID').val(studyInfoJson.studyID.value);
                                    $("input:radio[name=Accession][value=" + studyInfoJson.accession.condition + "]").prop('checked', true);
                                    $('#txtAccession').val(studyInfoJson.accession.value);
                                    $("input:radio[name=Institution][value=" + studyInfoJson.institution.condition + "]").prop('checked', true);

                                    if (studyInfoJson.study_description && studyInfoJson.study_description.condition !== undefined && studyInfoJson.study_description.condition != "" && studyInfoJson.study_description.list.length && studyInfoJson.study_description.list !== undefined) {
                                        $("input:radio[name=StudyDescription][value=" + studyInfoJson.study_description.condition.replace('Contains', '') + "]").prop("checked", true);
                                        $('#chkContainsStudyDescription').prop('checked', studyInfoJson.study_description.condition.indexOf('Contains') >= 0 ? true : false);
                                        $.each(studyInfoJson.study_description.list, function (index, studyDescriptionData) {
                                            if ($('#ulListStudyDescriptions a[data-id="' + studyDescriptionData.text + '"]').length === 0)
                                                $('#ulListStudyDescriptions').append('<li><span>' + studyDescriptionData.text + '</span><a class="remove" data-id="' + studyDescriptionData.text + '" id="' + studyDescriptionData.text + '"><span class="icon-ic-close"></span></a></li>')
                                        });
                                    }

                                    _.each(studyInfoJson.attorney, function (attorney, index) {
                                        if (attorney && index === 0) {
                                            $("input:radio[name=Attorney][value=" + attorney.condition + "]").prop("checked", true);
                                        }
                                        $('#ulListAttorneys').append('<li><span>' + attorney.value + '</span><a class="remove" data-id="' + attorney.value + '" id="' + attorney.value + '"><span class="icon-ic-close"></span></a></li>')
                                    });

                                    $("input:radio[name=Institution][value=" + studyInfoJson.institution.condition + "]").prop("checked", true);

                                    for (var j = 0; j < studyInfoJson.institution.list.length; j++) {
                                        if (studyInfoJson.institution.list[j].text) {
                                            var opt = document.createElement('Option');
                                            opt.text = studyInfoJson.institution.list[j].text
                                            opt.value = j;
                                            document.getElementById('listInstitution').options.add(opt);
                                        }
                                    }

                                    $("input:radio[name=Modality][value=" + studyInfoJson.modality.condition + "]").prop('checked', true);
                                    for (var j = 0; j < studyInfoJson.modality.list.length; j++) {
                                        $('#listModality option').each(function (i, selected) {
                                            if (studyInfoJson.modality.list[j].id == $(selected).val()) {
                                                document.getElementById('listModality').options[i].selected = true;
                                            }
                                        });
                                    }

                                    if (studyInfoJson.facility && studyInfoJson.facility.condition) {
                                        $("input:radio[name=Facility][value=" + studyInfoJson.facility.condition + "]").prop('checked', true);
                                        for (var j = 0; j < studyInfoJson.facility.list.length; j++) {
                                            $('#listFacility option').each(function (i, selected) {
                                                if (studyInfoJson.facility.list[j].id == $(selected).val()) {
                                                    document.getElementById('listFacility').options[i].selected = true;
                                                }
                                            });
                                        }
                                    }

                                    $('#ulListOrdFacility').empty();
                                    if (studyInfoJson.ordering_facility && studyInfoJson.ordering_facility.condition) {
                                        $("input:radio[name=ordFacility][value=" + studyInfoJson.ordering_facility.condition + "]").prop('checked', true);
                                        var interval = 0;
                                        var setSelection = function () {
                                            if ($('#listOrdFacility option').length > 0) {
                                                for (var j = 0; j < studyInfoJson.ordering_facility.list.length; j++) {

                                                    $('#listOrdFacility option').each(function (i, selected) {
                                                        if (studyInfoJson.ordering_facility.list[j].id == $(selected).val()) {
                                                            document.getElementById('listOrdFacility').options[i].selected = true;
                                                            if ($('#ulListOrdFacility a[data-id="' + studyInfoJson.ordering_facility.list[j].id + '"]').length === 0) {
                                                                $('#ulListOrdFacility').append('<li><span>' + $(selected).text() + '</span><a class="remove" data-id="' + studyInfoJson.ordering_facility.list[j].id + '"><span class="icon-ic-close"></span></a></li>')
                                                            }
                                                        }
                                                    });

                                                }
                                                clearInterval(interval);
                                            }


                                        };
                                        // create an interval so that this code will run when the select is populated.
                                        interval = setInterval(setSelection, 100);
                                    }

                                    $("input:radio[name=BodyPart][value=" + studyInfoJson.bodyPart.condition + "]").prop('checked', true);
                                    for (var j = 0; j < studyInfoJson.bodyPart.list.length; j++) {
                                        $('#listBodyPart option').each(function (i, selected) {
                                            if (studyInfoJson.bodyPart.list[j].id == $(selected).val()) {
                                                document.getElementById('listBodyPart').options[i].selected = true;
                                            }
                                        });
                                    }

                                    $("input:radio[name=Flag][value=" + studyInfoJson.flag.condition + "]").prop('checked', true);
                                    for (var j = 0; j < studyInfoJson.flag.list.length; j++) {
                                        $('#listFlag option').each(function (i, selected) {
                                            if (studyInfoJson.flag.list[j].text == $(selected).text()) {
                                                document.getElementById('listFlag').options[i].selected = true;
                                            }
                                        });
                                    }

                                    $("input:radio[name=State][value=" + studyInfoJson.stat.condition + "]").prop('checked', true);
                                    for (var j = 0; j < studyInfoJson.stat.list.length; j++) {
                                        $('#listStat option').each(function (i, selected) {
                                            if (studyInfoJson.stat.list[j].id == $(selected).val()) {
                                                document.getElementById('listStat').options[i].selected = true;
                                            }
                                        });
                                    }

                                    $("input:radio[name=Status][value=" + studyInfoJson.status.condition + "]").prop('checked', true);
                                    $('input[name=LastChangedByMe]').prop('checked', (!!studyInfoJson.status.last_changed_by_me))
                                    for (var j = 0; j < studyInfoJson.status.list.length; j++) {
                                        $('#listStatus option').each(function (i, selected) {
                                            if (studyInfoJson.status.list[j].id == $(selected).val()) {
                                                document.getElementById('listStatus').options[i].selected = true;
                                            }
                                        });
                                    }
                                    if (studyInfoJson && studyInfoJson.vehicle && studyInfoJson.vehicle.condition) {
                                        $("input:radio[name=Vehicle][value=" + studyInfoJson.vehicle.condition + "]").prop("checked", true);
                                        for (var j = 0; j < studyInfoJson.vehicle.list.length; j++) {
                                            $('#listVehicle option').each(function (i, selected) {
                                                if (studyInfoJson.vehicle.list[j].id == $(selected).val()) {
                                                    document.getElementById('listVehicle').options[i].selected = true;
                                                }
                                            });
                                        }
                                    }
                                }
                                else {
                                    var claimStatusJson = response.filter_info.ClaimInformation.claimStatus;
                                    $("input:radio[name=ClaimInfo][value=" + claimStatusJson.condition + "]").prop('checked', true);
                                    for (var j = 0; j < claimStatusJson.list.length; j++) {
                                        $('#listClaimInfo option').each(function (i, selected) {
                                            if (claimStatusJson.list[j].value == $(selected).val()) {
                                                document.getElementById('listClaimInfo').options[i].selected = true;
                                            }
                                        });
                                    }

                                    var billingMethodJson = response.filter_info.ClaimInformation.billingMethod;
                                    $("input:radio[name=BillingMethod][value=" + billingMethodJson.condition + "]").prop('checked', true);
                                    for (var j = 0; j < billingMethodJson.list.length; j++) {
                                        $('#listBillingMethod option').each(function (i, selected) {
                                            if (billingMethodJson.list[j].value == $(selected).val()) {
                                                document.getElementById('listBillingMethod').options[i].selected = true;
                                            }
                                        });
                                    }

                                    var payerTypeJson = response.filter_info.ClaimInformation.payerType;
                                    $("input:radio[name=PayerType][value=" + payerTypeJson.condition + "]").prop('checked', true);
                                    for (var j = 0; j < payerTypeJson.list.length; j++) {
                                        $('#listPayerType option').each(function (i, selected) {
                                            if (payerTypeJson.list[j].value == $(selected).val()) {
                                                document.getElementById('listPayerType').options[i].selected = true;
                                            }
                                        });
                                    }

                                    var balanceJson = response.filter_info.ClaimInformation.balance;
                                    $("input:radio[name=Balance][value=" + balanceJson.condition + "]").prop('checked', true);
                                    $('#listBalance').val(balanceJson.value);
                                }
                            }
                            if(self.opener == "studies"){
                                self.summary()
                            }
                        }
                    });
                }
                else
                    this.model = new studyFiltersModel();
                commonjs.validateControls();
                commonjs.updateCulture(app.currentCulture, commonjs.beautifyMe);
            },

            saveStudyFilter: function (studyFilterId) {
                var self = this;
                var dateJsonCondition = null;
                if (window.location && window.location.hash.split('/')[1] == 'studies')
                    var filterType = 'studies';
                if (window.location && window.location.hash.split('/')[1] == 'claim_workbench')
                    var filterType = 'claims';
                filterName = $('#txtFilterName').val() ? $('#txtFilterName').val().trim() : '';
                filterOrder = $('#txtFilterOrder').val() ? $('#txtFilterOrder').val().trim() : '';
                isActive = !$('#chkIsActive').is(":checked");
                isGlobal = $('#chkIsGlobalFilter').is(":checked");
                isDisplayAsTab = $('#chkDisplayAsTab').is(":checked");
                isDisplayInDropDown = $('#chkDisplayAsDDL').is(":checked");

                if(!filterName){
                    commonjs.showWarning('Please Enter FilterName');
                    return;
                }
                if(!filterOrder){
                    commonjs.showWarning('Please Enter FilterOrder');
                    return;
                }
                if (filterOrder < 0) {
                    commonjs.showWarning('Please Enter FilterOrder In Positive');
                    return;
                }

                if(!isDisplayAsTab && !isDisplayInDropDown){
                    commonjs.showWarning('Please Select Display as a Tab or Display in DropDown');
                    return;
                }

                if ($('#rbtPreformatted').is(':checked')) {
                    var dateJsonCondition = "Preformatted";

                }
                else if ($('#rbtLast').is(':checked') || $('#rbtNext').is(':checked')) {
                    dateJsonCondition = $('#rbtLast').is(':checked') ? "Last" : "Next";
                    if (!commonjs.checkNotEmpty($('#txtLastTime').val())) {
                        commonjs.showWarning('messages.warning.setup.enter' + dateJsonCondition.toLowerCase() + 'time');
                        return;
                    }
                    if (!commonjs.checkNotEmpty($('#txtToTimeLast').val())) {
                        commonjs.showWarning('messages.warning.setup.entertotime');
                        return;
                    }

                    if (!commonjs.checkNotEmpty($('#txtFromTimeLast').val())) {
                        commonjs.showWarning('messages.warning.setup.enterfromtime');
                        return;
                    }

                }
                else if ($('#rbtDate').is(':checked')) {
                    dateJsonCondition = "Date";
                    var fromDt = $('#txtDateFrom').val(),
                        toDt = $('#txtDateTo').val();
                    if (fromDt && toDt) {
                        dateJsonCondition = "Date";
                        //var validationResult2 = commonjs.validateDateTimePickerRange(fromDt, toDt, true);
                        //if (!validationResult2.valid) {
                        //    commonjs.showWarning(validationResult2.message);
                        //    $('#lblSummaryDate').html();
                        //    return;
                        //}
                    }
                    else {
                        commonjs.showWarning('messages.warning.setup.selectfromtodate');
                        return;
                    }

                    if (fromDt && !toDt) {
                        commonjs.showWarning('messages.warning.setup.entertotime');
                        return;
                    }

                    if (!fromDt && toDt) {
                        commonjs.showWarning('messages.warning.setup.enterfromtime');
                        return;
                    }
                }
                var claimStatus = [];
                $('#listClaimInfo option:selected').each(function (i, selected) {
                    var jsonlistClaimInfo = {};
                    jsonlistClaimInfo.value = $(selected).val();
                    jsonlistClaimInfo.text = $(selected).text();
                    claimStatus.push(jsonlistClaimInfo);
                });
                if (claimStatus.length > 0 && !self.validateRadioButton('ClaimInfo', 'ClaimInfo')) {
                    return;
                }

                var billingMethod = [];
                $('#listBillingMethod option:selected').each(function (i, selected) {
                    var jsonlistbillingMethod = {};
                    jsonlistbillingMethod.value = $(selected).val();
                    jsonlistbillingMethod.text = $(selected).text();
                    billingMethod.push(jsonlistbillingMethod);
                });
                if (billingMethod.length > 0 && !self.validateRadioButton('BillingMethod', 'BillingMethod')) {
                    return;
                }

                var payerType = [];
                $('#listPayerType option:selected').each(function (i, selected) {
                    var jsonlistpayerType = {};
                    jsonlistpayerType.value = $(selected).val();
                    jsonlistpayerType.text = $(selected).text();
                    payerType.push(jsonlistpayerType);
                });
                if (payerType.length > 0 && !self.validateRadioButton('PayerType', 'PayerType')) {
                    return;
                }

                var balance = $('#listBalance').val();
                if (balance.length > 0 && !self.validateRadioButton('Balance', 'Balance')) {
                    return;
                }

                var arrPatientName = [];
                $('#listPatientName option').each(function (i, selected) {
                    var jsonPatientName = {};
                    var condition = $(selected).val().split("~")[0];
                    var patientName = $(selected).val().split("~")[1];
                    jsonPatientName.condition = condition;
                    jsonPatientName.value = patientName;
                    arrPatientName.push(jsonPatientName);
                });
                var arrPatientID = [];
                $('#listPatientID option').each(function (i, selected) {
                    var jsonPatientID = {};
                    var condition = $(selected).val().split("~")[0];
                    var patientID = $(selected).val().split("~")[1];
                    jsonPatientID.condition = condition;
                    jsonPatientID.value = patientID;
                    arrPatientID.push(jsonPatientID);
                });
                var readPhy = [];
                $('#listReadPhy option').each(function (i, selected) {
                    var jsonReadPhy = {};
                    var condition = $(selected).val().split("~")[0];
                    var ReadPhy = $(selected).val().split("~")[1];
                    jsonReadPhy.condition = condition;
                    jsonReadPhy.value = ReadPhy;
                    readPhy.push(jsonReadPhy);
                });
                var refPhy = [];
                $('#listRefPhy option').each(function (i, selected) {
                    var jsonRefPhy = {};
                    var condition = $(selected).val().split("~")[0];
                    var RefPhy = $(selected).val().split("~")[1];
                    jsonRefPhy.condition = condition;
                    jsonRefPhy.value = RefPhy;
                    refPhy.push(jsonRefPhy);
                });
                var insProv = [];
                $('#listInsurance option').each(function (i, selected) {
                    var jsonInsProv = {};
                    var condition = $(selected).val().split("~")[0];
                    var InsProv = $(selected).val().split("~")[1];
                    jsonInsProv.condition = condition;
                    jsonInsProv.value = InsProv;
                    insProv.push(jsonInsProv);
                });
                var arrInstitution = [];
                $('#listInstitution option').each(function (i, selected) {
                    var jsonInstitution = {};
                    jsonInstitution.id = $(selected).val();
                    jsonInstitution.text = $(selected).text();
                    arrInstitution.push(jsonInstitution);
                });
                if (arrInstitution.length > 0 && !self.validateRadioButton('Institution', 'Institution')) {
                    return;
                }

                var arrModality = [];
                $('#listModality option:selected').each(function (i, selected) {
                    var jsonModality = {};
                    jsonModality.id = $(selected).val();
                    jsonModality.text = $(selected).text();
                    arrModality.push(jsonModality);
                });
                if (arrModality.length > 0 && !self.validateRadioButton('Modality', 'Modality')) {
                    return;
                }

                var arrFacility = [];
                $('#listFacility option:selected').each(function (i, selected) {
                    var jsonFacility = {};
                    jsonFacility.id = $(selected).val();
                    jsonFacility.text = $(selected).text();
                    arrFacility.push(jsonFacility);
                });
                if (arrFacility.length > 0 && !self.validateRadioButton('Facility', 'Facility')) {
                    return;
                }
                var arrStatus = [];
                $('#listStatus option:selected').each(function (i, selected) {
                    var jsonStatus = {};
                    jsonStatus.id = $(selected).val();
                    jsonStatus.text = $(selected).text();
                    arrStatus.push(jsonStatus);
                });
                if (arrStatus.length > 0 && !self.validateRadioButton('Status', 'Status')) {
                    return;
                }
                var arrVehicle = [];
                $('#listVehicle option:selected').each(function (i, selected) {
                    var jsonVehicle = {};
                    jsonVehicle.id = $(selected).val();
                    jsonVehicle.text = $(selected).text();
                    arrVehicle.push(jsonVehicle);
                });
                if (arrVehicle.length > 0 && !self.validateRadioButton('Vehicle', 'Vehicle')) {
                    return;
                }
                var arrBodyPart = [];
                $('#listBodyPart option:selected').each(function (i, selected) {
                    var jsonBodyPart = {};
                    jsonBodyPart.id = $(selected).val();
                    jsonBodyPart.text = $(selected).text();
                    arrBodyPart.push(jsonBodyPart);
                });
                if (arrBodyPart.length > 0 && !self.validateRadioButton('BodyPart', 'BodyPart')) {
                    return;
                }
                var arrStat = [];
                $('#listStat option:selected').each(function (i, selected) {
                    var jsonStat = {};
                    jsonStat.id = $(selected).val();
                    jsonStat.text = $(selected).text();
                    arrStat.push(jsonStat);
                });
                if (arrStat.length > 0 && !self.validateRadioButton('State', 'Stat')) {
                    return;
                }
                var arrFlag = [];
                $('#listFlag option:selected').each(function (i, selected) {
                    var jsonFlag = {};
                    jsonFlag.id = $(selected).val();
                    jsonFlag.text = $(selected).text();
                    arrFlag.push(jsonFlag);
                });
                if (arrFlag.length > 0 && !self.validateRadioButton('Flag', 'Flag')) {
                    return;
                }
                var arrOrdFacility = [];
                $('#listOrdFacility option:selected').each(function (i, selected) {
                    var jsonFlag = {};
                    jsonFlag.id = $(selected).val();
                    jsonFlag.text = $(selected).text();
                    arrOrdFacility.push(jsonFlag);
                });
                if (arrOrdFacility.length > 0 && !self.validateRadioButton('ordFacility', 'ordFacility')) {
                    return;
                }
                if ($.trim($('#txtAccession').val()) && !self.validateRadioButton('Accession', 'Accession')) {
                    return;
                }
                if ($.trim($('#txtStudyID').val()) && !self.validateRadioButton('StudyID', 'StudyID')) {
                    return;
                }

                if ($.trim($('#txtStudyDescription').val()) && !self.validateRadioButton('StudyDescription', 'Study Description')) {
                    return;
                }
                if ($.trim($('#txtAttorney').val()) && !self.validateRadioButton('Attorney', 'Attorney')) {
                    return;
                }
                if ( $.trim($('#txtAttorney').val()) && !self.validateRadioButton('Attorney', 'Attorney') ) {
                    return;
                }

                var arrTemp = $('ul#ulListStudyDescriptions li a').map(function () {
                    return this.id;
                }).get();

                var arrStudyDescriptions = [];
                _(arrTemp).forEach(function(value) {
                    var jsonFlag = {};
                    jsonFlag.id = "";
                    jsonFlag.text = value;
                    arrStudyDescriptions.push(jsonFlag);
                });

                var attorneyCondition = $('input[name=Attorney]:checked').val() !== undefined ? $('input[name=Attorney]:checked').val() : 'Contains';
                var tempAttorneys = $('ul#ulListAttorneys li a').map(function () {
                    return this.id;
                }).get();

                var attorneys = [];
                _(tempAttorneys).forEach(function (value) {
                    var attorneyObj = {};
                    attorneyObj.condition = attorneyCondition;
                    attorneyObj.value = value;
                    attorneys.push(attorneyObj);
                });

                var imageDeliveryCondition = $('input[name=ImageDelivery]:checked').val();
                var imageDelivery;
                if ( imageDeliveryCondition ) {
                    var imageDeliveryValue = $('#listImageDelivery').val();
                    imageDelivery = Array.isArray(imageDeliveryValue)
                        ? imageDeliveryValue
                        : ( imageDeliveryValue ? [ imageDeliveryValue ] : [] );
                }
                else {
                    imageDelivery = [];
                }

                var jsonData = {};

                if (self.opener == "studies") {
                    jsonData = {
                        date: {
                            condition: dateJsonCondition,
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
                        }, patientInformation: {
                            patientName: arrPatientName, patientID: arrPatientID
                        },
                        studyInformation: {
                            institution: {
                                condition: $('input[name=Institution]:checked').val(),
                                list: arrInstitution
                            },
                            modality: {
                                condition: $('input[name=Modality]:checked').val(),
                                list: arrModality
                            },
                            facility: {
                                condition: $('input[name=Facility]:checked').val(),
                                list: arrFacility
                            },
                            status: {
                                condition: $('input[name=Status]:checked').val(),
                                last_changed_by_me: $('input[name=LastChangedByMe]').prop('checked') || false,
                                list: arrStatus
                            },
                            vehicle: {
                                condition: $('input[name=Vehicle]:checked').val(),
                                list: arrVehicle
                            },
                            bodyPart: {
                                condition: $('input[name=BodyPart]:checked').val(),
                                list: arrBodyPart
                            },
                            studyID: {
                                condition: $('input[name=StudyID]:checked').val(),
                                value: $.trim($('#txtStudyID').val())
                            },
                            accession: {
                                condition: $('input[name=Accession]:checked').val(),
                                value: $.trim($('#txtAccession').val())
                            },
                            stat: {
                                condition: $('input[name=State]:checked').val(),
                                list: arrStat
                            },
                            flag: {
                                condition: $('input[name=Flag]:checked').val(),
                                list: arrFlag
                            },
                            study_description: {
                                condition: $('input[name=StudyDescription]:checked').val() !== undefined ? $('input[name=StudyDescription]:checked').val() : $('#chkContainsStudyDescription').is(":checked") ? $('#chkContainsStudyDescription').val() : '',
                                list: arrStudyDescriptions
                            },
                            attorney: attorneys,
                            ordering_facility: {
                                condition: $('input[name=ordFacility]:checked').val(),
                                list: arrOrdFacility
                            }
                        },
                        physician: {
                            readPhy: readPhy,
                            refPhy: refPhy,
                            imageDelivery: {
                                condition: imageDeliveryCondition,
                                list: imageDelivery
                            }
                        },
                        insurance: {
                            insProv: insProv
                        }
                    }
                } else {
                    jsonData = {
                        date: {
                            condition: dateJsonCondition,
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
                            dateType:  "claim_dt"
                        },
                        ClaimInformation: {
                            claimStatus: {
                                condition: $('input[name=ClaimInfo]:checked').val(),
                                list: claimStatus
                            },
                            billingMethod: {
                                condition: $('input[name=BillingMethod]:checked').val(),
                                list: billingMethod
                            },
                            payerType: {
                                condition: $('input[name=PayerType]:checked').val(),
                                list: payerType
                            },
                            balance: {
                                condition: $('input[name=Balance]:checked').val(),
                                value: $('#listBalance').val()
                            }
                        }
                    }
                }

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
                            if (!response.length)
                                commonjs.showStatus("Already Exists");
                            else {
                                commonjs.showStatus("Saved Succesfully");
                                if (filterType == "studies")
                                    $('#btnStudiesCompleteRefresh').click();
                                else if (filterType == "claims")
                                    $('#btnClaimsCompleteRefresh').click();
                                commonjs.hideLoading();
                                self.showGrid();
                            }                            
                        },
                        error: function (model, response) {
                            commonjs.handleXhrError(model, response);
                        }
                    });
            },

            tabClick: function (e) {
                var self = this;
                this.previous = (this.previous == "" ? "tabDateTime" : this.previous);
                switch (this.previous) {
                    case "tabDateTime":
                        $('#divDateTime').hide();
                        this.previous = (e.currentTarget || e.srcElement).id;
                        break;
                    case "tabPatientInformation":
                        $('#divPatientInformation').hide();
                        this.previous = (e.currentTarget || e.srcElement).id;
                        break;
                    case "tabStudyInformation":
                        $('#divStudyInformation').hide();
                        this.previous = (e.currentTarget || e.srcElement).id;
                        break;
                    case "tabPhysician":
                        $('#divPhysician').hide();
                        this.previous = (e.currentTarget || e.srcElement).id;
                        break;
                    case "tabInsurance":
                        $('#divInsurance').hide();
                        this.previous = (e.currentTarget || e.srcElement).id;
                        break;
                    case "tabAssignToUser":
                        $('#divAssignToUser').hide();
                        this.previous = (e.currentTarget || e.srcElement).id;
                        break;
                    default :
                        break;
                }

                switch ((e.currentTarget || e.srcElement).id) {
                    case "tabDateTime":
                        $('#divDateTime').show();
                        break;
                    case "tabPatientInformation":
                        $('#divPatientInformation').show();
                        break;
                    case "tabStudyInformation":
                        $('#divStudyInformation').show();
                        break;
                    case "tabPhysician":
                        $('#divPhysician').show();
                        break;
                    case "tabInsurance":
                        $('#divInsurance').show();
                        break;
                    case "tabAssignToUser":
                        $('#divAssignToUser').show();
                        break;
                    default:
                        break;
                }
            },

            addItemToList: function (e) {
                var self = this;
                var opt = document.createElement('Option');
                var IdName = e.target.nodeName == 'I' ? $(e.target).closest('button') : $(e.target);
                switch ($(IdName).attr('id')) {
                    case 'btnAddPatientName':
                        if (commonjs.checkNotEmpty($('#txtPatientName').val()) && self.validateRadioButton('PatientName', 'PatientName')) {
                            var radValue = $('input[name=PatientName]:checked').val();
                            opt.text = 'Name' + " " + radValue + " " + $.trim($('#txtPatientName').val());
                            opt.value = radValue + '~' + $.trim($('#txtPatientName').val());
                            document.getElementById('listPatientName').options.add(opt);
                            $('#txtPatientName').val('');
                        }
                        else if (!commonjs.checkNotEmpty($('#txtPatientName').val())) {
                            commonjs.showWarning("setup.studyFilters.entertextandselect");
                            return false;
                        }
                        break;
                    case 'btnAddPatientID':
                        if (commonjs.checkNotEmpty($('#txtPatientID').val()) && self.validateRadioButton('PatientID', 'Account')) {
                            var radValue = $('input[name=PatientID]:checked').val();
                            opt.text = "Account#" + " " + radValue + " " + " " + $.trim($('#txtPatientID').val());
                            opt.value = radValue + '~' + $.trim($('#txtPatientID').val());
                            document.getElementById('listPatientID').options.add(opt);
                            $('#txtPatientID').val('');
                        }
                        else if (!commonjs.checkNotEmpty($('#txtPatientID').val())) {
                            commonjs.showWarning("setup.studyFilters.entertextandselect");
                            return false;
                        }
                        break;
                    case 'btnAddReadPhy':
                        if (commonjs.checkNotEmpty($('#txtReadPhy').val()) && self.validateRadioButton('ReadPhy', 'ReadPhy')) {
                            var radValue = $('input[name=ReadPhy]:checked').val();
                            opt.text = "ReadPhy" + " " + radValue + " " + $.trim($('#txtReadPhy').val());
                            opt.value = radValue + '~' + $.trim($('#txtReadPhy').val());
                            document.getElementById('listReadPhy').options.add(opt);
                            $('#txtReadPhy').val('');
                        }
                        else if (!commonjs.checkNotEmpty($('#txtReadPhy').val())) {
                            commonjs.showWarning("setup.studyFilters.entertextandselect");
                            return false;
                        }
                        break;
                    case 'btnAddRefPhy':
                        if (commonjs.checkNotEmpty($('#txtRefPhy').val()) && self.validateRadioButton('RefPhy', 'RefPhy')) {
                            var radValue = $('input[name=RefPhy]:checked').val();
                            opt.text = "RefPhy" + " " + radValue + " " + $.trim($('#txtRefPhy').val());
                            opt.value = radValue + '~' + $.trim($('#txtRefPhy').val());
                            document.getElementById('listRefPhy').options.add(opt);
                            $('#txtRefPhy').val('');
                        }
                        else if (!commonjs.checkNotEmpty($('#txtRefPhy').val())) {
                            commonjs.showWarning("setup.studyFilters.entertextandselect");
                            return false;
                        }
                        break;
                    case 'btnAddInsurance':
                        if (commonjs.checkNotEmpty($('#txtInsurance').val()) && self.validateRadioButton('InsProv', 'InsProv')) {
                            var radValue = $('input[name=InsProv]:checked').val();
                            opt.text = "InsProv" + " " + radValue + " " + $.trim($('#txtInsurance').val());
                            opt.value = radValue + '~' + $.trim($('#txtInsurance').val());
                            document.getElementById('listInsurance').options.add(opt);
                            $('#txtInsurance').val('');
                        }
                        else if (!commonjs.checkNotEmpty($('#txtInsurance').val())) {
                            commonjs.showWarning("setup.studyFilters.entertextandselect");
                            return false;
                        }
                        break;
                }
                e.stopPropagation();
                return false;
            },

            removeItemFromList: function (e) {
                var IdName = e.target.nodeName == 'I' ? $(e.target).closest('button') : $(e.target);
                switch ($(IdName).attr('id')) {
                    case "btnRemovePatientName":
                        if ($('#listPatientName option:selected').length > 0) {
                            $('#listPatientName option:selected').remove();
                        } else {
                            commonjs.showWarning('messages.warning.setup.selectitemstodelete');
                        }
                        break;
                    case "btnRemovePatientID":
                        if ($('#listPatientID option:selected').length > 0) {
                            $('#listPatientID option:selected').remove();
                        }
                        else {
                            commonjs.showWarning('messages.warning.setup.selectitemstodelete');
                        }
                        break;
                    case "btnRemoveReadPhy":
                        if ($('#listReadPhy option:selected').length > 0) {
                            $('#listReadPhy option:selected').remove();
                        }
                        else {
                            commonjs.showWarning('messages.warning.setup.selectitemstodelete');
                        }
                        break;
                    case "btnRemoveRefPhy":
                        if ($('#listRefPhy option:selected').length > 0) {
                            $('#listRefPhy option:selected').remove();
                        }
                        else {
                            commonjs.showWarning('messages.warning.setup.selectitemstodelete');
                        }
                        break;
                    case "btnRemoveInsurance":
                        if ($('#listInsurance option:selected').length > 0) {
                            $('#listInsurance option:selected').remove();
                        }
                        else {
                            commonjs.showWarning('messages.warning.setup.selectitemstodelete');
                        }
                        break;
                }
                e.stopPropagation();
                return false;
            },

            validateRadioButton: function (rbtName, alertName) {
                var isChecked = false;
                for (var i = 0; i < $('input:radio[name=' + rbtName + ']').length; i++) {
                    if ($('input:radio[name=' + rbtName + ']')[i].checked) {
                        isChecked = true;
                    }
                }
                if (!isChecked) {
                    commonjs.showWarning('Please select ' + alertName + ' condition', 'smallwarning', true);
                }
                return isChecked;
            },

            addInstitutionList: function () {
                var self = this;
                if (commonjs.checkNotEmpty($('#txtInstitutionStudyFilter').val()) && self.validateRadioButton('Institution', 'Institution')) {
                    var opt = document.createElement('Option');
                    opt.text = $.trim($('#txtInstitutionStudyFilter').val());
                    opt.value = $.trim($('#txtPatientID').val());
                    document.getElementById('listInstitution').options.add(opt);
                    $('#txtInstitutionStudyFilter').val('');
                    return false;
                }
                else {
                    commonjs.showWarning("messages.warning.setup.entertextandselect");
                    return false;
                }
            },

            removeInstitutionList: function () {
                if ($('#listInstitution option:selected').length > 0) {
                    $('#listInstitution option:selected').remove();
                }
                else {
                    commonjs.showWarning("messages.warning.setup.selectitemstodelete");
                }
                return false;
            },

            setDafaultTab: function () {
                var self = this;
                var selectedTab = $('#ddlStudyDefaultTab').val();
                app.defaultTab = selectedTab;
                var userID = app.userID;
                self.setSelectedTabAsDefault(selectedTab, userID);
            },

            setupLists: function () {
                if (this.opener == "studies") {
                    var statusCodes = defaultStatusArray.concat(app.customOrderStatus).concat(app.customStudyStatus);
                    var facilities = app.userInfo.user_type === 'SU' ?
                        app.facilities :
                        app.userFacilities;
                    setupList('listModality', app.modalities, 'modality_code');
                    setupList('listBodyPart', app.bodyParts);
                    setupList('listStat', app.stat_level.slice(1), 'description', 'level');
                    setupList('listFlag', app.studyflag,'description');
                    setupList('listStatus', statusCodes, 'status_desc', 'status_code');
                    setupList('listVehicle', app.vehicles, 'vehicle_name');
                    setupList('listFacility', facilities, 'facility_name');
                    this.setOrderingFacilityAutoComplete()
                }
                else {
                    setupList('listClaimInfo', app.claim_status, 'description', 'id');
                    setupList('listBillingMethod', defaultBillingMethod, 'desc', 'code');
                    setupList('listPayerType', defaultPayerType, 'desc', 'code');
                    setupList('listBalance', app.balance, 'balance');
                }
            },

            setOrderingFacilityAutoComplete: function () {
                var self = this;
                $("#ddlOrdFacility").select2({
                    ajax: {
                        url: "/exa_modules/billing/autoCompleteRouter/provider_group",
                        dataType: 'json',
                        delay: 250,
                        data: function (params) {
                            return {
                                page: params.page || 1,
                                q: params.term || '',
                                pageSize: 10,
                                sortField: "group_name",
                                sortOrder: "ASC",
                                groupType: 'OF',
                                company_id: 1
                            };
                        },
                        processResults: function (data, params) {
                            params.page = params.page || 1;
                            return {
                                results: data,
                                pagination: {
                                    more: (params.page * 30) < data[0].total_records
                                }
                            };
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
                    markup += "<td class='movie-info'><div class='movie-title'><b>" + repo.group_name + "</b></div>";
                    markup += "</td></tr></table>";
                    return markup;
                }
                function formatRepoSelection(res) {
                    self.group_name = res.group_name;
                    self.group_id = res.provider_group_id;
                    if (res && res.id) {
                        return res.group_name;
                    }

                }
            },

            studyFilterSideMenuResize: function () {
                var ul = $('#ulStudyFilterSideMenu');
                var h = ul.outerHeight(true) - ul.height();
                var docHeight = $('#ulStudyFilterSideMenu').offset().top - h / 2;
                ul.height(docHeight);
                $('#divStudyFilterSide').height(docHeight);
            },

            resetForm: function () {
                var self = this;

                $('#txtFilterName').val('');
                $('#txtFilterOrder').val('');
                $('#chkDisplayAsTab').prop('checked', false);
                $('#chkDisplayAsDDL').prop('checked', true);

                $('#txtLastTime').val('');

                $('#txtPatientName').val('');

                $('#txtPatientID').val('');
                $('#listPatientName option').remove();
                $('#listPatientID option').remove();
                $('#txtStudyID').val('');
                $('#txtAccession').val('');
                $('#txtAttorney').val('');
                $('#txtStudyDescription').val('');
                $('#txtInstitutionStudyFilter').val('');

                $('#ulListOrdFacility').empty();
                $('#listOrdFacility option').remove();

                $('#listFacility option').remove();
                $('#listInstitution option').remove();
                $('#listModality option').remove();
                $('#listStatus option').remove();
                $('#listVehicle option').remove();
                $('#listBodyPart option').remove();
                $('#listStat option').remove();
                $('#listFlag option').remove();
                $('#txtReadPhy').val('');
                $('#txtRefPhy').val('');
                $('#txtInsurance').val('');
                $('#listReadPhy option').remove();
                $('#listRefPhy option').remove();
                $('#listInsurance option').remove();
                $('#lblSummaryDate').text('');
                $('#lblSummaryPName').text('');
                $('#lblSummaryPID').text('');
                $('#lblSummaryReadPhy').text('');
                $('#lblSummaryRefPhy').text('');
                $('#lblSummaryInstitution').text('');
                $('#lblSummaryModality').text('');
                $('#lblFacility').text('');
                $('#lblSummaryStatus').text('');
                $('#lblSummaryVehicle').text('');
                $('#lblSummaryBodyPart').text('');
                $('#lblSummaryStat').text('');
                $('#lblSummaryFlag').text('');
                $('#lblSummaryAccession').text('');
                $('#lblSummaryAttorney').text('');
                $('#lblSummaryStudyDescription').text('');

                $('#lblSummaryStudyID').text('');
                $('#txtAccession').val('');
                $('#txtAttorney').val('');
                $('#txtStudyID').val('');

                $('#chkIsActive').prop('checked',false);
                $('#chkIsGlobalFilter').prop('checked',false);
                $('#chkDisplayAsTab').prop('checked',false);
                $('#chkDisplayAsDDL').prop('checked',false);

                toggleOption('rbtStudyDate', false);
                toggleOption('rbtIsPatientName', false);
                toggleOption('showRisOrders', false);
                toggleOption('showDCMStudies', false);
                toggleOption('rbtIsReadPhy', false);
                toggleOption('rbtIsRefPhy', false);
                toggleOption('shwAssignedStudies', false);
                $('#txtFromTimeLast, #txtToTimeLast, #txtLastTime, #ddlLast').val('');
                $('#txtDateFrom, #txtFromTimeDate, #txtDateTo, #txtToTimeDate').val('');

                $('#listPayerType option').remove();
                $('#listBillingMethod option').remove();
                $('#listClaimInfo option').remove();
                $('#listBalance').val('');

                this.enableDateFrom();
                this.enableLastNext();
                this.enablePreformatted();
                this.uncheckRadioButtons();
                this.setupLists();

                $('#ulListStudyDescriptions').empty();
                $('#ulListAttorneys').empty();
                $('#chkContainsStudyDescription').prop('checked', false);

                $('#listImageDelivery').val('');
            },

            uncheckRadioButtons: function () {
                var $inputs = $("#studyFiltersForm").find('input');
                var $radioButtons = $inputs.filter('[type=radio]');
                $radioButtons.filter('[name=DateTime]').prop('checked', false);
                $radioButtons.filter('[name=DateOperations]').prop('checked', false);
                $radioButtons.filter('[name=PatientName]').prop('checked', false);
                $radioButtons.filter('[name=PatientID]').prop('checked', false);
                $radioButtons.filter('[name=Institution]').prop('checked', false);
                $radioButtons.filter('[name=Status]').prop('checked', false);
                $inputs.filter('[name=LastChangedByMe]').prop('checked', false);
                $radioButtons.filter('[name=State]').prop('checked', false);
                $radioButtons.filter('[name=Modality]').prop('checked', false);
                $radioButtons.filter('[name=BodyPart]').prop('checked', false);
                $radioButtons.filter('[name=Flag]').prop('checked', false);
                $radioButtons.filter('[name=StudyID]').prop('checked', false);
                $radioButtons.filter('[name=Accession]').prop('checked', false);
                $radioButtons.filter('[name=ReadPhy]').prop('checked', false);
                $radioButtons.filter('[name=RefPhy]').prop('checked', false);
                $radioButtons.filter('[name=ImageDelivery]').prop('checked', false);
                $radioButtons.filter('[name=Facility]').prop('checked', false);
                $radioButtons.filter('[name=Vehicle]').prop('checked', false);
                $radioButtons.filter('[name=StudyDescription]').prop('checked', false);
                $radioButtons.filter('[name=Attorney]').prop('checked', false);
                $radioButtons.filter('[name=InsProv]').prop('checked', false);
                $radioButtons.filter('[name=ClaimInfo]').prop('checked', false);
                $radioButtons.filter('[name=BillingMethod]').prop('checked', false);
                $radioButtons.filter('[name=PayerType]').prop('checked', false);
                $radioButtons.filter('[name=Balance]').prop('checked', false);
            },

            summary: function () {
                var self = this;
                var text = "";
                if ($('#rbtLast').is(':checked') || $('#rbtNext').is(':checked')) {
                    text = $('#rbtLast').is(':checked') ? 'Last ' : 'Next ';
                    if (commonjs.checkNotEmpty($('#txtLastTime').val())) {
                        var lastFromTo = "",
                            fromTime = self.timeConverter($('#txtFromTimeLast').val()),
                            toTime = self.timeConverter($('#txtToTimeLast').val());
                        if (fromTime && toTime) {
                            lastFromTo = " " + fromTime + " " + toTime;
                        }
                        $('#lblSummaryDate').text(text + $.trim($('#txtLastTime').val()) + ' ' + $('#ddlLast').val() + lastFromTo);
                    }
                    else {
                        $('#lblSummaryDate').text('');
                    }
                }
                // Date From - Date To
                else {
                    var fromDt = $('#txtDateFrom').val(),
                        toDt = $('#txtDateTo').val();
                    if (fromDt && toDt) {
                        var fromTime = $('#txtFromTimeDate').val() ? " " + self.timeConverter($('#txtFromTimeDate').val()) : "";
                        var toTime = $('#txtToTimeDate').val() ? " " + self.timeConverter($('#txtToTimeDate').val()): "";
                        $('#lblSummaryDate').text('Date: from ' + fromDt + fromTime + ' to ' + toDt + toTime);
                    }
                }

                $('#lblSummaryPName').text(this.listBoxAllArray('listPatientName'));
                $('#lblSummaryPID').text(this.listBoxAllArray('listPatientID'));
                $('#lblSummaryReadPhy').text(this.listBoxAllArray('listReadPhy'));
                $('#lblSummaryRefPhy').text(this.listBoxAllArray('listRefPhy'));
                $('#lblSummaryInsurance').text(this.listBoxAllArray('listInsurance'));
                if (this.listBoxAllArray('listInstitution').length > 0) {
                    $('#lblSummaryInstitution').text('Institution :' + $('input[name=Institution]:checked').val() + ' ' + this.listBoxAllArray('listInstitution'));
                }
                $('#lblFacility').text('Facility :' + this.listBoxSelectedArray('listFacility', 'Facility'));
                $('#lblSummaryModality').text('Modality :' + this.listBoxSelectedArray('listModality', 'Modality'));
                $('#lblSummaryStatus').text('Status :' + this.listBoxSelectedArray('listStatus', 'Status'));
                $('#lblSummaryVehicle').text('Vehicle :' + this.listBoxSelectedArray('listVehicle', 'Vehicle'));
                $('#lblSummaryBodyPart').text('BodyPart :' + this.listBoxSelectedArray('listBodyPart', 'BodyPart'));
                $('#lblSummaryStat').text('Stat :' + this.listBoxSelectedArray('listStat', 'State'));
                $('#lblSummaryFlag').text('Flag :' + this.listBoxSelectedArray('listFlag', 'Flag'));
                $('#lblSummaryAccession').text('Accession :' + ($.trim($('#txtAccession').val()).length > 0 ? $('input[name=Accession]:checked').val() + " " + $.trim($('#txtAccession').val()) : ""));
                $('#lblSummaryAttorney').text('Attorney :' + ($.trim($('#txtAttorney').val()).length > 0 ? $('input[name=Attorney]:checked').val() + " " + $.trim($('#txtAttorney').val()) : ""));
                $('#lblSummaryStudyDescription').text('Study Description :' + ($.trim($('#txtStudyDescription').val()).length > 0 ? $('input[name=StudyDescription]:checked').val() + " " + $.trim($('#txtStudyDescription').val()) : ""));
                $('#lblSummaryStudyID').text('StudyID :' + ($.trim($('#txtStudyID').val()).length > 0 ? $('input[name=StudyID]:checked').val() + " " + $.trim($('#txtStudyID').val()) : ""));
                this.removeEmpty();
                this.hideSummaryLabel();
            },

            removeEmpty: function () {
                var arr = [];
                $('#ulSummary li').each(function (i, selected) {
                    switch ($(selected)[0].id) {
                        case 'liDate':
                            ($('#lblSummaryDate').text().length > 0) ? $('#liDate').show() : $('#liDate').hide();
                            break;
                        case 'liPName':
                            ($('#lblSummaryPName').text().length > 0) ? $('#liPName').show() : $('#liPName').hide();
                            break;
                        case 'liPID':
                            ($('#lblSummaryPID').text().length > 0) ? $('#liPID').show() : $('#liPID').hide();
                            break;
                        case 'liModality':
                            ($('#lblSummaryModality').text().length > 10) ? $('#liModality').show() : $('#liModality').hide();
                            break;
                        case 'liFacility':
                            ($('#lblFacility').text().length > 10) ? $('#liFacility').show() : $('#liFacility').hide();
                            break;
                        case 'liBodyPart':
                            ($('#lblSummaryBodyPart').text().length > 10) ? $('#liBodyPart').show() : $('#liBodyPart').hide();
                            break;
                        case 'liFlag':
                            ($('#lblSummaryFlag').text().length > 6) ? $('#liFlag').show() : $('#liFlag').hide();
                            break;
                        case 'liInstitution':
                            ($('#lblSummaryInstitution').text().length > 13) ? $('#liInstitution').show() : $('#liInstitution').hide();
                            break;
                        case 'liStatus':
                            ($('#lblSummaryStatus').text().length > 8) ? $('#liStatus').show() : $('#liStatus').hide();
                            break;
                        case 'liVehicle':
                            ($('#lblSummaryVehicle').text().length > 9) ? $('#liVehicle').show() : $('#liVehicle').hide();
                            break;
                        case 'liStat':
                            ($('#lblSummaryStat').text().length > 6) ? $('#liStat').show() : $('#liStat').hide();
                            break;
                        case 'liReadPhy':
                            ($('#lblSummaryReadPhy').text().length > 0) ? $('#liReadPhy').show() : $('#liReadPhy').hide();
                            break;
                        case 'liRefPhy':
                            ($('#lblSummaryRefPhy').text().length > 0) ? $('#liRefPhy').show() : $('#liRefPhy').hide();
                            break;
                        case 'liStudyID':
                            ($('#lblSummaryStudyID').text().length > 9) ? $('#liStudyID').show() : $('#liStudyID').hide();
                            break;
                        case 'liAccession':
                            ($('#lblSummaryAccession').text().length > 11) ? $('#liAccession').show() : $('#liAccession').hide();
                            break;
                        case 'liAttorney':
                            ($('#lblSummaryAttorney').text().length > 11) ? $('#liAttorney').show() : $('#liAttorney').hide();
                            break;
                        case 'liStudyDescription':
                            ($('#lblSummaryStudyDescription').text().length > 19) ? $('#liStudyDescription').show() : $('#liStudyDescription').hide();
                            break;
                        case 'liInsurance':
                            ($('#lblSummaryInsurance').text().length > 11) ? $('#liInsurance').show() : $('#liInsurance').hide();
                            break;
                    }
                });
            },

            hideSummaryLabel: function () {
                var isExist = false;
                for (var i = 0; i < $('#ulSummary li').length; i++) {
                    if ($('#ulSummary li')[i].style.display != 'none') {
                        isExist = true;
                        break;
                    }
                }
                if (!isExist) {
                    $('#divSummary').hide();
                }
                else
                    $('#divSummary').show();
            },

            listBoxAllArray: function (listID) {
                var arrAll = [];
                $('#' + listID + ' option').each(function (i, selected) {
                    arrAll[i] = $(selected).text();
                });

                return arrAll;
            },

            listBoxSelectedArray: function (listID, radioName) {
                var arrSummary = [];
                $('#' + listID + ' option:selected').each(function (i, selected) {
                    arrSummary[i] = $(selected).text();
                });
                if (arrSummary.length > 0) {
                    arrSummary = " " + $('input[name=' + radioName + ']:checked').val() + " " + arrSummary
                }
                return arrSummary;
            },

            timeConverter: function (timeStr){
               var time = timeStr.split(':');
               return (time[0] > 12) ? ""+(time[0]-12)+":"+time[1]+" PM": ""+time[0]+":"+time[1]+" AM" ;
            }
        })
    });