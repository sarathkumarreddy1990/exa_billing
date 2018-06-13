
// this hack is necessary because
//  1) moment-timezone cannot be used as global var loaded from main.js
//  2) common.js is not a regular module
// so, we redefine moment here to be aliased as moment-timezone
var moment;
require.config({
    waitSeconds: 0,
    paths: {
        'moment': '../moment/min/moment.min',
        'moment-timezone': '../moment-timezone/builds/moment-timezone-with-data.min'
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
    localCacheApi: 'https://exalocal.viztek.net:33356',
    localCacheWadoApi: 'https://exalocal.viztek.net:33355',
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
    setupCityStateZipInputs: function setupCityStateZipInputs () {
        var $getCityStateByZipContainer = $('.get-city-state-by-zip');
        $getCityStateByZipContainer.each(function ( index ) {
            var $this = $(this);
            var $cityInput = $this.find('.city-input');
            var $stateInput = $this.find('.state-input');
            var $zipInput = $this.find('.zip-input');

            function handleChangeZip ( event ) {
                var zip = ($zipInput.val() || '').trim();

                if ( zip > 0 ) {
                    $.ajax({
                        'url': '/getCityState',
                        'data': {
                            'zip': zip
                        },
                        success: function ( response ) {
                            var result = response.result;
                            if ( String(~~result.zip) === zip && result.city && result.state ) {
                                $cityInput.val(result.city);
                                $stateInput.val(result.state);
                            }
                        },
                        error: function ( error ) {
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
        $getZipByCityStateContainer.each(function ( index ) {
            var $this = $(this);
            var $cityInput = $this.find('.city-input');
            var $stateInput = $this.find('.state-input');
            var $zipInput = $this.find('.zip-input');
            var $zipListContainer = $this.find('.zip-list-container');
            var $zipList = $zipListContainer.find('.zip-list');
            var $applyZipButton = $zipListContainer.find('.apply-zip');

            function handleChangeCityState ( event ) {
                var city = ($cityInput.val() || '').trim().toUpperCase();
                var state = ($stateInput.val() || '').trim().toUpperCase();

                if ( city && state ) {
                    $.ajax({
                        'url': '/getZip',
                        'data': {
                            'city': city,
                            'state': state
                        },
                        success: function ( response ) {
                            var result = response.result;
                            $zipList.empty();
                            var currentZip = ($zipInput.val() || '').trim();

                            if ( result.zip && result.zip.length > 0 && result.zip.indexOf(currentZip) === -1 && result.city === city && result.state === state ) {
                                var options = result.zip.sort().reduce(function ( list, zip ) {
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
                        error: function ( error ) {
                            console.error('Error getting city/state using zip ' + zip, error);
                        }
                    });
                }
            }

            function handleApplyZip ( event ) {
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

    getDates: function ( data ) {
        /*
         if > 13 characters then it's a range

         13 comes from:
            4 - YYYY
            2 - MM
            2 - DD
            2 - (delimiters between those three)
            3 - " - " splitter for range
        */
        if ( data.length > 13 ) {
            var dateArray = data.split(/\s-\s/);
            if ( dateArray.length > 1 ) {
                var date1 = moment(dateArray[ 0 ], 'L').locale('en').format('YYYY-MM-DD');
                var date2 = moment(dateArray[ 1 ], 'L').locale('en').format('YYYY-MM-DD');
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
        var root = window.parent || window;
        var cjs = root.commonjs;
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
                filter.customGridTable.jqGrid('GridUnload');
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

    monitorOrders: [
        {'value': 'activityLog', 'text': 'Activity Log', 'i18n': 'menuTitles.patient.activityLog'},
        {'value': 'additionalInfo', 'text': 'Additional Info', 'i18n': 'menuTitles.order.additionalInfo'},
        {'value': 'allergies', 'text': 'Allergies', 'i18n': 'menuTitles.patient.allergies'},
        {'value': 'approvedReport', 'text': 'Approved Report', 'i18n': 'menuTitles.order.approvedReport'},
        {'value': 'ccros', 'text': 'CCRos', 'i18n': 'menuTitles.order.ccros'},
        {'value': 'chargePayments', 'text': 'Charge/Payments', 'i18n': 'menuTitles.order.chargePayments'},
        {'value': 'customForms', 'text': 'Custom Forms', 'i18n': 'menuTitles.setup.customForms'},
        {'value': 'documents', 'text': 'Documents', 'i18n': 'menuTitles.patient.documents'},
        {'value': 'educationMaterials', 'text': 'Education Materials', 'i18n': 'menuTitles.order.educationMaterial'},
        {'value': 'examInfo', 'text': 'Exam Info', 'i18n': 'menuTitles.order.examInfo'},
        {'value': 'followUps', 'text': 'Follow Ups', 'i18n': 'menuTitles.patient.followUps'},
        {'value': 'icdCodes', 'text': 'ICD Codes', 'i18n': 'menuTitles.order.ICDCodes'},
        {'value': 'ikonopedia', 'text': 'Ikonopedia', 'i18n': 'menuTitles.order.ikonopedia'},
        {'value': 'penrad', 'text': 'PenRad', 'i18n': 'menuTitles.order.penRad'},
        {'value': 'ps360', 'text': 'PS360', 'i18n': 'menuTitles.order.ps360'},
        {'value': 'immunizations', 'text': 'Immunizations', 'i18n': 'menuTitles.patient.immunizations'},
        {'value': 'insuranceProfile', 'text': 'Insurance Profile', 'i18n': 'menuTitles.order.insuranceProfile'},
        {'value': 'labOrders', 'text': 'Lab Orders', 'i18n': 'menuTitles.patient.labOrders'},
        {'value': 'medicalHistory', 'text': 'Medical History', 'i18n': 'menuTitles.order.medicalHistory'},
        {'value': 'medications', 'text': 'Medications', 'i18n': 'menuTitles.order.medications'},
        {'value': 'notes', 'text': 'Notes', 'i18n': 'menuTitles.order.notes'},
        {'value': 'patientAlerts', 'text': 'Patient Alerts', 'i18n': 'menuTitles.order.patientAlerts'},
        {'value': 'patientdemographics', 'text': 'Patient Demographics', 'i18n': 'setup.muValidation.patientDemographics'},
        {'value': 'patientinfo', 'text': 'Patient Info', 'i18n': 'menuTitles.patient.patientInfo'},
        {'value': 'prescriptions', 'text': 'Prescriptions', 'i18n': 'menuTitles.patient.prescriptions'},
        {'value': 'priorStudies', 'text': 'Prior Studies', 'i18n': 'menuTitles.order.priorStudies'},
        {'value': 'problems', 'text': 'Problems', 'i18n': 'menuTitles.order.problems'},
        {'value': 'referrals', 'text': 'Referrals', 'i18n': 'menuTitles.order.referrals'},
        {'value': 'referringProvider', 'text': 'Referring Provider', 'i18n': 'menuTitles.order.referringProvider'},
        {'value': 'summary', 'text': 'Summary', 'i18n': 'menuTitles.order.summary'},
        {'value': 'transcription', 'text': 'Transcription', 'i18n': 'menuTitles.order.transcription'},
        {'value': 'vitalSigns', 'text': 'Vital Signs', 'i18n': 'menuTitles.order.vitalSigns'}
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

    jsonDicomSOP: {
        "1.2.840.10008.1.1": "Verification SOP Class",
        "1.2.840.10008.1.20.1": "Storage Commitment Push Model SOP Class",
        "1.2.840.10008.1.20.2": "Storage Commitment Pull Model SOP Class",
        "1.2.840.10008.1.3.10": "Media Storage Directory Storage",
        "1.2.840.10008.1.40": "Procedural Event Logging SOP Class",
        "1.2.840.10008.1.9": "Basic Study Content Notification SOP Class",

        "1.2.840.10008.3.1.2.1.1": "Detached Patient Management SOP Class",
        "1.2.840.10008.3.1.2.1.4": "Detached Patient Management Meta SOP Class",
        "1.2.840.10008.3.1.2.2.1": "Detached Visit Management SOP Class	",
        "1.2.840.10008.3.1.2.3.1": "Detached Study Management SOP Class	",
        "1.2.840.10008.3.1.2.3.2": "Study Componenet Management SOP Class	",
        "1.2.840.10008.3.1.2.3.3": "Modality Performed Procedure Step SOP Class",
        "1.2.840.10008.3.1.2.3.4": "Modality Performed Procedure Step Retrieve SOP Class",
        "1.2.840.10008.3.1.2.3.5": "Modality Performed Procedure Step Notification SOP Class",
        "1.2.840.10008.3.1.2.5.1": "Detached Results Management SOP Class",
        "1.2.840.10008.3.1.2.5.4": "Detached Results Management Meta SOP Class",
        "1.2.840.10008.3.1.2.5.5": "Detached Study Management Meta SOP Class",
        "1.2.840.10008.3.1.2.6.1": "Detached Interpretation Management SOP Class",

        "1.2.840.10008.4.2": "Storage Service Class",

        "1.2.840.10008.5.1.1.1": "Basic Film Session SOP Class",
        "1.2.840.10008.5.1.1.14": "Print Job SOP Class",
        "1.2.840.10008.5.1.1.15": "Basic Annotation Box SOP Class",
        "1.2.840.10008.5.1.1.16": "Printer SOP Class",
        "1.2.840.10008.5.1.1.16.376": "Printer Configuration Retrieval SOP Class",
        "1.2.840.10008.5.1.1.18": "	Basic Color Print Management Meta SOP Class",
        "1.2.840.10008.5.1.1.18.1": "Referenced Color Print Management Meta SOP Class",
        "1.2.840.10008.5.1.1.2": "Basic Film Box SOP Class",
        "1.2.840.10008.5.1.1.22": "VOI LUT Box SOP Class",
        "1.2.840.10008.5.1.1.23": "Presentation LUT SOP Class",
        "1.2.840.10008.5.1.1.24": "Image Overlay Box SOP Class	",
        "1.2.840.10008.5.1.1.24.1": "Basic Print Image Overlay Box SOP Class	",
        "1.2.840.10008.5.1.1.26": "Print Queue Management SOP Classs	",
        "1.2.840.10008.5.1.1.27": "Stored Print Storage SOP Class	",
        "1.2.840.10008.5.1.1.29": "Hardcopy Grayscale Image Storage SOP Class	",
        "1.2.840.10008.5.1.1.30": "Hardcopy Color Image Storage SOP Class	",
        "1.2.840.10008.5.1.1.31": "Pull Print Request SOP Class",
        "1.2.840.10008.5.1.1.32": "Pull Stored Print Management Meta SOP Class	",
        "1.2.840.10008.5.1.1.33": "Media Creation Management SOP Class UID",
        "1.2.840.10008.5.1.1.4": "Basic Grayscale Image Box SOP Class",
        "1.2.840.10008.5.1.1.4.1": "Basic Color Image Box SOP Class",
        "1.2.840.10008.5.1.1.4.2": "Referenced Image Box SOP Class	",
        "1.2.840.10008.5.1.1.9": "Basic Grayscale Print Management Meta SOP Class",
        "1.2.840.10008.5.1.1.9.1": "Referenced Grayscale Print Management Meta SOP Class",

        "1.2.840.10008.5.1.4.1.1.1": "CR Image Storage",
        "1.2.840.10008.5.1.4.1.1.1.1": "Digital X-Ray Image Storage – for Presentation",
        "1.2.840.10008.5.1.4.1.1.1.1.1": "Digital X-Ray Image Storage – for Processing",
        "1.2.840.10008.5.1.4.1.1.1.2": "Digital Mammography X-Ray Image Storage – for Presentation",
        "1.2.840.10008.5.1.4.1.1.1.2.1": "Digital Mammography X-Ray Image Storage – for Processing",
        "1.2.840.10008.5.1.4.1.1.1.3": "Digital Intra – oral X-Ray Image Storage – for Presentation",
        "1.2.840.10008.5.1.4.1.1.1.3.1": "Digital Intra – oral X-Ray Image Storage – for Processing",
        "1.2.840.10008.5.1.4.1.1.10": "Standalone Modality LUT Storage	",
        "1.2.840.10008.5.1.4.1.1.104.1": "Encapsulated PDF Storage",
        "1.2.840.10008.5.1.4.1.1.11": "Standalone VOI LUT Storage	",
        "1.2.840.10008.5.1.4.1.1.11.1": "Grayscale Softcopy Presentation State Storage SOP Class",
        "1.2.840.10008.5.1.4.1.1.11.2": "Color Softcopy Presentation State Storage SOP Class",
        "1.2.840.10008.5.1.4.1.1.11.3": "Pseudocolor Softcopy Presentation Stage Storage SOP Class",
        "1.2.840.10008.5.1.4.1.1.11.4": "Blending Softcopy Presentation State Storage SOP Class",
        "1.2.840.10008.5.1.4.1.1.12.1": "X-Ray Angiographic Image Storage",
        "1.2.840.10008.5.1.4.1.1.12.1.1": "Enhanced XA Image Storage",
        "1.2.840.10008.5.1.4.1.1.12.2": "X-Ray Radiofluoroscopic Image Storage",
        "1.2.840.10008.5.1.4.1.1.12.2.1": "Enhanced XRF Image Storage",
        "1.2.840.10008.5.1.4.1.1.12.3": "X-Ray Angiographic Bi-plane Image Storage",
        "1.2.840.10008.5.1.4.1.1.128": "Positron Emission Tomography Curve Storage",
        "1.2.840.10008.5.1.4.1.1.129": "Standalone Positron Emission Tomography Curve Storage",
        "1.2.840.10008.5.1.4.1.1.2": "CT Image Storage",
        "1.2.840.10008.5.1.4.1.1.2.1": "Enhanced CT Image Storage",
        "1.2.840.10008.5.1.4.1.1.20": "NM Image Storage",
        "1.2.840.10008.5.1.4.1.1.3": "Ultrasound Multiframe Image Storage	",
        "1.2.840.10008.5.1.4.1.1.3.1": "Ultrasound Multiframe Image Storage",
        "1.2.840.10008.5.1.4.1.1.4": "MR Image Storage",
        "1.2.840.10008.5.1.4.1.1.4.1": "Enhanced MR Image Storage",
        "1.2.840.10008.5.1.4.1.1.4.2": "MR Spectroscopy Storage",

        "1.2.840.10008.5.1.4.1.1.481.1": "Radiation Therapy Image Storage",
        "1.2.840.10008.5.1.4.1.1.481.2": "Radiation Therapy Dose Storage",
        "1.2.840.10008.5.1.4.1.1.481.3": "Radiation Therapy Structure Set Storage",
        "1.2.840.10008.5.1.4.1.1.481.4": "Radiation Therapy Beams Treatment Record Storage",
        "1.2.840.10008.5.1.4.1.1.481.5": "Radiation Therapy Plan Storage",
        "1.2.840.10008.5.1.4.1.1.481.6": "Radiation Therapy Brachy Treatment Record Storage",
        "1.2.840.10008.5.1.4.1.1.481.7": "Radiation Therapy Treatment Summary Record Storage",
        "1.2.840.10008.5.1.4.1.1.481.8": "Radiation Therapy Ion Plan Storage",
        "1.2.840.10008.5.1.4.1.1.481.9": "Radiation Therapy Ion Beams Treatment Record Storage",

        "1.2.840.10008.5.1.4.1.1.5": "NM Image Storage",

        "1.2.840.10008.5.1.4.1.1.6": "Ultrasound Image Storage",
        "1.2.840.10008.5.1.4.1.1.6.1": "Ultrasound Image Storage",
        "1.2.840.10008.5.1.4.1.1.66": "Raw Data Storage",
        "1.2.840.10008.5.1.4.1.1.66.1": "Spatial Registration Storage",
        "1.2.840.10008.5.1.4.1.1.66.2": "Spatial Fiducials Storage",
        "1.2.840.10008.5.1.4.1.1.66.3": "Deformable Spatial Registration Storage",
        "1.2.840.10008.5.1.4.1.1.66.4": "Segmentation Storage",
        "1.2.840.10008.5.1.4.1.1.67": "Real World Value Mapping Storage",

        "1.2.840.10008.5.1.4.1.1.7": "Secondary Capture Image Storage",
        "1.2.840.10008.5.1.4.1.1.7.1": "Multiframe Single Bit Secondary Capture Image Storage",
        "1.2.840.10008.5.1.4.1.1.7.2": "Multiframe Grayscale Byte Secondary Capture Image Storage",
        "1.2.840.10008.5.1.4.1.1.7.3": "Multiframe Grayscale Word Secondary Capture Image Storage",
        "1.2.840.10008.5.1.4.1.1.7.4": "Multiframe True Color Secondary Capture Image Storage",
        "1.2.840.10008.5.1.4.1.1.77.1": "VL (Visible Light) Image Storage	Retired",
        "1.2.840.10008.5.1.4.1.1.77.1.1": "VL endoscopic Image Storage",
        "1.2.840.10008.5.1.4.1.1.77.1.1.1": "Video Endoscopic Image Storage",
        "1.2.840.10008.5.1.4.1.1.77.1.2": "VL Microscopic Image Storage",
        "1.2.840.10008.5.1.4.1.1.77.1.2.1": "Video Microscopic Image Storage",
        "1.2.840.10008.5.1.4.1.1.77.1.3": "VL Slide-Coordinates Microscopic Image Storage",
        "1.2.840.10008.5.1.4.1.1.77.1.4": "VL Photographic Image Storage",
        "1.2.840.10008.5.1.4.1.1.77.1.4.1": "Video Photographic Image Storage",
        "1.2.840.10008.5.1.4.1.1.77.1.5.1": "Ophthalmic Photography 8-Bit Image Storage",
        "1.2.840.10008.5.1.4.1.1.77.1.5.2": "Ophthalmic Photography 16-Bit Image Storage",
        "1.2.840.10008.5.1.4.1.1.77.1.5.3": "Stereometric Relationship Storage",
        "1.2.840.10008.5.1.4.1.1.77.2": "VL Multiframe Image Storage	",

        "1.2.840.10008.5.1.4.1.1.8": "Standalone Overlay Storage",
        "1.2.840.10008.5.1.4.1.1.88.11": "Basic Text SR",
        "1.2.840.10008.5.1.4.1.1.88.22": "Enhanced SR",
        "1.2.840.10008.5.1.4.1.1.88.33": "Comprehensive SR",
        "1.2.840.10008.5.1.4.1.1.88.40": "Procedure Log Storage",
        "1.2.840.10008.5.1.4.1.1.88.50": "Mammography CAD SR",
        "1.2.840.10008.5.1.4.1.1.88.59": "Key Object Selection Document",
        "1.2.840.10008.5.1.4.1.1.88.65": "Chest CAD SR",
        "1.2.840.10008.5.1.4.1.1.88.67": "X-Ray Radiation Dose SR",

        "1.2.840.10008.5.1.4.1.1.9": "Standalone Curve Storage",
        "1.2.840.10008.5.1.4.1.1.9.1.1": "12-lead ECG Waveform Storage",
        "1.2.840.10008.5.1.4.1.1.9.1.2": "General ECG Waveform Storage",
        "1.2.840.10008.5.1.4.1.1.9.1.3": "Ambulatory ECG Waveform Storage",
        "1.2.840.10008.5.1.4.1.1.9.2.1": "Hemodynamic Waveform Storage",
        "1.2.840.10008.5.1.4.1.1.9.3.1": "Cardiac Electrophysiology Waveform Storage",
        "1.2.840.10008.5.1.4.1.1.9.4.1": "Basic Voice Audio Waveform Storage",

        "1.2.840.10008.5.1.4.1.2.1.1": "Patient Root Query/Retrieve Information Model – FIND",
        "1.2.840.10008.5.1.4.1.2.1.2": "Patient Root Query/Retrieve Information Model – MOVE",
        "1.2.840.10008.5.1.4.1.2.1.3": "Patient Root Query/Retrieve Information Model – GET",
        "1.2.840.10008.5.1.4.1.2.2.1": "Study Root Query/Retrieve Information Model – FIND",
        "1.2.840.10008.5.1.4.1.2.2.2": "Study Root Query/Retrieve Information Model – MOVE",
        "1.2.840.10008.5.1.4.1.2.2.3": "Study Root Query/Retrieve Information Model – GET",
        "1.2.840.10008.5.1.4.1.2.3.1": "Patient/Study Only Query/Retrieve Information Model – FIND	",
        "1.2.840.10008.5.1.4.1.2.3.2": "Patient/Study Only Query/Retrieve Information Model – MOVE	",
        "1.2.840.10008.5.1.4.1.2.3.3": "Patient/Study Only Query/Retrieve Information Model – GET",

        "1.2.840.10008.5.1.4.31": "Modality Worklist Information Model – FIND",
        "1.2.840.10008.5.1.4.32": "General Purpose Worklist Management Meta SOP Class",
        "1.2.840.10008.5.1.4.32.1": "General Purpose Worklist Information Model – FIND",
        "1.2.840.10008.5.1.4.32.2": "General Purpose Scheduled Procedure Step SOP Class",
        "1.2.840.10008.5.1.4.32.3": "General Purpose Performed Procedure Step SOP Class",
        "1.2.840.10008.5.1.4.33": "Instance Availability Notification SOP Class",
        "1.2.840.10008.5.1.4.37.1": "General Relevant Patient Information Query",
        "1.2.840.10008.5.1.4.37.2": "Breast Imaging Relevant Patient Information Query",
        "1.2.840.10008.5.1.4.37.3": "Cardiac Relevant Patient Information Query",
        "1.2.840.10008.5.1.4.38.1": "Hanging Protocol Storage",
        "1.2.840.10008.5.1.4.38.2": "Hanging Protocol Information Model – FIND",
        "1.2.840.10008.5.1.4.38.3": "Hanging Protocol Information Model – MOVE"

    },
    QRSeriesID: '',
    QRSeriesInstanceID: '',
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
    ajaxindicatorstop: function (iframeobj) {
        if (!iframeobj) { return; }
        $(iframeobj.contentDocument).find('body').find('#resultLoading .bg').height('100%');
        $(iframeobj.contentDocument).find('body').find('#resultLoading').hide();
        $(iframeobj.contentDocument).find('body').find('body').css('cursor', 'default');
    },
    ajaxindicatorstart: function (iframeobj, text) {
        if ($(iframeobj.contentDocument).find('body').find('#resultLoading').attr('id') != 'resultLoading') {
            $(iframeobj.contentDocument).find('body').append('<div id="resultLoading" style="display:none"><div><img src="../../../bootstrap/img/ajax-loader1.gif"><div>' + text + '</div></div><div class="bg"></div></div>');
        }

        $(iframeobj.contentDocument).find('body').find('#resultLoading').css({
            'width': '100%',
            'height': '100%',
            'position': 'fixed',
            'z-index': '10000000',
            'top': '0',
            'left': '0',
            'right': '0',
            'bottom': '0',
            'margin': 'auto'
        });

        $(iframeobj.contentDocument).find('body').find('#resultLoading .bg').css({
            'background': '#000000',
            'opacity': '0.7',
            'width': '100%',
            'height': '100%',
            'position': 'absolute',
            'top': '0'
        });

        $(iframeobj.contentDocument).find('body').find('#resultLoading>div:first').css({
            'width': '250px',
            'height': '75px',
            'text-align': 'center',
            'position': 'fixed',
            'top': '0',
            'left': '0',
            'right': '0',
            'bottom': '0',
            'margin': 'auto',
            'font-size': '16px',
            'z-index': '10',
            'color': '#ffffff'
        });

        $(iframeobj.contentDocument).find('body').find('#resultLoading .bg').height('100%');
        $(iframeobj.contentDocument).find('body').find('#resultLoading').fadeIn(300);
        $(iframeobj.contentDocument).find('body').css('cursor', 'progress');
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

    loadOpalViewer: function (options) {
        var docServerUrl = commonjs.getFormattedUrl(options.url);
        var qcVersion = '&qc_v=2';

        location.href = 'opal://' + docServerUrl + '?' + commonjs.getSessionArgs() + '&exat=' + options.exatransUrl + '&user_id=' + app.userID + qcVersion;
        return;
        var ifrDummy = document.getElementById('ifrOpalViewer');
        if (ifrDummy) {
            ifrDummy = $('#ifrOpalViewer');
            ifrDummy.attr('src', options.url);
            ifrDummy.show();
        } else {
            ifrDummy = document.createElement('ifr');
            ifrDummy.id = 'ifrOpalViewer';
            document.body.appendChild(ifrDummy);
            commonjs.loadOpalViewer(options);
        }
    },
    setReadyToFile: function (e) {
        e = e || event;
        /* get IE event ( not passed ) */
        e.stopPropagation ? e.stopPropagation() : e.cancelBubble = true;
        if ($(e.target).prop('checked')) {
            $('#chkAllToToFile').prop('checked', true);
            $('#divGrid_fileInsurance').find('.fileInsuranceChk').attr('checked', true);
        }
        else {
            $('#chkAllToToFile').prop('checked', false);
            $('#divGrid_fileInsurance').find('.fileInsuranceChk').attr('checked', false)
        }

        $("#tblFileInsuranceGrid").find('input:checkbox').each(function () {
            if ($('#chkAllToToFile').prop('checked')) {
                this.checked = true;
                if (!$(this).closest('tr').hasClass('customRowSelect')) {
                    $(this).closest('tr').addClass('customRowSelect');
                }
            } else {
                this.checked = false;
                $(this).closest('tr').removeClass('customRowSelect');
            }

        });
    },
    setPaymentReport: function (e) {
        e = e || event;
        /* get IE event ( not passed ) */
        e.stopPropagation ? e.stopPropagation() : e.cancelBubble = true;
        if ($(e.target).prop('checked')) {
            $('#chkPaymentReport').prop('checked', true);
            $('#divPaymentCommentsTable').find('.chkPaymentReport').prop('checked', true);
        }
        else {
            $('#chkPaymentReport').prop('checked', false);
            $('#divPaymentCommentsTable').find('.chkPaymentReport').prop('checked', false);
        }
    },

    setReadyToValidate: function (e) {
        e = e || event;
        /* get IE event ( not passed ) */
        e.stopPropagation ? e.stopPropagation() : e.cancelBubble = true;
        if ($(e.target).prop('checked')) {
            $('#chkAllToToValidate').prop('checked', true);
            $('#divGrid_ReadyToValidate').find('.studyChk').attr('checked', true);
        }
        else {
            $('#chkAllToToValidate').prop('checked', false);
            $('#divGrid_ReadyToValidate').find('.studyChk').attr('checked', false)
        }

        $("#tblReadyToValidate").find('input:checkbox').each(function () {
            if ($('#chkAllToToValidate').prop('checked')) {
                this.checked = true;
                if (!$(this).closest('tr').hasClass('customRowSelect')) {
                    $(this).closest('tr').addClass('customRowSelect');
                }
            }
            else {
                this.checked = false;
                $(this).closest('tr').removeClass('customRowSelect');
            }
        });
        $('#validateMenu').hide();
    },

    setFollowUp: function (e) {
        e = e || event;
        /* get IE event ( not passed ) */
        e.stopPropagation ? e.stopPropagation() : e.cancelBubble = true;
        if ($(e.target).prop('checked')) {
            $('#chkAllFollowup').prop('checked', true);
            $('#divGrid_followup').find('.studyChk').attr('checked', true);
        }
        else {
            $('#chkAllFollowup').prop('checked', false);
            $('#divGrid_followup').find('.studyChk').attr('checked', false)
        }

        $("#tblFollowupGrid").find('input:checkbox').each(function () {
            if ($('#chkAllFollowup').prop('checked')) {
                this.checked = true;
                if (!$(this).closest('tr').hasClass('customRowSelect')) {
                    $(this).closest('tr').addClass('customRowSelect');
                }
            }
            else {
                this.checked = false;
                $(this).closest('tr').removeClass('customRowSelect');
            }
        });
        $('#validateMenu').hide();
    },

    setSubmitted: function (e) {
        e = e || event;
        /* get IE event ( not passed ) */
        e.stopPropagation ? e.stopPropagation() : e.cancelBubble = true;
        if ($(e.target).prop('checked')) {
            $('#chkAllToToSubmit').prop('checked', true);
            $('#divGrid_submitted').find('.studyChk').attr('checked', true);
        }
        else {
            $('#chkAllToToSubmit').prop('checked', false);
            $('#divGrid_submitted').find('.studyChk').attr('checked', false)
        }

        $("#tblSubmittedGrid").find('input:checkbox').each(function () {
            if ($('#chkAllToToSubmit').prop('checked')) {
                this.checked = true;
                if (!$(this).closest('tr').hasClass('customRowSelect')) {
                    $(this).closest('tr').addClass('customRowSelect');
                }
            }
            else {
                this.checked = false;
                $(this).closest('tr').removeClass('customRowSelect');
            }
        });
    },

    showDialog: function (options) {
        console.trace("commonjs::showDialog: header: '%s', url: '%s', options: %O", options.header, options.url, options);
        var dataContainer, wid, hei;
        if (options.width.indexOf('%') > 0) {
            var wwid = $window.width();
            wid = parseInt(options.width.replace('%', ''));
            wid = (wwid / 100) * wid;
        }

        else {
            wid = parseInt(options.width.replace('%', '').replace('px', ''));
        }

        if (options.height.indexOf('%') > 0) {
            var whei = $window.height();
            hei = parseInt(options.height.replace('%', ''));
            hei = (whei / 100) * hei;
        }
        else {
            hei = parseInt(options.height.replace('%', '').replace('px', ''));
        }

        if (typeof options.url != 'undefined' && commonjs.checkNotEmpty(options.url)) {
            if (!document.getElementById('site_modal_iframe_container')) {
                var ifr = document.createElement('iframe');
                ifr.id = 'site_modal_iframe_container';
                ifr.frameBorder = 0;
                ifr.style.width = '100%';
                $('#siteModal .modal-body').append($(ifr));
                $('#siteModal .modal-body').css({ 'padding': '0px' })
            }
            dataContainer = $('#site_modal_iframe_container');
            dataContainer.attr('src', options.url);
            dataContainer.show();
            $('#modal_div_container').hide();
        }
        else if (typeof options.html != 'undefined' && commonjs.checkNotEmpty(options.html)) {
            dataContainer = $('#modal_div_container').css({ 'overflow-x': 'hidden' });

            if (!options.haveContentInContainer) {
                dataContainer.html(options.html);
            }

            commonjs.updateCulture(app.currentCulture, commonjs.beautifyMe);
            dataContainer.show();
            $('#site_modal_iframe_container').hide();
        }
        if (typeof options.onLoad != 'undefined' && commonjs.checkNotEmpty(options.onLoad)) {
            dataContainer = $('#site_modal_iframe_container');
            dataContainer.attr('onLoad', options.onLoad);
        }
        if (options.i18nHeader) {
            $('#spanModalHeader').html(commonjs.geti18NString(options.i18nHeader));
        } else {
            $('#spanModalHeader').html(options.header);
        }
        //$('#siteModal').attr('data-width', wid);
        $('.modal-dialog').attr('style', 'width:' + wid + 'px');
        if (dataContainer) {
            if (options.needShrink) {
                if (window.innerHeight > window.innerWidth) {
                    var height = $window.height() / 2;
                    dataContainer.css('height', (height - 100) + 'px');
                }
                else {
                    dataContainer.css('height', hei + 'px');
                }
            }
            else {
                dataContainer.css('height', hei + 'px');
            }
        }

        var boolKeyboard = (!app.changePassword);   // Sets whether the modal will allow keyboard commands such as ESC to close it
        if (options.isPatientNotes) {
            dataContainer.css('overflow', 'auto');
            //$('#siteModal').modal({width: wid + 'px', show: true});
            $('#siteModal').modal({ show: true, keyboard: boolKeyboard });
        }
        else if (options.isInitial) {
            $('#siteModal').modal({ show: true, keyboard: boolKeyboard });
            $('#siteModal').width(wid + 'px');
            $('#siteModal').css({
                'margin-left': function () {
                    return -($(this).width() / 2);
                }
            });
        }
        else
            //$('#siteModal').modal({width: wid + 'px', show: true});
            $('#siteModal').modal({ show: true, keyboard: boolKeyboard });
        $('#siteModal').on('hide', function (event) {
            if ($('#siteModal').find('iframe')) {
                var url = $('#siteModal').find('iframe').attr('src');
                if (url)
                    $('#siteModal').find('iframe').remove();

                if (parent.editStudyID > 0 && app.transcriptionLock) {
                    commonjs.lockUnlockTranscription({ study_id: parent.editStudyID, lockType: "unlock", user_id: app.userID });
                }
            }
            if (editStudyID > 0) {
                commonjs.getEditStudy(editStudyID);
                //Added to update online users list once dialog closed
                if (commonjs.socket) {
                    commonjs.socket.emit('order_edit_done', {
                        screen_code: 'Order',
                        session_id: app.sessionID,
                        user_id: app.userID
                    });
                }
                $('#divHomeUserOnline').hide();
            }

            if (options.onHide && typeof options.onHide === 'function') {
                options.onHide();
            }
            if (window.reportWindow)
                window.reportWindow.close();
            if (window.updaterRegisteredPortalInfo == true)
                window.updaterRegisteredPortalInfoObj.close();
            $('#siteModal').off('hide');
        });
    },

    checkDicomStatus: function (dicom_status, no_of_instances) {
        return no_of_instances > 0;
        // if ((dicom_status == "CO" || dicom_status == "IP") && no_of_instances > 0) {
        //     return true;
        // } else {
        //     return false;
        // }
    },

    getEditStudy: function (study_id) {
        var studyID = [];
        studyID.push(study_id);
        $.ajax({
            url: '/editOrderStudy',
            type: "GET",
            data: {
                study_id: studyID,
                homeOpentab: homeOpentab
            },
            success: function (model, response) {
                editStudyID = 0;
                if (model && model.result && model.result.length > 0) {
                    var tblID = '#tblGrid' + homeOpentab;
                    commonjs.changeRowValue('tblGrid' + homeOpentab, model.result[0].study_id, model.result[0]);
                }
            },
            error: function (model, response) {
                editStudyID = 0;
                commonjs.handleXhrError(model, response);
            }
        });
    },

    setAppCriticalFindings: function () {
        $.ajax({
            url: "/criticalFindings",
            type: "GET",
            success: function (data, response) {
                if (Array.isArray(data.result)) {
                    app.criticalFindings = data.result.map(function (criticalFindingsData) {
                        return {id: criticalFindingsData.id, description: criticalFindingsData.description};
                    });
                }
            },
            error: function (err, response) {
                commonjs.handleXhrError(err, response);
            }
        });
    },

    bindCriticalFindingsList: function(ul, studyIds, screenName) {
        $(ul).empty();
        $.each(app.criticalFindings, function (index, criticalFindingsData) {
            if (criticalFindingsData.description) {
                $(ul).append('<li><a id="' + criticalFindingsData.id + '"  href="javascript: void(0)" >' + criticalFindingsData.description + '</a></li>');
                $('#' + criticalFindingsData.id).click(function () {
                    jQuery.ajax({
                        url: "/updateCriticalFindingInStudies",
                        type: "POST",
                        data: {
                            criticalFindingId: criticalFindingsData.id,
                            criticalFindingDescription: criticalFindingsData.description,
                            studyIds: studyIds,
                            screenName: screenName
                        },
                        success: function (data, textStatus, jqXHR) {
                            commonjs.showStatus(i18n.get('order.notes.reasonSaved'));
                        },
                        error: function (err, response) {
                            commonjs.handleXhrError(err, response);
                        }
                    });
                });
            }
        });

    },

    // Added, Wilson Novido, Dec. 18,2015, EXA-422
    // Set app.settings.studyflag using API
    setAppSettingsStudyFlag: function (userType) {
        $.ajax({
            url: "/studyFlagsAll",
            type: "GET",
            data: {
                userType: userType
            },
            success: function (data, response) {
                if (Array.isArray(data.result)) {
                    app.settings.studyflag = data.result.map(function (flagData) {
                        return flagData.description;
                    });
                }
            },
            error: function (err, response) {
                commonjs.handleXhrError(err, response);
            }
        });
    },

    // Added By Wilson Novido, 12/22/2015, EXA-422
    // Function to generate the flag list items and call the updateStudyFlag, called twice by getFlagsForStudy
    callUpdateFlag: function (ulFlag, flagID, flagDescription, screenName, tblID, study_ids_array, rowID, patientId, orderId, study_color_code) {
        var liID = ulFlag.replace('#ul', 'li') + '_' + flagID;

        $(ulFlag).append('<li><a id="' + liID + '"  href="javascript: void(0)" >' + ((flagID === 0) ? 'None' : flagDescription) + '</a></li>');
        $('#' + liID).click(function () {
            schedules.updateStudyFlag(flagDescription, flagID, screenName, study_ids_array, patientId, orderId, function (data) {
                if (data.response) {
                    commonjs.showStatus(screenName + ' Flag has been ' + ((flagID === 0) ? 'cleared' : 'changed'));
                    commonjs.updateInfo(study_ids_array, 'study');

                    if (screenName === 'Studies' || screenName === 'Orders' || screenName === 'Dispatching Orders') {
                        var tblIDSuffix = tblID.replace('#', '');
                        $.each(study_ids_array, function (index, studyId) {
                            if (screenName === 'Dispatching Orders') {
                                var $row = $(tblID).find('#' + orderId);
                            } else {
                                var $row = $(tblID).find('#' + studyId);
                            }
                            $row.removeClass('ui-state-highlight customRowSelect');
                            $row.children('td').filter('[aria-describedby=' + tblIDSuffix + '_study_flag]').css({ backgroundColor: flagDescription && study_color_code ? study_color_code : $row.css('background-color') })
                        })
                    }
                    else if ('Schedule' == screenName) {
                        $('.fc-button-refresh').click();
                    }
                    if (screenName === 'Assigned Jobs' || screenName === 'Unassigned Orders' || screenName === 'Dispatching Orders') {
                        commonjs.changeColumnValue(tblID, rowID, 'study_flag', flagDescription);
                    }
                }
                else {
                    commonjs.showError('messages.errors.cannotchangestudyflag');
                }
            });
        });
    },

    // Added By Wilson Novido, 12/21/2015, EXA-422
    // To get the flags, update the studies and orders table and refresh the study flag in the grid
    // Called 6X: In grid.js 2X, calendar_v1.js, vehicleAssignments.js, vehicleTracking.js, viewJobsList.js
    getFlagsForStudy: function (ids, id_type, screenName, tblID, ulFlag, rowID, orderId) {
        // NOTE: Pass different menu ID from customSubGrid for Order and Studies as this has conflict
        if (typeof ulFlag === 'undefined')
            ulFlag = '#ulOrderFlag';

        var patientId = (screenName == 'Orders' || screenName == 'Studies') ? rowID : 0

        $.ajax({
            url: "/getFlagsForStudy",
            type: "GET",
            data: {
                ids: ids,
                id_type: id_type,
                screenName: screenName
            },
            success: function (data) {
                if (Array.isArray(data) && data.length > 0) {
                    var study_ids_array = data[0].study_ids_array;
                    $(ulFlag).empty();
                    $.each(data, function (index, flagData) {
                        if (flagData.description) {
                            if (index === 0) {
                                // For clearing the flag, 1st entry in the list as None
                                commonjs.callUpdateFlag(ulFlag, 0, '', screenName, tblID, study_ids_array, rowID, patientId, orderId, flagData.study_color_code);
                            }
                            // All flags that matches institution, facility_id and modality_id
                            commonjs.callUpdateFlag(ulFlag, ~~flagData.id, flagData.description, screenName, tblID, study_ids_array, rowID, patientId, orderId, flagData.study_color_code);
                        }
                    });
                }
            },
            asynch: false,
            error: function (err, response) {
                commonjs.handleXhrError(err, response);
            }
        });
    },
    // End


    // Added, Wilson Novido, Jan. 7,2016
    setInitialAssignmentForm: function (id, idsStr) {
        // Get all users Not Assigned to a Study and add it in listAssignedUsers, a hidden list used to edit check
        $.ajax({
            url: '/usersList',
            type: "GET",
            data: {
                id: -1, // pass -1 as a trick to get all users
                idsStr: idsStr,
                notStr: 'NOT'
            },
            success: function (data, textStatus, jqXHR) {
                if (data && data.result && data.result.length > 0) {
                    $.each(data.result, function (index, userData) {
                        var opt = document.createElement('Option');
                        opt.text = userData.full_name + ' (' + userData.username + ')';
                        opt.value = userData.id;
                        document.getElementById('listAssignedUsers').options.add(opt);
                    });
                }
            },
            error: function (err, response) {
                commonjs.handleXhrError(err, response);
            }
        });

        $('#ulListAssignedUsers').delegate('a.remove', 'click', function () {
            $('#listAssignedUsers option[value="' + $(this).attr('data-id') + '"]').prop('selected', false);
            $(this).closest('li').remove();
        });

        // Dropdown list of all users, autocomplete
        commonjs.setAutocompleteInfinite({
            containerID: "#txtListUnassignedUsers",
            placeHolder: "Select user to assign",
            inputLength: 0,
            clearnotNeed: false,
            URL: '/usersList',
            data: function (term, page) {
                return {
                    pageNo: page,
                    pageSize: 10,
                    q: term,
                    id: -1,
                    idsStr: idsStr,
                    notStr: 'NOT'
                };
            },
            results: function (data, page) {
                var more = data.result.length > 0 ? (page * 10) < data.result[0].total_records : false;
                return { results: data.result, more: more };
            },

            formatID: function (obj) {
                return obj.id;
            },

            formatResult: function (res) {
                var markup = "<table class='ref-result' style='width: 100%'><tr>";
                markup += "<td><div><b>" + res.full_name + "</b>";
                markup += "<span> (" + res.username + ")</span>";
                markup += "</div></td></tr></table>";
                return markup;
            },

            formatSelection: function (res) {
                $('#btnAssignUser').attr('data-id', res.id);
                return res.full_name + ' (' + res.username + ')';
            }
        });

        $('#btnAssignUser').unbind('click').click(function () {
            if ($('#s2id_txtListUnassignedUsers > a.select2-default').length > 0) {
                return false;
            }

            if ($('#listAssignedUsers option[value="' + $(this).attr('data-id') + '"]').prop('selected') === true) {
                commonjs.showError("User already assigned");
                return false;
            }

            $('#listAssignedUsers option[value="' + $(this).attr('data-id') + '"]').prop('selected', true);
            $('#ulListAssignedUsers').append('<li><span>' + $('#listAssignedUsers option[value="' + $(this).attr('data-id') + '"]').text() + '</span><a class="remove" data-id="' + $(this).attr('data-id') + '" id="' + $(this).attr('data-id') + '"><span class="icon-ic-close"></span></a></li>')
        });

        // Show all users assigned
        $.ajax({
            url: '/usersList',
            type: "GET",
            data: {
                id: id,
                idsStr: idsStr,
                notStr: ''
            },
            success: function (data, response) {
                if (data.result)
                    $.each(data.result, function (index, userData) {
                        if ($('#ulListAssignedUsers a[data-id="' + userData.id + '"]').length === 0) {
                            $('#ulListAssignedUsers').append('<li><span>' + userData.full_name + '</span><span> (' + userData.username + ')</span><a class="remove" data-id="' + userData.id + '" id="' + userData.id + '"><span class="icon-ic-close"></span></a></li>')
                        }
                        $('#listAssignedUsers option[value="' + userData.id + '"]').prop('selected', true);
                    });
            },
            error: function (err, response) {
                commonjs.handleXhrError(err, response);
            }
        });
    },

    saveUserAssignments: function (id, idsStr) {
        var arrAssignedUsers = $('ul#ulListAssignedUsers li a').map(function () {
            return this.id;
        }).get();

        $.ajax({
            url: "/userAssignments",
            type: "PUT",
            data: {
                id: id.split(','),
                assignedUsers: (arrAssignedUsers.length > 0) ? arrAssignedUsers : [0],
                idsStr: idsStr
            },
            success: function (data, textStatus, jqXHR) {
                if (data && data.result && data.result.length > 0) {
                    commonjs.hideLoading();
                    commonjs.showWarning('User Assignment not saved!');
                    return false;
                }
                // Doesn't make sense to do this but why?
                // commonjs.updateInfo(id, idsStr);
            },
            error: function (err) {
                commonjs.handleXhrError(err);
            }
        });
    },
    // End Added

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

    saveReasonForStudy: function (patient_id, study_id, new_reason_for_study, old_reason_for_study) {
        if (!commonjs.checkNotEmpty(new_reason_for_study)) {
            commonjs.showWarning(i18n.get('order.notes.enterReason'));
            return false;
        }

        commonjs.showSaving('');

        $.ajax({
            url: '/updateReasonForStudy',
            type: "PUT",
            data: {
                'patient_id': patient_id,
                'study_id': study_id,
                'reason_for_study': new_reason_for_study,
                'old_reason_for_study': old_reason_for_study
            },
            success: function (data, response) {
                var root = parent && parent.commonjs || commonjs;
                commonjs.showStatus(i18n.get('order.notes.reasonSaved'));
                root.updateInfo(study_id, 'study');
            },
            error: function (err, response) {
                commonjs.handleXhrError(err, response);
            }
        });

        return false;
    },

    getEditOrder: function (orderID) {
        $.ajax({
            url: '/editOrderStudy',
            type: "GET",
            data: {
                orderID: editOrderID,
                homeOpenTab: homeOpentab
            },
            success: function (model, response) {
                if (model && model.result && model.result.length > 0) {
                    var tblID = '#tblGrid' + homeOpentab;
                    commonjs.changeRowValue('tblGrid' + homeOpentab, editOrderID, model.result[0]);
                    editOrderID = 0;
                }
            },
            error: function (model, response) {
                editOrderID = 0;
                commonjs.handleXhrError(model, response);
            }
        });
    },
    showDicomViewer: function (rowID, isdoubleClick, gridID, linked_study_id) {
        var self = this;
        var $tblGrid = $(gridID);
        var getData = $tblGrid[0].customGrid.getData;
        var gridData = getData(rowID);
        if (layout.checkLicense('Dicom Viewer', true)) {
            if (app.autoOpenDevice) {
                var defaultDevice = $.grep(app.userdevices, function (device) {
                    return (app.default_device_id == device.id);
                });
                if (defaultDevice.length > 0) {
                    if (linked_study_id && linked_study_id > 0) {
                        commonjs.openWithDevice(linked_study_id, defaultDevice[0].socket_id);
                    }
                    else {
                        commonjs.openWithDevice(rowID, defaultDevice[0].socket_id);
                    }
                }
            }
            window.isViewerRender = true;
            if (linked_study_id && linked_study_id > 0) {
                prefetchViewer.showViewer(0, linked_study_id, {
                    orderID: gridData.order_id,
                    istudyID: gridData.study_id,
                    patientID: gridData.patient_id,
                    patientName: gridData.patient_name,
                    facility_id: gridData.facility_id,
                    order_status: gridData.order_status,
                    has_deleted: gridData.has_deleted,
                    modality_id: gridData.modality_id,
                    status_code: gridData.status_code,
                    accession_no: gridData.accession_no,
                    bodypart: gridData.body_part,
                    modality: gridData.modality_code,
                    study_description: gridData.study_description
                });
            }
            else {
                prefetchViewer.showViewer(gridData.study_uid, gridData.study_id, {
                    orderID: gridData.order_id,
                    istudyID: gridData.study_id,
                    patientID: gridData.patient_id,
                    patientName: gridData.patient_name,
                    facility_id: gridData.facility_id,
                    order_status: gridData.order_status,
                    has_deleted: gridData.has_deleted,
                    modality_id: gridData.modality_id,
                    status_code: gridData.status_code,
                    accession_no: gridData.accession_no,
                    bodypart: gridData.body_part,
                    modality: gridData.modality_code,
                    study_description: gridData.study_description,
                    dicom_status: gridData.dicom_status,
                    study_info: gridData.study_info,
                    is_sde: gridData.is_sde
                });
            }
            prefetchViewer.autoOpenOrderWindow({
                orderID: gridData.order_id,
                istudyID: gridData.study_id,
                patientID: gridData.patient_id,
                patientName: gridData.patient_name,
                facility_id: gridData.facility_id,
                order_status: gridData.order_status,
                has_deleted: gridData.has_deleted,
                modality_id: gridData.modality_id,
                status_code: gridData.status_code,
                study_status: gridData.study_status,
                sr_study: gridData.sr_study,
                study_description: gridData.study_description,
                accession_no: gridData.accession_no,
                bodypart: gridData.body_part,
                modality: gridData.modality_code,
                study_info: gridData.study_info,
                is_sde: gridData.is_sde
            });

        } else {
            if (isdoubleClick) {
                commonjs.showDialog({
                    header: 'Exam',
                    i18nHeader: 'shared.fields.exam',
                    width: '95%',
                    height: '75%',
                    url: '/vieworder#order/studyinfo/' + gridData.order_id + '/' + gridData.patient_id + '&study_id' + gridData.study_id
                });
            } else {
                commonjs.showWarning("Series not found");
            }
        }
    },

    openWithDevice: function (rowID, socket_id) {
        if (!socket_id) {
            socket_id = 0;
        }
        jQuery.ajax({
            url: "/startDevice",
            type: "GET",
            data: {
                "study_id": rowID,
                "socket_id": socket_id
            },
            success: function (data, textStatus, jqXHR) {
                if (data.err) {
                    commonjs.showError(data.err, true);
                }
                else {
                    commonjs.showStatus(data.msg);
                }
            },
            error: function (err) {
                commonjs.handleXhrError(err);
            }
        });
    },

    prefetchStudies: function (studyid, callback, args) {
        prefetch.prefetchStudies(true, studyid, 0, callback, null, null, null, { format: args.layoutFormat, wndCount: args.wndCount });
    },

    prefetchLocalStudies: function (studyid, callback) {
        prefetch.prefetchLocalStudies(true, studyid, 0, callback);
    },

    hideDialog: function (callback) {
        var $siteModal = $('#siteModal');
        if (typeof callback === 'function') {
            if ($siteModal.is(':visible')) {
                $siteModal
                    .on('hidden.bs.modal', function () {
                        /**
                         * Have to remove this before callback is called or
                         * transition will conflict when opened window closes
                         * and tries to open a new dialog.
                         */

                        $('.modal-backdrop').remove();


                        $('#modal_div_container').html('');
                        $('#site_modal_iframe_container').attr('src', '');

                        callback();
                        $(this).off('hidden.bs.modal');
                    });
            }
            else {
                $('#modal_div_container').html('');
                $('#site_modal_iframe_container').attr('src', '');
                callback();
            }
        }
        $siteModal.modal('hide');
    },

    generateRandomNumber: function () {
        var randomNo = Math.random()
        randomNo = randomNo.toString();
        randomNo = randomNo.replace('.', '');
        return randomNo;
    },

    refreshPageSize: function () {
        if ($('#btnRefreshAll').length > 0) $('#btnRefreshAll').click();
        if ($('#divPageHeaderButtons input').length > 0) {
            for (var i = 0; i < $('#divPageHeaderButtons input').length; i++) {
                if ($('#divPageHeaderButtons input')[i].value == 'Reload' && $('#divPageHeaderButtons input')[i].id && $('#' + $('#divPageHeaderButtons input')[i].id).length > 0) {
                    $('#' + $('#divPageHeaderButtons input')[i].id).click();
                }
            }
        }
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

    setAutoCompleteLocalData: function (options) {
        $(options.containerID).select2({
            allowClear: options.allowClear,
            placeholder: options.placeHolder,
            minimumInputLength: options.inputLength,
            data: options.dataArray,
            id: options.formatID,
            formatResult: options.formatResult,
            formatSelection: options.formatSelection,
            formatSearching: commonjs.formatSearching
        });
    },

    formatSearching: function () {
        $('.bootstrap-datetimepicker-widget').hide();
        return "Searching...";
    },


    formatPatientAutoComplete: function (name, gender, birthDate, accNo, is_active) {
        var markup = "<table><tr>";
        markup += "<td><div>" + name + "</div>";
        markup += "<div>" + birthDate + ' ' + accNo + "</div>";
        markup += "</td></tr></table>"
        return markup;
    },

    formatPatientACResult: function (account_no, patient_name, dob) {
        $('.bootstrap-datetimepicker-widget').hide();
        var _accountNo = account_no != null ? account_no : '';
        var markup = "<table><tr>";
        if (_accountNo != '')
            markup += "<td title='" + _accountNo + (patient_name ? "(" + patient_name + " - " + dob + ")" : '') + "'><div>" + _accountNo + (patient_name ? "(" + patient_name + " - " + dob + ")" : '') + "</div>";
        else
            markup += "<td title='" + _accountNo + patient_name ? patient_name : '' + "'><div>" + _accountNo + patient_name ? patient_name : '' + "</div>";
        markup += "</td></tr></table>"
        return markup;
    },

    formatACResult: function (code, description, is_active, linkedCPTs, fromCPT, isICD, icd_type) {
        $('.bootstrap-datetimepicker-widget').hide();
        if (!fromCPT) {
            var codeValue = code != null ? code : '';
            if (isICD && icd_type) {
                codeValue += "( " + icd_type + " )"
            }
            if (is_active || is_active == undefined) {
                var markup = "<table><tr>";
                if (codeValue != '')
                    markup += "<td title='" + codeValue + (description ? "(" + description + ")" : '') + "'><div>" + codeValue + (description ? "(" + description + ")" : '') + "</div>";
                else
                    markup += "<td title='" + codeValue + description ? description : '' + "'><div>" + codeValue + description ? description : '' + "</div>";
                markup += "</td></tr></table>"
                return markup;
            }
            else {
                var markup1 = "<table><tr class='inActiveRow'>";
                if (codeValue != '')
                    markup1 += "<td title='" + codeValue + "(" + description + ")" + "'><div>" + codeValue + "(" + description + ")" + "</div>";
                else
                    markup += "<td title='" + codeValue + description + "'><div>" + codeValue + description + "</div>";
                markup1 += "</td></tr></table>"
                return markup1;
            }
        }
        else {
          return this.formatSelect2Result(code, description, is_active, linkedCPTs);
        }
    },

    formatSelect2Result: function(code, description, is_active, linked) {
        var markup = '<table>';

        var text = description;
        if (code) {
          text += ' (' + code + ')';
        }

        if (is_active || is_active == undefined) {
          markup += "<tr><td title='" + text + "'><div>" + text + "</div></td></tr>";
        }

        if (linked && linked.length) {
          markup += "<tr><td><div style='color: #008000;'>" + linked + "</div></td></tr>";  // double quote because 'octal literals'
        }
        markup += '</table>';
        return markup;
    },

    //formatInsuranceACResult: function (code, description, is_active, isAuthorized, linkedCPTs, fromCPT) {
    formatInsuranceACResult: function (res) {
        $('.bootstrap-datetimepicker-widget').hide();
        var tblClass = (res.isAuthorized) ? " style='color: #0DAC07;' " : "";
        var rowClass = (res.is_active || res.is_active == undefined) ? " inActiveRow " : "";
        var htmLinkCPT = "          <div style='color: #008000;'>" + res.linkedCPTs + "</div>";
        if (!res.address) res.address = "N/A";
        if (!res.city) res.city = "N/A";
        if (!res.state) res.state = "N/A";

        if (res.fromCPT) {
            var markup = "" +
                "<table " + tblClass + ">" +
                "   <tr>" +
                "       <td title='" + res.code + "(" + res.name + ")'>" +
                "           <div>" + res.code + "(" + res.name + ")" + "</div>" +
                "       </td>" +
                "   </tr>" +
                "   <tr>" +
                "       <td>" +
                "           <div>" + linkedCPTs + "</div>" +
                "       </td>" +
                "   </tr>" +
                "</table>";
        }
        else {
            var markup = "" +
                "<table " + tblClass + ">" +
                "   <tr>" +
                "       <td title='" + res.code + "(" + res.name + ")'>" +
                "           <div>" + res.code + "(" + res.name + ")" + "</div>" +
                "           <div>" + res.address + "</div>" +
                "           <div>" + res.city + ", " + res.state + " " + res.zip + "</div>" +
                "       </td>" +
                "   </tr>" +
                "</table>";
        }
        return markup;
    },

    formatTypeAhead: function (code, description, is_active, titleCode, titleDescription, isCpt) {
        if (isCpt) {
            if (is_active || is_active == undefined) {
                var markup1 = "<div class='row'>";
                markup1 += "<div class='col-md-8' style='overflow: hidden;' title='" + titleCode + "'>" + code + "</div>";
                markup1 += "<div class='col-md-4' style='overflow: hidden;' title='" + titleDescription + "'>" + description + "</div>";
                markup1 += "</div>"
                return markup1;
            }
            else {
                var markup1 = "<div class='row inActiveRow'>";
                markup1 += "<div class='col-md-8 inActiveRow' style='overflow: hidden;' title='" + code + "'>" + code + "</div>";
                markup1 += "<div class='col-md-4 inActiveRow' style='overflow: hidden;' title='" + description + "'>" + description + "</div>";
                markup1 += "</div>"
                return markup1;
            }
        }
        else {
            if (is_active || is_active == undefined) {
                var markup1 = "<div class='row'>";
                markup1 += "<div class='col-md-4' style='overflow: hidden;' title='" + titleCode + "'>" + code + "</div>";
                markup1 += "<div class='col-md-8' style='overflow: hidden;' title='" + titleDescription + "'>" + description + "</div>";
                markup1 += "</div>"
                return markup1;
            }
            else {
                var markup1 = "<div class='row inActiveRow'>";
                markup1 += "<div class='col-md-4 inActiveRow' style='overflow: hidden;' title='" + code + "'>" + code + "</div>";
                markup1 += "<div class='col-md-8 inActiveRow' style='overflow: hidden;' title='" + description + "'>" + description + "</div>";
                markup1 += "</div>"
                return markup1;
            }
        }
    },

    formatMarketingRepResult: function (res) {
        if (res.is_active) {
            var markup1 = "<table class='ref-result' style='width: 100%'><tr class='inActiveRow'>";
            markup1 += "<td><div><b>" + res.name + "</b></div>";
            markup1 += "</td></tr></table>";
            return markup1;
        }
        else {
            var markup = "<table class='ref-result' style='width: 100%'><tr>";
            markup += "<td><div><b>" + res.name + "</b></div>";
            markup += "</td></tr></table>";
            return markup;
        }
    },

    formatACProviderResult: function (res) {
        $('.bootstrap-datetimepicker-widget').hide();
        var fullName = commonjs.getFullName({
            lastName: res.last_name,
            firstName: res.first_name,
            mi: res.middle_initial,
            suffix: res.suffix
        });
        var contactInfo = commonjs.hstoreParse(res.contact_info);
        var states = "";
        for (var i = 0; i < app.states.length; i++) {
            if (contactInfo.STATE != "") {
                if (i == contactInfo.STATE) {
                    states = app.states[i];
                }
            }
        }
        if (!res.is_active) {
            var markup1 = "<table class='ref-result' style='width: 100%'><tr class='inActiveRow'>";
            markup1 += "<td><div><b>" + fullName + "</b><b>" + '(' + res.provider_code + ')' + "</b></div>";
            markup1 += "<div>" + contactInfo.ADDR1 == "undefined" ? "" : contactInfo.ADDR1 + contactInfo.ADDR2 == "undefined" ? "" : ", " + contactInfo.ADDR2 + "</div>";
            markup1 += "<div>" + contactInfo.CITY == "undefined" ? "" : contactInfo.CITY + ", " + states + contactInfo.ZIP == "undefined" ? "" : ", " + contactInfo.ZIP + contactInfo.MOBNO == "undefined" ? "" : ", " + contactInfo.MOBNO + "</div>";
            markup1 += "</td></tr></table>";
            return markup1;
        }
        else {
            var markup = "<table class='ref-result' style='width: 100%'><tr>";
            markup += "<td><div><b>" + fullName + "</b><b>" + '(' + res.provider_code + ')' + "</b></div>";
            markup += "<div>" + (contactInfo.ADDR1 == "undefined" ? "" : contactInfo.ADDR1) + ", " + (contactInfo.ADDR2 == "undefined" ? "" : contactInfo.ADDR2) + "</div>";
            markup += "<div>" + (contactInfo.CITY == "undefined" ? "" : contactInfo.CITY) + ", " + states + (contactInfo.ZIP == "undefined" ? "" : ", " + contactInfo.ZIP) + (contactInfo.MOBNO == "undefined" ? "" : ", " + contactInfo.MOBNO) + "</div>";
            markup += "</td></tr></table>";
            return markup;
        }
    },

    formatACSlotResult: function (res) {
        var f = moment(res.slot_date + " " + res.start_time, "YYYY-MM-DD HH:mm a");
        var t = moment(res.slot_date + " " + res.end_time, "YYYY-MM-DD HH:mm a");
        var className = String(res.className || "");
        var markup = "<table class='ref-result " + className + "' style='width: 100%'><tr><td>" +
            "<div><b>" + res.code + "</b></div>" +
            "<div>" + f.format("L") + "</div>" +
            "<div>" + f.format("LT z") + " to " + t.format("LT z") + "</div>" +
            "</td>";
        if (res.order_info && res.order_info.length) {
            var x = res.order_info[0];
            markup += "<td>" +
                "<div><b>" + x.patient_name + "</b></div>" +
                "<div>" + x.order_status_desc + "</div>" +
                "<div>" + moment(x.scheduled_dt).format("LT z") + " - " + moment(x.scheduled_dt).add(x.duration, 'm').format("LT z") + "</div>" +
                "</td>";
            if (res.order_info.length > 1) {
                markup += "<td><div class='newOrderSlotTakenBadge'>+" + (res.order_info.length - 1) + "</div></td>";
            }
        }
        markup += "</tr></table>";

        return markup;
    },

    handleXhrError: function (err, response) {
        switch (err.status) {
            case 0:
                commonjs.showError('messages.errors.notconnected');
                break;
            case 404:
                commonjs.showError('messages.errors.requestnotfound');
                break;
            case 500:
                commonjs.showError('messages.errors.serversideerror');
                break;
            default:
                commonjs.showError('messages.errors.someerror');
                break;
        }
    },

    serializing2_hstore: function (jsonObject) {
        return commonjs.hstoreStringify(jsonObject);
    },

    serializinghstore: function (jsonObject) {
        var addressInfo = {
            "address1": jsonObject.address1,
            "address2": jsonObject.address2,
            "city": jsonObject.city,
            "state": jsonObject.state,
            "zip": jsonObject.zip,
            "contactNo": jsonObject.contactNo,
            "email": jsonObject.email,
            "website": jsonObject.website
        };
        return commonjs.hstoreStringify(addressInfo);
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

    dicomLibrary: function (sopUid) {
        return (commonjs.jsonDicomSOP[sopUid]) ? commonjs.jsonDicomSOP[sopUid] : "";
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

    bindDropdownArray: function (arrayValue, isSelect, isAll, isFromAETitle) {
        var settingsArray = [];
        if (isSelect) {
            settingsArray.push({
                id: '',
                text: 'Select'
            });
        }
        if (isAll) {
            settingsArray.push({
                id: '-1',
                text: 'All',
                code: 'All'
            });
        }
        for (var i = 0; i < arrayValue.length; i++) {
            if (isFromAETitle) {
                settingsArray.push({
                    id: arrayValue[i].id,
                    text: arrayValue[i].ae_title
                });
            }
            else {
                settingsArray.push({
                    id: arrayValue[i].id,
                    text: arrayValue[i].modality_name,
                    code: arrayValue[i].modality_code
                });
            }
        }
        return settingsArray;
    },

    bindRemoteAETitleArray: function (arrayValue, isSelect) {
        var settingsArray = [];
        if (isSelect) {
            settingsArray.push({
                id: '',
                text: 'Select'
            });
        }
        var id = '';
        for (var i = 0; i < arrayValue.length; i++) {
            id = arrayValue[i].ae_title + '^' + arrayValue[i].host_name + '^' + arrayValue[i].port;
            settingsArray.push({
                id: id,
                text: arrayValue[i].ae_title
            });
        }
        return settingsArray;
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
        return app.userInfo.user_type === 'SU' ? app.facilities : app.userfacilities
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

    /**
     * Helper method that takes an array of modifier codes, filters down to ones matching on app.modifiers where
     * 'displayOnScheduleBook' option is true, and then returns a string of matched descriptions joined by ', '
     *
     * @param {Array} modifiers - ['TC', 'UP']
     * @returns {String}
     */
    getModifierDescriptionsSummary: function(modifiers) {
        // 1. get list of modifier codes from study
        var studyModifiers = _(modifiers)
            .map(_.values)
            .flatten()
            .uniq()
            .value();

        // 2. create list of modifier codes that should be shown on schedule book
        var codes = _(app.modifiers)
            .filter({'displayOnSchedulebook': 'true'})
            .map('code')
            .value();

        // 3. get the ones that match on list 1 in 2
        var matches = _.filter(studyModifiers, function(val) { return _.includes(codes, val) });

        // 4. get the descriptions from the matched modifiers
        return _.reduce(app.modifiers, function (arr, mod) {
            if (_.includes(matches, mod.code)) {
                arr.push(mod.description);
            }

            return arr;
        }, []).join(', ');
    },

    getDefaultLocationByUser: function (userFacilities, Facilities, isSelect) {
        var settingsArray = [];
        if (isSelect) {
            settingsArray.push({
                id: '',
                text: 'Select'
            });
        }
        for (var i = 0; i < Facilities.length; i++) {
            for (var j = 0; j < userFacilities.length; j++) {
                if (Facilities[i].id == userFacilities[j]) {
                    settingsArray.push({
                        id: Facilities[i].id,
                        text: Facilities[i].facility_name
                    });
                }
            }
        }
        return settingsArray;
    },

    showStatus: function (msg) {
        commonjs.notify(msg, 'success');
    },

    showWarning: function (msg, classname, isCustomWarning, time_out) {
        return commonjs.notify(msg, 'warning');

        var warnClass = (classname) ? classname : 'smallwarning';
        var timeOut = (time_out) ? time_out : 3000;
        commonjs.hideLoading();
        $("#divWarning").removeClass("smallwarning mediumwarning largewarning").addClass(warnClass);
        $('#divWarning').show();
        if (isCustomWarning) {
            $('#divWarningMsg').html(msg);
        }
        else {
            if (i18n.get(msg) == app.currentCulture + '.' + msg) {
                $('#divWarningMsg').html(msg);
            }
            else {
                $('#divWarningMsg').html(i18n.get(msg));
            }
        }
        setTimeout(function () {
            $('#divWarning').hide(300);
        }, timeOut);
    },

    showError: function (msg, isFromService) {
        return commonjs.notify(msg, 'danger');

        commonjs.hideLoading();
        $('#divError').show();
        if (!isFromService && (typeof (i18n) != 'undefined' && i18n.get(msg) != app.currentCulture + '.' + msg)) {
            if (i18n.get(msg)) {
                $('#divErrorMsg').html(i18n.get(msg));
            } else {
                $('#divErrorMsg').html(msg);
            }
        }
        else {
            if (msg == 'messages.errors.accessdenied') {
                $('#divErrorMsg').html('Access denied');
            } else {
                $('#divErrorMsg').html(msg);
            }
        }
        setTimeout(function () {
            $('#divError').hide(300);
        }, 3000);
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
                type: type
            });
    },

    geti18NString: function (localizationString) {
        var i18nString = i18n.get(localizationString);
        if (i18nString == app.currentCulture + '.' + localizationString) {
            return localizationString;
        }
        return i18nString;
    },

    isMailValidate: function (mailID) {
        mailID = $.trim(mailID)
        if (mailID.length > 0) {
            //            var regex = /^([a-zA-Z0-9_.+-])+\@(([a-zA-Z0-9-])+\.)+([a-zA-Z0-9]{2,4})+$/;
            var regex = /^([a-zA-Z0-9_\.\-])+\@(([a-zA-Z0-9])+\.)+([a-zA-Z0-9]{2,4})+$/;
            if (regex.test(mailID)) {
                return true;
            }
            else {
                return false;
            }
        }
        else
            return true
    },
    isValidateHeight: function (heightID) {
        heightID = $.trim(heightID)
        if (heightID.length > 0) {
            if (heightID < 100) {
                return true;
            }
            else {
                return false;
            }
        }
        else
            return true
    },
    isValidateWeight: function (weightID) {
        weightID = $.trim(weightID)
        if (weightID.length > 0) {
            if (weightID < 1000) {
                return true;
            } else {
                return false;
            }
        } else
            return true;
    },
    /**
     * Converts and formats patient height
     * @param height <string>
     * @param convention <string>
     * @returns <string>
     */
    formatPatientHeight: function (height, convention) {
        var r = "";

        if (height && !isNaN(height) && convention) {
            switch (convention) {
                case 'feet':
                    if (height.toString().includes(".") || parseInt(height) < 10) {
                        r = height.toString();
                        if (!r.includes(".")) r += ".0";
                    }
                    else {
                        r = parseInt(parseFloat(height) / 12) + "." + parseInt(parseFloat(height) % 12);
                    }
                    break;

                case 'inches':
                    if (height.toString().includes(".") || parseInt(height) < 10) {
                        r = parseInt(parseFloat(height) * 12);
                    }
                    else {
                        r = parseInt(height);
                    }
                break;
            }
        }

        return r.toString();
    },
    isMaskValidate: function () {
        $(".maskPhone").inputmask({ mask: "[(999)999-9999", skipOptionalPartCharacter: ["(", ")"] });
        $(".postal-code-mask").inputmask({mask:"99999[-9999]"});
        $(".maskSSN").inputmask("999-99-9999");
        $(".maskDate").inputmask();
        var dateTemplate = moment(new Date('December 31, 2017'))
            .format('L')
            .replace(/12/, 'MM')
            .replace(/31/, 'DD')
            .replace(/2017/, 'YYYY');
        $(".maskDateLocale").inputmask(dateTemplate.toLowerCase(), {"placeholder": dateTemplate});
        $(".maskDateMonth").inputmask("mm/dd/yyyy", { "placeholder": "MM/DD/YYYY" });
        $(".maskMonthYear").inputmask("mm/yyyy", { "placeholder": "MM/YYYY" });
        //$(".maskMonthYear").inputmask("dd/MM/yyyy hh:mm:ss",{ "placeholder": "dd/MM/yyyy hh:mm:ss" });
        $(".maskHourmin").inputmask("h:s", { "placeholder": "HH/MM" });
        $(".maskYear").inputmask("9999", { "placeholder": "YYYY" });
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
    },

    showLoadingMessage: function (msg) {
        $('#divLoading').css('display', 'block');
        $('#divLoadingMsg').css('display', 'block');
        $('#divLoadingMsg').html(msg);
    },

    hideMenu: function (isPatient) {
        //$('#body_content>div:eq(0)').hide()
        $('header.header').hide();
        $('.page-header').hide();
        switch (commonjs.currentModule) {
            case 'Home':
            case 'Order':
                commonjs.hideOrderMenu();
                break;
            case 'Setup':
                commonjs.hideSetupMenu();
                break;
            case 'Patient':
                $('#body_content>div:eq(1)').removeClass('col-md-10').addClass('col-md-11');
                //$("#divPatientFrame").css({"float": "none"});
                //$("#divPatientFrame").css({"margin-right": "0px"});
                break;
        }
        $('#indexHeader').hide();
        //$('body').attr('style', "padding-top :5px !important;");
    },

    hideSetupMenu: function () {
        $('#divSetupMain').removeClass('col-sm-9 col-md-9 col-lg-9').addClass('col-sm-12 col-md-12 col-lg-12');
        $('#divSetupSideMenu').hide();
        $("#divSetupMain").css({ "float": "none" });
        $("#divSetupMain").css({ "margin-right": "0px" });
        $("#divSetupMain").css({ "margin-left": "0px" });
        $('#body_container').removeClass('sidebar-left');
        $('#left, #top').hide();
        $('#content').removeClass('col-sm-8 col-md-8 col lg-8');
        $('#wrap').show();
        $('#wrap > #content').css('position', 'inherit');
    },

    hideOrderMenu: function () {
        $('#orderSideMenu').hide('fast');
        $("#pageHeaderTab").hide();
        $('#divOrderFrame').removeClass('col-xs-10').addClass('col-xs-12');
        $('#spInformationHeader').addClass('orderMenuHidden');
        $('#btnMenuHide').hide();
        $('#btnMenuShow').hide(); //change back to show after install FJC
        $('#divOrderFrame').unbind('click');

    },
    showOrderMenu: function () {
        $('#orderSideMenu').show('fast');
        $("#pageHeaderTab").show();
        $('#divOrderFrame').removeClass('col-xs-12').addClass('col-xs-10');
        $('#spInformationHeader').removeClass('orderMenuHidden');
        $('#btnMenuShow').hide();
        $('#btnMenuHide').hide();   //change back To show after install FJC
        $('#divOrderFrame').click(function () {
            commonjs.hideOrderMenu();
        });
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

        // Perform 1 DOM traversal to determine whether any of the comparisons and DOM traversals below are necessary
        /*if ($('#divComp:visible, #ddMPR:visible, #divPOption:visible, #spnimgoption:visible, #volumediv:visible, #updateLink:visible').length) {
         if (_target.id !== 'spnComp' && !(_target.className === 'lblComp' || _target.id === 'ulComp')) {
         $('#divComp:visible').hide();
         }

         // Reduced comparisons via Regular Expressions
         if (!/(spnDwn|spnMPR)\b/g.test(_target.id) && !(_target.className === 'lblMPR' || _target.id === 'ulMPR')) {
         $('#ddMPR:visible').hide();
         }

         if ( !/(spnMenuPT|spnMenuMGFusion)\b/g.test(_target.id) && !/(ulSpace|liPalette|liFusion)\b/g.test(_target.className)) {
         $('#divPOption:visible').hide();
         }

         if (!/(spanImages|spnscrollopt)\b/g.test(_target.id) && !(_target.className === 'spanscroll' || _target.id === 'spantype')) {
         $('#spnimgoption:visible').hide();
         }

         if (!/(volumediv|speaker|mute)\b/g.test(_target.id)) {
         $('#volumediv:visible').hide();
         }

         if (!/(updateLink|updateLinkList|updateSpan)\b/g.test(_target.id)) {
         $('#updateLink:visible').hide();
         }
         }*/
    },

    docResize: function (e) {
        var currentModule = commonjs.currentModule;
        switch (currentModule) {
            case 'Home':
                commonjs.resizeHomeScreen();
                break;
            case 'Setup':
                commonjs.resizeSetupMenu();
                break;
            case 'Order':
                commonjs.setpatientFrameheight();
                break;
            case 'Patient':
                commonjs.resizePatientMenu();
                commonjs.setpatientFrameheight();
                break;
            case 'Main Module':
                siteSettingsGridResize();
                break;
        }
        commonjs.resizeIconMenu();
        if (currentModule !== 'Main Module') {
            $('div.ui-jqgrid > div.ui-jqgrid-view > div.ui-jqgrid-bdiv > div > table.ui-jqgrid-btable').each(function (index) {
                if (!$(this).parents('table.ui-jqgrid-btable').length) {
                    var obj = commonjs.getGridMeasures(jq_isWidthResize, jq_isHeightResize, jq_userWidth, jq_userHeight, jq_offsetWidth, jq_offsetheight);
                    //$(this).jqGrid('setGridWidth', obj.width);
                    if (($(this).attr('id') && $(this).attr('id').indexOf('tblGridOD') == 0) || ($(this).attr('id') && $(this).attr('id').indexOf('tblGridPS') == 0)) // for home page pre-orders and qc grids having buttons under grid
                        $(this).jqGrid('setGridHeight', obj.height - 20);
                    else
                        $(this).jqGrid('setGridHeight', obj.height);
                }
            });

        }
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
        $("#studyTabs li").each(function (index) {
            tabWidth += $(this).width();
        });
        var divWidth = $('#body_content>.tabbable div:eq(1)').width();
        tabWidth = ($(window).width() - divWidth - 60) < tabWidth ? tabWidth : $(window).width() - divWidth - 60;
        var ul_width = 0;
        $.each($('#studyTabs li'), function () {
            ul_width += $(this).outerWidth();
        });
        if ($('#divTabsContainer').width() > ul_width) $('#studyTabs').css({ width: '100%' });
        else $('#studyTabs').css({ width: (ul_width + 50) + 'px' });

        var $divStudyTabsContainer = $('#divStudyTabsContainer');
        var $divclaimsTabsContainer = $('#divclaimsTabsContainer');
        var $subMenu = $divStudyTabsContainer.closest('nav.top-nav');
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
        var divStudyTabsContainerWidth = divUseableSpace - headerIconsWidth;
        $divStudyTabsContainer.css({ width: divStudyTabsContainerWidth });
        $divclaimsTabsContainer.css({ width: divStudyTabsContainerWidth });

        //set gadget Width on window Resize
        var _ww = $(window).width() - 50,
            _gw = 566,
            _rw = _ww % _gw,
            _cols = _ww / _gw,
            _isDecrease = true;
        while (_rw > 50) {
            if (_isDecrease)
                _gw -= 20;
            else
                _gw += 20;
            _rw = _ww % _gw;
            if (_gw < 520) {
                _isDecrease = false;
            }
            if (_gw >= 650)
                break;
        }
        $('#divGadgetSummaryNew .widget.item').css('width', (_gw - 26) + 'px');
        $('#column1 .masonry-wrap').css('width', ($(window).width() - 50 + 'px'));
       // $('#column1').masonry();

    },

    resizeSetupMenu: function () {
        // // Modified by SMH to account for rendered height.  Some of the elements below were returning positive values for $.outerHeight despite being hidden (display:none)
        // $('#content').height($(window).height() - ($('.title-panel').get(0).offsetHeight + $('.sub-top-nav').get(0).offsetHeight + $('#divPageHeaderButtons').get(0).offsetHeight));
        // //$('#content').height($(window).height() - ($('.title-panel').outerHeight() + $('.sub-top-nav').outerHeight()+ $('#divPageHeaderButtons').outerHeight()));

        // //Hide nav arrows if no overflow
        // var subID = $('#tab_setup_menu > li > ul > li.active').prop('id');
        // if (subID) {
        //     if ($('#' + subID + 'SubMenu li:last-child').position().left > $('div.navbar-header').width()) {
        //         $('#btnTabNavLeft').show();
        //         $('#btnTabNavRight').show();
        //     } else {
        //         $('#btnTabNavLeft').hide();
        //         $('#btnTabNavRight').hide();
        //     }
        // }
    },

    resizePatientMenu: function () {
        //if($('.page-details-panel').is(":visible")){
        //    $('#divPatientFrame').height($(window).outerHeight()-($('.topbar').outerHeight() + $('.header').outerHeight() + $('.page-details-panel').outerHeight() + $('.top-nav').outerHeight() +10 ));
        //}else {
        //    if ($('#spInformationHeader').length > 0) {
        //        $('#divPatientFrame').height($(window).outerHeight() - ($('.topbar').outerHeight() + $('.header').outerHeight() + $('.page-details-panel').outerHeight() + $('.top-nav').outerHeight() + 10 ));
        //    } else {
        //        $('#divPatientFrame').height($(window).outerHeight() - ($('.topbar').outerHeight() + $('.header').outerHeight() + $('.page-details-panel').outerHeight() + $('.top-nav').outerHeight() - 24 ));
        //    }
        //}
        //test
        $('#divPatientFrame').height($(window).outerHeight() - $('header.header:visible').outerHeight() || 0);   //FJC
    },

    resizeCalendar: function () {
        $('#iframe_calandar_container').height($(window).height() - ($('body>#indexHeader').height() + $('body>footer').height()));
    },

    getGridMeasures: function (isWidthResize, isHeightResize, userWidth, userHeight, offsetWidth, offsetHeight) {
        var width, height;
        if (isHeightResize && (typeof userHeight !== 'number' || userHeight > 0)) {
            if (typeof userHeight == 'number') {
                height = userHeight;
            }
            else if (userHeight.indexOf('%') > 0) {
                var whei = $(window).height();
                height = parseInt(userHeight.replace('%', ''));
                height = (whei / 100) * height;
            }
            else {
                height = parseInt(userHeight.replace('%', '').replace('px', ''));
            }
        }
        else {
            //EXA-7310 - For schedule book-> new order screen header was hided , when replace launch login url -> worklist page showing header element.
            if(!$('header.header').is(':visible'))
                $('header.header').show();
            var topnavHieght = $('.header').outerHeight() + $('.top-nav').outerHeight()
            switch (commonjs.currentModule) {
                case 'Home':
                case 'app':
                default:
                    height = $(window).height() - (topnavHieght + $('.ui-jqgrid-htable:visible').height() + $('#divPager').outerHeight() + 50);
                    break;
                case 'Billing':
                    height = $(window).height() - ($('body>.topbar').outerHeight() + $('body>header').outerHeight() + $('body>.top-nav').outerHeight() + 235);
                    break;
                case 'Setup':
                    height = $(window).height() - ($('header.header').outerHeight() + $('.title-panel').outerHeight() + $('nav.sub-top-nav').outerHeight() + 50);
                    break;
                case 'Patient':
                    height = $(window).height() - ($('header.header').outerHeight() + $('#patientDocHeader').outerHeight() + 200);
                    break;
                case 'Main Module':
                    height = $(window).height() - ($('header.header').outerHeight() + 150);
                    // SMH 2015.7.26
                    // Added to account for the height of the tabs on edit company
                    height = ($('#editCompanyTabs').length > 0) ? height - $('#editCompanyTabs > .nav-tabs').outerHeight() : height;
                    break;
                case 'Order':
                    height = $(window).height() - (50 + 40 + 120) < 100 ? $(window).height() : $(window).height() - (50 + 40 + 120);
                    break;
            }
        }

        //width = width - (offsetWidth ? parseInt(offsetWidth) : 0);
        height = height - (offsetHeight ? parseInt(offsetHeight) : 0);
        //return {width: width, height: height};
        return { height: height };

    },

    setpatientFrameheight: function (isResize) {
        if ($('.formParent').length > 0) {
            $('#divPatientSearchResults').height($('.formParent').height() - ($('.page-details-panel').height() + $('header.header').height() + $('#provideInfo').height() + $('#searchForm').height() + 25));
            //$('#divPatientSearchResults').width($('.formParent').width() - 30);
        }
    },

    setorderFrameheight: function () {
        if (!orderFrameVisited) {
            if ($('#ordermenu_ul')[0])
                $('#ordermenu_ul').css({ 'min-height': ($('#ordermenu_ul')[0].clientHeight) + 'px' });
            orderFrameVisited = true;
        }
        $('#orderSideMenu').height($('#divOrderFrame').height() + 5);
        // $('#orderSideMenu').height($('div#body_container').height() - 51);
        $('#orderSideMenu .nav-tabs').css('min-height', $('#divOrderFrame').height());
    },

    activatelink: function (settingsTitle) {
        var i18nAttr = this.getMenui18nName(settingsTitle);
        if (settingsTitle != "") {
            settingsTitle += "\n<span class='caret' data-original-title='' title=''></span>";
            $("#activeMenu").html(settingsTitle);
            $("#activeMenu").attr('i18n', i18nAttr);
        }
    },

    getMenui18nName: function (screenName) {
        switch (screenName.toUpperCase()) {
            case 'OFFICE':
                return 'menuTitles.setup.office';
            case 'PROVIDERS':
                return 'menuTitles.setup.providers';
            case 'SCHEDULING & CODES':
                return 'menuTitles.setup.schCodes';
            case 'DICOM':
                return 'menuTitles.setup.dicom';
            case 'BILLING':
                return 'menuTitles.masterPageMenu.billing';
            case 'MEANINGFUL USE':
                return 'menuTitles.masterPageMenu.meaningfulUse';
            case 'USER MANAGEMENT':
                return 'menuTitles.setup.userMgmt';
            case 'MOBILE RAD':
                return 'menuTitles.setup.mobRad';
            case 'GENERAL':
                return 'menuTitles.setup.general';
            case 'HL7'  :
                return 'menuTitles.setup.hl7';
            case 'LOG'  :
                return 'menuTitles.setup.log';
            case 'STRUCTURED REPORTING'  :
                return 'menuTitles.setup.cardiology';
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

    loadStatusCodes: function () {
        // if (!commonjs.isHomePageVisited) {
        $.ajax({
            url: '/getStatusCode',
            type: "GET",
            data: {},
            success: function (data, response) {
                commonjs.setupStatusCodes(data.response);
            },
            error: function (err, response) {
                commonjs.handleXhrError(err);
            }
        });
        //  }
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

    hideOrderMenu: function () {
        $('.viztek-nav').hide();
        $('.order-menu-panel').hide();
        $('#divOrderFrame').removeClass('menu-open');
    },

    refreshUserSettings: function () {
        commonjs.changeCss();
    },

    bindPatientSummary: function (patientID) {
        jQuery.ajax({
            url: "/getpatientSummary",
            type: "GET",
            data: {
                id: patientID
            },
            success: function (data, textStatus, jqXHR) {
                if (data.response.length > 0)
                    var response = data.response[0];
                var patient_info = commonjs.hstoreParse(response.patient_info);
                var summary = '<section style="margin-top:25px;">' + '<p id="p_full_name" style="font-weight: bold">' + response.full_name + '</p>'
                $('.page-details-panel h4').html(response.full_name);
                $('.page-details-panel').show();
                var isExist = false;
                if (response.account_no) {
                    summary = summary + '<p style="font-weight: bold">' + response.account_no;
                    isExist = true;
                }
                if (response.alt_account_no) {
                    summary = isExist ? summary + ', ' + response.alt_account_no : summary + '<p style="font-weight: bold">' + response.alt_account_no;
                    isExist = true;
                }
                if (response.dicom_patient_id) {
                    summary = isExist ? summary + ', ' + response.dicom_patient_id : summary + '<p style="font-weight: bold">' + response.dicom_patient_id;
                    isExist = true;
                }
                if (isExist) {
                    summary = summary + '</p>';
                    isExist = false;
                }
                if (response.birth_date) {
                    summary = summary + '<p style="font-weight: bold">' + commonjs.getFormattedDate(response.birth_date);
                    isExist = true;
                }
                if (response.gender) {
                    summary = isExist ? summary + ', ' + response.gender : summary + '<p style="font-weight: bold">' + response.gender;
                    isExist = true;
                }
                if (isExist) {
                    summary = summary + '</p>';
                    isExist = false;
                }
                if (patient_info.c1AddressLine1) {
                    summary += '<p style="font-weight: bold">' + patient_info.c1AddressLine1 + '</p>';
                }
                if (patient_info.c1AddressLine2) {
                    summary += '<p style="font-weight: bold">' + patient_info.c1AddressLine2 + '</p>';
                }
                if (patient_info.c1City) {
                    summary += '<p style="font-weight: bold">' + patient_info.c1City;
                    isExist = true;
                }
                if (patient_info.c1State) {
                    summary = isExist ? summary + ', ' + patient_info.c1State : summary + '<p style="font-weight: bold">' + patient_info.c1State;
                    isExist = true;
                }
                if (patient_info.c1Zip) {
                    summary = isExist ? summary + ', ' + patient_info.c1Zip : summary + '<p style="font-weight: bold">' + patient_info.c1Zip;
                    isExist = true;
                }
                if (isExist) {
                    summary = summary + '</p>';
                }
                summary += '</section>';
                $('#li_patientSummary').empty();
                $('#li_patientSummary').append(summary);

                $('.page-details-panel h3').html(response.full_name).show();
                commonjs.patientFacility = response.facility_id;
                $('#hdnPatID').val(patientID);
                $('#hdnRcopiaID').val(response.rcopia_id);
                $('#btnCreatePatient').css("display", "");
                $('#anc_patient_rcopia').css("display", "");
                $('#rcopiaEnable').css("display", "");
                $("#anc_info").attr("href", "#patient/info/" + base64.encode(patientID));
                $("#anc_order_pat_demographics").attr("href", "#patient/patDemographics/" + base64.encode(patientID));
                $("#anc_familyHis").attr("href", "#patient/familyhealthhistory/" + base64.encode(patientID));
                $("#anc_pat_guarantor").attr("href", "#patient/guarantor/" + base64.encode(patientID));
                $("#anc_patientMessages").attr("href", "#patient/patientMessages/" + base64.encode(patientID));
                $("#anc_alert").attr("href", "#patient/alert/" + base64.encode(patientID));
                $("#anc_insurance").attr("href", "#patient/patientinsurance/" + base64.encode(patientID));
                $("#anc_study").attr("href", "#patient/studies/" + base64.encode(patientID) + '/patient');
                if (app.refproviderID > 0) {
                    $("#anc_Encounter").attr("href", "javascript: void(0)");
                    $("#anc_OutsideReferrals").attr("href", "javascript: void(0)");
                }
                else {
                    $("#anc_OutsideReferrals").attr("href", "#patient/outsideReferrals/" + base64.encode(patientID));
                    $("#anc_Encounter").attr("href", "#patient/encounter/" + base64.encode(patientID));
                }
                $("#anc_order").attr("href", "#patient/orders/" + base64.encode(patientID));
                $("#anc_studyForms").attr("href", "#patient/studyForms/" + base64.encode(patientID));
                $("#anc_document").attr("href", "#patient/document/" + base64.encode(patientID));
                $("#anc_paymentHistory").attr("href", "#patient/paymenthistory/" + base64.encode(patientID));
                $("#anc_labOrders").attr("href", "#patient/labOrders/" + base64.encode(patientID));
                $("#anc_Immunizations").attr("href", "#patient/immunization/" + base64.encode(patientID));
                $("#anc_FilmTracking").attr("href", "#patient/filmtracking/" + base64.encode(patientID));
                $("#anc_audit").attr("href", "#patient/auditlog/" + base64.encode(patientID));
                $("#anc_vitalSign").attr("href", "#patient/vitalSign/" + base64.encode(patientID));
                $("#anc_problems").attr("href", "#patient/problems/" + base64.encode(patientID));
                $("#anc_medications").attr("href", "#patient/medications/" + base64.encode(patientID));
                $("#anc_prescriptions").attr("href", "#patient/prescription/" + base64.encode(patientID));
                $("#anc_allergies").attr("href", "#patient/allergies/" + base64.encode(patientID));
                $("#anc_studyDictation").attr("href", "#patient/studydictation/" + base64.encode(patientID));
                $("#anc_toBeReviewed").attr("href", "#patient/toBeReviewed/" + base64.encode(patientID));
                $("#anc_pat_guarantor").attr("href", "#patient/guarantor/" + base64.encode(patientID));
                $("#anc_patient_notes").attr("href", "#patient/notes/0/0/" + base64.encode(patientID));
                commonjs.checkToBeReviewedExist(base64.encode(patientID));
            },

            error: function (err) {
                commonjs.handleXhrError(err);
            }
        });
    },

    bindOrdersEdit: function (orderID, studyID, paymentID, isfrom, amount) {
        console.log("commonjs::bindOrdersEdit, orderID: ", orderID, " studyID: ", studyID, " parent.studyID: ", parent.editStudyID);
        orderID = orderID > 0 ?
            orderID :
            0;
        parent.editStudyID = parent.editStudyID > 0 ?
            parent.editStudyID :
            0;
        var self = this;
        //commonjs.loadStatusCodes();
        jQuery.ajax({
            url: "/orders",
            type: "GET",
            // This call is made synchronous even though it is depracated and not a good proactice in general.
            // REASON:
            //      This function does not return a promise or offer a callback, yet it is being used in many places
            //      where other parts of the code (which are async) depend on certain hidden fields to be
            //       set(see $("#hdnXXXXX").val() calls below)
            //
            async: false,
            //
            data: {
                customArgs: {
                    orderID: orderID,
                    flag: 'home_order',
                    studyID: parent.editStudyID
                }
            },
            success: function (data, textStatus, jqXHR) {
                if (commonjs.isValidResponse(data)) {
                    if (data.result.length > 0) {
                        // if ($('#divOrderFrame').length > 0) $('#divOrderFrame').css({top: '40px'});
                        $("#hdnStudyID").val(parent.editStudyID);
                        var patientid = data.result[0].patient_id;
                        var orderid = data.result[0].id;
                        var transStudy = $('#ddlTranscriptionStudy');
                        transStudy.empty();
                        commonjs.patientFacility = data.result[0].pat_facility_id;
                        var option = null;
                        var _ulPriorStudyList = $('#ulPriorStudyList').empty(),
                            _ulStudyList = $('#ulStudyList').empty();
                        var orderDetails = data.result[0].order_info || {};
                        var payertype = commonjs.getPayerType(orderDetails.billing_payer_type);
                        var billingMethod = commonjs.getBillingMethod(orderDetails.billing_method);
                        if (data.result[0].studyInfo.length > 0) {

                            transStudy.append('<optgroup label="Study" />');
                            if (typeof (studyID) == 'undefined' || (typeof (studyID) != 'undefined' && !studyID))
                                _ulStudyList.prev().prev().text('Study : ' + (data.result[0].studyInfo[0].study_description ? data.result[0].studyInfo[0].study_description : '(Empty Study Description)'));
                            for (var i = 0; i < data.result[0].studyInfo.length; i++) {
                                if (studyID && data.result[0].studyInfo[i].id == studyID)
                                    _ulStudyList.prev().prev().text('Study : ' + (data.result[0].studyInfo[i].study_description ? data.result[0].studyInfo[i].study_description : '(Empty Study Description)'));
                                //Binding to UL
                                _ulStudyList.append(
                                    $('<li></li>').append(
                                        $('<a href="#"></a>')
                                            .text(data.result[0].studyInfo[i].study_description ? data.result[0].studyInfo[i].study_description : '(Empty Study Description)')
                                            .attr({
                                                'studyid': data.result[0].studyInfo[i].id,
                                                'orderid': data.result[0].studyInfo[i].order_id,
                                                "data-statLevel": data.result[0].studyInfo[i].stat_level,
                                                'dicomstatus': data.result[0].studyInfo[i].dicom_status
                                            }).click(function () {
                                                _ulStudyList.prev().prev().text('Study : ' + $(this).text());
                                                _ulPriorStudyList.prev().prev().text('Prior Study : Select');
                                                $('#ddlTranscriptionStudy').val($(this).attr('studyid')).change();
                                            })
                                    )
                                );
                                transStudy.append($('<option>',
                                    {
                                        "value": data.result[0].studyInfo[i].id,
                                        "data-value": data.result[0].studyInfo[i].order_id,
                                        "data-dicomstatus": data.result[0].studyInfo[i].dicom_status,
                                        "data-statLevel": data.result[0].studyInfo[i].stat_level
                                    }).text(data.result[0].studyInfo[i].study_description));
                            }
                        }

                        if (data.result[0].priorInfo && data.result[0].priorInfo.length > 0) {
                            transStudy.append('<optgroup label="Prior Study" />');
                            _ulPriorStudyList.parent().show();
                            for (var i = 0; i < data.result[0].priorInfo.length; i++) {
                                //Binding to UL
                                _ulPriorStudyList.append(
                                    $('<li></li>').append(
                                        $('<a href="#"></a>')
                                            .text(data.result[0].priorInfo[i].study_description ? data.result[0].priorInfo[i].study_description : '(Empty Study Description)')
                                            .attr({
                                                'studyid': data.result[0].priorInfo[i].id,
                                                'orderid': data.result[0].priorInfo[i].order_id,
                                                'dicomstatus': data.result[0].priorInfo[i].dicom_status
                                            }).click(function () {
                                                _ulStudyList.prev().prev().text('Study : Select');
                                                _ulPriorStudyList.prev().prev().text('Prior Study : ' + $(this).text());
                                                $('#ddlTranscriptionStudy').val($(this).attr('studyid')).change();
                                            })
                                    )
                                );
                                transStudy.append($('<option>',
                                    {
                                        "value": data.result[0].priorInfo[i].id,
                                        "data-value": data.result[0].priorInfo[i].order_id,
                                        "data-dicomstatus": data.result[0].priorInfo[i].dicom_status,
                                        "data-statLevel": data.result[0].priorInfo[i].stat_level
                                    }).text(data.result[0].priorInfo[i].study_description));
                            }
                            $("#btnEditPriorStudyChange").text('Prior Studies: Select');
                        }
                        else { //If no records found
                            _ulPriorStudyList.parent().hide();
                            _ulPriorStudyList.prev().prev().text('Prior Study: Not Found');
                        }

                        var study_id = studyID ? studyID : data.result[0].study_id;
                        // binding url for summary and billing link which is edit from billing
                        var arr = [], locationUrl = $("#side_nav_study_summary").children().attr('href');
                        if (locationUrl.indexOf('claimmanagement') != -1) {
                            locationUrl = locationUrl && locationUrl.split('?') ? locationUrl.split('?') : '';
                            $.each(locationUrl[1].split('&'), function (c, q) {
                                var i = q.split('=');
                                var key = i[0].toString(), val = i[1].toString();
                                arr[key] = val;
                            });
                        }
                        var loadUrl = arr;
                        if (loadUrl && loadUrl.isFrom && loadUrl.isFrom == 'claimmanagement') {
                            $("#anc_order_summary").attr("href", "#order/summary/" + orderid + '/?' + 'tableId=' + loadUrl.tableId + '&rowId=' + orderid + '&isFrom=claimmanagement');
                            $("#anc_order_allIns").attr("href", "#order/allInsurance/" + base64.encode(orderid) + "/" + base64.encode(patientid) + "/" + base64.encode(0) + "/" + base64.encode('claimmanagement') + '?' + 'tableId=' + loadUrl.tableId + '&rowId=' + orderid + '&isFrom=claimmanagement');
                        } else {
                            $("#anc_order_summary").attr("href", "#order/summary/" + orderid);
                            $("#anc_order_allIns").attr("href", "#order/allInsurance/" + base64.encode(orderid) + "/" + base64.encode(patientid) + "/" + base64.encode(parent.editStudyID.toString()));
                        }
                        if (studyID) {
                            $('#ddlTranscriptionStudy').val(studyID);
                        }
                        var cpobj = "";
                        cpobj = $.grep(data.result[0].studyInfo, function (e) {
                            return e.id == $('#ddlTranscriptionStudy').val();
                        });

                        var ddltransStudy = $('#ddlTranscriptionStudy').val() == "" ? 0 : $('#ddlTranscriptionStudy').val();
                        var orderPatSummary = "", studyStat = "";
                        orderPatSummary = '<p><b>Patient Name :</b>' + data.result[0].last_name + ', ' + data.result[0].first_name
                            + '  ' + '<b>(</b>' + ' ' + data.result[0].account_no + ' ' + '<b>)</b>' + ' ' + ' <b>DOB : </b>' + data.result[0].birth_date + '</p>';

                        var payerWithBillingMethod = (payertype.toLowerCase() != 'patient') ? payertype + " ( " + billingMethod + " )" : payertype;
                        $("#lblBillingMethod").html(payerWithBillingMethod);
                        orderDetails.payer_billing_method = orderDetails.payer_billing_method == 'undefined' ? (orderDetails.billing_method != '' ? orderDetails.billing_method : '') : orderDetails.payer_billing_method;
                        $("#hdnBillingMethod").val(orderDetails.payer_billing_method != '' ? orderDetails.payer_billing_method : null);  // bind hidden value of billing method for claim validate
                        //$('<span></span>').html(
                        //    '<span id="spnEditPatName">' + data.result[0].last_name + ', ' + data.result[0].first_name + '</span>'
                        //    + '<span style="font-size: 13px; font-weight: bold;">'
                        //    + ' (Acc#: ' + data.result[0].account_no + '), '
                        //    + data.result[0].birth_date
                        //    + ', ' + data.result[0].gender
                        //    + '</span>'
                        //).appendTo($("#divPageHeaderScreenEditOrder").html(''));
                        if (!$(parent.document).find('#spanModalHeader span').length) {
                            var header = $(parent.document).find('#spanModalHeader').html();
                            $(parent.document).find('#spanModalHeader').html('<span>' + header + ' <STRONG>' + data.result[0].last_name + ', ' + data.result[0].first_name + '</STRONG> (Acc#:' + data.result[0].account_no + '), <i>' + data.result[0].birth_date + '</i> , ' + data.result[0].gender + '</span>');
                        }
                        $("#divStatStudy")
                            .html("")
                            .html('<span id="spanStudyStat"></span>');
                        $('#spanStudyStat')
                            .html("")
                            .css('background-color', "")
                            .css('color', "");

                        if (cpobj != "" && cpobj.length > 0) {
                            if ($("#hdnIsStudy").val() == "true") {
                                $('#btnEditPriorStudyChange').text($("#hdnNamePriorStudy").val() + ': ' + cpobj[0].study_description);
                            }
                            else {
                                $('#btnEditStudyChange').text($("#hdnNameStudy").val() + ' : ' + cpobj[0].study_description);
                            }

                            // Blinking Stat Box
                            if (cpobj[0].stat_level > 0 && app.stat_level && app.stat_level.length > 0 && !app.stat_level[cpobj[0].stat_level].deleted) {
                                $('#spanStudyStat').css('color', app.stat_level[cpobj[0].stat_level].text_color);
                                $('#spanStudyStat')
                                    .html(app.stat_level[cpobj[0].stat_level] && app.stat_level[cpobj[0].stat_level].description ? app.stat_level[cpobj[0].stat_level].description : "")
                                    .css('background-color', app.stat_level[cpobj[0].stat_level] && app.stat_level[cpobj[0].stat_level].color ? app.stat_level[cpobj[0].stat_level].color : "")
                                    .css('color', app.stat_level[cpobj[0].stat_level] && app.stat_level[cpobj[0].stat_level].text_color ? app.stat_level[cpobj[0].stat_level].text_color : "");
                                commonjs.blinkStat('#spanStudyStat');
                            }

                            $("#hdnPriority").val(cpobj[0].priority);
                        }
                        $("#hdnRcopiaID").val(data.result[0].rcopia_id);
                        $("#hdnOrderFacID").val(data.result[0].facility_id);
                        $("#hdnOrderModID").val(data.result[0].modality_id);
                        $("#hdnOrderModRoomID").val(data.result[0].modality_room_id);
                        $("#hdnPatDOB").val(data.result[0].birth_date);
                        $("#hdnOrderSchDate").val(data.result[0].scheduled_dt);
                        $("#hdnOrderDate").val(data.result[0].ordered_dt);
                        $("#hdnQuickAppt").val(data.result[0].is_quick_appt);
                        var order_status = data.result[0].order_status ? data.result[0].order_status : "";
                        $("#hdnOrderStatus").val(order_status);

                        if (data.result[0].studyInfo.length > 0) {
                            $('#divtransStudy').show();
                            //                                $('#divSpanStudy').hide();
                            $("#anc_order_transcription").attr("href", "#order/transcription/" + orderid + "/" + ddltransStudy + "/" + patientid + "/order");
                            if (isfrom) {
                                $("#anc_order_chargePayments").attr("href", "#order/chargepayment/" + orderid + "/" + ddltransStudy + "/" + paymentID + '?isFrom=' + isfrom + '&a=' + amount);
                            } else {
                                $("#anc_order_chargePayments").attr("href", "#order/chargepayment/" + orderid + "/" + ddltransStudy);
                            }
                            if (app.homeOpentab == "OD")
                                $("#anc_order_chargePayments").attr("href", "javascript: void(0)");

                            $("#anc_order_notes").attr("href", "#order/notes/" + orderid + "/" + ddltransStudy + '/' + patientid);

                            if (cpobj && cpobj.length > 0 && (cpobj[0].study_status === "APP" || cpobj[0].study_status === "APCD" || cpobj[0].study_status === "PRAP")) {
                                $("#anc_order_approvedreport").attr("href", "#order/report/" + orderid + "/" + ddltransStudy + "/order/" + patientid);
                            } else
                                $("#anc_order_approvedreport").attr("href", "javascript: void(0)");

                            if (cpobj && cpobj.length > 0 && (cpobj[0].study_status === "APP" || cpobj[0].study_status === "APCD" || cpobj[0].study_status === "PRAP"))
                                $("#side_nav_p_peerReview").show();

                            var patientName = data.result[0].full_name;
                            if ((cpobj && cpobj.length > 0) && (cpobj[0].study_status === "UNR" || cpobj[0].study_status == "DIC" || cpobj[0].study_status == "TRAN" || cpobj[0].study_status == "DRFT" || cpobj[0].study_status == "APP" || cpobj[0].study_status == "PRAP" || cpobj[0].study_status == "RE")) {
                                $("#anc_order_transcription").attr("href", "#order/transcription/" + orderid + "/" + ddltransStudy + "/" + patientid + "/order/" + patientName + "?study_status=" + (cpobj[0] && cpobj[0].study_status ? cpobj[0].study_status : ''));
                            } else {
                                $("#anc_order_transcription").attr("href", "javascript: void(0)");
                            }
                            if (cpobj && cpobj.length > 0)
                                $("#anc_order_problems").attr("href", "#order/problems/" + base64.encode(patientid) + '/order' + '/' + orderid + "?study_id=" + cpobj[0].id);
                            /*$('#spanTranStudy').html("").hide();*/
                            var dicomStatus = $('select#ddlTranscriptionStudy option:selected').data("dicomstatus");
                        }
                        else {
                            $('#divtransStudy').hide();
                            //                                $('#divSpanStudy').show();
                            $('#spanTranStudy').html("Quick Appointment").show();
                        }

                        var claimValidate = commonjs.checkScreenRight('Claim Validate', true);

                        if (order_status != "SCH" && order_status != "ORD" && order_status != "CON" && order_status != "CAN" && order_status != "ABRT" && order_status != "NOS" && claimValidate) {
                            $("#btnValidateSchEDI").show();
                        }

                        if (data.result[0].studyInfo[0].ae_title == 'OPALIMPORT') {
                            $("#btnValidateSchEDI").hide();
                            $("#spanAETitle").html("OPALIMPORT")
                        }
                        $("#hdnOrderID").val(orderid);
                        $("#hdnPatientID").val(patientid);
                        $("#hdnChangeStudyID").val(false);
                        $('#btnEditStudyChange').text('Study : ' + $('#ddlTranscriptionStudy option:selected').text());
                        var study_id = studyID ? studyID : data.result[0].study_id;
                        commonjs.edited_study_id = study_id;
                        $("#anc_order_studyinfo").attr("href", "#order/studyinfo/" + orderid + "/" + patientid + "?order_status=" + data.result[0].order_status + "&has_deleted=" + data.result[0].has_deleted + '&f=' + parent.commonjs.study_facility_id + '&mod=' + data.result[0].modality_id + '&study_id=' + study_id);
                        $("#anc_order_refprovider").attr("href", "#order/refprov/" + orderid + "?p_id=" + patientid);
                        $("#anc_order_priorstudies").attr("href", "#order/studies/" + base64.encode(orderid) + "/" + base64.encode(patientid));
                        $("#anc_order_icd").attr("href", "#order/icd/" + orderid + "?p_id=" + patientid);
                        $("#anc_order_alert").attr("href", "#order/alert/" + base64.encode(patientid) + "/" + base64.encode(orderid));
                        $("#anc_order_familyHis").attr("href", "#order/familyhealthhistory/" + base64.encode(patientid));
                        $("#anc_order_additionalinfo").attr("href", "#order/additionalinfo/" + orderid + "?p_id=" + patientid);
                        $("#anc_order_ccRos").attr("href", "#order/ccros/" + orderid + "/" + patientid);
                        $("#anc_order_medicalHistory").attr("href", "#order/medicalhistory/" + orderid + "/" + patientid + "?order_status=" + data.result[0].order_status);
                        $("#anc_order_patientinfo").attr("href", "#order/patient/" + base64.encode(patientid) + "/" + base64.encode(orderid));
                        $("#anc_order_insurance").attr("href", "#order/patientinsurance/" + base64.encode(orderid) + "/" + base64.encode(patientid));
                        $("#anc_order_labOrders").attr("href", "#order/labOrders/" + base64.encode(patientid) + "?from=order&order_id=" + orderid);
                        $("#anc_order_vitalSigns").attr("href", "#order/vitalSign/" + base64.encode(patientid) + '/' + orderid + '/order');
                        $("#anc_order_medications").attr("href", "#order/medications/" + base64.encode(patientid) + '/encounter' + '/' + orderid);
                        $("#anc_order_prescriptions").attr("href", "#order/prescription/" + base64.encode(patientid) + '/order' + '/' + orderid);
                        $("#anc_order_problems").attr("href", "#order/problems/" + base64.encode(patientid) + '/order' + '/' + orderid + '?study_id=' + ddltransStudy);
                        $("#anc_order_immunization").attr("href", "#order/immunization/" + base64.encode(patientid) + '/order' + '/' + base64.encode(orderid));
                        $("#anc_order_pat_demographics_order").attr("href", "#order/patDemographics/" + base64.encode(patientid) + '/order' + '/' + base64.encode(orderid));
                        $("#anc_order_allergies").attr("href", "#order/allergies/" + base64.encode(patientid) + '/encounter' + '/' + orderid);
                        $("#anc_order_documents").attr("href", "#order/document/" + base64.encode(orderid) + "/" + base64.encode(patientid));
                        if (app.homeOpentab === "OD")
                            $("#anc_order_allIns").attr("href", "javascript: void(0)");
                        else
                            $("#anc_order_allIns").attr("href", "#order/allInsurance/" + base64.encode(orderid) + "/" + base64.encode(patientid) + "/" + base64.encode(parent.editStudyID.toString()));
                        $("#anc_order_customforms").attr("href", "#order/orderCustomForms/" + orderid + "?p_id=" + patientid);
                        $("#anc_order_studyforms").attr("href", "#order/orderStudyForms/" + orderid + "?p_id=" + patientid);
                        order_status != "ORD" ? $("#anc_order_followUps").attr("href", "#order/orderFollowUps/" + orderid + "?p_id=" + patientid) : $("#anc_order_followUps").attr("href", "javascript: void(0)");
                        $("#anc_order_referrals").attr("href", "#order/referrals/" + orderid + "?p_id=" + patientid);
                        $("#anc_order_educationMaterial").attr("href", "#order/studyEducationMaterial/" + orderid + "/" + patientid + "/" + data.result[0].facility_id);
                        $("#anc_order_clinicalSummary").attr("href", "#order/clinicalOverview/" + orderid + "/" + patientid + "/" + (data.result[0] && data.result[0].full_name));
                        $("#anc_order_auditlog").attr("href", "#order/auditlog/" + orderid);

                        $("#anc_order_peerReview").attr("href", "#order/peerReview/" + base64.encode(parent.editStudyID.toString()) + "/" + base64.encode(patientid) + "/" + base64.encode(orderid));
                        if (orderDetails.muDataCaptured == 'true') {
                            $('#chkMUDataCapture').prop('checked', orderDetails.muDataCaptured == 'true');
                            $('#spnUpdatedDt').text(orderDetails.updated_dt);
                            $('#spnUpdatedBy').text(orderDetails.updated_by);
                            $('#lblUpdatedBy').show();
                            $('#lblUpdatedDt').show();
                        }
                        else {
                            $('#lblUpdatedBy').hide();
                            $('#lblUpdatedDt').hide();
                        }
                        commonjs.orderFacility = data.result[0].facility_id ? data.result[0].facility_id : 0;
                        self.rendered = true;
                        commonjs.setorderFrameheight();

                        // Patient Alerts
                        var patient_alerts = data.result[0].patient_alerts;
                        //patient_alerts = typeof response.result.alerts != "object" ? commonjs.formatJson(response.result.alerts) : response.result.alerts;
                        if (patient_alerts && patient_alerts.alerts && patient_alerts.others) {
                            var alert_count = parseInt(patient_alerts.alerts.length) + parseInt(patient_alerts.others.length);
                        }
                        if (alert_count > 0) {
                            $("#alertBadge").html(alert_count).css("visibility", "visible");
                            $("#editStudyShowPatientAlerts").attr("title", "This patient has " + alert_count + " alerts");
                        }
                        else {
                            $("#alertBadge").css("visibility", "hidden");
                            $("#editStudyShowPatientAlerts").attr("title", "This patient has no alerts");
                        }

                        // ALERT click event
                        $("#editStudyShowPatientAlerts").unbind("click");
                        $("#editStudyShowPatientAlerts").click(function () {
                            commonjs.showPatientAlerts(patient_alerts);
                        });
                    }
                }
            },
            error: function (err) {
                commonjs.handleXhrError(err);
            }
        }
        );
        $('#chkMUDataCapture').on('click', function (e) {
            var cpatureCompleted = $(e.target).prop('checked');
            $.ajax({
                type: 'POST',
                url: '/updateMUOrderCapture',
                data: {
                    muCaptured: cpatureCompleted,
                    order_id: $("#hdnOrderID").val(),
                    updated_dt: cpatureCompleted ? commonjs.getFormattedDate(new Date()) : '',
                    updated_by: cpatureCompleted ? app.userInfo.userFullName : ''
                },
                success: function (data, response) {
                    commonjs.showStatus('MU Data Capture updated');
                    if (!cpatureCompleted) {
                        $('#lblUpdatedBy').hide();
                        $('#lblUpdatedDt').hide();
                    }
                    else {
                        $('#spnUpdatedDt').text(commonjs.getFormattedDate(new Date()));
                        $('#spnUpdatedBy').text(app.userInfo.userFullName);
                        $('#lblUpdatedBy').show();
                        $('#lblUpdatedDt').show();
                    }
                },
                error: function (err, status) {
                    err
                }
            })
        })
    },

    showPatientAlerts: function (pa) {
        var self = this;
        var alert_count = 0;

        if ((pa && pa.alerts && pa.alerts.length > 0) || (pa && pa.others && pa.others.length > 0)) {
            var html = "<div style='font-size: 16pt; padding: 20px;'>";

            if (pa.alerts && pa.alerts.length > 0) {
                html += "" +
                    "<h3 class='mb'>Alerts</h3>" +
                    "<ul style='margin-left: 30px; margin-bottom: 30px;'>";

                for (var i = 0; i < pa.alerts.length; i++) {
                    html += "   <li>&bull; " + pa.alerts[i] + "</li>";
                    alert_count++;
                }
                html += "</ul>";
            }
            if (pa.others && pa.others.length > 0) {
                html += "" +
                    "<h3 class='mb'>Other Alerts</h3>" +
                    "<ul style='margin-left: 30px; margin-bottom: 30px;'>";

                for (var j = 0; j < pa.others.length; j++) {
                    html += "   <li>&bull; " + pa.others[j] + "</li>";
                    alert_count++;
                }
                html += "</ul>";
            }

            html += "</div>";

            if (alert_count > 0)
                setTimeout(function () {
                    commonjs.showDialog({ header: 'Patients Alerts', i18nHeader: 'menuTitles.patient.patientAlerts', width: '50%', height: '50%', html: html }, true);
                }, 500);

            if (alert_count > 0) {
                $("#alertBadge").html(alert_count).css("visibility", "visible");
            }
            else {
                $("#alertBadge").css("visibility", "hidden");
            }
        } else {
            $('#siteModal').modal('hide');
        }
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
            case "teritary_insurance":
                payer = "Teritary Insurance";
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

    systemUpgrade: function () {
        jQuery.ajax({
            url: "/upgradeinstaller",
            type: "GET",
            data: {},
            success: function (data, textStatus, jqXHR) {
                $('#li_systemUpgrade').hide();
                commonjs.showStatus('System upgraded successfully');
            },
            error: function (err) {
                console.log(err);
            }
        });
    },

    selectApplicationEntity: function (id) {
        $('#tr_send_' + id).toggleClass('customRowSelect');
        $('#i_send_' + id).toggleClass('icon icon-ic-check');
    },

    slimScroll: function (divID, oHeight, minHeight) {
        if (($('#' + divID).length > 0) && $('#' + divID + '> div').length && $('#' + divID + '> div')[0].offsetHeight > $('#' + divID + '.portlet-content').height()) {
            $('#' + divID).slimScroll({
                height: $('#' + divID)[0].offsetHeight + 'px',
                color: '#000000',
                position: 'right'
            }); //033043
        }
        else {
            if (($('#' + divID).length > 0) && $('#' + divID + '> table').length && $('#' + divID + '> table')[0].offsetHeight > $('#' + divID + '.portlet-content').height()) {
                $('#' + divID).slimScroll({
                    height: $('#' + divID)[0].offsetHeight + 'px',
                    color: '#000000',
                    position: 'right'
                }); //033043
            }
        }
    },
    slimScrollDiv: function (divID, height, width) {
        if (!width) {
            width = 'auto';
        }
        $('#' + divID).slimScroll({
            width: width,
            height: height,
            overflow: 'auto',
            position: 'right',
            size: '10px',
            alwaysVisible: false,
            //  distance: '0px',
            railVisible: false,
            //  railOpacity: 0.3,
            wheelStep: 10,
            allowPageScroll: false
            // disableFadeOut: false
        });
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

    huEmit: function (requestArgs, huFlag) {
        if (typeof requestArgs == 'undefined') {
            requestArgs = {
                requestType: 'EMD_WADO',
                modality: 'PT',
                huFlag: 'HU',
                studyUID: '1016658',
                seriesUID: '4762',
                objectUID: '22333',
                locationX: '224.04396984924625',
                locationY: '259.35175879396985',
                rescaleSlope: '1',
                rescaleIntercept: '-1024',
                clientid: '334'
            };
        }

        switch (requestArgs.huFlag.toUpperCase()) {
            case 'HU':
                requestArgs.huFlag = '1';
                break;
            case 'SUV':
                requestArgs.huFlag = '2';
                break;
            case 'PIXEL':
            case 'PX':
                requestArgs.huFlag = '3';
                break;
        }
        if (typeof huFlag != 'undefined') {
            requestArgs.huFlag = huFlag;
        }

        commonjs.socket.emit("hu_request", requestArgs);
    },

    /*matchUpModels: function ( data, changed ) {
        if ( changed.hasOwnProperty('cid') ) {
            changed = _.pick(changed.toJSON(), Object.keys(data));
        }
        return Object.assign({}, data, changed);
    },

    matchUpObjects: function ( data, changed ) {
        /!*var studyInfo = commonjs.hstoreParse(changed.study_info);
        // This is a misnomer - it actually contains the study_status.
        if ( studyInfo.hasOwnProperty('study_description') ) {
            delete studyInfo.study_description;
        }
        var setupChanged = Object.assign({}, changed, studyInfo);*!/
        // var newChanged = _.pick(setupChanged, Object.keys(data));
        var newChanged = _.pick(changed, Object.keys(data));
        return Object.assign({}, data, newChanged);
    },*/

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

        commonjs.socket.on('study_approved', function (data) {
            if (atob(data.sessionID) === app.sessionID) {
                var studyID = data.nextStudyID;
                /**
                 * Make sure viewer has been opened and this is the parent window
                 * (so this doesn't fire multiple times)
                 */
                if (Object.keys(prefetch.windowObj).length > 0 && typeof config === 'undefined') {
                    var gridData = commonjs.getData(studyID);
                    var linked_study_id = gridData.linked_study_id;
                    commonjs.currentGridID = '#tblGrid' + commonjs.currentStudyFilter;
                    if (commonjs.checkDicomStatus(gridData.dicom_status, gridData.no_of_instances) || linked_study_id > 0) {
                        window.studyModality = gridData.modalities;
                        openViewer(studyID);
                    }
                }
            }
        });

        commonjs.socket.on('manual_verification_failed', function () {
            commonjs.showError('Manual eligibility verification failed');
        });

        commonjs.socket.on('third-party-response', function (data) {
            if (data.user < 1) {
                return;
            }
            var userWrap = document.getElementById('user-' + data.user);
            var loaderWrap = userWrap.querySelector('.loading-spinner-holder');
            var iconWrap = userWrap.querySelector('.third-party-tool-icon-wrapper');

            /**
             * Icons should be there by default but different color based on
             * if user is "active" or not.
             */
            if (data.tool_id && data.enabled !== null) {
                var icon = iconWrap.querySelector('.third-party-tool-' + data.tool_id);
                if (icon) {
                    if (data.enabled === true) {
                        icon.classList.add('third-party-tool--enabled');
                    }
                    else {
                        icon.classList.remove('third-party-tool--enabled');
                    }
                }
            }

            loaderWrap.innerHTML = '';
        });

        commonjs.socket.on('third-party-complete', function (data) {
            data.users.some(function (userID) {
                if (Array.isArray(data.tools) && userID == app.userID) {
                    app.thirdParty = data.tools;
                    return true;
                }
            });
        });

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

        commonjs.socket.on('hu_result', function (result) {
            if (typeof window.renderHuValues != 'undefined') {
                console.log(result);
                window.renderHuValues(result);
            }
            else
                console.log(result);
        });

        commonjs.socket.on('open_viewer', function (result) {
            if (result.session === app.sessionID) {
                openViewer(result.study_id);
            }
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

        // Adds name to the lock.  Shows lock icon in all study tabs when viewer is opened
        commonjs.socket.on('viewer_open', function (result) {
            var root = window.parent || window;
            var cjs = root.commonjs;
            var getData = cjs.getData;
            var id = result.study_id;
            var gridData = getData(id) || getData({ 'study_id': id });
            if (gridData) {
                gridData = fixAuth(gridData);
                if (!gridData.locked_by) {
                    gridData.locked_by = result.user_name;
                }
                else {
                    gridData.locked_by += ', ' + result.user_name;
                }
                cjs.setData(gridData, id);
                $("#" + id).addClass("redraw_lock");   // This is a hack that forces the row to redraw. The lock wasn't drawing for some reason.
            }
        });

        // Eliminates names as locks are freed.  Hides lock icon when all locks are released.
        commonjs.socket.on('viewer_closed', function (result) {
            var root = window.parent || window;
            var cjs = root.commonjs;
            var getData = cjs.getData;
            var id = result.study_id;
            var gridData = getData(id) || getData({ 'study_id': id });
            if (gridData) {
                var lockedBy = gridData.locked_by;
                if (typeof lockedBy === 'string') {
                    var re = new RegExp(result.user_name + '(?:, )?');
                    gridData.locked_by = lockedBy.replace(re, "");
                }
                gridData = fixAuth(gridData);
                cjs.setData(gridData, id);
            }
        });

        commonjs.socket.on('study_closed', function (result) {
            var root = window.parent || window;
            var cjs = root.commonjs;
            var getData = cjs.getData;
            var id = result.study_id;
            var gridData = getData(id) || getData({ 'study_id': id });
            if (gridData) {
                gridData.locked_by = '';
                gridData = fixAuth(gridData);
                cjs.setData(gridData, id);
            }
        });

        var appSettingTrigger = function (result, type) {
            var root = window.parent || window;
            var cjs = root.commonjs;
            if (result && result.appsettings) {
                cjs.setAppSettings(result.appsettings, type);
            }
            else {
                //location.href = '/login';
                cjs.redirectToLoginPage();
            }
        };

        commonjs.socket.on('office_trigger', function (result) {
            appSettingTrigger(result, 'facility');
        });

        commonjs.socket.on('appgadget_trigger', function (result) {
            appSettingTrigger(result, 'appgadget');
        });

        commonjs.socket.on('modality_trigger', function (result) {
            appSettingTrigger(result, 'modality');
        });

        commonjs.socket.on('vehicle_trigger', function (result) {
            appSettingTrigger(result, 'vehicle');
        });

        commonjs.socket.on('modalityroom_trigger', function (result) {
            appSettingTrigger(result, 'modalityroom');
        });

        commonjs.socket.on('applicationentity_trigger', function (result) {
            appSettingTrigger(result, 'application_entity');
        });

        commonjs.socket.on('filestore_trigger', function (result) {
            appSettingTrigger(result, 'filestore');
        });

        commonjs.socket.on('userdevice_trigger', function (result) {
            appSettingTrigger(result, 'userdevices');
        });

        commonjs.socket.on('userassignments_trigger', function (result) {
            appSettingTrigger(result, 'assignedStudies');
        });

        commonjs.socket.on('userdelete_trigger', function (result) {
            if (result.user_id == app.userID) {
                alert('User no longer exists.  Please contact your system administrator');
                commonjs.redirectToLoginPage();
            }
        });

        /*commonjs.socket.on('pending_study_trigger', function ( result ) {
            if ( result && result.length > 0 ) {
                var data = result[ 0 ];
                data.record_no = 'NEW';
                commonjs.setData(data);
            }
        });*/

        /*commonjs.socket.on('new_study', function (result) {
            //console.log("socket.on('new_study') result[0]=%j", result[0]);
            var self = this;
            if (result && result.length > 0 && (result[0].company_id == app.companyID)) {
                //result[0].hasCompleted = true;
                // result[0].temp_study_id = 1424;

                //BC: check if filter exists. ignoring new rows until filter reset.
                var hasFilter = commonjs.checkFilterApplied();

                //BC:This check has to be moved to server side eventually so user permission for each study can be done before push.
                var validRow = commonjs.checkValidRow(result);

                if ( validRow && !hasFilter ) {
                    if ($('#tblGridPS').length > 0 && $('#tblGridPS')[0].grid && result[0].hasCompleted) {
                        if (!(app.show_comp_pend_list)) {
                            if ($('#tblGridPS').jqGrid('getRowData', result[0].temp_study_id).study_id > 0) {
                                $('#tblGridPS').jqGrid('delRowData', result[0].temp_study_id);
                            }
                        } else {
                            if ($('#tblGridPS').jqGrid('getRowData', result[0].temp_study_id).study_id > 0) {
                                var statusObj = commonjs.getTempStatus('CO');
                                $('#tblGridPS').jqGrid('setCell', result[0].temp_study_id, "temp_study_status", '', {background: statusObj.statusColorCode});
                                commonjs.changeColumnValue('#tblGridPS', result[0].temp_study_id, 'temp_study_status', statusObj.statusDesc, false);
                                $('#tblGridPS').find('#' + result[0].temp_study_id).find('td[aria-describedby =tblGridPS_status1]').removeClass('finalStatus').addClass('finalStatus');
                                $('#tblGridPS').find('#' + result[0].temp_study_id).find('td[aria-describedby =tblGridPS_status1]').html("<span class='ui-icon ui-icon-check' title='Manual Edit'></span>");
                            }
                        }
                    }

                    result[0].record_no = 'NEW';
                    var tblID = '';

                    if (app.studyFilter.length > 0) {
                        $.each(app.studyFilter, function (index, currentFilter) {
                            tblID = '#tblGrid' + currentFilter.id;
                            var $tblGrid = $(tblID);
                            if ($tblGrid.length > 0 && $tblGrid[0].grid) {
                                var gridData = result[0];
                                if ((gridData.has_deleted != 'true' || app.showdeletedstudies) && gridData.study_dt ) {
                                    if ( studyfilter.checkValidateGrid(currentFilter, gridData) === true ) {
                                        if ($tblGrid.jqGrid('getRowData', gridData.study_id).study_id > 0) {
                                            commonjs.changeRowValue('tblGrid' + currentFilter.id, gridData.study_id, gridData);
                                            $tblGrid.find('#' + gridData.study_id).removeClass('Highlight_NewStudy');
                                            var studyObj = gridData;
                                            var no_of_series = (studyObj.no_of_series && studyObj.no_of_series > 0) ? studyObj.no_of_series : 0;
                                            var no_of_instances = (studyObj.no_of_instances && studyObj.no_of_instances > 0) ? studyObj.no_of_instances : 0;
                                            var modality = (studyObj.modalities) ? studyObj.modalities : '';
                                            commonjs.changeColumnValue(tblID, studyObj.study_id, 'no_of_series', no_of_series, true);
                                            commonjs.changeColumnValue(tblID, studyObj.study_id, 'no_of_instances', no_of_instances, true);
                                            commonjs.changeColumnValue(tblID, studyObj.study_id, 'modality', modality, true);
                                        }
                                        else {
                                            //commonjs.showStatus('New study received');
                                            $tblGrid.parent().css('top', "0px");
                                            $tblGrid.jqGrid('addRowData', result[0].study_id, result[0], 'first');
                                            $($('#tblGrid' + currentFilter.id + ' tr')[1]).addClass('Highlight_NewStudy');
                                        }
                                    }
                                }
                            }

                        });
                    }
                }
            }
        });*/
        commonjs.socket.on('temp', function (result) {
            if (result && $('.fc-content').length > 0) {
                schedulebook.addTempSlot(result.modality_room_id, result.scheduled_dt, result.duration, result.id);
            }
        });

        commonjs.socket.on('scheduleupdate', function (result) {
            if (result && $('.fc-content').length > 0) {
                //console.log('socket.io on "scheduleupdate"');
                //console.dir(result);
                schedulebook.updateSchedule(result.facility_id, result.schedule_id, result.isRadiology);
            }
        });

        commonjs.socket.on('scheduleremove', function (result) {
            if (result && $('.fc-content').length > 0) {
                schedulebook.removeSchedule(result.schedule_id);
            }
        });

        commonjs.socket.on('scheduleadd', function (result) {
            if (result && $('.fc-content').length > 0) {
                schedulebook.addScheduleProvider(result.schedule_id, (result.status ? result.status : ''))
            }
        });

        // update the status in era and dispatching dashboard
        commonjs.socket.on('update_order_status', function (result) {
            var colorObj = commonjs.getColorCodeForStatus(result.facility_id, result.status, '');
            if (result && result.from && result.from == 'era') {
                var $rowobj = $('#tblEOBProcessedOrders').find('#' + result.id);
                var $col1 = $rowobj.children('td').filter('[aria-describedby =tblEOBProcessedOrders_current_status]');
                $col1.text(result.status);
            }
            else if (result && result.from == 'dispatching') {
                var tabId = $('#ulDispatchingTab li.active a').attr('id');
                var tableId = tabId && tabId.indexOf('anc') >= 0 ? tabId.replace('anc', 'tbl') : '';
                var $rowobj = $('#' + tableId + 'Grid').find('#' + result.id);
                var $col1 = $rowobj.children('td').filter('[aria-describedby =' + tableId + 'Grid_order_status_desc]');
                var $col2 = $rowobj.children('td').filter('[aria-describedby =' + tableId + 'Grid_order_status]');
                $col1.text(result.status_desc);
                $col1.css({ 'background': colorObj.length ? colorObj[0].color_code : 'transparent' });
                $col2.text(result.status);
            }
        });

        commonjs.socket.on('ImportFeeSchedule', function (data) {
            if (data.status != 'No data found' || data.status != 'File not found') {
                $('#divFeeScheduleHeaderStatus').text('');
                $('#divFeeScheduleHeaderStatus').text('Records ' + data.status + ' ' + data.current_count + '/' + data.total_count);
                if (data.current_count == data.total_count) {
                    $('#btnReloadfeeScheduleCpt').click();
                    $('#divFeeScheduleHeaderStatus').text('');
                    commonjs.showLoading("Records imported successfully");
                    commonjs.hideLoading();
                }
            }
            else {
                commonjs.showWarning(data.status);
            }
        });

        commonjs.socket.on('ValidateFeeSchedule', function (data) {
            var conditionFlag = true;
            if (data.status == 'No data found' || data.status == 'File not found' || data.status == 'Error')
                conditionFlag = false;
            if (conditionFlag) {
                if (data.status == 'InProgress') {
                    $('#divFeeScheduleHeaderStatus').text('');
                    $('#divFeeScheduleHeaderStatus').text(data.percentage + ' % ' + ' records validated');
                }
                else {
                    $('#divFeeScheduleHeaderStatus').text('');
                    commonjs.showLoading("Records Validated successfully");
                    commonjs.bindValidateErrors(data);
                    $('#validateFile').attr('disabled', false);
                }
            }
            else {
                $('#divFeeScheduleHeaderStatus').text('');
                if (data.status = 'Error') {
                    commonjs.showError('Error on getting modifier');
                }
                else {
                    commonjs.showWarning(data.status);
                }
            }
        });
        commonjs.socket.on('DispatchedOrders', function (data) {
            var self = this;
            if (data.status == 'done') {
                var order_details = JSON.parse(data.jsonList);
                if (order_details.length > 0) {
                    // Select active tab in Dispatching Dashboard
                    var activeTabID = $('#divtabDisaptchingOrders .tabControlUL li.active', parent.document);
                    activeTabID = $(activeTabID).attr('id') && $(activeTabID).attr('id') != '' ? $(activeTabID).attr('id').split('li')[1] : null;
                    var tblGrid = $('#tbl' + activeTabID + 'Grid', parent.document)

                    $.each(order_details, function (index, data) {
                        if (data.status == "success") {
                            console.log('dispatchedOrders', data)
                            var $rowobj = $(tblGrid).find('#' + data.order_id);
                            var colorObj = commonjs.getColorCodeForStatus(data.facility_id, data.order_status_code, '');

                            var $col1 = $rowobj.children('td').filter('[aria-describedby =tbl' + activeTabID + 'Grid_order_status_desc]');
                            var $col2 = $rowobj.children('td').filter('[aria-describedby =tbl' + activeTabID + 'Grid_order_status]');
                            var $col3 = $rowobj.children('td').filter('[aria-describedby =tbl' + activeTabID + 'Grid_scheduled_dt]');
                            var $col4 = $rowobj.children('td').filter('[aria-describedby =tbl' + activeTabID + 'Grid_request_date]');
                            var $col5 = $rowobj.children('td').filter('[aria-describedby =tbl' + activeTabID + 'Grid_technologist_name]');
                            var $col6 = $rowobj.children('td').filter('[aria-describedby =tbl' + activeTabID + 'Grid_vehicle_name]');
                            var $col7 = $rowobj.children('td').filter('[aria-describedby =tbl' + activeTabID + 'Grid_order_notes]');

                            data.order_status_desc != '' ? $col1.html(data.order_status_desc) : ''
                            $col1.attr('style', 'background-color: ' + (colorObj && colorObj.length ? colorObj[0].color_code : ''))
                            data.order_status_code != '' ? $col2.html(data.order_status_code) : '';
                            if (data.schedule_dt != '')
                                $col3.html(commonjs.checkNotEmpty(data.schedule_dt) ? commonjs.convertToFacilityTimeZone(data.facility_id, data.schedule_dt).format('L LT z') : '');
                            if (data.schedule_dt == '')
                                $col4.html(commonjs.checkNotEmpty(data.requested_date) && data.requested_date != 'undefined' ? commonjs.getFormattedUtcDate(data.requested_date) : ''), $col3.html('');
                            data.tech_name != '' ? $col5.html(data.tech_name) : ''
                            data.vehicle_name != '' ? $col6.html(data.vehicle_name) : ''
                            data.notes != '' ? $col7.html(data.notes) : ''
                        }
                    });
                }
            }
        });

        commonjs.socket.on('logoutOnlineUser', function (result) {
            if (result && app.sessionID && app.sessionID === result.sessionID) {
                $.ajax({
                    url: '/OnlineUserBySession',
                    type: 'GET',
                    datatype: 'json',
                    data: {
                        session_id: result.sessionID
                    },
                    success: function (response) {
                        if (response && response.result) {
                            for (var i = 0; i < response.result.length; i++) {
                                commonjs.socket.emit('patient_edited', {
                                    screen_code: 'Patient',
                                    custom_id1: response.result[i].custom_id1,
                                    session_id: result.sessionID,
                                    user_id: result.userID
                                });
                            }
                        }

                    },
                    error: function (error) {

                    }
                });


            }
        });

        commonjs.socket.on('transcription_lock_unlock', function (result) {
            var args = (result && result.lock_args) ? result.lock_args : "";

            if (args && args.study_id && args.study_id > 0 && args.lock_type) {
                commonjs.lockUnlockTranscription({
                    study_id: args.study_id,
                    lockType: args.lock_type,
                    user_id: app.userID
                });

                // Adjust lock icon for all open viewer instances of this study_id
                if (window.name && window.name.indexOf("_" + args.study_id) > -1) {
                    if (args.lock_type === "unlock") {
                        var transcripiton = $('span[data-container="TRANSCRIPTION"]')[0];
                        $(transcripiton).removeClass('ivViewTransLock');
                        $(transcripiton).addClass('ivViewTrans');
                    }
                    else if (args.lock_type === "lock") {
                        var transcripiton = $('span[data-container="TRANSCRIPTION"]')[0];
                        $(transcripiton).removeClass('ivViewTrans');
                        $(transcripiton).addClass('ivViewTransLock');
                    }
                }
            }
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

    // function for bind Import Feeschedule errors
    bindValidateErrors: function (errorDetails) {
        setTimeout(function () {
            var faildCount = (errorDetails.total_records ? errorDetails.total_records : 0) - (errorDetails.valid_records ? errorDetails.valid_records : 0)
            $('#txtSSformat').val("FAIL")
            $('#txtTotalNoRecord').val(errorDetails.total_records ? errorDetails.total_records : 0)
            $('#txtValidImport').val(errorDetails.valid_records ? errorDetails.valid_records : 0)
            $('#txtFailedValidate').val(faildCount)
            $('#txtProcCodeCount').val(errorDetails.unmatchProCode ? errorDetails.unmatchProCode.length : 0)
            $('#txtProcCodeValue').val(errorDetails.unmatchProCode ? errorDetails.unmatchProCode : '')
            $('#txtDupProcCodeCount').val(errorDetails.duplicateProCode ? errorDetails.duplicateProCode.length : 0)
            $('#txtDupProcCodeValue').val(errorDetails.duplicateProCode ? errorDetails.duplicateProCode : '')
            $('#txtRequiredCount').val(errorDetails.emptyField ? errorDetails.emptyField.length : 0)
            $('#txtRequiredValue').val(errorDetails.emptyField ? errorDetails.emptyField : '')

            $('#txtSpCharCount').val(errorDetails.splChar ? errorDetails.splChar.length : 0)
            $('#txtSpCharValue').val(errorDetails.splChar ? errorDetails.splChar : '')
            $('#txtCharTypeCount').val(errorDetails.unmatchedValues ? errorDetails.unmatchedValues.length : 0)
            $('#txtCharTypeValue').val(errorDetails.unmatchedValues ? errorDetails.unmatchedValues : '')
            $('#txtCharCount').val(errorDetails.exceedCharCount ? errorDetails.exceedCharCount.length : 0)
            $('#txtCharValue').val(errorDetails.exceedCharCount ? errorDetails.exceedCharCount : '')

            $('#txtUnmatchCount').val(errorDetails.unmatchedCols ? errorDetails.unmatchedCols.length : 0)
            $('#txtUnmatchValue').val(errorDetails.unmatchedCols ? errorDetails.unmatchedCols : '')
            $('#txtUnmatchModifierCount').val(errorDetails.unmatchedModifier ? errorDetails.unmatchedModifier.length : 0)
            $('#txtUnmatchModifierValue').val(errorDetails.unmatchedModifier ? errorDetails.unmatchedModifier : '')
            $('#txtUnmatchModifierPosCount').val(errorDetails.unmatchedModifierPos ? errorDetails.unmatchedModifierPos.length : 0)
            $('#txtUnmatchModifierPosValue').val(errorDetails.unmatchedModifierPos ? errorDetails.unmatchedModifierPos : '')
            $('#txtDuplicateModifierCount').val(errorDetails.duplicateModifier ? errorDetails.duplicateModifier.length : 0)
            $('#txtDuplicateModifierValue').val(errorDetails.duplicateModifier ? errorDetails.duplicateModifier : '')

            var formatErrCount = parseInt($.trim($('#txtCharCount').val()) != "" ? $('#txtCharCount').val() : 0) + parseInt($.trim($('#txtSpCharCount').val()) != "" ? $('#txtSpCharCount').val() : 0)
                + parseInt($.trim($('#txtCharTypeCount').val()) != "" ? $('#txtCharTypeCount').val() : 0) + parseInt($.trim($('#txtUnmatchCount').val()) != "" ? $('#txtUnmatchCount').val() : 0);
            $('#txtFormatErrCount').val(formatErrCount)
            var _errorCount = 0;
            $('.feeSchedule').each(function (e) {
                _errorCount += parseInt($(this).val());
            })
            if (_errorCount == 0) {
                $('#importFile').attr('disabled', false)
                $('#txtSSformat').val('PASS')
            }
            commonjs.hideLoading();
            return _errorCount != 0 ? false : true;
        }, 1000);
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
    emitOrderEdit: function (patientID, orderID) {
        var _retryCount = 0,
            _socketTimer = setInterval(function () {
                _retryCount++;
                if (_retryCount > 10) {
                    clearInterval(_socketTimer);
                    return;
                }
                if (commonjs.socket) {
                    clearInterval(_socketTimer);
                    commonjs.setSocketEditpatient(patientID, orderID);
                }
            }, 1000);
    },
    setSocketEditpatient: function (patientID, orderID) {
        var self = this;
        if (orderID > 0) {
            self.isOrderClosed = false;
            commonjs.socket.emit('order_edited', {
                screen_code: 'Order',
                custom_id1: orderID,
                session_id: app.sessionID,
                user_id: app.userID,
                from: 'summary'
            });

            commonjs.socket.on('order_closed', function (result) {
                self.isOrderClosed = true;
            });

            commonjs.socket.on('order_edit_done', function (result) {
                if (!self.isOrderClosed) {
                    commonjs.socket.emit('order_update', {
                        screen_code: 'Order',
                        custom_id1: orderID,
                        session_id: app.sessionID,
                        user_id: app.userID
                    });
                }
            });

            commonjs.socket.on('message', function (result) {
                if (self.isOrderClosed)
                    return;
                var response = [];
                for (var i = 0; i < result.length; i++) {
                    if (result[i].session_id != app.sessionID && orderID == result[i].custom_id1) {
                        response.push(result[i]);
                    }
                }
                if (response.length) {
                    var isMaximized = false;
                    if ($('#divUserOnline').hasClass('slidedDown'))
                        isMaximized = true;
                    self.currentOnlineUsers = response;
                    commonjs.bindUserOnline(response);
                    if (!isMaximized) {
                        $('#divUserOnline').slideUp();
                        $('#divUserOnline').addClass('slidedUp');
                    }
                    else {
                        $('#divUserOnline').addClass('slidedDown');
                        $('#aMinimize').removeClass('icon-chevron-up').addClass('icon-chevron-down');
                    }
                    $('#divHomeUserOnline').show();
                }
                else {
                    //If no matches found, removing the div
                    $('#divHomeUserOnline').hide();
                }
            });
        }
        else {
            var isPatientSearch = false;
            commonjs.socket.emit('patient_edited', {
                screen_code: 'Patient',
                custom_id1: patientID,
                session_id: app.sessionID,
                user_id: app.userID,
                from: 'patientalert'
            });

            commonjs.socket.on('patient_edit_done', function (result) {
                if (!isPatientSearch) {
                    commonjs.socket.emit('patient_update', {
                        screen_code: 'Patient',
                        custom_id1: patientID,
                        session_id: app.sessionID,
                        user_id: app.userID
                    });
                }
            });

            commonjs.socket.on('patient_closed', function (result) {
                isPatientSearch = true;
            });

            commonjs.socket.on('message', function (result) {
                if (isPatientSearch)
                    return;
                var response = [];
                for (var i = 0; i < result.length; i++) {
                    if (result[i].session_id != app.sessionID && patientID == result[i].custom_id1 && commonjs.currentModule == result[i].screen_code) {
                        response.push(result[i]);
                    }
                }
                if (response.length) {
                    var isMaximized = false;
                    if ($('#divUserOnline').hasClass('slidedDown'))
                        isMaximized = true;
                    self.currentOnlineUsers = response;
                    //  self.usersOnlineView = new UsersOnlineView();
                    commonjs.bindUserOnline(response);
                    if (!isMaximized) {
                        $('#divUserOnline').slideUp();
                        $('#divUserOnline').addClass('slidedUp');
                    }
                    else {
                        $('#divUserOnline').addClass('slidedDown');
                        $('#aMinimize').removeClass('icon-chevron-up').addClass('icon-chevron-down');
                    }
                    $('#divHomeUserOnline').show();
                }
                else {
                    //If no matches found, removing the div
                    $('#divHomeUserOnline').hide();
                }
                return false;
            });
        }
        return false;
    },
    type: function (arg) {
        return !!arg && Object.prototype.toString.call(arg).match(/(\w+)\]/)[1];
    },

    setRefPhyDetails: function (options) {
        var self = this;
        $.ajax({
            url: '/ref_portal/getRefProviderDetails',
            type: "GET",
            data: {
                id: app.provider_id,
                contact_id: app.providercontact_ids[0]
            },
            success: function (data, respone) {
                if (data && data.result) {
                    physicianCommonjs.setPhysicianDetails(data.result, options);
                }
            },
            error: function (err, rspnse) {
            }
        })
    },

    setPatinetAndCompanyDetails: function (patient_id, login_type, reloadMsg) {
        var self = this;
        $.ajax({
            url: '/getPatientCompanyDetails',
            type: "GET",
            data: {
                patient_id: patient_id
            },
            success: function (data, respone) {
                commonjs.loadStatusCodes();
                if (data && data.result) {
                    if (!reloadMsg) {
                        var patientDetails = data.result.patientDetails[0];
                        $('#divCompanyName').text(patientDetails.company_name);
                        $('#divPatientName').text(patientDetails.full_name);
                        commonjs.patientFacility = patientDetails.facility_id;
                        var patientInfo = commonjs.hstoreParse(patientDetails.patient_info);

                        var address = ((patientInfo.c1AddressLine1) ? (patientInfo.c1AddressLine1 + ', ') : (""))
                            + ((patientInfo.c1AddressLine2) ? (patientInfo.c1AddressLine2 + ', ') : ("")) +
                            ((patientInfo.c1City) ? (patientInfo.c1City + ', ') : ("")) +
                            ((patientInfo.c1State) ? (patientInfo.c1State + ', ') : ("")) + patientInfo.c1Zip
                        $('#divPatientAddress').text((address && address != 'undefined') ? address : '');
                        var homePhoneNo = patientInfo.c1HomePhone ? patientInfo.c1HomePhone.replace(new RegExp('/', 'g'), '') : '-';
                        var mobilePhoneNo = patientInfo.c1MobilePhone ? patientInfo.c1MobilePhone.replace(new RegExp('/', 'g'), '') : '-';
                        $('#divPatientContactNumner').text(homePhoneNo + ' / ' + mobilePhoneNo);
                        $('#aCompnayEmail').attr('href', 'mailto:' + patientInfo.c1Email);
                        $('#aCompnayEmail').text(patientInfo.c1Email);
                        $('#spnInboxCount').html("<span class='msgCount'>" + patientDetails.totalmsgs + "</span>" + " Message(s)");
                        if (patientDetails.unreadcount > 0) {
                            $('#divMessageFlag').removeClass('msgBox').addClass('msgBox-alert');
                            $('#divMessageFlag').attr('title', patientDetails.unreadcount + ' New Message(s)')
                        }
                        else {
                            $('#divMessageFlag').removeClass('msgBox-alert').addClass('msgBox')
                            $('#divMessageFlag').removeAttr('title')
                        }
                        if (app.login_type == 'Rep') {
                            var user_info = commonjs.hstoreParse(app.rep_patient_info.patient_info)
                            $('#divPatName').text('Logged in as : ' + user_info.firstName + ', ' + user_info.lastName + ' (' + patientDetails.full_name + ')');
                            $('#aRepLogoin').hide();
                        }
                        else {
                            $('#divPatName').text(patientDetails.full_name);
                            $('#aRepLogoin').show();
                        }
                        if (patientDetails.unreadcount > 0) {
                            $('#divMessageFlag').removeClass('msgBox').addClass('msgBox-alert');
                            $('#divMessageFlag').attr('title', patientDetails.unreadcount + ' New Message(s)')
                        }
                        else {
                            $('#divMessageFlag').removeClass('msgBox-alert').addClass('msgBox')
                            $('#divMessageFlag').removeAttr('title')
                        }
                    }
                }
                $('.msgOpener').on('click', function () {
                    window.location = '#home/messages'
                });

                //portalCommonjs.setMask();
            },
            error: function (err, response) {
                commonjs.handleXhrError(err, response);
            }
        });
    },

    setCalendarOptions: function () {
        return $('<div/>')
            .addClass('calndrConainer')
            .css({ 'height': $(window).height() })
            .append($('<div/>')
                .addClass('calndrTitle').html('Calendar'))
            .append($('<div/>')
                .addClass('calExit').attr('id', 'calExit').on('click', function () {
                    $('.bgScrn').fadeOut(500).css({ "z-index": "198" });
                    $('.calndrConainer').animate({ "right": "-1200px" }, 500);
                }))
            .append($('<div/>').attr('id', 'calendar')).appendTo('body')
    },

    showPatientCalendar: function () {
        commonjs.showPortalLoading('Initializing calendar..');
        if (!$('.calndrConainer').length)
            var calendarDiv = this.setCalendarOptions();
        else
            var calendarDiv = $('.calndrConainer');
        $('.bgScrn').fadeIn(350).css({ "z-index": "198" });
        this.getPatientAppts(calendarDiv)
    },

    getEvents: function (patientAppts) {
        var events = [];
        for (var apptTypeIndex = 0; apptTypeIndex < patientAppts.length; apptTypeIndex++) {
            for (var apptIndex = 0; apptIndex < patientAppts[apptTypeIndex].length; apptIndex++) {
                if (patientAppts[apptTypeIndex].type == "labOrders")
                    events.push({
                        title: patientAppts[apptTypeIndex][apptIndex].display_code,
                        start: moment(patientAppts[apptTypeIndex][apptIndex].order_date).format('YYYY-MM-DD'),
                        constraint: 'Lab Order',
                        edutable: false,
                        selectable: false,
                        color: '#57C357',
                        timeFormat: 'H(:mm)'
                    })
                else if (patientAppts[apptTypeIndex].type == "vitalSigns") {
                    var vitalInfo = commonjs.hstoreParse(patientAppts[apptTypeIndex][apptIndex].more_info)
                    var title = vitalInfo.bmi ? vitalInfo.bmi : ''
                    events.push({
                        title: title,
                        start: moment(patientAppts[apptTypeIndex][apptIndex].measured_dt).format('YYYY-MM-DD'),
                        constraint: 'Vital Signs',
                        edutable: false,
                        selectable: false,
                        color: '#FF7400',
                        timeFormat: 'H(:mm)'
                    })
                }
                else if (patientAppts[apptTypeIndex].type == "problems") {
                    events.push({
                        title: patientAppts[apptTypeIndex][apptIndex].study_description,
                        start: patientAppts[apptTypeIndex][apptIndex].scheduled_dt,
                        constraint: 'Vital Signs',
                        edutable: false,
                        selectable: false,
                        color: '#F05555',
                        timeFormat: 'H(:mm)'
                    })
                }
            }
        }
        return events;
    },

    getPatientAppts: function (calendarDiv) {
        var self = this;
        $.ajax({
            url: '/getPatientAppts',
            type: 'GET',
            data: {
                patientID: app.patient_id
            },
            success: function (data, result) {
                var appts = $.map(data.result, function (value, index) {
                    value.type = index;
                    return [value];
                });
                var events = self.getEvents(appts);
                calendarDiv.find('#calendar').fullCalendarNew({
                    header: {
                        left: 'prev,next today',
                        center: 'title',
                        right: 'month,agendaWeek,agendaDay'
                    },
                    businessHours: true, // display business hours
                    editable: true,
                    hiddenDays: [],
                    timeFormat: 'H(:mm)',
                    events: events,
                    eventRender: function (event, element) {
                        $(element).find(".fc-time").remove();
                    }
                });
                commonjs.hidePortalLoading();
                calendarDiv.animate({ "right": "0px" }, 500);
            },
            error: function (data, result) {
            }
        });
    },

    setAppSettings: function (appsettings, screen) {
        var appsettingsobj = appsettings;
        if (!app) {
            app = { userInfo: {}, settings: {} };

        }
        switch (screen) {
            case 'facility':
                app.facilities = (appsettingsobj.facility.length > 0) ? appsettingsobj.facility : [];
                app.userfacilities = [];
                var users = appsettingsobj.users;
                var userFacilityIds = app.userInfo && app.userInfo.facilities
                    ? app.userInfo.facilities
                    : users.facilities;
                var defaultUserFacilityId = app.default_facility_id || users.default_facility_id;
                if (userFacilityIds) {
                    $.each(app.facilities, function (f, facility) {

                        if (userFacilityIds.indexOf(facility.id) > -1) {
                            app.userfacilities.push(facility);
                        }
                        if (facility.id == defaultUserFacilityId) {
                            app.default_facility = facility;
                        }
                    });
                }
                break;
            case 'userdevices':
                app.userdevices = appsettingsobj.userdevices;
                var defaultDevice = $.grep(app.userdevices, function (device) {
                    return device.is_default == true;
                });
                if (defaultDevice.length > 0) {
                    app.default_device_id = defaultDevice[0].id;
                }
                else {
                    app.default_device_id = 0;
                }
                break;
            case 'modality':
                app.modalities = (appsettingsobj.modalities.length > 0) ? appsettingsobj.modalities : [];
                break;
            case 'modalityroom':
                app.modalityRooms = (appsettingsobj.modalityrooms.length > 0) ? appsettingsobj.modalityrooms : [];
                app.setupModalityRooms(app.modalityRooms);
                break;
            case 'vehicle':
                app.vehicles = (appsettingsobj.vehicle.length > 0) ? appsettingsobj.vehicle : [];
                break;
            case 'application_entity':
                app.application_entities = (appsettingsobj.application_entities.length > 0) ? appsettingsobj.application_entities : [];
                break;
            case 'appgadget':
                app.appGadgets = (appsettingsobj.appGadgets.length > 0) ? appsettingsobj.appGadgets : [];
                break;
            case 'filestore':
                app.filestores = (appsettingsobj && appsettingsobj.filestore && appsettingsobj.filestore.length > 0) ? appsettingsobj.filestore : [];
                break;
            case 'assignedStudies':
                app.assignedStudies = (appsettingsobj && appsettingsobj.assignedStudies && appsettingsobj.assignedStudies.length > 0) ? appsettingsobj.assignedStudies : [];
                break;
            case 'all':
                app.settings.notificationTemplates = appsettingsobj.notificationTemplates;
                app.settings.readOnlyExtTools = appsettingsobj.readOnlyExtTools;
                app.settings.updoxAcctID = appsettingsobj.updoxAcctID;
                app.settings.updoxEnabled = appsettingsobj.updoxEnabled;
                app.settings.updoxURL = appsettingsobj.updoxURL || '';
                app.settings.eraInboxPath = appsettingsobj.eraInboxPath || '';
                app.settings.updoxAPIURL = appsettingsobj.updoxAPIURL || '';
                app.settings.updoxReminders = appsettingsobj.updoxReminders;
                app.settings.viewerTitlebarText = appsettingsobj.viewerTitlebarText;
                var patientflags = [];
                for (var key in commonjs.patientFlags) {
                    patientflags.push({ 'code': key, 'description': commonjs.patientFlags[key] });
                }
                if (!appsettingsobj.patient_portal) {
                    var users = appsettingsobj.users;
                    app.default_facility_id = users.default_facility_id;
                    app.facilities = appsettingsobj.facility.length > 0 ? appsettingsobj.facility : [];
                    app.userfacilities = [];
                    if (users.facilities) {
                        $.each(app.facilities, function (f, facility) {
                            $.each(users.facilities, function (uf, userfacility) {
                                if (facility.id == userfacility) {
                                    app.userfacilities.push(facility);
                                }
                                if (facility.id == users.default_facility_id) {
                                    app.default_facility = facility;
                                }
                            });
                        });
                    }
                    app.thirdParty = appsettingsobj.thirdParty;
                    app.settings.updoxAcctID = appsettingsobj.updoxAcctID;
                    app.settings.updoxEnabled = appsettingsobj.updoxEnabled;
                    app.settings.updoxURL = appsettingsobj.updoxURL || '';
                    app.settings.updoxAPIURL = appsettingsobj.updoxAPIURL || '';
                    app.settings.ikonopediaInitialized = appsettingsobj.ikonopediaID > 0;
                    app.settings.ikonopediaID = appsettingsobj.ikonopediaID;
                    app.settings.isApptTypeDescriptionIgnored = appsettingsobj.isApptTypeDescriptionIgnored;
                    app.settings.ikonopediaAPIURL = appsettingsobj.ikonopediaAPIURL;
                    app.settings.ikonopediaAPIArgs = appsettingsobj.ikonopediaAPIArgs;
                    app.settings.ikonopediaPass = appsettingsobj.ikonopediaPass;
                    var appGadgets = appsettingsobj.appGadgets;
                    app.assignedStudies = appsettingsobj.assignedStudies;
                    app.appGadgets = (appGadgets && appGadgets.length > 0) ? appGadgets : [];
                    app.providercontacts = (appsettingsobj && appsettingsobj.providercontacts.length > 0) ? appsettingsobj.providercontacts : [];
                    app.providercontact_ids = commonjs.getProviderContactIDs(app.providercontacts);
                    var userroles = appsettingsobj.userroles;
                    app.userdevices = appsettingsobj.userdevices;

                    var patientLocation = ['ER', 'IP', 'OP'];
                    app.sessionID = appsettingsobj.sessionID;
                    app.localCacheAeTitle = 'DICOM_SCP';
                    app.userID = users.id;
                    app.providerID = (users.provider_id > 0) ? users.provider_id : 0;
                    app.provider_type = (users.provider_type) ? users.provider_type : '';
                    app.refproviderID = (app.providerID > 0 && app.provider_type.toUpperCase() == 'RF') ? app.providerID : 0;
                    app.provider_name = (users.provider_name) ? users.provider_name : "";
                    app.userInfo.user_settings = users.user_settings;
                    app.userInfo.userName = users.username;
                    app.userInfo.userFullName = users.last_name + ', ' + users.first_name;
                    app.userInfo.user_type = (commonjs.checkNotEmpty(users.user_type)) ? users.user_type : app.userInfo.user_type;
                    app.userInfo.first_name = users.first_name;
                    app.userInfo.last_name = users.last_name;
                    app.userInfo.middle_initial = users.middle_initial;
                    app.userInfo.suffix = users.suffix;
                    app.userInfo.facilities = users.facilities;
                    app.userInfo.groupCode = users.group_code;
                    app.userInfo.linked_ordfacilities = users.linked_ordfacilities && users.linked_ordfacilities.length > 0 ? users.linked_ordfacilities : [];
                    app.userInfo.pg_group_info = users.pg_group_info && users.pg_group_info.length > 0 ? users.pg_group_info : [];
                    app.groupInfo = users.group_info;
                    app.userInfo.user_group_id = users.user_group_id;
                    app.userInfo.password_changed_dt = users.password_changed_dt;
                    var userdocumenttypes = app.userdocumenttypes = users.document_types ? users.document_types : [];
                    app.enableSwitchUser = (users.enableSwitchUser) ? true : false;
                    app.showQcSwitch = appsettingsobj.showQcSwitch || false;
                    app.linkedOrdFacilities = (appsettingsobj.linkedOrdFacilities && appsettingsobj.linkedOrdFacilities.length > 0) ? appsettingsobj.linkedOrdFacilities : null;
                    app.insProviderTypes = (appsettingsobj.adjCodes && appsettingsobj.adjCodes.length > 0) ? appsettingsobj.adjCodes : [];
                    app.readingDoctorLevel = (appsettingsobj.readingDoctorLevel && appsettingsobj.readingDoctorLevel.length > 0) ? appsettingsobj.readingDoctorLevel : null;
                    if (app.userInfo.user_type == 'SU' || app.enableSwitchUser) {
                        if (app.userInfo.user_type != 'SU') {
                            $('#li_adminsettings').hide();
                            commonjs.setReferringProviderScreens();
                        } else {
                            $('#li_adminsettings').show();
                        }
                        app.userInfo.user_type = 'SU';
                        $('#li_selectuser').show();

                    } else {
                        commonjs.setReferringProviderScreens();
                    }

                    app.changePassword = false;
                    if (app.userInfo && app.userInfo.user_settings) {
                        var temp = commonjs.hstoreParse(app.userInfo.user_settings);
                        app.userInfo.dragon360 = false;

                        // See if user needs to change their password
                        if (temp.userMustChangePassword && temp.userMustChangePassword == 'true') {
                            app.changePassword = true;
                        }

                        // Move dragon360 out of the hstore for easier access
                        if (temp.dragon360 && temp.dragon360 == 'true') {
                            app.userInfo.dragon360 = true;
                        }
                        temp = undefined;
                    }

                    $('#spadmin').text(app.userInfo.userFullName);

                    app.ordFacilities = (appsettingsobj.ordFacilities.length > 0) ? appsettingsobj.ordFacilities : [];
                    app.studyFilter = (appsettingsobj.studyFilter.length > 0) ? appsettingsobj.studyFilter : [];
                    app.modalities = (appsettingsobj.modalities.length > 0) ? appsettingsobj.modalities : [];
                    app.modalityRooms = (appsettingsobj.modalityrooms.length > 0) ? appsettingsobj.modalityrooms : [];
                    if (app.setupModalityRooms) app.setupModalityRooms(app.modalityRooms);

                    app.customOrderStatus = [];
                    app.customStudyStatus = [];
                    if (Array.isArray(appsettingsobj.customStatuses)) {
                        appsettingsobj.customStatuses.forEach(function (status) {
                            if (status.order_related === true) {
                                app.customOrderStatus.push(status);
                            }
                            else {
                                app.customStudyStatus.push(status);
                            }
                        });
                    }

                    app.vehicles = (appsettingsobj.vehicle && appsettingsobj.vehicle.length > 0) ? appsettingsobj.vehicle : [];
                    app.settings.patientflags = (patientflags && patientflags.length > 0) ? patientflags : [];
                    app.localCacheAeTitle = null;

                    app.settings.studyflag = [];
                    $.each(appsettingsobj.study_flags, function (index, flagData) {
                        app.settings.studyflag.push(flagData.description);
                    });
                    app.settings.patientLocation = (patientLocation && patientLocation.length > 0) ? patientLocation : [];
                    app.usersettings = typeof appsettingsobj.usersettings === "object" && appsettingsobj.usersettings || {id:1,
                        field_orders:[1,2,3,4],
                        grid_options:[
                            {name: "Modality", width: 150},

                            {name: "Patient", width: 200},

                            {name: "Accession #", width: 200},

                            {name: "Status", width: 150}
                        ],
                        sort_column:"Accession #",
                        sort_order:"Desc",
                        wl_sort_field:"accession_no",
                        study_fields:["Modality","Patient","Accession #","Status"]
                    };
                    function change_theme(theme) {
                        app.currentTheme = theme;
                        commonjs.refreshUserSettings();
                        jQuery.ajax({
                            url: "/updateUserTheme",
                            type: "PUT",
                            data: {
                                "theme": theme
                            },
                            success: function (data, textStatus, jqXHR) {

                            },
                            error: function (err) {
                                commonjs.showError('messages.errors.cannotchangetheme');
                            }
                        });
                    };
                    var btn_theme_changer = $('.btn-theme-changer'),
                        tc_icon = btn_theme_changer.find('i'),
                        tc_label_dark = btn_theme_changer.find('.tc-label-dark'),
                        tc_label_bright = btn_theme_changer.find('.tc-label-bright');

                    btn_theme_changer.off().on('click', function (e) {
                        e.preventDefault();
                        var obj = $(this);

                        if (obj.hasClass("active")) {
                            obj.removeClass("active");

                            tc_label_dark.hide();
                            tc_label_bright.fadeIn();
                            tc_icon.animate({
                                left: '88'
                            }, function () {
                                change_theme("default");
                            });
                        } else {
                            obj.addClass("active");

                            tc_label_bright.hide();
                            tc_label_dark.fadeIn();
                            tc_icon.animate({
                                left: '2'
                            }, function () {
                                change_theme("dark");
                            });

                        }

                        return false;
                    });
                    var usersettings = commonjs.hstoreParse(users.user_settings);
                    var usersettingsapp = commonjs.hstoreParse(app.usersettings.other_settings);
                    app.usersettings.showAllDocuments = usersettingsapp.showAllDocuments === 'true' || usersettingsapp.showAllDocuments === true;
                    app.usersettings.printOrderInfo = {
                        include_barcodes: usersettingsapp.include_barcodes === 'true',
                        include_notes: usersettingsapp.include_notes === 'true',
                        include_disclaimer: usersettingsapp.include_disclaimer === 'true'
                    };
                    app.showpriors = usersettingsapp.ShowPriors == 'true';
                    app.showserial = usersettingsapp.ShowSerial == 'true';
                    app.useDragon = usersettingsapp.UseDragon === 'On';
                    app.exaTransDelay = usersettingsapp.ExaTransDelay === 'On';
                    app.exaTransFontName = usersettingsapp.ExaTransFontName;
                    app.exaTransFontSize = usersettingsapp.ExaTransFontSize ? parseInt(usersettingsapp.ExaTransFontSize) : "";
                    app.show_pending_studies = usersettingsapp.show_pending_studies == 'true';
                    if (app.refproviderID > 0) {
                        app.show_pending_studies = false;
                    }
                    // set the schedule book default time increment
                    app.defaultTimeIncrement = usersettingsapp.DefaultTimeIncrement ? parseInt(usersettingsapp.DefaultTimeIncrement) : 15;
                    app.show_comp_pend_list = usersettingsapp.show_completed_pending_list == 'true';
                    app.show_orders_tab = usersettingsapp.show_orders_tab == 'true';
                    app.openOrderOnCreate = usersettingsapp.openOrderOnCreate === 'true';
                    app.show_summary_tab = usersettingsapp.show_summary_tab == 'true';
                    app.showdeletedstudies = (usersettingsapp.showDeleteStudies == 'true');
                    app.showdeletedpendingstudies = usersettingsapp.showDeletePendingStudies == 'true';
                    app.defaultTab = usersettingsapp.defaultTab ? usersettingsapp.defaultTab : "";
                    app.dblClkBhvr = usersettingsapp.dblClkBhvr ? usersettingsapp.dblClkBhvr : "";
                    app.dblClkSCHBhvr = usersettingsapp.dblClkSCHBhvr ? usersettingsapp.dblClkSCHBhvr : "";
                    app.currentDirection = (usersettings.direction) ? usersettings.direction : 'ltr';
                    app.currentSearchTab = (usersettings.defaultTab) ? usersettings.defaultTab : 'name';
                    app.bandwidth = (usersettings.bandwidth) ? usersettings.bandwidth : '';
                    var defaultDevice = $.grep(app.userdevices, function (device) {
                        return device.is_default == true;
                    });
                    if (defaultDevice.length > 0) {
                        app.default_device_id = defaultDevice[0].id;
                    }
                    else {
                        app.default_device_id = 0;
                    }
                    app.navPinned = usersettings.navPinned == 'true';
                    app.hideWorklistIcons = usersettings.hideWorklistIcons == 'true';
                    app.schBookAsNewTab = usersettings.schBookAsNewTab == 'true';
                    app.autoOpenDevice = usersettings.autoOpenDevice == 'true';
                    app.lettersTobeSearched = users.lettersTobeSearched;
                    app.sessionTimeout = users.sessionTimeout;
                    app.allowEmergencyAccess = usersettings.allowEmergencyAccess ? usersettings.allowEmergencyAccess == 'true' : false;
                    app.enableEmergencyAccess = usersettings.allowEmergencyAccess ? usersettings.allowEmergencyAccess == 'true' : false;
                    app.socketIO_Url = commonjs.getHostUrl();
                    app.autoRefreshInterval = users.autoRefreshInterval;
                    app.enableSocketIO = users.enableSocketIO;
                    app.currentTheme = usersettings.theme;
                    app.gridFields = users.gridFields;
                    app.gridSettings = users.gridSettings;
                    if (app.currentTheme == "dark") {
                        btn_theme_changer.addClass("active");

                        tc_label_bright.hide();
                        tc_label_dark.show();
                    }
                    app.currentCulture = usersettings.culture;
                    app.currentrowsToDisplay = usersettings.rowsToDisplay;
                    app.latestVersion = users.latestVersion;
                    app.productName = users.productName;
                    app.transcriptionServerUrl = users.transcriptionServerUrl;
                    app.insPokitdok = users.insPokitdok;
                    app.exatrans = users.exatrans;
                    app.license = users.license;
                    app.cardiomodule = users.cardiomodule;
                    app.d360OrgToken = users.d360OrgToken;
                    var completerole = new Array();
                    var appuserRoles = [];
                    if (userroles.length > 0) {
                        userroles.forEach(function (currentrole) {
                            completerole = completerole.concat(currentrole.permissions);
                            appuserRoles.push(currentrole);
                        });
                    }
                    var uniqueNames = [];
                    $.each(completerole, function (i, el) {
                        if ($.inArray(el, uniqueNames) === -1) uniqueNames.push(el);
                    });

                    app.screenCodes = uniqueNames;
                    app.schedule_mode = usersettings.schedule_mode || 'R';
                    app.usersettings.searchByAssociatedPatients = usersettings.searchByAssociatedPatients === "true" || usersettings.searchByAssociatedPatients === true;
                    app.permissions = appsettingsobj.permissions;
                    app.userRoles = appuserRoles;
                    settingsReceived = true;
                }
                else {
                    var scan_document__types = appsettingsobj.company.scan_document_types ? appsettingsobj.company.scan_document_types.scan_document_type : [];
                    var company = appsettingsobj.company;

                    var patientLocation = ['ER', 'IP', 'OP'];
                    var states = (company.app_states && company.app_states.length > 0) ? company.app_states.sort() : [];
                    var sites = appsettingsobj.sites;
                    var patients = appsettingsobj.patients;
                    app.patient_name = patients.full_name;
                    $('#spPatientAdmin').text(patients.full_name);
                    app.patient_id = patients.id;
                    app.login_type = appsettingsobj.pp_patients && appsettingsobj.pp_patients.rep_login_id ? 'Rep' : 'Patient';
                    app.rep_patient_info = appsettingsobj.pp_patients ? appsettingsobj.pp_patients : appsettingsobj.patients;
                    app.siteID = sites.id;
                    app.company_code = (company.company_code) ? company.company_code : '';
                    app.enableLDAP = (company.enable_ldap) ? true : false;
                    app.currentCompanyID = app.companyID = (company.id) ? company.id : 0;
                    app.currentCompanyCode = app.company_code = (company.company_code) ? company.company_code : '';
                    app.facilities = (appsettingsobj.facility.length > 0) ? appsettingsobj.facility : [];
                    app.filestores = (appsettingsobj && appsettingsobj.filestore && appsettingsobj.filestore.length > 0) ? appsettingsobj.filestore : [];
                    app.modalities = (appsettingsobj.modalities.length > 0) ? appsettingsobj.modalities : [];
                    app.modalityRooms = (appsettingsobj.modalityrooms.length > 0) ? appsettingsobj.modalityrooms : [];
                    app.setupModalityRooms(app.modalityRooms);
                    app.application_entities = (appsettingsobj.application_entities.length > 0) ? appsettingsobj.application_entities : [];
                    app.states = (states.length > 0) ? states.sort() : [];
                    var sys_config = commonjs.hstoreParse(company.sys_config);
                    var mrn_info = commonjs.hstoreParse(company.mrn_info);
                    app.can_edit = mrn_info.can_edit;
                    app.prefix = mrn_info.prefix == "" ? "" : mrn_info.prefix;
                    app.suffix = mrn_info.suffix == "" ? "" : mrn_info.suffix;
                    app.mrn_type = mrn_info.mrn_type == "" ? "" : mrn_info.mrn_type;

                    app.default_facility_id = appsettingsobj.patients.facility_id;
                    app.aeinstitutionfilter = (company.ae_institution_filter && company.ae_institution_filter.length > 0) ? company.ae_institution_filter : [];
                    app.settings.userTitles = (typeof sys_config.sys_user_titles == "string") ? sys_config.sys_user_titles.split(',') : [];
                    app.settings.maritalStatus = (typeof sys_config.sys_marital_status == "string") ? sys_config.sys_marital_status.split(',') : [];
                    app.settings.bodyParts = (typeof sys_config.sys_body_parts == "string") ? sys_config.sys_body_parts.split(',') : [];
                    app.settings.empStatus = (typeof sys_config.sys_emp_status == "string") ? sys_config.sys_emp_status.split(',') : [];
                    app.settings.credentials = (typeof sys_config.sys_credentials == "string") ? sys_config.sys_credentials.split(',') : [];
                    app.settings.racialIdentity = (typeof sys_config.sys_racial_identity == "string") ? sys_config.sys_racial_identity.split(',') : [];
                    app.settings.ethnicity = (typeof sys_config.sys_ethnicity == "string") ? sys_config.sys_ethnicity.split(',') : [];
                    app.settings.transportation = (typeof sys_config.sys_transportation == "string") ? sys_config.sys_transportation.split(',') : [];
                    app.settings.priorities = (typeof sys_config.sys_priorities == "string") ? sys_config.sys_priorities.split(',') : [];
                    app.settings.cancelReasons = (company.app_cancel_reasons && company.app_cancel_reasons.length > 0) ? company.app_cancel_reasons : [];
                    app.settings.scanDocumentTypes = scan_document__types;
                    app.settings.languages = (typeof sys_config.sys_languages == "string") ? sys_config.sys_languages.split(',') : [];
                    app.settings.administration_site = (typeof sys_config.sys_administration_site == "string") ? sys_config.sys_administration_site.split(',') : [];
                    var speciallist = (typeof sys_config.sys_specialities == "string") ? sys_config.sys_specialities.split(',') : [];
                    app.settings.specialities = speciallist.length > 0 ? speciallist.sort() : [];
                    app.settings.patientAlerts = (company.app_patient_alerts && company.app_patient_alerts.length > 0) ? company.app_patient_alerts : [];

                    app.settings.veterinaryGender = (typeof sys_config.sys_veterinary == "string") ? sys_config.sys_veterinary.split(',') : [];
                    app.settings.gender = (typeof sys_config.sys_gender == "string") ? sys_config.sys_gender.split(',') : [];
                    app.settings.sources = (typeof sys_config.sys_sources == "string") ? sys_config.sys_sources.split(',') : [];
                    app.settings.orientation = (typeof sys_config.sys_orientation == "string") ? sys_config.sys_orientation.split(',') : [];
                    app.settings.relationships = (typeof sys_config.sys_relationships == "string") ? sys_config.sys_relationships.split(',') : [];
                    app.settings.patientflags = (patientflags && patientflags.length > 0) ? patientflags : [];

                    commonjs.setAppCriticalFindings();

                    // Added, Wilson Novido, Dec. 17,2015, EXA-422
                    // Set app.settings.studyflag using API, Added here as common.js function
                    commonjs.setAppSettingsStudyFlag();

                    app.settings.patientLocation = (patientLocation && patientLocation.length > 0) ? patientLocation : [];
                    app.themes = (sites.themes && sites.themes.length > 0) ? sites.themes : [];
                    app.dicom_service_config = (sites.dicom_service_config) ? sites.dicom_service_config : null;
                    app.image_service_config = (sites.image_service_config) ? sites.image_service_config : null;

                    app.cultures = (sites.i18n_config && sites.i18n_config.length > 0) ? sites.i18n_config : [];
                    app.transfer_syntaxes = (sites.transfer_syntaxes && sites.transfer_syntaxes.length > 0) ? sites.transfer_syntaxes : [];
                    app.types_of_service = (sites.types_of_service && sites.types_of_service.length > 0) ? sites.types_of_service : [];
                    app.modifiers = (sites.modifiers && sites.modifiers.length > 0) ? sites.modifiers : [];
                    app.route_info = (sites.immunization_route_info && sites.immunization_route_info.length > 0) ? sites.immunization_route_info : [];
                    app.info_source = (sites.immunization_info_source && sites.immunization_info_source.length > 0) ? sites.immunization_info_source : [];
                    settingsReceived = true;
                }

                break;
        }
        /*ADDED FOR MU TEST
         */
        if (app.allowEmergencyAccess) {
            app.userInfo.user_type = 'SU';
        }
        if (app.enableEmergencyAccess) {
            $('body').append('<div style="width:100%;height:10px;position:fixed;top:0px;left:0px;z-index:10000;background-color:#FB0000;"></div>');
        }

        app.appVersion = appsettingsobj.appVersion;
        //}
    },

    setReferringProviderScreens: function () {
        if (app.refproviderID > 0) {
            $('#li_selectuser').hide();
            $('#li_adminsettings').hide();
            $('#nav_main_setup').hide();
            $('#nav_main_billing').hide();
            app.show_pending_studies = false;
        }
    },

    getDocServers: function (sendSubdomains) {
        var serverUrl = location.protocol + '//' + location.host;

        for (var i = 0; i < app.subdomains.length; i++) {
            if (app.subdomains[i].request_url.indexOf(serverUrl) > -1) {
                return sendSubdomains ? app.subdomains[i].sub_domains : app.subdomains[i].sub_domains[0];
            }
        }

        for (var i = 0; i < app.subdomains.length; i++) {
            if (app.subdomains[i].request_url.indexOf(location.host) > -1) {
                return sendSubdomains ? app.subdomains[i].sub_domains : app.subdomains[i].sub_domains[0];
            }
        }

        for (var i = 0; i < app.subdomains.length; i++) {
            if (app.subdomains[i].request_url.indexOf(location.hostname) > -1) {
                return sendSubdomains ? app.subdomains[i].sub_domains : app.subdomains[i].sub_domains[0];
            }
        }

        for (var i = 0; i < app.subdomains.length; i++) {
            if (app.subdomains[i].request_url == '*') {
                return sendSubdomains ? app.subdomains[i].sub_domains : app.subdomains[i].sub_domains[0];
            }
        }

        return sendSubdomains ? [serverUrl] : serverUrl;
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

    processStudyInfo: function (studyID, modality, callback) {
        window.studyModality = modality;
        callback();
        //        var options = commonjs.getModalityOptions(modality);
        //        var winInfo = prefetchViewer.getWindowToDisplay();
        //        // code to be written here if studyprefetch going from worklist
        //        commonjs.prefetchStudies(studyID, function (response) {
        //            //if (callback) callback(response);
        //        }, {layoutFormat: (options && options.layout && options.layout.screen_layout) || '2*2', wndCount: (winInfo && winInfo.totalWnd) || 1});
    },

    openDicomViewer: function (rowID, e, gridID) {
        if (!commonjs.isMobileOrTablet()) {
            var monitorProps = $.jStorage.get('EMD_PACS_MOINTOR');
        }
        var $tblGrid = $(gridID);
        var getData = $tblGrid[0].customGrid.getData;
        var gridData = getData(rowID);
        if (gridData === null) {
            return;
        }
        var linked_study_id = gridData.linked_study_id;
        if(!this.getAnyStatStudiesOpened()){
            commonjs.openedStatStudies = [];
        }
        if (gridData.stat_level > 0) {
            if (!commonjs.openedStatStudies) commonjs.openedStatStudies = [];
            commonjs.openedStatStudies.push(gridData.study_id);
        }
        if (commonjs.nextStudyInfo) commonjs.nextStudyInfo = null;
        var currentRow = $(e.target || e.srcElement).closest('tr');
        var nextrow = currentRow.next();
        var prevrow = currentRow.prev();
        if (linked_study_id > 0) {
            commonjs.nextRowID = commonjs.previousRowID = 0;
            while (nextrow.attr('linked_study_id') && nextrow.attr('linked_study_id') > 0) {
                var nextGridData = getData(nextrow.attr('id'));
                if (nextGridData.linked_study_id > 0) {
                    commonjs.nextRowID = nextrow.attr('id');
                    break;
                }
                else {
                    nextrow = nextrow.next();
                }
            }

            while (prevrow.attr('linked_study_id') && prevrow.attr('linked_study_id') > 0) {
                var prevGridData = getData(prevrow.attr('id'));
                if (prevGridData.linked_study_id > 0) {
                    commonjs.previousRowID = prevrow.attr('id');
                    break;
                }
                else {
                    prevrow = prevrow.next();
                }
            }

            commonjs.currentGridID = gridID;

            commonjs.showDicomViewer(rowID, false, gridID, linked_study_id);
        }
        else {
            if (commonjs.checkDicomStatus(gridData.dicom_status, gridData.no_of_instances)) {
                commonjs.nextRowID = commonjs.previousRowID = 0;
                while (nextrow.attr('id') && nextrow.attr('id') > 0) {
                    nextGridData = getData(nextrow.attr('id'));
                    if (commonjs.checkDicomStatus(nextGridData.dicom_status, nextGridData.no_of_instances)) {
                        commonjs.nextRowID = nextrow.attr('id');
                        break;
                    }
                    else {
                        nextrow = nextrow.next();
                    }
                }

                while (prevrow.attr('id') && prevrow.attr('id') > 0) {
                    prevGridData = getData(prevrow.attr('id'));
                    if (commonjs.checkDicomStatus(prevGridData.dicom_status, prevGridData.no_of_instances)) {
                        commonjs.previousRowID = prevrow.attr('id');
                        break;
                    }
                    else {
                        prevrow = prevrow.next();
                    }
                }
                commonjs.currentGridID = gridID;
                commonjs.showDicomViewer(rowID, false, gridID);
            }
        }
    },

    getAnyStatStudiesOpened : function(){
        var isOpen = false;
            if (commonjs.openedStatStudies && commonjs.openedStatStudies.length > 0) {
                var openedViewerWindows = prefetchViewer.openViewerWindow;
                if(openedViewerWindows && openedViewerWindows.length > 0){
                    for(var i = 0; i < openedViewerWindows.length;i++){
                        var study_id = openedViewerWindows[i].name.split('_')[1];
                        if(commonjs.openedStatStudies.indexOf(study_id) > -1){
                             isOpen = true;
                             break;
                        }
                    }
                }
            }
        return isOpen;
    },

    setCustomMenu: function (ulchangeMenu, resultID, resultclass, lioptions, isFromStudyStatus, isOrderModule, isSchbook, isRegUser) {
        $("#" + resultID + "  ." + resultclass).mousemove(function (e) {
            var target = $((e.target || e.srcElement));
            if (!target.hasClass(resultclass)) {
                target = target.closest('.' + resultclass);
            }

            if (commonjs.currentTargetID && (target.attr('id') != commonjs.currentTargetID)) {
                $('#' + lioptions).removeClass('open');
            }

            commonjs.currentTargetID = target.attr('id');

            var obj = $('#' + e.currentTarget.id);
            var left = '';
            var top = '';
            if (lioptions == 'liNotificationOptions' || lioptions == 'liTaskOptions' || lioptions == 'liPatientOptions') {
                left = $(obj).width() - $('#' + ulchangeMenu).width() + 'px';
            } else if (lioptions == 'liStudyStatusOptions' || lioptions == 'liStudyFlowOptions') {
                left = $(obj).width() - 30 + 'px';
            }
            else {
                left = $(obj).offset().left + $(obj).width() - $('#' + ulchangeMenu).width() + 'px';
            }
            if (lioptions == 'liNotificationOptions' || lioptions == 'liTaskOptions') {
                //top = (($(obj).offset().top) - 103);  //Notication grid task menu  FJC
                top = (($(obj).offset().top));
            }
            else if (lioptions == 'liStudyStatusOptions' || lioptions == 'liStudyFlowOptions') {
                top = (($(obj).offset().top + 35) - $('.selectionStudyStatus').offset().top);
            }
            else if (lioptions == 'liPatientOptions') {
                top = (($(obj).offset().top + 3) - $('#divGrid').offset().top);
            }
            else {
                var top = $(obj).offset().top + $('#divOrderFrame').scrollTop() + 3;
            }

            $('#' + ulchangeMenu).css('top', top).css('left', left).show();
            $('#' + ulchangeMenu).attr('data-container', e.currentTarget.id.split('_')[2]);
            $('#' + ulchangeMenu).attr('data-name', obj.attr('data-name'));
            $('#' + ulchangeMenu).attr('data-code', obj.attr('data-code'));
            if (isFromStudyStatus) {
                if (e.currentTarget.id.split('_')[4] == 'false') {
                    $('#liMenu_deleteStatus').addClass("disabled").attr('disabled', 'disabled');
                    $('#liMenu_deleteStatus')[0].disabled = true;
                    return false;
                }
                else {
                    $('#liMenu_deleteStatus').removeClass('disabled').removeAttr('disabled');
                    $('#liMenu_deleteStatus')[0].disabled = false;
                }
            }

            if (isOrderModule == 'Order') {
                $('#liNewSchedule').attr('data-container', e.currentTarget.id.split('_')[2]);
                $('#liNewSchedule').attr('data-name', obj.attr('data-name'));
                $('#liQuickAppointment').attr('data-container', e.currentTarget.id.split('_')[2]);
                $('#liQuickAppointment').attr('data-name', obj.attr('data-name'));
                $('#liWalkin').attr('data-container', e.currentTarget.id.split('_')[2]);
                $('#liWalkin').attr('data-name', obj.attr('data-name'));
            }

        });

        $("#" + resultID + "  ." + resultclass).mouseenter(function (e) {

            if (isOrderModule == 'Order') {

                $('#liNewSchedule').show();
                $('#liQuickAppointment').show();
                if (isSchbook) {
                    $('#liWalkin').hide();
                } else {
                    $('#liWalkin').show();
                }
                // $("#liPatDivider").show();
                $('#liMenu_edit').hide();
                $('#liMenu_active').hide();
                $('#liMenu_merge').hide();
                $('#liMenu_delete').hide();
            }
            else {
                $('#liMenu_edit').show();
                $('#liMenu_active').show();
                $('#liMenu_merge').show();
                $('#liMenu_delete').show();
            }
            if (!isRegUser)
                $('#liMenu_link').hide();

            var target = $((e.target || e.srcElement));
            if (!target.hasClass(resultclass)) {
                target = target.closest('.' + resultclass);
            }
            if (commonjs.currentTargetID && (target.attr('id') != commonjs.currentTargetID)) {
                $('#' + lioptions).removeClass('open');
            }
            if (isFromStudyStatus) {
                if (e.currentTarget.id.split('_')[4] == 'false') {
                    $('#liMenu_deleteStatus').addClass("disabled").attr('disabled', 'disabled');
                    return false;
                }
                else {
                    $('#liMenu_deleteStatus').removeClass('disabled').removeAttr('disabled');
                }
            }

        });
        $("#" + ulchangeMenu).click(function (e) {
            var isDown = false;
            var ulheight = $('#' + ulchangeMenu).height();
            var menuHeight = $('#menu2').height();
            var divheight = $('#body_container').height(); // alternate for outer div
            var diffHeight = divheight - menuHeight;
            if ($('#menu2').length > 0) {
                var top = $('#menu2').css('top').split('px')[0];
                if (e.pageY > diffHeight) {
                    $('#menu2').css('top', $('#drop5').position().top - (menuHeight + 10));
                }
                else {
                    $('#menu2').css('top', $('#drop5').position().top + (ulheight));
                    //                if(top < 0)
                    //                    $('#menu2').css('top',($('#menu2').offset().top +(2*ulheight)));
                    //                else
                    //                    $('#menu2').css('top',($('#menu2').offset().top + ulheight));
                }
            }
            else {
                $('#menu3').css('top', $('#drop5').position().top + (ulheight));
            }

        });
    },

    bindMergeFields: function (tableName, editorID) {
        var rows = "";
        jQuery.ajax({
            url: "/mergefields",
            type: "GET",
            data: {},
            success: function (data, textStatus, jqXHR) {
                $("#" + tableName).empty();
                //$("#" + tableName).append(' <li class="mergeFields"><span style="font-weight:bold">Merge Fields</span></li>');
                for (var i = 0; i < data.result.length; i++) {
                    var mergeContent =
                        $('<li class="mergeFields" style="position: relative;"></li>')
                            .append(
                                $('<span id="mf~' + data.result[i].id + '" DBField="' + data.result[i].db_field + '" DBTable="' + data.result[i].db_table + '">' + data.result[i].display_name + '</span>')
                                    .css({
                                        position: 'absolute',
                                        top: 0,
                                        bottom: 0,
                                        left: 0,
                                        right: 0,
                                        'line-height': '30px',
                                        'text-indent': '5px'
                                    })
                            )
                            .hover(function () {
                                $("#" + tableName).find('img').remove();
                                var _obj = $(this).find('span').not('.highlight'),
                                    _mergeFieldValue = _obj.text(),
                                    _mergeFieldID = _obj.attr('id').split('mf~')[1],
                                    _dbField = _obj.attr('DBField'),
                                    _dbTable = _obj.attr('DBTable');
                                $('<img/>')
                                    .attr({
                                        'src': '../images/transparent.jpg',
                                        'id': 'imgMergeField'
                                    })
                                    .css({
                                        opacity: 0,
                                        overflow: 'hidden',
                                        height: $('.mergeFields').height() - 4,
                                        width: $('.mergeFields').width() - 4
                                    })
                                    .appendTo($(this))
                                $('#' + editorID).data({
                                    'mergeFieldValue': _mergeFieldValue,
                                    'mergeFieldID': _mergeFieldID,
                                    'dbField': _dbField,
                                    'dbTable': _dbTable
                                });
                            }
                                ,
                                function () {
                                    //$(this).find('img').remove();
                                });
                    $("#" + tableName).append(mergeContent);
                }
            }
        });

    },

    formatModality: function (modality_code, modality_name) {
        if (modality_code != 'All') {
            //return modality_code + ' (' + modality_name + ')';
            return modality_code;
        }
        else {
            return 'All';
        }
    },

    formatCompany: function (company_name, company_code) {
        if (company_name && company_code) {
            return company_name + ' (' + company_code + ')';
        }
    },

    validateIP: function (ip) {
        var expression = /^((([0-9]{1,2})|(1[0-9]{2,2})|(2[0-4][0-9])|(25[0-5])|\*)\.){3}(([0-9]{1,2})|(1[0-9]{2,2})|(2[0-4][0-9])|(25[0-5])|\*)$/;
        var regx = new RegExp(expression);
        return regx.test(ip);
    },

    /**
     * Set screen name cookie to Studies so different user login doesn't break, EXA-7505, EXA-7830
     */
    resetScreenNameCookie: function() {
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
                // if (data.status = "ok") {
                //}
                if (app.useDragon)
                    commonjs.cmdExaTrans('QU1T');
                else
                    commonjs.launchURL('exad:///quit');
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
    logOutConfirmation: function () {
        var self = this;
        if (app.openWindows.length) {
            commonjs.helpConfirm({
                head: "Dependent Windows Open",
                hi18n: "messages.confirm.dependentWindows",
                body: "Dependent windows are open.  Are you sure that you want to logout?",
                bi18n: "messages.confirm.dependentWindowsAreYouSure",
                buttons: [
                    {
                        text: "Yes",
                        click: function () {
                            self.closeOpenWindows();
                            self.logOut();
                        }
                    },
                    {
                        text: "No"
                    }
                ]
            });
        }
        else {
            self.logOut();
        }
    },
    closeOpenWindows: function () {
        if (app && app.openWindows) {
            for (var i = 0; i < app.openWindows.length; i++) {
                app.openWindows[i].close();
            }
        }
    },
    openScheduleBook: function () {
        ppHide();
        if (app.schBookAsNewTab) {
            var windowName = "ScheduleBook" + parseInt(Math.random() * 10000);
            commonjs.scheduleBookObj = window.open('#schedulebook/v1', windowName);
            commonjs.scheduleBookObj.location.href = '#schedulebook/v1';
            commonjs.scheduleBookObj.focus();
            app.openWindows.push(commonjs.scheduleBookObj);
            return false;
        }
        else {
            window.location.href = '#schedulebook/v1';
        }
    },
    openHomePage: function () {
        if (app.userInfo.user_type && app.userInfo.user_type == "MR")
            window.location.href = '#home/marketing/all';
        else
            window.location.href = '#home/studies/all';
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
        $("#showColor").show();
        var div = $('#showColor');
        $(document.body).append(div);

        var posX = $((e.target || e.srcElement)).offset().left - 20;
        var posY = $((e.target || e.srcElement)).offset().top + 20;
        $(div).css({ top: posY, left: posX, position: 'absolute' });
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

    checkSpecialCharExists: function(e) {
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
                    .css({'text-align': 'center','top': offsetVal.top + 30, 'left': offsetVal.left })
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

    sortByAcquisitionTime: function (array) {
        var aLength = array.length;
        var aTempLength = aLength;
        var AcquisitionTime = '_0008,002a';
        for (var i = 0; i < aLength; i++) {
            var sIndex = 0, temp;
            for (var j = 0; j < aTempLength; j++) {
                if (parseFloat(array[sIndex]["images"][0][AcquisitionTime]) > parseFloat(array[j]["images"][0][AcquisitionTime])) {
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

    checkNotEmpty: function (str) {
        if (!str) {
            return false;
        }
        return $.trim(str) != '';
    },

    clamp: function (val, min, max) {
        if (isNaN(val) === false && isNaN(min) === false && isNaN(max) === false) {
            if (parseInt(val) < min) {
                return parseInt(min);
            }
            if (parseInt(val) > max) {
                return parseInt(max);
            }
        }
        return parseInt(val);
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
       // commonjs.isMaskValidate();
        commonjs.setupCityStateZipInputs();
        if (parent.editStudyID && parent.editStudyID > 0 && app.transcriptionLock) {
            commonjs.lockUnlockTranscription({ study_id: parent.editStudyID, lockType: "unlock", user_id: app.userID });
        }
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

    initilizeCustomerScreen: function (args) {
        $('#pageHeader' + args.header.ext).show();
        //   $("#spScreenName"+args.header.ext).empty().html(args.header.screen);
        $("#divPageHeaderButtons" + args.header.ext).empty();
        var value = '';
        $.each(args.buttons, function (index, buttonArgs) {
            value = buttonArgs.value.replace(/ /g, '');
            if (!buttonArgs.type) {
                buttonArgs.type = 'button';
            }
            var i18nText = buttonArgs.i18n ? ' i18n="' + buttonArgs.i18n + '" ' : '';
            $("#divPageHeaderButtons" + args.header.ext).append('<input type="' + buttonArgs.type + '" value="' + buttonArgs.value + '" ' + i18nText + '" id="btn' + value + args.header.ext + '" class="' + buttonArgs.class + '"/>');
            if (buttonArgs.route) {
                location.href = '/' + buttonArgs.route;
            } else {
                $('#btn' + value + args.header.ext).click(buttonArgs.clickEvent);
            }
        });
        commonjs.processPostRender(args.header);
        commonjs.initializeCheckBoxSelection();
    },
    setEditorHeight: function (menuID, editorID, divHeight) {
        var height = $(menuID).height() - ($("#pageHeaderTab").height() + divHeight + 104);
        $(editorID).height(height);
        $(editorID + '_ifr').height(height);
    },

    initializeEditor: function (editorId, options) {
        var iframeHeight = '';
        iframeHeight = $(document).height() - 220 < 400 ? 400 : $(document).height() - 220;
        if (options && options.isCardiology) var height = $(window).height() - ($('.header').height() + $('.sub-top-nav').height() + $('#divSuggestionsControls').height()) - 145;
        var advanced_theme = "insertfile bold italic | alignleft aligncenter alignright alignjustify";
        var needMenu = (options && options.from == 'PORTAL') ? false : "file edit insert view format table tools save";
        var needToolbar = (options && options.from == 'PORTAL') ? (options.isNeedToolbar ? advanced_theme : false) : "insertfile undo redo | styleselect | bold italic | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | link image";
        if (options && options.needDisable)
            var readonly = 1
        else
            var readonly = (options && options.from == 'PORTAL') ? (options.isNeedToolbar ? 0 : 1) : 0;
        if (options && options.screenName == 'ccRos') {
            needToolbar += ' | newButton'
        }

        tinymce.init({
            //        selector: "textarea",
            //        editor_selector: 'reportTemplatemce',
            //        mode : "specific_textareas",
            //        editor_selector : "reportTemplatemce",
            content_css: '../stylesheets/editor.css',
            //            selector: "textarea",
            mode: "exact",
            elements: editorId,
            height: height,
            statusbar: false,
            menubar: needMenu,
            allow_script_urls: true,
            convert_urls: false,
            readonly: readonly,
            noneditable_leave_contenteditable: true,

            plugins: [
                "advlist anchor autolink lists link image charmap print preview anchor",
                "searchreplace visualblocks code fullscreen",
                "insertdatetime media table contextmenu paste noneditable"
            ],
            toolbar: needToolbar,
            setup: function (editor) {
                editor.on('change', function (e) {
                    //$('#spnAutoSaveStatus').hide();
                });

                editor.on('keyup', function (e) {
                    $('#spnAutoSaveStatus').hide();
                });

                editor.on('drop', function (e) {
                    window.setTimeout(function () {
                        var _editor = tinymce.get(editorId),
                            _content = $('<div></div>').html(_editor.getContent()),
                            _element = _editor.getDoc();
                        //_content.find('#imgMergeField').replaceWith('&nbsp;<span class="mceNonEditable" style="background-color: #fad42e;">' + $('#' + editorId).data('mergeFieldValue') + '</span>&nbsp;');
                        //_editor.setContent(_content.html());
                        //$('#imgMergeField',_element).replaceWith('&nbsp;<span data-mce-contenteditable="false" class="mceNonEditable" style="background-color: #fad42e;">' + $('#' + editorId).data('mergeFieldValue') + '</span>&nbsp;');
                        tinymce.get(editorId).insertContent('&nbsp;<span data-mce-contenteditable="false" class="mceNonEditable" style="background-color: #fad42e;" data-mce-DBField="' + $('#' + editorId).data('dbField') + '" data-mce-DBTable="' + $('#' + editorId).data('dbTable') + '" >' + $('#' + editorId).data('mergeFieldValue') + '</span>&nbsp;');
                        $('#spnAutoSaveStatus').hide();
                    }, 100);
                });
                editor.addButton('newButton', {
                    text: 'Save',
                    id: "saveNewButton",
                    styles: {
                        color: '#ff0000',
                        backgroundColor: "#0044CC"
                    },
                    background: "#0044CC",
                    backgroundColor: "#0044CC",
                    color: '#ff0000',

                    icon: false
                });
                if (options && options.screenName == 'MedicalHistory') {
                    editor.on('LoadContent', function (e) {
                        tinymce.get(editorId).setContent(options.editorContent);
                    });
                }


            }
        });

        if ($('#divMFTranscription').length) {
            $('#divMFTranscription > div:eq(1)').height(iframeHeight + 32);
            return;
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

        if (screenTitle) {
            document.title = screenTitle + '';
        }
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

    /**
     * Create a walkin appointment by opening the new study page and passing the params needed for a walkin appt.
     * Optionally, a facilityId can be passed and will be added to the params
     *
     * @param {String|Number} facilityId
     */
    createWalkinAppt: function(facilityId) {
        var qs = 'type=walkin&from=study';
        var id = facilityId || app.default_facility_id;
        qs += '&f=' + id;
        var windowName = "NewStudy" + parseInt(Math.random() * 10000);

        commonjs.newStudyObj = window.open('#order/fix/new/order?' + qs, windowName);
        commonjs.newStudyObj.focus();
        app.openWindows.push(commonjs.newStudyObj);
    },

    reloadScheduleBook: function (options) {
        if (options.type != 'providerSchedule') {
            if (opener && window.opener) {
                if (typeof opener.commonjs === 'undefined' && typeof window.opener.commonjs === 'undefined') {
                    opener = parent;
                    window.opener = parent;
                }
                if (options.isPreOrder) {
                    opener.commonjs.showStatus('Preorder has been created successfully');
                } else {
                    opener.commonjs.showStatus('Appointment has been created successfully');
                }

                // Modified to refresh the schedule book
                // SMH [ JIRA EXA-131] : 10/22/2015

                if (options.t_id && options.t_id > 0) {
                    window.opener.schedulebook.removeSchedule(options.t_id);
                    if (!options.walkin) {
                        window.opener.schedulebook.addSchedule(options.order_id, options.first_study_id);
                    }
                } else if (window.opener.$('.fc-button-refresh').length > 0) {
                    window.opener.$('.fc-button-refresh').click();
                }

                $.ajax({
                    url: "broadcast",
                    type: "POST",
                    dataType: "json",
                    data: {
                        trigger: 'scheduleupdate',
                        schedule_id: options.t_id,
                        facility_id: options.facility_id
                    },
                    success: function (data) {
                        if (data.error) {
                            handleResponseError(data.error);
                            return;
                        }
                        if (data.status = "ok") {
                        }
                    },
                    error: function (request, status, error) {
                        handleAjaxError(request, status, error);
                    }
                });
            }
            setTimeout(function () {
                if (window.opener) {
                    window.close();
                }
                else if (window.top !== window.self) {
                    // Inside an iframe (No use case for this)
                }
                else {
                    // Top level window
                    Backbone.history.navigate("#home/studies/all", true);
                }
            }, 100);
            if (app.openOrderOnCreate && window.opener) {
                window.onbeforeunload = function () {
                    if (window.opener.layout.checkLicense('Study Edit', true)) {
                        var studyId = options.study_id || options.first_study_id;
                        window.opener.editStudyID = studyId;
                        window.opener.editOrderID = options.order_id;
                        window.opener.commonjs.study_facility_id = options.facility_id;
                        window.opener.commonjs.showDialog({
                            header: 'Exam:',
                            width: '95%',
                            height: '75%',
                            url: '/vieworder#order/studyinfo/' + options.order_id + '/' + options.patient_id + "?order_status=" + options.order_status_code + "&has_deleted=" + options.orders_deleted + '&f=' + options.facility_id + '&mod=' + options.modality_id + '&study_id=' + studyId + '&status_code=' + options.status_code
                        });
                    }
                };
            }
        }
        else if (options.type == 'providerSchedule') {
            if (options.order_id && options.order_id > 0) {
                $('#divScheduleProvider .icon-ic-close').click();
            }

        }

    },

    getRightClickMenu:function(elementID,i18n,isSubMenu,elementName,isULMenu){  
        if(isULMenu){
            return '<li class="dropdown-submenu"><a tabindex="-1" href="javascript: void(0)" i18n='+i18n+' class="dropdown-item">'+elementName+'</a><ul id='+elementID+' style="float:right;" class="dropdown-menu"></ul></li>';
        }
        else if(isSubMenu){
            return '<li><a class="dropdown-item" id=' + elementID + '  href="javascript: void(0)" >' + elementName + '</a></li>'
        }
        else{
            return '<li><a id='+elementID+' href="javascript: void(0)" i18n='+i18n+' class="dropdown-item">'+elementName+'</a></li>';
        }   
        
    },

    getColorCodeForStatus: function (facility_id, code, screenName) {
        var statusCodes = app.study_status.length && app.study_status ||parent.app.study_status;
        if (statusCodes && statusCodes.length > 0) {
            return $.grep(statusCodes, function (currentObj) {
                return ((currentObj.facility_id == facility_id) && (currentObj.status_code == code));
            });
        }
        return [];
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

    setupMenuHeight: function () {
        var setupMenuHeight = $(window).height() - ($('body>#indexHeader').height() + $('body>footer').height() + 30);
        return setupMenuHeight;
    },

    initMouseWheel: function () {
        $("#divGadgetSummary").mousewheel(function (event, delta) {
            var scrollLeft = $(this).scrollLeft() - (delta * 30);
            $(this).scrollLeft(scrollLeft);
            event.preventDefault();

        });
    },

    setFocusToSave: function (e, formID) {
        $('#' + formID).submit();
    },

    showFacilityPage: function () {
        commonjs.showLoading();
        $.ajax({
            url: '/updateSessionValues',
            type: "PUT",
            data: {},
            success: function (model, response) {
                commonjs.hideLoading();
                location.href = '/exa#home/studies/all';
            },
            error: function (model, response) {
                commonjs.handleXhrError(model, response);
            }
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

    getParametersByName: function() {
        if (location.hash.indexOf('&') > -1) {
            return commonjs.getParameterByName(location.hash);
        }
        return commonjs.getParameterByName(location.search,/[\?&#]/);
    },

    getParameterByName: function (queryString,sep) {
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
    getPatientUrl: function (screenName, patientId, moduleName, show_in_popup) {
        var self = this;
        if (app.enable_rcopia) {
            patientId = patientId ? patientId : $("#hdnPatID").val()
            var rcopia_id = $("#hdnRcopiaID").val() ? $("#hdnRcopiaID").val() : parent.$('#hdnPatRcopiaID').val();
            if (rcopia_id) {
                commonjs.showLoading('');
                self.bindRcopiaLink(screenName, patientId, moduleName, show_in_popup);
            }
            else
                self.importPatientRcopia(screenName, patientId, moduleName, show_in_popup);
        }
        else
            commonjs.showWarning('500 Internal Server Error');
    },
    importPatientRcopia: function (screenName, patientId, moduleName, show_in_popup) {
        var self = this;
        commonjs.showLoading('Please wait,Patient Demographic importing into Rcopia', "largewarning");
        jQuery.ajax({
            url: "/importPatientRcopia",
            type: "PUT",
            data: {
                id: (moduleName == "Order") ? patientId : $("#hdnPatID").val(),
                screenName: screenName
            },
            success: function (data, textStatus, jqXHR) {
                if (data && data.result && data.result.length > 0)
                    $("#hdnRcopiaID").val(data.result[0].rcopia_id);
                self.bindRcopiaLink(screenName, patientId, moduleName, show_in_popup)
            },
            error: function (err) {
                commonjs.handleXhrError(err);
            }
        });
    },
    bindRcopiaLink: function (screenName, patientId, moduleName, show_in_popup) {
        var rcopia_id = $("#hdnRcopiaID").val() ? $("#hdnRcopiaID").val() : parent.$('#hdnPatRcopiaID').val();
        jQuery.ajax({
            url: "/getRecopia",
            type: "GET",
            data: {
                rcopia_patient_id: rcopia_id,
                patient_id: patientId ? patientId : parent.$("#hdnpatID").val(),
                screenName: screenName
            },
            success: function (data, textStatus, jqXHR) {
                commonjs.hideLoading();
                if (show_in_popup) {
                    commonjs.new_rcopia_window = window.open(data, "popupWindow", "width=820,height=700,scrollbars=yes");
                    if (commonjs.new_rcopia_window.focus)
                        commonjs.new_rcopia_window.focus();
                }
                else
                    commonjs.showDialog({ header: 'Rcopia', i18nHeader: 'menuTitles.setup.rcopia', width: '85%', height: '77%', url: data });
            },
            error: function (err) {
                commonjs.handleXhrError(err);
            }
        });
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

    updateViewerConfig: function (currentObj, currentSettingType, updateinfo, contextMenuJson) {
        if (parent.prefetch && parent.prefetch.viewerConfig) {
            switch (currentSettingType) {
                case 'viewer_general_config':
                    parent.prefetch.viewerConfig.viewer_general_config = currentObj;
                    var wObj = parent.prefetchViewer.getWindowToDisplay();
                    if (window.parent && window.parent.opener && window.parent.opener.prefetch) window.parent.opener.prefetch.viewerName = wObj.parentWnd.name;
                    break;
                case 'viewer_interface_config':
                    parent.prefetch.viewerConfig.viewer_interface_config = currentObj;
                    prefetch.getAutoOpenOrders(parent.prefetch.viewerConfig.viewer_interface_config);
                    break;
                case 'viewer_modality_options':
                    parent.prefetch.viewerConfig.viewer_modality_options = currentObj;
                    break;
                case 'viewer_overlay_config':
                    parent.prefetch.viewerConfig.viewer_overlay_config = currentObj;
                    break;
                case 'viewer_tools_config':
                    if (parent.common && parent.common.checkCmenuJson) parent.common.checkCmenuJson(updateinfo);
                    parent.prefetch.viewerConfig.viewer_tools_config = currentObj;
                    if (parent.prefetch.viewerConfig.tools && parent.prefetch.viewerConfig.tools.ContextMenu) {
                        parent.prefetch.viewerConfig.tools.ContextMenu = contextMenuJson;
                    }
                    break;
                case 'viewer_external_tools':
                    parent.prefetch.viewerConfig.viewer_external_tools = currentObj;
                    break;
                case 'viewer_cardio_config':
                    parent.prefetch.viewerConfig.viewer_cardio_config = currentObj;
                    break;

            }
        }

        if (parent.config && parent.viewerConfig) {
            switch (currentSettingType) {
                case 'viewer_general_config':
                    parent.viewerConfig.viewer_general_config = currentObj;
                    prefetchViewer.getWindowToDisplay()
                    break;
                case 'viewer_interface_config':
                    parent.viewerConfig.viewer_interface_config = currentObj;
                    prefetch.getAutoOpenOrders(parent.viewerConfig.viewer_interface_config);
                    break;
                case 'viewer_modality_options':
                    parent.viewerConfig.viewer_modality_options = currentObj;
                    break;
                case 'viewer_overlay_config':
                    parent.viewerConfig.viewer_overlay_config = currentObj;
                    break;
                case 'viewer_tools_config':
                    if (parent.common && parent.common.checkCmenuJson) parent.common.checkCmenuJson(updateinfo);
                    parent.viewerConfig.viewer_tools_config = currentObj;
                    if (parent.viewerConfig.tools && parent.viewerConfig.tools.ContextMenu) {
                        parent.viewerConfig.tools.ContextMenu = contextMenuJson;
                    }
                    break;
                case 'viewer_external_tools':
                    parent.viewerConfig.viewer_external_tools = currentObj;
                    break;
                case 'viewer_cardio_config':
                    parent.viewerConfig.viewer_cardio_config = currentObj;
                    break;

            }
        }
        if (parent.opener && parent.opener.prefetch && parent.opener.prefetch.viewerConfig) {
            switch (currentSettingType) {
                case 'viewer_general_config':
                    parent.opener.prefetch.viewerConfig.viewer_general_config = currentObj;
                    parent.opener.prefetchViewer.getWindowToDisplay()
                    break;
                case 'viewer_interface_config':
                    if (parent.config && currentObj && currentObj.viewerinterface && parent.config.viewerConfig && parent.config.viewerConfig.viewer_interface_config && parent.config.viewerConfig.viewer_interface_config.viewerinterface) {
                        var currentViewerInterface = currentObj.viewerinterface, viewerInterface = parent.config.viewerConfig.viewer_interface_config.viewerinterface;
                        //if ((currentViewerInterface.ask_on_close != viewerInterface.ask_on_close) && parent.events)
                        //    parent.events.initWindowOnBeforeUnload(currentObj);
                        if ((currentViewerInterface.high_interpolation != viewerInterface.high_interpolation) && parent.utilities)
                            parent.utilities.renderInterpolatedImage(currentObj);
                        if ((currentViewerInterface.thumbnail_bar_orientation.toLowerCase() != viewerInterface.thumbnail_bar_orientation.toLowerCase() || (currentViewerInterface.thumbnail_column_rows != viewerInterface.thumbnail_column_rows)) && parent.uiRendering && !currentViewerInterface.useToolbarV2) {
                            var isRowColChanged = false;
                            if (currentViewerInterface.thumbnail_column_rows != viewerInterface.thumbnail_column_rows) {
                                viewerInterface.thumbnail_column_rows = currentViewerInterface.thumbnail_column_rows;
                                isRowColChanged = true;
                            }
                            parent.uiRendering.changeFooterOrientation(currentViewerInterface.thumbnail_bar_orientation.toLowerCase(), null, isRowColChanged);
                            if (parent.config && parent.config.childWin && parent.config.childWin.length > 0)
                                parent.uiRendering.changePriorWFooterOrientation(isRowColChanged);
                        }
                        if ((currentViewerInterface.fill_empty_dm != viewerInterface.fill_empty_dm) && parent.windowHandler) {
                            parent.config.fillEmptyCells = currentViewerInterface.fill_empty_dm;
                            parent.windowHandler.setChildWindowProps('fillEmptyCells');
                        }
                        if (parseInt(currentViewerInterface.mangify_glass_size) != parseInt(viewerInterface.mangify_glass_size))
                            parent.common.setMagnifyProps(currentViewerInterface, 'glassSize');
                        if (parseInt(currentViewerInterface.factor) != parseInt(viewerInterface.factor))
                            parent.common.setMagnifyProps(currentViewerInterface, 'scaleFactor');
                        var calipers = '';
                        if (currentViewerInterface.caliper_bottom) calipers += 'B';
                        if (currentViewerInterface.caliper_left) calipers += 'L';
                        if (currentViewerInterface.caliper_right) calipers += 'R';
                        if (currentViewerInterface.caliper_top) calipers += 'T';

                        if (calipers != parent.config.showCalipers) {
                            parent.config.showCalipers = calipers;
                            parent.overlays.updateCaliperScale();
                            parent.windowHandler.setChildWindowProps('updateCaliper');
                        }
                    }
                    parent.opener.prefetch.viewerConfig.viewer_interface_config = currentObj;
                    prefetch.getAutoOpenOrders(parent.opener.prefetch.viewerConfig.viewer_interface_config);
                    parent.config.autoOpenOrders = parent.opener.prefetch.viewerConfig.viewer_interface_config.viewerinterface.ordersToOpen;
                    break;
                case 'viewer_modality_options':
                    if (parent.config && currentObj && currentObj[parent.config.studyObj[0]._modality] && currentObj[parent.config.studyObj[0]._modality].option &&
                        parent.config.viewerConfig && parent.config.viewerConfig.viewer_modality_options && parent.config.viewerConfig.viewer_modality_options[parent.config.studyObj[0]._modality] &&
                        parent.config.viewerConfig.viewer_modality_options[parent.config.studyObj[0]._modality].option) {
                        var modality = currentObj[parent.config.studyObj[0]._modality], viewerModality = parent.config.viewerConfig.viewer_modality_options[parent.config.studyObj[0]._modality];
                        if ((modality.option.auto_clahe != viewerModality.option.auto_clahe) && parent.utilities)
                            parent.utilities.enableClahe(currentObj);
                        if ((modality.option.last_contrast_entry != viewerModality.option.last_contrast_entry))
                            parent.config.isWLByLastEntry = modality.option.last_contrast_entry ? -1 : 0;
                        if ((modality.option.keepwl != viewerModality.option.keepwl) && parent.windowHandler) {
                            parent.config.maintainPreviousWL = modality.option.keepwl;
                            parent.windowHandler.setChildWindowProps('maintainWL');
                        }
                        if ((modality.option.keep_zoom != viewerModality.option.keep_zoom) && parent.windowHandler) {
                            parent.config.maintainPreviousZoom = modality.option.keep_zoom;
                            parent.windowHandler.setChildWindowProps('maintainZoom');
                        }
                        if ((modality.option.keep_rotate != viewerModality.option.keep_rotate) && parent.windowHandler) {
                            parent.config.maintainPreviousRotate = modality.option.keep_rotate;
                            parent.windowHandler.setChildWindowProps('maintainRotate');
                        }
                        if ((modality.option.stop_thumbnail != viewerModality.option.stop_thumbnail) && parent.windowHandler) {
                            parent.config.isVirtualThumbnail = !modality.option.stop_thumbnail;
                            parent.windowHandler.setChildWindowProps('VirtualThumbnail');
                        }
                    }
                    parent.opener.prefetch.viewerConfig.viewer_modality_options = currentObj;
                    break;
                case 'viewer_overlay_config':
                    parent.opener.prefetch.viewerConfig.viewer_overlay_config = currentObj;
                    break;
                case 'viewer_tools_config':
                    if (parent.common && parent.common.checkCmenuJson) parent.common.checkCmenuJson(updateinfo);
                    parent.opener.prefetch.viewerConfig.viewer_tools_config = currentObj;
                    if (parent.config && parent.config.viewerConfig) {
                        parent.config.viewerConfig.viewer_tools_config = currentObj;
                        if (parent.config.viewerConfig.tools && parent.config.viewerConfig.tools.ContextMenu) {
                            parent.config.viewerConfig.tools.ContextMenu = contextMenuJson;
                        }
                    }
                    break;
                case 'viewer_external_tools':
                    parent.opener.prefetch.viewerConfig.viewer_external_tools = currentObj;
                    break;
                case 'viewer_cardio_config':
                    parent.opener.prefetch.viewerConfig.viewer_cardio_config = currentObj;
                    break;

            }
        }
        if (parent.opener && parent.opener.prefetch && parent.opener.prefetch.viewerConfig) {
            switch (currentSettingType) {
                case 'viewer_general_config':
                    parent.opener.prefetch.viewerConfig.viewer_general_config = currentObj;
                    parent.opener.prefetchViewer.getWindowToDisplay()
                    break;
                case 'viewer_interface_config':
                    parent.opener.prefetch.viewerConfig.viewer_interface_config = currentObj;
                    prefetch.getAutoOpenOrders(parent.opener.prefetch.viewerConfig.viewer_interface_config);
                    break;
                case 'viewer_modality_options':
                    parent.opener.prefetch.viewerConfig.viewer_modality_options = currentObj;
                    break;
                case 'viewer_overlay_config':
                    parent.opener.prefetch.viewerConfig.viewer_overlay_config = currentObj;
                    break;
                case 'viewer_tools_config':
                    if (parent.common && parent.common.checkCmenuJson) parent.common.checkCmenuJson(updateinfo);
                    parent.opener.prefetch.viewerConfig.viewer_tools_config = currentObj;
                    if (parent.opener.prefetch.viewerConfig.tools && parent.opener.prefetch.viewerConfig.tools.ContextMenu) {
                        parent.opener.prefetch.viewerConfig.tools.ContextMenu = contextMenuJson;
                    }
                    break;
                case 'viewer_external_tools':
                    parent.opener.prefetch.viewerConfig.viewer_external_tools = currentObj;
                    break;
                case 'viewer_cardio_config':
                    parent.opener.prefetch.viewerConfig.viewer_cardio_config = currentObj;
                    break;

            }
        }
        if (parent.common && parent.common.viewerSettingOptionUpdate) parent.common.viewerSettingOptionUpdate(currentObj, currentSettingType);
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

    openFilterListNextStudy: function (rowID) {
        var filterID = commonjs.currentStudyFilter;
        if (commonjs.nextRowID > 0 && commonjs.currentGridID && filterID) {
            var currentID = rowID ? rowID : commonjs.nextRowID;
            var filter = commonjs.loadedStudyFilters.get(filterID);
            var gridData = filter.getData(currentID);
            if (gridData && commonjs.checkDicomStatus(gridData.dicom_status, gridData.no_of_instances)) {
                var currentRow = $(commonjs.currentGridID).find('#' + currentID);
                var nextrow = currentRow.next();
                var prevrow = currentRow.prev();
                if (!rowID)commonjs.nextRowID = commonjs.previousRowID = 0;
                while (nextrow.attr('id') > 0) {
                    var nextID = nextrow.attr('id');
                    var nextGridData = filter.getData(nextID);
                    if (commonjs.checkDicomStatus(nextGridData.dicom_status, nextGridData.no_of_instances)) {
                        if (rowID)
                            rowID = nextID;
                        else
                            commonjs.nextRowID = nextID;
                        break;
                    }
                    else {
                        nextrow = nextrow.next();
                    }
                }
                while (prevrow.attr('id') > 0) {
                    var prevID = prevrow.attr('id');
                    var prevGridData = filter.getData(prevID);
                    if (commonjs.checkDicomStatus(prevGridData.dicom_status, prevGridData.no_of_instances)) {
                        commonjs.previousRowID = prevID;
                        break;
                    }
                    else {
                        prevrow = prevrow.next();
                    }
                }
                if(rowID) return rowID;
                console.log('Study prefetch called for ' + currentID + ' via auto next study on ' + Date.now());
                if (typeof uiRendering != "undefined") uiRendering.showViewerLoadingForWindows(false, 'Initializing next study');
                commonjs.processStudyInfo(currentID, gridData.modalities, function () {
                    if (typeof uiRendering != "undefined") uiRendering.hideViewerLoadingForWindows(false);
                    commonjs.showDicomViewer(currentID, false, commonjs.currentGridID);
                    //                    if (!response.err && response.data && !response.data.error) {
                    //                        console.log('Study prefetch success for ' + currentID + ' on ' + Date.now());
                    //                        commonjs.showDicomViewer(currentID, false, commonjs.currentGridID);
                    //                    } else {
                    //                        if(typeof uiRendering != "undefined") uiRendering.showError('Cannot prefetch next study');
                    //                        console.log('Study prefetch error for ' + currentID + ' on ' + Date.now());
                    //                        commonjs.showError(response && response.data && response.data.displayMessage || 'Some error occurred while prefetching');
                    //                        commonjs.prefetchErr[currentID] = true;
                    //                        prefetch.childWindow = null;
                    //                    }
                });
            }
        }
        else {
            return false;
        }
    },

    openFilterListPreviousStudy: function () {
        if (commonjs.previousRowID > 0 && commonjs.currentGridID != '') {
            var self = this;
            commonjs.showDicomViewer(commonjs.previousRowID, false, commonjs.currentGridID);
        }
        else
            return false;
    },

    showScan: function (e) {
        e = e || window.event;
        var element = e.target || e.srcElement;
        var embed = document.createElement('embed');
        embed.setAttribute('type', 'application/x-ms-application');
        embed.setAttribute('width', 0);
        embed.setAttribute('height', 0);
        // Have to add the embed to the document for it
        // to actually instantiate.
        document.body.appendChild(embed);
        embed.launchClickOnce(element.href);
        // Don't remove the embed right away b/c it can
        // cancel the download of the .application.
        return false;

    },

    getClinicalRules: function (patient_id) {
        $.ajax({
            url: '/getClinicalRuleWarningandRecommendation',
            type: "GET",
            data: {
                patient_id: patient_id
            },
            success: function (model, response) {
                var idArray = [];
                var uniqueRules = [];
                if (model.result && model.result.length > 0) {
                    $.each(model.result, function (index, value) {
                        if ($.inArray(value.id, idArray) === -1) {
                            idArray.push(value.id);
                            uniqueRules.push(value);
                        }
                    });
                }
                var warningTable = '';
                $.each(uniqueRules, function (index, value) {
                    if (index == 0) {
                        warningTable = '<table style="margin: 20px;width:80%;"  class="table table-bordered"><thead><tr><th>Warning</th><th>Recommendation</th></tr></thead><tbody>';
                    }
                    warningTable += '<tr><td>' + value.warning + '</td><td>' + value.recommendation + '</td></tr>';

                });
                warningTable += '</tbody></table>';
                commonjs.showDialog({
                    header: 'Clinical Decision Support Rules[Validation Results]',
                    i18nHeader: 'shared.screens.setup.clinicalDecisionSupportRules',
                    width: '80%',
                    height: '40%',
                    html: warningTable
                });
            },
            error: function (model, response) {
                commonjs.handleXhrError(model, response);
            }
        });
    },

    checkToBeReviewedExist: function (patID) {
        var self = this;
        var patient_id = base64.decode(patID);
        $.ajax({
            url: '/checkToBeReviewedExist',
            type: "GET",
            data: {
                patient_ID: patient_id
            },
            success: function (data, response) {
                if (data && data.result) {
                    if (data.result.count > 0) {
                        $('#side_nav_p_toBeReviewed').show();
                    }
                    else {
                        $('#side_nav_p_toBeReviewed').hide();
                    }
                }
            },
            error: function (model, response) {
                commonjs.handleXhrError(model, response);
            }
        });
    },

    clearAllTimeouts: function () {
        //        var id = window.setTimeout(null,0);
        //        while (id--)
        //        {
        //            if(id != tickTimer){
        //                window.clearTimeout(id);
        //            }
        //
        //        }
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

    getProviderContactIDs: function (providercontacts) {
        var providercontact_ids = [];
        if (providercontacts.length == 0) {
            return providercontact_ids;
        }
        $.each(providercontacts, function (index, obj) {
            providercontact_ids.push(obj.id);
        });
        return providercontact_ids;
    },

    lockUnlockTranscription: function (options) {
        var self = this;
        app.transcriptionLock = false;
        $.ajax({
            url: '/lockUnlockTranscription',
            type: "PUT",
            data: options,
            success: function (data, textStatus, jqXHR) {
                //                parent.editStudyID = 0;
            },
            error: function (model, response) {
                commonjs.handleXhrError(model, response);
            }
        });
    },

    /**
     * Custom deep diffing to tell what changes throughout our data transfers
     * Don't recommend for testing functions.
     * @param item1 <>
     * @param item2 <>
     * @param [isReversed] <Boolean>
     * @returns <Array>(Object*)
     */

    deepDiff: function deepDiff(item1, item2, isReversed) {

        function isEmpty(val) {
            return typeof val === 'undefined' || val === null || Number.isNaN(val);
        }

        function makeFail(val1, val2, key) {
            return {
                key: key,
                val1: !isReversed ? val1 : val2,
                val2: !isReversed ? val2 : val1
            };
        }

        function propDiff(first, second, key) {
            if (isEmpty(first) || isEmpty(second)) {
                return [makeFail(first, second, key)]
            }
            var firstKeys = Object.keys(first);
            var secondKeys = Object.keys(second);

            var needsReverse = firstKeys.length !== secondKeys.length;

            var fails = Object.keys(first).reduce(function (fails, key) {
                // console.log(key, first[ key ], second[ key ]);
                if (first[key] === second[key]) {
                    return fails;
                }
                if (!second.hasOwnProperty(key)) {
                    needsReverse = true;
                    fails.push(makeFail(first[key], '***MISSING***', key));
                }
                else {
                    return fails.concat(compareValues(first[key], second[key], key));
                }
                return fails;
            }, []);

            if (needsReverse === true && isReversed !== true) {
                return fails.concat(deepDiff(second, first, true));
            }
            return fails;
        }

        function testArrays(val1, val2, key, isReversed) {

            var shouldContinue = function (val1, val2) {
                return typeof val1 === typeof val2 && (
                    typeof val1 !== 'string' ||
                    typeof val1 !== 'number' ||
                    typeof val1 !== 'boolean');
            };

            var needsReverse = val1.length !== val2.length;

            var fails = val1.reduce(function (missing, value, index) {
                var newKey = key !== null ?
                    (key + '[' + index + ']') :
                    index;

                if (val2.indexOf(value) === -1) {
                    if (shouldContinue(value, val2[index])) {
                        return missing.concat(deepDiff(value, val2[index], newKey));
                    }
                    else {
                        needsReverse = true;
                        missing.push(makeFail(value, '***MISSING***', newKey));
                    }
                }
                return missing;
            }, []);
            if (needsReverse === true && isReversed !== true) {
                return fails.concat(testArrays(val2, val1, key, true));
            }
            return fails;
        }

        function compareValues(val1, val2, key) {
            var fails = [];
            if (typeof val1 === 'object') {
                if (typeof val2 === 'object') {
                    if (Array.isArray(val1)) {
                        if (Array.isArray(val2)) {
                            return fails.concat(testArrays(val1, val2, key));
                        }
                        else {
                            fails.push(makeFail(val1, val2, key));
                        }
                    }
                    else {
                        return fails.concat(propDiff(val1, val2, key));
                    }
                }
                else {
                    fails.push(makeFail(val1, val2, key));
                }
            }
            else {
                fails.push(makeFail(val1, val2, key));
            }
            return fails;
        }

        function diff(first, second) {
            return first !== second ? compareValues(first, second, null) : [];
        }

        if (typeof item2 === 'undefined') {
            return function (item2) {
                return diff(item1, item2);
            }
        }
        return diff(item1, item2);
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
    downloadString: function (data, strFileName, strMimeType) {
        var self = window, // this script is only for browsers anyway...
            octetStream = "application/octet-stream", // this default mime also triggers iframe downloads
            mime = strMimeType || octetStream,
            content = data,
            doc = document,
            a = doc.createElement("a"),
            str = function (a) {
                return String(a);
            },
            B = (self.Blob || self.MozBlob || self.WebKitBlob || str);
        B = B.call ? B.bind(self) : Blob;
        var fn = strFileName || "download",
            blob,
            fr;

        if (String(this) === "true") { //reverse arguments, allowing download.bind(true, "text/xml", "export.xml") to act as a callback
            content = [content, mime];
            mime = content[0];
            content = content[1];
        }

        //go ahead and download dataURLs right away
        if (String(content).match(/^data\:[\w+\-]+\/[\w+\-]+[,;]/)) {
            return navigator.msSaveBlob ?  // IE10 can't do a[download], only Blobs:
                navigator.msSaveBlob(d2b(content), fn) :
                saver(content); // everyone else can save dataURLs un-processed
        }//end if dataURL passed?

        blob = content instanceof B ?
            content :
            new B([content], { type: mime });

        function d2b(octetStream) {
            var p = octetStream.split(/[:;,]/),
                t = p[1],
                dec = p[2] == "base64" ? atob : decodeURIComponent,
                bin = dec(p.pop()),
                mx = bin.length,
                i = 0,
                uia = new Uint8Array(mx);

            for (i; i < mx; ++i) uia[i] = bin.charCodeAt(i);

            return new B([uia], { type: t });
        }

        function saver(url, winMode) {
            if ('download' in a) { //html5 A[download]
                a.href = url;
                a.setAttribute("download", fn);
                a.innerHTML = "downloading...";
                doc.body.appendChild(a);
                setTimeout(function () {
                    a.click();
                    doc.body.removeChild(a);
                    if (winMode === true) {
                        setTimeout(function () {
                            self.URL.revokeObjectURL(a.href);
                        }, 250);
                    }
                }, 66);
                return true;
            }

            if (typeof safari !== "undefined") { // handle non-a[download] safari as best we can:
                url = "data:" + url.replace(/^data:([\w\/\-\+]+)/, uoctetStream);
                if (!window.open(url)) { // popup blocked, offer direct download:
                    if (confirm("Displaying New Document\n\nUse Save As... to download, then click back to return to this page.")) {
                        location.href = url;
                    }
                }
                return true;
            }

            //do iframe dataURL download (old ch+FF):
            var f = doc.createElement("iframe");
            doc.body.appendChild(f);

            if (!winMode) { // force a mime that will download:
                url = "data:" + url.replace(/^data:([\w\/\-\+]+)/, octetStream);
            }
            f.src = url;
            setTimeout(function () {
                doc.body.removeChild(f);
            }, 333);

        }//end saver

        if (navigator.msSaveBlob) { // IE10+ : (has Blob, but not a[download] or URL)
            return navigator.msSaveBlob(blob, fn);
        }

        if (self.URL) { // simple fast and modern way using Blob and URL:
            saver(self.URL.createObjectURL(blob), true);
        }
        else {
            // handle non-Blob()+non-URL browsers:
            if (typeof blob === "string" || blob.constructor === str) {
                try {
                    return saver("data:" + mime + ";base64," + self.btoa(blob));
                } catch (y) {
                    return saver("data:" + mime + "," + encodeURIComponent(blob));
                }
            }
            // Blob but not URL:
            fr = new FileReader();
            fr.onload = function (e) {
                saver(this.result);
            };
            fr.readAsDataURL(blob);
        }
        return true;
    } /* end download() */,

    /**
     * Determines if the user has permission for the given permission code
     * @param {String} code
     * @returns {boolean}
     */
    hasPermission: function(code) {
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

    getExaClientConfig: function () {
        return {
            renderingPort: 8421,
            dictationPort: 8422,
            importPort: 8423,
            burnPort: 8424
        };
    },


    cmdExaTrans: function (cmdType) {
        if (opener && opener.commonjs.isSingleInstance && cmdType !== 'QU1T')
            return true;
        var winloc = window.location;
        var transUrl = 'exat://' + winloc.protocol + '@' + winloc.hostname + ':' + winloc.port + '/' + cmdType;
        if (!$('#transiFrame').length) {
            $('<iframe/>', {
                id: 'transiFrame',
                src: transUrl
            }).appendTo('body');
        }
        else
            $('#transiFrame').attr('src', transUrl);

    },

    launchExaTrans: function (patientId, studyId, orderId, studyStatus, returnUrl, callback) {
        var self = this;
        var queryStr = '';
        var commonQueryStrVal = [];

        var timeValid = new Boolean();
        var d = new Date();
        if (opener && opener.commonjs && opener.commonjs.isSingleInstance)
            return true;
        //adding seconds check to avoid duplicate calls from viewer.
        if (prevTime == null) {
            prevTime = d.getTime();
            timeValid = true;
        }
        else {
            if (d.getTime() - prevTime > 2000)
                timeValid = true;
        }
        if (timeValid === true) {
            //console.log('calling exatrans');
            prevTime = d.getTime();
            $.ajax({
                url: '/getLockTranscription',
                type: "GET",
                data: {
                    study_id: studyId,
                    user_id: app.userID
                },
                success: function (data, textStatus, jqXHR) {
                    commonjs.hideLoading();
                    var isAvailable = false;

                    if (data && data.result && data.result.rows.length > 0 && data.result.rows[0].transcription_status == "available") {
                        isAvailable = true;
                    }
                    else {
                        isAvailable = false;
                        var isChildWindow = (window.opener && window.opener.config) ? true : false;
                        var _childWindows = 0;
                        if (isChildWindow && window.opener.config) {
                            _childWindows = window.opener.config.childWin
                        }
                        else if (typeof config != "undefined") {
                            _childWindows = config.childWin;
                        }
                        var numChildWindows = _childWindows ? (_childWindows.length || 0) : 0;
                        for (var w = 0; w < numChildWindows; w++) {
                            _childWindows[w].commonjs.helpBox({ text: "Study transcription locked by another user", class: "viewer_warning" });
                        }

                        if (isChildWindow) {
                            window.opener.commonjs.helpBox({ text: "Study transcription locked by another user", class: "viewer_warning" });
                        }
                        else {
                            self.helpBox({ text: "Study transcription locked by another user", class: "viewer_warning" });
                        }
                    }

                    if (isAvailable === true) {

                        $.ajax({
                            url: "/transcription",
                            data: {
                                id: studyId,
                                transcription_type: 'F'
                            },
                            type: "GET",
                            dataType: "json",
                            async: true,
                            success: function (response) {
                                if (response.result) {
                                    var submitForReview = commonjs.checkScreenRight('Submit For Review', true);
                                    var isApproveRights = commonjs.checkScreenRight('Approve', true);
                                    var isAddendumRights = commonjs.checkScreenRight('Transcription(Addendum)', true);
                                    var isAddendumApprove = commonjs.checkScreenRight('Approve(Addendum)', true);
                                    var isAddendumReview = commonjs.checkScreenRight('Submit For Review(Addendum)', true);
                                    var provider_id = 0;
                                    if (app.providercontacts && app.providercontacts[0])
                                        provider_id = app.providercontacts[0].id;

                                    commonQueryStrVal = [
                                        'patient_id=' + patientId,
                                        'study_id=' + studyId,
                                        'order_id=' + orderId,
                                        'host_name=' + location.origin,
                                        'user_id=' + app.userID,
                                        'text_type=' + "RT",
                                        'port=' + location.port,
                                        'screen_name=' + "Transcription",
                                        'company_id=' + app.companyID,
                                        'client_ip=' + location.hostname,
                                        'study_status=' + studyStatus,
                                        'session_id=' + app.sessionID,
                                        'base_session_id=' + btoa(app.sessionID),
                                        'has_submitForReview=' + submitForReview,
                                        'has_approve=' + isApproveRights,
                                        'has_addendum=' + isAddendumRights,
                                        'has_addendum_approve=' + isAddendumApprove,
                                        'has_addendum_review=' + isAddendumReview,
                                        'group_id=' + app.userInfo.groupCode,
                                        'company_code=' + app.company_code,
                                        'user_type=' + app.userInfo.user_type,
                                        'provider_radiology_id=' + provider_id
                                    ];

                                    var queryStrVal;

                                    if (response.result.length > 0) {
                                        var resp = response.result[0];
                                        var transcription_id = resp.id
                                        //var transcriptionData = response.result[0].transcription_data;
                                        var is_addendum = resp.is_addendum,
                                            addendum_no = resp.addendum_no,
                                            text_type = resp.text_type,
                                            is_current = resp.is_current,
                                            version_no = resp.version_no,
                                            trans_type = resp.transcription_type;
                                        queryStrVal = [
                                            'addendum_no=' + addendum_no,
                                            'is_addendum=' + is_addendum,
                                            'version_no=' + version_no,
                                            'transcription_type=' + trans_type,
                                            'is_current=' + is_current,
                                            'transcription_id=' + transcription_id
                                        ];

                                    }
                                    else {
                                        queryStrVal = [
                                            'addendum_no=0',
                                            'is_addendum=false',
                                            'version_no=0',
                                            'transcription_type=' + "F",
                                            'is_current=false'
                                        ];
                                    }

                                    commonQueryStrVal = commonQueryStrVal.concat(queryStrVal);
                                    queryStr = commonQueryStrVal.join('&');
                                    if (app.useDragon && app.useDragon === true) {
                                        queryStr += "&username=" + app.userInfo.userName;
                                        if (app.userInfo.dragon360 && app.userInfo.dragon360 === true) {
                                            queryStr += "&D360=" + app.d360OrgToken;
                                        }
                                    }
                                if (app.exaTransFontName) {
                                    queryStr += "&font_name=" + base64.encode(app.exaTransFontName);
                                }
                                if (app.exaTransFontSize) {
                                    queryStr += "&font_size=" + app.exaTransFontSize;
                                }

                                    //console.log(queryStr);
                                    var winloc = window.location;
                                    var transUrl = 'exat://' + winloc.protocol + '@' + winloc.hostname + ':' + winloc.port + '/api?' + queryStr;
                                    //var transUrl = 'exat://' + (app.transcriptionServerUrl.replace('//','@')) + '/api?' + queryStr;
                                    if (returnUrl && returnUrl === true) {
                                        callback(encodeURIComponent(transUrl));
                                        return;
                                    }

                                    console.log("setting exatrans url");
                                    console.log(transUrl);

                                    //BC:adding an option for delay as certain user viewer configurations require a delayed launch.
                                    if (app.exaTransDelay) {
                                        setTimeout(function () {
                                            if (!$('#transiFrame').length) {
                                                $('<iframe/>', {
                                                    id: 'transiFrame',
                                                    src: transUrl
                                                }).appendTo('body');
                                            }
                                            else {
                                                $('#transiFrame').attr('src', transUrl);
                                            }
                                        }, 2000);
                                    }
                                    else {
                                        if (!$('#transiFrame').length) {
                                            $('<iframe/>', {
                                                id: 'transiFrame',
                                                src: transUrl
                                            }).appendTo('body');
                                        }
                                        else {
                                            $('#transiFrame').attr('src', transUrl);
                                        }
                                    }

                                    commonjs.lockUnlockTranscription({ study_id: studyId, lockType: "lock", user_id: app.userID });
                                    //commonjs.showDialog({header: 'Transcription', width: '95%', height: '75%', url: 'exat://'+window.location.protocol+'@'+window.location.hostname+':'+window.location.port +'/api?'+queryStr});
                                }
                            },

                            error: function (xhr, status, errorThrown) {
                                console.log("Error: " + errorThrown);
                                console.log("Status: " + status);
                                console.dir(xhr);
                                if (returnUrl && returnUrl === true)
                                    callback(encodeURIComponent(""));

                            }

                        });
                    }
                },

                error: function (model, response) {
                    commonjs.handleXhrError(model, response);
                }
            });
        }

    },

    getTranscriptionLock: function (studyID) {
        $.ajax({
            url: '/getLockTranscription',
            type: "GET",
            data: {
                study_id: studyID,
                user_id: app.userID
            },
            success: function (data, textStatus, jqXHR) {
                if (data && data.result && data.result.rows[0] && data.result.rows[0].transcription_status == "locked") {
                    if ($('#btnTranscription').length) {
                        var transcripiton = $('span[data-container="TRANSCRIPTION"]')[0];
                        $(transcripiton).removeClass('ivViewTrans');
                        $(transcripiton).addClass('ivViewTransLock');
                    }

                }
            }
        });
    },

    launchPenRad: function (url) {
        if (!$('#penradiFrame').length) {
            $('<iframe/>', {
                id: 'penradiFrame',
                src: url
            }).appendTo('body');
        }
        else {
            $('#penradiFrame').attr('src', url);
        }
    },
    launchURL: function (url) {
        var finalURL = url;
        if ($('#utiliFrame').length > 0) {
            $('#utiliFrame').attr('src', finalURL);
        }
        else {
            $('<iframe/>', {
                id: 'utiliFrame',
                src: finalURL,
                style: 'display:none'
            }).appendTo('body');

        }
    },

    contextmenuTest: function () {
        document.body.onmousedown = function (e) {
            console.log(e);
        };
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

    checkRecorderInitialized: function () {
        if (commonjs.studyInfo) {
            var studies = commonjs.studyInfo;
            for (var key in studies) {
                if (key && typeof key == 'string' && studies[key].recorderInitialized) return true;
            }
        }
        return false;
    },
    setRecorderInitialized: function (studyID) {
        if (commonjs.studyInfo && commonjs.studyInfo[studyID]) commonjs.studyInfo[studyID].recorderInitialized = true;
    },
    portalDisplayPopUp: function () {
        $('.bgScrn').fadeIn(350).css({ "z-index": "198" });
        $('#divPopover').find('.cancelPopup').off().click(function () {
            $('#divPopover').fadeOut(350).animate({ "top": "-800px" }, 350);
            $('.bgScrn').fadeOut(350);
        });
        $('#divPopover').find('.panelExit').off().click(function () {
            $('#divPopover').fadeOut(350).animate({ "top": "-800px" }, 350);
            $('.bgScrn').fadeOut(350);
        });

        // $('#divPopover').show().animate({"top": Math.round(($(window).height() - $('#divPopUpBody').height()) / 5)}, 350);

        $('#divPopover').find('#myAccPanel').show().animate({ "top": '50px' }, 350);

        if ($(window).width() <= 1024) {
            $('#divPopover').find('#myAccPanel').css({ "left": ($(window).width() - $('.newMsgContainer').width()) / 2 - 45 });
        }
        if ($(window).width() <= 800) {
            $('#divPopover').find('#myAccPanel').css({ "left": "10px" });
        }

        if ($('#myAccPanel').find('iframe').length) {
            $('#divPopover').show().find('#myAccPanel').show().css({ "top": '10px' }, 350);
        }
        else
            $('#divPopover').show().find('#myAccPanel').show().animate({ "top": '50px' }, 350);
    },

    logoutPortal: function () {
        window.location = 'p/logout?patient=1';
    },

    showPortalLoading: function (text) {
        var bodyObj = $(document).contents().find('body');
        var text = text ? text : 'Loading portal. please wait..'
        bodyObj.find('.portalLoadingMsg').text(text)
        bodyObj.find('#resultLoading').fadeIn(300);
        bodyObj.css('cursor', 'progress');
    },

    showPhysicianStatus: function () {
        $('.bgScrnLoading').show();
        $('.loadingStatus').show();
    },

    hidePhysicianStatus: function () {
        $('.bgScrnLoading').hide();
        $('.loadingStatus').hide();
    },

    hidePortalLoading: function () {
        // var iframeobj = $(document).contents().find('body');
        $('#resultLoading').fadeOut(300);
        $body.css('cursor', 'default');
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

    // Added to return new clinical rules for display when data changes
    compareClinicalRules: function (oldRules, currentRules) {
        var newRules = [];

        var i = currentRules.length;
        while (i--) {
            var j = 0, match = false;
            for (j = 0; j < oldRules.length; j++) {
                if (currentRules[i].id === oldRules[j].id) {
                    match = true;
                    break;
                }
            }

            if (!match) {
                newRules.push(currentRules[i]);
            }
        }

        return newRules;
    },

    showClinicalRule: function (_html) {
        commonjs.showDialog({
            header: 'Clinical Decision Support Rule',
            i18nHeader: 'shared.screens.setup.clinicalDecisionSupportRule',
            width: '70%',
            height: '45%',
            html: _html
        })
    },

    getLayoutInfo: function (layoutFormat, cWidth, cHeight) {
        var fWidth, fHeight, l, cellInfo, rowIndex, pad;
        layoutFormat = commonjs.validateLayoutFormat(layoutFormat);
        var layoutInfo = { cellArr: [], cells: 0, format: layoutFormat, containerWidth: cWidth, containerHeight: cHeight };
        l = layoutFormat.split(' ').length;
        layoutFormat = layoutFormat.replace(/ 0/g, 'N');
        var seq = layoutFormat.split(' ');
        if (seq[0].toUpperCase() == 'R') {
            //l = seq.length;
            fHeight = cHeight / (l - 1);
            rowIndex = 0;
            for (var i = 1; i < l; i++) {
                if (seq[i]) {
                    pad = (seq[i].match(/N/g) || []).length + 1;
                    cellInfo = parseInt(seq[i]);
                    fWidth = cWidth / cellInfo;
                    for (var j = 0; j < cellInfo; j++) {
                        layoutInfo.cells++;
                        layoutInfo.cellArr.push({
                            width: Math.floor(fWidth - 3),
                            height: Math.floor((fHeight * pad) - 3),
                            row: rowIndex,
                            column: j
                        });
                    }
                    rowIndex++;
                }
            }
        }
        else if (seq[0].toUpperCase() == 'C') {
            //l = seq.length;
            fWidth = cWidth / (l - 1);
            rowIndex = 0;
            for (var i = 1; i < l; i++) {
                if (seq[i]) {
                    pad = (seq[i].match(/N/g) || []).length + 1;
                    cellInfo = parseInt(seq[i]);
                    fHeight = cHeight / cellInfo;
                    for (var j = 0; j < cellInfo; j++) {
                        layoutInfo.cells++;
                        layoutInfo.cellArr.push({
                            width: Math.floor((fWidth * pad) - 3),
                            height: Math.floor(fHeight - 3),
                            row: rowIndex,
                            column: j
                        });
                    }
                    rowIndex++;
                }
            }
        }
        else if (layoutFormat.indexOf('*') > -1) {
            seq = layoutFormat.split('*');
            var r = seq[0], c = seq[1];
            fHeight = cHeight / r;
            fWidth = cWidth / c;
            for (var i = 0; i < r; i++) {
                for (var j = 0; j < c; j++) {
                    layoutInfo.cells++;
                    layoutInfo.cellArr.push({
                        width: Math.floor(fWidth - 3),
                        height: Math.floor(fHeight - 3),
                        row: i,
                        column: j
                    });
                }
            }
        }
        return layoutInfo;
    },

    validateLayoutFormat: function (format) {
        var formated;
        if (format.indexOf('a') == 1)
            formated = 'C ' + format.replace('a', ' ');
        else if (format.indexOf('o') == 1)
            formated = 'R ' + format.replace('o', ' ');
        else formated = format;

        if (/^[rRcC](\s[1-9]\d*)(\s\d+){0,}$/.test(formated) || /^[1-9][\d]*[*][1-9][\d]*$/.test(formated)) return formated;
        else return "1*1";
    },
    activateInputModifiers: function (isFrom, element) {
        if (app.modifiers_in_order) {
            var self = this;
            var modifier = element.getAttribute('data-type');
            var id = element.getAttribute('data-value');
            if (isFrom == 'studyInfo')
                var modifierElement = 'txtModifier';
            else if (isFrom == 'chargeandpayment')
                var modifierElement = 'ddlModifier';
            else if (isFrom == 'chargeandpayment_pointer')
                var modifierElement = 'ddlPointer';

            var dataType = isFrom == 'chargeandpayment_pointer' ? 'P' : 'M'; // M -- modifier , P -- Pointer
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

    getCurrentValues: function (divId, options) {

        var self = this;

        self.orderBillingInfo = commonjs.orderBillingInfo || {};
        self.orderBillingInfo[divId] = {};

        $.each($('#' + divId + ' input:not(:button)'), function (index, element) {
            var isAutocomplete = element.id.indexOf('autogen') > -1;
            if (isAutocomplete) {
                var textboxID = $('#' + element.id).closest('div').attr('id').substring(5)
                self.orderBillingInfo[divId][textboxID] = $('#' + element.id).closest('div').find('span').text();
            }
            else if (element.id && !$('#' + element.id).hasClass('autocomplete')) {
                var oldValue = element.type == 'checkbox' ? $('#' + element.id).prop('checked') : $('#' + element.id).val();
                self.orderBillingInfo[divId][element.id] = oldValue;
            }
        });

        $.each($('#' + divId + ' select'), function (index, element) {
            if (element.id)
                self.orderBillingInfo[divId][element.id] = $('#' + element.id).val();
        });

        $.each($('#' + divId + ' textarea'), function (index, element) {
            if (element.id)
                self.orderBillingInfo[divId][element.id] = $('#' + element.id).val();
        });

        return self.orderBillingInfo[divId];
    },

    setCheckedEvents: function () {
        var self = this;
        $('#tBodyCharge tr').find('input').on('keypress, change', function (e) {
            self.autoCompleteChanged = true;
        })
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
    getHighestPriorityModality: function(modalityIds) {
        if (!modalityIds) {
            return {};
        }

        return app.modalities
            .filter(function(modality) { return _.includes(modalityIds, modality.id)})
            .sort(function(a, b) { return b.priority > a.priority })[0];
    },

    /**
     * Given a modality id, return the modality code if it exists
     *
     * @param {Number} id
     * @returns {String}
     */
    getModalityCodeFromId: function(id) {
        var modality = _.find(app.modalities, {'id': id}) || '';
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

    verifyPasswordRules: function (cur_pw, new_pw, cfm_pw, screen) {
        var self = this;
        var rules = app.company.password_mgt;
        var err_pw = "";

        // Verify Password Rules
        if (rules) {
            if (screen == "MySettings" && cur_pw == "") {
                err_pw += "<li>Please fill in current password</li>";
            }
            if (new_pw == "") {
                err_pw += "<li>Please fill in new password</li>";
            }
            if (cfm_pw == "") {
                err_pw += "<li>Please fill in confirm password</li>";
            }
            if (cfm_pw != new_pw && new_pw != "") {
                err_pw += "<li>New password should match confirm password</li>";
                err_pw += "<li>Confirm password should match new password</li>";
            }
            if (parseInt(rules.passwordMinLength) > 0 && new_pw.length < parseInt(rules.passwordMinLength)) {
                err_pw += "<li>New password length should be at least " + rules.passwordMinLength.toString() + " characters</li>";
            }
            if (parseInt(rules.passwordMaxLength) > 0 && new_pw.length > parseInt(rules.passwordMaxLength)) {
                err_pw += "<li>New password length should be no more than " + rules.passwordMaxLength.toString() + " characters</li>";
            }
            if (rules.passwordUpper && (!new_pw.match(/[A-Z]/g) || new_pw.match(/[A-Z]/g).length < rules.passwordUpperMin)) {
                err_pw += "<li>New password should contain at least " + rules.passwordUpperMin.toString() + " uppercase letters/alpha characters</li>";
            }
            if (rules.passwordLower && (!new_pw.match(/[a-z]/g) || new_pw.match(/[a-z]/g).length < rules.passwordLowerMin)) {
                err_pw += "<li>New password should contain at least " + rules.passwordLowerMin.toString() + " lowercase letters/alpha characters</li>";
            }
            if (rules.passwordNumbers && (!new_pw.match(/[0-9]/g) || new_pw.match(/[0-9]/g).length < rules.passwordNumbersMin)) {
                err_pw += "<li>New password should contain at least " + rules.passwordNumbersMin.toString() + " numbers/numeric characters</li>";
            }
            if (rules.passwordSymbols && (!new_pw.match(/[-!@#$%^&*()_+|~=`{}\[\]:";'<>?,.\/]/g) || new_pw.match(/[-!@#$%^&*()_+|~=`{}\[\]:";'<>?,.\/]/g).length < rules.passwordSymbolsMin)) {
                err_pw += "<li>New password should contain at least " + rules.passwordSymbolsMin.toString() + " symbols/special characters</li>";
            }
        }

        return err_pw;
    },

    'keyCodes': {
        '9': '    ',
        '13': 'enter',
        '32': ' ',
        '48': '0',
        '49': '1',
        '50': '2',
        '51': '3',
        '52': '4',
        '53': '5',
        '54': '6',
        '55': '7',
        '56': '8',
        '57': '9',
        '65': 'a',
        '66': 'b',
        '67': 'c',
        '68': 'd',
        '69': 'e',
        '70': 'f',
        '71': 'g',
        '72': 'h',
        '73': 'i',
        '74': 'j',
        '75': 'k',
        '76': 'l',
        '77': 'm',
        '78': 'n',
        '79': 'o',
        '80': 'p',
        '81': 'q',
        '82': 'r',
        '83': 's',
        '84': 't',
        '85': 'u',
        '86': 'v',
        '87': 'w',
        '88': 'x',
        '89': 'y',
        '90': 'z'
    },
    launchUpdox: function () {
        var apiURL = '';
        var url = '';
        var accountId = '';

        var testOption = function (option) {
            if (option.name === 'account') {
                accountId = option.value;
                return true;
            }
        };

        app.thirdParty.some(function (tool) {
            if (tool.id === 'updox') {
                apiURL = tool.apiURL;
                url = tool.url;
                tool.options.some(testOption);
                return true;
            }
        });

        if (!url || !apiURL || !accountId) {
            commonjs.showError('Must have account and api URL set in user management');
            return false;
        }

        ppHide();

        commonjs.showLoading('Loading fax manager');

        $.ajax({
            'url': '/launchUpdox',
            'data': {
                'userID': app.userID,
                'sessionTimeout': app.sessionTimeout,
                'accountId': accountId,
                'apiURL': encodeURIComponent(apiURL),
                'url': encodeURIComponent(url)
            },
            'success': function (data, statusText, response) {
                commonjs.hideLoading();
                var status = response.status;
                if (status === 200) {
                    window.open(app.settings.updoxURL + data);
                }
                else {
                    commonjs.showWarning(data + ' (' + String(status) + ')');
                }
            },
            'error': function (response) {
                commonjs.hideLoading();
                commonjs.showError(response.responseText + ' (' + String(response.status) + ')');
            }
        });

        return false;
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

    /************************************\
                 Help Tutorial
     ************************************
    List of places in EXA that utilize the Help Tutorial functions. If you alter the help functions, please test these tutorials to make sure you didn't break anything.
        1.  Merge/Split         public/javascripts/views/home/mergeStudy.js                 Click the HELP button

    HTML is located in  views/jade/layout.jade
    CSS is located in   public/stylesheets/skins/viztek.less

    Sample code for devs to get up and running quickly:
        commonjs.helpCenterHand();
        commonjs.runSeries([
             function (cb) {  commonjs.helpBox({ text: "This is a super quick sample tutorial.", fade: false }, cb);  }
            ,function (cb) {  commonjs.helpBox({ text: "It'll point the helping hand at the tenth visible div and click on it." }, cb);  }
            ,function (cb) {  commonjs.helpPoint({ pointTo: $("div:visible:eq(10)") }, cb);  }
            ,function (cb) {  commonjs.helpBox({ text: "Bye." }, cb);  }
        ]);


    helpBox - Darkens the screen and shows a box of text to instruct the user
        options:
            i18n        i18n reference for the text                             String          Default ""
            text        Text to put in the box                                  String          Default ""
            class       Classes if you need to re-style the help box            String          Default ""
            seconds     Number of seconds the text will show                    Integer         Default 50 ms per character plus 1 second
    */
    helpBox: function (options, callback) {
        var i18n = (options.i18n) ? this.geti18NString(options.i18n) : "";
        var text = i18n || options.text || "";
        var clas = (options.class) ? options.class : "";
        var seconds = (options.seconds >= 0) ? options.seconds : ((text.length * 50) + 1000) / 1000;
        var fadeOut = (typeof options.fade == "boolean") ? options.fade : true;
        callback = (callback) ? callback : function () { };

        $(".helpLayer").fadeIn("fast", function () {
            $('#divHelpBox').addClass(clas).html(text).fadeIn("fast");
        });

        if (fadeOut == true) {
            setTimeout(function () {
                $("#divHelpBox").fadeOut("fast", function () {
                    $("#divHelpBox").removeClass(clas);
                    $('.helpLayer').fadeOut("fast", function () {
                        callback();
                    });
                });
            }, seconds * 1000);
        }
        else {
            setTimeout(function () { callback(); }, seconds * 1000);
        }
    },

    /* helpFlash - Make an element on the screen flash to bring attention to it
        options:
            obj         An object to make flash                                 jQuery Object   Required
            seconds     Number of seconds the object will flash                 Integer         Default 1 second
    */
    helpFlash: function (options, callback) {
        var objFlash = options.obj;
        var seconds = (options.seconds >= 0) ? options.seconds : 1;

        if (objFlash) {
            $(objFlash).addClass("helpFlash");
            setTimeout(function () {
                $(objFlash).removeClass("helpFlash");
                callback();
            }, seconds * 1000);
        }
        else {
            callback();
        }
    },

    /* helpPoint - Moves a hand image around the screen to point things out
        options:
            pointTo     Where the hand will move to                             jQuery Object   Required
            seconds     Number of seconds it will take for the hand to arrive   Integer         Default 1
            delay       Number of seconds this method waits to end              Integer         Default 0
            click       Click the pointTo object                                Boolean         Default true
            fade        Fade the hand out when done                             Boolean         Default true
            drag        Fake drag and drop effect with this object              jQuery Object   Default null
            dragClass   Add one or more classes to the drag object's container  String          Default ""
    */
    helpPoint: function (options, callback) {
        var self = this;
        var objPointTo = options.pointTo;
        var seconds = (options.seconds >= 0) ? options.seconds : 1;
        var delay = (options.delay >= 0) ? options.delay : 0;
        var clickIt = (typeof options.click == "boolean") ? options.click : true;
        var focusIt = (typeof options.focus == "boolean") ? options.focus : false;
        var fadeOut = (typeof options.fade == "boolean") ? options.fade : true;
        var objDrag = (options.drag) ? options.drag : null;
        var dragClass = (options.dragClass) ? options.dragClass : "";

        if (objPointTo) {
            var top = $(objPointTo).offset().top;           // If faking a drag, simulate moving drag object directly onto the drop element
            var left = $(objPointTo).offset().left;
            if (!objDrag) top += $(objPointTo).height();    // If not faking a drag, move the hand below Point To element

            // If zero second move, just jump there. Don't even show it.
            if (seconds <= 0) {
                $("#helpingHand").css({
                    "top": top,
                    "left": left
                });
                callback();
            }
            else {
                // Fake a drag and drop by attaching a copy of the drag element to the helping hand
                if (objDrag) {
                    var html = "" +
                        "<div class='" + dragClass + " demoDrag' style='width:" + objDrag.width() + "px;'>" +
                        "   " + objDrag.html() +
                        "</div>";
                    $(html).appendTo("#helpingHand");
                    $("#helpingHand").css({ "top": $(objDrag).offset().top });
                }

                // Animate hand
                $("#helpingHand").fadeIn("fast").animate({ "top": top, "left": left }, seconds * 1000, function () {
                    $(".demoDrag").remove();    // Remove the drag object if there is one

                    // Click the element the hand is pointing to
                    if (clickIt == true) {
                        self.helpFlash({ "obj": objPointTo, "seconds": .31 }, function () {
                            $(objPointTo).click();

                            if (focusIt == true) {
                                $(objPointTo).focus();
                            }

                            if (fadeOut == true) {
                                self.helpWait(delay, function () {
                                    $("#helpingHand").fadeOut("fast", function () {
                                        self.helpWait(1, function () {
                                            callback();
                                        });
                                    });
                                });
                            }
                            else {
                                self.helpWait((delay > 1) ? delay : 0, function () {
                                    callback();
                                });
                            }
                        });
                    }
                    else {
                        if (fadeOut == true) {
                            self.helpWait(delay, function () {
                                $("#helpingHand").fadeOut("fast", function () {
                                    callback();
                                });
                            });
                        }
                        else {
                            self.helpWait(delay, function () {
                                callback();
                            });
                        }
                    }
                });
            }
        }
    },

    /* helpWait - Just a setTimeout except you pass it seconds.  This is just to stay consistent with the other help functions.
        seconds     Integer     Default 1
    */
    helpWait: function (seconds, callback) {
        if (typeof seconds == "object") seconds = seconds.seconds;  // Just in case it's sent in an object like the other help parameters
        var seconds = (seconds >= 0) ? seconds : 1;

        setTimeout(function () {
            callback();
        }, seconds * 1000);
    },

    // helpCenterHand - Easy way to set the starting position of the helping hand at the center of the window
    helpCenterHand: function () {
        $("#helpingHand")
            .css("top", ($(window).height() / 2) - ($("#helpingHand").outerHeight() / 2) + "px")
            .css("left", ($(window).width() / 2) - ($("#helpingHand").outerWidth() / 2) + "px");
    },

    /* helpConfirm - Replacement for the standard JavaScript Confirm box
        options:
            icon            Font Awesome Icon class(s) [preferably]                 String          Default ""
            head            Summarized header text                                  String          Default ""
            hi18n           i18n of summarized header text                          String          Default ""
            body            Full text/question to put in the box                    String          Default ""
            bi18n           i18n of full text/question to put in the box            String          Default ""
            width           Width of the confirm box                                String          Default "600px"
            buttons         Array of button configurations                          JSON            Default { text: "Close" }
                id          Button id attribute                                     String          Default Generated with button text
                text        Button text                                             String          Default ""
                i18n        i18n of Button text                                     String          Default ""
                class       Button class                                            String          Default "btn"
                click       Callback function if user clicks this button            Function        Default function () {}
    */
    helpConfirm: function (options, callback) {
        var self = this;
        var icon = (options.icon) ? options.icon : "";
        var head = (options.hi18n) ? self.geti18NString(options.hi18n) : (options.head) ? options.head : "";
        var body = (options.bi18n) ? self.geti18NString(options.bi18n) : (options.body) ? options.body : "";
        var width = (options.width) ? options.width : "600px";
        var buttons = (options.hasOwnProperty("buttons")) ? options.buttons : [{ text: "Close", i18n: "messages.confirm.button.close" }];

        $(".helpLayer").fadeIn("fast", function () {
            // Header
            if (head != "") {
                if (icon != "") {
                    $("#divConfirmBoxHeadIcon").removeClass().addClass(icon).show();
                }
                else {
                    $("#divConfirmBoxHeadIcon").hide();
                }
                $("#divConfirmBoxHeadText").html(head);
                $("#divConfirmBoxHead").show();
            }
            else {
                $("#divConfirmBoxHead").hide();
            }

            // Body
            $("#divConfirmBoxBody").html(body);

            // Footer
            $("#divConfirmBoxFoot").html("");
            for (var i = 0; i < buttons.length; i++) {
                var b = buttons[i];
                var txt = (b.text) ? b.text : "Close";
                if (b.i18n && commonjs.geti18NString(b.i18n)) txt = commonjs.geti18NString(b.i18n);
                var id = (b.id) ? b.id : "btnConfirm" + txt.replace(/^[^a-zA-Z]|[^a-zA-Z0-9-_:.]/g, '');
                var clas = (b.class) ? b.class : "btn";
                var click = (b.click) ? b.click : function () { };
                var html = "<button id='" + id + "' class='" + clas + "'>" + txt + "</button> ";

                $("#divConfirmBoxFoot").append(html);
                $("#" + id).unbind().click(click);
                $("#" + id).click(function () {
                    $("#divConfirmBox").fadeOut("fast", function () {
                        $('.helpLayer').fadeOut("fast");
                    });
                });
            }

            // Fade in and confine tabbing to modal
            $("#divConfirmBox").css("width", width).fadeIn("fast", function () {
                self.confineTabbing(this);
            });
        });
    },

    /**
     * returns facility array with inactive facilities removed - specifically for use in drop downs
     * @param {boolean} showStudiesFlag - if true returns facilities where is_active true and show_studies is enabled
    */
    getActiveFacilities: function(showStudiesFlag){
        facilities = app.userInfo.user_type === "SU"
            ? app.facilities
            : app.userfacilities;
        if (showStudiesFlag) {
            return facilities.reduce(function(facilitiesAcc, facility) {
                var parsedFacility = Object.assign({}, facility, { facility_info: commonjs.hstoreParse(facility.facility_info) });
                if(facility.is_active || parsedFacility.facility_info.show_studies === "true") facilitiesAcc.push(facility);
                return facilitiesAcc;
            },[]);
        } else{
            return facilities.filter(function(fac){
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

    /**
     * Courtesy of:
     * https://stackoverflow.com/a/30684711
     * @param   {HTMLCanvasElement}     canvas
     */
    setupSignature: function (canvas) {

        // get canvas 2D context and set him correct size
        var ctx = canvas.getContext('2d');

        // last known position
        var pos = {
            x: 0,
            y: 0
        };

        canvas.addEventListener('mousemove', drawMouse);
        canvas.addEventListener('mousedown', setPosition);
        canvas.addEventListener('mouseenter', setPosition);

        // new position from mouse event
        function setPosition(e) {
            // pos.x = e.clientX;
            // pos.y = e.clientY;
            pos.x = e.offsetX;
            pos.y = e.offsetY;
        }

        function draw(e) {
            ctx.beginPath(); // begin

            ctx.lineWidth = 1;
            ctx.lineCap = 'round';
            ctx.strokeStyle = '#333333';

            ctx.moveTo(pos.x, pos.y); // from
            setPosition(e);
            ctx.lineTo(pos.x, pos.y); // to

            ctx.stroke(); // draw it!
        }

        function drawMouse(e) {

            // mouse left button must be pressed
            if (e.buttons !== 1) return;

            return draw(e);
        }
    },

    /**
     * Remove current signature and replace with new empty canvas to draw in
     */
    clearSignature: function () {
        var canvas = document.createElement('canvas');
        canvas.id = 'signature-canvas';
        canvas.className = 'current-signature';
        canvas.width = 400;
        canvas.height = 100;
        canvas.style.position = 'relative';
        canvas.style.border = '1px solid';

        var signatureEl = document.querySelector('.current-signature');
        signatureEl.parentNode.replaceChild(canvas, signatureEl);

        var signedDateEl = document.getElementById('txtSignedDate');
        signedDateEl.value = '';

        return commonjs.setupSignature(canvas);
    },

    toggleSignaturePanel: function () {
        $('#signature-panel').toggle();
    },

    /**
     * Checks if a given modality is allowed in a given modality room
     *
     * @param {Number|String} modalityId
     * @param {Number|String} modalityRoomId
     * @returns {boolean}
     */
    isModalityAllowed: function (modalityId, modalityRoomId) {
        var modalityRoom = _.filter(app.modalityRooms, function (room) {
            return ~~room.id === ~~modalityRoomId
        })[0];

        return modalityRoom ? _.includes(modalityRoom.modalities, ~~modalityId) : false;
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
    order: 'Order',
    report: 'Report',
    billing: 'billing',
    dashboard: 'Dashboard',
    portalRegUsers: 'Portal Registered Users',
    //cardiology: 'Cardiology', //duplicate key, see below
    setupScreens: {
        coverSheets: 'Cover sheets',
        company: 'Company',
        ae: 'Application Entities',
        imageStore: 'File Stores',
        facility: 'Facility',
        noshows: 'No Shows',
        cpt: 'CPT',
        icd: 'ICD',
        modality: 'Modality',
        modalityRoom: 'Modality Room',
        studyFlag: 'Study Flag',
        userAssignedStudies: 'User Assigned Studies',
        userAssignedPatients: 'User Assigned Patients',
        scheduleBlock: 'Schedule Block',
        scheduleFilter: 'Schedule Filter',
        provider: 'Provider',
        providerGroup: 'Provider Group',
        orderingFacility: 'Ordering Facility',
        insuranceProvider: 'Insurance Provider',
        user: 'User',
        userRole: 'User Role',
        userGroup: 'User Group',
        auditLog: 'Audit Log',
        studyFilters: 'Study Filter',
        owners: 'Owners',
        userSettings: 'UserSettings',
        userLog: 'User Log',
        routingRules: 'Routing Rules',
        userView: 'User View',
        queue: 'Queue',
        reportQueue: 'Report Queue',
        configEditor: 'Installer',
        userOnline: 'Users Online',
        tasks: 'Tasks',
        notification: 'Notification',
        mySettings: 'MySettings',
        apiUsers: 'API Users',
        studyStatus: 'Study Status',
        renderConf: 'Rendering Config',
        reportTemplate: 'Transcription Template',
        emailTemplate: 'Email Template',
        reportFormat: 'Report Template',
        appGadgets: 'Gadgets',
        dicomReceiverRule: 'Dicom Receiver Rule',
        familyHistory: 'Family History',
        aeScripts: 'AE Scripts',
        viewerOptions: 'Viewer Options',
        interface: "Interface Settings",
        modalityOptions: 'Modality Options',
        viewerTools: 'Viewer Tools',
        changeLog: 'Change Log',
        dmlist: 'DM List',
        dmnew: 'DM New',
        developerLog: 'Developer Log',
        adUsers: 'AD Users',
        adGroups: 'AD Groups',
        dicomServiceLog: 'Dicom Service Log',
        moveServiceLog: 'Move Service Log',
        imageRenderingLog: 'Image Rendering Log',
        hpGroups: 'Hanging Protocol Groups',
        bodyParts: 'Body Parts',
        matchingRules: 'Matching Rules',
        dbTotals: 'DB Totals',
        customForms: 'Custom Forms',
        studyForms: 'Study Forms',
        vitalSign: 'Vital Signs',
        formBuilder: 'Form Builder',
        allergies: 'Allergies',
        patientportal: 'Patient Portal Log',
        vaccines: 'Vaccines',
        immunizationChart: 'Immunization Chart',
        clinicalSupportRules: 'Clinical Support Rules',
        subDomains: 'Sub Domains',
        editorTemplate: 'Editor Template',
        examAuthorization: 'Exam Authorization',
        securityAudit: 'Security Audit',
        vehicleAudit: "Vehicle Log",
        vehicleRegistration: 'Vehicle Registration',
        vehicleTracking: 'Vehicle Tracking',
        viewJobList: "View Job List",
        rcopiaLog: 'Rcopia Log',
        eligibilityLog: 'Eligibility Log',
        updateURLs: 'Update URLs',
        adjustmentCodes: 'Adjustment Codes',
        temp2live: 'templ2Live Log',
        hl7Receiver: 'HL7 Receiver',
        hl7Sender: 'HL7 Sender',
        hl7Queue: 'HL7 Queue',
        hl7Trigger: 'HL7 Trigger',
        paperClaimAlignment: 'Paper Claim Alignments',
        hl7ReceiverLog: 'HL7 Receiver Log',
        hl7Log: 'HL7 Log',
        ediReqTemplate: "EDI Request Template",
        clearingHouse: "Clearing House",
        billingProvider: "Billing Provider",
        billingValidation: "Billing Validation",
        mapEdiTemplate: "Map EDI Template",
        ediTranslations: "EDI Translations",
        preRequisites: "PreRequisites",
        ediRule: "EDI Rule",
        functionalStatus: "Functional Status",
        cognitiveStatus: "Cognitive Status",
        facilityFeeSchedule: "Facility Fee Schedule",
        providerPaySchedule: "Provider Pay Schedule",
        rcopiaTransactions: 'Rcopia Transactions',
        muValidation: 'MU Validations',
        cmsRegistryInfo: 'CMS Registry Info',
        exportSummary: 'Export Summary',
        posMap: 'POS Map',
        feeschedule: 'Fee Schedule',
        templates: 'Templates',
        autoSuggessions: 'Auto Suggessions',
        keywords: 'Keywords',
        imageHotspots: 'Image Hotspots',
        billingMessages: 'Billing Messages',
        userThirdParty: 'Third Party Tools',
        scheduleTemplates: 'Schedule Templates',
        scheduleRules: 'Schedule Rules',
        appointmentTypes: 'Appointment Types',
        coverSheets: 'Cover sheets',
        notificationTemplates: 'Notification templates',
        monthlyGoals: 'Monthly Goals',
        copySetting: 'Copy User Settings',
        lockedSlots: 'Locked Slots',
        srMapping: 'SR Mapping'
    },
    homeScreens: {
        issues: 'Issues',
        studies: 'Studies',
        encounter: 'Encounter',
        useronline: 'User Online',
        sendstudies: 'Send Studies',
        cancel: 'Cancel Reason',
        assignStudyToUsers: 'Assign Study To Users',
        importimages: 'Import Images',
        cdburn: 'CD Burn',
        mergeStudy: 'Merge Study',
        patientMessages: 'Messages',
        dashboard: 'Dashboard',
        marketing: 'Marketing Rep Dash Board',
        sendFax: 'Send Fax',
        listNotes: 'Notes',
        dispatch: 'Dispatch'
    },
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
    patientScreens: {
        studyForms: 'Study Forms',
        search: 'Patient Search',
        searchAdvanced: 'Advanced Search',
        infonew: 'Patient Information New',
        info: 'Patient Information',
        insurance: 'Patient Insurance',
        allInsurance: 'Billing',
        documents: 'Patient Documents',
        labOrders: 'Lab Orders',
        studies: 'Patient Studies',
        orders: 'Patient Orders',
        audit: 'Activity Log',
        alerts: 'Patient Alerts',
        patientMerge: 'Patient Merge',
        studyDictation: "Study Dictation",
        vitalSign: "Vital Signs",
        patientPrescription: "Patient Prescription",
        'allergies': 'Allergies',
        problems: 'Problems',
        medications: 'Medications',
        immunization: 'Immunization',
        pendingReferrals: 'PendingReferrals',
        exportCCD: 'Export CCD',
        familyHealthHistory: 'Family Health History',
        outsideReferrals: 'Outside Referrals',
        patientMessages: 'Patient Messages',
        clinicalRules: 'Patient Clinical Rules',
        filmtracking: 'Film Tracking',
        paymenthistory: 'Payment History',
        encounter: 'Patient Encounter',
        toBeReviewed: 'To Be Reviewed',
        transitionOfCare: 'Transition Of Care',
        clinicalSummaryTransmit: 'Clinical Summary Transmit',
        patientInquiry: 'Patient Inquiry',
        patientGuarantor: 'Patient Guarantor',
        reconcillation: 'Reconcillations',
        patientReport: 'Patient Report'
    },
    orderScreens: {
        summary: 'Order Summary',
        scheduleBook: 'Schedule Book',
        referringProvider: 'Order_Referring_Provider',
        icdCode: 'Order_ICD',
        studyInfo: 'Order_Studies',
        additionalinfo: 'Order_additional',
        transcription: 'Transcription',
        'chargeandpayments': 'Charge and Payments',
        priorstuides: 'Prior Studies',
        patientInfo: 'Patient Information',
        patientAlerts: 'Patient Alerts',
        insuranceProfile: 'Patient Insurance',
        allInsurance: 'Billing',
        documents: 'Patient Documents',
        auditLog: 'Activity Log',
        approvedReport: 'Approved Report',
        manualEdit: 'Dicom Edit',
        newOrder: 'New Order',
        availableSlot: 'Available Slots',
        dicomEdit: 'Dicom Edit',
        reconciliationStudy: "QC Reconciliation",
        recentSchedule: "Recent Schedules",
        orderforms: "Order Forms",
        studyforms: "Study Forms",
        ccRos: "Chief Complaints",
        providerSchedule: "Provider Schedule",
        medicalHistory: 'Medical History',
        followUps: 'Follow Ups',
        referrals: 'Referrals',
        pendingReferrals: "Pending Referrals",
        assignVehicle: "Assign Vehicle",
        pendingFollowUps: "Pending FollowUps",
        orderImages: "Order Images",
        patientOrderDetails: "patient OrderDetails",
        orderICDCodes: "Order ICDCodes",
        labOrders: 'Lab Orders',
        vitalSign: "Vital Signs",
        medications: "Medications",
        'allergies': 'Allergies',
        insuranceAuthorization: "Insurance Authorization",
        statusValidation: "Status Validation",
        educationMaterial: "Education Material",
        studyEducationMaterial: "Study Education Material",
        prescription: "Patient Prescription",
        immunization: "Immunization",
        demographics: "Patient Demographics",
        orderProblems: "Problems",
        studyNotes: "Notes",
        clinicalOverview: 'Clinical Overview',
        teachingStudy: 'Teaching Study',
        studyCPTUpdate: 'Study Cpt Update',
        vehicleAssignments: "Vehicle Assignments",
        familyHealthHistory: 'Family Health History',
        peerReview: 'Peer Review',
        dispatchingDashboard: 'Dispatching Dashboard',
        queryRetrieve:'Query Retrieve',
        createSplitOrders: "Create/Split Orders"
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
        dailychargereport: 'Daily Charge Report',
        procedureanalysisbyinsurance: 'Procedure Analysis By Insurance',
        'appointmentListDateRange': 'Appointment List Date Range',
        facilityinvoices: 'Facility Invoices',
        payerMix: 'Payer Mix',
        referringprovidersummary: 'Referring Provider Summary',
        chargedetails: 'Claim Activity',
        facilitysummary: 'Facility Summary',
        insurancebalanceaging: 'Insurance Balance Aging',
        patientsByInsurance: 'Patients By Insurance',
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
        inscompany: 'Payments By Insurance Company',
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
        payments: 'Payment',
        calculatedTAT: 'Turnaround Time (TAT) - Calculated',
        RVU: 'Relative Value Units',
        referringPhysicianStudyCount: 'Referring Physician Study Count',
        completedSchedules: 'Completed Schedules',
        patientStatement: 'Patient Statement',
        patientActivityStatement: 'Patient Statement',
        claimTransaction: 'Claim Transaction',
        insuranceVsLOP: 'Insurance Vs. LOP',
        claimInquiry: 'Claim Inquiry',
        monthlyGoals: 'Monthly/Daily Study Goals',
        statTracking: 'STAT Tracking',
        monthlyRecap: 'Monthly Recap',
        readingProviderFees: 'Reading Provider Fees',
        transactionSummary: 'Transaction Summary',
        agedARDetail: 'Aged AR Detail',
        paymentPDF: 'Payments Received'
    },
    portalRegUsersScreen: {
        regUsers: 'Portal Registered Users'
    },
    unSignedOrders: {
        unsignedorders: 'UnSigned Orders'
    },
    cardiology: {
        templates: 'Templates',
        autoSuggestions: 'Auto Suggestions',
        keywords: 'Keywords',
        imageHotspot: 'Image Hotspots',
        srMapping: 'SR Mapping',
        mappingFields: 'Mapping Fields'
    }
};

var customerModules = {
    mainModule: 'Main Module', screens: {
        company: 'Company',
        ae: 'Application Entities',
        imageStore: 'File Stores',
        servers: 'Servers',
        sites: 'Site Settings',
        processManager: 'Process Manager',
        utils: 'System utils',
        apiModels: 'API Models',
        apiRequests: 'API Log',
        issues: 'Issues',
        dbVersion: 'DB Version',
        pendingStudies: 'Pending Studies',
        aeScripts: 'AE Scripts',
        facility: "Facility",
        appgadgets: "Gadgets",
        changelog: "Change Log",
        dicomServers: "Dicom Servers",
        dicomReceiverRules: "Dicom Receiver Rules",
        i18nAdmin: "i18n Admin",
        localization: "localization",
        webConfig: "Web Config",
        subDomains: "Sub Domains",
        wordEditor: "HL7 Word Editor",
        aeWordEditor: "AE Script Word Editor",
        unRegisteredStudies: 'Pending Studies',
        opalReports: 'Opal Reports',
        thirdParty: 'Third-party',
        notificationTemplates: 'Notification templates'
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


window.addEventListener("message", function (event) {

    if (event.data == 'insert') {
        commonjs.hideDialog();
        commonjs.clickDocumentReload('Patient Document inserted');
    }
    else if (event.data == 'update') {
        commonjs.hideDialog();
        commonjs.clickDocumentReload('Patient Document updated');
    }
    else {
        $('#site_modal_iframe_container').height(event.data + 'px');
    }

});

/* Compile functions */

//Get value From tag

function getTag(dicom, grp, element) {

}

//Sets value of a tag(value is a string)
function setTag(dicom, grp, element, value) {

}

//Do Not use !!! gets src aetitle from dicom meta info
function getSrcAeTitle(meta) {


}

//replace string within src with value and return new string
function replace(src, search, value) {

}

//replace regular Expression within src with value and return new string
function regex_replace(src, regex, value) {

}

//returns true if src starts with what
function starts_with(src, what) {

}

//returns true if src ends with what
function ends_with(src, what) {

}

//returns true if what is in src (case insensitive)
function ifind(src, what) {

}

//return substring from src staring with char start and length len
function substr(src, start, len) {

}

//triggers sub task
function triggerCustomTask(taskName, taskOptions) {

}

function prefetchCallback(data) {
}

function server_prefetchCallback(data) {

}

function prefetcherPluginLoaded() {

}

function getDisplayCoordinates() {
    return document.getElementById('pluginPrefetcher').getDisplays();
}

var QR = {
    totalRecords: 0,
    pageSize: 50,
    pageIndex: 1,
    queryStudy: function (data) {
        $('#tblGridQR').jqGrid('clearGridData');
        commonjs.hideLoading();
        if (data.value && data.value.pacs && data.value.pacs.body && data.value.pacs.body.datasets && data.value.pacs.body.datasets["data-set"]) {
            var value = data.value.pacs.body.datasets["data-set"]
            var resultArray = QRCollections(value);
            if (resultArray.length) {
                //                for (var g = 0; g < resultArray.length; g++) {
                //                    $('#tblGridQR').jqGrid('addRowData', g, resultArray[g]);
                //                }
                QR.totalRecords = resultArray.length;
                $('#tblGridQR').jqGrid('addRowData', resultArray.length, resultArray);
            } else {
                if ($('#tblGridQR').length > 0) $('#tblGridQR').jqGrid('addRowData', 1, [
                    {}
                ]);
                if ($('#tblGridQR').find('tr:nth-child(2)').length > 0) $('#tblGridQR').find('tr:nth-child(2)').remove();
                //                $('#tblGridQR').trigger('reloadGrid');
            }
            //$('#divPager #spnTotalRecords')[0].innerHTML = resultArray.length;
        }
        else {
            if ($('#tblGridQR').length > 0) $('#tblGridQR').jqGrid('addRowData', 1, [
                {}
            ]);
            if ($('#tblGridQR').find('tr:nth-child(2)').length > 0) $('#tblGridQR').find('tr:nth-child(2)').remove();
            //            if ($('#tblGridQR').length > 0) $('#tblGridQR').trigger('reloadGrid');
        }
    },

    querySeries: function (data) {
        $('#' + commonjs.QRSeriesID).jqGrid('clearGridData');
        if (data.value && data.value.pacs && data.value.pacs.body && data.value.pacs.body.datasets["data-set"]) {
            var value = data.value.pacs.body.datasets["data-set"]
            var resultArray = QRCollections(value);

            for (var g = 0; g < resultArray.length; g++) {
                $('#' + commonjs.QRSeriesID).jqGrid('addRowData', g, resultArray[g]);
            }
        }
    },

    queryImage: function (data) {
        $(commonjs.QRSeriesInstanceID).jqGrid('clearGridData');
        if (data.value && data.value.pacs && data.value.pacs.body && data.value.pacs.body.datasets["data-set"]) {
            var value = data.value.pacs.body.datasets["data-set"]
            var resultArray = QRCollections(value);

            for (var g = 0; g < resultArray.length; g++) {
                $(commonjs.QRSeriesInstanceID).jqGrid('addRowData', g, resultArray[g]);
            }
        }
    }
};

function QRCollections(value) {
    var resultArray = [];
    if (!value.length > 0) {
        var obj = value;
        value = [];
        value.push(obj);
    }
    for (var i = 0; i < value.length; i++) {
        var result = {};
        $.each(value[i].element, function (index, data) {
            if (data.$.name) {
                switch (data.$.name) {
                    case 'StudyTime':
                        result.StudyTime = data._;
                        break;
                    case 'AccessionNumber':
                        result.accession_no = data._;
                        break;
                    case 'QueryRetrieveLevel':
                        result.QueryRetrieveLevel = data._;
                        break;
                    case 'ReferringPhysicianName':
                        result.refphy_name = data._;
                        break;
                    case 'PatientID':
                        result.patient_id = data._;
                        break;
                    case 'StudyID':
                        result.study_id = data._;
                        break;
                    case 'NumberOfStudyRelatedSeries':
                        result.no_of_series = data._;
                        break;
                    case 'NumberOfStudyRelatedInstances':
                        result.no_of_instances = data._;
                        break;
                    case 'StudyDate':
                        result.study_dt = data._;
                        break;
                    case 'Modality':
                        result.modalities = data._;
                        break;
                    case 'StudyInstanceUID':
                        result.study_uid = data._;
                        break;
                    case 'SeriesInstanceUID':
                        result.seriesInstanceUID = data._;
                        break;
                    case 'SeriesNumber':
                        result.series_number = data._;
                        break;
                    case 'NumberOfSeriesRelatedInstances':
                        result.NumberOfSeriesRelatedInstances = data._;
                        break;
                    case 'PatientName':
                        result.patient_name = data._;
                        break;
                }
            }
        });
        result.total_records = value.length;
        resultArray.push(result);
    }
    return resultArray;
}

function ppShow() {
    if ($('nav.viztek-nav').hasClass('open')) {
        toggleIconMenu();
    } else {
        var profile_panel = $('#profile_panel');

        profile_panel.show('fast');

        // Corrected to prevent the menu from hiding inappropriately after mouse leave and then click
        var hideNav = function (e) {
            var targ = e.target || e.srcElement;
            if ($(targ).closest('#profile_panel').length) {
                // Clicked inside the nav, rebind
                $('html').one('click', hideNav);
            } else {
                // Clicked otuside of the nav.  Hide the nav
                ppHide();
            }
        };

        // Use .one to prevent the other .one from being bound multiple times.
        profile_panel.one('mouseleave', function () {
            $('html').one('click', hideNav);
        });
    }
}
function ppHide() {
    var profile_panel = $('#profile_panel');
    if (profile_panel.is(":visible")) {
        menuBack();
        profile_panel.hide('fast');
        //$('.fly-out-menu').hide();
        $('#profile_panel').unbind('mouseleave');
        $('html').unbind('click');

    }
}
function ppShowDetail() {
    if ($('nav.viztek-nav').hasClass('open')) {
        if ($('nav.viztek-nav').hasClass('open')) {
            $('#profile_panel').hide('fade');
            $('#divOrderFrame').removeClass('menu-open');
            $('nav.viztek-nav').removeClass('open');
            $('.main-nav').css("overflow-x", "visible");
        } else {
            $('#profile_panel').hide('fade');
            $('#viztekIconNav').show();
            $('#divOrderFrame').addClass('menu-open');
            $('nav.viztek-nav').addClass('open');
            $('#profile_panel').unbind('mouseleave');
            $('.main-nav').css("overflow-x", "hidden");
        }
        if ($('#side_nav_p_allIns').hasClass('active'))
            $('#billingHeader').width('96%');
        commonjs.docResize();
    } else {
        var profile_panel = $('#profile_panel');
        profile_panel.show('fast');
        $('nav.viztek-nav').addClass('open');
        $('#divOrderFrame').addClass('menu-open');

        if ($('#side_nav_p_allIns').hasClass('active'))
            $('#billingHeader').width('80%');
    }
}
function studyFilterModel() {
    commonjs.showDialog({
        header: 'Study Filter',
        i18nHeader: 'shared.screens.setup.studyFilter',
        width: '75%',
        height: '75%',
        url: '/vieworder#setup/studyFilters/all/model'
    });
}

function userSettingsModel() {
    commonjs.showDialog({
        header: 'User Settings',
        i18nHeader: 'home.common.userSettings',
        width: '75%',
        height: '80%',
        url: '/vieworder#setup/userSettings/all/model'
    });
}

function showAllTabsList() {
    $('#ulTabCollection').css({
        'top': e.pageY - 50,
        'left': e.pageX,
        'position': 'absolute',
        'border': '1px solid black',
        'padding': '5px'
    });
}

function setTitle(name) {
    $('.title-panel h2').html(name);
}

function hideTatStat() {
    $('.header-color-marks').hide();
}

function hideTopNav() {
    $('.top-nav').hide();
}

function launchOpalCDImport() {
    var cdImportUrl = 'opalimport://' + window.location.hostname;
    if ($('#utiliFrame').length > 0) {
        $('#utiliFrame').attr('src', cdImportUrl);
    }
    else {
        $('<iframe/>', {
            id: 'utiliFrame',
            src: cdImportUrl
        }).appendTo('body');
    }
}

function launchOpalCDBurn(ids) {
    var cdBurnUrl = 'opalpl://cdburn:' + window.location.protocol.replace(":", "@") + window.location.hostname + ':' + window.location.port + '/api/cdburn/' + ids.join(':') + '?' + commonjs.getSessionArgs();
    if ($('#utiliFrame').length > 0) {
        $('#utiliFrame').attr('src', cdBurnUrl);
    }
    else {
        $('<iframe/>', {
            id: 'utiliFrame',
            src: cdBurnUrl
        }).appendTo('body');
    }
}

//function select2Fix(){
//    //select2 fix
////    $(".select2-element").select2();
////    $(".select2-element").on("change", function () {
////        $container = $(this).prev(".select2-container");
////        $container.height($container.children(".select2-choices").height());
////    });
//}
//function OnCheckboxClick(e) {
//    var obj = $(this);
//    var chk = obj.find('input[type=checkbox]');
////    console.log('fire click Oncheckboxclick');
////    console.log(chk.prop('checked'));
////    console.log(!chk.prop('checked'));
////    chk.prop("checked", chk.prop("checked"));
////    console.log(chk.prop('checked'));
//    if( $(e.target).is('label') ) {
//        obj.toggleClass('active');
//    }
//}
//function CheckBoxCheck(obj,val) {
//    if (val === undefined || val == null)
//        val = true;
//
//    obj.attr('checked',val);
//    if (val)    obj.parent().addClass('active');
//}

function CreateCheckBox(label, id, i18nLabel) {
    return $('<div>').addClass('form-check form-check-inline').append($('<input>').attr({
        type: 'checkbox',
        id: id,
        name: id,
        value: label,
        checked: false
    }).addClass('form-check-input')).append($('<label>').attr({for: id, 'i18n': i18nLabel, 'value':label}).addClass('form-check-label').text(label));
}

//function SetupCheckBoxes(p) {
//    return;
//}
//
//
//function SetupRadio(p) {
//    var radio;
//    if (p === undefined || p == null)
//        radio = $('.radio');
//    else
//        radio = $(p).find('.radio');
//
//    radio.on('click', function(e){
//        var obj = $(this);
//        if ($(e.target).is('label') ) {
//            radio.find('[name='+obj.find('input')[0].name+']').parent('label').removeClass('active');
//            obj.addClass('active');
//        }
//    });
//
//
//    var radio_input = radio.find('input');
//    radio_input.each(function() {
//        var obj = $(this);
//
//        if (obj.is(':checked')) {
//            var parent = $(this).parent();
//            parent.addClass('active');
//        }
//    });
//}

//function bindMenuBtn(){
//    // Show Main Menu
//    menu_btn = $('#menu_btn'),
//        profile_panel = $('#profile_panel');
//    viewer_panel = $('.viewer_menu');
//    var _d_height = $(window).height();
//    profile_panel.height(_d_height );
//    viewer_panel.height(_d_height-64 );
//    $('.scroll_box').height(_d_height-106);
//    menu_btn.on('click', function(e){
//        e.preventDefault();
//        var _d_height = $(window).height();
//        profile_panel.height(_d_height );
//        profile_panel.animate({
//            left: 0
//        });
//    });
//
//    pp_hide = $('#pp-hide');
//    pp_hide.on('click', function(e) {
//        e.preventDefault();
//        profile_panel.animate({
//            left: '-100%'
//        });
//    });
//    $(window).resize(function(){
//        var _d_height = $(window).height();
//        profile_panel.height(_d_height );
//        viewer_panel.height(_d_height-64 );
//        $('.scroll_box').height(_d_height-106);
//    });
//}

function toggleSearchRow() {
    $('#ic-searchRowHide').toggleClass("icon-ic-zoom-out icon-ic-zoom-in");
    $('.ui-search-toolbar').toggleClass("collapsed");
    $('.ui-search-toolbar').toggle();
    commonjs.docResize();
}

function toggleWorkListIcons() {
    $('td:nth-child(24),td:nth-child(26), td:nth-child(27),  td:nth-child(29),  td:nth-child(30),  td:nth-child(31),  td:nth-child(32)').toggle();
}
function siteSettingsGridResize() {
    if ($('#editCompanyTabs').length === 0) {
        var height = commonjs.setupMenuHeight() - ($('#siteSettingsTopbar').height() + $('#siteInputForm').height() + 3);
        $('#divSettingsSideLI').height(height);
    }
    $('div.ui-jqgrid > div.ui-jqgrid-view > div.ui-jqgrid-bdiv > div > table.ui-jqgrid-btable').each(function (index) {
        var obj = commonjs.getGridMeasures(jq_isWidthResize, jq_isHeightResize, jq_userWidth, jq_userHeight, jq_offsetWidth, jq_offsetheight);
        $(this).jqGrid('setGridHeight', obj.height);
    });
}
function toggleIconMenu() {
    if ($('nav.viztek-nav').hasClass('open')) {
        $('#viztekIconNav').hide();
        $('#body_content').removeClass('col-xs-12 col-md-12 col-lg-12');
        $('#body_content').removeClass('iconMenuOpen_body_content');
        $('nav.viztek-nav').removeClass('open');
        $('.main-nav').css("overflow-x", "visible");
    } else {
        $('#profile_panel').hide('fade');
        $('#viztekIconNav').show();
        $('#body_content').addClass('col-xs-12 col-md-12 col-lg-12');
        $('#body_content').addClass('iconMenuOpen_body_content');
        $('nav.viztek-nav').addClass('open');
        $('#profile_panel').unbind('mouseleave');
        $('.main-nav').css("overflow-x", "hidden");
        $('html').unbind('click');
    }
    commonjs.docResize();
}
//function setPatientHeight(){
//$('#divPatientFrame').height($(window).outerHeight()-($('.topbar').outerHeight() + $('.header').outerHeight() + $('.page-details-panel').outerHeight() + $('.top-nav').outerHeight()));
//$('#divPatientSideMenu').height($(window).outerHeight()-($('.topbar').outerHeight() + $('.header').outerHeight() + $('.page-details-panel').outerHeight() + $('.top-nav').outerHeight()));

//}
function togglePatientMenu() {
    $('#patientNav').toggle();
    $('#patientMenuDivide').toggleClass('icon-ic-circle-down icon-ic-circle-up')
    commonjs.docResize();
}


function showBillingMenu() {
    $('#mainNav').hide('fast', function () {
        $('#billingNav').show('fast');
    });
}
function showReportMenu() {
    $('#mainNav').hide('fast', function () {
        $('#reportNav').show('fast');
    });
}
function showScheduleMenu() {
    $('#mainNav').hide('fast', function () {
        $('#scheduleNav').show('fast');
    });
}
function menuBack() {
    $('.subMainNavMenu').hide('fast', function () {
        $('.fly-out-menu').hide();
        $('#mainNav').show('fast');
    });
}
function showToolsMenu() {
    $('#mainNav').hide('fast', function () {
        $('#toolsNav').show('fast');
    });

}
function removeIframeHeader() {
    $('iframe#site_modal_iframe_container, iframe#ifSettings').contents().find('head').append('<style>header.header{display:none;}nav.sub-top-nav, nav#subSetupMenu {display: none;}</style>');
}
function removeIframeReportsHeader() {
    $('iframe#site_modal_iframe_container').contents().find('head').append('<style>header.header{display:none;}nav.sub-top-nav, nav#subSetupMenu{display: none;}</style>');
    setTimeout(function () {
        // Timeout set because the gridMeasures stuff doesn't happen immediately
        var $gridContainer = $('div.ui-jqgrid').addClass('flex-parent-vert');
        var bgColor = $('div.ui-jqgrid-hdiv table', $gridContainer).css('background-color');

        $gridContainer.attr('style', 'position:absolute; top:0; bottom:0; left:0; right: 0;');
        $('div.ui-jqgrid-view', $gridContainer).addClass('flex-fill flex-parent-vert').removeAttr('style');//.attr('style', "display: -webkit-box; display: -moz-box; display: -ms-flexbox; display: -webkit-flex; display: flex; flex-direction: column;  -webkit-flex-direction: column;  -moz-flex-direction: column;  -ms-flex-direction: column;");
        $('div.ui-jqgrid-hdiv', $gridContainer).attr('style', 'background-color: ' + bgColor);
        $('div.ui-jqgrid-hdiv table', $gridContainer).removeAttr('style');
        $('div.ui-jqgrid-bdiv', $gridContainer).removeAttr('style').addClass('flex-fill');
        $('div.ui-jqgrid-bdiv > div', $gridContainer).removeAttr('style');
        $('div.ui-jqgrid-bdiv > div > *:not(table)', $gridContainer).removeAttr('style');
        $('#gridPager_SetupInsurance_right').removeAttr('style');
    }, 60);
}
function showFlyoutMenu(menu) {
    $('.fly-out-menu').hide();
    var offset = $(menu).parent().position().top;
    if (offset + $(menu).height() >= $(window).height() - 20) {
        $(menu).css({ 'top': 'auto', 'bottom': 30 });
    } else {
        $(menu).css({ 'top': offset - 5, 'bottom': 'auto' });
    }
    $(menu).show('fast');
}
function removeIframeTranscriptionHeader() {
    $('iframe#site_modal_iframe_container').contents().find('head').append('<style>div#divEditOrderHeader{display:none;}</style>');
}
function removeIframeOrderHeader() {
    $('iframe#site_modal_iframe_container').contents().find('head').append('<style>#divEditOrderHeader{display:none;}</style>');
}
function removeIframePatientExportHeader() {
    $('iframe#site_modal_iframe_container, iframe#ifSettings').contents().find('head').append('<style>header.header{display:none;}nav.sub-top-nav, nav#subSetupMenu{display: none;}</style>');
}

