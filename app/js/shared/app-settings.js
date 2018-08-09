var app = {

    saID: 0,
    lettersTobeSearched: 0,
    sessionTimeout: 60,
    autoRefreshInterval: 20,
    enableLDAP: '',
    sessionID: '',
    currentrowsToDisplay: 0,
    currentTheme: '',
    currentCulture: '',
    default_facility_id: 0,
    siteID: 0,
    states: {},
    studyfields: {},
    enable_rcopia:'',
    themes: {},
    communication_prefrences:{},
    smoking_status:[],
    audit_description:[],
    route_info: [],
    deathReason:{},
    cultures: {},
    companyID: 0,
    company_code: '',
    userID: 0,
    currentCompanyID: 0,
    currentCompanyCode: '',
    facilities: [],
    modalities: [],
    modalityRooms: [],
    companyList: {},
    application_entities: {},
    openWindows: [],
    prefix: '',
    suffix: '',
    can_edit: false,
    mrn_type: '',
    showpriors: false,
    showserial: false,
    showdeletedstudies: false,
    showdeletedpendingstudies: false,
    userdevices: {},
    providerID: 0,
    aeinstitutionfilter: [],
    show_pending_studies: false,
    show_comp_pend_list: false,
    show_orders_tab: false,
    show_summary_tab: false,
    defaultTab: "",
    studyFilter: [],
    modifiers:[],
    types_of_service:[],
    worklistStudies:[],
    workListStudiesData: [],
    license: "",
    userInfo: {
        userID: 0,
        userName: '',
        userFullName: '',
        user_type: 'NU',
        facilities: [],
        first_name: '',
        last_name: '',
        middle_initial: '',
        suffix: '',
        documentType: [],
        user_group_id: 0,
        password_changed_dt: ""
    },

    settings: {
        userTitles: {},
        maritalStatus: {},
        bodyParts: [],
        empStatus: {},
        credentials: {},
        racialIdentity: {},
        ethnicity: {},
        transportation: {},
        priorities: {},
        cancelReasons: {},
        scanDocumentTypes: {},
        languages: {},
        specialities: {},
        patientAlerts: {},
        gender: {},
        sources: {},
        orientation: {},
        relationships: {},
        patientLocation: {},
        screenCodes: {},
        permissions: [],
        veterinaryGender: {},
        studyflag: [],
        localCacheAeTitle:''
    },
    modalityRoomsMap: Immutable.Map(),
    setupModalityRooms: function ( data ) {
        if ( Array.isArray(data) && data.length !== 0 ) {
            app.modalityRoomsMap = app.modalityRoomsMap.withMutations(function ( rooms ) {
                var i = 0;
                var count = data.length;
                var room;
                for ( ; i < count; ++i ) {
                    room = data[ i ];
                    rooms = rooms.set(room.id, room);
                }
            });
        }
    },

    getFacilityName: function (modalityRoomID) {
        var modalityrooms = $.grep(app.modalityRooms, function (e) {
            return e.id == modalityRoomID;
        });

        if (modalityrooms.length)
            var facility = $.grep(app.facilities, function (e) {
                return e.id == modalityrooms[0].facility_id;
            });
        return (facility && facility[0]) ? facility[0].facility_name : '';
    },

    getModalityRooms: function (facilityID) {
        var modalityRooms = $.grep(app.modalityRooms, function (e) {
            return e.facility_id == facilityID;
        });

        return modalityRooms;
    },
};
