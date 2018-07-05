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
            FROM billing.claims bc
            INNER JOIN billing.claim_status st ON st.id = bc.claim_status_id
            INNER JOIN public.facilities f ON f.id = bc.facility_id
            INNER JOIN billing.charges ch ON ch.claim_id = bc.id
            LEFT JOIN public.provider_contacts ref_pc ON ref_pc.id = bc.referring_provider_contact_id
            LEFT JOIN public.provider_contacts rend_pc ON rend_pc.id = bc.rendering_provider_contact_id
            LEFT JOIN public.providers ref_pr ON ref_pr.id = ref_pc.provider_id
            LEFT JOIN public.providers rend_pr ON rend_pr.id = rend_pc.provider_id
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
                  COALESCE(sum(bpa.amount) FILTER(where bp.payer_type = 'patient'),0::money) AS patient_paid
                , COALESCE(sum(bpa.amount) FILTER(where bp.payer_type != 'patient'),0::money) AS others_paid
                , SUM(CASE WHEN amount_type = 'adjustment' THEN bpa.amount ELSE 0::money END) AS adjustment_amount
            FROM billing.claims bc
            INNER JOIN billing.charges ch ON ch.claim_id = bc.id
            LEFT JOIN billing.payment_applications bpa ON bpa.charge_id = ch.id 
            LEFT JOIN billing.payments bp ON bp.id = bpa.payment_id
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
            ) AS icd
        ) 
    , pat_ins_ids AS (
        SELECT
            ARRAY[ primary_patient_insurance_id, secondary_patient_insurance_id, tertiary_patient_insurance_id] AS pi_ids
        FROM billing.claims bc
        WHERE 
            bc.id = ${claim_id}
        )  
    , insurance_details AS 
        ( SELECT json_agg(row_to_json(ins)) insurance_details
        FROM (SELECT
                  ip.id 
                , ip.insurance_code
                , ip.insurance_name
                , (COALESCE(TRIM(pi.subscriber_lastname),'') ||' '|| COALESCE(TRIM(pi.subscriber_firstname),'')) AS name 
                , to_char( pi.subscriber_dob , 'MM/DD/YYYY') AS subscriber_dob
                , pi.policy_number 
                , pi.group_number
            FROM public.patient_insurances pi
            INNER JOIN insurance_providers ip ON ip.id = pi.insurance_provider_id 
            WHERE pi.id = ANY(SELECT UNNEST(pi_ids) FROM  pat_ins_ids)
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
                        , type
                        , type AS code
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
                        , cpt.display_code AS code
                        , 'charge' AS type
                        , cpt.short_description AS comments
                        , ch.charge_dt::date as commented_dt
                        , false AS is_internal
                        , bill_fee AS charge_amount
                        , ARRAY[COALESCE(pointer1, ''), COALESCE(pointer2, ''), COALESCE(pointer3, ''), COALESCE(pointer4, '')] AS charge_pointer
                        , null AS payment
                        , null AS adjustment
                    FROM billing.charges ch
                    INNER JOIN cpt_codes cpt on cpt.id = ch.cpt_id 
                    WHERE ch.claim_id = ${claim_id}
                    UNION ALL
                    SELECT
                          bp.id AS id
                        , bp.id::text AS payment_id
                        , pa.amount_type as code
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
                        , null AS charge_amount
                        , '{}'::text[] AS charge_pointer
                        , SUM(CASE WHEN pa.amount_type = 'payment' THEN pa.amount ELSE 0.00::money END)::text payment
                        , SUM(CASE WHEN pa.amount_type = 'adjustment' THEN pa.amount  ELSE 0.00::money END)::text adjustment  
                    FROM billing.payments bp
                    INNER JOIN billing.payment_applications pa on pa.payment_id = bp.id
                    INNER JOIN billing.charges ch on ch.id = pa.charge_id 
                    LEFT JOIN public.patients pp on pp.id = bp.patient_id
                    LEFT JOIN public.insurance_providers pip on pip.id = bp.insurance_provider_id
                    LEFT JOIN public.provider_groups  pg on pg.id = bp.provider_group_id
                    LEFT JOIN public.provider_contacts  pc on pc.id = bp.provider_contact_id
                    LEFT JOIN public.providers p on p.id = pc.provider_id
                    WHERE 
                        ch.claim_id = ${claim_id}  
                        AND CASE WHEN pa.amount_type = 'adjustment' THEN pa.amount != 0.00::money ELSE 1=1  END 
                    GROUP BY 
                        bp.id ,  
                        pa.amount_type,
                        comments
                )
                SELECT
                      id
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
                                WHEN 'payment' THEN 3
                                WHEN 'adjustment' THEN 4
                                WHEN 'co_insurance' THEN 5
                                WHEN 'deductible' THEN 6 END 
                    )
                FROM agg
                ORDER BY 
                      commented_dt
                    , CASE code 
                        WHEN 'charge' THEN 1
                        WHEN 'auto' THEN 2
                        WHEN 'payment' THEN 3
                        WHEN 'adjustment' THEN 4
                        WHEN 'co_insurance' THEN 5
                        WHEN 'deductible' THEN 6 END `;

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
            from,
            followupDate,
            claim_id,
            assignedTo,
            notes
        } = params;
        let sql; 

        if(from == 'cb'){
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
                        update_billNotes AS ( UPDATE 
                                billing.claims SET billing_notes  = ${notes}
                             WHERE id = ${claim_id} 
                            RETURNING id), `;

            if(followupDate == '')
            {
                sql.append(`update_followup AS (DELETE FROM 
                            billing.claim_followups
                        WHERE 
                            claim_id = ${claim_id} RETURNING id )
                        SELECT * FROM update_cmt, update_billNotes`);
            }
            else{
                sql.append(`update_followup AS(
                    UPDATE 
                        billing.claim_followups 
                    SET 
                          followup_date = '${followupDate}'::DATE
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
                        , '${followupDate}'::DATE  
                        , ${assignedTo}
                    WHERE 
                    NOT EXISTS(SELECT * FROM update_followup) 
                    RETURNING *
                ) 
                SELECT * FROM update_followup UNION SELECT * FROM insert_followup`);
            }

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

    getFollowupDate: async (params) => {
        let {
            claim_id
        } = params;

        return await query(SQL`SELECT 
                                followup_date 
                            FROM 
                                billing.claim_followups 
                            WHERE claim_id = ${claim_id}`);
    },

    viewPaymentDetails: async(params) => {
        let {
            claim_id,
            payment_id
        } = params;

        let sql = `SELECT
                          pa.payment_id
                        , ch.id AS charge_id
                        , ch.bill_fee
                        , ch.allowed_amount
                        , cas.cas_details
                        , pa.payment_amount AS payment
                        , pa.adjustment_amount AS adjustment
                        , cpt.display_code AS cpt_code
                    FROM (SELECT charge_id, id, payment_amount, adjustment_amount, payment_applied_dt, payment_id, payment_application_adjustment_id from billing.get_payment_applications(${payment_id}) ) AS pa
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
                                
                                ) as cas
                    ) cas on true 
                    WHERE ch.claim_id = ${claim_id} 
                    ORDER BY pa.payment_applied_dt ASC `;
        return await query(sql);
    },

    viewChargePaymentDetails: async(params) => {
        let {
            charge_id
        } = params;

        let sql = `SELECT 	  
                          pa.payment_id
                        , ch.id AS charge_id
                        , ch.bill_fee
                        , ch.allowed_amount
                        , cas.cas_details
                        , pa.amount as payment
                        , pa_adjustment.amount as adjustment
                        , cpt.display_code AS cpt_code
                    FROM	billing.payment_applications pa
                    INNER JOIN billing.charges ch ON ch.id = pa.charge_id
                    INNER JOIN public.cpt_codes cpt ON cpt.id = ch.cpt_id
                    LEFT JOIN LATERAL (
                        SELECT 	* 
                        FROM	billing.payment_applications  
                        WHERE	payment_application_id = pa.id
                    ) pa_adjustment ON true
                    LEFT JOIN LATERAL (
                        SELECT json_agg(row_to_json(cas)) AS cas_details
                            FROM ( SELECT 
                                    cas.amount, 
                                    rc.code
                                FROM billing.cas_payment_application_details cas 
                                INNER JOIN billing.cas_reason_codes rc ON rc.id = cas.cas_reason_code_id
                                WHERE  cas.payment_application_id = pa.payment_application_adjustment_id
                                ) as cas
                    ) cas on true 
                    WHERE	pa.charge_id = ${charge_id}
                        AND pa.payment_application_id is null  
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
            patientId
        } = params;

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
                        , claim_status.description as claim_status
                        , (select payment_patient_total from billing.get_claim_payments(claims.id)) AS total_patient_payment
                        , (select payment_insurance_total from billing.get_claim_payments(claims.id)) AS total_insurance_payment 
                        , (select charges_bill_fee_total from BILLING.get_claim_payments(claims.id)) as billing_fee
                        , (select charges_bill_fee_total - (payments_applied_total + adjustments_applied_total) from BILLING.get_claim_payments(claims.id)) as claim_balance
                        , COUNT(1) OVER (range unbounded preceding) AS total_records
                        ,(select Row_to_json(agg_arr) agg_arr FROM (SELECT * FROM billing.get_age_claim_payments (patients.id) )as agg_arr) as age_summary
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


        sql.append(SQL` ORDER BY  `)
            .append(sortField)
            .append(' ')
            .append(sortOrder)
            .append(SQL` LIMIT ${pageSize}`)
            .append(SQL` OFFSET ${((pageNo * pageSize) - pageSize)}`);

        return await query(sql);
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
            whereQuery.push(` username ILIKE '%${username}%'`);
        }

        if (screen_name) {
            whereQuery.push(` screen_name ILIKE '%${screen_name}%'`);
        }

        if (description) {
            whereQuery.push(` description ILIKE '%${description}%'`);
        }

        if (created_dt) {
            whereQuery.push(` ((created_dt)::date =('${created_dt}')::date) `);
        }

        let sql = SQL`SELECT audit_log.id,
                        users.username,
                        created_dt,        
                        screen_name,
                        description
                        FROM billing.claims 
                        INNER JOIN billing.audit_log on audit_log.entity_key =claims.id 
                        INNER JOIN  users on  users.id=audit_log.created_by
                        WHERE  patient_id=${patientId}  AND entity_name='claims'
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
