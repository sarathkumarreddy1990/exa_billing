const { query, SQL } = require('../index');

module.exports = {
    getData: async (params) => {
        let {
            id
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
                , COALESCE(sum(bpa.amount) FILTER(where bp.payer_type = 'patient'),0::money) AS patient_paid
                , COALESCE(sum(bpa.amount) FILTER(where bp.payer_type != 'patient'),0::money) AS others_paid
                , SUM(CASE WHEN amount_type = 'adjustment' THEN bpa.amount ELSE 0::money END) AS adjustment_amount
                , (SELECT SUM(claim_balance_total) FROM billing.get_claim_totals(bc.id)) AS claim_balance
            FROM billing.claims bc
            INNER JOIN public.provider_contacts ref_pc ON ref_pc.id = bc.rendering_provider_contact_id
            INNER JOIN public.provider_contacts rend_pc ON rend_pc.id = bc.rendering_provider_contact_id
            INNER JOIN public.providers ref_pr ON ref_pr.id = ref_pc.provider_id
            INNER JOIN public.providers rend_pr ON rend_pr.id = rend_pc.provider_id
            INNER JOIN billing.claim_status st ON st.id = bc.claim_status_id
            INNER JOIN public.facilities f ON f.id = bc.facility_id
            INNER JOIN billing.charges ch ON ch.claim_id = bc.id
            LEFT JOIN billing.payment_applications bpa ON bpa.charge_id = ch.id 
            LEFT JOIN billing.payments bp ON bp.id = bpa.payment_id
            WHERE 
                bc.id = 4262
            GROUP BY    
                  bc.id
                , ref_pr.full_name  
                , rend_pr.full_name
                , f.facility_name
                , st.description) AS encounter
        )  
    , icd_details AS
        (SELECT json_agg(row_to_json(icd)) icdcode_details
         FROM (
            SELECT 
                  icd.code
                , icd.description
            FROM
                billing.claim_icds ci
            INNER JOIN public.icd_codes icd ON icd.id = ci.icd_id
            WHERE ci.claim_id = 4262   
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
            bc.id = ${id}
        )  
    , insurance_details AS 
        ( SELECT json_agg(row_to_json(ins)) ins_details
        FROM (SELECT 
                  insurance_code
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
            WHERE claim_id = 4262
            ) AS fol
        )
                            
    SELECT * FROM  encounter_details, icd_details, insurance_details , followup_details `;
        return await query(sql);
    }
};
