const {
    SQL,
    query,
    queryWithAudit
} = require('./index');

module.exports = {
    getData: async (params) => {
        let {
            claim_id
        } = params;

        let sql = SQL`WITH encounter_details AS
        (SELECT json_agg(row_to_json(encounter)) encounter_details
        FROM (
            SELECT 
                  ref_pr.full_name  AS ref_provider_name
                , rend_pr.full_name AS rend_provider_name
                , f.facility_name
                , st.description AS claim_status
                , SUM(ch.bill_fee) AS bill_fee
                , pg.group_name
                , SUM(ch.allowed_amount) AS allowed_fee
                , COALESCE(sum(bpa.amount) FILTER(where bp.payer_type = 'patient'),0::money) AS patient_paid
                , COALESCE(sum(bpa.amount) FILTER(where bp.payer_type != 'patient'),0::money) AS others_paid
                , SUM(CASE WHEN amount_type = 'adjustment' THEN bpa.amount ELSE 0::money END) AS adjustment_amount
                , (SELECT SUM(claim_balance_total) FROM billing.get_claim_totals(bc.id)) AS claim_balance
            FROM billing.claims bc
            INNER JOIN billing.claim_status st ON st.id = bc.claim_status_id
            INNER JOIN public.facilities f ON f.id = bc.facility_id
            INNER JOIN billing.charges ch ON ch.claim_id = bc.id
            LEFT JOIN public.provider_contacts ref_pc ON ref_pc.id = bc.referring_provider_contact_id
            LEFT JOIN public.provider_contacts rend_pc ON rend_pc.id = bc.rendering_provider_contact_id
            LEFT JOIN public.providers ref_pr ON ref_pr.id = ref_pc.provider_id
            LEFT JOIN public.providers rend_pr ON rend_pr.id = rend_pc.provider_id
            LEFT JOIN billing.payment_applications bpa ON bpa.charge_id = ch.id 
            LEFT JOIN billing.payments bp ON bp.id = bpa.payment_id
            LEFT JOIN public.provider_groups pg ON pg.id = bc.ordering_facility_id
            WHERE 
                bc.id = ${claim_id}
            GROUP BY    
                  bc.id
                , ref_pr.full_name  
                , rend_pr.full_name
                , f.facility_name
                , st.description
                , pg.group_name
            ) AS encounter
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
            ) AS icd
        ) 
    , ins_prov_ids AS (
        SELECT
            ARRAY[ COALESCE (pri_pi.insurance_provider_id, '0')
            , COALESCE(sec_pi.insurance_provider_id, '0' )
            , COALESCE(ter_pi.insurance_provider_id, '0' )] AS ip_ids
        FROM billing.claims bc
        LEFT JOIN public.patient_insurances pri_pi ON pri_pi.id = bc.primary_patient_insurance_id
        LEFT JOIN public.patient_insurances sec_pi ON sec_pi.id = bc.secondary_patient_insurance_id
        LEFT JOIN public.patient_insurances ter_pi ON ter_pi.id = bc.tertiary_patient_insurance_id
        WHERE 
            bc.id = ${claim_id}
        )  
    , insurance_details AS 
        ( SELECT json_agg(row_to_json(ins)) insurance_details
        FROM (SELECT
                  id 
                , insurance_code
                , insurance_name
            FROM public.insurance_providers 
            WHERE id::bigint = ANY(SELECT UNNEST(ip_ids) FROM ins_prov_ids)
            ) AS ins
        )
    , followup_details AS
        ( SELECT json_agg(row_to_json(fol)) follow_details
            FROM(
                SELECT
                    followup_date
                FROM billing.claim_followups
            WHERE claim_id = ${claim_id}
            ) AS fol
        )
                            
    SELECT * FROM  encounter_details, icd_details, insurance_details , followup_details `;
        return await query(sql);
    },

    getClaimComments: async (params) => {
        let {
            claim_id
        } = params;

        let sql = SQL`WITH agg AS (SELECT
                          cc.id AS id
                        , null AS payment_id
                        , type
                        , note AS comments
                        , created_dt::date as commented_dt
                        , is_internal 
                    FROM 
                        billing.claim_comments cc
                    WHERE cc.claim_id = ${claim_id}   
                    UNION ALL
                    SELECT  
                          ch.id AS id
                        , null AS payment_id
                        , 'charge' as type
                        , cpt.short_description as comments
                        , ch.charge_dt::date as commented_dt
                        , false AS is_internal
                    FROM billing.charges ch
                    INNER JOIN cpt_codes cpt on cpt.id = ch.cpt_id 
                    WHERE ch.claim_id = ${claim_id}
                    UNION ALL
                    SELECT
                          bp.id AS id
                        , bp.id::text AS payment_id
                        , pa.amount_type as type
                        , CASE WHEN bp.payer_type = 'patient' THEN
                                    pp.full_name
                            WHEN bp.payer_type = 'insurance' THEN
                                    pip.insurance_name
                            WHEN bp.payer_type = 'ordering_facility' THEN
                                    pg.group_name
                            WHEN bp.payer_type = 'ordering_provider' THEN
                                    p.full_name
                            END as comments
                        , bp.accounting_dt::date as commented_dt
                        , false AS is_internal
                    FROM billing.payments bp
                    INNER JOIN billing.payment_applications pa on pa.payment_id = bp.id
                    INNER JOIN billing.charges ch on ch.id = pa.charge_id 
                    LEFT JOIN public.patients pp on pp.id = bp.patient_id
                    LEFT JOIN public.insurance_providers pip on pip.id = bp.insurance_provider_id
                    LEFT JOIN public.provider_groups  pg on pg.id = bp.provider_group_id
                    LEFT JOIN public.provider_contacts  pc on pc.id = bp.provider_contact_id
                    LEFT JOIN public.providers p on p.id = pc.provider_id
                    WHERE ch.claim_id = ${claim_id} 
                )
                SELECT
                      id
                    , payment_id
                    , type
                    , comments
                    , commented_dt
                    , is_internal
                    , COUNT(1) OVER (range unbounded preceding) AS total_records
                FROM agg`;

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

    updateClaimComment: async (params) =>{
        let {
            commentId,
            note,
            comments,
            from
        } = params;
        let sql; 

        if(from == 'cb'){
            sql = SQL`WITH agg_cmt AS (
                        SELECT * FROM json_to_recordset(${comments}) AS data
                            (
                                isinternal boolean,
                                commentid bigint
                            )
                        )
                        UPDATE 
                            billing.claim_comments cc
                        SET 
                            is_internal = agg_cmt.isInternal
                        FROM agg_cmt
                        WHERE 
                            id = commentid `;
        } else {   
            sql = SQL`UPDATE 
                        billing.claim_comments
                    SET 
                        note = ${note}
                    WHERE
                        id = ${commentId} `;
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
            logDescription: `Created ${note}(${claim_id})`
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

    saveFollowUpDate: async (params) => {
        let followup_query = '';

        let {
            claim_id,
            followupDate,
            assignedTo
        } = params;

        if (followupDate == '') {
            followup_query = SQL`DELETE FROM 
                                    billing.claim_followups
                                WHERE 
                                    claim_id = ${claim_id}`;
        }
        else {
            followup_query = SQL`WITH 
                                update_followup AS(
                                    UPDATE 
                                        billing.claim_followups 
                                    SET 
                                          followup_date = ${followupDate} 
                                        , assigned_to= ${assignedTo} 
                                    WHERE 
                                        claim_id = ${claim_id}
                                    RETURNING *
                                ), 
                                insert_followup AS(
                                    INSERT INTO billing.claim_followups(
                                          claim_id
                                        , followup_date
                                        , assigned_to
                                    )
                                    SELECT
                                          ${claim_id}
                                        , ${followupDate}
                                        , ${assignedTo}
                                    WHERE 
                                    NOT EXISTS(SELECT * FROM update_followup) 
                                    RETURNING *
                                    )
                            SELECT * FROM update_followup UNION SELECT * FROM insert_followup `;

        }

        return await query(followup_query);
    },

    getFollowupDate: (params) => {
        let {
            claim_id
        } = params;

        return query(SQL`SELECT 
                                followup_date 
                            FROM 
                                billing.claim_followups 
                            WHERE claim_id = ${claim_id}`);
    }
};
