const {
    resourceTypes,
    responseCodes,
    services,
} = require('./ebs/constants');


const specialtyCodes = {
    FAMILY_PRACTICE: "00",// Family Practice and Practice In General
    ANESTHESIA: "01",// Anaesthesia
    DERMATOLOGY: "02",// Dermatology
    GENERAL_SURGERY: "03",// General Surgery
    NEUOSURGERY: "04",// Neurosurgery
    COMMUNITY_MEDICINE: "05",// Community Medicine
    ORTHOPAEDIC_SURGERY: "06",// Orthopaedic Surgery
    GERIATRICS: "07",// Geriatrics
    PLASTIC_SURGERY: "08",// Plastic Surgery
    CARDIOVASCULAR_AND_THORACIC_SURGERY: "09",// Cardiovascular and Thoracic Surgery
    EMERGENCY_MEDICINE: "12",// Emergency Medicine
    INTERNAL_MEDICINE: "13",// Internal Medicine
    ENDOCRINOLOGY: "15",// Endocrinology
    NEPHROLOGY: "16",// Nephrology
    VASCULAR_SURGERY: "17",// Vascular Surgery
    NEUROLOGY: "18",// Neurology
    PSYCHIATRY: "19",// Psychiatry
    OBSTETRICS_AND_GYNAECOLOGY: "20",// Obstetrics and Gynaecology
    GENETICS: "22",// Genetics
    OPHTHALMOLOGY: "23",// Ophthalmology
    OTOLARYNGOLOGY:"24",// Otolaryngology
    PAEDIATRICS: "26",// Paediatrics
    PATHOLOGY: "28",// Pathology
    MICROBIOLOGY: "29",// Microbiology
    CLINICAL_BIOCHEMISTRY: "30",// Clinical Biochemistry
    PHYSICAL_MEDICINE: "31",// Physical Medicine
    DIAGNOSTIC_RADIOLOGY: "33",// Diagnostic Radiology
    THERAPEUTIC_RADIOLOGY: "34",// Therapeutic Radiology
    UROLOGY: "35",// Urology
    GASTROENTEROLOGY: "41",// Gastroenterology
    MEDICAL_ONCOLOGY: "44",// Medical Oncology
    INFECTIOUS_DISEASES: "46",// Infectious Diseases
    RESPIRATORY_DISEASES: "47",// Respiratory Diseases
    RHEUMATOLOGY: "48",// Rheumatology
    CARDIOLOGY: "60",// Cardiology
    HEMATOLOGY: "61",// Hematology
    CLINICAL_IMMUNOLOGY: "62",// Clinical Immunology
    NUCLEAR_MEDICINE: "63",// Nuclear Medicine
    THORADIC_SURGERY: "64",// Thoracic Surgery
    DENTAL_SURGERY: "49",// Dental Surgery
    ORAL_SURGERY: "50",// Oral Surgery
    ORTHODONTICS: "51",// Orthodontics
    PAEDODONTICS: "52",// Paedodontics
    PERIODONTICS: "53",// Periodontics
    ORAL_PATHOLOGY: "54",// Oral Pathology
    ENDODONTICS: "55",// Endodontics
    ORAL_RADIOLOGY: "70",// Oral Radiology
    PROSTHODONTICS: "71",// Prosthodontics
    OPTOMETRY: "56",// Optometry
    OSTEOPATHY: "57",// Osteopathy
    CHIROPODY_PODIATRY: "58",// Chiropody (Podiatry)
    CHIROPRACTICS: "59",// Chiropractics
    MIDWIFE_REFERRAL_ONLY: "75",// Midwife (referral only)
    NURSE_PRACTITIONERS: "76",// Nurse Practitioners
    PRIVATE_PHYSIOTHERAPY_HOME_ONLY: "80",// Private Physiotherapy Facility (Approved to Provide Home Treatment Only)
    PRIVATE_PHYSIOTHERAPY_OFFICE_AND_HOME: "81",// Private Physiotherapy Facility (Approved to Provide Office and Home Treatment)
    NONMEDICAL_LAB_DIRECTOR: "27",// Non-medical Laboratory Director (ProviderNumber Must Be 599993)
    ALTERNATE_HEALTHCARE_PROFESSION: "85",// Alternate Health Care Profession
    IHF_NONMEDICAL_PRACTITIONER: "90",// IHF Non-Medical Practitioner (Provider Number Must Be 991000)
};



module.exports = {

    MONTH_CODE_JANUARY: 65, // 'January' as a processing cycle month code

    encoding: 'ascii',      // encoding scheme to read and write files in

    encoder: {

        endOfRecord: '\x0D',    // value appended to the end of every record in a
                                // claim-submission string

        endOfFile: '\x1A',     // value appended to the end of every
                                // claim-submission string

    },

    decoder: {
        endOfRecord: '\n',


    },

    resourceTypes,
    responseCodes,
    services,

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
