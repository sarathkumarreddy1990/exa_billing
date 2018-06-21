define(['backbone'], function (Backbone) {
    return Backbone.Model.extend({
        url: "/exa_modules/billing/payments",
        defaults: {
            paymentId: null,
            company_id: null,
            facility_id: null,
            display_id: null,
            payer_type: null,
            amount: 0.00,
            invoice_no: null,
            accounting_date: null,
            patient_id: null,
            provider_contact_id: null,
            provider_group_id: null,
            insurance_provider_id: null,
            credit_card_number: null,
            credit_card_name: null,
            payment_mode: null,
            payment_reason_id: null,
            user_id: 0,
            notes: null
        },
        initialize: function (models) {
        }
    });
});
