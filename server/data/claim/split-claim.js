const {
    SQL,
    query
} = require('../index');

module.exports = {
    getData: async (params) => {
        let {
            claim_id
        } = params;

        let sql = SQL`SELECT json_agg(row_to_json(claim)) claim_details FROM ( SELECT 
                          bc.id AS claim_no
                        , ch.cpt_id
                        , bc.id AS patient_id  
                        , cpt.display_code AS cpt_code
                        , cpt.display_description AS cpt_description
                        , public.get_full_name(p.last_name, p.first_name, p.middle_name, p.prefix_name, p.suffix_name)
                        , p.account_no
                        , (COALESCE(TRIM(pr.last_name),'') ||' '|| COALESCE(TRIM(pr.first_name),'')) AS referringPhysician
                        , ch.id AS charge_id
                    FROM billing.claims bc
                    INNER JOIN public.patients p ON p.id = bc.patient_id
                    INNER JOIN billing.charges ch ON ch.claim_id = bc.id
                    INNER JOIN public.cpt_codes cpt ON cpt.id = ch.cpt_id
                    LEFT JOIN public.provider_contacts pc ON pc.id = bc.referring_provider_contact_id
                    LEFT JOIN public.providers pr ON pr.id = pc.provider_id
                    WHERE claim_id = ${claim_id} ) AS claim`;

        return await query(sql);

    },

    createClaim: async (params) => {

        let {
            claim_id,
            cpt_ids,
            screenName,
            moduleName,
            clientIp,
            userId,
            companyId
        } = params;

        cpt_ids = cpt_ids.split(',');

        let sql =SQL` WITH new_claim AS (
                        INSERT INTO billing.claims
                            (
                                  company_id 
                                , facility_id
                                , patient_id 
                                , billing_provider_id
                                , rendering_provider_contact_id 
                                , referring_provider_contact_id 
                                , primary_patient_insurance_id 
                                , secondary_patient_insurance_id 
                                , tertiary_patient_insurance_id 
                                , ordering_facility_id 
                                , place_of_service_id 
                                , claim_status_id 
                                , billing_code_id 
                                , billing_class_id 
                                , created_by 
                                , claim_dt 
                                , submitted_dt 
                                , current_illness_date 
                                , same_illness_first_date 
                                , unable_to_work_from_date 
                                , unable_to_work_to_date 
                                , hospitalization_from_date 
                                , hospitalization_to_date 
                                , payer_type 
                                , billing_method 
                                , billing_notes 
                                , claim_notes 
                                , original_reference 
                                , authorization_no 
                                , frequency 
                                , invoice_no 
                                , is_auto_accident 
                                , is_other_accident 
                                , is_employed 
                                , service_by_outside_lab
                            )
                            SELECT  
                                company_id 
                                , facility_id
                                , patient_id 
                                , billing_provider_id
                                , rendering_provider_contact_id 
                                , referring_provider_contact_id 
                                , primary_patient_insurance_id 
                                , secondary_patient_insurance_id 
                                , tertiary_patient_insurance_id 
                                , ordering_facility_id 
                                , place_of_service_id 
                                , (SELECT id FROM billing.claim_status WHERE code = 'PV') 
                                , billing_code_id 
                                , billing_class_id 
                                , created_by 
                                , claim_dt 
                                , submitted_dt 
                                , current_illness_date 
                                , same_illness_first_date 
                                , unable_to_work_from_date 
                                , unable_to_work_to_date 
                                , hospitalization_from_date 
                                , hospitalization_to_date 
                                , payer_type 
                                , billing_method 
                                , billing_notes 
                                , claim_notes 
                                , original_reference 
                                , authorization_no 
                                , frequency 
                                , invoice_no 
                                , is_auto_accident 
                                , is_other_accident 
                                , is_employed 
                                , service_by_outside_lab 
                            FROM billing.claims bc
                            WHERE bc.id = ${claim_id}
                            RETURNING *, '{}'::jsonb old_values 
                        ),
                        update_charge AS (
                            UPDATE 
                                billing.charges ch
                            SET
                                claim_id  = (SELECT id FROM new_claim)
                            WHERE 
                                ch.id = ANY(${cpt_ids})
                            RETURNING *,
                            (
                                SELECT row_to_json(old_row) 
                                FROM   (SELECT * 
                                        FROM   billing.charges 
                                        WHERE  claim_id = ${claim_id} LIMIT 1) old_row 
                            ) old_values
                        ),
                        new_icd AS (
                            INSERT INTO 
                                billing.claim_icds
                                (
                                    claim_id
                                    , icd_id
                                )
                                SELECT 
                                    (SELECT id FROM new_claim)
                                    , icd_id
                                FROM
                                    billing.claim_icds
                                WHERE 
                                    claim_id = ${claim_id}
                                RETURNING *, '{}'::jsonb old_values 
                        ),
                        insert_audit_claim AS (
                            SELECT billing.create_audit(
                                  company_id
                                , ${screenName}
                                , id
                                , ${screenName}
                                , ${moduleName}
                                , 'new claim created '
                                , ${clientIp}
                                , json_build_object(
                                    'old_values', COALESCE(old_values, '{}'),
                                    'new_values', (SELECT row_to_json(temp_row)::jsonb - 'old_values'::text FROM (SELECT * FROM new_claim) temp_row)
                                  )::jsonb
                                , ${userId}
                              ) AS id 
                            FROM new_claim
                            WHERE id IS NOT NULL
                        ),
                        update_audit_charge AS (
                            SELECT billing.create_audit(
                                  ${companyId}
                                , ${screenName}
                                , id
                                , ${screenName}
                                , ${moduleName}
                                , ' Claim Id updated'
                                , ${clientIp}
                                , json_build_object(
                                    'old_values', COALESCE(old_values, '{}'),
                                    'new_values', (SELECT row_to_json(temp_row)::jsonb - 'old_values'::text FROM (SELECT * FROM update_charge limit 1) temp_row)
                                  )::jsonb
                                , ${userId}
                              ) AS id 
                            FROM update_charge
                            WHERE id IS NOT NULL
                        ),
                        insert_audit_icd AS (
                            SELECT billing.create_audit(
                                  ${companyId}
                                , ${screenName}
                                , id
                                , ${screenName}
                                , ${moduleName}
                                , 'New icd created '
                                , ${clientIp}
                                , json_build_object(
                                    'old_values', COALESCE(old_values, '{}'),
                                    'new_values', (SELECT row_to_json(temp_row)::jsonb - 'old_values'::text FROM (SELECT * FROM new_icd limit 1) temp_row)
                                  )::jsonb
                                , ${userId}
                              ) AS id 
                            FROM new_icd
                            WHERE id IS NOT NULL
                        )
                        SELECT id from insert_audit_claim 
                        UNION
                        SELECT id from update_audit_charge 
                        UNION
                        SELECT id from insert_audit_icd   `;

        return await query(sql);
    },

    getvalidatedData: async (params) =>{
        let {
            claim_id
        } = params;

        let sql = SQL`WITH charge_count AS (
                            SELECT 
                                COUNT(1) AS charge_count 
                            FROM 
                                billing.charges 
                            WHERE claim_id = ${claim_id}),
                        payment_count AS(
                            SELECT 
                                COUNT(pa.id) AS payment_count
                            FROM
                                billing.charges ch
                            INNER JOIN billing.payment_applications pa ON pa.charge_id = ch.id
                            WHERE ch.claim_id = ${claim_id}
                        )                        
                        SELECT * FROM charge_count, payment_count `;

        return await query(sql);

    }
};
