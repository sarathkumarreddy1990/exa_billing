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
        cas_group_codes: 'Cas Group Codes',
        cas_reason_codes: 'Cas Reason Codes',
        billing_providers: 'Billing Providers',
        billing_classes: 'Billing Classes',
        provider_id_code_qualifiers: 'Provider Id Code Qualifiers',
        provider_id_codes: 'Provider Id Codes',
        paper_claim_printer_setup: 'Paper Claim Printer Setup',
        provider_level_codes: 'Provider Level Codes',
        claim_status: 'Claim Status',
        billing_messages: 'Billing Messages',
        payment_reasons: 'Payment Reasons',
        validations: 'Validations',
        edi_clearinghouses: 'Edi Clearinghouses',
        status_color_codes: 'Status Color Codes',
        x12: 'Edi Templates',
        insurance_x12_mapping: 'Insurance X12 Mapping',
        user_log : 'User Log',
        audit_log : 'Audit Log'
    },

    permissionsMap: {
        adjustment_codes: 'APP'
    }
};
