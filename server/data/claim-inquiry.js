const { query, SQL } = require('./index');

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

        let sql = SQL`SELECT
                          cc.id AS id
                        , null AS payment_id
                        , type
                        , note as comments
                        , created_dt::date as commented_dt
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
                    FROM billing.charges ch
                    INNER JOIN cpt_codes cpt on cpt.id = ch.cpt_id 
                    WHERE ch.claim_id = ${claim_id}
                    UNION ALL
                    SELECT
                          bp.id AS id
                        , bp.id::text AS payment_id
                        , amount_type as type
                        , CASE WHEN bp.payer_type = 'patient' THEN
                                    pp.full_name
                            WHEN bp.payer_type = 'insurance' THEN
                                    pip.insurance_name
                            WHEN bp.payer_type = 'ordering_facility' THEN
                                    pg.group_name
                            WHEN bp.payer_type = 'ordering_provider' THEN
                                    p.full_name
                        END as comments,
                        bp.accounting_dt::date as commented_dt
                    FROM billing.payments bp
                    INNER JOIN billing.payment_applications pa on pa.payment_id = bp.id
                    INNER JOIN billing.charges ch on ch.id = pa.charge_id 
                    LEFT JOIN public.patients pp on pp.id = bp.patient_id
                    LEFT JOIN public.insurance_providers pip on pip.id = bp.insurance_provider_id
                    LEFT JOIN public.provider_groups  pg on pg.id = bp.provider_group_id
                    LEFT JOIN public.provider_contacts  pc on pc.id = bp.provider_contact_id
                    LEFT JOIN public.providers p on p.id = pc.provider_id
                    WHERE ch.claim_id = ${claim_id} `;

        return await query(sql);
    },

    getClaimComment: async (params) => {
        let {
            comment_id
        } = params;

        let sql = `SELECT 
                      id
                    , note AS comments
                    FROM 
                        billing.claim_comments
                    WHERE id = ${comment_id}`;

        return await query(sql);
    }
};
