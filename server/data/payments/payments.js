const { query, SQL } = require('./../index');

module.exports = {

    getPayments: async function (params) {
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
                        , get_full_name(users.last_name,users.first_name) AS payer_name
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
                    ORDER BY id ASC
                    LIMIT ${params.pageSize}
                    OFFSET ${((params.pageNo * params.pageSize) - params.pageSize)}`;

        return await query(sql);
    },

    getPayment: async function (params) {

        let { id } = params;

        const sql = `SELECT
                          payments.id
                        , payments.facility_id
                        , patient_id
                        , providers.full_name AS provider_full_name
                        , insurance_name AS insurance_name
                        , provider_groups.group_name AS ordering_facility_name
                        , patients.full_name as patient_name
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
                    LEFT JOIN public.insurance_providers ON insurance_providers.id = payments.insurance_provider_id
                    LEFT JOIN provider_groups ON provider_groups.id = payments.provider_group_id
                    LEFT JOIN public.providers ON providers.id = payments.provider_contact_id

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
            accounting_date,
            user_id,
            invoice_no,
            display_id,
            payer_type,
            notes,
            payment_mode,
            credit_card_name,
            credit_card_number } = params;

        payer_type = payer_type == 'provider' ? 'ordering_provider' : payer_type;

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
                                                    ${company_id}
                                                  , ${facility_id}
                                                  , ${patient_id}
                                                  , ${insurance_provider_id}
                                                  , ${provider_group_id}
                                                  , ${provider_contact_id}
                                                  , ${payment_reason_id}
                                                  , ${amount}
                                                  , ${accounting_date}
                                                  , ${user_id}
                                                  , now()
                                                  , ${invoice_no}
                                                  , ${display_id}
                                                  , ${payer_type}
                                                  , ${notes}
                                                  , ${payment_mode}
                                                  , ${credit_card_name}
                                                  , ${credit_card_number}
                                                WHERE NOT EXISTS(SELECT 1 FROM billing.payments where id = ${paymentId})
                                                RETURNING id),
                                                payment_update as(UPDATE billing.payments SET
                                                    facility_id = ${facility_id}
                                                  , patient_id = ${patient_id}
                                                  , insurance_provider_id = ${insurance_provider_id}
                                                  , provider_group_id = ${provider_group_id}
                                                  , provider_contact_id = ${provider_contact_id}
                                                  , amount = ${amount}::money
                                                  , accounting_dt = ${accounting_date}
                                                  , invoice_no = ${invoice_no}
                                                  , alternate_payment_id = ${display_id}
                                                  , payer_type = ${payer_type}
                                                  , payment_reason_id = ${payment_reason_id}
                                                  , notes = ${notes}
                                                  , mode = ${payment_mode}
                                                  , card_name = ${credit_card_name}
                                                  , card_number = ${credit_card_number}
                                                  WHERE 
                                                    id = ${paymentId}
                                                  AND NOT EXISTS(SELECT 1 FROM insert_data))
                                                  SELECT id from insert_data`;

        return await query(sql);
    },

    createPaymentapplications: async function (params) {

        const sql = SQL`WITH application_details AS(
                                    SELECT 
                                          payment_id
                                        , charge_id
                                        , amount
                                        , amount_type
                                        , adjestment_id
                                        , created_by
                                    FROM json_to_recordset(${JSON.stringify(params.appliedPaymets)}) AS details(
                                          payment_id BIGINT
                                        , charge_id BIGINT
                                        , amount MONEY
                                        , amount_type TEXT
                                        , adjestment_id BIGINT
                                        , created_by BIGINT)
                                    ),
                             claim_comment_details AS(
                                    SELECT 
                                          claim_id
                                        , note
                                        , type
                                        , created_by
                                    FROM json_to_recordset(${JSON.stringify(params.coPaycoInsDeductdetails)}) AS details(
                                          claim_id BIGINT
                                        , note TEXT
                                        , type TEXT
                                        , created_by BIGINT)
                                    ),
                             insert_application AS(
                                    INSERT INTO billing.payment_applications
                                    ( payment_id
                                    , adjustment_code_id
                                    , charge_id
                                    , amount
                                    , amount_type
                                    , created_by
                                    , applied_dt)
                                    (SELECT
                                      payment_id
                                    , adjestment_id
                                    , charge_id
                                    , amount
                                    , amount_type
                                    , created_by
                                    , now()
                                    FROM application_details)
                                    RETURNING id AS application_id
                                                  , charge_id
                                                  , amount_type),
                             update_claims AS(
                                    UPDATE billing.claims
                                    SET
                                        billing_notes = ${params.billingNotes}
                                      , payer_type = ${params.payerType}
                                    WHERE
                                        id = ${params.claimId}),
                             insert_calim_comments AS(
                                    INSERT INTO billing.claim_comments
                                    ( claim_id
                                    , note
                                    , type
                                    , is_internal
                                    , created_by
                                    , created_dt)
                                    SELECT 
                                      claim_id
                                    , note
                                    , type
                                    , false
                                    , created_by
                                    , now()
                                    FROM claim_comment_details)
                                    SELECT * FROM insert_application`;

        return await query(sql);
    },

    saveCasDetails: async function (params) {

        const sql = `INSERT INTO billing.cas_payment_application_details
                                            (   payment_application_id
                                              , cas_group_code_id
                                              , cas_reason_code_id
                                              , amount
                                            )
                                            (SELECT
                                                ${params.application_id}
                                              , ${params.group_code}
                                              , ${params.reason_code}
                                              , ${params.amount})
                                              RETURNING id`;
        return await query(sql);
    }

};
