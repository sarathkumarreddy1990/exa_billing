define(['backbone'], function (Backbone) {
    return Backbone.Model.extend({
        url: "/exa_modules/billing/payments",
        defaults: {
            display_id: "",
            paid_facility_id: null,
            billing_office_id: null,
            payment_date: null,
            billing_method: "",
            payer_type: "",
            payer_id: null,
            invoice_no: "",
            amount: null,
            applied: null,
            available_balance: null,
            current_status: "",
            accounting_date: null,
            is_copay: false,
            is_refund: false,
            is_onlinepayment: false,
            payment_info: null,
            received_date: null,
            updated_dt: null
        },
        initialize: function (models) {
        }
    });
});
