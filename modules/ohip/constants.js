
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


    MONTH_CODE_JANUARY: 65, // 'January' as a processing cycle month code

    encoding: 'ascii',      // encoding scheme to read and write files in

    encoder: {

        endOfRecord: '\x0D',    // value appended to the end of every record in a
                                // claim-submission string

        endOfBatch: '\x1A',     // value appended to the end of every
                                // claim-submission string

    },

    decoder: {
        endOfRecord: '\n',


    },

    resourceTypes,



    // TODO convert to i18n
    resourceDescriptions: {

        [resourceTypes.CLAIMS] : 'Claims',
        [resourceTypes.OBEC] : 'OBEC',
        [resourceTypes.STALE_DATED_CLAIMS] : 'Stale Dated Claims',
        [resourceTypes.RECIPROCAL_HOSPITAL_BILLING] : 'Reciprocal Hospital Billing',

        [resourceTypes.OBEC_RESPONSE] : 'OBEC Response',
        [resourceTypes.ERROR_REPORTS] : 'Error Reports',
        [resourceTypes.CLAIMS_MAIL_FILE_REJECT_MESSAGE] : 'Claims Mail File Reject Message',
        [resourceTypes.ERROR_REPORT_EXTRACT] : 'Error Report Extract',
        [resourceTypes.REMITTANCE_ADVICE] : 'Remittance Advice',
        [resourceTypes.REMITTANCE_ADVICE_EXTRACT] : 'Remittance Advice Extract',
        [resourceTypes.BATCH_EDIT] : 'Batch Edit',
        [resourceTypes.ACADEMIC_HEALTH_GOVERNANCE_REPORT] : 'Academic Health Governance Report',
        [resourceTypes.EC_OUTSIDE_USE_REPORT] : 'EC Outside Use report',
        [resourceTypes.EC_SUMMARY_REPORT] : 'EC Summary report',
        [resourceTypes.NORTHERN_SPECIALIST_APP_GOVERNANCE] : 'Northern Specialist APP Governance',
        [resourceTypes.CLAIMS_MAIL_FILE_REJECT_MESSAGE] : 'Claims Mail File Reject Message',
        [resourceTypes.OBEC_MAIL_FILE_REJECT_MESSAGE] : 'OBEC Mail File Reject Message',
        [resourceTypes.GENERAL_MINISTRY_COMMUNICATIONS] : 'General Ministry Communications',
        [resourceTypes.PAYMENT_SUMMARY_REPORT_PDF] : 'Payment Summary Report PDF',
        [resourceTypes.PAYMENT_SUMMARY_REPORT_XML] : 'Payment Summary Report XML',
        [resourceTypes.ROSTER_CAPITATION_REPORT_PDF] : 'Roster Capitation Report PDF',
        [resourceTypes.ROSTER_CAPITATION_REPORT_XML] : 'Roster Capitation Report XML',
        [resourceTypes.ADP_VENDOR_REPORT_PDF] : 'ADP Vendor Report PDF',
        [resourceTypes.HOME_OXYGEN_VENDOR_REPORT_PDF] : 'Home Oxygen Vendor Report PDF',
        [resourceTypes.ADP_VENDOR_REPORT_EXCEL] : 'ADP Vendor Report Excel',
        [resourceTypes.HOME_OXYGEN_VENDOR_REPORT_EXCEL] : 'Home Oxygen Vendor Report Excel',
    },

};
