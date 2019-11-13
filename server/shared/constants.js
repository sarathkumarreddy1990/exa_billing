module.exports = {

    staticAssetsRoot: '/exa_modules/billing/static',

    moduleNames: {
        setup: 'setup',
        claim: 'claims',
        claims: 'claims',
        payment: 'payments',
        payments: 'payments',
        pending_payments: 'payments',
        era: 'era',
        edi: 'edi',
        claim_workbench: 'claims',
        user_settings: 'claims',
        ohip: 'ohip'
    },

    screenNames: {
        'adjustment_codes': 'Adjustment Codes',
        'billing_codes': 'Billing Codes',
        'cas_group_codes': 'CAS Group Codes',
        'cas_reason_codes': 'CAS Reason Codes',
        'billing_providers': 'Billing Provider',
        'billing_classes': 'Billing Classes',
        'provider_id_code_qualifiers': 'Provider ID Code Qualifiers',
        'provider_id_codes': 'Provider ID Codes',
        'paper_claim_printer_setup': 'Paper Claim Printer Setup',
        'provider_level_codes': 'Provider Level Codes',
        'claim_status': 'Claim Status',
        'billing_messages': 'Billing Messages',
        'payment_reasons': 'Payment Reasons',
        'validations': 'Validations',
        'edi_clearinghouses': 'EDI Clearinghouses',
        'status_color_codes': 'Status Color Codes',
        'x12': 'EDI Templates',
        'insurance_x12_mapping': 'Insurance X12 Mapping',
        'user_log': 'User Log',
        'audit_log': 'Audit Log',
        'printer_templates': 'Printer Templates',
        'payments': 'Payments',
        'applyPayments': 'Applied Payments',
        'claim_inquiry': 'Claim Inquiry',
        'claim': 'Claims',
        'studies': 'Studies',
        'Payments': 'Edit Claim',
        'split_claim': 'Split Claim',
        'validate_claims': 'Validate Claims',
        'aged-ar-summary': 'Aged AR Summary',
        'aged-ar-details': 'Aged AR Details',
        'charges': 'Charge Report',
        'claim-activity': 'Claim Activity Report',
        'claim-transaction': 'Claim Transaction Report',
        'collections': 'Collections Report',
        'credit-balance-encounters': 'Credit Balance Encounters Report',
        'diagnosis-count': 'Diagnosis Count Report',
        'modality-summary': 'Modality Summary Report',
        'monthly-recap': 'Monthly Recap Report',
        'patient-statement': 'Patient Statment Report',
        'payer-mix': 'Payer Mix Report',
        // 'payment': 'Payments Report' Need to change the name,
        'claim-inquiry': 'Claim Inquiry Report',
        'insurance-vs-lop': 'Insurance Vs LOP Report',
        'patients-by-insurance-company': 'Patients by Insurance Company',
        'payments-by-ins-company': 'Payments by Insurance Company',
        'procedure-analysis-by-insurance': 'Procedure Analysis by Insurance Report',
        'procedure-count': 'Procedure Count Report',
        'reading-provider-fees': 'Reading Provider Fees Report',
        'referring-provider-count': 'Referring Provider Count Report',
        'referring-provider-summary': 'Referring Provider Summary Report',
        'transaction-summary': 'Transaction Summary Report',
        'payments-realization-rate-analysis' : 'Payments Realization Rate Analysis',
        'update_claim_status': 'Claim Status',
        'update_grid_settings': 'Studies / Claims Grid',
        'submitClaims': 'Submit Claims',
        'fileManagement': 'File Management'
    },

    entityNames: {
        adjustment_codes: 'adjustment_codes',
        billing_codes: 'billing_codes',
        cas_group_codes: 'cas_group_codes',
        cas_reason_codes: 'cas_reason_codes',
        billing_providers: 'billing_providers',
        billing_classes: 'billing_classes',
        provider_id_code_qualifiers: 'provider_id_code_qualifiers',
        provider_id_codes: 'provider_id_codes',
        paper_claim_printer_setup: 'paper_claim_printer_setup',
        provider_level_codes: 'provider_level_codes',
        claim_status: 'claim_status',
        billing_messages: 'billing_messages',
        payment_reasons: 'payment_reasons',
        validations: 'validations',
        edi_clearinghouses: 'edi_clearinghouses',
        status_color_codes: 'status_color_codes',
        x12: 'edi_templates',
        insurance_x12_mapping: 'insurance_x12_mapping',
        printer_templates: 'printer_templates',
        payments: 'payments',
        applyPayments: 'payment_applications',
        claim_inquiry: 'claim_comments',
        audit_log: 'Audit Log',
        user_log: 'User Log',
        claims: 'Claims',
        update_claim_status: 'Claims',
        validate_claims: 'Claims',
        update_grid_settings: 'user_settings',
        submitClaims: 'submitClaims',
        fileManagement: 'fileManagement'
    },

    permissionsMap: {
        'adjustment_codes': 'ADJC',
        'billing_codes': 'BICO',
        'billing_classes': 'BICL',
        'claim_status': 'CLST',
        'billing_providers': 'BIPR',
        'provider_id_codes': 'BIPR',
        'provider_id_code_qualifiers': 'PRCQ',
        'billing_messages': 'BILM',
        'payment_reasons': 'PARE',
        'cas_group_codes': 'CASG',
        'cas_reason_codes': 'CASR',
        'status_color_codes': 'STCC',
        'validations': 'BIVA',
        'printer_templates': 'PCA',
        'x12': 'EDRT',
        'insurance_x12_mapping': 'INSM',
        'edi_clearinghouses': 'CLHO',
        'user_log': 'BULG',
        'audit_log': 'BALG',
        'claim_workbench': 'CLIM',
        'claims_total_records': 'CLIM',
        'create_claim': 'CLIM',
        'claim_filters': 'CLIM',
        'printer_template': 'CLIM', //when claim
        'invoice_data': 'CLIM', //when claim
        'claim_json': 'CLIM', //when claim
        'patient_insurances': 'CLIM', //create claim
        'line_items': 'CLIM', //create claim
        'invoice_no': 'CLIM', // Reset Invoice No
        'studies': 'HSTY',
        'studies_total_records': 'HSTY',
        'payments': 'PAYM',
        'payment': 'PAYM',
        'claim_inquiry': 'CLMI',
        'split_claim': 'MASO',
        'validate_claims': 'CLVA',
        'aged-ar-summary': 'AGAR',
        'aged-ar-details': 'AARD',
        'charges': 'CHRG',
        'claim-activity': 'CLAY',
        'claim-transaction': 'CLTR',
        'collections': 'COLR',
        'credit-balance-encounters': 'CRBE',
        'diagnosis-count': 'DICN',
        'modality-summary': 'MOSU',
        'monthly-recap': 'MNRC',
        'patient-statement': 'PATS',
        'payer-mix': 'PYMX',
        'patient-activity-statement': 'PACT',
        'payment-report': 'PAYT',
        'claim-inquiry': 'CLIN',
        'insurance-vs-lop': 'IVSL',
        'patients-by-insurance-company': 'PAIC',
        'payments-by-ins-company': 'PBIC',
        'procedure-analysis-by-insurance': 'PABI',
        'procedure-count': 'PRCN',
        'reading-provider-fees': 'RPFR',
        'referring-provider-count': 'REPC',
        'referring-provider-summary': 'REPS',
        'transaction-summary': 'TSUM',
        'payments_list': 'PAYM', // screenNameInternal = list for EOB doubts having
        'payments-pdf': 'PAYM',
        'total_amount': 'PAYM',
        'count': 'PAYM',
        'groupcodes_and_reasoncodes': 'PAYM',
        'all': 'PAYM',
        'patient_count': 'PAYM',
        'patient_search': 'PAYM',
        'payment-receipt-pdf': 'PAYM',
        'payment-print-pdf': 'PAYM',
        'print-receipt':'PAYM',
        'applyPayments': 'PAYM',
        'applied_amount': 'APAY',
        'claim-charges': 'APAY',
        'fee_details': 'APAY',
        'study_cpt_details': 'PAYM',
        'claim': 'ECLM',
        'billing_payers': 'ECLM',
        'service_facilities': 'ECLM',
        'claim_charge': 'ECLM', //delete Claim Rmenu
        'eob_pdf' : 'ERAI',
        'era_list': 'ERAI',
        'upload': 'ERAI',
        'era_file_preview': 'ERAI',
        'process-file': 'ERAI',
        'era_details': 'ERAI',
        'claim_study': 'ECLM',
        'follow_ups': 'ECLM',
        'claim_patient': 'PCLM',
        'payment_applications': 'APAY',
        'invoice_claims': 'CLIM',
        'claims': 'CLIM',
        'payment-invoice': 'CLIM',
        'patient': 'ECLM',
        'invoice_details': 'APAY',
        'apply_invoice_payments': 'APAY',
        'update_claim_status': 'CLIM',
        'charge_check_payment_details': 'CLIM',
        'claim_check_payment_details': 'CLIM',
        'payments-realization-rate-analysis': 'PRRA',
        'apply_tos_payments': 'PAYM',
        'claim_summary': 'CLIM',
        'patient_claim_list': 'PAYM',
        'process_write_off_payments': 'PAYM',
        'get_claim_payments': 'CLIM',
        'get_patient_charges': 'CLIM',
        'can_delete_payment': 'PAYM',
        'claims_total_balance': 'CLIM',
        'submitClaims': 'BIVA',
        'fileManagement': 'CLFM',
        'paper_claim_fax': 'CLIM',
        'payment_count': 'PAYM',
        'reassess_claim': 'CLIM',
        'ahs_claim_delete': 'CLIM'
    }
};
