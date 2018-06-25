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
        printer_templates: 'Printer Templates',
        payments: 'Payments',
        applyPayments:'Applied Payments'
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
        applyPayments:'payment_applications'
    },

    permissionsMap: {
        adjustment_codes: 'APP'
    }
};
