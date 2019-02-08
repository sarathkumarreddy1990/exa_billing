

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

    resourceTypes: {
        //  "inbound"
        CLAIMS: "CL",//: "Claims",
        OBEC: "OB",//: "OBEC",
        STALE_DATED_CLAIMS: "SDC",//: "Stale Dated Claims",
        RECIPROCAL_HOSPITAL_BILLING: "RHB",//: "Reciprocal Hospital Billing",

        // "outbound"
        OBEC_RESPONSE: "OO",//: "OBEC Response",
        ERROR_REPORTS: "ER",//: "Error Reports",
        ERROR_REPORT_EXTRACT: "ES",//: "Error Report Extract",
        REMITTANCE_ADVICE: "RA",//: "Remittance Advice",
        REMITTANCE_ADVICE_EXTRACT: "RS",//: "Remittance Advice Extract",
        BATCH_EDIT: "BE",//: "Batch Edit",
        ACADEMIC_HEALTH_GOVERNANCE_REPORT: "AH",//: "Academic Health Governance Report",
        EC_OUTSIDE_USE_REPORT: "CO",//: "EC Outside Use report",
        EC_SUMMARY_REPORT: "CS",//: "EC Summary report",
        NORTHERN_SPECIALIST_APP_GOVERNANCE: "NS",//: "Northern Specialist APP Governance",
        CLAIMS_MAIL_FILE_REJECT_MESSAGE: "MR",//: "Claims Mail File Reject Message",
        OBEC_MAIL_FILE_REJECT_MESSAGE: "OR",//: "OBEC Mail File Reject Message",
        GENERAL_MINISTRY_COMMUNICATIONS: "GCM",//: "General Ministry Communications",
        PAYMENT_SUMMARY_REPORT_PDF: "PSP",//: "Payment Summary Report PDF",
        PAYMENT_SUMMARY_REPORT_XML: "PSX",//: "Payment Summary Report XML",
        ROSTER_CAPITATION_REPORT_PDF: "RCP",//: "Roster Capitation Report PDF",
        ROSTER_CAPITATION_REPORT_XML: "RCX",//: "Roster Capitation Report XML",
        ADP_VENDOR_REPORT_PDF: "VAP",//: "ADP Vendor Report PDF",
        HOME_OXYGEN_VENDOR_REPORT_PDF: "VHP",//: "Home Oxygen Vendor Report PDF",
        ADP_VENDOR_REPORT_EXCEL: "VAX",//: "ADP Vendor Report Excel",
        HOME_OXYGEN_VENDOR_REPORT_EXCEL: "VHX",//: "Home Oxygen Vendor Report Excel",
    },

};
