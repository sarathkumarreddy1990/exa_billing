const SearchFilter = require('./claim-search-filters');
const { SQL, query, queryWithAudit, queryRows } = require('../index');
const filterValidator = require('./../filter-validator')();

module.exports = {

    getData: async function (args) {
        return await SearchFilter.getWL(args);
    },

    checkPaymentDetails: async function (args) {

        const sql = SQL` SELECT
                              sum(payments_applied_total)::numeric as claim_applied
                            , sum(adjustments_applied_total)::numeric as claim_adjustment
                            , sum(refund_amount)::numeric as claim_refund
                        FROM billing.get_claim_totals(${args.target_id})`;

        return await query(sql);
    },

    checkChargePaymentDetails: async function (args) {

        const sql = SQL` SELECT
                            COUNT(1) AS is_payment_available
                        FROM billing.payment_applications
                        WHERE charge_id = ${args.charge_id}
                        AND amount != 0::money`;

        return await query(sql);
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

        const sql = SQL` SELECT billing.purge_claim_or_charge(${target_id}, ${type}, ${params.audit_json}::jsonb)`;

        try {
            return await query(sql);
        }
        catch (e) {
            console.error(e);
            return null;
        }
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
            userId,
            billing_option
        } = params;

        params.logDescriptions = 'Updated ' + params.process + '  for claims ';
        params.moduleName = 'claims';

        let updateData;

        if (params.claim_status_id) {
            updateData = SQL`claim_status_id = ${claim_status_id}`;
        } else if (billing_option ==='BILLINGCODE' || params.billing_code_id) {
            updateData = SQL`billing_code_id =  NULLIF(${billing_code_id},'')::bigint`;
        } else if (billing_option ==='BILLINGCLASS' || params.billing_class_id) {
            updateData = SQL`billing_class_id =  NULLIF(${billing_class_id},'')::bigint`;
        }

        let sql = SQL`with update_cte as (UPDATE
                             billing.claims
                        SET
                    `;

        sql.append(updateData);
        sql.append(SQL` WHERE  id = ANY(${claimIds}) RETURNING id, '{}'::jsonb old_values)`);

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
        let {
            userId,
            clientIp,
            companyId,
            screenName,
            entityName,
            moduleName,
            success_claimID
        } = params;

        let sql = SQL`WITH getStatus AS (
							SELECT
							    id
							FROM billing.claim_status
							WHERE code = 'PS')
						, update_cte AS (
                            UPDATE billing.claims bc
                            SET
                                claim_status_id = (SELECT id FROM getStatus)
						    WHERE bc.id = ANY(${success_claimID})
                            RETURNING *,
                                      bc.xmin as claim_row_version,
                                      (SELECT row_to_json(old_row) FROM (
                                          SELECT
                                            *
                                          FROM billing.claims i_bc
                                          WHERE i_bc.id = bc.id) old_row
                                      ) old_values
                            )
                            SELECT billing.create_audit(
                                  ${companyId}
                                , lower(${entityName})
                                , uc.id
                                , ${screenName}
                                , ${moduleName}
                                , 'Claim has validated and status changed to Pending Submission Id: ' || uc.id
                                , ${clientIp}
                                , json_build_object(
                                    'old_values', COALESCE(old_values, '{}'),
                                    'new_values', (SELECT row_to_json(temp_row)::jsonb - 'old_values'::text FROM (SELECT * FROM update_cte i_uc WHERE i_uc.id = uc.id) temp_row)
                                    )::jsonb
                                , ${userId}
                                ) AS id, claim_row_version, claim_status_id
                                FROM update_cte uc
                                WHERE id IS NOT NULL`;

        return await query(sql);
    },

    changeClaimStatus: async (params) => {
        let {
            type,
            notes,
            userId,
            isClaim,
            clientIp,
            auditDesc,
            payerType,
            companyId,
            screenName,
            moduleName,
            entityName,
            claim_status,
            claimDetails,
            templateType,
            success_claimID
        } = params;

        let getClaimsDetails = SQL` ,claim_details as (
                SELECT claims.id as claim_id, ${notes} || ' ' ||
                (  CASE  COALESCE(${payerType}, payer_type)
                    WHEN 'primary_insurance' THEN insurance_providers.insurance_name
                    WHEN 'secondary_insurance' THEN insurance_providers.insurance_name
                    WHEN 'tertiary_insurance' THEN insurance_providers.insurance_name
                    WHEN 'ordering_facility' THEN ordering_facilities.name
                    WHEN 'referring_provider' THEN ref_provider.full_name
                    WHEN 'rendering_provider' THEN render_provider.full_name
                    WHEN 'patient' THEN patients.full_name        END)   || '(' || COALESCE(${payerType}, payer_type) ||')' as note
                FROM billing.claims

                LEFT JOIN patient_insurances ON patient_insurances.id =
                        (  CASE  COALESCE(${payerType}, payer_type)
                        WHEN 'primary_insurance' THEN primary_patient_insurance_id
                        WHEN 'secondary_insurance' THEN secondary_patient_insurance_id
                        WHEN 'tertiary_insurance' THEN tertiary_patient_insurance_id
                        END)

                INNER JOIN patients ON claims.patient_id = patients.id
                LEFT JOIN insurance_providers ON patient_insurances.insurance_provider_id = insurance_providers.id
                LEFT JOIN provider_contacts  ON provider_contacts.id=claims.referring_provider_contact_id
                LEFT JOIN providers as ref_provider ON ref_provider.id=provider_contacts.provider_id
                LEFT JOIN ordering_facility_contacts ON claims.ordering_facility_contact_id = ordering_facility_contacts.id
                LEFT JOIN ordering_facilities ON ordering_facilities.id = ordering_facility_contacts.ordering_facility_id
                LEFT JOIN provider_contacts as rendering_pro_contact ON rendering_pro_contact.id=claims.rendering_provider_contact_id
                LEFT JOIN providers as render_provider ON render_provider.id=rendering_pro_contact.provider_id

                WHERE claims.id= ANY (${success_claimID}) )
        `;

        let claimComments =
            SQL` , claim_details AS (
            SELECT
                  "claim_id",
                 "note"
            FROM json_to_recordset(${claimDetails}) AS claimDetails
            (
                "claim_id" bigint,
                "note" text
            )
        )`;

        let insertedClaimComments =
            SQL`, insert_claim_comments as (
                    INSERT INTO billing.claim_comments
                    (
                        claim_id ,
                        type ,
                        note ,
                        created_by,
                        created_dt
                    )
                    `;
        let paymentComments = SQL`
                    SELECT
                        claim_id,
                        ${type},
                        COALESCE(note, ''),
                        ${userId},
                        now()
                    FROM
                    claim_details )`;

        let invoiceComments = SQL`
                SELECT
                    claim_id,
                    ${type},
                    CASE WHEN update_status.invoice_no IS NULL THEN
                        COALESCE(note, ' ')
                    ELSE
                        COALESCE(note, ' ') ||' -- Invoice No ' || COALESCE(update_status.invoice_no, ' ') END,
                    ${userId},
                    now()
                FROM
                claim_details
                INNER JOIN  update_status ON update_status.id = claim_details.claim_id  )`;

        let sql = SQL`WITH getStatus AS
						(
							SELECT
								id
							FROM
								billing.claim_status
							WHERE code  = ${claim_status}
                        )`;

        if (templateType) {
            sql.append(getClaimsDetails);
        }

        let updateData = SQL` , update_status AS(
                                    UPDATE
                                        billing.claims bc
                                    SET claim_status_id = (SELECT id FROM getStatus),
                                        invoice_no = (SELECT NEXTVAL('billing.invoice_no_seq')
                                        WHERE
                                            bc.billing_method IN ('direct_billing')),
                                        submitted_dt=timezone(get_facility_tz(bc.facility_id::int), now()::timestamp)
                                    WHERE bc.id = ANY(${success_claimID})
                                    RETURNING *,
                                    (SELECT row_to_json(old_row) FROM (
                                                  SELECT
                                                    *
                                                  FROM billing.claims i_bc
                                                  WHERE i_bc.id = bc.id) old_row
                                    ) old_values) `;

        let updateEDIData = SQL`, update_status AS (
                                    UPDATE billing.claims bc
                                    SET claim_status_id = (SELECT id FROM getStatus),
                                        submitted_dt=timezone(get_facility_tz(bc.facility_id::int), now()::timestamp)
                                    WHERE bc.id = ANY(${success_claimID})
                                    RETURNING *,
                                    (SELECT row_to_json(old_row) FROM (
                                                SELECT
                                                   *
                                                FROM billing.claims i_bc
                                                WHERE i_bc.id = bc.id) old_row
                                    ) old_values) `;

        let updateClaimAuditData =SQL`, update_claim_audit_cte AS(
                                        SELECT billing.create_audit (
                                            ${companyId},
                                            lower(${entityName}),
                                            us.id,
                                            ${screenName},
                                            ${moduleName},
                                            ${auditDesc} || ' ID :' || us.id,
                                            ${clientIp},
                                            json_build_object(
                                                'old_values', COALESCE(us.old_values, '{}'),
                                                'new_values', ( SELECT row_to_json(temp_row)::jsonb - 'old_values'::text FROM ( SELECT * FROM update_status i_us where i_us.id = us.id) temp_row))::jsonb,
                                            ${userId}) id
                                        FROM update_status us) `;

        if (templateType && templateType != 'patient_invoice') {
            sql.append(updateData);
        } else {
            sql.append(updateEDIData);
        }

        sql.append(updateClaimAuditData);

        if (isClaim) {

            if (!templateType) {
                sql.append(claimComments);
            }

            sql.append(insertedClaimComments);

            if (templateType && templateType != 'patient_invoice') {
                sql.append(invoiceComments);
            } else {
                sql.append(paymentComments);
            }

        }

        if (templateType && templateType != "patient_invoice") {
            sql.append(SQL`
                        SELECT
                            claim_details.claim_id AS id
                          , invoice_no
                        FROM claim_details
                        INNER JOIN update_status ON update_status.id = claim_details.claim_id
                        UNION
                        SELECT
                            null,
                            null
                        FROM update_claim_audit_cte`);
        } else {
            sql.append(SQL`
                        SELECT
                            claim_details.claim_id AS id
                        FROM claim_details
                        UNION
                        SELECT
                            null
                        FROM update_claim_audit_cte`);
        }


        return await query(sql);
    },

    getClaimStudy: async (params) => {

        let {
            claim_id
        } = params;

        let sql = SQL`
                    SELECT
                        study_id,
                        studies.order_id,
                        studies.study_status,
                        CASE
                            WHEN studies.study_status = 'APP' THEN 1
                            ELSE 2
                        END  AS status_index,
                        split_claims.split_claim_ids
                    FROM
                        billing.charges_studies
                    INNER JOIN billing.charges ON billing.charges.id = billing.charges_studies.charge_id
                    INNER JOIN public.studies ON public.studies.id = billing.charges_studies.study_id
                    LEFT JOIN LATERAL (
                        SELECT
                            ARRAY_AGG(DISTINCT(bch.claim_id)) AS split_claim_ids
                        FROM billing.charges_studies  bcs
                        INNER JOIN billing.charges bch ON bch.id = bcs.charge_id
                        WHERE bcs.study_id = public.studies.id AND bch.claim_id != ${claim_id}
                    ) split_claims ON TRUE
                    WHERE   billing.charges.claim_id = ${claim_id}
                    ORDER BY status_index ,study_id
                    LIMIT 1`;

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
                            , c.ordering_facility_contact_id
                            , pof.name AS ordering_facility_name
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
                        LEFT JOIN public.ordering_facility_contacts pofc ON pofc.id = c.ordering_facility_contact_id
                        LEFT JOIN public.ordering_facilities pof ON pof.id = pofc.ordering_facility_id
                        LEFT JOIN public.facilities f ON f.id = c.facility_id
                        WHERE
                            c.id = ${params.id}`;

        return await query(sql);

    },

    updateBillingPayers: async function (params) {
        params.screenName = params.entityName = params.moduleName = 'claims';
        const sql = SQL`
                        SELECT id,
                        billing.update_payer_type(claims.id,${params.payer_type})
                        ,'{}'::jsonb old_values from billing.claims WHERE id=${params.id}
                        `;

        return await queryWithAudit(sql, {
            ...params,
            logDescription: `Change claim payer type (${params.payer_type}) for claims(${params.id})`
        });
    },

    updateFollowUp: async (params) => {
        let {
            followupDate,
            followUpDetails,
            companyId,
            screenName,
            clientIp,
            userId,
            entityName,
            moduleName,
            claimFollowupData
        } = params;
        let sql;

        if (followupDate == '') {
            sql = SQL`
                    WITH claim_data AS (
                        SELECT
                              "claimId" AS claim_id
                            , "assignedTo" AS assigned_to
                        FROM json_to_recordset(${JSON.stringify(claimFollowupData)}) AS claim_data
                        (
                            "claimId" BIGINT,
                            "assignedTo" INTEGER
                        )
                    )
                    ,cancle_followups AS(
                        DELETE FROM billing.claim_followups cf
                        WHERE EXISTS (SELECT
                                        1
                                      FROM claim_data cd
                                      WHERE cd.claim_id = cf.claim_id
                                      AND cd.assigned_to = cf.assigned_to
                        )RETURNING *, '{}'::jsonb old_values),
                        audit_cte AS (
                            SELECT billing.create_audit(
                                ${companyId},
                                ${entityName || screenName},
                                cancle_followups.id,
                                ${screenName},
                                ${moduleName},
                                'Claim followup canceled for claim Id: '|| cancle_followups.claim_id || ' User Id : ' || cancle_followups.assigned_to ,
                                ${clientIp || '127.0.0.1'},
                                json_build_object(
                                    'old_values', (SELECT COALESCE(old_values, '{}') FROM cancle_followups limit 1),
                                    'new_values', (SELECT row_to_json(temp_row)::jsonb - 'old_values'::text FROM (SELECT * FROM cancle_followups limit 1) temp_row)
                                )::jsonb,
                                ${userId || 0}
                            ) id
                            from cancle_followups
                        )

                        SELECT  *
                        FROM    audit_cte`;
        }
        else {
            sql = SQL`
            WITH followup_details AS (
                SELECT
                      "claimID" AS followup_claim_id
                    , coalesce("followUPUserID",${userId}) AS assigned_to
                    , "followupDate" AS followup_dt
                FROM json_to_recordset(${followUpDetails}) AS followup
                (
                    "claimID" bigint,
                    "followUPUserID" integer,
                    "followupDate" date
                )
            ),
            update_followup AS(
                UPDATE
                    billing.claim_followups bcf
                SET
                      followup_date = fd.followup_dt
                    , assigned_to = fd.assigned_to
                FROM followup_details fd
                WHERE
                    bcf.claim_id = fd.followup_claim_id
                    AND bcf.assigned_to = fd.assigned_to
                RETURNING * , '{}'::jsonb old_values
            ),
            insert_followup AS(
                INSERT INTO billing.claim_followups(
                      claim_id
                    , followup_date
                    , assigned_to
                )
                SELECT
                      followup_claim_id
                    , followup_dt
                    , coalesce(assigned_to,${userId})
                FROM
                    followup_details
                WHERE NOT EXISTS ( SELECT 1 FROM update_followup  WHERE update_followup.claim_id = followup_details.followup_claim_id )
                RETURNING *, '{}'::jsonb old_values
            ),
            insert_audit_followup AS (
                SELECT billing.create_audit(
                      ${companyId}
                    , 'claims'
                    , id
                    , ${screenName}
                    , 'claims'
                    , 'New Follow Up created for Claim ID: ' ||  insert_followup.claim_id
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
                    , 'Update: Follow Up Date ( ' || update_followup.followup_dt || ' ) Updated for Claim ID: ' || update_followup.claim_id
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
            studyDetails,
            auditDetails,
            is_alberta_billing
        } = params;
        let createClaimFunction = is_alberta_billing ? 'billing.can_ahs_create_claim_per_charge' : 'billing.create_claim_charge';

        const sql = SQL`
                    WITH batch_claim_details AS (
                        SELECT
		                    patient_id, study_id, order_id, billing_type
	                    FROM
	                        json_to_recordset(${studyDetails}) AS study_ids
		                    (
		                        patient_id bigint,
                                study_id bigint,
                                order_id bigint,
                                billing_type text
                            )
                    ), details AS (
                        SELECT bcd.study_id, d.*
                        FROM
                           batch_claim_details bcd
                        LEFT JOIN LATERAL (select * from billing.get_batch_claim_details(bcd.study_id, ${params.created_by}, bcd.patient_id, bcd.order_id, bcd.billing_type)) d ON true
                      )
                      SELECT `
            .append(createClaimFunction)
            .append(`(
                    jsonb_array_elements(details.claims),
                    details.insurances,
                    details.claim_icds,
                    ('${JSON.stringify(auditDetails) }'):: jsonb,
                    details.charges),
                    details.study_id
                    FROM details`);

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
                                        pof.name
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
                    LEFT JOIN public.ordering_facility_contacts pofc ON pofc.id = bc.ordering_facility_contact_id
                    LEFT JOIN public.ordering_facilities pof ON pof.id = poc.ordering_facility_id
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
    },

    validateBatchClaimCharge: async(study_data) => {
        const sql = SQL`WITH batch_claim_details AS (
                        SELECT
                             study_id
                        FROM
                            json_to_recordset(${study_data}) AS study_ids
                            (
                                study_id bigint
                            )
                    )
                    SELECT
                        COUNT(DISTINCT s.id)
                    FROM public.studies s
                    INNER JOIN public.study_cpt cpt ON cpt.study_id = s.id
                    INNER JOIN public.cpt_codes codes ON codes.id = cpt.cpt_code_id
                    WHERE s.id = ANY(SELECT * FROM batch_claim_details)`;
        return await query(sql.text, sql.values);
    },

    validateEDIClaimCreation: async(claimIds) => {
        const sql = SQL`
                WITH invalid_claim AS
                (
                    SELECT COUNT(1) AS claim_count
                    FROM billing.claims bc
                    WHERE bc.id = ANY(${claimIds})
                    AND TIMEZONE(public.get_facility_tz(bc.facility_id :: INT), bc.claim_dt) :: DATE > CURRENT_DATE
                )
                SELECT
                        array_agg(claim_status.code) AS claim_status
                    , COUNT(DISTINCT(bc.billing_method)) AS unique_billing_method_count
                    , COUNT(clearing_house_id) AS clearing_house_count
                    , COUNT(DISTINCT(clearing_house_id)) AS unique_clearing_house_count
                    , (SELECT claim_count FROM invalid_claim) AS invalid_claim_count
                FROM billing.claims bc
                INNER JOIN billing.claim_status ON claim_status.id = bc.claim_status_id
                LEFT JOIN patient_insurances ON patient_insurances.id =
                (  CASE payer_type
                WHEN 'primary_insurance' THEN primary_patient_insurance_id
                WHEN 'secondary_insurance' THEN secondary_patient_insurance_id
                WHEN 'tertiary_insurance' THEN tertiary_patient_insurance_id
                END)
                LEFT JOIN insurance_providers ON patient_insurances.insurance_provider_id = insurance_providers.id
                LEFT JOIN billing.insurance_provider_details ON insurance_provider_details.insurance_provider_id = insurance_providers.id
                WHERE bc.id = ANY(${claimIds}) `;

        return await query(sql.text, sql.values);
    },

    getClaimSummary: async (params) => {
        const {
            id
        } = params;

        const sql = SQL` SELECT
                            p.birth_date::text,
                            p.account_no,
                            p.gender,
                            p.patient_info,
                            get_full_name(p.last_name,p.first_name,p.middle_name,p.prefix_name,p.suffix_name) AS patient_name,
                            get_full_name(u.last_name,u.first_name,u.middle_initial,null,u.suffix) AS created_by,
                            charges.cpt_codes,
                            charges.cpt_description,
                            c.claim_dt::text,
                            c.id,
                            c.facility_id,
                            COALESCE(
                                get_study_age ,
                                CASE
                                    WHEN EXTRACT(YEAR FROM age(c.claim_dt, p.birth_date)) != 0 AND EXTRACT(MONTH FROM age(c.claim_dt,p.birth_date)) != 0
                                        THEN EXTRACT(YEAR FROM age(c.claim_dt,p.birth_date)) || 'Y' || '&' || EXTRACT(MONTH FROM age(c.claim_dt,p.birth_date)) || 'M'
                                    WHEN EXTRACT(YEAR FROM age(c.claim_dt,p.birth_date)) != 0 THEN EXTRACT(YEAR FROM age(c.claim_dt,p.birth_date)) || 'Y'
                                    WHEN EXTRACT(MONTH FROM age(c.claim_dt,p.birth_date)) != 0 THEN EXTRACT(MONTH FROM age(c.claim_dt,p.birth_date)) || 'M'
                                    ELSE null
                                END
                            ) AS patient_study_age,
                            p.id as patient_id,
                            COALESCE(patient_payments.insurance_balance,'0')::numeric AS insurance_balance,
                            COALESCE(patient_payments.patient_balance,'0')::numeric AS patient_balance
                        FROM
                        billing.claims c
                        INNER JOIN patients p ON p.id = c.patient_id
                        INNER JOIN users u ON u.id = c.created_by
                        LEFT JOIN (
                            SELECT
                                array_agg(cpt.display_code) AS cpt_codes,
                                array_agg(cpt.display_description) AS cpt_description,
                                chs.study_id
                            FROM
                                billing.charges ch
                            INNER JOIN public.cpt_codes cpt ON ch.cpt_id = cpt.id
                            LEFT JOIN billing.charges_studies chs ON chs.charge_id = ch.id
                            WHERE claim_id = ${id}
                            GROUP BY chs.study_id LIMIT 1

                        ) AS charges ON TRUE
                        LEFT JOIN studies s ON s.id = charges.study_id
                        LEFT JOIN get_study_age(s.id::integer) ON true
                        LEFT JOIN LATERAL (
                            SELECT
                                sum(bgcp.charges_bill_fee_total - (bgcp.payments_applied_total + bgcp.adjustments_applied_total))  FILTER (WHERE payer_type != 'patient')  as insurance_balance,
                                sum(bgcp.charges_bill_fee_total - (bgcp.payments_applied_total + bgcp.adjustments_applied_total))  FILTER (WHERE payer_type = 'patient')  as patient_balance
                            FROM billing.claims
                            INNER JOIN LATERAL billing.get_claim_payments(claims.id,FALSE) bgcp ON TRUE
                            WHERE claims.patient_id = c.patient_id
                        ) patient_payments ON true
                        WHERE
                            c.id = ${id} `;

        return await query(sql);
    },

    getClaimTotalBalance: async function (args) {

        args.isClaimBalanceTotal = true;
        args.isCount= false;
        let claimGridFilter = await SearchFilter.getWL(args);
        let balanceFilter = '';
        args.claimBalancefilterData = args.claimBalancefilterData || 0;

        // create claim balance filter query
        if(args.colModel){
            args.colModel.searchColumns = ['bgct.claim_balance_total'];
            balanceFilter = await filterValidator.generateQuery([args.colModel], JSON.stringify(['claim_balance']), JSON.stringify([args.claimBalancefilterData]), '');
        }

        const sql = SQL`WITH
	        -- --------------------------------------------------------------------------------------------------------------
            -- Apply claims grid filters
            -- --------------------------------------------------------------------------------------------------------------
            claim_details AS ( `;

        sql.append(claimGridFilter);

        sql.append(`)
	        -- --------------------------------------------------------------------------------------------------------------
            -- Calculate charge bill fee for claim.
            -- --------------------------------------------------------------------------------------------------------------
            ,claim_charge_fee AS (
                SELECT
                    sum(c.bill_fee * c.units)       AS charges_bill_fee_total
                    ,c.claim_id
                FROM
                    billing.charges AS c
                INNER JOIN claim_details AS cd ON cd.claim_id = c.claim_id
                INNER JOIN public.cpt_codes AS pc ON pc.id = c.cpt_id
                LEFT OUTER JOIN billing.charges_studies AS cs ON c.id = cs.charge_id
                GROUP BY c.claim_id
             )
            -- --------------------------------------------------------------------------------------------------------------
            -- Claim payments list.
            -- --------------------------------------------------------------------------------------------------------------
            ,claim_payments_list AS (
                SELECT
                     ccf.claim_id
		            ,ccf.charges_bill_fee_total
		            ,bgct.claim_balance_total
                FROM
                    claim_charge_fee ccf
                LEFT JOIN LATERAL (
                    SELECT
                        coalesce(sum(pa.amount)    FILTER (WHERE pa.amount_type = 'payment'),0::money)    AS payments_applied_total
                        ,coalesce(sum(pa.amount)   FILTER (WHERE pa.amount_type = 'adjustment'
                        AND (adj.accounting_entry_type != 'refund_debit' OR pa.adjustment_code_id IS NULL)),0::money) AS ajdustments_applied_total
                        ,coalesce(sum(pa.amount)   FILTER (WHERE adj.accounting_entry_type = 'refund_debit'),0::money) AS refund_amount
                        ,c.claim_id
		            FROM
                        billing.charges AS c
                    LEFT JOIN billing.payment_applications AS pa ON pa.charge_id = c.id
                    LEFT JOIN billing.payments AS p ON pa.payment_id = p.id
                    LEFT JOIN billing.adjustment_codes adj ON adj.id = pa.adjustment_code_id
		            GROUP BY c.claim_id
                ) AS applications ON applications.claim_id = ccf.claim_id

                INNER JOIN LATERAL (
			        SELECT
			            ccf.charges_bill_fee_total - (
				            applications.payments_applied_total +
				            applications.ajdustments_applied_total +
				            applications.refund_amount
			            ) AS claim_balance_total
                ) AS bgct ON TRUE `);

        sql.append(balanceFilter);

        sql.append(`
            )
            -- --------------------------------------------------------------------------------------------------------------
            -- Getting claims total balance and charges total billFee
            -- --------------------------------------------------------------------------------------------------------------
                SELECT
                    sum(cp.claim_balance_total) AS claim_balance_total,
                    sum(cp.charges_bill_fee_total) AS charges_bill_fee_total
                FROM
                    claim_payments_list cp `);

        return await query(sql);
    },

    storeFile: async (info) => {
        const {
            file_name,
            file_md5,
            file_size,
            file_type,
            file_store_id,
            companyId,
            file_path,
            created_dt
        } = info || {};

        const sql = SQL`
            INSERT INTO billing.edi_files (
                company_id,
                file_store_id,
                created_dt,
                status,
                file_type,
                file_path,
                file_size,
                file_md5,
                uploaded_file_name
            )
            SELECT
                ${companyId},
                ${file_store_id},
                ${created_dt},
                'pending',
                ${file_type},
                ${file_path},
                ${file_size},
                ${file_md5},
                ${file_name}
            RETURNING
                id
        `;

        const dbResults = (await query(sql.text, sql.values)).rows;

        return dbResults.pop().id;
    },

    updateEDIFile: async (args) => {
        let {
            status,
            userId,
            clientIp,
            ediFileId,
            companyId,
            screenName,
            moduleName,
            claimIds,
        } = args || {};

        claimIds = claimIds.split(',').map(Number);

        const sql = SQL`
            WITH update_cte AS (
                UPDATE
                    billing.edi_files ef
                SET
                    status = ${status}
                WHERE
                    ef.id = ${ediFileId}
                RETURNING
                id, '{}'::jsonb old_values
            )
            SELECT billing.create_audit(
                      ${companyId}
                    , 'claims'
                    , c.id
                    , ${screenName}
                    , ${moduleName}
                    , 'Electronic claim has been submitted and EDI file Id: ' || ${ediFileId}
                    , ${clientIp}
                    , json_build_object(
                        'old_values', '{}',
                        'new_values', (SELECT row_to_json(temp_row)::jsonb - 'old_values'::text FROM (SELECT * FROM update_cte LIMIT 1 ) temp_row)
                        )::jsonb
                    , ${userId}
                    ) AS id
                FROM unnest(${claimIds}::bigint[]) claim_id
                INNER JOIN billing.claims c on c.id = claim_id `;

        return await query(sql.text, sql.values);
    },

    getLatestResourceNumberForEDI: async () => {
        const sql = SQL` SELECT
                            resource_no::bigint
                         FROM billing.edi_files
                         WHERE resource_no IS NOT NULL
                         ORDER BY resource_no DESC LIMIT 1`;
        try {
            return await queryRows(sql);
        }
        catch (e) {
            console.error(e);
            return [];
        }
    }
};
