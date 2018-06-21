module.exports = {

    staticAssetsRoot: '/exa_modules/billing/static',

    moduleNames: {
        setup: 'setup',
        claim: 'claims',
        claims: 'claims',
        payment: 'payments',
        payments: 'payments',
        era: 'era',
        edi: 'edi',
    },

    screenNames: {
        adjustment_codes: 'Adjustment Codes',
        billing_codes: 'Billing Codes',
        cas_group_codes: 'CAS Group Codes',
        cas_reason_codes: 'CAS Reason Codes',
        billing_providers: 'Billing Providers',
        billing_classes: 'Billing Classes',
        provider_id_code_qualifiers: 'Provider ID Code Qualifiers',
        provider_id_codes: 'Provider ID Codes',
        paper_claim_printer_setup: 'Paper Claim Printer Setup',
        provider_level_codes: 'Provider Level Codes',
        claim_status: 'Claim Status',
        billing_messages: 'Billing Messages',
        payment_reasons: 'Payment Reasons',
        validations: 'Validations',
        edi_clearinghouses: 'EDI Clearinghouses',
        status_color_codes: 'Status Color Codes',
        x12: 'EDI Templates',
        insurance_x12_mapping: 'Insurance X12 Mapping',
        user_log : 'User Log',
        audit_log : 'Audit Log',
        paper_claim_templates: 'Paper Claim Templates',
        payments: 'payments'
    },

    permissionsMap: {
        adjustment_codes: 'APP'
    }
};
