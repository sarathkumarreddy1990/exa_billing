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

module.exports = {

    resourceTypes,

    UPLOAD_MAX: 5,   // per MCEDT-EBS Service schema

    UPDATE_MAX: 5,   // per MCEDT-EBS Service schema



    DOWNLOAD_MAX: 5,   // per MCEDT-EBS Service schema

    DELETE_MAX: 100,

    SUBMIT_MAX: 100,

    INFO_MAX: 100,


};
