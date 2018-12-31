const { query, SQL } = require('./../index');
const config = require('./../../config');
const queryMakers = require('./../query-maker-map');
const generator = queryMakers.get('date');

module.exports = {

    getPayments: async function (params) {
        let whereQuery = [];

        if (!params.paymentReportFlag) {
            params.sortOrder = params.sortOrder || ' ASC';
            params.sortField = params.sortField == 'id' ? ' payments.id ' : params.sortField;

            params.sortField = params.sortField == 'payment_dt' ? ' payments.payment_dt ' : params.sortField;
        }

        let {
            payment_id,
            display_id,
            payment_dt,
            payer_type,
            payer_name,
            accounting_date,
            amount,
            available_balance,
            applied,
            adjustment_amount,
            user_full_name,
            payment_mode,
            card_number,
            facility_name,
            sortOrder,
            sortField,
            pageNo,
            pageSize,
            fromDate,
            toDate,
            filterByDateType,
            paymentStatus,
            isGetTotal,
            from,
            patientID,
            countFlag,
            default_facility_id,
            notes,
            account_no
        } = params;

        if (paymentStatus) {
            whereQuery.push(`(select payment_status from billing.get_payment_totals(payments.id))=ANY(string_to_array('${params.paymentStatus}',','))`);
        }

        if (payment_id) {
            whereQuery.push(`payments.id::text = '${payment_id}'::text`);
        }

        if (display_id) {
            whereQuery.push(` alternate_payment_id ILIKE '%${display_id}%'`);
        }

        if (payment_dt) {
            const paymentFilter = generator('payment_dt', payment_dt);

            if (paymentFilter) {
                whereQuery.push(paymentFilter);
            }
        }

        if (accounting_date) {
            const accountingDateFilter = generator('accounting_date', accounting_date);

            if (accountingDateFilter) {
                whereQuery.push(accountingDateFilter);
            }
        } else {
            if (fromDate && toDate) {
                whereQuery.push(`${filterByDateType} BETWEEN  '${fromDate}'::date AND '${toDate}'::date`);
            }
        }

        if (payer_type) {
            whereQuery.push(` payer_type = replace('${payer_type}', '\\', '')`);
        }

        if (payer_name) {
            whereQuery.push(`  (  CASE payer_type
                WHEN 'insurance' THEN insurance_providers.insurance_name
                WHEN 'ordering_facility' THEN provider_groups.group_name
                WHEN 'ordering_provider' THEN ref_provider.full_name
                WHEN 'patient' THEN patients.full_name        END)  ILIKE '%${payer_name}%' `);
        }

        if (amount) {
            whereQuery.push(`amount = ${amount}::money`);
        }

        if (available_balance) {
            whereQuery.push(`(select payment_balance_total from billing.get_payment_totals(payments.id))=${available_balance}::money`);
        }

        if (applied) {
            whereQuery.push(`(select payments_applied_total from billing.get_payment_totals(payments.id))=${applied}::money`);
        }

        if (adjustment_amount) {
            whereQuery.push(`(select adjustments_applied_total from billing.get_payment_totals(payments.id))=${adjustment_amount}::money`);
        }

        if (user_full_name) {
            whereQuery.push(`get_full_name(users.last_name, users.first_name)  ILIKE '%${user_full_name}%' `);
        }

        if (payment_mode) {
            whereQuery.push(`mode ILIKE '%${payment_mode}%'`);
        }

        if (card_number) {
            whereQuery.push(`card_number ILIKE '%${card_number}%'`);
        }

        if (facility_name) {
            whereQuery.push(`payments.facility_id = ${facility_name} `); //eg:facility_name =1 for search column
        }

        if (from === 'patient_claim') {
            whereQuery.push(` patient_id = ${patientID} AND payment_totals.payment_status = 'unapplied' `);
        }

        const optionalSelect = from === 'patient_claim' ? `, COUNT(1) OVER (range unbounded preceding) AS total_records` : ``;

        if (from === 'ris') {
            whereQuery.push(` payer_type = 'patient' `);
        }

        if (notes) {
            whereQuery.push(` billing.payments.notes ILIKE '%${notes}%'`);
        }

        if (account_no) {
            whereQuery.push(` account_no ILIKE '%${account_no}%'`);
        }

        let joinQuery = `
            INNER JOIN public.users ON users.id = payments.created_by
            INNER JOIN billing.get_payment_totals(payments.id) payment_totals ON true
            LEFT JOIN public.patients ON patients.id = payments.patient_id AND payer_type = 'patient'
            LEFT JOIN public.provider_groups ON provider_groups.id = payments.provider_group_id
            LEFT JOIN public.provider_contacts ON provider_contacts.id = payments.provider_contact_id
            LEFT JOIN public.providers ref_provider ON provider_contacts.provider_id = ref_provider.id
            LEFT JOIN public.insurance_providers  ON insurance_providers.id = payments.insurance_provider_id
        `;

        if (default_facility_id) {
            joinQuery = joinQuery + `LEFT JOIN public.facilities ON facilities.id = coalesce(payments.facility_id,${default_facility_id})`;
        }
        else{
            joinQuery = joinQuery + 'LEFT JOIN public.facilities ON facilities.id = coalesce(payments.facility_id)';
        }


        let sql = '';

        if (isGetTotal) {
            sql = SQL`
                SELECT SUM(amount) AS total_amount,
                    SUM(payment_totals.payments_applied_total) AS total_applied
                    ,SUM(payment_totals.adjustments_applied_total) AS total_adjustment
                FROM billing.payments
            `;

            sql.append(joinQuery);

            if (whereQuery.length) {
                sql.append(SQL` WHERE `)
                    .append(whereQuery.join(' AND '));
            }

            return await query(sql);
        }
        else if (countFlag == 'true') {
            sql = SQL`  SELECT
                        COUNT(1) AS total_records
                        FROM billing.payments
                        `;

            sql.append(joinQuery);

            if (whereQuery.length) {
                sql.append(SQL` WHERE `)
                    .append(whereQuery.join(' AND '));
            }

            return await query(sql);
        }

        sql = SQL`SELECT
                        payments.id
                    , account_no
                    , payments.id as payment_id
                    , payments.facility_id
                    , patient_id
                    , insurance_provider_id
                    , payments.provider_group_id
                    , provider_contact_id
                    , payment_reason_id
                    , amount MONEY
                    , alternate_payment_id AS display_id
                    , (  CASE payer_type
                            WHEN 'insurance' THEN insurance_providers.insurance_name
                            WHEN 'ordering_facility' THEN provider_groups.group_name
                            WHEN 'ordering_provider' THEN ref_provider.full_name
                            WHEN 'patient' THEN patients.full_name        END) AS payer_name
                    , payment_dt
                    , accounting_date::text
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
                    , payment_totals.payment_balance_total AS available_balance
                    , payment_totals.payments_applied_total AS applied
                    , payment_totals.adjustments_applied_total AS adjustment_amount
                    , payment_totals.payment_status AS current_status `;

        sql.append(optionalSelect)

            .append(SQL` FROM billing.payments `)
            .append(joinQuery);

        if (whereQuery.length) {
            sql.append(SQL` WHERE `)
                .append(whereQuery.join(' AND '));
        }

        if (params.paymentReportFlag) {
            if (config.get('paymentsExportRecordsCount')) {
                pageSize = config.get('paymentsExportRecordsCount');
            } else {
                pageSize = 1000;
            }

            sql.append(SQL` ORDER BY  payments.id desc `)
                .append(SQL` LIMIT ${pageSize}`);
        }

        if (!isGetTotal && !params.paymentReportFlag) {
            sql.append(SQL` ORDER BY  `)
                .append(sortField)
                .append(' ')
                .append(sortOrder)
                .append(SQL` LIMIT ${pageSize}`)
                .append(SQL` OFFSET ${((pageNo * pageSize) - pageSize)}`);
        }

        if (from === 'tos_payment') {

            let query = ` SELECT
                    payments.id AS payment_id,
                    payments.patient_id,
                    payments.accounting_date
                FROM billing.payments
                ${joinQuery} `;

            if (whereQuery.length) {
                query += ` WHERE ${whereQuery.join(' AND ')} `;
            }

            query += ` ORDER BY payments.id `;
            return query;
        }

        return await query(sql);
    },

    getPayment: async function (params) {

        let { id } = params;

        const sql = `SELECT
                          payments.id
                        , payments.facility_id
                        , patient_id
                        , ref_provider.full_name AS provider_full_name
                        , insurance_name AS insurance_name
                        , provider_groups.group_name AS ordering_facility_name
                        , patients.full_name as patient_name
                        , patients.account_no
                        , insurance_provider_id
                        , payments.provider_group_id
                        , provider_contact_id
                        , payment_reason_id
                        , amount MONEY
                        , accounting_date::text
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
                        , billing.payments.XMIN as payment_row_version
                    FROM billing.payments
                    INNER JOIN public.users ON users.id = payments.created_by
                    LEFT JOIN public.patients ON patients.id = payments.patient_id
                    LEFT JOIN public.facilities ON facilities.id = payments.facility_id
                    LEFT JOIN public.insurance_providers ON insurance_providers.id = payments.insurance_provider_id
                    LEFT JOIN provider_groups ON provider_groups.id = payments.provider_group_id
                    -- LEFT JOIN public.providers ON providers.id = payments.provider_contact_id
                    LEFT JOIN public.provider_contacts ON provider_contacts.id = payments.provider_contact_id
                    LEFT JOIN public.providers ref_provider ON provider_contacts.provider_id = ref_provider.id

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
            credit_card_number,
            payment_row_version,
            screenName,
            moduleName,
            clientIp,
            logDescription } = params;

        payer_type = payer_type == 'provider' ? 'ordering_provider' : payer_type;
        facility_id = facility_id != 0 ? facility_id : null;

        if (paymentId) {
            logDescription = `Payment updated with $${amount}  Payment Id as a  `;
        }
        else {
            logDescription = `Created Payment with $${amount} Payment Id as a `;
        }

        const sql = SQL`WITH insert_data as
                        ( INSERT INTO billing.payments
                            (   company_id
                                , facility_id
                                , patient_id
                                , insurance_provider_id
                                , provider_group_id
                                , provider_contact_id
                                , payment_reason_id
                                , amount
                                , accounting_date
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
                                , timezone(get_facility_tz(${facility_id}), now()::timestamp)
                                , ${invoice_no}
                                , ${display_id}
                                , ${payer_type}
                                , ${notes}
                                , ${payment_mode}
                                , ${credit_card_name}
                                , ${credit_card_number}
                            WHERE NOT EXISTS( SELECT 1 FROM billing.payments where id = ${paymentId})
                            RETURNING *, '{}'::jsonb old_values),
                            payment_update AS(UPDATE billing.payments SET
                                facility_id = ${facility_id}
                                , patient_id = ${patient_id}
                                , insurance_provider_id = ${insurance_provider_id}
                                , provider_group_id = ${provider_group_id}
                                , provider_contact_id = ${provider_contact_id}
                                , amount = ${amount}::money
                                , accounting_date = ${accounting_date}
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
                                AND NOT EXISTS(SELECT 1 FROM insert_data)
                                AND (SELECT (SELECT xmin as claim_row_version from billing.payments WHERE id = ${paymentId}) =  ${payment_row_version})
                                RETURNING *,
                                (
                                    SELECT row_to_json(old_row)
                                    FROM   (SELECT *
                                            FROM   billing.payments
                                            WHERE  id = ${paymentId}) old_row
                                ) old_values
                            ),
                            insert_audit_cte AS(
                                SELECT billing.create_audit(
                                    company_id
                                  , ${screenName}
                                  , id
                                  , ${screenName}
                                  , ${moduleName}
                                  , ${logDescription} || id
                                  , ${clientIp}
                                  , json_build_object(
                                      'old_values', COALESCE(old_values, '{}'),
                                      'new_values', (SELECT row_to_json(temp_row)::jsonb - 'old_values'::text FROM (SELECT * FROM insert_data) temp_row)
                                    )::jsonb
                                  , ${user_id}
                                ) AS id
                                FROM insert_data
                                WHERE id IS NOT NULL
                            ),
                            update_audit_cte as(
                                SELECT billing.create_audit(
                                    company_id
                                  , ${screenName}
                                  , id
                                  , ${screenName}
                                  , ${moduleName}
                                  , ${logDescription} || id
                                  , ${clientIp}
                                  , json_build_object(
                                      'old_values', COALESCE(old_values, '{}'),
                                      'new_values', (SELECT row_to_json(temp_row)::jsonb - 'old_values'::text FROM (SELECT * FROM payment_update) temp_row)
                                    )::jsonb
                                  , ${user_id}
                                ) AS id
                                FROM payment_update
                                WHERE id IS NOT NULL
                            )
                            SELECT id from insert_data
                            UNION
                            SELECT id from payment_update
                            UNION
                            SELECT id from insert_audit_cte
                            UNION
                            SELECT id from update_audit_cte `;

        return await query(sql);
    },

    deletePayment: async function (params) {

        let {
            payment_id,
            auditDetails } = params;

        const sql = SQL` SELECT billing.purge_payment (${payment_id}, (${JSON.stringify(auditDetails)})::jsonb) AS details`;

        return await query(sql);
    },

    createPaymentapplications: async function (params) {
        let { user_id,
            paymentId,
            is_claimDenied,
            line_items,
            adjustmentId,
            auditDetails,
            logDescription,
            is_payerChanged } = params;

        adjustmentId = adjustmentId || null;
        logDescription = `Claim updated Id : ${params.claimId}`;

        const sql = SQL`WITH claim_comment_details AS(
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
                                SELECT billing.create_payment_applications(${paymentId},${adjustmentId},${user_id},(${line_items})::jsonb,(${JSON.stringify(auditDetails)})::jsonb) AS details
                             ),
                             update_claims AS(
                                    UPDATE billing.claims
                                    SET
                                        billing_notes = ${params.billingNotes}
                                      , payer_type =(
                                                    CASE
                                                        WHEN ${is_payerChanged} AND NOT ${is_claimDenied} THEN ${params.payerType}
                                                    ELSE payer_type
                                                    END
                                                    )
                                    WHERE
                                        id = ${params.claimId}
                                    RETURNING *,
                                    (
                                        SELECT row_to_json(old_row)
                                        FROM   (SELECT *
                                            FROM   billing.claims
                                            WHERE  id = ${params.claimId}) old_row
                                    ) old_values
                            ),
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
                                    FROM claim_comment_details
                                    RETURNING *, '{}'::jsonb old_values
                            ),
                            update_claims_audit_cte as(
                                SELECT billing.create_audit(
                                    ${auditDetails.company_id}
                                    , ${auditDetails.screen_name}
                                    , id
                                    , ${auditDetails.screen_name}
                                    , ${auditDetails.module_name}
                                    , ${logDescription}
                                    , ${auditDetails.client_ip}
                                    , json_build_object(
                                        'old_values', COALESCE(old_values, '{}'),
                                        'new_values', (SELECT row_to_json(temp_row)::jsonb - 'old_values'::text FROM (SELECT * FROM update_claims) temp_row)
                                    )::jsonb
                                    , ${user_id}
                                ) AS id
                                FROM update_claims
                                WHERE id IS NOT NULL
                            ),
                            insert_claim_comment_audit_cte as(
                                SELECT billing.create_audit(
                                    ${auditDetails.company_id}
                                    , ${auditDetails.screen_name}
                                    , id
                                    , ${auditDetails.screen_name}
                                    , ${auditDetails.module_name}
                                    , 'Claim Comments inserted AS ' || ${params.claimCommentDetails}
                                    , ${auditDetails.client_ip}
                                    , json_build_object(
                                        'old_values', COALESCE(old_values, '{}'),
                                        'new_values', (${params.claimCommentDetails})::text
                                    )::jsonb
                                    , ${user_id}
                                ) AS id
                                FROM insert_calim_comments
                                WHERE id IS NOT NULL
                            ),
                            change_responsible_party AS (
                                    SELECT billing.change_responsible_party(${params.claimId},0,${params.companyId},null, ${params.claimStatusID}, ${is_payerChanged}) AS result
                            ),
                            create_audit_study_status AS (
                                SELECT billing.create_audit(
                                      ${auditDetails.company_id}
                                    , ${auditDetails.screen_name}
                                    , id
                                    , ${auditDetails.screen_name}
                                    , ${auditDetails.module_name}
                                    , 'Claim Status '|| ${params.claimId} || ' manually changed by user ( ' || ${user_id} || ' ) to Claim status id  ' || ${params.claimStatusID}
                                    , ${auditDetails.client_ip}
                                    , json_build_object(
                                        'old_values', '{}',
                                        'new_values', '{}'
                                    )::jsonb
                                    , ${user_id}
                                ) AS id
                                FROM update_claims
                                WHERE id IS NOT NULL AND ${params.claimStatusID} != 0
                            )
                            SELECT details,null,null FROM insert_application
                            UNION ALL
                            SELECT null,id,null FROM update_claims_audit_cte
                            UNION ALL
                            SELECT null,id,null FROM insert_claim_comment_audit_cte
                            UNION ALL
                            SELECT null,null,result::text FROM change_responsible_party
                            UNION ALL
                            SELECT null, id, null FROM create_audit_study_status`;

        return await query(sql);
    },

    getRecoupmentDetails : async function(adjustment_code_id)
    {
        const sql = SQL`SELECT
                            coalesce(accounting_entry_type = 'recoupment_debit', false) AS is_recoupment_debit
                        FROM billing.adjustment_codes
                        WHERE id = nullif(${adjustment_code_id},'')::bigint`;

        let result = await query(sql);

        if (result.rowCount != 0) {
            result = result.rows[0].is_recoupment_debit;
        } else {
            result = false;
        }

        return result;
    },

    updatePaymentApplication: async function (params) {

        let logDescription = ` Payment application updated for claim id : ${params.claimId} For payment id : `;

        const sql = SQL`WITH update_application_details AS(
                            SELECT
                                payment_application_id
                              , amount
                              , adjustment_id
                              , charge_id
                              , parent_application_id
                              , parent_applied_dt
                              , is_recoupment
                            FROM json_to_recordset(${JSON.stringify(params.updateAppliedPayments)}) AS details(
                               payment_application_id BIGINT
                             , amount MONEY
                             , adjustment_id BIGINT
                             , charge_id BIGINT
                             , parent_application_id BIGINT
                             , parent_applied_dt TIMESTAMPTZ
                             , is_recoupment BOOLEAN)),
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
                        cas_application_details AS(
                                SELECT
                                    cas_id
                                  , group_code_id
                                  , reason_code_id
                                  , payment_application_id
                                  , amount
                                  , parent_application_id
                                FROM json_to_recordset(${JSON.stringify(params.save_cas_details)}) AS details(
                                    cas_id BIGINT
                                  , group_code_id BIGINT
                                  , reason_code_id BIGINT
                                  , payment_application_id BIGINT
                                  , amount MONEY
                                  , parent_application_id BIGINT)
                                ),
                        update_applications AS(
                            UPDATE billing.payment_applications
                                SET
                                    amount = uad.amount
                                  , adjustment_code_id = uad.adjustment_id
                            FROM update_application_details uad
                            WHERE id = uad.payment_application_id
                            RETURNING *,
                            (
                                SELECT row_to_json(old_row)
                                FROM   (SELECT *
                                    FROM   billing.payment_applications
                                    WHERE  id = uad.payment_application_id) old_row
                            ) old_value),
                        insert_applications AS(
                            INSERT INTO billing.payment_applications(
                                payment_id,
                                charge_id,
                                amount_type,
                                amount,
                                adjustment_code_id,
                                created_by,
                                applied_dt
                            )
                            SELECT
                                  ${params.paymentId}
                                , charge_id
                                , 'adjustment'
                                , amount
                                , adjustment_id
                                , ${params.userId}
                                , parent_applied_dt
                            FROM update_application_details
                            WHERE  payment_application_id is null and (amount != 0::money OR is_recoupment)
                            RETURNING *
                        ),
                        update_claim_details AS(
                            UPDATE billing.claims
                            SET
                                billing_notes = ${params.billingNotes}
                                , payer_type =(
                                    CASE
                                        WHEN ${params.is_payerChanged} AND NOT ${params.is_claimDenied} THEN ${params.payerType}
                                    ELSE payer_type
                                    END
                                    )
                            WHERE
                                id = ${params.claimId}
                            RETURNING *,
                            (
                                SELECT row_to_json(old_row)
                                FROM   (SELECT *
                                    FROM   billing.claims
                                    WHERE  id = ${params.claimId}) old_row
                            ) old_value),
                        update_claim_comments AS(
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
                            FROM claim_comment_details
                            RETURNING *, '{}'::jsonb old_values),
                            change_responsible_party AS (
                                    SELECT billing.change_responsible_party(${params.claimId},0,${params.companyId},null, ${params.claimStatusID}, ${params.is_payerChanged}) AS result
                            ),
                        update_cas_application AS(
                                    UPDATE billing.cas_payment_application_details bcpad
                                        SET
                                            cas_group_code_id = cad.group_code_id
                                          , cas_reason_code_id = cad.reason_code_id
                                          , amount = cad.amount
                                    FROM cas_application_details cad
                                    WHERE bcpad.id = cad.cas_id
                                    RETURNING *,
                                    (
                                        SELECT row_to_json(old_row)
                                        FROM   (SELECT *
                                            FROM   billing.cas_payment_application_details
                                            WHERE  id = cad.cas_id) old_row
                                    ) old_values
                                ),
                        purge_cas_details as (
                            DELETE FROM billing.cas_payment_application_details
                            WHERE id = ANY (${(JSON.parse(params.casDeleted)).map(Number)})
                            ),
                            update_applications_audit_cte as(
                                SELECT billing.create_audit(
                                    ${params.companyId}
                                    , ${params.entityName}
                                    , id
                                    , ${params.screenName}
                                    , ${params.moduleName}
                                    , ${logDescription} || payment_id
                                    , ${params.clientIp}
                                    , json_build_object(
                                        'old_values', COALESCE(old_value, '{}'),
                                        'new_values', (SELECT row_to_json(temp_row)::jsonb - 'old_values'::text FROM (SELECT * FROM update_applications limit 1) temp_row)
                                    )::jsonb
                                    , ${params.userId}
                                ) AS id
                                FROM update_applications
                                WHERE id IS NOT NULL
                            ),
                            update_claims_audit_cte as(
                                SELECT billing.create_audit(
                                    ${params.companyId}
                                    , 'claims'
                                    , id
                                    , ${params.screenName}
                                    , ${params.moduleName}
                                    , 'Claim updated id :' || id
                                    , ${params.clientIp}
                                    , json_build_object(
                                        'old_values', COALESCE(old_value, '{}'),
                                        'new_values', (SELECT row_to_json(temp_row)::jsonb - 'old_values'::text FROM (SELECT * FROM update_claim_details) temp_row)
                                    )::jsonb
                                    , ${params.userId}
                                ) AS id
                                FROM update_claim_details
                                WHERE id IS NOT NULL
                            ),
                            insert_claim_comment_audit_cte as(
                                SELECT billing.create_audit(
                                    ${params.companyId}
                                    ,'claim_comments'
                                    , id
                                    , ${params.screenName}
                                    , ${params.moduleName}
                                    , 'Claim Comments inserted AS ' || ${params.claimCommentDetails}
                                    , ${params.clientIp}
                                    , json_build_object(
                                        'old_values', COALESCE(old_values, '{}'),
                                        'new_values', (${params.claimCommentDetails})::text
                                    )::jsonb
                                    , ${params.userId}
                                ) AS id
                                FROM update_claim_comments
                                WHERE id IS NOT NULL
                            ),
                            update_cas_applications_audit as(
                                SELECT billing.create_audit(
                                    ${params.companyId}
                                    , 'cas_payment_application_details'
                                    , id
                                    , ${params.screenName}
                                    , ${params.moduleName}
                                    , 'Cas details Updated For payment id : ' || ${params.paymentId}
                                    , ${params.clientIp}
                                    , json_build_object(
                                        'old_values', COALESCE(old_values, '{}'),
                                        'new_values', (SELECT row_to_json(temp_row)::jsonb - 'old_values'::text FROM (SELECT * FROM update_cas_application limit 1) temp_row)
                                    )::jsonb
                                    , ${params.userId}
                                ) AS id
                                FROM update_cas_application
                                WHERE id IS NOT NULL
                            ),
                            create_audit_study_status AS (
                                SELECT billing.create_audit(
                                      ${params.companyId}
                                    , ${params.screenName}
                                    , id
                                    , ${params.screenName}
                                    , ${params.moduleName}
                                    , 'Claim Status '|| ${params.claimId} || ' manually changed by user ( ' || ${params.user_id} || ' ) to Claim status id  ' || ${params.claimStatusID}
                                    , ${params.clientIp}
                                    , json_build_object(
                                        'old_values', '{}',
                                        'new_values', '{}'
                                    )::jsonb
                                    , ${params.user_id}
                                ) AS id
                                FROM update_claims_audit_cte
                                WHERE id IS NOT NULL AND ${params.claimStatusID} != 0
                            )
                            SELECT id,null from update_applications_audit_cte
                            UNION
                            SELECT id,null from update_claims_audit_cte
                            UNION
                            SELECT id,null from insert_claim_comment_audit_cte
                            UNION
                            SELECT id,null from update_cas_applications_audit
                            UNION
                            SELECT null,result::text from change_responsible_party
                            UNION ALL
                            SELECT id, null FROM create_audit_study_status`;

        let result = await query(sql);

        let casInsertResult  = await this.insetCasApplications(params);

        if (casInsertResult.name === 'error') {
            return casInsertResult;
        }

        return result;
    },

    insetCasApplications: async function (params) {

        let sql = SQL`WITH cas_application_details AS(
                        SELECT
                            cas_id
                        , group_code_id
                        , reason_code_id
                        , payment_application_id
                        , amount
                        , parent_application_id
                        FROM json_to_recordset(${JSON.stringify(params.save_cas_details)}) AS details(
                            cas_id BIGINT
                        , group_code_id BIGINT
                        , reason_code_id BIGINT
                        , payment_application_id BIGINT
                        , amount MONEY
                        , parent_application_id BIGINT)
                        ),
                        insert_cas_applications AS (
                            INSERT INTO billing.cas_payment_application_details
                            (
                                payment_application_id
                              , cas_group_code_id
                              , cas_reason_code_id
                              , amount
                            )
                            SELECT
                                billing.get_cas_application_id(cas.parent_application_id)
                              , cas.group_code_id
                              , cas.reason_code_id
                              , cas.amount
                            FROM cas_application_details cas
                            WHERE cas.cas_id is null
                            AND parent_application_id IS NOT NULL
                            RETURNING *, '{}'::jsonb old_values
                        ),
                        insert_cas_applications_audit as(
                            SELECT billing.create_audit(
                                ${params.companyId}
                                , 'cas_payment_application_details'
                                , id
                                , ${params.screenName}
                                , ${params.moduleName}
                                , 'Cas details inserted For payment id : ' || ${params.paymentId}
                                , ${params.clientIp}
                                , json_build_object(
                                    'old_values', COALESCE(old_values, '{}'),
                                    'new_values', (SELECT row_to_json(temp_row)::jsonb - 'old_values'::text FROM (SELECT * FROM insert_cas_applications limit 1) temp_row)
                                )::jsonb
                                , ${params.userId}
                            ) AS id
                            FROM insert_cas_applications
                            WHERE id IS NOT NULL
                        )
                        SELECT id,null from insert_cas_applications_audit`;

        return await query(sql);
    },

    getAppliedAmount: async function (paymentId) {
        return await query(
            `
            WITH
                applied AS (
                    SELECT(SELECT
                        payments_applied_total
                    FROM
                        billing.get_payment_totals(${paymentId}))
                    AS applied
                ),
                balance AS (
                    SELECT(SELECT payment_balance_total
                    FROM
                        billing.get_payment_totals(${paymentId}))
                    AS balance
                )
                SELECT * FROM applied, balance
        `
        );
    },

    getClaimCharges: async function (params) {

        let {
            invoice_no,
            paymentId,
            payer_type,
            payer_id
        } = params;

        let whereQuery = payer_type == 'patient' ? ` WHERE bc.patient_id = ${payer_id} ` : ` WHERE bc.invoice_no = ${invoice_no}::text `;

        const sql = SQL`WITH
                    claims_details AS (
                        SELECT
                            bc.id AS claim_id,
                            bc.patient_id,
                            bc.invoice_no,
                            bc.claim_dt
                        FROM billing.claims bc `;

        sql.append(whereQuery);

        sql.append(SQL` AND (SELECT charges_bill_fee_total - (payments_applied_total + adjustments_applied_total) FROM billing.get_claim_totals(bc.id)) > 0::money
                    )
                    , charges AS (
                        SELECT
                            c.id as charge_id
                            ,sum(c.bill_fee * c.units)       AS charges_bill_fee_total
                            ,(
                                SELECT
                                    ( coalesce(sum(pa.amount)   FILTER (WHERE pa.amount_type = 'payment'),0::money)  +
			                          coalesce(sum(pa.amount)   FILTER (WHERE pa.amount_type = 'adjustment'),0::money)
			                        ) as charge_applied_total
                                FROM
                                   billing.charges
                                   INNER JOIN billing.payment_applications AS pa ON pa.charge_id = charges.id
                                   INNER JOIN billing.payments AS p ON pa.payment_id = p.id
                                WHERE charges.id = c.id
                            )
                          , cd.claim_id
                          , cd.invoice_no
                          , cd.claim_dt
                          , cd.patient_id
                          , pc.display_code AS cpt_code
                        FROM
                            billing.charges AS c
                            INNER JOIN claims_details AS cd ON cd.claim_id = c.claim_id
                            INNER JOIN public.cpt_codes AS pc ON pc.id = c.cpt_id
                            GROUP BY
                            c.id
                            , cd.claim_id
                            , cd.patient_id
                            , cd.invoice_no
                            , cd.claim_dt
                            , pc.display_code
                    )
                SELECT
                    charges.* ,
                    ( charges_bill_fee_total - COALESCE(charge_applied_total,'0') )::numeric AS balance ,
                    ( SELECT payment_balance_total::numeric FROM billing.get_payment_totals(${paymentId}) ),
                    pp.account_no,
                    pp.prefix_name AS patient_prefix,
		            pp.first_name AS patient_fname,
		            pp.middle_name AS patient_mname,
		            pp.last_name AS patient_lname,
		            pp.suffix_name AS patient_suffix
                FROM
                    charges
                INNER JOIN public.patients pp on pp.id = charges.patient_id
                ORDER BY claim_id `);

        return await query(sql);
    },

    getInvoiceDetails: async function (params) {

        let {
            invoice_no,
            paymentId,
            payer_type,
            payer_id
        } = params;

        let whereQuery = payer_type == 'patient' ? ` WHERE bc.patient_id = ${payer_id} ` : ` WHERE bc.invoice_no = ${invoice_no}::text `;

        const sql = SQL`
            SELECT
                bch.id as charge_id,
                bc.id as claim_id,
                (sum(bch.bill_fee * bch.units) - (
                    SELECT
                        ( coalesce(sum(pa.amount)   FILTER (WHERE pa.amount_type = 'payment'),0::money)  +
                          coalesce(sum(pa.amount)   FILTER (WHERE pa.amount_type = 'adjustment'),0::money)
                        ) as charge_applied_total
                    FROM
                        billing.charges
                        INNER JOIN billing.payment_applications AS pa ON pa.charge_id = charges.id
                        INNER JOIN billing.payments AS p ON pa.payment_id = p.id
                    WHERE charges.id = bch.id
                    ))::numeric  AS balance
                ,(SELECT payment_balance_total::numeric FROM billing.get_payment_totals(${paymentId}))
                ,(SELECT count(1) FROM billing.claims bc `; // WHERE ${whereQuery} ) AS total_claims
        sql.append(whereQuery);

        sql.append(SQL` ) AS total_claims
            FROM
                billing.claims bc
            INNER JOIN public.patients pp on pp.id = bc.patient_id
            INNER JOIN billing.charges bch on bch.claim_id = bc.id
            INNER JOIN public.cpt_codes pcc on pcc.id = bch.cpt_id `);

        sql.append(whereQuery);

        sql.append(SQL` AND (SELECT charges_bill_fee_total - (payments_applied_total + adjustments_applied_total) FROM billing.get_claim_totals(bc.id)) > 0::money GROUP BY bch.id,bc.id ORDER BY bc.id `);

        return await query(sql);
    },

    getStudyCpt:async function (params) {
        let {
            payerId,
            cpt_code,
            sortField,
            sortOrder,
            study_dt,
            accession_no,
            study_description,
            customDt
        } = params;

        params.sortOrder = params.sortOrder || ' ASC';

        let sql = SQL` SELECT
                               studies.id
                             , studies.accession_no
                             , studies.study_description
                             , studies.study_dt
                             , studies.facility_id
                             , cc.cpt_code
                        FROM studies
                        INNER JOIN orders o ON studies.order_id = o.id
                        JOIN lateral(
                                        SELECT
                                             study_id
                                            , array_agg(scp.cpt_code) AS cpt_code
                                        FROM study_cpt scp
                                        WHERE NOT scp.has_deleted
                                        GROUP BY study_id
                                      ) cc ON cc.study_id = studies.id
                        WHERE o.patient_id = ${payerId}
                           AND NOT o.has_deleted
                           AND o.order_status NOT IN ('CAN','NOS')
                           AND studies.study_status NOT IN ('CAN','NOS')
                        `;

        if(study_dt){
            sql.append(` AND `)
                .append(generator('study_dt', study_dt));
        }
        else if(customDt){
            sql.append(` AND `)
                .append(generator('study_dt', customDt));
        }

        if (accession_no){
            sql.append(` AND  accession_no ILIKE '%${accession_no}%' `);
        }

        if(study_description){
            sql.append(` AND study_description ILIKE '%${study_description}%'`);
        }


        if (cpt_code){
            sql.append(` AND array_to_string(cc.cpt_code, ', ') LIKE '%${cpt_code}%' `);
        }

        sql.append(SQL` ORDER BY  `)
            .append(sortField)
            .append(' ')
            .append(sortOrder);

        return await query(sql);
    },

    getTOSPaymentDetails: async function (params) {

        const paymentquery = await this.getPayments(params);

        const sql = SQL`WITH
                        payment_details AS ( `;

        sql.append(paymentquery);

        sql.append(SQL` )
	                    ,claims_details AS (
                            SELECT
                                bc.id AS claim_id,
                                bc.patient_id,
                                bc.invoice_no,
                                bc.claim_dt,
                                pd.payment_id
                            FROM billing.claims bc
                            INNER JOIN payment_details pd ON pd.patient_id = bc.patient_id
                            INNER JOIN billing.get_claim_totals(bc.id) ON true
                            WHERE
                                (charges_bill_fee_total - (payments_applied_total + adjustments_applied_total)) > 0::money
                                AND bc.claim_dt::date = pd.accounting_date
                        )
                        , charges AS (
                            SELECT
                                c.id as charge_id,
                                SUM(c.bill_fee * c.units) AS charges_bill_fee_total,
                                SUM(other_payment + other_adjustment) AS charge_applied_total ,
                                cd.claim_id,
                                cd.invoice_no,
                                cd.claim_dt,
                                cd.patient_id,
                                pc.display_code AS cpt_code,
                                cd.payment_id
                            FROM
                                billing.charges AS c
                                INNER JOIN claims_details AS cd ON cd.claim_id = c.claim_id
                                INNER JOIN billing.get_charge_other_payment_adjustment(c.id) ON true
                                INNER JOIN public.cpt_codes AS pc ON pc.id = c.cpt_id
                                GROUP BY
                                c.id
                                , cd.claim_id
                                , cd.patient_id
                                , cd.invoice_no
                                , cd.claim_dt
                                , pc.display_code
                                , cd.payment_id
                        )
                        SELECT
                            charges.* ,
                            ( charges_bill_fee_total - COALESCE(charge_applied_total,'0') )::numeric AS balance,
                            payment_balance_total::numeric,
                            pp.account_no,
                            pp.prefix_name AS patient_prefix,
                            pp.first_name AS patient_fname,
                            pp.middle_name AS patient_mname,
                            pp.last_name AS patient_lname,
                            pp.suffix_name AS patient_suffix
                        FROM
                            charges
                        INNER JOIN public.patients pp on pp.id = charges.patient_id
                        INNER JOIN billing.get_payment_totals(charges.payment_id) ON true
                        ORDER BY claim_id, charge_id `);

        return await query(sql);
    },

    getPatientClaims: async function (params) {
        let {
            patient_id,
            write_off_amount,
            billing_provider_id
        } = params;
        let sql = ' ';

        if (params.from === 'claim_instance') {

            sql = SQL`SELECT
                        bgct.charges_bill_fee_total,
                        bgct.claim_balance_total,
                        claims.id
                      FROM
		                billing.claims
		                INNER JOIN patients p ON p.id = claims.patient_id
                        INNER JOIN LATERAL billing.get_claim_totals(claims.id) bgct ON TRUE
                        WHERE p.id = ${patient_id} `;
        } else {

            sql = SQL`WITH
            claim_payments AS (
                SELECT
                    sum(bgct.claim_balance_total) AS patient_balance ,
                    claims.patient_id
                FROM
                billing.claims
                INNER JOIN patients p ON p.id = claims.patient_id
                INNER JOIN LATERAL billing.get_claim_totals(claims.id) bgct ON TRUE
                WHERE claims.billing_provider_id = ${billing_provider_id}
                GROUP BY claims.patient_id
            )
            SELECT
                cp.patient_balance,
                p.birth_date::text AS dob,
                p.account_no,
                p.gender,
                p.id,
                get_full_name(p.last_name,p.first_name,p.middle_name,p.prefix_name,p.suffix_name) AS patient_name,
                COUNT(1) OVER (range unbounded preceding) AS total_records

            FROM
            claim_payments cp
            INNER JOIN patients p ON p.id = cp.patient_id
            where cp.patient_balance <= ${write_off_amount}::money AND  cp.patient_balance > 0::money
            `;

            sql.append(SQL` ORDER BY  `)
                .append(params.sortField)
                .append(' ')
                .append(params.sortOrder)
                .append(SQL` LIMIT ${params.pageSize}`)
                .append(SQL` OFFSET ${((params.pageNo * params.pageSize) - params.pageSize)}`);
        }

        return await query(sql);

    }
};
