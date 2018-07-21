const SearchFilter = require('./claim-search-filters');
const { SQL, query, queryWithAudit } = require('../index');

module.exports = {

    getData: async function (args) {
        return await SearchFilter.getWL(args);
    },

    deleteClaimOrCharge: async (params) => {
        const { target_id, clientIp, entityName, userId, companyId, type } = params;
        const screenName = 'claims';

        let audit_json = {
            client_ip: clientIp,
            screen_name: screenName,
            entity_name: entityName,
            module_name: screenName,
            user_id: userId,
            company_id: companyId
        };

        params.audit_json = JSON.stringify(audit_json);

        const sql = SQL` SELECT billing.purge_claim_or_charge(${target_id}, ${type}, ${params.audit_json}::json)`;

        return await query(sql);
    },

    updateClaimStatus: async (params) => {

        const {
            claim_status_id,
            billing_code_id,
            billing_class_id,
            screenName,
            clientIp,
            claimIds,
            companyId,
            userId
        } = params;

        params.logDescriptions = 'Updated ' + params.process + '  for claims ';
        params.moduleName = 'claims';

        let updateData;

        if (params.claim_status_id) {
            updateData = SQL`claim_status_id = ${claim_status_id}`;
        } else if (params.billing_code_id) {
            updateData = SQL`billing_code_id = ${billing_code_id}`;
        } else if (params.billing_class_id) {
            updateData = SQL`billing_class_id = ${billing_class_id}`;
        }

        let sql = SQL`with update_cte as (UPDATE
                             billing.claims 
                        SET                          
                    `;

        sql.append(updateData);
        sql.append(SQL`WHERE  id = ANY(${claimIds}) RETURNING id, '{}'::jsonb old_values)`);

        sql.append(SQL`SELECT billing.create_audit(
                                  ${companyId}
                                , ${screenName}
                                , id
                                , ${screenName}
                                , ${params.moduleName}
                                , ${params.logDescriptions} || id
                                , ${clientIp}
                                , json_build_object(
                                    'old_values', COALESCE(old_values, '{}'),
                                    'new_values', (SELECT row_to_json(temp_row)::jsonb - 'old_values'::text FROM (SELECT * FROM update_cte LIMIT 1 ) temp_row)
                                    )::jsonb
                                , ${userId}
                                ) AS id 
                                FROM update_cte
                                WHERE id IS NOT NULL
                            `);

        return await query(sql);
    },

    /// TODO: bad fn name -- need to rename
    updateValidateClaimStatus: async (params) => {
        params.screenName = params.entityName = params.moduleName = 'claims';    
        params.logDescriptions= `Validate claims for `;    
        let sql = SQL`WITH getStatus AS 
						(
							SELECT 
								id
							FROM 
								billing.claim_status
							WHERE code  = 'PS'
						)	
						,update_cte AS (UPDATE 
							billing.claims bc
						SET claim_status_id = (SELECT id FROM getStatus)
						WHERE bc.id = ANY(${params.success_claimID})
                        RETURNING bc.id,'{}'::jsonb old_values)
                        SELECT billing.create_audit(
                            ${params.companyId}
                          , ${params.screenName}
                          , id
                          , ${params.screenName}
                          , ${params.moduleName}
                          , ${params.logDescriptions} || id
                          , ${params.clientIp}
                          , json_build_object(
                              'old_values', COALESCE(old_values, '{}'),
                              'new_values', (SELECT row_to_json(temp_row)::jsonb - 'old_values'::text FROM (SELECT * FROM update_cte LIMIT 1 ) temp_row)
                              )::jsonb
                          , ${params.userId}
                          ) AS id 
                          FROM update_cte
                          WHERE id IS NOT NULL`;

        return await query(sql);
    },

    changeClaimStatus: async (params) => {

        //let success_claimID = params.success_claimID.split(',');

        let getClaimsDetails = SQL` ,getClaimsDetails as (                
                SELECT claims.id,payer_type, (  CASE payer_type 
                    WHEN 'primary_insurance' THEN insurance_providers.insurance_name
                    WHEN 'secondary_insurance' THEN insurance_providers.insurance_name
                    WHEN 'tertiary_insurance' THEN insurance_providers.insurance_name
                    WHEN 'ordering_facility' THEN provider_groups.group_name
                    WHEN 'referring_provider' THEN ref_provider.full_name
                    WHEN 'rendering_provider' THEN render_provider.full_name
                    WHEN 'patient' THEN patients.full_name        END)   || '(' ||  payer_type  ||')' as payer_name 
                FROM billing.claims 

                LEFT JOIN patient_insurances ON patient_insurances.id = 
                        (  CASE payer_type 
                        WHEN 'primary_insurance' THEN primary_patient_insurance_id
                        WHEN 'secondary_insurance' THEN secondary_patient_insurance_id
                        WHEN 'teritary_insurance' THEN tertiary_patient_insurance_id
                        END)

                INNER JOIN patients ON claims.patient_id = patients.id 
                LEFT JOIN insurance_providers ON patient_insurances.insurance_provider_id = insurance_providers.id
                LEFT JOIN provider_contacts  ON provider_contacts.id=claims.referring_provider_contact_id 
                LEFT JOIN providers as ref_provider ON ref_provider.id=provider_contacts.provider_id
                LEFT JOIN provider_groups ON claims.ordering_facility_id = provider_groups.id 
                LEFT JOIN provider_contacts as rendering_pro_contact ON rendering_pro_contact.id=claims.rendering_provider_contact_id
                LEFT JOIN providers as render_provider ON render_provider.id=rendering_pro_contact.provider_id

                WHERE claims.id=${params.success_claimID[0]} ) 
        `;

        let insertClaimComments =
            SQL` , claim_details AS (
            SELECT 
                  "claim_id",
                 "note"  
            FROM json_to_recordset(${params.claimDetails}) AS claimDetails 
            (
                "claim_id" bigint,
                "note" text
            )
        ),
        insert_claim_comments as ( 
                INSERT INTO billing.claim_comments 
                ( 
                    claim_id , 
                    type , 
                    note , 
                    created_by, 
                    created_dt 
                )              
                `;
        let getpaymentComments = SQL`  SELECT
                        claim_id,
                        ${params.type},
                        note || ( SELECT payer_name FROM getClaimsDetails),
                        ${params.userId},   
                        now()
                    FROM 
                    claim_details )`;

        let getEDIpaymentComments = SQL`SELECT
                                        claim_id,
                                        ${params.type},
                                        note,
                                        ${params.userId},   
                                        now()
                                        FROM 
                                    claim_details )`;
        let sql = SQL`WITH getStatus AS 
						(
							SELECT 
								id
							FROM 
								billing.claim_status
							WHERE code  = ${params.claim_status}
                        )`;

        if (params.templateType) {
            sql.append(getClaimsDetails);
        }

        if (params.isClaim) {
            sql.append(insertClaimComments);

            if (params.templateType) {
                sql.append(getpaymentComments);
            } else {
                sql.append(getEDIpaymentComments);
            }
        }

        let updateData = SQL`UPDATE 
							billing.claims bc
                        SET claim_status_id = (SELECT id FROM getStatus),
                            invoice_no = (SELECT billing.get_invoice_no(${params.success_claimID})),
                            submitted_dt=timezone(get_facility_tz(bc.facility_id::int), now()::timestamp)
						WHERE bc.id = ANY(${params.success_claimID})
                        RETURNING bc.id,invoice_no`;

        let updateEDIData = SQL`UPDATE 
                            billing.claims bc
                        SET claim_status_id = (SELECT id FROM getStatus) ,
                        submitted_dt=timezone(get_facility_tz(bc.facility_id::int), now()::timestamp)                
                        WHERE bc.id = ANY(${params.success_claimID})
                        RETURNING bc.id`;


        if (params.templateType && params.templateType != 'patient_invoice') {
            sql.append(updateData);
        } else {
            sql.append(updateEDIData);
        }

        return await query(sql);
    },

    getClaimStudy: async (params) => {

        let {
            claim_id
        } = params;

        let sql = SQL`				
                    SELECT  study_id,
                            studies.order_id 
					FROM    billing.charges_studies 
                            INNER JOIN billing.charges ON billing.charges.id = billing.charges_studies.charge_id 
                            INNER JOIN public.studies ON public.studies.id = billing.charges_studies.study_id 
					WHERE   billing.charges.claim_id = ${claim_id}
					LIMIT   1`;

        return await query(sql);
    },

    getBillingPayers: async function (params) {
        const sql = SQL`
                        SELECT 
                            c.patient_id
                            , c.facility_id 
                            , c.referring_provider_contact_id
                            , c.primary_patient_insurance_id
                            , c.secondary_patient_insurance_id
                            , c.tertiary_patient_insurance_id
                            , c.ordering_facility_id
                            , pg.group_name AS ordering_facility_name
                            , ipp.insurance_name AS p_insurance_name
                            , ips.insurance_name AS s_insurance_name
                            , ipt.insurance_name AS t_insurance_name
                            , ref_pr.full_name AS ref_prov_full_name
                            , p.full_name AS patient_full_name
                            , f.facility_name 
                        FROM
                            billing.claims c
                        INNER JOIN public.patients p ON p.id = c.patient_id
                        LEFT JOIN public.patient_insurances cpi ON cpi.id = c.primary_patient_insurance_id
                        LEFT JOIN public.patient_insurances csi ON csi.id = c.secondary_patient_insurance_id
                        LEFT JOIN public.patient_insurances cti ON cti.id = c.tertiary_patient_insurance_id
                        LEFT JOIN public.insurance_providers ipp ON ipp.id = cpi.insurance_provider_id
                        LEFT JOIN public.insurance_providers ips ON ips.id = csi.insurance_provider_id
                        LEFT JOIN public.insurance_providers ipt ON ipt.id = cti.insurance_provider_id
                        LEFT JOIN public.provider_contacts ref_pc ON ref_pc.id = c.referring_provider_contact_id
                        LEFT JOIN public.providers ref_pr ON ref_pc.provider_id = ref_pr.id
                        LEFT JOIN public.provider_contacts rend_pc ON rend_pc.id = c.rendering_provider_contact_id
                        LEFT JOIN public.provider_groups pg ON pg.id = c.ordering_facility_id
                        LEFT JOIN public.facilities f ON f.id = c.facility_id
                        WHERE 
                            c.id = ${params.id}`;

        return await query(sql);

    },

    updateBillingPayers: async function (params) {
        params.screenName = params.entityName = params.moduleName = 'claims';        
        const sql = SQL`
                        SELECT id,
                        billing.change_payer_type(claims.id,${params.payer_type})
                        ,'{}'::jsonb old_values from billing.claims WHERE id=${params.id}
                        `;

        return await queryWithAudit(sql, {
            ...params,
            logDescription: `Change claim payer type (${params.payer_type}) for claims(${params.id})`
        });
    },

    updateFollowUp: async (params) => {
        let {
            claimIDs,
            assignedTo,
            followupDate,
            followUpDetails,
            companyId,
            screenName,
            clientIp,
            userId
        } = params;
        let sql;
        claimIDs = claimIDs.split(',');

        if (followupDate == '') {
            sql = SQL`
                    DELETE FROM 
                        billing.claim_followups
                    WHERE 
                        claim_id = ANY(${claimIDs}) RETURNING * `;
        }
        else {
            sql = SQL`WITH update_followup AS(
                UPDATE 
                    billing.claim_followups 
                SET 
                      followup_date = ${followupDate}
                    , assigned_to= ${assignedTo} 
                WHERE 
                    claim_id = ANY(${claimIDs})
                RETURNING * , '{}'::jsonb old_values
            ), 
            followup_details AS (
                SELECT 
                      "claimID" AS claim_id
                    , "assignedTo" AS assigned_to
                    , "followupDate" AS followup_date
                FROM json_to_recordset(${followUpDetails}) AS followup 
                (
                    "claimID" bigint,
                    "assignedTo" integer,
                    "followupDate" date
                )
            ),
            insert_followup AS(
                INSERT INTO billing.claim_followups(
                      claim_id
                    , followup_date
                    , assigned_to
                )
                SELECT
                      claim_id
                    , followup_date  
                    , assigned_to
                FROM 
                    followup_details
                WHERE NOT EXISTS ( SELECT claim_id FROM billing.claim_followups  WHERE billing.claim_followups.claim_id = followup_details.claim_id )
                RETURNING *, '{}'::jsonb old_values
            ),
            insert_audit_followup AS (
                SELECT billing.create_audit(
                      ${companyId}
                    , 'claims'
                    , id
                    , ${screenName}
                    , 'claims'
                    , 'New Followup for Claim created ' || insert_followup.id || '  Claim ID  ' ||  insert_followup.claim_id
                    , ${clientIp}
                    , json_build_object(
                        'old_values', COALESCE(old_values, '{}'),
                        'new_values', (SELECT row_to_json(temp_row)::jsonb - 'old_values'::text FROM (SELECT * FROM insert_followup limit 1) temp_row)
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
                    , ${screenName}
                    , 'claims'
                    , 'Follow Up Updated  ' || update_followup.id ||' Date ' || update_followup.followup_date || ' Claim ID  ' || update_followup.claim_id
                    , ${clientIp}
                    , json_build_object(
                        'old_values', COALESCE(old_values, '{}'),
                        'new_values', (SELECT row_to_json(temp_row)::jsonb - 'old_values'::text FROM (SELECT * FROM update_followup limit 1 ) temp_row)
                      )::jsonb
                    , ${userId}
                  ) AS id 
                FROM update_followup
                WHERE id IS NOT NULL
            )
            SELECT * FROM insert_audit_followup UNION SELECT * FROM update_audit_followup `;
        }

        return await query(sql);
    },

    createBatchClaims: async function (params) {
        let {
            study_ids,
            auditDetails
        } = params;

        const sql = SQL`
                    WITH batch_claim_details AS (
                        SELECT 
		                    patient_id, study_id 
	                    FROM
	                        json_to_recordset(${study_ids}) AS study_ids 
		                    ( 
		                        patient_id bigint,
		                        study_id bigint
                            )
                    ), details AS (
                        SELECT bcd.study_id, d.* 
                        FROM 
                           batch_claim_details bcd 
                        LEFT JOIN LATERAL (select * from billing.get_batch_claim_details(bcd.study_id, ${params.created_by})) d ON true
                      )
                      SELECT 
                        billing.create_claim_charge(
                            details.claims, 
                            details.insurances, 
                            details.claim_icds, 
                            (${JSON.stringify(auditDetails)})::json, 
                            details.charges)  
                      FROM details
                        `;

        return await query(sql);
    },

    getClaimDataInvoice: function (params) {
        let { claimIDs } = params;

        let sql = SQL` SELECT 
                          array_length (array_agg(DISTINCT bc.id), 1) AS claim_count
                        , array_to_string(array_agg(DISTINCT bc.id), '_')  AS claimids 
                        , CASE WHEN bc.payer_type = 'patient' THEN
                                        p.full_name
                                WHEN bc.payer_type = 'primary_insurance' THEN
                                        pip.insurance_name
                                WHEN bc.payer_type = 'secondary_insurance' THEN
                                        sip.insurance_name
                                WHEN bc.payer_type = 'tertiary_insurance' THEN
                                        tip.insurance_name
                                WHEN bc.payer_type = 'ordering_facility' THEN  
                                        pg.group_name
                                WHEN bc.payer_type = 'referring_provider' THEN
                                        pr.full_name
                                END as payer_name
                        , SUM(ch.bill_fee * ch.units)  AS tot_bill_fee
                        , CASE WHEN bc.payer_type = 'patient' THEN
                                        'PPP'
                                WHEN bc.payer_type = 'primary_insurance' THEN
                                        'PIP'
                                WHEN bc.payer_type = 'secondary_insurance' THEN
                                        'SIP'
                                WHEN bc.payer_type = 'tertiary_insurance' THEN
                                        'SIP'
                                WHEN bc.payer_type = 'ordering_facility' THEN  
                                        'POF'
                                WHEN bc.payer_type = 'referring_provider' THEN
                                        'PR'
                                END as payer
                    FROM billing.claims bc
                    INNER JOIN billing.charges ch ON ch.claim_id = bc.id
                    LEFT JOIN public.patients p ON p.id = bc.patient_id
                    LEFT JOIN public.patient_insurances ppi ON ppi.id = bc.primary_patient_insurance_id
                    LEFT JOIN public.insurance_providers pip on pip.id = ppi.insurance_provider_id
                    LEFT JOIN public.patient_insurances spi ON spi.id = bc.secondary_patient_insurance_id
                    LEFT JOIN public.insurance_providers sip on sip.id = spi.insurance_provider_id
                    LEFT JOIN public.patient_insurances tpi ON tpi.id = bc.tertiary_patient_insurance_id
                    LEFT JOIN public.insurance_providers tip on tip.id = tpi.insurance_provider_id
                    LEFT JOIN public.provider_groups  pg on pg.id = bc.ordering_facility_id  
                    LEFT JOIN public.provider_contacts  pc on pc.id = bc.referring_provider_contact_id
                    LEFT JOIN public.providers pr on pr.id = pc.provider_id 
                    WHERE bc.id = ANY(${claimIDs})
                    GROUP BY 
                          payer_name 
                        , payer`;

        return query(sql);
    },

    updateInvoiceNo: async (params) => {
        let {
            companyId,
            invoiceNo,
            screenName,
            clientIp,
            userId
        } = params;

        let sql = SQL`WITH reset_invoice_no AS (
                    UPDATE 
                        billing.claims bc
                    SET
                        invoice_no = null,
                        submitted_dt = null
                    WHERE
                        bc.invoice_no = ${invoiceNo}
                    RETURNING * ,
                        (
                            SELECT row_to_json(old_row) 
                            FROM   (SELECT * 
                                    FROM   billing.claims 
                                    WHERE  invoice_no = ${invoiceNo} LIMIT 1) old_row 
                        ) old_values
                    ),
                    update_audit_invoice AS (
                        SELECT billing.create_audit(
                              ${companyId}
                            , 'claims'
                            , id
                            , ${screenName}
                            , 'claims'
                            , 'Invoice Number Resetted  Claim ID  '|| reset_invoice_no.id 
                            , ${clientIp}
                            , json_build_object(
                                'old_values', COALESCE(old_values, '{}'),
                                'new_values', (SELECT row_to_json(temp_row)::jsonb - 'old_values'::text FROM (SELECT * FROM reset_invoice_no limit 1 ) temp_row)
                              )::jsonb
                            , ${userId}
                          ) AS id 
                        FROM reset_invoice_no
                        WHERE id IS NOT NULL
                    )
                    SELECT * FROM update_audit_invoice `;

        return await query(sql);
    }
};
