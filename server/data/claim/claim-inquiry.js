const {
    SQL,
    query,
    queryWithAudit
} = require('../index');

module.exports = {
    getData: async (params) => {
        let {
            claim_id
        } = params;

        let sql = SQL`WITH claim_details AS
        (SELECT json_agg(row_to_json(encounter)) claim_details
        FROM (
            SELECT
                  ref_pr.full_name  AS ref_provider_name
                , rend_pr.full_name AS rend_provider_name
                , f.facility_name
                , st.description AS claim_status
                , SUM(ch.bill_fee * ch.units) AS bill_fee
                , pg.group_name
                , SUM(ch.allowed_amount * ch.units) AS allowed_fee
                , (SELECT SUM(claim_balance_total) FROM billing.get_claim_totals(bc.id)) AS claim_balance
                , bc.billing_notes
                , claim_dt
                , pos.description AS pos_name
                , bpr.name AS billing_provider_name
            FROM billing.claims bc
            INNER JOIN billing.claim_status st ON st.id = bc.claim_status_id
            INNER JOIN public.facilities f ON f.id = bc.facility_id
            INNER JOIN billing.charges ch ON ch.claim_id = bc.id
            INNER JOIN billing.providers bpr ON bpr.id = bc.billing_provider_id
            LEFT JOIN public.provider_contacts ref_pc ON ref_pc.id = bc.referring_provider_contact_id
            LEFT JOIN public.provider_contacts rend_pc ON rend_pc.id = bc.rendering_provider_contact_id
            LEFT JOIN public.providers ref_pr ON ref_pr.id = ref_pc.provider_id
            LEFT JOIN public.providers rend_pr ON rend_pr.id = rend_pc.provider_id
            LEFT JOIN public.provider_groups pg ON pg.id = bc.ordering_facility_id
            LEFT JOIN public.places_of_service pos ON pos.id = bc.place_of_service_id
            WHERE
                bc.id = ${claim_id}
            GROUP BY
                  bc.id
                , ref_pr.full_name
                , rend_pr.full_name
                , f.facility_name
                , st.description
                , pg.group_name
                , pos.description
                , bpr.name
            ) AS encounter
        )
    , patient_details AS
        ( SELECT json_agg(row_to_json(patient)) patient_details
        FROM (
            SELECT
                  public.get_full_name(p.last_name, p.first_name, p.middle_name, p.prefix_name, p.suffix_name) AS patient_name
                , p.account_no
                , p.birth_date
                , gender
            FROM patients p
            INNER JOIN billing.claims bc ON bc.patient_id = p.id
            WHERE bc.id = ${claim_id}
            ) AS patient
    )
    , payment_details AS
        (SELECT json_agg(row_to_json(pay)) payment_details
         FROM(
            SELECT
                  COALESCE(sum(bpa.amount) FILTER(where bp.payer_type = 'patient' AND amount_type = 'payment'),0::money) AS patient_paid
                , COALESCE(sum(bpa.amount) FILTER(where bp.payer_type != 'patient' AND amount_type = 'payment'),0::money) AS others_paid
                , SUM(CASE WHEN (amount_type = 'adjustment' AND (accounting_entry_type != 'refund_debit' OR adjustment_code_id IS NULL)) THEN bpa.amount ELSE 0::money END) AS adjustment_amount
                , SUM(CASE WHEN accounting_entry_type = 'refund_debit' THEN bpa.amount ELSE 0::money END) AS refund_amount
            FROM billing.claims bc
            INNER JOIN billing.charges ch ON ch.claim_id = bc.id
            LEFT JOIN billing.payment_applications bpa ON bpa.charge_id = ch.id
            LEFT JOIN billing.payments bp ON bp.id = bpa.payment_id
            LEFT JOIN billing.adjustment_codes adj ON adj.id = bpa.adjustment_code_id
            WHERE
                bc.id = ${claim_id}
         ) AS pay
    )
    , icd_details AS
        (SELECT json_agg(row_to_json(icd)) icdcode_details
         FROM (
            SELECT
                  icd.id
                , icd.code
                , icd.description
            FROM
                billing.claim_icds ci
            INNER JOIN public.icd_codes icd ON icd.id = ci.icd_id
            WHERE ci.claim_id = ${claim_id}
            ORDER BY ci.id ASC
            ) AS icd
        )
    , pat_ins_ids AS (
        SELECT *
        FROM   (SELECT Unnest(pi_ids)      patient_insurance_id,
                    Unnest(payer_types) payer_type
                FROM   (SELECT array[ primary_patient_insurance_id,
                    secondary_patient_insurance_id,
                    tertiary_patient_insurance_id]
                    AS pi_ids,
                    array[ 'primary_insurance', 'secondary_insurance',
                    'tertiary_insurance']
                    AS
                    payer_types
                        FROM   billing.claims bc
                        WHERE  bc.id = ${claim_id}
                    ) x) y
        WHERE  y.patient_insurance_id IS NOT NULL
    )
    , insurance_details AS
        ( SELECT json_agg(row_to_json(ins)) insurance_details
        FROM (SELECT
                  ip.id
                , claim_ins.payer_type
                , ip.insurance_code
                , ip.insurance_name
                , (COALESCE(TRIM(pi.subscriber_lastname),'') ||' '|| COALESCE(TRIM(pi.subscriber_firstname),'')) AS name
                , to_char( pi.subscriber_dob , 'MM/DD/YYYY') AS subscriber_dob
                , pi.policy_number
                , pi.group_number
            FROM public.patient_insurances pi
            INNER JOIN pat_ins_ids claim_ins ON pi.id = claim_ins.patient_insurance_id
            INNER JOIN insurance_providers ip ON ip.id = pi.insurance_provider_id
            ORDER BY pi.coverage_level ASC
            ) AS ins
        )
    SELECT * FROM  claim_details, payment_details, icd_details, insurance_details, patient_details  `;
        return await query(sql);
    },

    getClaimComments: async (params) => {
        let {
            claim_id
        } = params;

        let sql = SQL`WITH agg AS (SELECT
                          cc.id AS id
                        , COALESCE(null, '') AS payment_id
                        , type AS code
                        , null AS type
                        , note AS comments
                        , created_dt::date as commented_dt
                        , is_internal
                        , null AS charge_amount
                        , '{}'::text[] AS charge_pointer
                        , null AS payment
                        , null AS adjustment
                    FROM
                        billing.claim_comments cc
                    WHERE cc.claim_id = ${claim_id}
                    UNION ALL
                    SELECT
                          ch.id AS id
                        , COALESCE(null, '') AS payment_id
                        , 'charge' AS code
                        , cpt.display_code AS  type
                        , cpt.short_description AS comments
                        , ch.charge_dt::date as commented_dt
                        , false AS is_internal
                        , (ch.units * ch.bill_fee) AS charge_amount
                        , ARRAY[COALESCE(pointer1, ''), COALESCE(pointer2, ''), COALESCE(pointer3, ''), COALESCE(pointer4, '')] AS charge_pointer
                        , null AS payment
                        , null AS adjustment
                    FROM billing.charges ch
                    INNER JOIN cpt_codes cpt on cpt.id = ch.cpt_id
                    WHERE ch.claim_id = ${claim_id}
                    UNION ALL
                    SELECT
                          max(pa.id) AS id
                        , bp.id::text AS payment_id
                        , pa.amount_type as code
                        ,  CASE WHEN pa.amount_type = 'adjustment' THEN 'Adjustment' WHEN  amount_type = 'payment' THEN
                            CASE WHEN bp.payer_type = 'patient' THEN
                                    'Patient'
                            WHEN bp.payer_type = 'insurance' THEN
                                    'Insurance'
                            WHEN bp.payer_type = 'ordering_facility' THEN
                                    'Ordering Facility'
                            WHEN bp.payer_type = 'ordering_provider' THEN
                                    'Provider'
                            END
                            END  as type
                        , CASE WHEN bp.payer_type = 'patient' THEN
                                    pp.full_name
                            WHEN bp.payer_type = 'insurance' THEN
                                    pip.insurance_name
                            WHEN bp.payer_type = 'ordering_facility' THEN
                                    pg.group_name
                            WHEN bp.payer_type = 'ordering_provider' THEN
                                    p.full_name
                            END as comments
                        , bp.accounting_date as commented_dt
                        , false AS is_internal
                        , null AS charge_amount
                        , '{}'::text[] AS charge_pointer
                        , SUM(CASE WHEN pa.amount_type = 'payment' THEN pa.amount ELSE 0.00::money END)::text payment
                        , SUM(CASE WHEN pa.amount_type = 'adjustment'  THEN pa.amount  ELSE 0.00::money END)::text adjustment
                    FROM billing.payments bp
                    INNER JOIN billing.payment_applications pa on pa.payment_id = bp.id
                    INNER JOIN billing.charges ch on ch.id = pa.charge_id
                    LEFT JOIN public.patients pp on pp.id = bp.patient_id
                    LEFT JOIN public.insurance_providers pip on pip.id = bp.insurance_provider_id
                    LEFT JOIN public.provider_groups  pg on pg.id = bp.provider_group_id
                    LEFT JOIN public.provider_contacts  pc on pc.id = bp.provider_contact_id
                    LEFT JOIN public.providers p on p.id = pc.provider_id
                    LEFT JOIN billing.adjustment_codes adj ON adj.id = pa.adjustment_code_id
                    WHERE
                        ch.claim_id = ${claim_id}
                        AND CASE WHEN pa.amount_type = 'adjustment' THEN pa.amount != 0.00::money ELSE 1=1  END
                        AND (accounting_entry_type != 'refund_debit' OR adjustment_code_id IS NULL)
                    GROUP BY
                        pa.applied_dt,
                        bp.id ,
                        pa.amount_type,
                        comments
                    UNION ALL
                    SELECT
                          bp.id AS id
                        , bp.id::text AS payment_id
                        , 'refund' AS code
                        , 'Refund'  AS type
                        , adj.description AS comments
                        , bp.accounting_date AS commented_dt
                        , false AS is_internal
                        , null AS charge_amount
                        , '{}'::text[] AS charge_pointer
                        , null AS payment
                        , SUM( pa.amount )::text AS adjustment
                    FROM billing.payments bp
                    INNER JOIN billing.payment_applications pa on pa.payment_id = bp.id
                    INNER JOIN billing.charges ch on ch.id = pa.charge_id
                    LEFT JOIN billing.adjustment_codes adj ON adj.id = pa.adjustment_code_id
                    WHERE adj.accounting_entry_type = 'refund_debit'  AND ch.claim_id = ${claim_id}
                    GROUP BY
                        bp.id
                        , pa.amount_type
                        , adj.description
                )
                SELECT
                      id AS row_id
                    , payment_id
                    , code
                    , type
                    , comments
                    , commented_dt
                    , is_internal
                    , charge_amount
                    , charge_pointer
                    , payment
                    , adjustment
                    , COUNT(1) OVER (range unbounded preceding) AS total_records
                    , ROW_NUMBER () OVER (
                        ORDER BY
                            commented_dt
                            , CASE code
                                WHEN 'charge' THEN 1
                                WHEN 'auto' THEN 2
                                WHEN 'patient_statement' THEN 3
                                WHEN 'payment' THEN 4
                                WHEN 'adjustment' THEN 5
                                WHEN 'refund' THEN 6
                                WHEN 'co_insurance' THEN 7
                                WHEN 'deductible' THEN 8 END
                    ) AS id
                FROM agg
                ORDER BY
                      commented_dt
                    , CASE code
                        WHEN 'charge' THEN 1
                        WHEN 'auto' THEN 2
                        WHEN 'patient_statement' THEN 3
                        WHEN 'payment' THEN 4
                        WHEN 'adjustment' THEN 5
                        WHEN 'refund' THEN 6
                        WHEN 'co_insurance' THEN 7
                        WHEN 'deductible' THEN 8 END `;

        return await query(sql);
    },

    getClaimComment: async (params) => {
        let {
            commentId
        } = params;

        let sql = `SELECT
                      id
                    , note AS comments
                    , is_internal
                    FROM
                        billing.claim_comments
                    WHERE id = ${commentId}`;

        return await query(sql);
    },

    updateClaimComment: async (params) => {
        let {
            commentId,
            note,
            comments,
            from,
            followupDate,
            claim_id,
            assignedTo,
            notes,
            screenName,
            moduleName,
            clientIp,
            userId,
            companyId
        } = params;
        let sql;

        if (from == 'cb') {
            //TODO: Audit log bulk update
            sql = SQL`WITH agg_cmt AS (
                        SELECT * FROM json_to_recordset(${comments}) AS data
                            (
                                isinternal boolean,
                                commentid bigint
                            )
                        ),
                        update_cmt AS (UPDATE
                            billing.claim_comments cc
                        SET
                            is_internal = agg_cmt.isInternal
                        FROM agg_cmt
                        WHERE
                            id = commentid
                        RETURNING id),
                        update_billnotes AS ( UPDATE
                                billing.claims SET billing_notes  = ${notes}
                             WHERE id = ${claim_id}
                            RETURNING *,
                            (
                                SELECT row_to_json(old_row)
                                FROM   (SELECT *
                                        FROM  billing.claims
                                        WHERE  id = ${claim_id}) old_row
                            ) old_values
                        ),
                        update_audit_billnotes AS (
                                SELECT billing.create_audit(
                                      ${companyId}
                                    , 'claims'
                                    , id
                                    , ${screenName}
                                    , ${moduleName}
                                    , 'Billing Notes Updated  '||  'Claim ID  ' || update_billnotes.id
                                    , ${clientIp}
                                    , json_build_object(
                                        'old_values', COALESCE(old_values, '{}'),
                                        'new_values', (SELECT row_to_json(temp_row)::jsonb - 'old_values'::text FROM (SELECT * FROM update_billnotes ) temp_row)
                                      )::jsonb
                                    , ${userId}
                                  ) AS id
                                FROM update_billnotes
                                WHERE id IS NOT NULL
                            ), `;

            if (followupDate == '') {
                sql.append(`update_followup AS (DELETE FROM
                            billing.claim_followups
                        WHERE
                            claim_id = ${claim_id}
                            AND assigned_to = ${userId}
                            RETURNING *, '{}'::jsonb old_values  ),
                            update_audit_followup AS (
                                SELECT billing.create_audit(
                                      ${companyId}
                                    , 'claims'
                                    , id
                                    , '${screenName}'
                                    , '${moduleName}'
                                    , 'Follow Up Deleted for Claim ID: ' || update_followup.claim_id
                                    , '${clientIp}'
                                    , json_build_object(
                                        'old_values', COALESCE(old_values, '{}'),
                                        'new_values', (SELECT row_to_json(temp_row)::jsonb - 'old_values'::text FROM (SELECT * FROM update_followup ) temp_row)
                                      )::jsonb
                                    , ${userId}
                                  ) AS id
                                FROM update_followup
                                WHERE id IS NOT NULL
                            )
                        SELECT * FROM update_audit_followup
                        UNION
                        SELECT * FROM update_audit_billnotes`);
            }
            else {
                sql.append(`update_followup AS(
                    UPDATE
                        billing.claim_followups
                    SET
                          followup_date = '${followupDate}'::DATE
                        , assigned_to= ${assignedTo}
                    WHERE
                        claim_id = ${claim_id}
                        AND assigned_to= ${userId}
                    RETURNING *,
                    (
                        SELECT row_to_json(old_row)
                        FROM   (SELECT *
                                FROM   billing.claim_followups
                                WHERE  claim_id = ${claim_id} and assigned_to= ${userId}) old_row
                    ) old_values
                ),
                insert_followup AS(
                    INSERT INTO billing.claim_followups(
                          claim_id
                        , followup_date
                        , assigned_to
                    )
                    SELECT
                          ${claim_id}
                        , '${followupDate}'::DATE
                        , ${assignedTo}
                    WHERE
                    NOT EXISTS(SELECT 1 FROM update_followup)
                    RETURNING *, '{}'::jsonb old_values
                ),
                insert_audit_followup AS (
                    SELECT billing.create_audit(
                          ${companyId}
                        , 'claims'
                        , id
                        , '${screenName}'
                        , '${moduleName}'
                        , 'New Followup/Billing Notes created for Claim ID: ' ||  insert_followup.claim_id
                        , '${clientIp}'
                        , json_build_object(
                            'old_values', COALESCE(old_values, '{}'),
                            'new_values', (SELECT row_to_json(temp_row)::jsonb - 'old_values'::text FROM (SELECT * FROM insert_followup) temp_row)
                          )::jsonb
                        , ${userId}
                      ) AS id
                    FROM insert_followup
                    WHERE id IS NOT NULL
                ),
                update_audit_followup AS (
                    SELECT billing.create_audit(
                          ${companyId}
                        , 'claims'
                        , id
                        , '${screenName}'
                        , '${moduleName}'
                        , 'Follow Up Updated/Billing Notes for Claim ID: ' || update_followup.claim_id
                        , '${clientIp}'
                        , json_build_object(
                            'old_values', COALESCE(old_values, '{}'),
                            'new_values', (SELECT row_to_json(temp_row)::jsonb - 'old_values'::text FROM (SELECT * FROM update_followup ) temp_row)
                          )::jsonb
                        , ${userId}
                      ) AS id
                    FROM update_followup
                    WHERE id IS NOT NULL
                )
                SELECT * FROM insert_audit_followup UNION SELECT * FROM update_audit_followup UNION SELECT * FROM update_audit_billnotes`);
            }

        } else {
            sql = SQL`WITH update_comments AS (
                    UPDATE
                        billing.claim_comments
                    SET
                        note = ${note}
                    WHERE
                        id = ${commentId}
                    RETURNING *,
                    (
                        SELECT row_to_json(old_row)
                        FROM   (SELECT *
                                FROM   billing.claim_comments
                                WHERE  id = ${commentId}) old_row
                    ) old_values
                ),
                update_audit_comments AS (
                    SELECT billing.create_audit(
                          ${companyId}
                        , 'claims'
                        , id
                        , ${screenName}
                        , ${moduleName}
                        , 'Updated:  Claim Inquiry ( ' || update_comments.claim_id ||' ) Updated'
                        , ${clientIp}
                        , json_build_object(
                            'old_values', COALESCE(old_values, '{}'),
                            'new_values', (SELECT row_to_json(temp_row)::jsonb - 'old_values'::text FROM (SELECT * FROM update_comments ) temp_row)
                          )::jsonb
                        , ${userId}
                      ) AS id
                    FROM update_comments
                    WHERE id IS NOT NULL
                )
                SELECT * FROM update_audit_comments`;
        }

        return await query(sql);
    },

    saveClaimComment: async (params) => {

        let {
            note,
            type,
            claim_id,
            userId
        } = params;

        let sql = SQL`INSERT INTO billing.claim_comments
            (
                  note
                , type
                , claim_id
                , created_by
                , created_dt
            )
            VALUES(
                  ${note}
                , ${type}
                , ${claim_id}
                , ${userId}
                , now()
            ) RETURNING *, '{}'::jsonb old_values`;


        return await queryWithAudit(sql, {
            ...params,
            logDescription: `Add: Claim Inquiry(${claim_id}) created`
        });
    },

    deleteClaimComment: async (params) => {
        let {
            id
        } = params;

        let sql = SQL`DELETE
                    FROM
                        billing.claim_comments
                    WHERE id = ${id}
                    RETURNING *, '{}'::jsonb old_values `;

        return await queryWithAudit(sql, {
            ...params,
            logDescription: 'Deleted.'
        });
    },

    getFollowupDate: async (params) => {
        let {
            claim_id,
            userId
        } = params;

        return await query(SQL`SELECT
                                followup_date
                            FROM
                                billing.claim_followups
                            WHERE claim_id = ${claim_id}
                            AND assigned_to = ${userId}`);
    },

    viewPaymentDetails: async (params) => {
        let {
            claim_id,
            payment_id,
            pay_application_id
        } = params;

        let sql = `SELECT
                          pa.payment_id
                        , ch.id AS charge_id
                        , (ch.bill_fee * ch.units)::NUMERIC AS bill_fee
                        , (ch.allowed_amount * ch.units)::NUMERIC AS allowed_amount
                        , cas.cas_details
                        , pa.payment_amount AS payment
                        , pa.adjustment_amount AS adjustment
                        , cpt.display_code AS cpt_code
                    FROM (SELECT charge_id, id, payment_amount, adjustment_amount, payment_applied_dt, payment_id, payment_application_adjustment_id from billing.get_payment_applications(${payment_id}, ${pay_application_id}) ) AS pa
                    INNER JOIN billing.charges ch on ch.id = pa.charge_id
                    INNER JOIN public.cpt_codes cpt ON cpt.id = ch.cpt_id
                    LEFT JOIN LATERAL (
                        SELECT json_agg(row_to_json(cas)) AS cas_details
                            FROM ( SELECT
                                    cas.amount,
                                    rc.code
                                FROM billing.cas_payment_application_details cas
                                INNER JOIN billing.cas_reason_codes rc ON rc.id = cas.cas_reason_code_id
                                WHERE  cas.payment_application_id = pa.payment_application_adjustment_id
                                ORDER BY cas.id
                                ) as cas
                    ) cas on true
                    WHERE ch.claim_id = ${claim_id}
                    ORDER BY pa.payment_applied_dt ASC `;
        return await query(sql);
    },

    viewChargePaymentDetails: async (params) => {
        let {
            charge_id
        } = params;

        let sql = `SELECT
                          pa.payment_id
                        , ch.id AS charge_id
                        , ch.bill_fee
                        , ch.allowed_amount
                        , cas.cas_details
                        , COALESCE(pa.amount,0::money) AS payment
                        , COALESCE(pa_adjustment.amount, 0::money) AS adjustment
                        , cpt.display_code AS cpt_code
                        , pa_adjustment.id AS payment_application_adjustment_id
                    FROM	billing.payment_applications pa
                    INNER JOIN billing.charges ch ON ch.id = pa.charge_id
                    INNER JOIN public.cpt_codes cpt ON cpt.id = ch.cpt_id
                    LEFT JOIN LATERAL (
                        SELECT 	*
                        FROM	billing.payment_applications bpa
                        WHERE	bpa.payment_id = pa.payment_id
                            AND bpa.charge_id = pa.charge_id
                            AND bpa.applied_dt = pa.applied_dt
                            AND bpa.amount_type = 'adjustment'
                    ) pa_adjustment ON true
                    LEFT JOIN LATERAL (
                        SELECT json_agg(row_to_json(cas)) AS cas_details
                            FROM ( SELECT
                                    cas.amount,
                                    rc.code
                                FROM billing.cas_payment_application_details cas
                                INNER JOIN billing.cas_reason_codes rc ON rc.id = cas.cas_reason_code_id
                                WHERE  cas.payment_application_id = pa_adjustment.id
                                ORDER BY cas.id
                                ) as cas
                    ) cas on true
                    WHERE	pa.charge_id = ${charge_id}
                        AND pa.amount_type = 'payment'
                    ORDER BY pa.applied_dt ASC `;

        return await query(sql);
    },

    getclaimPatient: async function (params) {
        params.sortOrder = params.sortOrder || ' ASC';
        let {
            sortOrder,
            sortField,
            pageNo,
            pageSize,
            patientId,
            billProvId
        } = params;

        let billProvWhereQuery = billProvId && billProvId != 0 && billProvId != '' ? `AND billing.claims.billing_provider_id = ${billProvId}` : '';

        let sql = SQL`SELECT
                        claims.id as claim_id
                        ,(  CASE payer_type
                            WHEN 'primary_insurance' THEN insurance_providers.insurance_name
                            WHEN 'secondary_insurance' THEN insurance_providers.insurance_name
                            WHEN 'teritary_insurance' THEN insurance_providers.insurance_name
                            WHEN 'ordering_facility' THEN provider_groups.group_name
                            WHEN 'referring_provider' THEN ref_provider.full_name
                            WHEN 'rendering_provider' THEN render_provider.full_name
                            WHEN 'patient' THEN patients.full_name        END) AS payer_name
                        , claim_dt
                        , claims.facility_id
                        , claim_status.description as claim_status
                        , (select adjustments_applied_total from billing.get_claim_payments(claims.id)) AS ajdustments_applied_total
                        , (select payment_patient_total from billing.get_claim_payments(claims.id)) AS total_patient_payment
                        , (select payment_insurance_total from billing.get_claim_payments(claims.id)) AS total_insurance_payment
                        , (select charges_bill_fee_total from BILLING.get_claim_payments(claims.id)) as billing_fee
                        , (select charges_bill_fee_total - (payments_applied_total + adjustments_applied_total) from BILLING.get_claim_payments(claims.id)) as claim_balance
                        , COUNT(1) OVER (range unbounded preceding) AS total_records
                        ,(select Row_to_json(agg_arr) agg_arr FROM (SELECT * FROM billing.get_age_patient_claim (patients.id, ${billProvId}::bigint ) )as agg_arr) as age_summary
                    FROM billing.claims
                    INNER JOIN patients ON claims.patient_id = patients.id
                    LEFT JOIN provider_contacts  ON provider_contacts.id=claims.referring_provider_contact_id
                    LEFT JOIN providers as ref_provider ON ref_provider.id=provider_contacts.id
                    LEFT JOIN provider_contacts as rendering_pro_contact ON rendering_pro_contact.id=claims.rendering_provider_contact_id
                    LEFT JOIN providers as render_provider ON render_provider.id=rendering_pro_contact.id
                    LEFT JOIN patient_insurances ON patient_insurances.id =
                        (  CASE payer_type
                        WHEN 'primary_insurance' THEN primary_patient_insurance_id
                        WHEN 'secondary_insurance' THEN secondary_patient_insurance_id
                        WHEN 'teritary_insurance' THEN tertiary_patient_insurance_id
                        END)
                    LEFT JOIN insurance_providers ON patient_insurances.insurance_provider_id = insurance_providers.id
                    LEFT JOIN provider_groups ON claims.ordering_facility_id = provider_groups.id
                    LEFT JOIN billing.claim_status  ON claim_status.id=claims.claim_status_id
                     WHERE patients.id=${patientId}
                    `;

        if (billProvWhereQuery) {
            sql.append(billProvWhereQuery);
        }

        sql.append(SQL` ORDER BY  `)
            .append(sortField)
            .append(' ')
            .append(sortOrder)
            .append(SQL` LIMIT ${pageSize}`)
            .append(SQL` OFFSET ${((pageNo * pageSize) - pageSize)}`);

        return await query(sql);
    },

    getInvoiceDetails: function (payerType, params) {
        let joinCondition = '';
        let selectDetails = '';
        let joinQuery = '';
        let whereQuery = '';
        let havingQuery = '';


        if (payerType == 'ordering_facility') {
            selectDetails = ' bc.ordering_facility_id AS ordering_facility_id ';
            joinCondition = 'INNER JOIN public.provider_groups ppg ON ppg.id = bc.ordering_facility_id';
            joinQuery = 'INNER JOIN get_payer_details gpd ON gpd.ordering_facility_id = bc.ordering_facility_id';
        }
        else if (payerType == 'referring_provider') {
            selectDetails = ' bc.referring_provider_contact_id AS referring_provider_contact_id ';
            joinCondition = 'INNER JOIN public.provider_contacts ppc ON ppc.id = bc.referring_provider_contact_id';
            joinQuery = 'INNER JOIN get_payer_details gpd ON gpd.referring_provider_contact_id = bc.referring_provider_contact_id';
        }
        else if (payerType == 'primary_insurance') {
            selectDetails = ' ppi.insurance_provider_id AS insurance_provider_id ';
            joinCondition = 'INNER JOIN public.patient_insurances ppi ON ppi.id = bc.primary_patient_insurance_id';

            joinQuery = ` INNER 	JOIN LATERAL (
                SELECT 	id
                FROM	public.patient_insurances ppi
                INNER 	JOIN	get_payer_details gpd ON gpd.insurance_provider_id = ppi.insurance_provider_id
            ) ppi 	ON TRUE  `;

            whereQuery = `  AND bc.payer_type = ANY(ARRAY['primary_insurance', 'secondary_insurance', 'tertiary_insurance'])
                            AND (bc.primary_patient_insurance_id = ppi.id or bc.secondary_patient_insurance_id = ppi.id or bc.tertiary_patient_insurance_id = ppi.id)`;

        }
        else if (payerType == 'secondary_insurance') {
            selectDetails = ' ppi.insurance_provider_id AS insurance_provider_id ';
            joinCondition = 'INNER JOIN public.patient_insurances ppi ON ppi.id = bc.secondary_patient_insurance_id';

            joinQuery = ` INNER 	JOIN LATERAL (
                SELECT 	id
                FROM	public.patient_insurances ppi
                INNER 	JOIN	get_payer_details gpd ON gpd.insurance_provider_id = ppi.insurance_provider_id
            ) ppi 	ON TRUE  `;

            whereQuery = `  AND bc.payer_type = ANY(ARRAY['primary_insurance', 'secondary_insurance', 'tertiary_insurance'])
                            AND (bc.primary_patient_insurance_id = ppi.id or bc.secondary_patient_insurance_id = ppi.id or bc.tertiary_patient_insurance_id = ppi.id)`;

        }
        else if (payerType == 'tertiary_insurance') {
            selectDetails = ' ppi.insurance_provider_id AS insurance_provider_id ';
            joinCondition = 'INNER JOIN public.patient_insurances ppi ON ppi.id = bc.tertiary_patient_insurance_id';

            joinQuery = ` INNER 	JOIN LATERAL (
                SELECT 	id
                FROM	public.patient_insurances ppi
                INNER 	JOIN	get_payer_details gpd ON gpd.insurance_provider_id = ppi.insurance_provider_id
            ) ppi 	ON TRUE  `;

            whereQuery = `  AND bc.payer_type = ANY(ARRAY['primary_insurance', 'secondary_insurance', 'tertiary_insurance'])
                            AND (bc.primary_patient_insurance_id = ppi.id or bc.secondary_patient_insurance_id = ppi.id or bc.tertiary_patient_insurance_id = ppi.id)`;

        }

        if (params.invoice_adjustment || params.invoice_bill_fee || params.invoice_balance || params.invoice_payment || params.invoice_date) {
            havingQuery += ' HAVING true ';
        }

        if (params.invoice_no) {
            whereQuery += ` AND bc.invoice_no::text = '${params.invoice_no}'::text`;
        }

        if (params.invoice_date) {
            havingQuery += ` AND max(date) = '${params.invoice_date}'`;
        }

        if (params.invoice_adjustment) {
            havingQuery += ` AND  sum(adjustment) = (${params.invoice_adjustment})::money`;
        }

        if (params.invoice_bill_fee) {
            havingQuery += ` AND  sum(bill_fee) = (${params.invoice_bill_fee})::money`;
        }

        if (params.invoice_balance) {
            havingQuery += ` AND  sum(balance) = (${params.invoice_balance})::money`;
        }

        if (params.invoice_payment) {
            havingQuery += ` AND sum(payment) = (${params.invoice_payment})::money`;
        }


        return {
            joinCondition,
            selectDetails,
            joinQuery,
            whereQuery,
            havingQuery
        };

    },

    getInvoicePayments: async function (params) {
        params.sortOrder = params.sortOrder || ' ASC';
        let {
            sortOrder,
            sortField,
            pageNo,
            pageSize,
            payerType,
            claimID } = params;


        let {
            joinCondition,
            selectDetails,
            joinQuery,
            whereQuery,
            havingQuery
        } = await this.getInvoiceDetails(payerType, params);



        return await query(`WITH  get_payer_details AS(
                                SELECT
                                    ${selectDetails}
                                FROM billing.claims bc
                                ${joinCondition}
                                WHERE bc.invoice_no is not null
                                AND bc.payer_type = '${payerType}'
                                AND bc.id = ${claimID}
                            ),
                            invoice_payment_details AS(
                            SELECT
                                  bc.invoice_no
                                , bc.submitted_dt::date AS date
                                , claim_totals.charges_bill_fee_total AS bill_fee
                                , claim_totals.payments_applied_total AS payment
                                , claim_totals.adjustments_applied_total AS adjustment
                                , claim_totals.claim_balance_total AS balance
                                , bc.id AS claim_id
                                , bc.facility_id
                            FROM billing.claims bc
                            ${joinQuery}
                            INNER JOIN LATERAL (SELECT * FROM billing.get_claim_totals(bc.id)) claim_totals ON true
                            WHERE 	bc.invoice_no is not null
                            ${whereQuery})
                            SELECT
                                  ROW_NUMBER () OVER (ORDER BY invoice_no) AS id
                                , invoice_no As invoice_no
                                --, max(date) AS invoice_date
                                , timezone(public.get_facility_tz(facility_id::INT), max(date)::TIMESTAMP) AS invoice_date
                                , sum(bill_fee) AS invoice_bill_fee
                                , sum(payment) AS invoice_payment
                                , sum(adjustment) AS invoice_adjustment
                                , sum(balance) AS invoice_balance
                                , COUNT(1) OVER (range unbounded preceding) AS total_records
                                , array_agg(claim_id) AS claim_ids
                                , facility_id
                            FROM invoice_payment_details
                            GROUP BY invoice_no,facility_id
                            ${havingQuery}
                            ORDER BY ${sortField}  ${sortOrder}   LIMIT ${pageSize}
                            OFFSET ${((pageNo * pageSize) - pageSize)}`);

    },

    getInvoicePaymentsAge: async function (params) {

        let { payerType, claimID } = params;

        let {
            joinCondition,
            selectDetails,
            joinQuery,
            whereQuery,
            havingQuery
        } = await this.getInvoiceDetails(payerType, params);

        return await query(`WITH  get_payer_details AS(
                                SELECT
                                    ${selectDetails}
                                FROM billing.claims bc
                                ${joinCondition}
                                WHERE bc.invoice_no is not null
                                AND bc.payer_type = '${payerType}'
                                AND bc.id = ${claimID}
                            ),
                            invoice_payment_details AS(
                            SELECT
                                COALESCE(max(date_part('day', (now() - bc.submitted_dt))),0) AS age
                                , claim_totals.claim_balance_total AS balance
                            FROM billing.claims bc
                            ${joinQuery}
                            INNER JOIN LATERAL (SELECT * FROM billing.get_claim_totals(bc.id)) claim_totals ON true
                            WHERE 	bc.invoice_no is not null
                            ${whereQuery}
                            group by submitted_dt,claim_totals.claim_balance_total)
                            SELECT
                                COALESCE(sum(balance) FILTER(WHERE ipd.age <= 0 ) , 0::money) AS current_balance,
                                COALESCE(sum(balance) FILTER(WHERE ipd.age > 0 and ipd.age <= 30 ) , 0::money) AS to30,
                                COALESCE(sum(balance) FILTER(WHERE ipd.age > 30 and ipd.age <= 60) , 0::money) AS to60,
                                COALESCE(sum(balance) FILTER(WHERE ipd.age > 60 and ipd.age <= 90 ) , 0::money) AS to90,
                                COALESCE(sum(balance) FILTER(WHERE ipd.age > 90 and ipd.age <= 120 ) , 0::money) AS to120,
                                sum(balance)
                            FROM invoice_payment_details ipd
                            ${havingQuery}`);

    },

    getclaimPatientLog: async function (params) {
        let whereQuery = [];
        params.sortOrder = params.sortOrder || ' ASC';
        let {
            sortOrder,
            sortField,
            pageNo,
            pageSize,
            patientId,
            username,
            screen_name,
            description,
            created_dt
        } = params;

        if (username) {
            whereQuery.push(` users.username ILIKE '%${username}%'`);
        }

        if (screen_name) {
            whereQuery.push(` audit.screen_name ILIKE '%${screen_name}%'`);
        }

        if (description) {
            whereQuery.push(` audit.description ILIKE '%${description}%'`);
        }

        if (created_dt) {
            whereQuery.push(` ((audit.created_dt)::date =('${created_dt}')::date) `);
        }

        let sql = SQL`
                SELECT audit.id,
                    users.username,
                    audit.created_dt,
                    audit.screen_name,
                    audit.description,
                    bc.facility_id
                FROM   billing.claims bc
                    LEFT JOIN billing.charges bch
                            ON bch.claim_id = bc.id
                    LEFT JOIN billing.payments bp
                            ON bp.patient_id = bc.patient_id
                    LEFT JOIN billing.payment_applications bpa
                            ON bpa.payment_id = bp.id
                    INNER JOIN billing.audit_log audit
                            ON ( ( audit.entity_key = bc.id
                                    AND audit.entity_name = 'claims' )
                                    OR ( audit.entity_key = bch.id
                                        AND audit.entity_name = 'charges' )
                                    OR ( audit.entity_key = bp.id
                                        AND audit.entity_name = 'Payments' )
                                    OR ( audit.entity_key = bpa.id
                                        AND audit.entity_name = 'payment_applications' ) )
                    INNER JOIN users
                            ON users.id = audit.created_by
                    WHERE  bc.patient_id=${patientId}
                    `;

        if (whereQuery.length) {
            sql.append(SQL` AND `)
                .append(whereQuery.join(' AND '));
        }

        sql.append(SQL` ORDER BY  `)
            .append(sortField)
            .append(' ')
            .append(sortOrder)
            .append(SQL` LIMIT ${pageSize}`)
            .append(SQL` OFFSET ${((pageNo * pageSize) - pageSize)}`);

        return await query(sql);
    }

};
