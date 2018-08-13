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
            accounting_dt,
            amount,
            available_balance,
            applied,
            adjustment_amount,
            user_full_name,
            payment_mode,
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
            default_facility_id
        } = params;

        if (fromDate && toDate) {
            whereQuery.push(`${filterByDateType} BETWEEN  '${fromDate}'::date AND '${toDate}'::date`);
        }

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
            whereQuery.push(generator('payment_dt', payment_dt));
        }

        if (accounting_dt) {
            whereQuery.push(generator('accounting_dt', accounting_dt));
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

        if (facility_name) {
            whereQuery.push(`facility_name  ILIKE '%${facility_name}%' `);
        }

        if (from == 'patient_claim') {
            whereQuery.push(` patient_id = ${patientID} AND ( SELECT payment_status from billing.get_payment_totals(payments.id)) = 'unapplied' `);
        }

        let joinQuery = `
            INNER JOIN public.users ON users.id = payments.created_by
            LEFT JOIN public.patients ON patients.id = payments.patient_id
            LEFT JOIN public.provider_groups ON provider_groups.id = payments.provider_group_id
            LEFT JOIN public.provider_contacts ON provider_contacts.id = payments.provider_contact_id
            LEFT JOIN public.providers ref_provider ON provider_contacts.provider_id = ref_provider.id
            LEFT JOIN public.insurance_providers  ON insurance_providers.id = payments.insurance_provider_id
            LEFT JOIN LATERAL (select * from billing.get_payment_totals(payments.id)) payment_totals  ON true
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
                    , accounting_dt
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
                    , payment_totals.payment_status AS current_status
                FROM billing.payments`;

        sql.append(joinQuery);

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
                                , timezone(public.get_facility_tz(${facility_id}), ${accounting_date}::TIMESTAMP)
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
                                , accounting_dt = timezone(public.get_facility_tz(${facility_id}), ${accounting_date}::TIMESTAMP)
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
            line_items,
            adjustmentId,
            auditDetails,
            logDescription } = params;
        adjustmentId = adjustmentId ? adjustmentId : null;
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
                                      , payer_type = ${params.payerType}
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
                                    SELECT billing.change_responsible_party(${params.claimId},0,${params.companyId},null) AS result
                            )
                            SELECT details,null,null FROM insert_application
                            UNION ALL
                            SELECT null,id,null FROM update_claims_audit_cte
                            UNION ALL
                            SELECT null,id,null FROM insert_claim_comment_audit_cte
                            UNION ALL
                            SELECT null,null,result::text FROM change_responsible_party`;

        return await query(sql);
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
                            FROM json_to_recordset(${JSON.stringify(params.updateAppliedPayments)}) AS details(
                               payment_application_id BIGINT
                             , amount MONEY
                             , adjustment_id BIGINT
                             , charge_id BIGINT
                            , parent_application_id BIGINT
                            , parent_applied_dt TIMESTAMPTZ)),
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
                            WHERE  payment_application_id is null and amount != 0::money
                            RETURNING *
                        ),
                        update_claim_details AS(
                            UPDATE billing.claims
                            SET
                                billing_notes = ${params.billingNotes}
                              , payer_type = ${params.payerType}
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
                                    SELECT billing.change_responsible_party(${params.claimId},0,${params.companyId},null) AS result
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
                            )
                            SELECT id,null from update_applications_audit_cte
                            UNION
                            SELECT id,null from update_claims_audit_cte
                            UNION
                            SELECT id,null from insert_claim_comment_audit_cte
                            UNION
                            SELECT id,null from update_cas_applications_audit
                            UNION
                            SELECT id,null from insert_cas_applications_audit
                            UNION
                            SELECT null,result::text from change_responsible_party`;

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
    }

};
