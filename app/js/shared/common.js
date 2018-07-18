
var moment;
require.config({
    waitSeconds: 0,
    paths: {
        'moment': '../node_modules/moment/min/moment-with-locales',
        'moment-timezone': '../node_modules/moment-timezone/builds/moment-timezone-with-data.min'
    }
});

define(['moment-timezone'], function (momenttz) {
    moment = momenttz;
});

var settingsReceived = false
    , patientFrameVisited = false
    , companiesReceived = false
    , orderFrameVisited = false
    , tickTimer = null
    , jq_isWidthResize
    , jq_isHeightResize
    , jq_userWidth
    , jq_userHeight
    , jq_offsetWidth
    , jq_offsetheight
    , burnQueue_Study = []
    , cdburnStudies = []
    , cdBurnerObj
    , merge_Studies = []
    , multiMergestudy = []
    , study_uid_arr = []
    , study_uid_arr_multi = []
    , studyTab = ""
    , removeStudyTab = ""
    , editStudyID = 0
    , editOrderID = 0
    , isDefaultTab = false
    , homeOpentab = ""
    , _isDirty = false
    , arrInterval = []
    , isPatientSearch = true
    , filterQueries = []
    , prevTime,
    setupStatusCodes = function (data) {
        commonjs.statusCodes = data;
        // Below is for my convenience
        var i = 0;
        var count = data.length;
        var regUndesirables = /[^A-Z0-9\s\-]/g;
        var code;
        var desc;
        if (Array.isArray(data) && count !== 0) {
            for (; i < count; ++i) {
                code = data[i];
                desc = code.status_desc.toUpperCase().replace(regUndesirables, '');
                commonjs.statusCodesMap = commonjs.statusCodesMap.set(code.status_code, desc);
                commonjs.statusCodesNamesMap = commonjs.statusCodesNamesMap.set(desc, code.status_code);
            }
        }
    }
    , $window = $(window)
    , $document = $(document)
    , $body = $('body');

var commonjs = {
    requestTimeout: 25000,
    currentModule: '',
    currentTargetID: null,
    hasLoaded: false,
    loadingTime: 0,
    sessionElapsed: 0,
    socket: null,
    currentValidator: null,
    scrollLeft: 0,
    viewerObj: null,
    isFirstTime: false,
    studyFilters: Immutable.List(),
    loadedStudyFilters: Immutable.Map(),
    currentStudyFilter: '',

    localCacheMaxErrorLimit: 0,

    filterData: {},

    /**
     * Setting up zip autocomplete:
     *
     * - Each input gets a class (.city-input, .state-input, .zip-input)
     * - Place this just after zip input
     *
            <div
                class="zip-list-container"
                style="display: none;">
                <label i18n="shared.fields.availableZipCodes"></label>
                <select class="zip-list"></select>
                <button
                    disabled
                    type="button"
                    class="apply-zip"
                    i18n="shared.buttons.apply"></button>
            </div>
     * - All need to be wrapped in an element with
     *    class="... get-city-state-by-zip get-zip-by-city-state"
     * - Whatever view has the inputs must also run `commonjs.initializeScreen()` or `commonjs.setupCityStateZipInputs()`
     */
    setupCityStateZipInputs: function setupCityStateZipInputs() {
        var $getCityStateByZipContainer = $('.get-city-state-by-zip');
        $getCityStateByZipContainer.each(function (index) {
            var $this = $(this);
            var $cityInput = $this.find('.city-input');
            var $stateInput = $this.find('.state-input');
            var $zipInput = $this.find('.zip-input');

            function handleChangeZip(event) {
                var zip = ($zipInput.val() || '').trim();

                if (zip > 0) {
                    $.ajax({
                        'url': '/getCityState',
                        'data': {
                            'zip': zip
                        },
                        success: function (response) {
                            var result = response.result;
                            if (String(~~result.zip) === zip && result.city && result.state) {
                                $cityInput.val(result.city);
                                $stateInput.val(result.state);
                            }
                        },
                        error: function (error) {
                            console.error('Error getting city/state using zip ' + zip, error);
                        }
                    });
                }
            }

            $zipInput
                .off('change')
                .on('change', handleChangeZip);

        });

        var $getZipByCityStateContainer = $('.get-zip-by-city-state');
        $getZipByCityStateContainer.each(function (index) {
            var $this = $(this);
            var $cityInput = $this.find('.city-input');
            var $stateInput = $this.find('.state-input');
            var $zipInput = $this.find('.zip-input');
            var $zipListContainer = $this.find('.zip-list-container');
            var $zipList = $zipListContainer.find('.zip-list');
            var $applyZipButton = $zipListContainer.find('.apply-zip');

            function handleChangeCityState(event) {
                var city = ($cityInput.val() || '').trim().toUpperCase();
                var state = ($stateInput.val() || '').trim().toUpperCase();

                if (city && state) {
                    $.ajax({
                        'url': '/getZip',
                        'data': {
                            'city': city,
                            'state': state
                        },
                        success: function (response) {
                            var result = response.result;
                            $zipList.empty();
                            var currentZip = ($zipInput.val() || '').trim();

                            if (result.zip && result.zip.length > 0 && result.zip.indexOf(currentZip) === -1 && result.city === city && result.state === state) {
                                var options = result.zip.sort().reduce(function (list, zip) {
                                    var option = document.createElement('option');
                                    option.value = zip;
                                    option.innerHTML = zip;

                                    list.appendChild(option);
                                    return list;
                                }, document.createDocumentFragment());

                                $zipList.append(options);
                                $applyZipButton.removeAttr('disabled');
                                $zipListContainer.show();

                            }
                            else {
                                $zipListContainer.hide();
                                $applyZipButton.attr('disabled', true);
                            }
                        },
                        error: function (error) {
                            console.error('Error getting city/state using zip ' + zip, error);
                        }
                    });
                }
            }

            function handleApplyZip(event) {
                $zipInput.val($zipList.val());
                $zipListContainer.hide();
                $applyZipButton.attr('disabled', true);
            }

            $cityInput
                .off('change')
                .on('change', handleChangeCityState);
            $stateInput
                .off('change')
                .on('change', handleChangeCityState);
            $applyZipButton
                .off('click')
                .on('click', handleApplyZip);

        });
    },

    getDates: function (data) {
        /*
         if > 13 characters then it's a range

         13 comes from:
            4 - YYYY
            2 - MM
            2 - DD
            2 - (delimiters between those three)
            3 - " - " splitter for range
        */
        if (data.length > 13) {
            var dateArray = data.split(/\s-\s/);
            if (dateArray.length > 1) {
                var date1 = moment(dateArray[0], 'L').locale('en').format('YYYY-MM-DD');
                var date2 = moment(dateArray[1], 'L').locale('en').format('YYYY-MM-DD');
                return date1 + ' - ' + date2;
            }
            else {
                date1 = moment(data.slice(0, ~~(data.length / 2)), 'L').locale('en').format('YYYY-MM-DD');
                date2 = moment(data.slice(-(~~(data.length / 2) + 1)), 'L').locale('en').format('YYYY-MM-DD');
                return date1 + ' - ' + date2;
            }
        }
        else {
            return moment(data, 'L').locale('en').format('YYYY-MM-DD');
        }
    },

    setFilter: function (id, data) {
        //var root = window.parent || window;
        var root = window;
        var cjs = root.commonjs || commonjs;
        var filters = cjs.loadedStudyFilters;
        var filter = filters.get(id);
        if (data !== null) {
            if (typeof filter === 'undefined') {
                cjs.loadedStudyFilters = filters.set(id, data);
                return true;
            }
            else {
                if (typeof data === 'function') {
                    cjs.loadedStudyFilters = filters.update(id, data);
                    return true;
                }
                else if (typeof data === 'object') {
                    cjs.loadedStudyFilters = filters.update(id, function (gridObj) {
                        return Object.assign({}, gridObj, data);
                    });
                    return true;
                }
            }
        }
        else {
            if (typeof filter !== 'undefined') {
                // filter.customGridTable.jqGrid('GridUnload');
                cjs.loadedStudyFilters = filters.delete(id);
                return true;
            }
            else {
                cjs.loadedStudyFilters = (Immutable || root.Immutable).Map();
            }
        }
        return false;
    },
    getData: function (id, filterID) {
        var root = window.parent || window;
        var cjs = root.commonjs;
        filterID = filterID || cjs.currentStudyFilter || root.homeOpentab;
        var filter = cjs.loadedStudyFilters.get(filterID);
        if (filter) {
            var store = filter.datastore;
            if (store) {
                var isValidString = typeof id === 'string' && id.trim() !== '';
                var isValidNumber = typeof id === 'number' && !isNaN(id);
                var isValidObject = typeof id === 'object' && id !== null;
                if (isValidString || isValidNumber || isValidObject) {
                    var model = isValidString || isValidNumber ?
                        store.get(id) :
                        store.findWhere(id);
                    return model && model.toJSON() || null;
                }
            }
        }
        return null;
    },
    /**
     * Alter study information in current filter's datastore.
     * @param {Object|Object[]} data - Array of many or single object
     * @param {string|number}   [id] - If included it means to change, not add
     * @returns {boolean}
     */
    setData: function (data, id) {
        var root = window.parent || window;
        var cjs = root.commonjs;
        var filterID = cjs.currentStudyFilter || root.homeOpentab;
        var filter = cjs.loadedStudyFilters.get(filterID);
        if (typeof data === 'object' && filter && filter.datastore) {
            // var isValidString = typeof id === 'string' && id.trim() !== '';
            // var isValidNumber = typeof id === 'number' && !isNaN(id);
            // var isValidID = isValidString || isValidNumber || id === true;
            filter.datastore.add(Array.isArray(data) ? data : [data], {
                'merge': true,
                'filter': filter,
                'filterID': filterID,
                'validate': true,
                'fromSocket': true
            });
            return cjs.setFilter(filterID, filter);
        }
        return false;
    },
    /**
     * Delete current filter's datastore entry for any matching order IDs
     * @param {string[]|number[]}   idArray - One or more study IDs in an array
     * @returns {boolean}
     */
    removeOrderData: function (idArray) {
        var root = window.parent || window;
        var cjs = root.commonjs;
        var filterID = cjs.currentStudyFilter || root.homeOpentab;
        var filter = cjs.loadedStudyFilters.get(filterID);
        if (filter && filter.datastore) {
            var studies = idArray.reduce(function (array, id) {
                var matches = filter.datastore.where({ 'order_id': id });
                if (matches.length > 0) {
                    return array.concat(matches);
                }
                return array;
            }, []);
            filter.datastore.remove(studies, {
                'filter': filter,
                'filterID': filterID
            });
            return cjs.setFilter(filterID, filter);
        }
        return false;
    },
    /**
     * Delete current filter's datastore entry for any matching study IDs
     * @param {string[]|number[]}   idArray - One or more study IDs in an array
     * @returns {boolean}
     */
    removeStudyData: function (idArray) {
        var root = window.parent || window;
        var cjs = root.commonjs;
        var filterID = cjs.currentStudyFilter || root.homeOpentab;
        var filter = cjs.loadedStudyFilters.get(filterID);
        if (filter && filter.datastore) {
            filter.datastore.remove(idArray, {
                'filter': filter,
                'filterID': filterID
            });
            return cjs.setFilter(filterID, filter);
        }
        return false;
    },
    lastOpenedID: 0,
    quickviewImageID: 0,
    useJsonpForPrefetch: false,
    useWebworkersForAjaxCalls: false,
    statusCodes: [],
    statusCodesMap: Immutable.Map(),
    statusCodesNamesMap: Immutable.Map(),
    setupStatusCodes: setupStatusCodes,
    homeOpentab: "",
    nextRowID: 0,
    patientFacility: null,
    orderFacility: null,
    previousRowID: 0,
    currentGridID: '',
    userHeartbeatInterval: 5, /// in minutes
    currentPatientID: '',
    patientHeartbeat: false,
    encPatientID: 0,
    encOrderID: 0,
    encFacilityID: 0,
    encStudyID: 0,
    newStudyObj: {},
    scheduleBookObj: {},
    newOrderObj: {},
    localUrl: "http://127.0.0.1:8421",
    studyInfo: {},
    isSingleInstance: false,
    singleInstanceData: {},
    prefetchErr: {},
    origGridParams: {},
    new_rcopia_window: null,
    edited_study_id: 0,
    study_facility_id: 0,
    maxHL7MessageLength: 50000,

    ddlPayer_id: 0,
    ddlPayer_name: '',
    ddlPayer_type: '',
    prevNotes: [],
    orderNotes: [],
    autoCompleteChanged: false,

    pageSize: [
        { 'value': '', 'text': 'Select' },
        { 'value': '25', 'text': '25' },
        { 'value': '50', 'text': '50' },
        { 'value': '100', 'text': '100' },
        { 'value': '200', 'text': '200' }
    ],
    reportType: [
        //        {'value': 'RA', 'text': 'Report Approval'},
        { 'value': 'CA', 'text': 'Study Cancelation' },
        { 'value': 'RL', 'text': 'Report Link' },
        { 'value': 'RA', 'text': 'Report Attachment' },
        { 'value': 'PR', 'text': 'Patient Portal Registration' },
        { 'value': 'TR', 'text': 'Transmit Report' }
    ],

    patientFlags: {
        'HMO': "HMO Patient", 'MEDPAT': "Medicare Patient", '9999': "Unavailable / Unknown", '99': "No Typology Code available for payment source", '98': "Other specified (includes Hospice - Unspecified plan)", '96': "Auto Insurance (no fault)", '959': "Worker's Comp, Other unspecified",
        '954': "Worker's Comp Other Managed Care", '953': "Worker's Comp Fee-for-Service", '951': "Worker's Comp HMO", '95': "Worker's Compensation", '94': "Long-term Care Insurance", '93': "Disability Insurance", '92': "Other (Non-government)", '91': "Foreign National", '9': "MISCELLANEOUS/OTHER", '89': "No Payment, Other", '85': "Research/Donor",
        '84': "Hill Burton Free Care", '83': "Refusal to Pay/Bad Debt", '823': "Research/Clinical Trial", '822': "Professional Courtesy", '821': "Charity", '82': "	No Charge", '81': "Self-pay", '8': "NO PAYMENT from an Organization/Agency/Program/Private Payer Listed", '79': "Other Managed Care, Unknown if public or private",
        '73': "POS", '72': "PPO", '71': "HMO", '7': "MANAGED CARE, UNSPECIFIED (to be used only if one can't distinguish public from private)", '69': "BC (Indemnity or Managed Care) - Other", '64': "BC (Indemnity or Managed Care) - Unspecified", '63': "BC (Indemnity or Managed Care) - Out of State", '62': "BC Indemnity", '619': "BC Managed Care - Other", '613': "BC Managed Care - POS", '612': "BC Managed Care - PPO",
        '611': "BC Managed Care - HMO", '61': "BC Managed Care", '6': "BLUE CROSS/BLUE SHIELD", '59': "Other Private Insurance", '55': "Small Employer Purchasing Group", '54': "Organized Delivery System", '53': "Managed Care (private) or private health insurance (indemnity), not otherwise specified", '529': "Private health insurance-other commercial Indemnity",
        '523': "Medicare supplemental policy (as second payer)", '522': "Self-insured (ERISA) Administrative Services Only (ASO) plan", '521': "Commercial Indemnity", '52': "Private Health Insurance - Indemnity", '519': "Managed Care, Other (non HMO)", '515': "Gatekeeper PPO (GPPO)", '514': "Exclusive Provider Organization", '513': "Commercial Managed Care - POS", '512': "Commercial Managed Care - PPO", '511': "Commercial Managed Care - HMO", '51': "Managed Care (Private)", '5': "PRIVATE HEALTH INSURANCE", '44': "Corrections Unknown Level", '43': "Corrections Local",
        '42': "Corrections State", '41': "Corrections Federal", '4': "DEPARTMENTS OF CORRECTIONS", '39': "Other Federal", '389': "Federal, State, Local not specified - Other", '382': "	Federal, State, Local not specified - FFS", '3819': "Federal, State, Local not specified - not specified managed care", '3813': "Federal, State, Local not specified - POS", '3812': "Federal, State, Local not specified - PPO", '3811': "Federal, State, Local not specified - HMO", '381': "Federal, State, Local not specified managed care", '38': "Other Government (Federal, State, Local not specified)", '379': "Local, not otherwise specified (other local, county)",
        '372': "FFS/Indemnity", '3713': "POS", '3712': "PPO", '3711': "HMO", '371': "Local - Managed care", '37': "Local Government", '369': "State, not otherwise specified (other state)", '362': "Specific state programs (list/ local code)", '361': "State SCHIP program (codes for individual states)", '36': "State Government", '35': "Black Lung", '349': "Other", '343': "Ryan White Act", '342': "Migrant Health Program",
        '341': "Title V (MCH Block Grant)", '334/': "Indian Tribe - Sponsored Coverage", '333': "Indian Health Service - Managed Care", '332': "Indian Health Service - Contract", '331': "Indian Health Service - Regular", '33': "Indian Health Service or Tribe", '3229': "Other non-veteran care", '3223': "Children of Women Vietnam Veterans (CWVV)", '3222': "Spina Bifida Health Care Program (SB)", '3221': "Civilian Health and Medical Program for the VA (CHAMPVA)", '322': "Non-veteran care", '32126': "Other Federal Agency",
        '32125': "Sharing Agreements", '32124': "State Veterans Home", '32123': "Contract Nursing Home/Community Nursing Home", '32122': "Foreign Fee/Foreign Medical Program(FMP)", '32121': "Fee Basis", '3212': "Indirect Care--Care provided outside VA facilities", '3211': "Direct Care--Care provided in VA facilities", '321': "Veteran care--Care provided to Veterans", '32': "Department of Veterans Affairs", '313': "Dental --Stand Alone", '3123': "TRICARE For Life (TFL)", '3122': "Non-enrolled Space Available", '3121': "Enrolled Prime-HMO", '312': "Military Treatment Facility", '3119': "Department of Defense - (other)",
        '3116': "Uniformed Services Family Health Plan (USFHP) -- HMO", '3115': "TRICARE Reserve Select", '3114': "TRICARE For Life--Medicare Supplement", '3113': "TRICARE Standard - Fee For Service", '3112': "TRICARE Extra-PPO", '3111': "TRICARE Prime-HMO", '311': "TRICARE (CHAMPUS)", '31': "Department of Defense", '3': "OTHER GOVERNMENT (Federal/State/Local) (excluding Department of Corrections)", '29': "Medicaid Other", '25': "Medicaid - Out of State", '24': "Medicaid Applicant", '23': "Medicaid/SCHIP", '22': "Medicaid (Non-managed Care Plan)", '219': "Medicaid Managed Care Other", '213': "Medicaid PCCM (Primary Care Case Management)",
        '212': "Medicaid PPO", '211': "Medicaid HMO", '21': "Medicaid (Managed Care)", '2': "MEDICAID", '19': "Medicare Other", '129': "Medicare Non-managed Care Other", '123': "Medicare Medical Savings Account (MSA)", '122': "Medicare Drug Benefit", '121': "Medicare FFS", '12': "Medicare (Non-managed Care)", '119': "Medicare Managed Care Other", '113': "Medicare POS", '112': "Medicare PPO", '111': "	Medicare HMO", '11': "Medicare (Managed Care)", '1': "MEDICARE"
    },

    previousRange: null,

    limitedKeyCodes: [220, 192],

    limitedKeyCodesAfterShift: [187, 188, 190],

    winPosComplete: true,
    getMessage: function (type, fieldName) {
        switch (type) {
            case "*":
                return 'Enter ' + fieldName;
            case "e":
                return 'Please Enter Valid ' + fieldName;
            case "**":
                return 'Please Select ' + fieldName;
            default:
                return type;//acts as message when not passing the second arg
        }
    },

    checkWhetherIE: function () {
        return {
            isOpera: !!window.opera || navigator.userAgent.indexOf(' OPR/') >= 0,
            isFirefox: typeof InstallTrigger !== 'undefined',
            isSafari: Object.prototype.toString.call(window.HTMLElement).indexOf('Constructor') > 0,
            isChrome: !!window.chrome && !(!!window.opera || navigator.userAgent.indexOf(' OPR/') >= 0),
            isIE: /*@cc_on!@*/false || !!document.documentMode
        };
    },

    //
    // helpers for: https://eonasdan.github.io/bootstrap-datetimepicker/
    //

    validateDateTimePickerRange: function (f, t, allowFutureRange, timeUnit) {
        var dtpFrom = (f && (typeof f === "string")) ? this.getDateTimePicker(f) : f;
        var dtpTo = (t && (typeof t === "string")) ? this.getDateTimePicker(t) : t;
        var timeUnit = (typeof timeUnit === "undefined") ? "second" : timeUnit;
        var validTimeUnits = ["year", "month", "week", "day", "hour", "minute", "second"];
        var retVal = { valid: false, type: "error", message: "" };

        if (!dtpFrom || !dtpTo) {
            retVal.message = "DTPs 'from' and/or 'to' are null!";
            //throw new Error(retVal.message);
            return retVal;
        }
        if (validTimeUnits.indexOf(timeUnit) === -1) {
            retVal.message = "Invalid 'timeUnit'!";
            return retVal;
        }
        // use clones so there is no suprises...
        var mFrom = moment(dtpFrom.date());
        var mTo = moment(dtpTo.date());

        //console.log("validating range from: '"+ mFrom.format() + "', to: '" + mTo.format() + "', allowFutureRange: '" + allowFutureRange + "', timeUnit: '" + timeUnit + "'");

        if (!mFrom.isValid()) {
            retVal.message = "Invalid 'From' date!";
            return retVal;
        }
        if (!mTo.isValid()) {
            retVal.message = "Invalid 'To' date!";
            return retVal;
        }
        if (mFrom.isAfter(mTo, timeUnit)) {
            retVal.message = "'From' date should be before 'To' date!";
            return retVal;
        }
        // as per K.B. allow same From and To ...
        // if (mFrom.isSame(mTo, timeUnit)) {
        //     retVal.type = "warning";
        //     retVal.message = "'From' date is same as 'To' date!";
        //     return retVal;
        // }

        // allowFutureRange is when 'from' date/time is past the current date/date
        if (!allowFutureRange) {
            var relNow = moment(dtpFrom.getMoment()); // gets current dt (as clone) using DTP defined timezone
            if (mFrom.isAfter(relNow, timeUnit)) {
                retVal.type = "warning";
                retVal.message = "Date range is in the future!";
                return retVal;
            }
        }

        retVal = { valid: true, type: "info", message: "" };
        return retVal;
    },

    // @param {string|Object} elId - name of unique element id or jQuery object itself
    // @return {Object} instance of BS3 datetimepicker
    getDateTimePicker: function (elId) {
        if (!elId) {
            console.warn("BS3DTP: Element id or jQuery object for datetimepicker must be specified");
            return null;
        }
        var dtpTarget = (elId instanceof jQuery) ? elId : $("#" + elId);
        if (!dtpTarget.length) {
            console.warn("BS3DTP: Unable to find element with id: '" + dtpTarget.attr("id") + "' !");
            return null;
        }
        return dtpTarget.data("DateTimePicker");
    },

    // @param {string|Object} elId - name of unique element id or jQuery object itself
    // @return {Object} instance of BS3 datetimepicker
    bindDateTimePicker: function (elId, dtpOptions) {
        if (!elId) {
            console.warn("BS3DTP: Element id or jQuery object for datetimepicker must be specified");
            return null;
        }
        var dtpTarget = (elId instanceof jQuery) ? elId : $("#" + elId);
        //console.log('BS3DTP: Binding dtp to element with id: ' + dtpTarget.attr("id"));
        if (!dtpTarget.length) {
            console.warn("BS3DTP: Unable to find element with id: '" + dtpTarget.attr("id") + "' !");
            return null;
        }
        var defaultOptions = {
            format: "L LT",
            //locale: browserLocale,
            //timeZone: null,//this.getCompanyTimeZone(),
            showClose: true,
            showClear: true,
            //keepInvalid: true,
            //debug: true,
            showTodayButton: true,
            //toolbarPlacement: "default",
            keyBinds: null, //disable key bindings so manual entry is possible
            //icons: {
            //    time: "icon-ic-alarm",
            //    date: "icon-ic-schedule",
            //    up: "icon-chevron-up",
            //    down: "icon-chevron-down",
            //    previous: "icon-ic-expand",
            //    next: "icon-ic-expand-flipped",
            //    today: "icon-ic-radiobutton-on",
            //    clear: "icon-ic-trash",
            //    close: "icon-ic-close"
            //}
            icons: {
                time: "fa fa-clock-o",
                date: "fa fa-calendar",
                up: "fa fa-arrow-up",
                down: "fa fa-arrow-down",
                previous: "fa fa-chevron-left",
                next: "fa fa-chevron-right",
                today: "fa fa-bullseye",
                clear: "fa fa-trash",
                close: "fa fa-times"
            }

        };
        var options = $.extend(true, {}, defaultOptions, dtpOptions);
        // see: https://github.com/Eonasdan/bootstrap-datetimepicker/pull/666
        switch (options.format) {
            case "L":
                options.extraFormats = ["MM/DD/YY", "MM/DD/YYYY", "YYYY-MM-DD"];
                //boptions.timeZone = null; //remove the TZ when dealing with dates only!
                break;
            case " L LT":
                options.extraFormats = ["MM/DD/YYYY hh:mm A"];
                break;
            default:
        }

        dtpTarget.datetimepicker(options);
        dtpTarget.on("dp.change", function (e) {
            if (e && e.date) {
                //$('#datetimepicker7').data("DateTimePicker").minDate(e.date);
                var odts = (e && e.oldDate) ? ", oldDate: " + e.oldDate.format() : "";
                //                console.log("BS3DTP: event: 'dp.change'%s, date: %s, target: '%O'", odts, e.date.format(), e.target);
            }
        });
        dtpTarget.on("dp.error", function (e) {
            if (e && e.date) {
                //                console.warn("BS3DTP: event: 'dp.error', date: %s, isValid: %s, target: '%O'", e.date.format(), e.date.isValid(), e.target);
            }
        });
        var bs3dtp = dtpTarget.data("DateTimePicker");
        //console.log("BS3DTP: Final options for:  '%s' => %O", dtpTarget.attr("id"), (bs3dtp.options()));
        return bs3dtp;
    },

    //
    // helpers for: http://www.daterangepicker.com/
    //

    // @param {string|Object} elId - name of unique element id or jQuery object itself
    // @return {Object} instance of DRP daterangepicker
    getDateRangePicker: function (elId) {
        if (!elId) {
            console.warn("DRP: Element id for daterangepicker must be specified");
            return null;
        }
        var drpTarget = (elId instanceof jQuery) ? elId : $("#" + elId);
        if (!drpTarget.length) {
            console.warn("DRP: Unable to find element with id: '" + drpTarget.attr("id") + "' !");
            return null;
        }
        return drpTarget.data("daterangepicker");
    },

    // built-in DRP ranges, default is "past" set, others can be added easily...
    getDateRangePickerRanges: function (rangeSetName) {
        var pastRangeSet = {
            "Today": [moment(), moment()],
            "Yesterday": [moment().subtract(1, "days"), moment().subtract(1, "days")],
            "Last 7 Days": [moment().subtract(6, "days"), moment()],
            "Last 30 Days": [moment().subtract(29, "days"), moment()],
            "This Month": [moment().startOf("month"), moment().endOf("month")],
            "Last Month": [moment().subtract(1, "months").startOf("month"), moment().subtract(1, "months").endOf("month")],
            "This Year": [moment().startOf("year"), moment()]
        };
        var futureRangeSet = {
            "Today": [moment(), moment()],
            "Tommorow": [moment().add(1, "days"), moment().add(1, "days")],
            "Next 7 Days": [moment(), moment().add(6, "days")],
            "Next 30 Days": [moment(), moment().add(29, "days")],
            "This Month": [moment().startOf("month"), moment().endOf("month")],
            "Next Month": [moment().add(1, "months").startOf("month"), moment().add(1, "months").endOf("month")],
            "This Year": [moment().startOf("year"), moment()]
        };
        // 1940s, 1950s, etc, etc
        var birthDecadeRangeSet = {};
        var decadeStart = parseInt(moment().subtract(70, "years").format("YYYY").substr(0, 3) + "0"); // Start of decade 70 years ago
        var decadeEnd = parseInt(moment().add(10, "years").format("YYYY").substr(0, 3) + "0");        // Start of next decade
        for (var i = decadeStart; i < decadeEnd; i += 10) {
            birthDecadeRangeSet[i + "'s"] = [moment(i + '-01-01'), moment((i + 9) + '-12-31')];
        }

        if (!rangeSetName) {
            return pastRangeSet;
        }
        switch (rangeSetName) {
            case "dob":
                return birthDecadeRangeSet;
            case "future":
                return futureRangeSet;
            case "past":
            default:
                return pastRangeSet;
        }
    },

    // NOTE: while this component can be attached to just about any element, we force attaching to input boxes only!
    // @param {string|Object} elId - name of unique element id or jQuery object itself
    // @return {Object} instance of DRP daterangepicker
    bindDateRangePicker: function (elId, drpOptions, rangeSetName, callback) {
        if (!elId) {
            console.warn("DRP: Element id or jQuery object for daterangepicker must be specified");
            return null;
        }
        var drpTarget = (elId instanceof jQuery) ? elId : $("#" + elId);
        //console.log("DRP: binding to element with id: " + elId + ", rangeSetName: " + rangeSetName);
        if (!drpTarget.length) {
            console.warn("DRP: Unable to find element with id: '" + drpTarget.attr("id") + "' !");
            return null;
        }
        if (!drpTarget.is("input:text")) {
            console.warn("DRP: Element with id: '" + drpTarget.attr("id") + "' is not a text input!");
            return null;
        }
        var selectedRanges = commonjs.getDateRangePickerRanges(rangeSetName);
        var defaultOptions = {
            ranges: selectedRanges,
            autoUpdateInput: false,  // controll the text input manually via events (see below), to allow clear input upon initialization
            locale: {
                format: "L LT",
                cancelLabel: "Clear"
            },
            opens: "right",
            showDropdowns: true
        }
        var options = $.extend(true, {}, defaultOptions, drpOptions);
        drpTarget.daterangepicker(options, callback);
        //since DRP is attached to text input element, trigger 'filter mode' setup
        drpTarget.on("apply.daterangepicker", function (ev, drp) {
            var fmt = drp.locale.format;
            console.log("DRP: event: 'apply.daterangepicker', start: %s, end: %s, id: '%s'", drp.startDate.format(), drp.endDate.format(), drpTarget.attr("id"));
            if ((fmt === "L" && drp.startDate.isSame(drp.endDate, "day")) ||
                (fmt === "L LT" && drp.startDate.isSame(drp.endDate, "minute")) ||
                (fmt === "L LTS" && drp.startDate.isSame(drp.endDate, "second"))) {
                $(this).val(drp.startDate.format(fmt));
            } else {
                $(this).val(drp.startDate.format(fmt) + " - " + drp.endDate.format(fmt));
            }
        });
        drpTarget.on("cancel.daterangepicker", function (ev, drp) {
            console.log("DRP: event: 'cancel.daterangepicker', id: '%s'", drpTarget.attr("id"));
            $(this).val("");
        });
        // not needed ! DRP allready implements default .keydown functionality
        // enable triggering of DRP on keydown
        //drpTarget.on("keydown", function (ev) {
        //    if (drp.isShowing) {
        //        drp.hide();
        //    } else {
        //        drp.show();
        //    }
        //});

        var drp = drpTarget.data("daterangepicker");
        //console.log("DRP: Final options for: '%s' => %O", drpTarget.attr("id"), options);
        return drp;
    },


    bindColorPicker: function (id) {
        $('#' + id).colorpicker({
            format: 'hex'
        });
        $('#' + id).click(function (e) {
            if (!$('.colorpicker').is(':visible')) {
                $('#' + id).colorpicker('show');
            }
            return false;
        });
    },

    bindList: function (controlName, listArr, valuePrefix) {
        if (listArr && listArr.length > 0) {
            if (typeof valuePrefix == 'undefined') {
                valuePrefix = '';
            }
            $('#' + controlName + ' input').each(function () {
                for (var i = 0; i < listArr.length; i++) {
                    if ($(this)[0].value == valuePrefix + listArr[i]) {
                        $(this)[0].checked = true;
                        $(this).closest('li').addClass('highlightCheckBox');
                    }
                }
            });
        }
    },

    unbindList: function (controlName) {
        $('#' + controlName + ' li').removeClass('highlightCheckBox');
        $('#' + controlName + ' input').each(function () {
            $(this)[0].checked = false
        });
    },

    bindListCheckAll: function (controlName, checkAllName) {
        // Bind single item click
        $('#' + controlName + ' label').unbind().click(function () {
            commonjs.setAllList(controlName, checkAllName);
        });

        // Bind check all box click
        $('#' + checkAllName).unbind().click(function () {
            commonjs.clickAllList(controlName, checkAllName);
        });

        // Initialize check all box
        commonjs.setAllList(controlName, checkAllName);
    },

    clickAllList: function (controlName, checkAllName) {
        if ($('#' + checkAllName).prop('checked') == true) {
            $('#' + controlName + ' input').each(function (index, checkbox) {
                $(checkbox).closest('li').addClass('highlightCheckBox');
                checkbox.checked = true
            });
        }
        else {
            commonjs.unbindList(controlName);
        }
    },

    setAllList: function (controlName, checkAllName) {
        // Click happens before the checkbox is set. Slight delay needed.
        setTimeout(function () {
            if ($('#' + controlName + ' input:checkbox:not(:checked)').length <= 0) {
                $('#' + checkAllName).prop('checked', true);
            }
            else {
                $('#' + checkAllName).prop('checked', false);
            }
        }, 100);
    },

    getFormattedUrl: function (docServerUrl) {
        if (app.docServerUrl.indexOf('http://') == 0) {
            return docServerUrl.replace('http://', 'http@');
        }
        if (app.docServerUrl.indexOf('https://') == 0) {
            return docServerUrl.replace('https://', 'https@');
        }
        return docServerUrl;
    },

    showAbout: function () {
        var self = this;

        if (this.AboutTemplate && _) {
            $.ajax({
                url: '/exa_modules/billing/about',
                type: "GET",
                dataType: 'json',
                success: function (versionInfo, response) {
                    commonjs.hideLoading();

                    try {
                        var about = _.template(self.AboutTemplate);
                        var previewHtml = about({ data: versionInfo });

                        commonjs.showDialog({ header: 'About', width: '30%', height: '30%', html: previewHtml }, true);
                    } catch (err) {
                        console.log(err);
                    }
                },
                error: function (err, response) {
                    //commonjs.handleXhrError(err, response);
                }
            })
        }
    },

    showDialog: function (options) {
        options.modalContainerId = '#siteModal';
        options.spanHeaderId = '#spanModalHeader';
        options.modalBodyId = '#modalBody';
        options.modalDialogId = '#modalDialog';
        options.modalDivContainerId = '#modal_div_container';
        options.iframeContainerId = 'site_modal_iframe_container';

        commonjs.showDefaultDialog(options);
        commonjs.initHideEvent(options);
    },

    showNestedDialog: function (options) {
        options.modalContainerId = '#siteModalNested';
        options.spanHeaderId = '#spanModalHeaderNested';
        options.modalBodyId = '#modalBodyNested';
        options.modalDialogId = '#modalDialogNested';
        options.modalDivContainerId = '#modal_div_container_nested';
        options.iframeContainerId = 'site_modal_iframe_container_nested';

        commonjs.showDefaultDialog(options);
        commonjs.initHideEvent(options);
    },

    initHideEvent: function (options) {

        var modalContainerId = options.modalContainerId || '#siteModal';

        if (!commonjs.modalEvents) {
            commonjs.modalEvents = {};
        }

        if (commonjs.modalEvents[options.modalContainerId]) {
            return;
        }

        commonjs.modalEvents[options.modalContainerId] = true;
        var $siteModal = $(modalContainerId);

        $siteModal.on('hidden.bs.modal', function (event) {
            commonjs.disposeDialog(options);
        });
    },

    showDefaultDialog: function (options) {
        //console.trace("commonjs::showDialog: header: '%s', url: '%s', options: %O", options.header, options.url, options);

        var dataContainer, wid, hei;
        var modalContainerId = options.modalContainerId || '#siteModal';
        var modalDivContainerId = options.modalDivContainerId || '#modal_div_container';
        var modalDialogId = options.modalDialogId || '#modalDialog';
        var modalBodyId = options.modalBodyId || '#modalBody';
        var spanHeader = options.spanHeaderId || '#spanModalHeader';
        var iframeContainerId = options.iframeContainerId || 'site_modal_iframe_container';

        var $modalContainer = $(modalContainerId);
        var $modalDivContainer = $(modalDivContainerId);
        var $modalDialog = $(modalDialogId);
        var $modalBody = $(modalBodyId);
        var $spanHeader = $(spanHeader);

        if (options.width.indexOf('%') > 0) {
            var wwid = $window.width();
            wid = parseInt(options.width.replace('%', ''));
            wid = (wwid / 100) * wid;
        } else {
            wid = parseInt(options.width.replace('%', '').replace('px', ''));
        }

        if (options.height.indexOf('%') > 0) {
            var whei = $window.height();
            hei = parseInt(options.height.replace('%', ''));
            hei = (whei / 100) * hei;
        } else {
            hei = parseInt(options.height.replace('%', '').replace('px', ''));
        }

        if ($('#' + iframeContainerId)) {
            $('#' + iframeContainerId).hide();
            $modalDivContainer.show();
            $modalBody.css({ 'padding': '1rem' })
        }

        if (options.padding) {
            $modalBody.css({ 'padding': options.padding })
        }

        if (typeof options.url != 'undefined' && commonjs.checkNotEmpty(options.url)) {
            if (!document.getElementById(iframeContainerId)) {
                var ifr = document.createElement('iframe');
                ifr.id = iframeContainerId;
                ifr.frameBorder = 0;
                ifr.style.width = '100%';

                $modalBody.append($(ifr));
            }

            $modalBody.css({ 'padding': '0px' })

            dataContainer = $('#' + iframeContainerId);
            dataContainer.attr('src', options.url);
            dataContainer.show();
            $modalDivContainer.hide();
        } else if (typeof options.html != 'undefined' && commonjs.checkNotEmpty(options.html)) {
            dataContainer = $modalDivContainer.css({ 'overflow-x': 'hidden' });

            if (!options.haveContentInContainer) {
                dataContainer.html(options.html);
            }

            commonjs.updateCulture(app.currentCulture, commonjs.beautifyMe);
            dataContainer.show();
            $('#' + iframeContainerId).hide();
        }

        if (typeof options.onLoad != 'undefined' && commonjs.checkNotEmpty(options.onLoad)) {
            dataContainer = $('#' + iframeContainerId);
            dataContainer.attr('onLoad', options.onLoad);
        }

        if (options.i18nHeader) {
            $spanHeader.html(commonjs.geti18NString(options.i18nHeader));
        } else {
            $spanHeader.html(options.header);
        }

        //$modalContainer.attr('data-width', wid);
        $modalDialog.attr('style', 'width:' + wid + 'px');
        if (dataContainer) {
            if (options.needShrink) {
                if (window.innerHeight > window.innerWidth) {
                    var height = $window.height() / 2;
                    dataContainer.css('height', (height - 100) + 'px');
                } else {
                    dataContainer.css('height', hei + 'px');
                }
            } else {
                dataContainer.css('height', hei + 'px');
            }
        }

        var boolKeyboard = false; //(!app.changePassword);   // Sets whether the modal will allow keyboard commands such as ESC to close it
        if (options.isPatientNotes) {
            dataContainer.css('overflow', 'auto');
            //$modalContainer.modal({width: wid + 'px', show: true});
            $modalContainer.modal({ show: true, keyboard: boolKeyboard });
        } else if (options.isInitial) {
            $modalContainer.modal({ show: true, keyboard: boolKeyboard });
            $modalContainer.width(wid + 'px');

            $modalContainer.css({
                'margin-left': function () {
                    return -($(this).width() / 2);
                }
            });
        } else {
            //$modalContainer.modal({width: wid + 'px', show: true});
            $modalContainer.modal({ show: true, keyboard: boolKeyboard });
        }

        $modalContainer.on('hide', function (event) {
            if ($modalContainer.find('iframe')) {
                var url = $modalContainer.find('iframe').attr('src');
                if (url) {
                    $modalContainer.find('iframe').remove();
                }
            }

            if (options.onHide && typeof options.onHide === 'function') {
                options.onHide();
            }

            if (window.reportWindow)
                window.reportWindow.close();
            if (window.updaterRegisteredPortalInfo == true)
                window.updaterRegisteredPortalInfoObj.close();

            $modalContainer.off('hide');
        });
    },

    hideDialog: function (callback) {
        var options = {};

        options.modalContainerId = '#siteModal';
        options.modalDivContainerId = '#modal_div_container';
        options.iframeContainerId = 'site_modal_iframe_container';

        commonjs.hideDefaultDialog(options, callback);
    },

    hideNestedDialog: function (callback) {
        var options = {};

        options.modalContainerId = '#siteModalNested';
        options.modalDivContainerId = '#modal_div_container_nested';
        options.iframeContainerId = 'site_modal_iframe_container_nested';

        commonjs.hideDefaultDialog(options, callback);
    },

    hideDefaultDialog: function (options, callback) {
        var modalContainerId = options.modalContainerId || '#siteModal';
        var $siteModal = $(modalContainerId);

        $siteModal.modal('hide');
    },

    disposeDialog: function (options) {
        var modalDivContainerId = options.modalDivContainerId || '#modal_div_container';
        var iframeContainerId = options.iframeContainerId || 'site_modal_iframe_container';
        var modalContainerId = options.modalContainerId || '#siteModal';

        var $modalDivContainer = $(modalDivContainerId);
        var $iframeContainer = $('#' + iframeContainerId);
        var $siteModal = $(modalContainerId);

        $modalDivContainer.empty();
        $iframeContainer.attr('src', '');

        $siteModal.modal('dispose');
        //commonjs.docResize();

         //Report window close 
         this.closeReportWindow();
    },

    closeReportWindow: function () {
        if (window.reportWindow) {
            window.reportWindow.close();
            window.reportWindow = null;
        }
    },

    // Set app.settings.report_queue_status using API
    setAppSettingsReportQueueStatus: function () {
        app.settings.report_queue_status = [
            {
                "code": "QU",
                "description": "Queued"
            },
            {
                "code": "PR",
                "description": "Progress"
            },
            {
                "code": "SE",
                "description": "Sending"
            },
            {
                "code": "ST",
                "description": "Sent"
            },
            {
                "code": "CA",
                "description": "Canceled"
            },
            {
                "code": "RS",
                "description": "Resend"
            },
            {
                "code": "FA",
                "description": "Failed"
            },
            {
                "code": "IV",
                "description": "Invalid"
            },
            {
                "code": "PQ",
                "description": "Print - Queued"
            },
            {
                "code": "PD",
                "description": "Printed"
            },
            {
                "code": "UP",
                "description": "[Updox] Sent - Pending"
            },
            {
                "code": "US",
                "description": "[Updox] Sent - Succeeded"
            },
            {
                "code": "UF",
                "description": "[Updox] Sent - Failed"
            }
        ];
    },

    generateRandomNumber: function () {
        var randomNo = Math.random()
        randomNo = randomNo.toString();
        randomNo = randomNo.replace('.', '');
        return randomNo;
    },

    listSelection: function (controlName, name) {
        var listArr = [];
        $('#' + controlName + ' input').each(function () {
            if ($(this)[0].checked) {
                name ? listArr.push($($(this)[0]).attr('data-name')) : listArr.push($(this)[0].value);
            }
        });
        return listArr;
    },

    setAutocompleteInfinite: function (options) {
        $(options.containerID).select2({
            allowClear: !(options.clearnotNeed),
            placeholder: options.placeHolder,
            minimumInputLength: options.inputLength,
            dropdownCssClass: options.cssClass + ' select2-bigdrop',
            ajax: {
                url: options.URL,
                dataType: 'json',
                quietMillis: options.delay || 500, // property name was changed to "delay" (leaving this for compatibility with older versions) - see: https://github.com/select2/select2/issues/740#issuecomment-181472215
                delay: options.delay || 500,
                data: options.data,
                results: options.results
            },
            id: options.formatID,
            formatResult: options.formatResult,
            formatSelection: options.formatSelection,
            formatSearching: commonjs.formatSearching,
            createSearchChoice: options.createSearchChoice || null
        });
        if (options.disable) {
            $(options.containerID).select2("enable", false);
        }
    },

    formatSearching: function () {
        $('.bootstrap-datetimepicker-widget').hide();
        return "Searching...";
    },

    handleXhrError: function (err, response) {

        var errorMessage = '';
        commonjs.hideLoading();

        if (!response && err) {
            response = err;
        }

        if (typeof response !== 'object') {
            response = err;
        }

        if (response && response.responseJSON && response.responseJSON.errorCode) {
            response.status = response.responseJSON.errorCode;
        }

        if (response && response.responseJSON && response.responseJSON.errorDesc) {
            errorMessage = response.responseJSON.errorDesc;
        }

        /// To handle http(EDI) connect issues
        if (response && response.responseJSON && response.responseJSON.err) {
            err = response.responseJSON.err;
        }

        switch (err.status || response.status) {
            case 0:
                commonjs.showError('messages.errors.notconnected');
                break;

            case 404:
                commonjs.showError('messages.errors.requestnotfound');
                break;

            case 500:
                commonjs.showError('messages.errors.serversideerror');
                break;

            case 100:
                commonjs.showError(errorMessage);
                break;

            case '23503':
                commonjs.showError('Dependent records found');
                break;

            case '23505':
                var errMessage = 'Duplicate record found';
                if(exaInternalErrors && exaInternalErrors.constraints && exaInternalErrors.constraints[err.constraint]) {
                    errMessage = exaInternalErrors.constraints[err.constraint];
                }

                commonjs.showError(errMessage);
                break;

            case '23514':
                errorMessage = errorMessage.replace(/new row for relation/g, '');
                commonjs.showError(errorMessage || 'Constraint violation');
                break;

            case '55801':
                commonjs.showError('Unable to connect EDI Server');
                break;

            case 'HANDLED_EXCEPTION':
                commonjs.showError(errorMessage || 'Error :(');
                break;

            case 'INVALID_SESSION':
                $('#divPageLoading').hide();
                commonjs.showDialog({ header: 'Invalid Session', width: '50%', height: '50%', html: response.responseText }, true);
                break;

            default:
                commonjs.showError('messages.errors.someerror');
                break;
        }
    },

    highlightMenu: function (currentElement) {
        $('.sidebar-nav .active').removeClass("active");
        $(currentElement).addClass("active");
    },

    highlightMainMenu: function (currentElement) {
        $('.nav .active').removeClass("active");
        $(currentElement).addClass("active");
    },

    isValidResponse: function (response, status) {
        commonjs.hideLoading();
        if (response.status && response.status == 'ok') {
            if (response.flags) {
                var statusMsg = '';
                switch (response.flags.action) {
                    case 'SAVE':
                        statusMsg = 'messages.status.save';
                        break;
                    case 'UPDATE':
                        statusMsg = "messages.status.update";
                        break;
                    case 'DELETE':
                        statusMsg = "messages.status.delete";
                        break;
                }
                commonjs.showStatus(i18n.get(statusMsg));
            }
            else {
                if (status) {
                    commonjs.showStatus(status);
                }
            }
            return true;
        }
        else {
            if (response.result && response.result.error && response.result.error.code == '04') {
                commonjs.showError('messages.errors.dependentrecordfound');
            }
            else {
                if (response.hasOwnProperty("error") && response.error.hasOwnProperty("code")) {
                    switch (response.error.code) {
                        case '100':
                            break;
                        case '01':
                            // commonjs.showError('messages.errors.sessionexpired');
                            commonjs.showError('Session Expired');
                            commonjs.redirectToLoginPage('SE');
                            break;
                        case '00':
                            //commonjs.showError('messages.errors.requestnotauthenticated');
                            commonjs.showError('Request not authenticated');
                            commonjs.redirectToLoginPage('SE');
                            break;
                        case '03':
                            commonjs.showError('messages.errors.accessdenied');
                            break;
                        case '22':
                            commonjs.showError('messages.errors.rootdirectorynotexists');
                            break;
                        case '98':
                        default:
                            if (response.userData && response.userData.code == '100') {
                                commonjs.showError('messages.errors.norecordfound');
                            }
                            else {
                                commonjs.showError('messages.errors.someerror');
                            }
                            break;
                    }
                }
                // else {
                //     commonjs.showError('messages.errors.someerror');
                // }
            }
            return false;
        }
    },

    validateForm: function (options) {
        $("#divValidationBlock").hide();
        var container = $('div#validationSummary');
        var validator = $(options.formID).validate({
            rules: options.rules,
            messages: options.messages,
            onkeyup: false,
            onblur: false,
            errorContainer: container,
            errorLabelContainer: $("ul", container),
            wrapper: 'li',
            submitHandler: function (event) {
                if (!event) {
                    event = window.event;
                }
                if (event.preventDefault) {
                    event.preventDefault();
                }
                event.returnValue = false;
                options.submitHandler();
                return false;
            },

            invalidHandler: function (e, validator) {
                var errors = validator.numberOfInvalids();
                if (errors) {
                    $("#divValidationBlock").show();
                } else {
                    $("#divValidationBlock").hide();
                    $("div.error").hide();
                }
            },

            showErrors: function (errorMap, errorList) {
                var errors = validator.numberOfInvalids();
                this.defaultShowErrors();
                if (this.numberOfInvalids() == 0) {
                    $("#divValidationBlock").hide();
                }
            }
        });
    },

    hstoreStringify: function (data) {
        function sanitize_input(input) {
            // http://www.postgresql.org/docs/9.0/static/sql-syntax-lexical.html [4.1.2.1-4.1.2.2]
            // single quotes (') must be replaced with double single quotes ('')
            input = input.replace(/'/g, '\'\'');
            // backslashes (\) must be replaced with double backslashes (\\)
            input = input.replace(/\\/g, '\\\\');
            // double quotes (") must be replaced with escaped quotes (\\")
            input = input.replace(/"/g, '\\"');
            return input;
        }

        function to_string(input, sanitize) {
            switch (typeof input) {
                case 'boolean':
                case 'number':
                case 'object':
                    return String(input);
                case 'string':
                    return sanitize ? sanitize_input(input) : input;
                default:
                    return '';
            }
        }

        var hstore = Object.keys(data).map(function (key) {
            if (data[key] === null) {
                return '"' + to_string(key, true) + '"=>NULL';
            } else {
                return '"' + to_string(key, true) + '"=>"' + to_string(data[key], true) + '"';
            }
        });
        var joined = hstore.join();
        return joined;
    },
    hstoreParse: function (string) {
        if (!string)
            return {};
        if (typeof string === 'object') {
            return string;
        }
        var result = {},
            //using [\s\S] to match any character, including line feed and carriage return,
            r = /(["])(?:\\\1|\\\\|[\s\S])*?\1|NULL/g,
            matches = string.match(r),
            i,
            l,
            clean = function (value) {
                // Remove leading double quotes
                value = value.replace(/^\"|\"$/g, "");
                // Unescape quotes
                value = value.replace(/\\"/g, "\"");
                //Unescape backslashes
                value = value.replace(/\\\\/g, "\\");
                //Unescape single quotes
                value = value.replace(/''/g, "'");

                return value;
            };

        if (matches) {
            for (i = 0, l = matches.length; i < l; i += 2) {
                var key = clean(matches[i]);
                var value = matches[i + 1];
                result[key] = value == "NULL" ? null : clean(value);
            }
        }
        return result;
    },

    getElementFromEventTarget: function (e) {
        var targ;
        if (e.target) targ = e.target;
        else if (e.srcElement) targ = e.srcElement;
        if (targ.nodeType == 3)
            targ = targ.parentNode;
        return targ;
    },

    bindArray: function (arrayValue, isSelect, isFacility, isAll, fieldName) {
        var settingsArray = [];
        if (!isFacility) {
            if (isSelect) {
                settingsArray.push({
                    id: '',
                    text: 'Select'
                });
            }
            if (isAll) {
                settingsArray.push({
                    id: '-1',
                    text: 'All'
                });
            }
            for (var i = 0; i < arrayValue.length; i++) {
                settingsArray.push({
                    id: arrayValue[i],
                    text: arrayValue[i]
                });
            }
            return settingsArray;
        }
        else {
            if (isSelect) {
                settingsArray.push({
                    id: '',
                    text: 'Select'
                });
            }
            if (isAll) {
                settingsArray.push({
                    id: '-1',
                    text: 'All'
                });
            }
            for (var i = 0; i < arrayValue.length; i++) {
                var obj = {
                    id: arrayValue[i].id,
                    text: arrayValue[i].facility_name,
                    mobile_dispatch: arrayValue[i].mobile_dispatch ? arrayValue[i].mobile_dispatch : ''
                };
                if (fieldName) //Set any hstore value along with the existing obj
                    obj[fieldName] = commonjs.hstoreParse(arrayValue[i].facility_info)[fieldName];
                settingsArray.push(obj);
            }
            return settingsArray;
        }
    },

    validateFutureDate: function (txtBoxValue, msg) {
        var dateValue = moment(txtBoxValue, "MM/DD/YYYY");
        if (moment(commonjs.getCurrentDate()).diff(dateValue) < 0) {
            return false;
        }
        return true;
    },

    dateRangesOverlap: function (startTime1, endTime1, startTime2, endTime2) {
        if (isNaN(startTime1) || isNaN(endTime1) || isNaN(startTime2) || isNaN(endTime2))
            return false;

        // Javascript Date Compare
        if (moment.isDate(startTime1) && moment.isDate(endTime1) && moment.isDate(endTime1) && moment.isDate(endTime2)) {
            if (startTime1.getTime() < endTime2.getTime() && endTime1.getTime() > startTime2.getTime())
                return true;
        }
        else {
            // Moment Date Compare
            if (moment.isMoment(startTime1) && moment.isMoment(endTime1) && moment.isMoment(endTime1) && moment.isMoment(endTime2)) {
                if (startTime1.isBefore(endTime2) && endTime1.isAfter(startTime2))
                    return true;
            }
        }
        return false;
    },

    getFullName: function (args) {
        var option = $.extend({ lastName: '', firstName: '', mi: '', suffix: '' }, args);
        if (option.mi && option.suffix) {
            return option.lastName + ', ' + option.firstName + ' ' + option.mi + ' ' + option.suffix;
        }
        else if (option.mi) {
            return option.lastName + ', ' + option.firstName + ' ' + option.mi;
        }
        else if (option.suffix) {
            return option.lastName + ', ' + option.firstName + ' ' + option.suffix;
        }
        else {
            if (option.lastName || option.firstName)
                return option.lastName + ', ' + option.firstName;
            else
                return "";
        }
    },

    getNameDicomFormat: function (args) {
        var option = $.extend({ lastName: '', firstName: '', mi: '', suffix: '', prefix: '' }, args);
        return (option.lastName ? option.lastName : "") + '^' + (option.firstName ? option.firstName : "") + '^' + (option.mi ? option.mi : "") + '^' + (option.prefix ? option.prefix : "") + '^' + (option.suffix ? option.suffix : "");
    },

    getDicomDateFormat: function (val) {
        var dateStr = "";
        if (val) {
            if (typeof val === 'string') {
                dateStr = moment(val).format('YYYYMMDD');
            }
            else if (moment.isDate(val)) {
                console.warn('Fix this! Pass in a valid ISO string or moment object, not a JS Date...');
                dateStr = moment(val).format();
            }
            else if (moment.isMoment(val)) {
                dateStr = val.format('YYYYMMDD');
            }
        }
        return dateStr;
    },

    getDicomTimeFormat: function (val) {
        var timeStr = "";
        if (val) {
            timeStr = moment(val).format('HHmmss');
            timeStr = timeStr + ".0000000"
        }
        return timeStr;
    },

    getFormattedDateTimeSeconds: function (val) {
        return val ? this.convertToCompanyTimeZone(val).format('L LTS z') : '';
    },
    getFormattedDateTimeSecondsWithAmPm: function (val) {
        return val ? this.getFormattedDateTimeSeconds(val) : '';
    },
    getQCFormattedDateTime: function (val) {
        return val ? this.convertToCompanyTimeZone(val).format('L LT z') : '';
    },
    getFormattedDateTime: function (val, isStudy, isSchedule, showDay) {

        return val ? this.convertToCompanyTimeZone(val).format('L LT z') : '';

        var result = "";
        if (commonjs.checkNotEmpty(val) && val != null) {
            if (showDay)
                return moment(val).format('dddd L LT');
            return moment(val).format('L LT');

            if (isStudy) {
                if (showDay)
                    result = moment(val).format('dddd L LT');
                else
                    result = moment(val).format('L LT');
            } else {
                var code = app.getFacilitywithTimeZone(app.default_facility_id);
                var zone = 0;
                if (commonjs.checkNotEmpty(code)) {
                    zone = app.getZoneValue(code);
                }
                if (isSchedule)
                    result = moment(val).zone(-zone).format('L LT');
                else {
                    if (showDay)
                        result = moment(val).zone(-zone).format('dddd L LT');
                    else
                        result = moment(val).zone(-zone).format('L LT');
                }
            }
        }
        return result;
    },

    getFormattedDate: function (val) {
        // Removed call to convertToCompanyTimezone because timezone is irrelevant for dates.
        // This was causing dates to display incorrectly.
        // TODO this doesn't actually resolve EXA-1854
        return val ? moment(val).format('L') : '';
    },

    getDateFormat: function (val) {
        var result = "";
        if (val && val.trim() != '') {
            return val;
        }
        return result;
    },

    getMoment: function (val) {
        var result = "";
        if (commonjs.checkNotEmpty(val) && val != null) {
            var m = moment(val);
            if (!m.isValid())
                console.log('Bad Date Passed to getMoment ' + val);
            return m;
        }
        return moment('1800-01-01T12:00:00');
    },

    getFormattedAmountToTwoDecPlaces: function (amount) {
        return amount && $.isNumeric(amount) ? parseFloat(amount).toFixed(2) : '0.00';
    },

    getCurrentDateTime: function (val) {
        if (!val)
            return this.getFacilityCurrentDateTime(app.default_facility_id)
        return this.convertToFacilityTimeZone(app.default_facility_id, val);
    },
    getCurrentDate: function (val) {
        return this.getCurrentDateTime(val).format('L');
    },

    getCurrentTime: function (val) {
        return this.getCurrentDateTime(val).format('LT');
    },

    //
    // start: moment-timezone functions
    //


    // if timeZone is specified, it will *force* the value to that TZ
    // TODO: handle passing strings with offset when TZ must be forced (moment has no ability to strip it)
    toMoment: function (val, timeZone, parseFormats) {
        var momentVal = null;
        if (!val) {
            throw new Error("Please specify value as string (or moment object)!");
            return null;
        }

        var useTimeZone = (timeZone && timeZone !== "");
        var useParseFormats = (parseFormats && parseFormats.length > 0);

        if (typeof val === 'string') {
            if (useTimeZone) {
                momentVal = useParseFormats ? moment.tz(val, parseFormats, timeZone) : moment.tz(val, timeZone);
            } else {
                momentVal = useParseFormats ? moment(val, parseFormats) : moment(val);
            }
        } else if (moment.isDate(val)) {
            console.warn('Fix this! Pass in a valid ISO string or moment object, not a JS Date...');
            console.trace();
            dtIso = val.ToISOString();
            if (useTimeZone) {
                momentVal = useParseFormats ? moment.tz(dtIso, parseFormats, timeZone) : moment.tz(dtIso, timeZone);
            } else {
                momentVal = useParseFormats ? moment(dtIso, parseFormats) : moment(dtIso);
            }
            //momentVal = (parseFormats && parseFormats.length > 0) ? moment(val, parseFormats) : moment(val);
        } else if (moment.isMoment(val)) {
            if (useTimeZone) {
                //first strip the TZ if it exists
                var stripTz = momentVal.format('YYYY-MM-DDTHH:mm:ss');
                momentVal = moment.tz(stripTz, timeZone);
            } else {
                momentVal = moment(val); //clone
            }
        } else {
            throw new Error("Please pass in string or moment object!");
            return null;
        }
        // // if TZ is specified, force the moment object to use it ***but do not convert it to that TZ*** !!!
        // if (timeZone && timeZone !== "") {
        // 	//first strip the TZ if it exists
        // 	var stripTz = momentVal.format('YYYY-MM-DDTHH:mm:ss');
        // 	momentVal = moment.tz(stripTz, timeZone);
        // }
        if (!momentVal.isValid()) {
            console.warn("Resulting moment object is invalid! Value: %s ", momentVal.format());
        }
        return momentVal;
    },

    // isValidTimeUnit: function(val) {
    //     var validTimeUnits = [ "year", "month", "week", "day", "hour", "minute", "second" ];
    //     return val ? validTimeUnits.indexOf(val) > -1 : false;
    // },
    //
    // isFutureDateTime: function(val, facilityId, timeUnit) {
    // 	if (timeUnit && !this.isValidTimeUnit(timeUnit)) {
    // 		console.warn("Invalid time unit specified! Defaulting to 'day'...");
    // 		timeUnit = "day";
    // 	}
    // 	var currentDateTime = (facilityId && facilityId > 0) ? this.getFacilityCurrentDateTime(facilityId) : this.getCompanyCurrentDateTime();
    // 	var timeUnit = timeUnit || "day";
    // 	var targetDateTime = this.toMoment(val);
    //     console.log("Testing if: %s is after: %s with time unit of: '%s'", targetDateTime.format(), currentDateTime.format(), timeUnit);
    // 	return (targetDateTime.isAfter(currentDateTime, timeUnit)) ? true : false;
    // },

    getFormattedUtcDate: function (utcDateString) {
        var result = "";
        if (commonjs.checkNotEmpty(utcDateString) && utcDateString != null) {
            result = moment.utc(utcDateString).format('L');
        }
        return result;
    },

    // @return {Array} string array of TZ names
    getTimeZoneNames: function (filter) {
        var tzNames = moment.tz.names();
        if (filter != null && typeof (filter) === 'string') {
            return tzNames.filter(function (value) {
                return value.indexOf(filter) > -1;
            });
        }
        return tzNames;
    },

    // @return {Object} current copmany from app settings
    getCompanyFromAppSettings: function () {
        if (app.company && app.company.id > 0) {
            return app.company;
        } else {
            throw new Error('Company id must be greater than 0!');
        }
    },

    // @return {Object} facility from app settings
    getFacilityFromAppSettings: function (facilityId) {
        if (!facilityId) {
            throw new Error('Undefined facilityId');
        }
        if (typeof facilityId === 'string') {
            facilityId = parseInt(facilityId);
        }
        if (facilityId < 0) {
            throw new Error('FacilityId must be greater than 0!');
        }
        var matched = app.facilities.filter(function (facility) {
            return facility.id === facilityId;
        });
        if (!matched || matched.length !== 1) {
            throw new Error('Unable to find facility with id: ' + facilityId + ' in app settings!');
        }
        return matched[0];
    },

    // @return {Array.<Object>} current user's facilities' from app settings. in case of superuser all facilities are returned
    getCurrentUsersFacilitiesFromAppSettings: function () {
        if (!app.userInfo) {
            throw new Error('App settings is missing userInfo!');
        }
        return app.userInfo.user_type === 'SU' ? app.facilities : app.userFacilities
    },

    getModalityRoomFromAppSettings: function (modalityRoomId) {
        if (!modalityRoomId) {
            throw new Error('Undefined modalityRoomId');
        }
        if (typeof modalityRoomId === 'string') {
            modalityRoomId = parseInt(modalityRoomId);
        }
        if (modalityRoomId < 0) {
            throw new Error('ModalityRoomId must be greater than 0!');
        }
        var matched = app.modalityRooms.filter(function (modalityRoom) {
            return modalityRoom.id === modalityRoomId;
        });
        if (!matched || matched.length !== 1) {
            throw new Error('Unable to find modality room with id: ' + modalityRoomId + ' in app settings!');
        }
        return matched[0];
    },

    getModalityFromAppSettings: function (modalityId) {
        if (!modalityId) {
            throw new Error('Undefined modalityId');
        }
        if (typeof modalityId === 'string') {
            modalityId = parseInt(modalityId);
        }
        if (modalityId < 0) {
            throw new Error('ModalityId must be greater than 0!');
        }
        var matched = app.modalities.filter(function (modality) {
            return modality.id === modalityId;
        });
        if (!matched || matched.length !== 1) {
            throw new Error('Unable to find modality with id: ' + modalityId + ' in app settings!');
        }
        return matched[0];
    },

    // @return {String} company's time zone name
    getCompanyTimeZone: function () {
        var currentCompany = this.getCompanyFromAppSettings();
        if (!currentCompany.time_zone) {
            throw new Error('Company with id: ' + currentCompany.id + ' is missing time_zone!');
        }
        return currentCompany.time_zone;
    },

    // @return {String} facility's time zone name
    getFacilityTimeZone: function (facilityId) {
        var facility = this.getFacilityFromAppSettings(facilityId);
        if (!facility.time_zone) {
            throw new Error('Facility with id: ' + facilityId + ' is missing time_zone!');
        }
        return facility.time_zone;
    },

    // @return {Object} current company's current date time as moment object
    getCompanyCurrentDateTime: function () {
        var companyTimeZone = this.getCompanyTimeZone();
        return moment().tz(companyTimeZone);
    },

    // @return {Object} facility's current date time as moment object
    getFacilityCurrentDateTime: function (facilityId) {
        var facilityTimeZone = this.getFacilityTimeZone(facilityId);
        return moment().tz(facilityTimeZone);
    },

    // Converts date time in any other timezone to that of current company's timezone
    // @return {Object} any other date time converted to current company's timezone as moment object
    convertToCompanyTimeZone: function (otherDateTimeWithTimeZone) {
        //console.log('convertToCompanyTimeZone => value:' + otherDateTimeWithTimeZone);
        if (!otherDateTimeWithTimeZone) {
            throw new Error('Invalid otherDateTimeWithTimeZone');
        }
        var companyTimeZone = this.getCompanyTimeZone();
        var converted = moment(otherDateTimeWithTimeZone).tz(companyTimeZone);
        if (!converted.isValid()) {
            throw new Error('otherDateTimeWithTimeZone does not seem to be valid date time!');
        }
        return converted;
    },

    // Converts date time in any other timezone to that of facility's timezone
    // @return {Object} any other date time converted to facility's timezone as moment object
    convertToFacilityTimeZone: function (facilityId, otherDateTimeWithTimeZone) {
        //console.log('convertToFacilityTimeZone => facilityId:' + facilityId + ', value:' + otherDateTimeWithTimeZone);
        if (!otherDateTimeWithTimeZone) {
            throw new Error('Invalid otherDateTimeWithTimeZone');
        }
        if (!facilityId) {
            console.warn("Missing facility id! Falling back to company time zone...");
            return this.convertToCompanyTimeZone(otherDateTimeWithTimeZone);
        }
        var facilityTimeZone = this.getFacilityTimeZone(facilityId);
        var converted = moment(otherDateTimeWithTimeZone).tz(facilityTimeZone);
        if (!converted.isValid()) {
            throw new Error('otherDateTimeWithTimeZone does not seem to be valid date time!');
        }
        return converted;
    },

    // Unlike the convertToFacilityTimeZone, this function *just* changes TZ to that of facility
    // while date & time stays the same. This is usefull when forms needs to send data to server
    // @return {Object} any other date time converted to facility's timezone as moment object
    shiftToFacilityTimeZone: function (facilityId, otherDateTimeWithTimeZone) {
        if (!otherDateTimeWithTimeZone) {
            throw new Error('Invalid otherDateTimeWithTimeZone');
        }
        var facilityTimeZone = this.getFacilityTimeZone(facilityId);
        var dateTimeOnly = moment(otherDateTimeWithTimeZone).format('YYYY-MM-DDTHH:mm'); // strip the TZ, and get ISO string
        var converted = moment.tz(dateTimeOnly, facilityTimeZone); // add in facility TZ
        if (!converted.isValid()) {
            throw new Error('otherDateTimeWithTimeZone does not seem to be valid date time!');
        }
        return converted;
    },

    //
    // end: moment-timezone functions
    //

    /**
     * Round a given date to the nearest duration, using the given Math method (ceil | floor)
     * @param date
     * @param duration (milliseconds)
     * @param method (ceil | floor)
     * @returns {*}
     */
    roundMinutes: function (date, duration, method) {
        return moment(Math[method]((+date) / (+duration)) * (+duration));
    },

    showStatus: function (msg) {
        commonjs.notify(msg, 'success');
    },

    showWarning: function (msg, classname, isCustomWarning, time_out) {
        return commonjs.notify(msg, 'warning');
    },

    showError: function (msg, isFromService) {
        return commonjs.notify(msg, 'danger');
    },

    notify: function (msg, type) {
        if (!msg) return;

        var displayMsg = '';
        var i18nMsg = i18n.get(msg);

        if (i18nMsg == '' || i18nMsg == app.currentCulture + '.' + msg) {
            displayMsg = msg;
        } else {
            displayMsg = i18n.get(msg);
        }

        $.notify({
            message: displayMsg
        }, {
                type: type,
                z_index: 1061,
                offset: 5,
                delay: 1000,
                placement: {
                    align: 'center',
                }
            });
    },

    geti18NString: function (localizationString) {
        var i18nString = i18n.get(localizationString);
        if (i18nString == app.currentCulture + '.' + localizationString) {
            return localizationString;
        }
        return i18nString;
    },

    isMaskValidate: function () {
        $(".maskPhone").inputmask({ mask: "[(999)999-9999", skipOptionalPartCharacter: ["(", ")"] });
        $(".postal-code-mask").inputmask({ mask: "99999[-9999]" });
        $(".maskSSN").inputmask("999-99-9999");
        $(".maskDate").inputmask();
        var dateTemplate = moment(new Date('December 31, 2017'))
            .format('L')
            .replace(/12/, 'MM')
            .replace(/31/, 'DD')
            .replace(/2017/, 'YYYY');
        $(".maskDateLocale").inputmask(dateTemplate.toLowerCase(), { "placeholder": dateTemplate });
        $(".maskDateMonth").inputmask("mm/dd/yyyy", { "placeholder": "MM/DD/YYYY" });
        $(".maskMonthYear").inputmask("mm/yyyy", { "placeholder": "MM/YYYY" });
        //$(".maskMonthYear").inputmask("dd/MM/yyyy hh:mm:ss",{ "placeholder": "dd/MM/yyyy hh:mm:ss" });
        $(".maskHourmin").inputmask("h:s", { "placeholder": "HH/MM" });
        $(".maskYear").inputmask("9999", { "placeholder": "YYYY" });
        $('.maskUnits').inputmask("numeric", {
            radixPoint: ".",
            groupSeparator: "",
            digits: 3,
            autoGroup: true,
            prefix: '',
            rightAlign: true,
            allowMinus: false
        });
        $('.maskUnits').attr('placeholder', '0.000');

        $(".maskUnits").on("keypress", function (e) {     // function for allow 3 digits before decimal point in amount
            value1 = $(this).val();
            value = value1;
            if (value1 > 999.999)
                this.value = this.oldvalue;
            else
                this.oldvalue = this.value;
        });

        $('.maskFee').inputmask("numeric", {
            radixPoint: ".",
            groupSeparator: "",
            digits: 2,
            autoGroup: true,
            prefix: '',
            rightAlign: true,
            allowMinus: false,
            oncomplete: function () { return false; }
        });

        $('.maskFee, .maskUnits').focus(function (e) {
            if (parseFloat($(this).val()) == 0) {
                $(this).val('');
            }
        });

        $(".maskFee").on("keypress", function (e) {     // function for allow 8 digits before decimal point in amount
            value1 = $(this).val();
            value = value1;
            if (value1 > 99999999.99)
                this.value = this.oldvalue;
            else
                this.oldvalue = this.value;
        });
        $('.maskFee').attr('placeHolder', '0.00');

        $(".maskFee, .maskUnits").on("keydown", function (e) {
            if (e.ctrlKey) return false;
        });

    },
    parseDicomDate: function (str) {
        if (!/^(\d){8}$/.test(str)) return "invalid date";
        var y = str.substr(0, 4),
            m = str.substr(4, 2),
            d = str.substr(6, 2);
        var D = new Date(y, m - 1, d);
        return (D.getFullYear() == y && D.getMonth() == parseInt(m) - 1 && D.getDate() == d) ? D : 'invalid date';
    },
    parseDicomTime: function (str) {
        var h = str.substr(0, 2),
            m = str.substr(2, 2),
            s = str.substr(4, 2);
        //  var D = new Date(h,m,s);
        return h + ':' + m + ':' + s;
    },

    showModalBg: function () {
        var hideDiv = document.getElementById('divModalBgFrame');
        if (hideDiv) {
            hideDiv.style.display = '';
            hideDiv.style.width = $window.width() + 'px';
            hideDiv.style.height = $window.height() + 'px';
            hideDiv.style.zIndex = '10000';
        }
        else {
            var $div = $('<div/>').attr({ 'id': 'divModalBgFrame', 'class': 'ModalBgFrame' });
            $body.append($div);
            commonjs.showModalBg();
        }
    },

    hideModalBg: function () {
        var hideDiv = document.getElementById('divModalBgFrame');
        if (hideDiv) {
            hideDiv.style.display = 'none';
        }
    },

    showLoading: function (msg) {
        return commonjs.showLoading_v1(msg);
        if (!msg) {
            msg = 'messages.loadingMsg.default';
            if (i18n.get(msg) != app.currentCulture + '.' + msg) {
                msg = i18n.get('messages.loadingMsg.default');
            }
            else {
                msg = 'Loading...';
            }
        }

        commonjs.hideLoading();
        if (tickTimer) {
            clearTimeout(tickTimer);
        }
        commonjs.loadingTime = 2;
        commonjs.hasLoaded = false;
        commonjs.tickLoading(msg, true);
    },

    showLoading_v1: function (msg) {
        if (!msg) {
            msg = 'messages.loadingMsg.default';
            if (i18n.get(msg) != app.currentCulture + '.' + msg) {
                msg = i18n.get('messages.loadingMsg.default');
            }
            else {
                msg = 'Loading...';
            }
        }
        commonjs.hideLoading();
        if (tickTimer) {
            clearTimeout(tickTimer);
        }
        commonjs.loadingTime = 2;
        commonjs.hasLoaded = false;
        commonjs.tickLoading_v1(msg, true);
    },

    tickLoading_v1: function (msg, delayLoad) {
        var self = this;
        if (delayLoad) {
            tickTimer = setTimeout(function () {
                clearTimeout(tickTimer);
                self.showLoadingMessage(msg);
                if (!commonjs.hasLoaded) {
                    self.tickLoading_v1(msg, false);
                } else {
                    $('#divLoading').hide();
                    $('#divLoadingMsg').hide();
                }
            }, 300);
        } else {
            tickTimer = setTimeout(function () {
                clearTimeout(tickTimer);
                self.showLoadingMessage(msg + '(' + self.loadingTime + ')');
                self.loadingTime++;
                if (!commonjs.hasLoaded) {
                    self.tickLoading_v1(msg, false);
                } else {
                    $('#divLoading').hide();
                    $('#divLoadingMsg').hide();
                }
            }, 1000);
        }
    },

    showSaving: function (msg) {
        commonjs.showLoading("Saving.....")
    },

    hideLoadingOnMenu: function (menuId) {
        $(typeof menuId === 'string' ? ('#' + menuId) : menuId).empty();
    },

    tickLoading: function (msg, delayLoad) {
        var self = this;
        if (delayLoad) {
            commonjs.showModalBg();
            tickTimer = setTimeout(function () {
                clearTimeout(tickTimer);
                self.showLoadingMessage(msg);
                if (!commonjs.hasLoaded) {
                    self.tickLoading(msg, false);
                } else {
                    $('#divLoading').hide();
                    $('#divLoadingMsg').hide();
                }
            }, 300);
        } else {
            return self.showLoadingMessage(msg);

            tickTimer = setTimeout(function () {
                clearTimeout(tickTimer);
                self.showLoadingMessage(msg + '(' + self.loadingTime + ')');
                self.loadingTime++;
                if (!commonjs.hasLoaded) {
                    self.tickLoading(msg, false);
                } else {
                    $('#divLoading').hide();
                    $('#divLoadingMsg').hide();
                }
            }, 1000);
        }
    },

    hideLoading: function () {
        commonjs.hideModalBg();
        commonjs.hasLoaded = true;
        $('#divLoading').css('display', 'none');
        $('#divLoadingMsg').css('display', 'none');
        $('#divPageLoading').css('display', 'none');
        $('.navbar').show();
    },

    showLoadingMessage: function (msg) {
        $('#divLoading').css('display', 'block');
        $('#divLoadingMsg').css('display', 'block');
        $('#divLoadingMsg').html(msg);
    },

    docClick: function (e) {
        // SMH - Bug #2613 - Cleaned up as much as was reasonable

        // Quick reference to the target element
        var _target = (e.target || e.srcElement);
        var currentTarget = e.currentTarget;
        var $target = $(_target);

        // This stuff isn't always useful, so let's give a quick way out.
        if (currentTarget && $target.parents('.ignoreCommonClick').length > 0) {
            return;
        }

        var $mergePending = $('.merge-pending');
        var $queuedForMerge = $('.queued-for-merge');

        if ($mergePending.length) {
            fastdom.mutate(function () {
                this.removeClass('merge-pending');
            }.bind($mergePending));
        }

        if ($queuedForMerge.length) {
            fastdom.mutate(function () {
                this.removeClass('queued-for-merge');
            }.bind($queuedForMerge));
        }

        $('#showColor:visible').not(_target).hide();
        $('ul.typeahead:visible').not(_target).hide();
        $('#dispatchRightMenu:visible').hide();
        $('#ordersMenu:visible').hide();
        $('#qrRightMenu:visible').hide();

        $('.patientcustomRowSelect').removeClass('patientcustomRowSelect');

        $('#div_AccountHistory:visible, ' +
            '#div_smokeHistory:visible, ' +
            '.ace_editor.ace_autocomplete:visible, ' +
            '#pendingRightMenu:visible, ' +
            '#missingRightMenu:visible, ' +
            '#patientRightMenu:visible, ' +
            '#filmtrackingrightmenu:visible').hide();

        // Simple class comparisons
        if (_target.className !== 'ivLayout') {
            $('#divSeriesOption:visible, #divSeriesLayout:visible, #divImageReorder:visible, #divSlabTools:visible').hide();
        }
        if (_target.className !== 'priorDetail') {
            $('#divPriorDetail:visible').hide();
        }
        if (!$target.hasClass('imgdicomPreview')) {
            $('#div_custom_SeriesImage:visible').not(_target).hide();
        }
        if (!$target.hasClass('order_custom')) {
            $('#orderRightMenu:visible').hide();
        }
        if (!$target.hasClass('study_custom')) {
            $('#studyRightMenu:visible').hide();
        }

        // Simple ID comparisons
        if (_target.id !== 'div_custom') {
            $('.divInstanceDicoms:visible').hide();
        }
        if (_target.id !== 'div_customPendingInstance') {
            $('.divInstanceDicoms:visible').hide();
        }
        if (_target.id !== 'gs_study_status') {
            commonjs.disposeStatusFilter('divStatusSearch', _target);
            commonjs.disposeStatusFilter('divEncStatusSearch', _target);
        }
        if (_target.id !== 'gs_order_status') {
            commonjs.disposeStatusFilter('divOrderStatusSearch', _target);
            commonjs.disposeStatusFilter('divOrderStatusSearchFacility', _target);
        }
        if (_target.id !== 'gs_dicom_status') {
            commonjs.disposeStatusFilter('divTempStatusSearch', _target);
        }

        if (!$('.popover').has(_target).length) {
            $('[data-toggle="popover"]').not(_target).each(function () {
                if (!$(this).has(_target).length) {
                    $(this).popover('hide');
                }
            });
        }

        if ($('.popupMenu').attr('clickFlag')) {
            $('.popupMenu').removeAttr('clickFlag');
        } else if ($('.popupMenu').is(':visible')) {
            $('.popupMenu').remove();
        }

        // Optimized as best I could without knowing the reason for this code
        if ($('#divActions:visible').length && _target.id !== 'btnSaveActions' && $(".popover:visible").length && !$target.is("._jsPlumb_overlay") && !$target.parents().is('.popover.in')) {
            $(".popover:visible, #divActions:visible").hide();
            $('.popover #btnCancelActions').click();
        }

        // Come back to this rat's nest later
        if (typeof $target.data('original-title') == 'undefined' && !$target.parents().is('.popover.in') && $('.masonry-wrap').is(":visible") && !$target.parents().is('#divSmokeStatusHistory')
            && !$target.parents().is('#divNewProblem')) {
            var labResult = $target.hasClass('viewResultEnable'), probPlus = $target.hasClass('viewAddProblems'), editProblem = $target.hasClass('editProblem')
            if (!labResult && !probPlus && !editProblem) {
                if ($('[data-original-title]').length > 0) $('[data-original-title]').popover('hide');
            }
        }
    },

    docResize: function (e) {
        var currentModule = commonjs.currentModule;
        switch (currentModule) {
            case 'report':
                var navHeight = $(window).height() - ($('body>nav').outerHeight() + 50);
                if ($('.exa-left-nav')) {
                    $('.exa-left-nav').height(navHeight);
                }
                break;

            case 'Home':
            case 'Claims':
                commonjs.resizeHomeScreen();
                break;
        }

        commonjs.resizeIconMenu();

        $('div.ui-jqgrid > div.ui-jqgrid-view > div.ui-jqgrid-bdiv > div > table.ui-jqgrid-btable').each(function (index) {
            if (!$(this).parents('table.ui-jqgrid-btable').length) {
                var obj = commonjs.getGridMeasures(jq_isWidthResize, jq_isHeightResize, jq_userWidth, jq_userHeight, jq_offsetWidth, jq_offsetheight);

                //$(this).jqGrid('setGridWidth', obj.width);
                if (($(this).attr('id') && $(this).attr('id').indexOf('tblGridOD') == 0) || ($(this).attr('id') && $(this).attr('id').indexOf('tblGridPS') == 0)) // for home page pre-orders and qc grids having buttons under grid
                    $(this).jqGrid('setGridHeight', obj.height - 20);
                else
                    $(this).jqGrid('setGridHeight', obj.height);

                if ($('.exa-left-nav')) {
                    $('.exa-left-nav').height(obj.navHeight);
                }
            }
        });

        if (grid = $('.ui-jqgrid-btable:visible')) {
            grid.each(function (index) {
                gridId = $(this).attr('id');
                gridParentWidth = $('#gbox_' + gridId).parent().width();
                $('#' + gridId).setGridWidth(gridParentWidth);
            });
        }
        //fix div.ui-jqgrid-bdiv width to proper size
        //fix width for iconNav menu
        if ($('#viztekIconNav').is(':visible')) {
            if (!$('nav.viztek-nav').hasClass('open')) {
                $('nav.viztek-nav').addClass('open');
            }
            //$('#body_content').width($(window).width() - $('#viztekIconNav').outerWidth());
            //$('#body_content').css('width', 'calc(100% - 50px)');
        }
        /*else{
         $('#body_content').removeAttr('Style');
         }*/

    },

    resizeIconMenu: function () {
        var icon_panel = $('#viztekIconNav');
        var _d_height = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight || 0;
        icon_panel.css('height', _d_height);
        //$('#viztekIconNav').css('height','100%');
    },

    resizeHomeScreen: function (retryCount) {
        var tabWidth = 100;
        var $tabs = $('#claimsTabs li').length ? $('#claimsTabs') : $('#studyTabs');
        var $tabsLi = $('#claimsTabs li').length ? $('#claimsTabs li') : $('#studyTabs li');

        $tabsLi.each(function (index) {
            tabWidth += $(this).width();
        });
        var divWidth = $('#divTabActions').width();
        tabWidth = ($(window).width() - divWidth - 60) < tabWidth ? tabWidth : $(window).width() - divWidth - 60;
        var ul_width = 0;
        $.each($tabsLi, function () {
            ul_width += $(this).outerWidth();
        });
        if ($('#divTabsContainer').width() > ul_width) $tabs.css({ width: '100%' });
        else $tabs.css({ width: (ul_width + 50) + 'px' });

        var $divTabsContainer = $('#divTabsContainer');
        var $subMenu = $divTabsContainer.closest('nav.top-nav');
        // SMH - Fixed the size of the tab menu to fill more of the available space, and also to scroll properly.
        var divUseableSpace = $subMenu.width() - 140;  // 140 pixels space between controls
        var headerIconsWidth = $subMenu.find('ul.tn-menu-right').width();
        var retries = ~~retryCount;
        if (divUseableSpace === headerIconsWidth) {
            retries++;
            if (retries < 3) {
                setTimeout(function () { commonjs.resizeHomeScreen(retries) }, 500);
            }
        }

        var divTabsContainerWidth = divUseableSpace - headerIconsWidth;
        $divTabsContainer.css({ width: divTabsContainerWidth });
    },

    getGridMeasures: function (isWidthResize, isHeightResize, userWidth, userHeight, offsetWidth, offsetHeight) {
        var width, height;

        if (isHeightResize && (typeof userHeight !== 'number' || userHeight > 0)) {
            if (typeof userHeight == 'number') {
                height = userHeight;
            } else if (userHeight.indexOf('%') > 0) {
                var whei = commonjs.getWindowHeight();
                height = parseInt(userHeight.replace('%', ''));
                height = (whei / 100) * height;
            } else {
                height = parseInt(userHeight.replace('%', '').replace('px', ''));
            }
        } else {
            //EXA-7310 - For schedule book-> new order screen header was hided , when replace launch login url -> worklist page showing header element.
            if (!$('header.header').is(':visible'))
                $('header.header').show();

            var topnavHieght = $('.header').outerHeight() + $('.top-nav').outerHeight();

            switch (commonjs.currentModule) {
                case 'Home':
                case 'Claims':
                case 'app':
                default:
                    height = commonjs.getWindowHeight() - (topnavHieght + 145);
                    break;

                case 'Payments':
                    height = commonjs.getWindowHeight() - ($('#divPaymentFilter').height() + 155);
                    break;

                case 'Setup':
                    height = commonjs.getWindowHeight() - ($('body>nav').outerHeight() + $('#divPageHeaderButtons').outerHeight() + 100 + ($('#auditFilterdiv').outerHeight() ? $('#auditFilterdiv').outerHeight() : 0));
                    break;

                case 'EOB':
                    height = commonjs.getWindowHeight() - 225;
                    break;
            }
        }

        //width = width - (offsetWidth ? parseInt(offsetWidth) : 0);
        height = height - (offsetHeight ? parseInt(offsetHeight) : 0);
        var navHeight = commonjs.getWindowHeight() - ($('body>nav').outerHeight() + 50);

        //return {width: width, height: height};
        return { height: height, navHeight: navHeight };
    },

    getWindowHeight: function () {
        //return $(window).innerHeight() - 15;
        return window.innerHeight - 15;
    },

    setpatientFrameheight: function (isResize) {
        if ($('.formParent').length > 0) {
            $('#divPatientSearchResults').height($('.formParent').height() - ($('.page-details-panel').height() + $('header.header').height() + $('#provideInfo').height() + $('#searchForm').height() + 25));
            //$('#divPatientSearchResults').width($('.formParent').width() - 30);
        }
    },

    clickPatientEmptyButton: function () {
        $('#btnEmpty_Patient').click();
    },

    editExistpatient: function (id) {
        $('#btnRenewData').attr('data-container', id);
        $('#btnRenewData').click();
    },

    clickMergeComplete: function () {
        $('#btnMergeComplete').click();
    },

    clickDocumentReload: function (status) {
        commonjs.showStatus(status);
        $('#anc_Reload').click();
    },

    getCompanyRoute: function () {
        var route = "";
        if (app.currentCompanyID == 0) {
            route = '#config/company/new';
        }
        return route;
    },

    setCookie: function (name, value, days) {
        if (days) {
            var date = new Date();
            date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
            var expires = "; expires=" + date.toGMTString();
        }
        else var expires = "";
        document.cookie = name + "=" + value + expires + "; path=/";
    },

    setCookieOptions: function (index, val) {
        var current_value = commonjs.getCookieOptions(index);
        var current_value_array = commonjs.getCookie('user_options').split('~');
        if (current_value_array.length == 1) {
            if (index == 0) {
                current_value_array[index] = val;
            }
            else {
                current_value_array = [];
                for (var i = 0; i <= index; i++) {
                    if (i == index) {
                        current_value_array.push(val);
                    }
                    else {
                        current_value_array.push('');
                    }
                }
            }
        }
        else {
            var k;
            if (current_value_array.length < index) {
                for (var i = 0; i <= index; i++) {
                    if (i == index) {
                        current_value_array.push(index);
                    }
                    else {
                        k = (current_value_array[i]) ? current_value_array[i] : '';
                        if (!current_value_array[i]) {
                            current_value_array.push(k);
                        }
                    }
                }
            }
            else {
                current_value_array[index] = val;
            }
        }
        current_value_array = current_value_array.join('~');
        commonjs.setCookie('user_options', current_value_array);
    },

    getCookie: function (c_name) {
        if (document.cookie.length > 0) {
            c_start = document.cookie.indexOf(c_name + "=");
            if (c_start != -1) {
                c_start = c_start + c_name.length + 1;
                c_end = document.cookie.indexOf(";", c_start);
                if (c_end == -1) {
                    c_end = document.cookie.length;
                }
                return unescape(document.cookie.substring(c_start, c_end));
            }
        }
        return "";
    },

    getCookieOptions: function (index) {
        var c_name = 'user_options';
        if (document.cookie.length > 0) {
            c_start = document.cookie.indexOf(c_name + "=");
            if (c_start != -1) {
                c_start = c_start + c_name.length + 1;
                c_end = document.cookie.indexOf(";", c_start);
                if (c_end == -1) {
                    c_end = document.cookie.length;
                }
                return document.cookie.substring(c_start, c_end).split('~')[index];
            }
        }
        return "";
    },

    deleteCookie: function (name) {
        this.setCookie(name, '', -1);
    },

    getCurrentStatus: function (code) {
        var st = commonjs.getStatus(code);
        return st.status + '~' + st.colorCode;
    },

    getTimeFromMinutes: function (minutes) {
        //console.war("TODO: replace getTimeFromMinutes() with moment.add(amount,'minutes')...");
        var hour = Math.floor(minutes / 60);
        var minutes = minutes % 60;
        var ampm = (hour >= 12 && hour < 24) ? 'pm' : 'am';
        if (hour > 12) {
            hour = hour - 12;
        }
        else if (hour == 0) {
            hour = 12;
        }
        if (hour < 10) {
            hour = "0" + hour;
        }

        if (minutes < 10) {
            minutes = "0" + minutes;
        }
        return (hour + ':' + minutes + ' ' + ampm);
    },

    getStatus: function (code) {
        var current_status = '', color = '';
        switch (code) {
            case 'CO':
                current_status = 'Completed';
                color = '#2B930D';  //green
                break;
            case 'QU' || 'null':
                current_status = 'Queued';
                color = ''; // blue
                break;
            case 'FA':
                current_status = 'Failed';
                color = '#FF0000'; // red
                break;
            case 'ER':
                current_status = 'Error';
                color = '#E99415'; //orange
                break;
            case 'FQ':
                current_status = 'Forcing to move';
                color = '#E99415'; //orange
                break;
            case 'IP':
                current_status = 'In-Progress';
                color = '#FFFF1F'; //yellow
                break;
            case 'ME':
                current_status = 'Manual Edit';
                color = '#646464';  //grey
                break;
        }
        return { status: current_status, colorCode: color };
    },

    changeCss: function () {
        if (document.getElementById("lnkCurrentTheme")) {
            var theme = app.currentTheme || 'default';
            // REMOVE THE EXTRA RANDOM STRING AT END AFTER SOME ODD TIME
            document.getElementById("lnkCurrentTheme").href = '/stylesheets/skins/' + theme + '/main.css?v=' + String(Math.floor(Math.random() * 100));
        }
        if (app.navPinned && $('header.header:visible .viztek-nav').length) {
            $('#profile_panel').hide('fade');
            $('#viztekIconNav').show();
            $('#body_content').addClass('col-xs-12 col-md-12 col-lg-12');
            $('#body_content').addClass('iconMenuOpen_body_content');
            $('nav.viztek-nav').addClass('open');
            $('#profile_panel').unbind('mouseleave');
            $('html').unbind('click');
            commonjs.docResize();
        }
    },

    refreshUserSettings: function () {
        commonjs.changeCss();
    },

    blinkStat: function (selector, speed) {

        speed = speed || 'slow';

        var self = this;
        if ($(selector).hasClass('stopped'))
            return;
        $(selector).fadeOut(speed, function () {
            $(this).fadeIn(speed, function () {
                commonjs.blinkStat(this, speed);
            });
        });
    },

    getBillingMethod: function (billingMethod) {
        var billing = "";
        switch (billingMethod) {
            case "direct_billing":
                billing = "Direct Billing";
                break;
            case "paper_claim":
                billing = "Paper Claim";
                break;
            case "electronic_billing":
                billing = "Electronic Billing";
                break;
            default:
                billing = "Patient Payment";
                break;
        }
        return billing;
    },

    getPayerType: function (payerType) {
        var payer = "";
        switch (payerType) {
            case "patient":
                payer = "Patient";
                break;
            case "referring_provider":
                payer = "Referring Provider";
                break;
            case "ordering_facility":
                payer = "Ordering Facility";
                break;
            case "primary_insurance":
                payer = "Primary Insurance";
                break;
            case "secondary_insurance":
                payer = "Secondary Insurance";
                break;
            case "tertiary_insurance":
                payer = "Tertiary Insurance";
                break;
            default:
                payer = "";
                break;
        }
        return payer;
    },

    getPayerCode: function (payerType) {
        var payer = "";
        switch (payerType) {
            case "PPP":
                payer = "Patient";
                break;
            case "PIP":
                payer = "Insurance";
                break;
            case "PR":
            case "PRP":
                payer = "Ref.phy";
                break;
            case "POF":
                payer = "Ord.Fac";
                break;
            default:
                payer = "Patient";
                break;
        }
        return payer;
    },

    'tempStatus': Immutable.Map({
        "QU": {
            'statusDesc': "Queued",
            'statusColorCode': '#2AAAFF'
        },

        "RQ": {
            'statusDesc': "Queued",
            'statusColorCode': '#2AAAFF'
        },

        "IP": {
            'statusDesc': "In-Progress",
            'statusColorCode': '#2AAAFF'
        },

        "CO": {
            'statusDesc': "Completed",
            'statusColorCode': '#4BB748'
        },

        "ME": {
            'statusDesc': "Manual Edit",
            'statusColorCode': '#2AAAFF'
        },

        "ER": {
            'statusDesc': "Error",
            'statusColorCode': '#FF0000'
        },

        "DE": {
            'statusDesc': "Deleted",
            'statusColorCode': '#FF0000'
        },

        "CX": {
            'statusDesc': "Conflicts",
            'statusColorCode': '#FF8535'
        },

        "MA": {
            'statusDesc': "Moved soon",
            'statusColorCode': '#2AAAFF'
        },

        "RM": {
            'statusDesc': "Ready to move",
            'statusColorCode': '#2AAAFF'
        },

        "MM": {
            'statusDesc': "Conflicts",
            'statusColorCode': '#FF0000'
        },

        "FQ": {
            'statusDesc': "Moved soon",
            'statusColorCode': '#2AAAFF'
        }
    }),

    'tempStatusMap': Immutable.Map({
        "QU": "QUEUED",
        "RQ": "QUEUED",
        "IP": "IN-PROGRESS",
        "CO": "COMPLETED",
        "ME": "MANUALEDIT",
        "ER": "ERROR",
        "DE": "DELETED",
        "CX": "CONFLICTS",
        "MA": "MOVEDSOON",
        "RM": "READYTOMOVE",
        "MM": "CONFLICTS",
        "FQ": "MOVEDSOON"
    }),

    'tempStatusNames': Immutable.Map({
        "QUEUED": "QU",
        "IN-PROGRESS": "IP",
        "COMPLETED": "CO",
        "MANUALEDIT": "ME",
        "ERROR": "ER",
        "DELETED": "DE",
        "CONFLICTS": "CX",
        "MOVEDSOON": "MA",
        "READYTOMOVE": "RM"
    }),

    'tempStatusNamesAlternate': Immutable.Map({
        "QUEUED": "RQ",
        "CONFLICTS": "MM",
        "MOVEDSOON": "FQ"
    }),

    getTempStatus: function (status) {
        return commonjs.tempStatus.get(status);
    },

    getTempStatusMap: function (status) {
        return commonjs.tempStatusMap.get(status);
    },

    getTempStatusNamesMap: function (status) {
        return commonjs.tempStatusNames.get(status);
    },

    getTempStatusNamesMapAlternate: function (status) {
        return commonjs.tempStatusNamesAlternate.get(status);
    },

    initSessionHandler: function () {
        var self = this;
        commonjs.useJsonpForPrefetch = app.docServerUrl != (location.protocol + '//' + location.host);
        $(document).ready(function () {

            document.onclick = commonjs.docClick;
            document.onkeydown = commonjs.enableKeys;
            window.onresize = commonjs.docResize;

            window.onbeforeunload = function () {
                // Closing WebTrans window that opened from the Viewer's [T] button (emit transcription unlock)
                if (window.name && window.name.indexOf("trans_") > -1 && window.opener) {
                    var lock_args = {
                        study_id: (window.name.split('_')[1]) ? window.name.split('_')[1] : 0,
                        lock_type: 'unlock',
                        session_id: app.sessionID,
                        user_id: app.userID
                    };
                    window.opener.commonjs.emitTranscription(lock_args);
                }
                // Every new window in EXA Web except for New Study (emit unlock without study_id "unlock_all")
                else if (window.name && window.name.indexOf("NewStudy") < 0) {
                    // If you edit lock_args, do the same in
                    //      public/javascripts/shared/viewer/events.js
                    //      public/javascripts/views/dicomviewer/viewer2.js
                    //      public/javascripts/shared/common.js
                    var lock_args = {
                        session_id: app.sessionID,
                        user_id: app.userID,
                        user_name: app.userInfo.first_name + ' ' + app.userInfo.last_name,
                        async: false
                    }
                    commonjs.emitViewerClose(lock_args);
                }

                if (typeof (prefetchViewer) != 'undefined' && prefetchViewer)
                    prefetchViewer.closeAllViewerWindows();

                if (commonjs.reportWindow)
                    commonjs.reportWindow.close();

                if (_isDirty) {
                    return '';
                }
            };

            //self.checkActivity(app.sessionTimeout * 60 * 1000, 60000); // timeout = 30 minutes, interval = 1 minute.
            sessionManager.initialize();

            self.checkUserActivity(self.userHeartbeatInterval * 60000);

            commonjs.changeCss();
            $('input').attr('autocomplete', 'off');

            if (typeof console == "undefined") {
                window.console = {
                    log: function () {
                    }
                };
            }

            commonjs.validateControls();

            if (typeof btoa === "undefined") {
                _keyStr = base64._keyStr;
                btoa = base64.encode;
                atob = base64.decode;
            }
        });
        $('#userName').text(app.userInfo.userFullName);
        if (app.userInfo.user_type === "SU") {
            $('#siteSettingsLI').show();
            $('#siteSettingsIconLI').show();
        }
    },

    validateControls: function () {
        $(".floatbox").on("keypress keyup blur", function (event) {
            //$(this).val($(this).val().replace(/[^0-9\.]/g, ''));
            $(this).val().replace(/[^0-9\.]/g, '');
            if ((event.which != 46 || $(this).val().indexOf('.') != -1) && (event.which < 48 || event.which > 57)) {
                event.preventDefault();
            }
        });
        $(".integerbox").on("keypress keyup blur", function (event) {
            // $(this).val($(this).val().replace(/[^\d].+/, ""));
            $(this).val().replace(/[^\d].+/, "")
            if ((event.which < 48 || event.which > 57) && event.which != 8 && event.which != 0) {
                event.preventDefault();
            }
        });
        var stringBoxFunction = function (e) {
            if (window.event) {
                var charCode = window.event.keyCode;
            }
            else if (e) {
                var charCode = e.which;
            }
            else {
                return true;
            }
            if ((charCode > 64 && charCode < 91) || (charCode > 96 && charCode < 123))
                return true;

            return false;
        };
        $(".stringbox").on("keypress keyup blur", function (e, t) {
            try {
                stringBoxFunction(e);
            }
            catch (err) { }
        });
        $(".floatboxtwodec").on("keypress keyup blur", function (event) {
            $(this).val().replace(/[^0-9\.]/g, '');
            if ((event.which != 46 || $(this).val().indexOf('.') != -1) && (event.which < 48 || event.which > 57)) {
                event.preventDefault();
            }
            if (($(this).val().indexOf('.') != -1) && ($(this).val().substring($(this).val().indexOf('.'), $(this).val().indexOf('.').length).length > 2)) {
                if (event.keyCode !== 8 && event.keyCode !== 46) {
                    event.preventDefault();
                }
            }
        });
        // added by subha
        $(".txtcolorpicker").on("keyup", function (event) {
            if ($(this).val() != "") {
                $(this).colorpicker('setValue', $(this).val());
                //    return true;
            } else {
                $(this).colorpicker('setValue', '#FFFFFF');
                //return false;
            }
        });
        // added for negative float numbers
        $(".negativeFloatBox").on("keypress keyup blur", function (event) {
            $(this).val().replace(/[^0-9\.-]/g, '');
            if ((event.which != 46 || $(this).val().indexOf('.') != -1) && (event.which < 48 || event.which > 57) && (event.which != 45 || $(this).val().indexOf('-') != -1)) {
                event.preventDefault();
            }
        });
    },

    roundFee: function (value) {
        return commonjs.round(value, 2);
    },
    roundUnits: function (value) {
        return commonjs.round(value, 3);
    },
    round: function (value, exp) {

        if (typeof exp === 'undefined' || +exp === 0)
            return '0.00';

        value = +value;
        exp = +exp;

        if (isNaN(value) || !(typeof exp === 'number' && exp % 1 === 0))
            return '0.00';

        // Shift
        value = value.toString().split('e');
        value = Math.round(+(value[0] + 'e' + (value[1] ? (+value[1] + exp) : exp)));

        // Shift back
        value = value.toString().split('e');

        return (+(value[0] + 'e' + (value[1] ? (+value[1] - exp) : -exp))).toFixed(exp);
    },

    initDocEvents: function () {
        sessionManager.initialize();
        if (window.isMobileViewer) common.initTouch();
    },

    checkActivity: function (timeout, interval) {
        var self = this;

        if ($.active) {
            commonjs.sessionElapsed = 0;
            $.active = false;
            $.get('/session_heartbeat');
        }

        if (commonjs.sessionElapsed < timeout) {
            commonjs.sessionElapsed += interval;
            setTimeout(function () {
                self.checkActivity(timeout, interval);
            }, interval);
        } else {
            /* Code changed for popup logout    */
            // window.location = '/logout'; // Redirect to "session expired" page.

            commonjs.redirectToLoginPage('SE');
        }
    },

    checkUserActivity: function (interval) {
        var self = this;
        if (commonjs.patientHeartbeat && commonjs.currentPatientID != '') {
            $.get('u_heartbeat/p/' + commonjs.currentPatientID);
        }

        var patTimer = setInterval(function () {
            clearInterval(patTimer);
            self.checkUserActivity(interval);
        }, interval);
    },

    getAge: function (dateString) {
        var today = new Date();
        var birthDate = new Date(dateString);
        var age = today.getFullYear() - birthDate.getFullYear();
        var m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return age;
    },

    getStudyAge: function (dateString, studyDatevalue) {
        //var today = new Date();
        var studyDate = "";
        if (studyDatevalue) {
            studyDate = new Date(studyDatevalue);
        }
        else {
            studyDate = new Date();
        }
        var birthDate = new Date(dateString);
        var age = studyDate.getFullYear() - birthDate.getFullYear();
        var m = studyDate.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && studyDate.getDate() < birthDate.getDate())) {
            age--;
        }
        return age;
    },

    setSocket: function (socketObj) {
        commonjs.socket = socketObj;

        var openViewer = function (studyID) {
            var root = window.parent || window;
            var cjs = root.commonjs;
            var getData = cjs.getData;
            var gridData = getData(studyID) || getData({ 'study_id': studyID });
            if (gridData && gridData.study_id > 0) {
                var gridID = '#tblGrid' + (homeOpentab || cjs.currentStudyFilter);
                cjs.showDicomViewer(studyID, true, gridID);
            }
            else {
                cjs.showError('Unable to open viewer, study not avalaible');
            }
        };

        commonjs.socket.on('reconnect_attempt', function (attempt) {
            var root = window.parent || window;
            var $error = root.$('.tab-pane.active').children('#worklist-error');
            var $button = $error.find('button');
            console.error('Socket reconnect attempt #' + attempt);
            $button.html('Attempting to reconnect after ' + attempt + ' tr' + (attempt === 1 ? 'y' : 'ies'));
            if (attempt > 7) {
                var filter = root.commonjs.loadedStudyFilters.get(root.commonjs.currentStudyFilter);
                if (filter) {
                    $error.css({
                        'visibility': 'visible',
                        'zIndex': 5
                    });
                }
            }
        });

        commonjs.socket.on('reconnect_failed', function () {
            var root = window.parent || window;
            var $error = root.$('.tab-pane.active').children('#worklist-error');
            var $button = $error.find('button');
            $button.html('Failed to reconnect :(');
        });

        commonjs.socket.on('reconnect', function () {
            var root = window.parent || window;
            var filter = root.commonjs.loadedStudyFilters.get(root.commonjs.currentStudyFilter);
            var $error = root.$('.tab-pane.active').children('#worklist-error');
            var $button = $error.find('button');
            $button.prop('disabled', false).html('Reload Worklist').on('click', function () {
                filter.refreshAll();
                $error.css({
                    'visibility': 'hidden',
                    'zIndex': 0
                });
                $button.prop('disabled', true).off('click');
            });
        });

        var fixAuth = function (gridData) {
            // Hack - gridData as_authorizaation formatter needs fixed
            var isString = typeof gridData.as_authorization === 'string';
            var auth = isString ?
                gridData.as_authorization.trim() :
                gridData.as_authorization;
            if (isString && auth.length > 0 && auth.charAt(0) !== '[') {
                var temp = $(auth);
                gridData.as_authorization = base64.decode(temp.attr('data-value'));
            }
            return gridData;
        };

        commonjs.socket.on('office_trigger', function (result) {
            //appSettingTrigger(result, 'facility');
        });

        var dispatchData = function (data) {
            var root = window.parent || window;
            root.commonjs.setData(data);
        };

        var iterateNewData = function (data) {

            if (typeof data === 'string') {
                try {
                    data = JSON.parse(data);
                } catch (err) { console.error(err); }
            }

            if (Array.isArray(data) && data.length > 0) {
                var count = data.length;
                var i = 0;
                for (; i < count; ++i) {
                    data[i].record_no = 'NEW';
                }
                return data;
            }
            return [];
        };

        var newStudies = function (studies) {
            dispatchData(iterateNewData(studies));
        };

        var handlePurgeStudy = function (idArray) {
            if (Array.isArray(idArray) && idArray.length > 0) {
                var root = window.parent || window;
                root.commonjs.removeStudyData(idArray);
            }
        };

        var handlePurgeOrder = function (idArray) {
            if (Array.isArray(idArray) && idArray.length > 0) {
                var root = window.parent || window;
                root.commonjs.removeOrderData(idArray);
            }
        };

        commonjs.socket.on('new_study', newStudies);

        commonjs.socket.on('study_purged', handlePurgeStudy);
        commonjs.socket.on('order_purged', handlePurgeOrder);

        commonjs.socket.on('info_changed', dispatchData);

    },

    freshUpdate: function (info) {
        var study_id = info.study_id;
        var order_id = info.order_id;
        var patient_id = info.patient_id;
        if (study_id) {
            commonjs.updateInfo(study_id, 'study');
        }
        if (order_id) {
            commonjs.updateInfo(order_id, 'order');
        }
        if (patient_id) {
            commonjs.updateInfo(patient_id, 'patient');
        }
    },

    bindUserOnline: function (result) {
        if (result && result.length > 0) {
            $("#divUserOnlineCount").html('<b>Online Users (' + result.length + ')</b>');
            $("#tblUserOnline").empty();
            var tableUserOnline = $("#tblUserOnline");
            var markup = "";
            for (var i = 0; i < result.length; i++) {
                var userOnline = result[i];
                markup += "<tr id=" + userOnline.session_id + " >";
                markup += " <td class='col-md-3'>" + userOnline.last_name + " " + userOnline.first_name + "</td>";
                markup += "<td class='col-md-4'>" + commonjs.getFormattedDateTime(userOnline.entry_dt) + "</td>";
                markup += "</tr>";
            }
            $("#tblUserOnline").append(markup);
        }
    },

    updateInfo: function (id, type, action) {
        var regSplit = /,/;
        var idArray = Array.isArray(id) ? id : String(id).split(regSplit);
        commonjs.emitUpdate(type, idArray, action);
    },

    emitUpdate: function (type, idArray, action) {
        if (commonjs.socket) {
            if (action === 'purge') {
                commonjs.socket.emit('emit_purge', {
                    'type': type,
                    'idArray': idArray
                });
            }
            else {
                commonjs.socket.emit('info_update', {
                    'type': type,
                    'idArray': idArray,
                    'session_id': app && app.sessionID || '',
                    'company_id': app && app.companyID
                });
            }
        }
    },
    emitViewerOpen: function (lock_args) {
        var _retryCount = 0,
            _socketTimer = setInterval(function () {
                _retryCount++;
                if (_retryCount > 10) {
                    clearInterval(_socketTimer);
                    return;
                }
                if (commonjs.socket) {
                    clearInterval(_socketTimer);
                    commonjs.setSocketViewerOpen(lock_args);
                }

            }, 1000);
    },
    setSocketViewerOpen: function (lock_args) {
        var self = this;
        if (lock_args.study_id > 0) {
            self.isStudyClosed = false;
            lock_args.lock_type = 'lock';
            commonjs.lockStudy(lock_args);
        }
        return false;
    },
    emitViewerClose: function (lock_args) {
        var self = this;
        if (lock_args.study_id > 0) {
            self.isStudyClosed = true;
            lock_args.lock_type = 'unlock';
            commonjs.lockStudy(lock_args);
        }
        else {
            self.isStudyClosed = true;
            lock_args.lock_type = 'unlock_all';
            commonjs.lockStudy(lock_args);
        }
        return false;
    },
    emitTranscription: function (lock_args) {
        var self = this;
        $.ajax({
            url: "broadcast",
            type: "POST",
            dataType: "json",
            data: {
                trigger: 'transcription_lock_unlock',
                lock_args: lock_args
            },
            success: function (data) {
                if (data.error) {
                    handleResponseError(data.error);
                    return;
                }
            },
            error: function (request, status, error) {
                handleAjaxError(request, status, error);
            }
        });
        return false;
    },

    type: function (arg) {
        return !!arg && Object.prototype.toString.call(arg).match(/(\w+)\]/)[1];
    },

    getHostUrl: function () {
        return location.protocol + '//' + location.host;
    },

    formatID: function (id) {
        return id.replace(' ', '')
            .replace(',', '__44__');
    },

    parseID: function (id) {
        return id.replace('__44__', ',');
    },

    formatJson: function (jsonString) {
        if (typeof jsonString === 'string') {
            try {
                return JSON.parse(jsonString);
            }
            catch (e) { }
        }
        else if (typeof jsonString === 'object' && jsonString !== null) {
            return jsonString;
        }
        return [];
    },

    validateIP: function (ip) {
        var expression = /^((([0-9]{1,2})|(1[0-9]{2,2})|(2[0-4][0-9])|(25[0-5])|\*)\.){3}(([0-9]{1,2})|(1[0-9]{2,2})|(2[0-4][0-9])|(25[0-5])|\*)$/;
        var regx = new RegExp(expression);
        return regx.test(ip);
    },

    /**
     * Set screen name cookie to Studies so different user login doesn't break, EXA-7505, EXA-7830
     */
    resetScreenNameCookie: function () {
        commonjs.setCookieOptions(2, 'Studies');
    },

    logOut: function (callback) {
        commonjs.showLoading('Logging out...');
        commonjs.resetScreenNameCookie();
        commonjs.setCookie('patquery', '', -1);
        if (prefetch.windowObj && typeof prefetch.windowObj.close !== 'undefined') {
            prefetch.windowObj.close();
        }

        $.ajax({
            url: "/broadcast",
            type: "POST",
            dataType: "json",
            data: {
                trigger: 'logoutOnlineUser',
                sessionID: app.sessionID
            },
            success: function (data) {
                setTimeout(function () {
                    commonjs.hideLoading();
                    if (prefetchViewer)
                        prefetchViewer.closeAllViewerWindows();
                    location.href = '/logout?user=1';
                }, 1000);
            },
            error: function (request, status, error) {
                commonjs.handleXhrError(request);
            }
        });
    },

    closeOpenWindows: function () {
        if (app && app.openWindows) {
            for (var i = 0; i < app.openWindows.length; i++) {
                app.openWindows[i].close();
            }
        }
    },

    checkMultiple: function (e, gridIDPrefix1) {
        e = e || event;
        /* get IE event ( not passed ) */
        e.stopPropagation ? e.stopPropagation() : e.cancelBubble = true;
        //console.log(e);
        if ($('#' + (e.target || e.srcElement).id).is(':checked')) {
            $("#btnSelectAllStudy").click();
        }
        else {
            $("#btnClearAllStudy").click();
        }
    },

    /**
     * Use a checkbox to select all checkboxes in a given element
     *
     * @param {object} e The click event object of the 'select all' checkbox
     * @param {string} el The selector element where all the checkboxes are
     */
    checkSelectAll: function (e, el) {
        $(el).find('input:checkbox').each(function () {
            this.checked = e.currentTarget.checked;
        });
    },

    /**
     * Opens a new window and prints some data
     *
     * @param {string} data ex: '<div>Hello World</div>'
     */
    print: function (data) {
        var w = window.open();

        if (w) {
            w.document.write($('<div/>').append($(data).clone()).html());
            w.print();
            w.close();
        } else {
            alert('Your browser prevented the window from opening. Please enable popups and try again.');
        }
    },

    popOverActions: function (e) {
        if ($('#showColor').is(':visible')) {
            $('#showColor').hide();
        }
        else {
            var statusCodes = app.status_color_codes && app.status_color_codes.length && app.status_color_codes || parent.app.status_color_codes;
            if (statusCodes && statusCodes.length) {
                var paymentStatus = $.grep(statusCodes, function (currentObj) {
                    return ((currentObj.process_type == 'payment'));
                });

                $('#showColor').empty();
                $.each(paymentStatus, function (index, status) {
                    $('#showColor').append(
                        $('<div/>').append(
                            $('<span/>').css({ 'width': '30px', 'height': '15px', 'display': 'inline-block', 'border': '1px solid ' + status.color_code, 'background-color': status.color_code }),
                            $('<span/>').css({ 'margin-left': '20px', 'font-weight': 'bold' }).text(status.process_status)
                        )
                    )
                });

                $("#showColor").show();
                var div = $('#showColor');
                $(document.body).append(div);

                var posX = $((e.target || e.srcElement)).offset().left;
                var posY = $((e.target || e.srcElement)).offset().top + 20;
                $(div).css({ top: posY, left: posX, position: 'absolute' });
            }
        }
    },
    disableKeys: function (e) {
        $("#" + element.id).data('tooltip').destroy();
    },



    handleEnableKeys: function (e, element) {
        var $element = $(element);
        var keycode;
        var regID = commonjs.regExps.regKeyDownIDs;
        var elementID = element.id;
        if (window.event) {
            keycode = window.event.keyCode;
            e = window.event
        }
        else if (e) {
            keycode = e.which;
        }
        if (keycode == 220 && e.shiftKey && regID.test(elementID)) {
            return true;
        }
        else if (elementID == 'txtEncodeChar') {
            if (e.shiftKey && keycode == 192) {
                return true;
            }
            if (keycode == 220 && !(e.shiftKey)) {
                return true;
            }
        }
        for (var i = 0; i < commonjs.limitedKeyCodes.length; i++) {
            if (keycode == commonjs.limitedKeyCodes[i]) {//220-\, 192-~, 222-'

                if (element.localName == "input") {

                    $element.tooltip({
                        title: "special characters are not allowed",
                        placement: "bottom",
                        trigger: "focus"
                    });
                    $element.addClass('tooltipactive');//just use classname only

                    $element.keyup(function (e) {

                        $element.tooltip("show");

                    });

                    if (commonjs.hideTooltipTimer) {
                        clearTimeout(commonjs.hideTooltipTimer);
                    }
                    commonjs.hideTooltipTimer = setTimeout(function () {
                        $element.tooltip("hide");
                    }, 3000);

                }
                else {
                    // To be honest, everywhere there's a [...].find('#' + elementID)
                    // should be replaced by an `if ...$element is inside of $thColumn...` etc.
                    // but we don't want to break things just because of common sense.
                    var $thColumn = $('.ui-th-column');
                    var $thColumnTarget = $thColumn.find("#" + elementID);
                    $thColumnTarget.each(function () {
                        var $this = $(this);
                        $this.tooltip({
                            title: "special characters are not allowed",
                            placement: "bottom",
                            position: "left",
                            trigger: "focus"
                        });
                        $('.ui-jqgrid .ui-jqgrid-htable th div').addClass('tooltipactive');
                        $this.addClass('tooltipactive1');

                    });

                    $thColumnTarget.keyup(function (e) {
                        var $this = $(this);
                        $this.tooltip("show");
                    });

                    if (commonjs.hideTooltipTimer) {
                        clearTimeout(commonjs.hideTooltipTimer);
                    }
                    commonjs.hideTooltipTimer = setTimeout(function () {

                        $thColumnTarget.tooltip("hide");

                    }, 3000);

                }

                if (event.preventDefault) {
                    event.preventDefault();  // non-IE browsers
                }
                else {
                    event.returnValue = false;  // IE browsers
                }
                return false;
            }
            else {
                if (element.localName == "input") {

                    $(".tooltipactive").tooltip("hide");
                    $element.removeData('tooltip');

                }
                else {

                    $(".tooltipactive1").tooltip("hide");
                    $('.ui-th-column').find("#" + elementID).removeData('tooltip');

                }

            }
        }
        if (e.shiftKey) {
            for (var i = 0;
                i < commonjs.limitedKeyCodesAfterShift.length;
                i++) {
                if (keycode == commonjs.limitedKeyCodesAfterShift[i]) {//220-\, 192-~, 222-'

                    if (keycode == commonjs.limitedKeyCodesAfterShift[i]) {//220-\, 192-~, 222-'

                        if (element.localName == "input" && ($element.hasClass('fromPeriodAge'))) {
                            if (e.which != 60 && e.which != 62 && $(e.target).val().indexOf('<') == -1 && $(e.target).val().indexOf('>') == -1)
                                return true;
                        }
                        if (element.localName == "input") {

                            $element.tooltip({
                                title: "special characters are not allowed",
                                placement: "bottom",
                                trigger: "focus"
                            });
                            $element.addClass('tooltipactive');//just use classname only

                            $element.keyup(function (e) {
                                $element.tooltip("show");
                            });

                            if (commonjs.hideTooltipTimer) {
                                clearTimeout(commonjs.hideTooltipTimer);
                            }
                            commonjs.hideTooltipTimer = setTimeout(function () {
                                $element.tooltip("hide");
                            }, 3000);

                        }
                        else {

                            var $thColumn = $('.ui-th-column');
                            var $thColumnTarget = $thColumn.find("#" + elementID);
                            $thColumnTarget.each(function () {

                                $thColumnTarget.tooltip({
                                    title: "special characters are not allowed",
                                    placement: "bottom",
                                    position: "left",
                                    trigger: "focus"
                                });
                                $('.ui-jqgrid .ui-jqgrid-htable th div').addClass('tooltipactive');
                                $thColumnTarget.addClass('tooltipactive1');

                            });
                            //
                            //
                            //
                            $thColumnTarget.keyup(function (e) {

                                $thColumnTarget.tooltip("show");
                            });

                            if (commonjs.hideTooltipTimer) {
                                clearTimeout(commonjs.hideTooltipTimer);
                            }
                            commonjs.hideTooltipTimer = setTimeout(function () {

                                $thColumnTarget.tooltip("hide");
                            }, 3000);

                        }

                        if (event.preventDefault) {
                            event.preventDefault();  // non-IE browsers
                        }
                        else {
                            event.returnValue = false;  // IE browsers
                        }
                        return false;
                    }
                    else {
                        if (element.localName == "input") {

                            $(".tooltipactive").tooltip("hide");
                            $element.removeData('tooltip');

                        }
                        else {

                            $(".tooltipactive1").tooltip("hide");
                            $('.ui-th-column').find("#" + elementID).removeData('tooltip');

                        }

                    }
                }
            }
        }
        if (keycode == 27) {

        }
        else if (keycode == 8) {//backspace key
            if (element.readOnly || element.tagName == 'SELECT')
                return false;
        }
        $(".tooltipactive").tooltip("hide");
        return true;
    },

    enableKeys: function (e) {
        var element = e.target || e.srcElement;
        var ignore = commonjs.regExps.regIgnoreEnableKeys;
        // SMH - 2015.7.25
        // Added a check for a class to quickly resolve an issue with specific inputs.
        //   Should come back to this at a later time and rewrite the function or do away with it alltogether in favor of something smarter
        if (element.tagName === 'INPUT' && !ignore.test(element.className)) {
            try {
                // Don't lose optimizations - only do function calls in a try-catch.
                if ($(e.target).attr('id').indexOf('gs') != -1) //Its is a grid search column
                    commonjs.checkSpecialCharExists(e);
                else
                    commonjs.handleEnableKeys(e, element);
            }
            catch (err) { }
        }
    },

    checkSpecialCharExists: function (e) {
        var key_pressed;
        var $element = $(e.target || e.srcElement);
        document.all ? key_pressed = e.keyCode : key_pressed = e.which;
        var isSpecialChar = commonjs.limitedKeyCodesAfterShift.indexOf(key_pressed) != -1;

        if (isSpecialChar) {
            var offsetVal = $($element).offset();
            if ($('#divInvalidChar').length)
                $('#divInvalidChar').show();
            else {
                $('<div/>').attr('id', 'divInvalidChar').addClass('tooltip fade bottom in alert alert-danger')
                    .css({ 'text-align': 'center', 'top': offsetVal.top + 30, 'left': offsetVal.left })
                    .html('Special characters not allowed')
                    .appendTo('body');
            }
            $($element).on('blur', function () {
                $('#divInvalidChar').remove();
            });
            return false;
        }
        else {
            if ($('#divInvalidChar').length) $('#divInvalidChar').remove();
        }
    },

    sortByKey: function (array, key, orderBy) {
        orderBy = orderBy ? orderBy.toUpperCase() : 'ASC';
        var aLength = array.length;
        var aTempLength = aLength;
        for (var i = 0; i < aLength; i++) {
            var sIndex = 0, temp;
            for (var j = 0; j < aTempLength; j++) {
                if (orderBy == 'ASC' && parseFloat(array[sIndex][key]) > parseFloat(array[j][key])) {
                    sIndex = j;
                }
                else if (orderBy == 'DESC' && parseFloat(array[sIndex][key]) < parseFloat(array[j][key])) {
                    sIndex = j;
                }
            }
            temp = array[sIndex];
            array.splice(sIndex, 1);
            array.push(temp);
            aTempLength--;
        }
        return array;
    },

    sortByAnyKey: function (field, reverse, primer) {
        var key = (primer) ? function (x) { return primer(x[field]) } : function (x) { return x[field] };
        reverse = !reverse ? 1 : -1;
        return function (a, b) {
            a = key(a);
            b = key(b);
            return reverse * ((a > b) - (b > a));
        }
    },

    checkNotEmpty: function (str) {
        if (!str) {
            return false;
        }
        return $.trim(str) != '';
    },

    initializeScreen: function (args, isManual) {
        if (!isManual) {
            $("#pageHeaderTab").show();
            $('#divPageHeaderButtons').show();

            $('#divPageHeaderButtons').empty();
            var value = '';
            if (args.buttons && args.buttons.length > 0) {
                var tempDiv = $('<div class="btn-group"></div>');
                $('#divPageHeaderButtons').append(tempDiv);
                $.each(args.buttons, function (index, buttonArgs) {
                    value = buttonArgs.value.replace(/ /g, '');
                    if (!buttonArgs.type) {
                        buttonArgs.type = 'button';
                    }
                    var i18nText = buttonArgs.i18n ? ' i18n="' + buttonArgs.i18n + '" ' : '';
                    if (buttonArgs.splitActions && buttonArgs.splitActions.length) {
                        var buttonHtml = '<div class="btn-group" style="margin:0 4px;">' + '<button id="btn' + value + args.header.ext + '" class="' + buttonArgs.class;

                        if (buttonArgs.route || buttonArgs.clickEvent) {
                            // If there is a default clickEvent or route, create a split button
                            buttonHtml += '"  ' + i18nText + '>' + value + '</button>' +
                                '<button type="button" class="btn dropdown-toggle" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false" style="margin-left: 1px;">' +
                                '<span class="caret" data-original-title="" title=""></span>';
                        } else {
                            // There is no default action, create a dropdown button
                            buttonHtml += ' dropdown-toggle" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false"><span ' + i18nText + ' >' + value + '</span> <span class="caret" style="position:relative;left:15px;"></span> </button>';
                        }

                        buttonHtml += '</button>' +
                            '<ul id="ul' + value + args.header.ext + '" class="dropdown-menu" style="top:100%;"></ul>';

                        tempDiv.append(buttonHtml);
                        //$('#btn' + value + args.header.ext).click(buttonArgs.clickEvent);

                        $.each(buttonArgs.splitActions, function (index, splitAction) {
                            var aValue = splitAction.value.replace(/ /g, '') || '',
                                aHref = splitAction.route ? 'href="/' + splitAction.route + '" ' : '',
                                aI18nText = splitAction.i18n ? ' i18n="' + splitAction.i18n + '" ' : '',
                                itemHtml = '<li>' +
                                    '<a ' + aHref + aI18nText + ' id="anc' + value + '_' + aValue + args.header.ext + '" class="' + splitAction.class + '">' + aValue + '</a></li>';
                            $('#ul' + value + args.header.ext, tempDiv).append(itemHtml);

                            if (splitAction.clickEvent) {
                                $('#anc' + value + '_' + aValue + args.header.ext, tempDiv).click(splitAction.clickEvent);
                            }

                        });

                    } else {
                        tempDiv.append('<input type="' + buttonArgs.type + '" value="' + buttonArgs.value + '" ' + i18nText + ' id="btn' + value + args.header.ext + '" class="' + buttonArgs.class + '"/>');
                    }

                    if (buttonArgs.route) {
                        location.href = '/' + buttonArgs.route;
                    } else {
                        $('#btn' + value + args.header.ext).click(buttonArgs.clickEvent);
                    }
                });
            }

            if (args.toggles && args.toggles.length > 0) {
                var tempDiv = $('<div class="btn-group btn-toggle" style="display:inline;float:right;"></div>');
                $('#divPageHeaderButtons').append(tempDiv);
                $.each(args.toggles, function (index, toggleArgs) {
                    value = toggleArgs.value.replace(/ /g, '');
                    if (!toggleArgs.type) {
                        toggleArgs.type = 'button';
                    }
                    var i18nText = toggleArgs.i18n ? ' i18n="' + toggleArgs.i18n + '" ' : '';
                    // tempDiv.append('<input type="' + toggleArgs.type + '" value="' + toggleArgs.value + '" ' + i18nText + ' id="btn' + value + args.header.ext + '" class="' + toggleArgs.class + '"/>');
                    tempDiv.append('<button style="margin: 0 2px !important;" data-toggle="button" id="btn' + value + '" class="' + toggleArgs.class + '"><span id="sp' + value + '" class="icon" ' + i18nText + ' ></span></button>');
                    if (toggleArgs.route) {
                        location.href = '/' + toggleArgs.route;
                    } else {
                        $('#btn' + value).click(toggleArgs.clickEvent);
                    }
                });
            }
            if (args.checkboxes && args.checkboxes.length > 0) {
                $.each(args.checkboxes, function (index, checkboxArgs) {
                    var i18nText = checkboxArgs.i18n ? ' i18n="' + checkboxArgs.i18n + '" ' : '';
                    $('#divPageHeaderButtons').append('<div id="div' + checkboxArgs.id + '" style="float:right;padding-top:10px;" class="checkbox"><label style="display: inline-block; margin-bottom: 0px !important;" for="chk' + checkboxArgs.id + '"><input style="margin-top:2px !important;" type="checkbox" id="chk' + checkboxArgs.id + '" name="' + checkboxArgs.name + '"><label style="display: inline-block; margin-bottom:0px;" for="chk' + checkboxArgs.id + '" class="field-chk" ' + i18nText + '></label></label></div>');

                    $('#chk' + checkboxArgs.id).change(checkboxArgs.changeEvent);

                });
            }

            //commonjs.licenseCheck();
        }
        setTimeout(function () {
            commonjs.docResize();  //fjc added to correctly resize grids once rendered
        }, 50);

        commonjs.processPostRender(args.header);
        commonjs.initializeCheckBoxSelection();
        commonjs.validateControls();
        commonjs.isMaskValidate();
        commonjs.setupCityStateZipInputs();
    },

    licenseCheck: function () {
        $('[data-license*=' + app.license + ']').remove();

        /**
         * For handling removal of "Fax Manager" from menu until product/license
         * code handling is changed.
         */
        if (app && app.settings && Array.isArray(app.thirdParty)) {
            var removeUpdox = !app.thirdParty.some(function (tool) {
                return tool.enabled === true && tool.id === 'updox';
            });
            if (!app.settings.updoxEnabled || removeUpdox) {
                $('#faxLI').remove();
            }
        }
    },

    processPostRender: function (args) {
        var screenTitle = (args && args.screen != '') ? args.screen : 'PACS-Title';

        var cultureCode = 'es_us';

        switch (cultureCode.substring(0, 2)) {
            case 'es':
                cultureCode = "es_us";
                break;

            case 'fr':
                cultureCode = "fr_fr";
                break;

            case 'hr':
                cultureCode = "hr_hr";
                break;

            // case 'th':
            //     cultureCode = "th_th";

            default:
                cultureCode = "default";
        }

        app.currentCulture = cultureCode;
        commonjs.updateCulture(app.currentCulture, commonjs.beautifyMe);
        commonjs.setMultiselectSearchIcon();
    },

    setMultiselectSearchIcon: function () {
        $.each($('.multiselect-item span'), function (index, obj) {
            $(this).find('.glyphicon-search').removeClass('glyphicon').removeClass('glyphicon-search').addClass('fa fa-search').css('margin', '10px');
            $(this).find('.glyphicon-remove-circle').removeClass('glyphicon').removeClass('glyphicon-remove-circle').addClass('fa fa-times');                        
        });
    },

    beautifyMe: function () {
        $('.field-required').append('<span class="Required" style="color: red;padding-left: 5px;">*</span>');
    },

    updateCulture: function (culture, cb) {
        var upCul = i18n.loadDefaultLanguage(function () {
            i18n.setLang(culture);
            i18n.t(undefined, cb);
        });

        return upCul;
    },

    getRightClickMenu: function (elementID, i18n, isSubMenu, elementName, isULMenu) {
        if (isULMenu) {
            return '<li class="dropdown-submenu" id=li_' + elementID + '><a tabindex="-1" href="javascript: void(0)" i18n=' + i18n + ' class="dropdown-item">' + elementName + '</a><ul id=' + elementID + ' style="float:right; max-width: 500px; overflow: auto; max-height: 300px";" class="dropdown-menu"></ul></li>';
        } else if (isSubMenu) {
            return '<li><a class="dropdown-item" id=' + elementID + '  href="javascript: void(0)" >' + elementName + '</a></li>'
        } else {
            return '<li><a id=' + elementID + ' href="javascript: void(0)" i18n=' + i18n + ' class="dropdown-item">' + elementName + '</a></li>';
        }
    },

    getColorCodeForStatus: function (facility_id, code, screenName) {
        var statusCodes = app.study_status && app.study_status.length && app.study_status || parent.app.study_status;
        if (statusCodes && statusCodes.length > 0) {
            return $.grep(statusCodes, function (currentObj) {
                return ((currentObj.facility_id == facility_id) && (currentObj.status_code == code));
            });
        }
        return [];
    },

    getBillingUserName: function (username) {
        if (app.billing_user_list && app.billing_user_list.length > 0) {
            return $.grep(app.billing_user_list, function (users) {
                return users.username == username;
            });
        }
        return [];
    },

    getClaimColorCodeForStatus: function (code, processType) {
        var statusCodes = app.status_color_codes && app.status_color_codes.length && app.status_color_codes || parent.app.status_color_codes;
        if (statusCodes && statusCodes.length > 0) {
            return $.grep(statusCodes, function (currentObj) {
                return ((currentObj.process_type == processType) && (currentObj.process_status == code));
            });
        }
        return [];
    },

    getClaimStudy: function (claim_id, callback) {
        var result = {
            'study_id': 0,
            'order_id': 0
        };

        $.ajax({
            url: '/exa_modules/billing/claim_workbench/claim_study?claim_id=' + claim_id,
            type: 'GET',
            success: function (data, response) {
                if (data && data.length > 0) {
                    result.study_id = data[0].study_id;
                    result.order_id = data[0].order_id;
                }

                callback(result);
            },
            error: function (err, response) {
                commonjs.handleXhrError(err, response);
            }
        });
    },

    openDocumentsAndReports: function (options) {
        var study_id = options.study_id,
            order_id = options.order_id,
            patient_id = options.patient_id;

        var url = '/vieworder#patient/patientReport/all/' + btoa(patient_id) + '/' + btoa(order_id) + '/' + btoa(study_id);
        this.openWindow(url);
    },

    openWindow: function (url) {
        var self = this;
        self.detectChromeExtension(function (hasEx) {
            if (hasEx) {
                self.placeWindows(url);
            } else {
                var left = window.screen.availLeft;
                var top = window.screen.availTop;
                var width = window.screen.availWidth;
                var height = window.screen.availHeight;
                if (window.parent.reportWindow && !window.parent.reportWindow.closed) {
                    window.parent.reportWindow.location.href = url + '?m_i=' + (0) + '&l=2';
                    return;
                } else {
                    window.parent.reportWindow = window.open("about:blank", "mywin" + 0, "left=" + left + ",top=" + top + ",width=" + width + ",height=" + height);
                    window.parent.reportWindow.location.href = url + '?m_i=' + (0) + '&l=' + (1);
                }
            }
        });
    },

    detectChromeExtension: function (callback) {
        var self = this;
        var extensionId = "mlkplhocljobcbmokjlehlminmnfaddn";
        var accessibleResource = "favicon_16.ico";
        if (typeof (chrome) !== 'undefined') {
            var xmlHttp = new XMLHttpRequest(),
                testUrl = 'chrome-extension://' + extensionId + '/' + accessibleResource;
            xmlHttp.open('HEAD', testUrl, true);
            xmlHttp.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
            xmlHttp.timeout = 1000;
            xmlHttp.onreadystatechange = function () {
                if (xmlHttp.readyState == 4 && typeof (callback) == 'function') {
                    if (xmlHttp.status == 200) {
                        callback.call(this, true);
                    } else {
                        callback.call(this, false);
                    }
                }
            }
            xmlHttp.ontimeout = function () {
                if (typeof (callback) == 'function')
                    callback.call(this, false);
            }
            xmlHttp.send();
        } else {
            if (typeof (callback) == 'function')
                callback.call(this, false);
        }
    },

    placeWindows: function (url) {
        var self = this;
        if (window.parent.reportWindow && !window.parent.reportWindow.closed) {
            window.parent.reportWindow.location.href = url + '?m_i=' + (0) + '&l=2';
            return;
        }
        self.displayL = [];
        window.parent.postMessage({ type: "FROM_PAGE", action: "0" }, "*");

        var msgHandler = function (event) {
            var indexL = -1;
            var indexR = -1;
            var xpoint = window.screen.
                availLeft;
            var ypoint = window.screen.availTop;
            var width = window.screen.availWidth;
            var height = window.screen.availHeight;
            for (var d = 0; d < event.data.length; d++) {
                if (event.data[d].left + event.data[d].width == xpoint)
                    indexL = d;
                if (xpoint + width == event.data[d].left)
                    indexR = d;
                self.displayL.push({
                    left: event.data[d].left,
                    top: event.data[d].top,
                    width: event.data[d].width,
                    height: event.data[d].height
                });
            }
            var curIndex = -1;
            if (indexR > -1)
                curIndex = indexR;
            else if (indexL > -1)
                curIndex = indexL;
            else if (curIndex < 0 && self.displayL && self.displayL.length > 0)
                curIndex = 0;

            if (curIndex > -1) {
                window.removeEventListener("message", msgHandler);
                window.parent.reportWindow = window.open("about:blank", "mywin" + curIndex, "left=" + self.displayL[curIndex].left + ",top=" + self.displayL[curIndex].top + ",width=" + self.displayL[curIndex].width + ",height=" + self.displayL[curIndex].height);
                window.parent.reportWindow.location.href = url + '?m_i=' + (0) + '&l=' + (event.data.length);
                window.parent.postMessage({ type: "FROM_PAGE", action: "1", workArea: self.displayL[curIndex], index: 0, fscreen: false, focused: true }, "*");
            }
        }
        window.addEventListener("message", msgHandler, false);
    },

    changeColumnValue: function (tbl, row, columnName, value, fromService, rowData, needManualToolTip, titleString) {
        var regID = /^#tblGrid/;
        if (typeof tbl === 'string') {
            var tblID = tbl;
            var gridID = tblID.replace(regID, '');
            var gridObj = commonjs.loadedStudyFilters.get(gridID);
            var $tblGrid = gridObj && gridObj.customGridTable || $(tbl);
        }
        else if (tbl.length > 0) {
            tblID = tbl[0].id;
            gridID = tblID.replace(regID, '');
            gridObj = commonjs.loadedStudyFilters.get(gridID);
            $tblGrid = tbl;
        }
        if (typeof row === 'string') {
            var rowID = row;
            var $row = $tblGrid.find('#' + rowID);
        }
        else if (row.length > 0) {
            rowID = row[0].id;
            $row = row;
        }

        if (fromService) {
            if (!rowData) {
                var store = gridObj && gridObj.datastore;
                var model = store && (store.get(rowID) || store.findWhere({ study_id: rowID }));
                rowData = model && model.toJSON() || $tblGrid.jqGrid('getRowData', rowID);
            }

            if (rowData[columnName] !== value) {
                commonjs.applyBackgroundColor(tbl, $row, columnName);
            }
        }
        $tblGrid.jqGrid('setCell', rowID, columnName, value);
        var colAttr = tblID.replace('#', '') + '_' + columnName;
        var $col = $row.children('td').filter('[aria-describedby =' + colAttr + ']');
        $col.html(value);
        if (needManualToolTip) {
            $col.attr('title', titleString);
        }
    },

    applyBackgroundColor: function (tbl, row, columnName) {
        if (typeof tbl === 'string') {
            var tblID = tbl;
            var $tblGrid = $(tblID);
        }
        else if (tbl.length > 0) {
            tblID = tbl[0].id;
            $tblGrid = tbl;
        }
        if (typeof row === 'string') {
            var $row = $tblGrid.find('#' + row);
        }
        else if (row.length > 0) {
            $row = row;
        }
        var colAttr = tblID.replace('#', '') + '_' + columnName;
        $row.children('td').filter('[aria-describedby =' + colAttr + ']')
            .animate({ backgroundColor: "#FFFF00", color: '#000' }, 0)
            .animate({ backgroundColor: "inherit" }, 1000);
    },

    changeRowValue: function (tblID, rowID, rowData) {
        $('#' + tblID).jqGrid('setRowData', rowID, rowData);
    },

    initializeCheckBoxSelection: function () {
        $('.checked_List').find('li').removeClass('highlightCheckBox');
        $('.checked_List').find($("input:checkbox")).change(function () {
            $(this).closest('li').toggleClass('highlightCheckBox');
        });
    },

    redirectToLoginPage: function (errCode) {
        // Release all user locks
        commonjs.emitViewerClose({
            session_id: app.sessionID,
            user_id: app.userID,
            user_name: app.userInfo.first_name + ' ' + app.userInfo.last_name,
            async: true
        });

        var logoutInfo = '';
        if (errCode) {
            logoutInfo = '?err=' + errCode;
        }

        window.location = '/logout' + logoutInfo;
    },

    disposeStatusFilter: function (popupId, srcElement) {
        var divObject = document.getElementById(popupId);
        if ($(divObject).is(':visible')) {
            var src = srcElement;
            while (src != divObject) {
                if (!src.parentNode && src.parentNode == null) {
                    break;
                }
                src = src.parentNode;
            }
            if (src != divObject) {
                $(divObject).hide();
            }
        }
        else {
            return false;
        }
    },

    validateMailID: function (emailAddress) {
        // var pattern = /^((([a-z]|\d|[!#\$%&'\*\+\-\/=\?\^_`{\|}~]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])+(\.([a-z]|\d|[!#\$%&'\*\+\-\/=\?\^_`{\|}~]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])+)*)|((\x22)((((\x20|\x09)*(\x0d\x0a))?(\x20|\x09)+)?(([\x01-\x08\x0b\x0c\x0e-\x1f\x7f]|\x21|[\x23-\x5b]|[\x5d-\x7e]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(\\([\x01-\x09\x0b\x0c\x0d-\x7f]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]))))*(((\x20|\x09)*(\x0d\x0a))?(\x20|\x09)+)?(\x22)))@((([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.)+(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.?$/i;
        var pattern = /^([a-zA-Z0-9_\.\-])+\@(([a-zA-Z0-9])+\.)+([a-zA-Z0-9]{2,4})+$/;
        return pattern.test(emailAddress);
    },

    validateFax: function (faxNo) {

        var pattern = new RegExp(/^\+?[0-9]{6,}$/);
        return pattern.test(faxNo);
    },

    initMouseWheel: function () {
        $("#divGadgetSummary").mousewheel(function (event, delta) {
            var scrollLeft = $(this).scrollLeft() - (delta * 30);
            $(this).scrollLeft(scrollLeft);
            event.preventDefault();

        });
    },

    homeGridProgressBar: function (rowID, colName, progressBar) {
        if (homeOpentab && colName && rowID) {
            var rowObj, patientName, currentTab;
            currentTab = 'tblGrid' + homeOpentab;
            progressBar = (parseInt(progressBar) != 'NaN') ? progressBar : 0;
            patientName = $("#" + currentTab).jqGrid('getCell', rowID, colName);


            if (patientName.length > 250 && $(patientName) && $(patientName).find('.sr-only') && $(patientName).find('.sr-only').length > 0) {
                patientName = $(patientName).find('.sr-only')[0].innerHTML ? $(patientName).find('.sr-only')[0].innerHTML : '';
            }
            rowObj = ($("#" + currentTab + " #" + rowID).length > 0 ? $("#" + currentTab + " #" + rowID)[0].children : []);
            for (var i = 0; i < rowObj.length; i++) {
                for (var j = 0; j < rowObj[i].attributes.length; j++) {
                    if (rowObj[i].attributes[j].name == "aria-describedby") {
                        if (rowObj[i].attributes[j].value.split('_').splice(1, 10).join('_') == colName) {
                            rowObj[i].innerHTML = '';
                            rowObj[i].innerHTML = '<div class="progress-striped active" style="margin-bottom:0px !important;"><div class="progress-bar"  role="progressbar" aria-valuenow="' + progressBar + '" aria-valuemin="0" aria-valuemax="100"  style="width: ' + progressBar + '%;background-color:#07B955;"><span class="sr-only">' + patientName + '</span></div></div>';
                        }
                    }
                }
            }
        }
    },

    hideGridProgressBar: function () {
        if (homeOpentab) {
            var currentTab, rowObj, patientName;
            currentTab = 'tblGrid' + homeOpentab;
            rowObj = ($("#" + currentTab + " tr").find('.progress-striped').length > 0 ? $("#" + currentTab + " tr").find('.progress-striped') : []);
            for (var i = 0; i < rowObj.length; i++) {
                patientName = $("#" + currentTab + " tr").find('.progress-striped').find('.sr-only').length > 0 ? $("#" + currentTab + " tr").find('.progress-striped').find('.sr-only')[0].innerHTML : '';
                if (rowObj[i].parentElement) rowObj[i].parentElement.innerHTML = patientName;
            }
        }
    },

    logInfo: function (msg) {
        console.log(msg + ': ' + new Date().getTime());
    },

    getParametersByName: function () {
        if (location.hash.indexOf('&') > -1) {
            return commonjs.getParameterByName(location.hash);
        }
        return commonjs.getParameterByName(location.search, /[\?&#]/);
    },

    getParameterByName: function (queryString, sep) {
        var params = {}, queries, temp, i, l;
        if (queryString) {
            // Split into key/value pairs
            queries = queryString.split(sep || /[\?&]/);

            // Convert the array of strings into an object
            for (i = 0, l = queries.length; i < l; i++) {
                temp = queries[i].split('=');
                params[temp[0]] = temp[1];
            }
        }
        return params;
    },

    getSessionArgs: function () {
        return 'session=' + commonjs.getSession();
    },

    getSession: function () {
        var qs = commonjs.getParametersByName();
        if (qs.def_session) {
            return qs.def_session;
        }
        if (location.search.indexOf('def_session') > -1) {
            var qs = commonjs.getParameterByName(location.search);
            return qs.def_session;
        }

        return btoa(app.sessionID);
    },

    isDemoSession: function () {
        return location.href.indexOf('demo_session') > -1 ? true : false;
    },

    getMinutes: function (time, type) {
        // Modified to allow for 12h format times
        var offset = (typeof time === 'string' && time.toLowerCase().indexOf('pm') > -1) ? 720 : 0;
        if (time) {
            if (type !== 'to' || time !== '00:00:00' && time !== '00:00' && time !== '0:00') {
                if (time.charAt(1) !== ':') {
                    return (parseInt(time.substring(0, 2)) * 60) + parseInt(time.substring(3, 5)) + offset;
                }
                return (parseInt(time.charAt(0)) * 60) + parseInt(time.substring(2, 4)) + offset;
            }
            return 1440; // 24 hrs * 60 min each
        }
        return 0;
    },

    checkInteger: function (val) {
        var numberRegex = /^[+-]?\d+(\.\d+)?([eE][+-]?\d+)?$/;
        return numberRegex.test(val);
    },

    getTatValue: function (tat_level) {
        if (typeof tat_level != "number" || tat_level <= -1) return "";

        var r = "<div style='padding-left: 10px;'>Tat " + tat_level.toString() + "</div>";
        if (app && app.tat_config && app.tat_config.length >= tat_level) {
            var tatClass = "";
            if (tat_level == 3) tatClass = " class='blinking' ";

            var r = "" +
                "<div style='background-color: " + app.tat_config[tat_level + 1].color + "; color: " + app.tat_config[tat_level + 1].text_color + "; padding-left: 10px;'>" +
                "    <span " + tatClass + ">" + app.tat_config[tat_level + 1].description + "</span>" +
                "</div>";
        }

        return r;
    },

    lockStudy: function (lock_args, callback) {
        var self = this;
        $.ajax({
            url: '/lockStudy',
            type: "PUT",
            data: lock_args,
            async: lock_args.async,
            success: function (data, textStatus, jqXHR) {
                if (typeof callback === 'function') {
                    callback(true);
                }
            },
            error: function (model, response) {
                commonjs.handleXhrError(model, response);
                if (typeof callback === 'function') {
                    callback(false);
                }
            }
        });
    },

    /**
     * Determines if the user has permission for the given permission code
     * @param {String} code
     * @returns {boolean}
     */
    hasPermission: function (code) {
        return _.includes(app.screenCodes, code) || app.userInfo.user_type === 'SU';
    },

    checkScreenRight: function (currentScreen, isNotFromScreen, isReadOnly) {
        if (app.userInfo.user_type == 'SU' || (currentScreen && currentScreen.toLowerCase() == 'facility') || (currentScreen && currentScreen == 'Order_Studies') || (currentScreen && currentScreen == 'Order Summary')) {

            return true;
        }

        //    if (currentScreen == 'Order_Referring_Provider' || currentScreen == 'Order_ICD' || currentScreen == 'Order_Studies' || currentScreen == 'Order_additional') {
        //        currentScreen = 'Edit Order';
        //    }
        if (currentScreen == 'Owners' || currentScreen == 'Patient Information New') {
            currentScreen = 'Patient Information';
        }
        if (currentScreen == 'Patient Merge') {
            currentScreen = 'Patient Search';
        }

        var code = '';
        var hasPermission = false;
        if (app.enableEmergencyAccess) {
            hasPermission = true;
            return true;
        } else {
            if (app.permissions) {
                app.permissions.some(function (permission) {
                    if (permission.permission_name == currentScreen) {
                        code = permission.permission_code;
                        return true;
                    }
                });
            }
            if (commonjs.checkNotEmpty(code)) {
                hasPermission = app.screenCodes.some(function (screencode) {
                    return screencode == code;
                });
            }
            else {
                if (!isNotFromScreen) {
                    commonjs.processPostRender();
                    commonjs.showError('messages.errors.accessdenied');
                }
                return false;
            }
            if (!hasPermission) {
                if (!isNotFromScreen) {
                    commonjs.processPostRender();
                    commonjs.showError('messages.errors.accessdenied');
                }
                return false;
            }
            else {
                return true;
            }
        }
    },

    // SMH Bug #2604 - Method for showing/hiding worklist columns

    toggleGridlistColumns: function (tabPane) {
        // default to userSetting visibility
        var hide = app.hideWorklistIcons;

        // check to see if the user has manually changed visibility via the control
        if (typeof tabPane === 'undefined') {
            if ($('#data_container .tab-pane.active').length) {
                tabPane = $('#data_container .tab-pane.active');
            }
            else {
                if ($('div.ui-jqgrid > div.ui-jqgrid-view > div.ui-jqgrid-bdiv > div > table.ui-jqgrid-btable').closest('.tab-pane').length) {
                    tabPane = $('div.ui-jqgrid > div.ui-jqgrid-view > div.ui-jqgrid-bdiv > div > table.ui-jqgrid-btable').closest('.tab-pane');
                }
            }
        }

        var action = hide ? "hideCol" : "showCol",
            columns = commonjs.getWorklistIconColumns(tabPane);

        var i = columns.length;
        while (i--) {
            if (!columns[i].hidden) {
                $('div.ui-jqgrid > div.ui-jqgrid-view > div.ui-jqgrid-bdiv > div > table.ui-jqgrid-btable', tabPane).jqGrid(action, columns[i].name);
            }
        }
    },

    // SMH Bug #2604 - Method for getting all possibly visible columns for toggling
    getWorklistIconColumns: function (tabPane) {

        var gridParams = [],
            tabPaneId = 'global';

        if (typeof tabPane !== 'undefined') {
            tabPaneId = tabPane[0].id;
        }

        if (typeof commonjs.origGridParams[tabPaneId] === 'undefined') {
            commonjs.origGridParams[tabPaneId] = [];
            gridParams = $('div.ui-jqgrid > div.ui-jqgrid-view > div.ui-jqgrid-bdiv > div > table.ui-jqgrid-btable', tabPane).getGridParam("colModel");
            // Now to loop through the array and create new objects without reference.
            var j = gridParams.length;
            while (j--) {
                // Check to see if this column is an icon column (new property)
                if (gridParams[j].hasOwnProperty('isIconCol') && gridParams[j].isIconCol) {
                    var _name = gridParams[j].name,
                        _hidden = gridParams[j].hidden;

                    commonjs.origGridParams[tabPaneId].push({
                        'name': _name,
                        'hidden': _hidden
                    });
                }
            }
        }
        return commonjs.origGridParams[tabPaneId];
    },

    regExps: {
        regIgnoreEnableKeys: /ignoreEnableKeys/,
        regKeyDownIDs: /(?:txtFieldSeperator|ddlRModality|txtRBodyPart|txtRDescription|txtRMainBodyPart|txtRMainDescription)/,
        regMobile1: /(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino|android|ipad|playbook|silk/i,
        regMobile2: /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i
    },

    isMobileOrTablet: function () {
        var self = this;
        var check = false;
        (function (a) {
            if (self.regExps.regMobile1.test(a) || self.regExps.regMobile2.test(a.substr(0, 4))
            ) check = true
        })(navigator.userAgent || navigator.vendor || window.opera);
        return check;
    },

    activateInputModifiers: function (isFrom, element) {
        if (app.modifiers_in_order) {
            var self = this;
            var modifier = element.getAttribute('data-type');
            var id = element.getAttribute('data-value');
            if (isFrom == 'M')
                var modifierElement = 'txtModifier';
            else
                var modifierElement = 'ddlPointer';

            var dataType = isFrom; // M -- modifier , P -- Pointer
            if (($(element).val() == "") || $(element).hasClass('invalidModifier')) {
                if (modifier == (dataType + "1") && $('#' + modifierElement + '2_' + id).val() == "" && $('#' + modifierElement + '3_' + id).val() == "" && $('#' + modifierElement + '4_' + id).val() == "") {
                    $('#' + modifierElement + '2_' + id).prop('disabled', true);
                    $('#' + modifierElement + '3_' + id).prop('disabled', true);
                    $('#' + modifierElement + '4_' + id).prop('disabled', true);
                }
                if (modifier == (dataType + "2") && $('#' + modifierElement + '3_' + id).val() == "" && $('#' + modifierElement + '4_' + id).val() == "") {
                    $('#' + modifierElement + '3_' + id).prop('disabled', true);
                    if (modifier == (dataType + "2") && $('#' + modifierElement + '1_' + id).val() == "")
                        $('#' + modifierElement + '2_' + id).prop('disabled', true);
                }
                if (modifier == (dataType + "3") && $('#' + modifierElement + '4_' + id).val() == "") {
                    $('#' + modifierElement + '4_' + id).prop('disabled', true);
                    if (modifier == (dataType + "3") && $('#' + modifierElement + '2_' + id).val() == "")
                        $('#' + modifierElement + '3_' + id).prop('disabled', true);
                    if (modifier == (dataType + "3") && $('#' + modifierElement + '1_' + id).val() == "" && $('#' + modifierElement + '2_' + id).val() == "")
                        $('#' + modifierElement + '2_' + id).prop('disabled', true);
                }
                if (modifier == (dataType + "4") && $('#' + modifierElement + '3_' + id).val() == "") {
                    $('#' + modifierElement + '4_' + id).prop('disabled', true);
                    if (modifier == (dataType + "4") && $('#' + modifierElement + '2_' + id).val() == "")
                        $('#' + modifierElement + '3_' + id).prop('disabled', true);
                    if (modifier == (dataType + "4") && $('#' + modifierElement + '1_' + id).val() == "" && $('#' + modifierElement + '2_' + id).val() == "")
                        $('#' + modifierElement + '2_' + id).prop('disabled', true);
                }
            }
            else {
                self.enableModifiers(element, modifier, false, isFrom, id, modifierElement, dataType);
            }
        }
    },
    enableModifiers: function (element, modifier, enable, isFrom, id, modifierElement, dataType) {
        if (modifier == (dataType + "1"))
            $('#' + modifierElement + '2_' + id).prop('disabled', enable);
        if (modifier == (dataType + "2")) {
            if ($('#' + modifierElement + '1_' + id).val() == "" && $('#' + modifierElement + '2_' + id).val() != "")
                $('#' + modifierElement + '2_' + id).prop('disabled', enable);
            $('#' + modifierElement + '3_' + id).prop('disabled', enable);
        }
        if (modifier == (dataType + "3")) {
            if ($('#' + modifierElement + '2_' + id).val() == "" && $('#' + modifierElement + '3_' + id).val() != "")
                $('#' + modifierElement + '3_' + id).prop('disabled', enable);
            $('#' + modifierElement + '4_' + id).prop('disabled', enable);
        }
        if (modifier == (dataType + "4"))
            $('#' + modifierElement + '4_' + id).prop('disabled', enable);
    },
    enableModifiersOnbind: function (isFrom) {
        var self = this;
        var _className = isFrom == 'P' ? 'diagCodes' : 'inputModifiers';
        $('.' + _className).each(function (index, val) {
            self.activateInputModifiers(isFrom, this);
        });
    },
    validateModifiers: function (isFrom, id, cptDetails) {
        var modifierElement = isFrom == 'chargeandpayment' ? 'ddlModifier' : 'txtModifier';
        var modifier1 = isFrom == 'chargeandpayment' ? cptDetails.modifiers1 : cptDetails.m1;
        var modifier2 = isFrom == 'chargeandpayment' ? cptDetails.modifiers2 : cptDetails.m2;
        var modifier3 = isFrom == 'chargeandpayment' ? cptDetails.modifiers3 : cptDetails.m3;
        var modifier4 = isFrom == 'chargeandpayment' ? cptDetails.modifiers4 : cptDetails.m4;
        if (app.modifiers_in_order) {
            if (modifier1 == "" && (modifier2 != "" || modifier3 != "" || modifier4 != "")) {
                commonjs.showWarning('Please enter modifier1');
                $('#' + modifierElement + '1_' + id).focus();
                return true;
            }
            if (modifier2 == "" && (modifier3 != "" || modifier4 != "")) {
                commonjs.showWarning('Please enter modifier2');
                $('#' + modifierElement + '2_' + id).focus();
                return true;
            }
            if (modifier3 == "" && (modifier4 != "")) {
                commonjs.showWarning('Please enter modifier3');
                $('#' + modifierElement + '3_' + id).focus();
                return true;
            }
        }
    },
    bindModifiers: function (isFrom, id, orderID, index, callback) {
        var self = this;
        var modifierElement = isFrom == 'chargeandpayment' ? 'ddlModifier' : 'txtModifier';
        $.ajax({
            url: '/getFeeModifier',
            method: 'GET',
            data: {
                cpt_code_id: id,
                fee_schedule_id: 1,
                isFrom: isFrom,
                order_id: orderID,
                company_id: app.companyID
            },
            success: function (response) {
                var fee_info = response.result && response.result.rows.length && response.result.rows[0] ? commonjs.hstoreParse(response.result.rows[0].fee_info) : '';
                $('#' + modifierElement + '1_' + index).val(fee_info && fee_info.m1 ? fee_info.m1 : '');
                $('#' + modifierElement + '2_' + index).val(fee_info && fee_info.m2 ? fee_info.m2 : '');
                $('#' + modifierElement + '3_' + index).val(fee_info && fee_info.m3 ? fee_info.m3 : '');
                $('#' + modifierElement + '4_' + index).val(fee_info && fee_info.m4 ? fee_info.m4 : '');
                if (callback)
                    callback(true);
            }
        });
    },

    getModalityOptions: function (modality) {
        if (prefetch.viewerConfig && prefetch.viewerConfig.viewer_modality_options) {
            if (prefetch.viewerConfig.viewer_modality_options[modality]) return prefetch.viewerConfig.viewer_modality_options[modality];
            var splitedModality = modality ? modality.split(',') : [];
            var altModality = (splitedModality && splitedModality.length > 1) ? splitedModality[0].trim() : null;
            if (altModality && prefetch.viewerConfig && prefetch.viewerConfig.viewer_modality_options && prefetch.viewerConfig.viewer_modality_options[altModality]) return prefetch.viewerConfig.viewer_modality_options[altModality];
            else if (prefetch.viewerConfig && prefetch.viewerConfig.viewer_modality_options && prefetch.viewerConfig.viewer_modality_options['all']) return prefetch.viewerConfig.viewer_modality_options['all'];
        }
        return null;
    },

    /**
     * Given an array of modality ids, return the modality of the highest priority
     *
     * @param {Array} modalityIds
     * @returns {Object}
     */
    getHighestPriorityModality: function (modalityIds) {
        if (!modalityIds) {
            return {};
        }

        return app.modalities
            .filter(function (modality) { return _.includes(modalityIds, modality.id) })
            .sort(function (a, b) { return b.priority > a.priority })[0];
    },

    /**
     * Given a modality id, return the modality code if it exists
     *
     * @param {Number} id
     * @returns {String}
     */
    getModalityCodeFromId: function (id) {
        var modality = _.find(app.modalities, { 'id': id }) || '';
        return modality.modality_code || ''
    },

    getlayoutFormat: function (modality) {
        var options = this.getModalityOptions(modality);
        return (options && options.layout && options.layout.screen_layout) || '2*2';
    },

    isIE: function () {
        var ua = window.navigator.userAgent;

        return ((ua.indexOf('MSIE ') > -1) || (ua.indexOf('Trident/') > -1) || (ua.indexOf('Edge/') > -1));
    },

    /**
     * A wrapper around window.postMessage API.
     * This is an IE Hack per: http://stackoverflow.com/a/25783377.
     * postmessage API doesn't work reliably in IE without a workaround. In this case, wrapping it in setTimeout
     *
     * @param args
     * @param route
     */
    postMessageIE: function (args, route) {
        if (this.isIE()) {
            setTimeout(function () {
                window.postMessage(args, route);
            }, 1);
        } else {
            window.postMessage(args, route);
        }
    },

    /**
     * Formats an array of json objects for use as a value for JqGrid dropdown filters
     * @param {Object} options
     *      @param {Object Array}   arrayOfObjects      The data used to construct the filter                                   Required
     *      @param {String}         searchKey           The property used to search on when a selection is made                 Defaults as textDescription
     *      @param {String}         textDescription     The property containing the text that the user sees in the dropdown     Defaults as searchKey
     *      @param {Boolean}        sort                Says whether you want to sort the textDescription in ascending order    Default false
     *      @param {Boolean}        prependKey          Formats the text description to be ... searchKey (textDescription)      Default false
     */
    buildGridSelectFilter: function (options) {
        var o = options;
        var filter = ":All;";
        if (o && o.arrayOfObjects && o.arrayOfObjects.length > 0) {
            // Set defaults
            o.searchKey = o.searchKey || o.textDescription;
            o.textDescription = o.textDescription || o.searchKey;
            o.sort = (o.sort && (o.sort === true || o.sort.toLowerCase() == "true")) ? true : false;
            o.prependKey = (o.prependKey && (o.prependKey === true || o.prependKey.toLowerCase() == "true")) ? true : false;

            if (o.searchKey && o.textDescription) {
                // Sort
                if (o.sort) {
                    o.arrayOfObjects.sort(function (a, b) {
                        if (o.prependKey) {
                            var atxt = a[o.searchKey].toLowerCase() + " (" + a[o.textDescription].toLowerCase() + ")";
                            var btxt = b[o.searchKey].toLowerCase() + " (" + b[o.textDescription].toLowerCase() + ")";
                        }
                        else {
                            var atxt = a[o.textDescription].toLowerCase();
                            var btxt = b[o.textDescription].toLowerCase();
                        }

                        if (atxt < btxt) return -1;
                        if (atxt > btxt) return 1;
                        return 0;
                    });
                }

                // Construct filter
                for (var i = 0; i < o.arrayOfObjects.length; i++) {
                    if (o.prependKey) {
                        filter += o.arrayOfObjects[i][o.searchKey].toString() + ":" + o.arrayOfObjects[i][o.searchKey].toString() + " (" + o.arrayOfObjects[i][o.textDescription] + ");";
                    }
                    else {
                        filter += o.arrayOfObjects[i][o.searchKey].toString() + ":" + o.arrayOfObjects[i][o.textDescription] + ";";
                    }
                }
            }
        }
        return filter.slice(0, -1);
    },

    // Runs an array of functions in order without proceeding to the next until callback is called
    runSeries: function (fnArr, complete) {
        complete = complete || function () { };
        var runFunc = function (fn, arr, callback) {
            if (arr && arr.length > 0) {
                fn(function () { runFunc(arr.shift(), arr, callback) });
            }
            else {
                if (fn) {
                    fn(callback);
                }
            }
        }

        if (fnArr.length) {
            runFunc(fnArr.shift(), fnArr, complete);
        }
        else {
            complete();
        }
    },

    /**
     * returns facility array with inactive facilities removed - specifically for use in drop downs
     * @param {boolean} showStudiesFlag - if true returns facilities where is_active true and show_studies is enabled
    */
    getActiveFacilities: function (showStudiesFlag) {
        facilities = app.userInfo.user_type === "SU"
            ? app.facilities
            : app.userFacilities;
        if (showStudiesFlag) {
            return facilities.reduce(function (facilitiesAcc, facility) {
                var parsedFacility = Object.assign({}, facility, { facility_info: commonjs.hstoreParse(facility.facility_info) });
                if (facility.is_active || parsedFacility.facility_info.show_studies === "true") facilitiesAcc.push(facility);
                return facilitiesAcc;
            }, []);
        } else {
            return facilities.filter(function (fac) {
                return fac.is_active
            });
        }
    },

    // confineTabbing - Tabbing is confined to the specified element(s) - useful for modals
    confineTabbing: function (el) {
        var inputs = $(el).find('select, input, textarea, button, a').filter(':visible');
        var firstInput = inputs.first();
        var lastInput = inputs.last();

        // Focus first input
        firstInput.focus();

        // Redirect last tab to first input
        lastInput.on('keydown', function (e) {
            if (e.which === 9 && !e.shiftKey) {
                e.preventDefault();
                firstInput.focus();
            }
        });

        // Redirect first shift+tab to last input
        firstInput.on('keydown', function (e) {
            if (e.which === 9 && e.shiftKey) {
                e.preventDefault();
                lastInput.focus();
            }
        });
    },

    /**
     * Helper method for jqgrid dropdowns that returns a string that can be set to the searchoptions.value object
     *
     * ex:
     * var modalityCodes = commonjs.makeValue(app.modalities, ":All;", "modality_code", "modality_code");
     * console.log('modalityCodes');
     * ":All;BD:BD;CT:CT;DR:DR;dsd:dsd;MG:MG;MR:MR;NM:NM;OT:OT;RF:RF;SC:SC;US:US;XA:XA"
     *
     */
    makeValue: function (array, val, propOne, propTwo) {
        var Collection = Backbone.Collection.extend({
            model: Backbone.Model.extend({})
        });
        array = new Collection(array).toJSON();
        var i = 0;
        var count = array.length;
        for (; i < count; i++) {
            var id = array[i][propOne || 'id'];
            var text = array[i][propTwo || 'text'];

            if (i == array.length - 1) {
                val += id + ":" + text;
            }
            else {
                val += id + ":" + text + ";";
            }
        }

        return val;
    },

    /**
     * Bind date range picker to grid inputs based on the given column
     *
     * @param {Array} columns ['study_dt']
     * @param {String} tableSelector '#gview_tblPacsExamsList' + ' ' + '#gs_';
     * @param {Object} gridObj
     */
    bindDateRangeOnSearchBox: function (columns, tableSelector, gridObj) {
        var columnsToBind = columns;
        var drpOptions = { locale: { format: "L" } };
        var currentFilter = {};
        _.each(columnsToBind, function (col) {
            var colSelector = tableSelector + col;
            var colElement = $(colSelector);
            if (!colElement.length) {
                return; // skips current iteration only !
            }
            commonjs.bindDateRangePicker(colElement, drpOptions, "past", function (start, end, format) {
                if (start && end) {
                    currentFilter.dateString = start.format('LL') + ' - ' + end.format('LL');
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
            colElement.on("apply.daterangepicker", function () {
                gridObj.refresh();
            });
            colElement.on("cancel.daterangepicker", function () {
                gridObj.refresh();
            });
        });
    },

    getServiceTypes: function (callback) {
        var self = this;

        if (this.serviceFacilities && this.serviceFacilities.eligibility_service_types) {
            return callback(null, this.serviceFacilities);
        }

        $.ajax({
            type: 'GET',
            url: '/exa_modules/billing/claims/claim/service_facilities',
            success: function (model, response) {
                self.serviceFacilities = model;
                callback(null, model);
            },
            error: function (err, response) {
                commonjs.handleXhrError(err, response);
                callback(err);
            }
        });
    },

    /**
     * Courtesy of:
     * http://stackoverflow.com/a/4819886/2780033
     * @returns {boolean}
     */
    isTouchDevice: function () {
        var checkTouch = function () {
            return (
                document.createEvent('TouchEvent') && (
                    'ontouchstart' in document.documentElement ||
                    'ontouchstart' in window
                ) ||
                navigator.maxTouchPoints > 0 ||
                navigator.msMaxTouchPoints > 0
            );
        };

        try {
            return checkTouch();
        }
        catch (e) {
            return false;
        }
    },

    initHotkeys: function (events) {
        if (Object.keys(app.hotkeys).length && Object.keys(events).length) {
            for (var key in events) {
                this.initHotkey(key, events[key]);
            }
        }
    },

    initHotkey: function (eventName, handler) {
        if (app.hotkeys[eventName]) {
            var shortcut = app.hotkeys[eventName];
            var handlerFn = handler;

            if (typeof handler !== 'function') {
                handlerFn = (function () {
                    (function (id) {
                        if ($(id).length) {
                            $(id).click();
                        }
                    })(handler)
                });
            }

            //$(document).on('keydown', null, shortcut, handlerFn);
        }
    }
};


var siteLayouts = {
    facility: 'Facility',
    customer: 'Customer',
    patient: 'Patient',
    report: 'Report',
    dashboard: 'Dashboard'
};


var facilityModules = {
    setup: 'Setup',
    patient: 'Patient',
    schedule: 'Schedule Book',
    home: 'Home',
    report: 'Report',
    billing: 'billing',
    dashboard: 'Dashboard',
    portalRegUsers: 'Portal Registered Users',
    //cardiology: 'Cardiology', //duplicate key, see below
    billingScreen: {
        payments: 'Payments',
        refund: 'Refund',
        fileInsurance: 'File Insurance',
        cob: "Coordination of Benefits",
        radOrders: 'Rad Orders',
        eob: "Explanation of Benefits",
        eobProcessedClaims: "EOB Claims Process",
        eraInbox: 'ERA Inbox'
    },
    reportScreens: {
        transcriptionStudyCount: 'Transcription Study Count',
        'reportfilter': 'Report Filter',
        'expCompSt': 'Export Completed Studies',
        expPeerReview: 'Export Peer Review',
        'meaningfulUseDashboard': 'Meaningful Use Dashboard',
        'weightScreening': 'Weight Assessment',
        'smokingHistory': 'Smoking History',
        'vaccinationReport': 'Vaccination Report',
        'bloodPressure': 'Blood Pressure',
        'provider': 'Report Provider',
        agedarsummary: 'Aged AR Summary',
        agedardetails: 'Aged AR Details',
        dailychargereport: 'Daily Charge Report',
        procedureanalysisbyinsurance: 'Procedure Analysis By Insurance',
        'appointmentListDateRange': 'Appointment List Date Range',
        facilityinvoices: 'Facility Invoices',
        payerMix: 'Payer Mix',
        referringprovidersummary: 'Referring Provider Summary',
        chargedetails: 'Claim Activity',
        facilitysummary: 'Facility Summary',
        insurancebalanceaging: 'Insurance Balance Aging',
        patientsByInsurance: 'Patients By Insurance Company',
        'CMSQualityReport': 'CMS Quality Reporting',
        'profitAnalysis': 'Profit Analysis',
        'summary': 'Summary',
        paymentDetails: 'Payment Details',
        payerDetails: 'Payer Details',
        utility: 'Utility',
        markRepActivities: 'Marketing Rep Activities',
        modalitySummary: 'Modality Summary',
        referringProviderCount: 'Referring Provider Count',
        creditBalanceEncounters: 'Credit Balance Encounters',
        procedureCount: 'Procedure Count',
        diagnosisCount: 'Diagnosis Count',
        refprovider: 'Referring Provider Summary',
        paymentsByinscompany: 'Payments By Ins Company',
        patientsInscompany: 'Patients By Insurance Company',
        monthEndPaymentSummary: 'Month End Payment Summary',
        monthEndPaymentDetails: 'Month End Payment Details',
        svcPaymentSummary: 'Date of Service Payment Summary',
        cmsReport: 'CMS Quality Reporting',
        unfinishedStudies: 'Unfinished Studies',
        schedulerActivity: 'Scheduler Activity',
        referralsVariance: 'Referrals Variance',
        studiesBreakdown: 'Studies Breakdown',
        studiesByModality: 'Studies By Modality',
        studiesByModalityRoom: 'Studies By Modality Room',
        claimActivity: 'Claim Activity',
        feesByFacilityAndModality: 'Fees by Facility and Modality',
        feesByRadiologistAndModality: 'Fees by Radiologist and Modality',
        patientsWorksheet: 'Patients Worksheet',
        charges: 'Charges',
        paymentReport: 'Payment',
        calculatedTAT: 'Turnaround Time (TAT) - Calculated',
        RVU: 'Relative Value Units',
        referringPhysicianStudyCount: 'Referring Physician Study Count',
        completedSchedules: 'Completed Schedules',
        patientStatement: 'Patient Statement',
        patientActivityStatement: 'Patient Statement',
        claimTransaction: 'Claim Transaction',
        insuranceVsLOP: 'Insurance VS LOP',
        claimInquiry: 'Claim Inquiry',
        monthlyGoals: 'Monthly/Daily Study Goals',
        statTracking: 'STAT Tracking',
        monthlyRecap: 'Monthly Recap',
        readingProviderFees: 'Reading Provider Fees',
        transactionSummary: 'Transaction Summary',
        agedARDetail: 'Aged AR Detail',
        paymentPDF: 'Payments Received'
    }
};

Array.prototype.move = function (from, to) {
    this.splice(to, 0, this.splice(from, 1)[0]);
};

if (typeof String.prototype.startsWith != 'function') {
    String.prototype.startsWith = function (str) {
        return this.slice(0, str.length) == str;
    }
}

(function () {
    // Union of Chrome, Firefox, IE, Opera, and Safari console methods
    var methods = ["assert", "cd", "clear", "count", "countReset",
        "debug", "dir", "dirxml", "error", "exception", "group", "groupCollapsed",
        "groupEnd", "info", "log", "markTimeline", "profile", "profileEnd",
        "select", "table", "time", "timeEnd", "timeStamp", "timeline",
        "timelineEnd", "trace", "warn"];
    var length = methods.length;
    var console = (window.console = window.console || {});
    var method;
    var noop = function () { };
    while (length--) {
        method = methods[length];
        // define undefined methods as noops to prevent errors
        if (!console[method])
            console[method] = noop;
    }
})();

function CreateCheckBox(label, id, i18nLabel) {
    return $('<div>').addClass('form-check form-check-inline').append($('<input>').attr({
        type: 'checkbox',
        id: id,
        name: id,
        value: label,
        checked: false
    }).addClass('form-check-input')).append($('<label>').attr({ for: id, 'i18n': i18nLabel, 'value': label }).addClass('form-check-label').text(label));
}

function removeIframeHeader() {
    $('iframe#site_modal_iframe_container, iframe#ifSettings').contents().find('head').append('<style>header.header{display:none;}nav.sub-top-nav, nav#subSetupMenu {display: none;}</style>');
}

// $(document).ajaxComplete(function () {
//     commonjs.hideLoading();
// });

$(document).ajaxSuccess(function (event, xhr, settings) {
    if (settings.url.indexOf('billing/setup') > -1 && ['POST', 'PUT', 'DELETE'].indexOf(settings.type) > -1) {
        layout.setupDataUpdated = true;
    }
});
