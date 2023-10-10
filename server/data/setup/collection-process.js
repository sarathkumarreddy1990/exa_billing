const { query, SQL, queryWithAudit } = require('../index');
const logger = require('../../../logger');

const acr = {

    getData: async function ({ companyId }) {

        const sql = SQL`
            SELECT
                 cps.id
                , cps.company_id
                , cps.acr_claim_status_id
                , cps.acr_min_balance_amount::numeric
                , cps.acr_claim_status_statement_days
                , cps.acr_write_off_debit_adjustment_code_id
                , cps.acr_write_off_credit_adjustment_code_id
                , cps.acr_claim_status_statement_count
                , cps.acr_claim_status_last_payment_days
                ,JSON_BUILD_OBJECT(
                   'debit_adj_code', adj_d.code,
                   'debit_adj_desc', adj_d.description,
                   'credit_adj_code',adj_c.code,
                   'credit_adj_desc',adj_c.description
                ) AS adjustment_info
            FROM   billing.company_settings cps
            LEFT JOIN billing.adjustment_codes adj_d ON adj_d.id = cps.acr_write_off_debit_adjustment_code_id
            LEFT JOIN billing.adjustment_codes adj_c ON adj_c.id = cps.acr_write_off_credit_adjustment_code_id
            WHERE
                cps.company_id = ${companyId}`;

        return await query(sql);

    },

    create: async function (params) {

        let {
            userId,
            companyId,
            acrStatementDays,
            acrStatementCount,
            acrLastPaymentDays,
            minimumAccountBalance,
            writeOffDebitAdjCodeId,
            writeOffCreditAdjCodeId,
        } = params;

        const sql = SQL`INSERT INTO billing.company_settings (
                            company_id,
                            acr_claim_status_id,
                            acr_min_balance_amount,
                            acr_write_off_debit_adjustment_code_id,
                            acr_write_off_credit_adjustment_code_id,
                            acr_claim_status_statement_days,
                            acr_claim_status_statement_count,
                            acr_claim_status_last_payment_days
                        )
                        SELECT
                            ${companyId}
                            , (SELECT id FROM billing.claim_status WHERE company_id = ${companyId} and code = 'CR' and description = 'Collections Review')
                            , ${minimumAccountBalance}
                            , ${writeOffDebitAdjCodeId || null}
                            , ${writeOffCreditAdjCodeId || null}
                            , ${acrStatementDays  || null}
                            , ${acrStatementCount || null}
                            , ${acrLastPaymentDays || null}
                        WHERE NOT EXISTS (
                            SELECT 1 FROM billing.company_settings WHERE company_id = ${companyId}
                        )
                        RETURNING *, '{}'::jsonb old_values `;

        return await queryWithAudit(sql, {
            ...params,
            logDescription: `New: Automatic collections review createdBy ${userId}`
        });
    },

    update: async function (params) {

        let {
            userId,
            companyId,
            acrStatementDays,
            acrStatementCount,
            acrLastPaymentDays,
            minimumAccountBalance,
            writeOffDebitAdjCodeId,
            writeOffCreditAdjCodeId,
        } = params;

        const sql = SQL`UPDATE
                            billing.company_settings
                        SET
                            acr_min_balance_amount  = ${minimumAccountBalance},
                            acr_write_off_debit_adjustment_code_id  = ${writeOffDebitAdjCodeId || null},
                            acr_write_off_credit_adjustment_code_id = ${writeOffCreditAdjCodeId || null},
                            acr_claim_status_statement_days  = ${acrStatementDays || null},
                            acr_claim_status_statement_count  = ${acrStatementCount || null},
                            acr_claim_status_last_payment_days = ${acrLastPaymentDays || null}
                        WHERE
                            company_id = ${companyId}
                            RETURNING *,
                            (
                                SELECT row_to_json(old_row)
                                FROM( SELECT *
                                        FROM   billing.company_settings
                                        WHERE  company_id = ${companyId}
                                    ) old_row
                            ) old_values`;

        return await queryWithAudit(sql, {
            ...params,
            logDescription: `Update: Automatic collections review updatedBy ${userId}`
        });
    },

    delete: async (params) => {
        const {
            userId,
            companyId
        } = params;

        const sql = SQL`DELETE FROM
                            billing.company_settings
                        WHERE company_id = ${companyId}
                        RETURNING *, '{}'::jsonb old_values`;

        return await queryWithAudit(sql, {
            ...params,
            logDescription: `Deleted: Automatic collections review deletedBy ${userId}`
        });
    },

    autoCollectionsProcess: async (params) => {
        let {
            userId = 1, // called from cron, so default userId assigned
            ip,
            companyId,
            screenName = 'AutoCollectionReview',
            moduleName = 'payments',
        } = params;

        let auditDetails = {
            company_id: companyId,
            screen_name: 'Payments',
            module_name: moduleName,
            client_ip: ip,
            user_id: parseInt(userId)
        };
        let companySettings = await acr.getData(params);

        if (companySettings instanceof Error) {
            logger.error('Unable to fetch acr company settings! ', companySettings);
            return {
                status: 'ERROR',
                error: companySettings
            };
        }

        if (companySettings && !companySettings.rowCount) {
            return {
                status: 'Not Configured',
                error: null
            };
        }

        let {
            acr_claim_status_id = null
            , acr_min_balance_amount = null
            , acr_claim_status_statement_days = null
            , acr_write_off_debit_adjustment_code_id = null
            , acr_write_off_credit_adjustment_code_id = null
            , acr_claim_status_statement_count = null
            , acr_claim_status_last_payment_days = null
        } = companySettings.rowCount && companySettings.rows[0] || {};

        let writeOffQuery = '';
        let selectResult = SQL`
          SELECT null, null, id::text FROM update_status
           UNION ALL
          SELECT null, null, id::text FROM insert_claim_comment_audit_cte `;

        if (acr_write_off_debit_adjustment_code_id && acr_write_off_credit_adjustment_code_id) {
            writeOffQuery = SQL`
                -- --------------------------------------------------------------------------------------------------------------
                -- Filter collection_claim_ids to apply write-off adjustment
                -- --------------------------------------------------------------------------------------------------------------
                , write_off_claims AS (
                    SELECT
                        p.id AS patient_id
                        ,ARRAY_AGG(claims.id)  AS collection_claim_ids
                    FROM
                        billing.claims
                    INNER JOIN patients p ON p.id = claims.patient_id
                    INNER JOIN billing.claim_status cs ON cs.id = claims.claim_status_id
                    INNER JOIN billing.get_claim_totals(claims.id) gct ON TRUE
                    WHERE cs.code = 'CIC'
                    AND gct.claim_balance_total != 0::money
                    GROUP BY p.id
                    ORDER BY p.id DESC
                )
                -- --------------------------------------------------------------------------------------------------------------
                -- Create payments for write-off adjustment
                -- --------------------------------------------------------------------------------------------------------------
                , insert_payment AS (
                    INSERT INTO billing.payments
                        (   company_id
                            , patient_id
                            , amount
                            , accounting_date
                            , created_by
                            , payment_dt
                            , payer_type
                            , notes
                            , mode
                            , facility_id
                        )
                        SELECT
                            ${companyId} AS company_id
                            , woc.patient_id
                            , 0::money AS amount
                            , CURRENT_DATE AS accounting_date
                            , ${userId} AS created_by
                            , timezone(get_facility_tz(pf.facility_id), now()::timestamp) AS payment_dt
                            , 'patient' AS payer_type
                            , 'Auto collections review write-off is $' || ${acr_min_balance_amount} AS notes
                            , 'adjustment' AS payment_mode
                            , pf.facility_id
                        FROM
                            write_off_claims woc
                        INNER JOIN patient_facilities pf ON pf.patient_id = woc.patient_id AND pf.is_default
                    RETURNING
                        id
                        , company_id
                        , patient_id
                        , amount
                        , accounting_date
                        , created_by
                        , payment_dt
                        , payer_type
                        , notes
                        , mode
                        , facility_id
                        , '{}'::jsonb old_values
                )
                -- --------------------------------------------------------------------------------------------------------------
                -- Audit log for payment creation
                -- --------------------------------------------------------------------------------------------------------------
                , insert_audit_cte AS(
                    SELECT billing.create_audit(
                        company_id
                    , ${auditDetails.screen_name}
                    , id
                    , ${screenName}
                    , ${moduleName}
                    , 'Created Payment with ' || amount ||' Payment Id is ' || id
                    , ${ip}
                    , jsonb_build_object(
                        'old_values', COALESCE(old_values, '{}'),
                        'new_values', (
                                jsonb_build_object(
                                    'mode', mode,
                                    'notes', notes,
                                    'amount', amount ,
                                    'patient_id',patient_id,
                                    'company_id',company_id,
                                    'payer_type', payer_type,
                                    'payment_dt', payment_dt,
                                    'created_by', created_by,
                                    'facility_id', facility_id,
                                    'accounting_date', accounting_date
                                    ) - 'old_values'::text
                                )
                        )
                    , ${userId}
                    ) AS id
                    FROM
                        insert_payment
                    WHERE id IS NOT NULL
                )
                -- --------------------------------------------------------------------------------------------------------------
                -- Formatting charge lineItems for create payment application records
                -- Prepare charge payment list for claims which is in claims_status = 'Claim in collection'
                -- --------------------------------------------------------------------------------------------------------------
                , claim_charges AS (
                    SELECT
                        claims.id AS claim_id
                        , claims.patient_id
                        , ip.id AS payment_id
                        , cs.code AS claim_status_code
                        , bch.id AS charge_id
                        , 0::money AS payment
                        , ((bch.bill_fee * bch.units) - ( bgct.other_payment + bgct.other_adjustment )) AS adjustment
                        , '[]'::jsonb AS cas_details
                        , claim_details.claim_balance_total
                        , COALESCE (is_debit_adjustment, false) AS is_debit_adjustment
                    FROM
                        billing.claims
                    INNER JOIN insert_payment ip ON ip.patient_id = claims.patient_id
                    INNER JOIN billing.claim_status cs ON cs.id = claims.claim_status_id
                    INNER JOIN billing.charges bch ON bch.claim_id = claims.id
                    INNER JOIN public.cpt_codes pcc on pcc.id = bch.cpt_id
                    INNER JOIN LATERAL billing.get_charge_other_payment_adjustment(bch.id) bgct ON TRUE
                    LEFT JOIN billing.get_claim_totals(claims.id) claim_details ON TRUE
                    LEFT JOIN LATERAL (
                        SELECT
                            ((i_bch.bill_fee * i_bch.units) - ( i_bgct.other_payment + i_bgct.other_adjustment )) < 0::money AS is_debit_adjustment
                        FROM billing.charges i_bch
                        INNER JOIN LATERAL billing.get_charge_other_payment_adjustment(i_bch.id) i_bgct ON TRUE
                        WHERE i_bch.claim_id = claims.id
                        AND ( CASE WHEN ((i_bch.bill_fee * i_bch.units) - ( i_bgct.other_payment + i_bgct.other_adjustment )) < 0::money THEN true ELSE false END )
                    ) ida ON true
                    WHERE claim_details.claim_balance_total != 0::money
                    AND EXISTS (SELECT 1 FROM write_off_claims WHERE claims.id = ANY(collection_claim_ids))
                    ORDER BY claims.id ASC
                )
                -- --------------------------------------------------------------------------------------------------------------
                -- Getting same applied date for payment application
                -- --------------------------------------------------------------------------------------------------------------
                , claim_application_date AS (
                    SELECT
                        clock_timestamp() AS applied_dt,
                        claim_id
                    FROM
                    claim_charges
                    GROUP BY claim_id
                )
                -- --------------------------------------------------------------------------------------------------------------
                -- Formatting charge lineItems for credit adjustment. Create payment application
                -- --------------------------------------------------------------------------------------------------------------
                , credit_adjustment_charges AS (
                    SELECT
                    billing.create_payment_applications(
                        payment_id
                        , charge_id
                        , payment
                        , ( CASE WHEN adjustment > 0::money THEN adjustment ELSE 0::money END )
                        , ${acr_write_off_credit_adjustment_code_id}
                        , ${userId}
                        , cas_details
                        , (${JSON.stringify(auditDetails)})::jsonb
                        , now()
                        )  AS details
                    FROM
                        claim_charges
                    WHERE claim_balance_total > 0::money
                )
                -- --------------------------------------------------------------------------------------------------------------
                -- Formatting charge lineItems for debit adjustment. Create payment application
                -- --------------------------------------------------------------------------------------------------------------
                , debit_adjustment_charges AS (
                    SELECT
                    billing.create_payment_applications(
                        payment_id
                        , charge_id
                        , payment
                        , ( CASE WHEN adjustment < 0::money THEN adjustment ELSE 0::money END )
                        , ${acr_write_off_debit_adjustment_code_id}
                        , ${userId}
                        , cas_details
                        , (${JSON.stringify(auditDetails)})::jsonb
                        , cad.applied_dt
                        ) AS details
                    FROM
                        claim_charges
                    LEFT JOIN claim_application_date cad ON cad.claim_id = claim_charges.claim_id
                    WHERE (claim_balance_total < 0::money OR is_debit_adjustment)
                )
                -- --------------------------------------------------------------------------------------------------------------
                -- It will update responsible party, claim status for given claim.
                -- --------------------------------------------------------------------------------------------------------------
                , change_responsible_party AS (
                    SELECT
                        billing.update_claim_responsible_party(
                            claim_id
                            , 0
                            , ${companyId}
                            , null
                            , 0
                            , false
                            , 0
                            , null
                        ) AS result
                    FROM
                        claim_charges
                    WHERE claim_status_code NOT IN ('PV','PS')
                    GROUP BY claim_charges.claim_id
                )`;

            selectResult.append(`
                 UNION ALL
                SELECT null,null,id::text FROM insert_audit_cte
                 UNION ALL
                SELECT details::text,null,null FROM credit_adjustment_charges
                 UNION ALL
                SELECT details::text,null,null FROM debit_adjustment_charges
                 UNION ALL
                SELECT null,null,result::text FROM change_responsible_party `);
        }


        const sql = SQL`WITH
                -- --------------------------------------------------------------------------------------------------------------
                -- Getting patient claims based on Automatic Collections Review config
                -- --------------------------------------------------------------------------------------------------------------
                patient_details AS (
                    SELECT
                        p.id as patient_id
                        ,c.id as claim_id
                    FROM
                    billing.claims c
                    INNER JOIN patients p ON p.id = c.patient_id
                    LEFT JOIN LATERAL (
                        SELECT
                            timezone(get_facility_tz(c.facility_id::integer), created_dt)::DATE AS created_dt
                        FROM billing.claim_comments
                        WHERE claim_id = c.id
                        AND type = 'patient_statement'
                        ORDER BY created_dt ASC
                        LIMIT 1 OFFSET (${acr_claim_status_statement_count} - 1)
                    ) AS last_patient_statement ON TRUE
                    LEFT JOIN LATERAL (
                        SELECT
                            timezone(get_facility_tz(c.facility_id::integer), MAX(applied_dt))::DATE AS last_pat_payment_dt
                        FROM billing.charges AS ch
                        INNER JOIN billing.payment_applications AS pa ON pa.charge_id = ch.id
                        INNER JOIN billing.payments bp ON bp.id = pa.payment_id
                        WHERE ch.claim_id = c.id
                        AND pa.amount != 0::money
                        AND bp.payer_type = 'patient' -- consider only patient payments for last patient payment applied for the claim.
                    ) AS payment_details ON TRUE `;

        if (acr_claim_status_statement_count && acr_claim_status_statement_days && acr_claim_status_last_payment_days) {
            sql.append(`WHERE
                NOT ( CASE
                        WHEN  payment_details.last_pat_payment_dt IS NULL AND last_patient_statement.created_dt IS NULL THEN TRUE
                        WHEN  payment_details.last_pat_payment_dt IS NOT NULL THEN
                            CASE
                                WHEN
                                (
                                   last_patient_statement.created_dt IS NOT NULL AND ( payment_details.last_pat_payment_dt BETWEEN (last_patient_statement.created_dt) AND (last_patient_statement.created_dt + interval '${acr_claim_status_statement_days} days')::DATE )
                                ) OR
                                (
                                   last_patient_statement.created_dt IS NOT NULL AND ( last_patient_statement.created_dt + interval '${acr_claim_status_statement_days} days')::DATE > timezone(get_facility_tz(c.facility_id::integer), now())::DATE
                                ) THEN
                                   CASE
                                    WHEN (payment_details.last_pat_payment_dt + interval '${acr_claim_status_last_payment_days} days')::DATE > timezone(get_facility_tz(c.facility_id::integer), now())::DATE
                                        THEN TRUE
                                    ELSE FALSE
                                   END
                                WHEN (payment_details.last_pat_payment_dt + interval '${acr_claim_status_last_payment_days} days')::DATE > timezone(get_facility_tz(c.facility_id::integer), now())::DATE THEN TRUE
                                ELSE FALSE
                            END
                        WHEN  payment_details.last_pat_payment_dt IS NULL AND last_patient_statement.created_dt IS NOT NULL AND
                            (last_patient_statement.created_dt + interval '${acr_claim_status_statement_days} days')::DATE > timezone(get_facility_tz(c.facility_id::integer), now())::DATE THEN TRUE
                        ELSE FALSE
                    END
                )`);
        } else if (acr_claim_status_statement_count && acr_claim_status_statement_days && !acr_claim_status_last_payment_days) {
            sql.append(`WHERE
                last_patient_statement.created_dt IS NOT NULL AND
                NOT ( CASE
                        WHEN  payment_details.last_pat_payment_dt IS NULL THEN
                            (last_patient_statement.created_dt + interval '${acr_claim_status_statement_days} days')::DATE > timezone(get_facility_tz(c.facility_id::integer), now())::DATE
                        WHEN  payment_details.last_pat_payment_dt IS NOT NULL THEN
                            CASE
                                WHEN (payment_details.last_pat_payment_dt
                                   BETWEEN (last_patient_statement.created_dt) AND (last_patient_statement.created_dt + interval '${acr_claim_status_statement_days} days')::DATE)
                                     THEN TRUE
                                WHEN (last_patient_statement.created_dt + interval '${acr_claim_status_statement_days} days')::DATE > timezone(get_facility_tz(c.facility_id::integer), now())::DATE THEN TRUE
                                ELSE FALSE
                            END
                    END
                )`);
        } else {
            sql.append(`WHERE
                NOT ( CASE
                        WHEN  payment_details.last_pat_payment_dt IS NULL THEN TRUE
                        WHEN  payment_details.last_pat_payment_dt IS NOT NULL THEN
                            CASE
                                WHEN (payment_details.last_pat_payment_dt + interval '${acr_claim_status_last_payment_days} days')::DATE > timezone(get_facility_tz(c.facility_id::integer), now())::DATE
                                   THEN TRUE
                                ELSE FALSE
                            END
                    END
                )`);
        }

        sql.append(` ORDER BY p.id ASC
                )
                , claim_charge_fee AS (
                    SELECT
                        SUM(c.bill_fee * c.units)  AS charges_bill_fee_total
                        ,c.claim_id
                    FROM
                        billing.charges AS c
                        INNER JOIN patient_details AS pd ON pd.claim_id = c.claim_id
                        INNER JOIN public.cpt_codes AS pc ON pc.id = c.cpt_id
                        LEFT OUTER JOIN billing.charges_studies AS cs ON c.id = cs.charge_id
                    GROUP BY c.claim_id
                )
                -- --------------------------------------------------------------------------------------------------------------
                -- Calculating claim balance
                -- To avoid performance delay calculation written here instead of calling db function
                -- --------------------------------------------------------------------------------------------------------------
                , claim_payment_lists AS (
                    SELECT
                        ccf.charges_bill_fee_total - (
                            applications.payments_applied_total +
                            applications.adjustments_applied_total +
                            applications.refund_amount
                        ) AS claim_balance_total
                        ,ccf.claim_id
                    FROM
                        claim_charge_fee ccf
                    LEFT JOIN LATERAL (
                        SELECT
                            coalesce(sum(pa.amount)   FILTER (WHERE pa.amount_type = 'payment'),0::money)    AS payments_applied_total,
                            coalesce(sum(pa.amount)   FILTER (WHERE pa.amount_type = 'adjustment' AND (adj.accounting_entry_type != 'refund_debit' OR pa.adjustment_code_id IS NULL)),0::money) AS adjustments_applied_total,
                            coalesce(sum(pa.amount)   FILTER (WHERE adj.accounting_entry_type = 'refund_debit'),0::money) AS refund_amount,
                            c.claim_id
                        FROM
                            billing.charges AS c
                        LEFT JOIN billing.payment_applications AS pa ON pa.charge_id = c.id
                        LEFT JOIN billing.payments AS p ON pa.payment_id = p.id
                        LEFT JOIN billing.adjustment_codes adj ON adj.id = pa.adjustment_code_id
                        GROUP BY c.claim_id
                    ) as applications ON applications.claim_id = ccf.claim_id
                )
                -- --------------------------------------------------------------------------------------------------------------
                -- Getting total patient balance >= acr_min_balance_amount
                -- --------------------------------------------------------------------------------------------------------------
                , claim_patient_balance AS (
                    SELECT
                        SUM(cpl.claim_balance_total) AS patient_balance
                        ,p.id AS patient_id
                        ,ARRAY_AGG(claims.id) FILTER ( WHERE claim_status_id != ${acr_claim_status_id} AND cpl.claim_balance_total > 0::money ) AS claim_ids
                    FROM
                        billing.claims
                    INNER JOIN claim_payment_lists cpl ON cpl.claim_id = claims.id
                    INNER JOIN patients p ON p.id = claims.patient_id
                    WHERE claims.payer_type = 'patient' -- consider the claims those are only patient responsible for moving to ACR
                    GROUP BY p.id
                    HAVING sum(cpl.claim_balance_total) >= ${acr_min_balance_amount}::money
                    ORDER BY p.id DESC
                )
                -- --------------------------------------------------------------------------------------------------------------
                -- Update claims status = 'Collection Review' which satisfied the review cond.
                -- Should not change claims status which already in 'claim in collection'
                -- --------------------------------------------------------------------------------------------------------------
                , update_status AS (
                    UPDATE  billing.claims
                        SET claim_status_id = ${acr_claim_status_id}
                    FROM claim_patient_balance
                    WHERE id = ANY(claim_ids)
                    AND NOT (claim_status_id = ANY(ARRAY[(SELECT id FROM billing.claim_status WHERE code = 'CIC'), ${acr_claim_status_id}]))
                    RETURNING id
                )
                , insert_claim_comments AS (
                    INSERT INTO billing.claim_comments (
                        note
                        , type
                        , claim_id
                        , created_by
                        , created_dt
                    )
                    SELECT
                       'Claim was sent to collections review'
                       , 'auto'
                       , UNNEST(claim_ids)
                       , ${userId}
                       , now()
                    FROM claim_patient_balance
                    RETURNING *, '{}'::jsonb old_values
               )
               , insert_claim_comment_audit_cte as(
                    SELECT billing.create_audit(
                        ${auditDetails.company_id}
                        , 'claims'
                        , claim_id
                        , '${auditDetails.screen_name}'
                        , '${auditDetails.module_name}'
                        , 'Claim Comments inserted AS Claim was sent to collections review'
                        , '${auditDetails.client_ip}'
                        , jsonb_build_object(
                            'old_values', COALESCE(old_values, '{}'),
                            'new_values', ('{}')::text
                        )
                        , ${userId}
                    ) AS id
                    FROM insert_claim_comments
                    WHERE id IS NOT NULL
                )
               `);

        sql.append(writeOffQuery);

        sql.append(selectResult);

        return await query(sql.text, sql.values);
    }
};

module.exports = acr;
