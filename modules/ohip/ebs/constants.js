const responseCodes = {
    SUCCESS: "IEDTS0001",  // green

    RESOURCE_TYPE_NOT_FOUND: "EEDTS0003",
    FILE_UPLOAD_FAILED: "EEDTS0010",
    INVALID_MUID: "EEDTS0012",

    USER_NOT_ALLOWED: "EEDTS0050",
    NO_DATA_FOR_PROCESSING: "EEDTS0051",
    DATA_PROCESSING_FAILED: "EEDTS0052",
    DATA_NOT_PROCESSED: "EEDTS0053",
    DIFFERENT_SUBMIT_USER: "EEDTS0054",
    RESOURCE_CANNOT_BE_SUBMITTED: "EEDTS0055",  // (because it's not in the upload status)
    RESOURCE_ID_CANNOT_BE_FOUND: "EEDTS0056",
    RESOURCE_CANNOT_BE_DELETED: "EEDTS0057",    // (because it's not in the upload status)
    DIFFERENT_DELETE_USER: "EEDTS0058",
    RESOURCE_CANNOT_BE_UPDATED: "EEDTS0059",    // (because it's not in the upload status)
    DIFFERENT_UPDATE_USER: "EEDTS0060",
    USER_DOES_NOT_HAVE_PERMISSION: "EEDTS0061",

    MALFORMED_HEADER: "ECLAM0002",
    MISSING_BILLING_NUMBER: "ECLAM0003",    // (in the header)
    TRAILER_HEADER_ONE_COUNT_MISMATCH: "ECLAM0005",
    TRAILER_HEADER_TWO_COUNT_MISMATCH: "ECLAM0006",
    TRAILER_ITEM_COUNT_MISMATCH: "ECLAM0007",
    CLAIM_FILE_MUST_BE_79_BYTES: "ECLAM0008",

    OBEC_INVALID_FILE_LENGTH: "EOBEC0002",
    OBEC_MALFORMED_HEADER: "EOBEC0003",
    OBEC_INVALID_HEALTH_NUMBER_LENGTH: "EOBEC0004",
    OBEC_NON_NUMEROC_HEALTH_NUMBER: "EOBEC0005",
};


const resourceTypes = {
    //  "inbound"
    CLAIMS: "CL",
    OBEC: "OB",
    STALE_DATED_CLAIMS: "SDC",
    RECIPROCAL_HOSPITAL_BILLING: "RHB",

    // "outbound"
    OBEC_RESPONSE: "OO",
    ERROR_REPORTS: "ER",
    ERROR_REPORT_EXTRACT: "ES",
    REMITTANCE_ADVICE: "RA",
    REMITTANCE_ADVICE_EXTRACT: "RS",
    BATCH_EDIT: "BE",
    ACADEMIC_HEALTH_GOVERNANCE_REPORT: "AH",
    EC_OUTSIDE_USE_REPORT: "CO",
    EC_SUMMARY_REPORT: "CS",
    NORTHERN_SPECIALIST_APP_GOVERNANCE: "NS",
    CLAIMS_MAIL_FILE_REJECT_MESSAGE: "MR",
    OBEC_MAIL_FILE_REJECT_MESSAGE: "OR",
    GENERAL_MINISTRY_COMMUNICATIONS: "GCM",
    PAYMENT_SUMMARY_REPORT_PDF: "PSP",
    PAYMENT_SUMMARY_REPORT_XML: "PSX",
    ROSTER_CAPITATION_REPORT_PDF: "RCP",
    ROSTER_CAPITATION_REPORT_XML: "RCX",
    ADP_VENDOR_REPORT_PDF: "VAP",
    HOME_OXYGEN_VENDOR_REPORT_PDF: "VHP",
    ADP_VENDOR_REPORT_EXCEL: "VAX",
    HOME_OXYGEN_VENDOR_REPORT_EXCEL: "VHX",
};

const services = {
    EDT_UPLOAD: 'upload',
    EDT_SUBMIT: 'submit',
    EDT_LIST: 'list',
    EDT_DOWNLOAD: 'download',
    EDT_INFO: 'info',
    EDT_UPDATE: 'update',
    EDT_DELETE: 'delete',
    EDT_GET_TYPE_LIST: 'getTypeList',
    HCV_REAL_TIME: 'validate',
    // HCV_OVERNIGHT: 'obec',
};

// Include CPTs in this array for fetching professional SLI from facility
const ohipProfProcedureCodes = [

];

// This array will treat actual technical procedures as professional procedure based on which Professional SLIs will be taken
const technicalProcedureCodesExceptions = [
    'G111A', 'G570A'
];

module.exports = {

    services,

    resourceTypes,

    responseCodes,

    UPLOAD_MAX: 5,   // per MCEDT-EBS Service schema

    UPDATE_MAX: 5,   // per MCEDT-EBS Service schema



    DOWNLOAD_MAX: 5,   // per MCEDT-EBS Service schema

    DELETE_MAX: 100,

    SUBMIT_MAX: 100,

    INFO_MAX: 100,

    ohipProfProcedureCodes,

    technicalProcedureCodesExceptions
};
