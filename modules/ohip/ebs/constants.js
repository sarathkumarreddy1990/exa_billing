const responseCodes = {
    IEDTS0001: "Success",

    EEDTS0003: "Resource Type Not Found",
    EEDTS0010: "File Upload Failed",
    EEDTS0012: "MOH ID not Valid",

    EEDTS0050: "User not Allowed",
    EEDTS0051: "No Data for Processing",
    EEDTS0052: "Data Processing failed",
    EEDTS0053: "Data Not Processed",
    EEDTS0054: "User that is submitting the resource is not the same as the user that uploaded it.",
    EEDTS0055: "The resource is not in the upload status so cannot be submitted",
    EEDTS0056: "The resource id specified cannot be found.",
    EEDTS0057: "The resource is not in the upload status so cannot be deleted",
    EEDTS0058: "User that is deleting the resource is not the same as the user that uploaded it.",
    EEDTS0059: "The resource is not in the upload status so cannot be updated",
    EEDTS0060: "User that is updating the resource is not the same as the user that uploaded it",
    EEDTS0061: "User does not have permission to perform this action",

    ECLAM0002: "Mal Formed Header",
    ECLAM0003: "Missing Billing Number in the header",
    ECLAM0005: "Mal Formed Trailer. Claim Header – 1 header count does not match number of Claim Header – 1 headers in batch",
    ECLAM0006: "Mal Formed Trailer. Claim Header – 2 header count does not match number of Claim Header – 2 headers in batch",
    ECLAM0007: "Mal Formed Trailer. Item Record count does not match number of Item Records in batch",
    ECLAM0008: "Claim File must be 79 bytes",

    EOBEC0002: "OBEC File is an invalid length",
    EOBEC0003: "Mal Formed Header. The ‘OBE’ in the transaction code field is invalid.",
    EOBEC0004: "OBEC Health Number length invalid.",
    EOBEC0005: "OBEC Health Number is not numeric.",
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

module.exports = {

    resourceTypes,

    responseCodes,

    UPLOAD_MAX: 5,   // per MCEDT-EBS Service schema

    UPDATE_MAX: 5,   // per MCEDT-EBS Service schema



    DOWNLOAD_MAX: 5,   // per MCEDT-EBS Service schema

    DELETE_MAX: 100,

    SUBMIT_MAX: 100,

    INFO_MAX: 100,
};
