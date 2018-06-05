const { query, SQL } = require('./index');

module.exports = {

    getPayments: async function () {
        const sql = `SELECT
                          payments.id
                        , payments.facility_id
                        , patient_id
                        , insurance_provider_id
                        , provider_group_id
                        , provider_contact_id
                        , payment_reason_id
                        , amount MONEY
                        , accounting_dt AS accounting_date
                        , payment_dt AS payment_date
                        , alternate_payment_id AS display_id
                        , created_by AS payer_name
                        , payment_dt
                        , invoice_no
                        , alternate_payment_id
                        , payer_type
                        , payments.notes
                        , mode AS payment_mode
                        , card_name
                        , card_number
                        , patients.full_name as patient_name
                        , get_full_name(users.last_name, users.first_name) as user_full_name
                        , facilities.facility_name
                        , amount
                        , (select payment_balance_total from billing.get_payment_totals(payments.id)) AS available_balance
                        , (select payments_applied_total from billing.get_payment_totals(payments.id)) AS applied       
                        , (select adjustments_applied_total from billing.get_payment_totals(payments.id)) AS adjustment_amount
                        , (select payment_status from billing.get_payment_totals(payments.id)) AS current_status
                    FROM billing.payments
                    INNER JOIN public.users ON users.id = payments.created_by
                    LEFT JOIN public.patients ON patients.id = payments.patient_id
                    LEFT JOIN public.facilities ON facilities.id = payments.facility_id
                    ORDER BY id ASC LIMIT 100`;

        return await query(sql);
    },

    getPayment: async function (params) {

        let { id } = params;

        const sql = `SELECT
                          payments.id
                        , payments.facility_id
                        , patient_id
                        , insurance_provider_id
                        , provider_group_id
                        , provider_contact_id
                        , payment_reason_id
                        , amount MONEY
                        , accounting_dt AS accounting_date
                        , payment_dt AS payment_date
                        , alternate_payment_id AS display_id
                        , created_by AS payer_name
                        , payment_dt
                        , invoice_no
                        , alternate_payment_id
                        , payer_type
                        , payments.notes
                        , mode AS payment_mode
                        , card_name
                        , card_number
                        , patients.full_name as patient_name
                        , get_full_name(users.last_name, users.first_name) as user_full_name
                        , facilities.facility_name
                        , amount
                        , (select payment_balance_total from billing.get_payment_totals(payments.id)) AS available_balance
                        , (select payments_applied_total from billing.get_payment_totals(payments.id)) AS applied       
                        , (select adjustments_applied_total from billing.get_payment_totals(payments.id)) AS adjustment_amount
                        , (select payment_status from billing.get_payment_totals(payments.id)) AS current_status
                    FROM billing.payments
                    INNER JOIN public.users ON users.id = payments.created_by
                    LEFT JOIN public.patients ON patients.id = payments.patient_id
                    LEFT JOIN public.facilities ON facilities.id = payments.facility_id
                    WHERE 
                        payments.id = ${id}`;

        return await query(sql);
    },

    createOrUpdatePayment: async function (params) {
        let {
            paymentId,
            company_id,
            facility_id,
            patient_id,
            insurance_provider_id,
            provider_group_id,
            provider_contact_id,
            payment_reason_id,
            amount,
            accounting_dt,
            created_by,
            payment_dt,
            invoice_no,
            alternate_payment_id,
            payer_type,
            notes,
            mode,
            card_name,
            card_number } = params;

        const sql = SQL`WITH insert_data as (INSERT INTO billing.payments
                                                (   company_id
                                                  , facility_id
                                                  , patient_id
                                                  , insurance_provider_id
                                                  , provider_group_id
                                                  , provider_contact_id
                                                  , payment_reason_id
                                                  , amount
                                                  , accounting_dt
                                                  , created_by
                                                  , payment_dt
                                                  , invoice_no
                                                  , alternate_payment_id
                                                  , payer_type
                                                  , notes
                                                  , mode
                                                  , card_name
                                                  , card_number)
                                                SELECT
                                                    ${company_id},
                                                  , ${facility_id},
                                                  , ${patient_id},
                                                  , ${insurance_provider_id},
                                                  , ${provider_group_id},
                                                  , ${provider_contact_id},
                                                  , ${payment_reason_id},
                                                  , ${amount},
                                                  , ${accounting_dt},
                                                  , ${created_by},
                                                  , ${payment_dt},
                                                  , ${invoice_no},
                                                  , ${alternate_payment_id},
                                                  , ${payer_type},
                                                  , ${notes},
                                                  , ${mode},
                                                  , ${card_name},
                                                  , ${card_number}
                                                WHERE NOT EXISTS(SELECT 1 FROM billing.payments where id = ${paymentId})
                                                RETURNING id)
                                                UPDATE billing.payments SET
                                                    facility_id = ${facility_id}
                                                  , patient_id = ${patient_id}
                                                  , insurance_provider_id = ${insurance_provider_id}
                                                  , provider_group_id = ${provider_group_id}
                                                  , provider_contact_id = ${provider_contact_id}
                                                  , amount = ${amount}:: money
                                                  , accounting_dt = ${accounting_dt}
                                                  , payment_dt = ${payment_dt}
                                                  , invoice_no = ${invoice_no}
                                                  , alternate_payment_id = ${alternate_payment_id}
                                                  , payer_type = ${payer_type}
                                                  , notes = ${notes}
                                                  , mode = ${mode}
                                                  , card_name = ${card_name}
                                                  , card_number = ${card_number}
                                                  WHERE 
                                                    id = ${paymentId}
                                                  AND NOT EXISTS(SELECT 1 FROM insert_data)`;

        return await query(sql);
    }

};
