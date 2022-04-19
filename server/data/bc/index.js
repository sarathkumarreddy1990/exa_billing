'use strict';
const { queryRows, SQL, query, queryWithAudit } = require('../index');

const bcData = {

    /**
     * submitClaim - Gets claim information of submited claim
     * @param {Object} args - incoming object with claim ID
     * @returns {Object}
     */
    submitClaim: async (args) => {
        let {
            claimIds
        } = args;

        const sql = SQL`
                        WITH charges AS(
                            SELECT
                                c.id
                                , SUM((bc.units * bc.bill_fee))::NUMERIC AS claim_total_bill_fee
                                , json_agg(json_build_object(
                                    'code', cc.display_code
                                    , 'bill_fee', (bc.units * bc.bill_fee)::NUMERIC
                                    , 'units', bc.units
                                    , 'service_start_dt', bc.charge_dt
                                    , 'modifers', modifiers
                                    , 'pointer1', bc.pointer1
                                    , 'pointer2', bc.pointer2
                                    , 'pointer3', bc.pointer3
                                    , 'modality', ps.modalities
                                    , 'charge_id', bc.id
                                    , 'last_sequence', last_sequence.sequence_number
                                )) AS health_services
                            FROM billing.claims c
                            INNER JOIN billing.charges bc ON bc.claim_id = c.id
                            INNER JOIN public.cpt_codes cc ON cc.id = bc.cpt_id
                            LEFT JOIN billing.charges_studies bcs ON bcs.charge_id = bc.id
                            LEFT JOIN public.studies ps ON ps.id = bcs.study_id
                            LEFT JOIN LATERAL  (
                                SELECT ARRAY(SELECT code FROM modifiers WHERE id IN (bc.modifier1_id, bc.modifier2_id, bc.modifier3_id, bc.modifier4_id)) AS modifier_ids
                            ) modifiers  ON TRUE
                            LEFT JOIN LATERAL (
                                SELECT
                                   sequence_number
                                FROM billing.edi_file_charges
                                WHERE charge_id = bc.id
                                ORDER BY id desc
                                LIMIT 1
                            ) last_sequence ON TRUE
                            WHERE NOT is_excluded AND bc.claim_id = ANY(${claimIds})
                            GROUP BY c.id
                        ),
                        cfg as(
                            SELECT
                                  option AS current
                              FROM
                                  sites,
                                  jsonb_array_elements(web_config :: JSONB) option
                              ORDER BY
                                  option ->> 'id' ASC
                        ),
                        claim_icds AS (
                            SELECT
                                c.id
                                , array_agg(icd.code) AS icds
                            FROM
                                billing.claims c
                            INNER JOIN billing.claim_icds ci  ON ci.claim_id =  c.id
                            INNER JOIN public.icd_codes icd ON icd.id = ci.icd_id
                            WHERE c.id = ANY(${claimIds})
                            GROUP BY c.id
                        )
                        SELECT
                            c.id AS claim_number
                            , c.facility_id
                            , bp.can_bc_data_centre_number
                            , pof.can_facility_number
                            , pof.can_bc_service_clr_code
                            , c.rendering_provider_contact_id
                            , ci.icds
                            , ch.health_services
                            , ch.claim_total_bill_fee
                            , ppc.can_prid AS rendering_provider
                            , refp.can_prid AS referring_provider
                            , phn.*
                            , pp.first_name
                            , COALESCE(LEFT(pp.middle_name, 1), '  '::TEXT) AS middle_name
                            , pp.last_name
                            , pp.gender
                            , pp.can_bc_is_newborn
                            , c.can_supporting_text
                            , c.is_employed
                            , c.is_auto_accident
                            , c.original_reference
                            , bwica.code AS area_of_injury
                            , bwicn.code AS nature_of_injury
                            , to_char(pp.birth_date, 'YYYYMMDD') AS patient_dob
                            , c.current_illness_date
                            , ppos.code     AS place_of_service
                            , patient_info->'c1AddressLine1' AS address_line1
                            , patient_info->'c1AddressLine2' AS address_line2
                            , patient_info->'c1City' AS city
                            , patient_info->'c1State' AS province
                            , patient_info->'c1Zip' AS postal_code
                            , bp.can_bc_payee_number
                            , bp.can_bc_is_alt_payment_program
                            , bcsc.code AS submission_code
                            , CASE WHEN COALESCE(cfg.current->>'value','')= '' THEN NULL ELSE to_char((cfg.current->>'value')::DATE, 'YYYYMMDD') END AS installation_date
                            , pf.time_zone AS facility_time_zone
                        FROM
                        billing.claims c
                        INNER JOIN public.patients pp  ON  pp.id = c.patient_id
                        INNER JOIN public.facilities pf ON pf.id = c.facility_id
                        LEFT JOIN billing.providers bp ON bp.id = c.billing_provider_id
                        LEFT JOIN public.ordering_facility_contacts pofc ON pofc.id = c.ordering_facility_contact_id
                        LEFT JOIN public.ordering_facilities pof ON pof.id = pofc.ordering_facility_id
                        LEFT JOIN public.places_of_service ppos ON ppos.id = pofc.place_of_service_id
                        LEFT JOIN public.provider_contacts ppc ON ppc.id = c.rendering_provider_contact_id
                        LEFT JOIN public.provider_contacts refp ON refp.id = c.referring_provider_contact_id
                        LEFT JOIN public.get_issuer_details(pp.id, 'uli_phn') phn ON true
                        LEFT JOIN billing.claim_submission_codes bcsc ON bcsc.id = c.can_submission_code_id
                        LEFT JOIN charges ch ON ch.id = c.id
                        LEFT JOIN claim_icds ci on ci.id = c.id
                        LEFT JOIN public.can_wcb_injury_codes bwica ON bwica.id = c.area_of_injury_code_id
                        LEFT JOIN public.can_wcb_injury_codes bwicn ON bwicn.id = c.nature_of_injury_code_id
                        LEFT JOIN cfg ON cfg.current->>'id' = 'goLiveDate'
                        WHERE c.id = ANY(${claimIds});`;

        return await queryRows(sql);
    },

    /**
    * getCompanyFileStore - get company and file store deatials
    * @param {BigInteger} company_id - company id
    * @returns {Object}
    */
    getCompanyFileStore: async (company_id) => {
        const fileSql = SQL`
                        SELECT
                            fs.id AS file_store_id
                            , fs.root_directory
                            , c.time_zone
                        FROM companies c
                        LEFT JOIN file_stores fs ON fs.id = c.file_store_id
                        WHERE c.id = ${company_id}`;

        return await queryRows(fileSql);
    },

    /**
     * storeFile - capturing data encoded file
     * @param {Object} info - object containing file store information and file information
     * @returns {Object}
     */
    storeFile: async (info) => {
        const {
            file_name,
            file_store_id,
            companyId,
            file_path,
            file_md5,
            file_size,
            file_type,
        } = info;

        const sql = SQL`
                    INSERT INTO billing.edi_files (
                        company_id
                        , file_store_id
                        , created_dt
                        , status
                        , file_path
                        , file_size
                        , file_md5
                        , file_type
                        , uploaded_file_name
                    )
                    SELECT
                        ${companyId}
                        , ${file_store_id}
                        , now()
                        , 'pending'
                        , ${file_path}
                        , ${file_size}
                        , ${file_md5}
                        , ${file_type}
                        , ${file_name}
                    RETURNING
                        id`;

        return (await queryRows(sql)).pop().id;

    },

    /**
    * ediFiles - capturing data of edi file
    * @param {Object} args
    * @returns {Object}
    */
    ediFiles: async (args) => {
        let {
            ediFileId,
            claimIds
        } = args;

        const sql = SQL`
            INSERT INTO billing.edi_file_claims (
                edi_file_id
                , claim_id
            )
            SELECT
                ${ediFileId},
                UNNEST(${claimIds}::INT[])
            RETURNING id, claim_id AS claim_number`;

        return await query(sql.text, sql.values);
    },

    /**
    * updateClaimsStatus - updating claim status of claims
    * @param {Object} args - incoming object with claim details
    * @returns {Object}
    */
    updateClaimsStatus: async (args) => {
        const {
            claimIds,
            statusCode,
            claimNote,
            userId = 1
        } = args;

        const sql = SQL`
            WITH status AS (
                SELECT
                    id
                FROM
                    billing.claim_status
                WHERE
                    code = ${statusCode}
                LIMIT 1
            )
            , addClaimComment AS (
                INSERT INTO billing.claim_comments (
                      note
                    , type
                    , claim_id
                    , created_by
                    , created_dt
                )
                VALUES (
                      ${claimNote}
                    , 'auto'
                    , UNNEST(${claimIds}::INT[])
                    , ${userId}
                    , now()
                ) RETURNING *
            )
            UPDATE
                billing.claims
            SET
                claim_status_id = status.id
            FROM
                status
            WHERE
                billing.claims.id = ANY(${claimIds}:: BIGINT[])
            RETURNING
                billing.claims.id
        `;
        return await query(sql.text, sql.values);
    },

    /**
     * Update File status
     * @param  {object} args {
     *                          fileId: Number
     *                          status: text
     *                       }
     */
    updateFileStatus: async ({fileId, status}) => {

        const sql = SQL`UPDATE
                            billing.edi_files
                        SET status = ${status}
                        WHERE id = ${fileId}`;

        return await query(sql.text, sql.values);
    },
    /*
    * getAllClaims - Get all pending submission claim ids
    * @param {BigInteger} companyId - company id
    * @returns {Object}
    */
    getAllClaims: async(companyId) => {
        const pendingSubmissionClaims = SQL`
                                            SELECT
                                                ARRAY_AGG(claims.id)  AS ids
                                            FROM billing.claims
                                            INNER JOIN billing.claim_status cs ON cs.id = claims.claim_status_id
                                            WHERE cs.code = 'PS'
                                                AND claims.billing_method = 'electronic_billing'
                                                AND claims.company_id = ${companyId}`;

        return await queryRows(pendingSubmissionClaims);
    },

    /**
    * updateEDIFile - EDI file status update
    * @param {object} args    {
    *                             status: String,
    *                             ediFileId: Number,
    *                             fileInfo: Object
    *                         }
    * @returns {BigInt} id
    */
    updateEDIFile: async (args) => {
        const {
            status,
            ediFileId,
            fileInfo,
        } = args;

        const sql = SQL`
            UPDATE
                billing.edi_files ef
            SET`;

        if (fileInfo) {
            sql.append(SQL`
                file_size = ${fileInfo.file_size},
                file_md5 = ${fileInfo.file_md5},
            `);
        }

        sql.append(SQL`
                status = ${status}
            WHERE
                ef.id = ${ediFileId}
            RETURNING
                id;
        `);

        return await query(sql.text, sql.values);
    },

    /**
    * saveEligibilityResponse - save eligibility respose from MSP
    * @param {object} args    {
    *                             patient_id: BIGINT,
    *                             patient_insurance_id: BIGINT,
    *                             eligibilityResponse: OBJECT,
    *                             eligibility_dt: DATE
    *                         }
    */
    saveEligibilityResponse: async (args) => {
        const {
            patient_id,
            patient_insurance_id,
            eligibilityResponse,
            eligibility_dt
        } = args;

        const sql = SQL`
                INSERT INTO eligibility_log
                        ( patient_id
                        , patient_insurance_id
                        , eligibility_response
                        , eligibility_dt)
                VALUES
                        ( ${patient_id}
                        , ${patient_insurance_id}
                        , ${eligibilityResponse}
                        , ${eligibility_dt}
                        )
            `;

        return await query(sql);
    },

    /**
    * getAllscheduledClaims - fetching tomorrows scheduled studies data
    * @param {object} args    {
    *                             companyId: BIGINT,
    *                         }
    */
    getAllscheduledClaims: async (args) => {
        const sql = SQL`
                        WITH cfg as(
                            SELECT
                                option AS current
                            FROM
                                sites,
                                jsonb_array_elements(web_config :: JSONB) option
                            ORDER BY
                                option ->> 'id' ASC
                        )
                        SELECT
                            s.id AS study_id
                            , f.time_zone
                            , bp.can_bc_payee_number
                            , bp.can_bc_data_centre_number
                            , p.gender
                            , p.first_name
                            , p.middle_name
                            , p.last_name
                            , to_char(p.birth_date, 'YYYYMMDD') AS birth_date
                            , phn->'alt_account_no' AS phn_alt_account_no
                            , to_char(s.study_dt, 'YYYYMMDD') AS date_of_service
                            , el.eligibility_response
                            , el.eligibility_dt
                            , CASE WHEN COALESCE(cfg.current->>'value','')= '' THEN NULL ELSE to_char((cfg.current->>'value')::DATE, 'YYYYMMDD') END AS installation_date
                        FROM studies s
                        INNER JOIN orders o ON o.id = s.order_id
                        INNER JOIN facilities f ON s.facility_id = f.id
                        INNER JOIN patients p ON p.id = s.patient_id
                        INNER JOIN patient_insurances pi ON pi.id = o.primary_patient_insurance_id
                        INNER JOIN insurance_providers ip ON ip.id = pi.insurance_provider_id
                        INNER JOIN billing.facility_settings bfs ON bfs.facility_id = f.id
                        INNER JOIN billing.providers bp ON bp.id = bfs.default_provider_id
                        INNER JOIN public.get_issuer_details(p.id, 'uli_phn') phn ON true
                        LEFT JOIN LATERAL (
                            SELECT
                                eligibility_response
                                , eligibility_dt
                            FROM eligibility_log
                            WHERE patient_id = s.patient_id AND patient_insurance_id = pi.id
                            ORDER BY id DESC
                            LIMIT 1
                        ) el ON true
                        LEFT JOIN cfg ON cfg.current->>'id' = 'goLiveDate'
                        WHERE
                            s.schedule_dt IS NOT NULL
                            AND to_facility_date(s.facility_id, s.schedule_dt) = to_facility_date(s.facility_id, DATE 'tomorrow')
                            AND f.company_id = ${args.companyId}
                            AND bp.can_bc_data_centre_number IS NOT NULL
                            AND ip.insurance_code = 'MSP'
                            AND (el.eligibility_dt <= to_facility_date(s.facility_id, CURRENT_DATE) OR el.eligibility_dt IS NULL)
                        `;

        return await queryRows(sql);
    },

    /**
    * getLastUpdatedSequence - Last sequence number of billing provider
    * @param {bigint} providerId  - billing provider id
    *
    *  @returns {Int} sequence number
    */
    getLastUpdatedSequence: async(providerId) => {
        const sql = SQL`
                        SELECT
                            can_bc_data_centre_sequence_number
                        FROM billing.providers
                        WHERE id = ${providerId}`;

        return (await queryRows(sql)).pop();
    },

    /**
    * ediFilesCharges - Insert edi file claim's charge details
    * @param {Object} submittedClaimDetails  - charge object
    */
    ediFilesCharges: async(submittedClaimDetails) => {
        const sql = SQL`
                        WITH cte AS (
                            SELECT
                                "charge_id"
                                , "edi_file_claim_id"
                                , "can_bc_data_centre_number"
                                , "current_sequence"
                        FROM  jsonb_to_recordset(${JSON.stringify(submittedClaimDetails)}) AS (
                                "charge_id" BIGINT ,
                                "edi_file_claim_id" BIGINT,
                                "can_bc_data_centre_number" TEXT,
                                "current_sequence" INT)
                        )
                        INSERT INTO billing.edi_file_charges (
                            charge_id
                            , data_centre_number
                            , edi_file_claim_id
                            , sequence_number
                        ) SELECT
                            charge_id
                            , can_bc_data_centre_number
                            , edi_file_claim_id
                            , current_sequence
                            FROM cte
                        `;

        return await queryRows(sql);
    },

    /**
    * getAllpendingFiles - fetch pending file status
    * @param {object} args    {
    *                             companyId: BIGINT,
    *                         }
    */
    getAllpendingFiles: async(args)=> {
        const {
            companyId
        } = args;

        const sql = SQL`
                    SELECT
                        billing_providers.billing_provider_id
                        , billing_providers.claim_id
                        , billing_providers.can_bc_data_centre_number
                        , billing_providers.can_bc_msp_portal_username
                        , billing_providers.can_bc_msp_portal_password
                        , billing_providers.can_bc_msp_portal_external_url
                        , bef.id AS edi_file_id
                        , fs.root_directory
                        , bef.file_path
                        , bef.uploaded_file_name
                        , c.time_zone
                    FROM  billing.edi_files bef
                    INNER JOIN file_stores fs ON fs.id = bef.file_store_id
                    INNER JOIN companies c ON c.id = ${companyId}
                    INNER JOIN LATERAL (
                        SELECT
                            bp.id AS billing_provider_id
                            , befc.id AS claim_id
                            , bp.can_bc_data_centre_number
                            , bp.can_bc_msp_portal_username
                            , bp.can_bc_msp_portal_password
                            , bp.can_bc_msp_portal_external_url
                        FROM billing.edi_file_claims befc
                        INNER JOIN billing.claims bc ON bc.id = befc.claim_id
                        INNER JOIN billing.providers bp ON bp.id = bc.billing_provider_id
                        WHERE befc.edi_file_id = bef.id
                        LIMIT 1
                    ) billing_providers ON true
                    WHERE bef.status  = 'pending' AND bef.company_id = ${companyId} AND bef.file_type = 'can_bc_submit'
                    UNION ALL
                    SELECT
                        NULL AS billing_provider_id
                        , NULL AS claim_id
                        , NULL AS can_bc_data_centre_number
                        , NULL AS can_bc_msp_portal_username
                        , NULL AS can_bc_msp_portal_password
                        , NULL AS can_bc_msp_portal_external_url
                        , bef.id AS edi_file_id
                        , fs.root_directory
                        , bef.file_path
                        , bef.uploaded_file_name
                        , c.time_zone
                    FROM  billing.edi_files bef
                    INNER JOIN file_stores fs ON fs.id = bef.file_store_id
                    INNER JOIN companies c ON c.id = ${companyId}
                    WHERE bef.status  = 'pending' AND bef.company_id = ${companyId} AND bef.file_type = 'can_bc_be'
        `;

        return await query(sql);
    },

    /**
    * updateLastSequenceNumber - update last sequence number of billing provider
    * @param {bigint} billing_provider_id  - provider id
    * @param {Int} currentSequence  - sequence number
    */
    updateLastSequenceNumber: async(args, billing_provider_id, currentSequence) => {
        const sql = SQL`
                        UPDATE billing.providers
                        SET can_bc_data_centre_sequence_number = ${currentSequence}
                        WHERE id = ${billing_provider_id}
                        RETURNING *,
                        (
                            SELECT row_to_json(old_row)
                            FROM   (SELECT *
                                    FROM   billing.providers
                                    WHERE  id = ${billing_provider_id}) old_row
                        ) old_values`;


        return await queryWithAudit(sql, {
            logDescription: `Update: Sequence number for billing provider(${billing_provider_id}) updated`,
            userId: args.userId || 1,
            entityName: 'claims submission(cron service)',
            screenName: 'claim submission(cron service)',
            moduleName: 'claims',
            clientIp: args.ip || '127.0.0.1',
            companyId: args.companyId
        });
    },

    /**
    * ediFilesNotes - insert edi file note
    *  @param {object} submittedClaimDetails - submitted claim notes
    */
    ediFilesNotes: async(args, submittedClaimDetails) => {
        const sql = SQL`
                        WITH cte AS (
                            SELECT
                                "edi_file_claim_id"
                                , "can_bc_data_centre_number"
                                , "current_sequence"
                            FROM  jsonb_to_recordset(${JSON.stringify(submittedClaimDetails)}) AS (
                                "edi_file_claim_id" BIGINT
                                , "can_bc_data_centre_number" TEXT
                                , "current_sequence" INT)
                        ), insert_billing_notes AS (
                            INSERT INTO billing.edi_file_billing_notes (
                                data_centre_number
                                , edi_file_claim_id
                                , sequence_number
                            )
                            SELECT
                                can_bc_data_centre_number
                                , edi_file_claim_id
                                , current_sequence
                            FROM cte
                            RETURNING *, '{}'::jsonb old_values
                        ), audit_cte AS (
                            SELECT billing.create_audit(
                                ${args.companyId}
                                , ${args.screenName}
                                , ibn.id
                                , ${args.screenName}
                                , ${args.moduleName}
                                , ${args.logDescription}
                                , ${args.ip || '127.0.0.1'}
                                , json_build_object(
                                    'old_values', (SELECT COALESCE(old_values, '{}') FROM insert_billing_notes),
                                    'new_values', (SELECT row_to_json(temp_row)::jsonb - 'old_values'::text FROM (SELECT * FROM insert_billing_notes) temp_row)
                                  )::jsonb
                                , ${args.userId || 1}
                            ) id
                            FROM insert_billing_notes ibn
                        )
                        SELECT  *
                        FROM    audit_cte`;

        return await queryRows(sql);
    },

    /**
    * saveBatchEligibilitySequence - insert batch eligibility sequence
    *  @param {object} submittedeligibilityDetails - eligibility details
    */
    saveBatchEligibilitySequence: async(submittedeligibilityDetails) => {
        const sql = SQL`
                    WITH cte AS (
                        SELECT
                            "study_id"
                            , "can_bc_data_centre_number"
                            , "current_sequence"
                            , "edi_file_id"
                        FROM  jsonb_to_recordset(${JSON.stringify(submittedeligibilityDetails)}) AS (
                            "study_id" BIGINT
                            , "can_bc_data_centre_number" TEXT
                            , "current_sequence" INT
                            , "edi_file_id" BIGINT)
                    )
                    INSERT INTO billing.edi_file_batch_eligibility (
                        study_id
                        , data_centre_number
                        , sequence_number
                        , edi_file_id
                    )
                    SELECT
                        study_id
                        , can_bc_data_centre_number
                        , current_sequence
                        , edi_file_id
                    FROM cte`;

        return await queryRows(sql);
    },

    /**
    * getediFileClaimId - Get edi_file_claims id for submitted claim and edi file
    * @param {bigint} claim_number  - claim number
    * @param {bigint} edi_file_id  - edi file id
    */
    getediFileClaimId: async(claim_number, edi_file_id) => {
        const sql = SQL`
                    SELECT
                        id
                    FROM billing.edi_file_claims
                    WHERE edi_file_id = ${edi_file_id}
                    AND claim_id = ${claim_number}`;

        return (await queryRows(sql)).pop();
    },

    /**
     *  Get Files list from edi_files table based on status
     * @param {args} JSON
     */
    getRemittanceFilePathById: async ({file_id, company_id}) => {

        const sql = SQL`SELECT
                         ef.id
                       , ef.status
                       , ef.file_type
                       , ef.file_path
                       , fs.root_directory
                       , ef.uploaded_file_name
                     FROM billing.edi_files ef
                     INNER JOIN file_stores fs on fs.id = ef.file_store_id
                     WHERE ef.id = ${file_id} AND ef.company_id = ${company_id}`;

        return await query(sql.text, sql.values);
    },

    unappliedChargePayments: async (params) => {
        let {
            file_id,
            company_id,
            clientIp,
            userId,
            ip,
            log_details
        } = params;

        let {
            user_id
        } = log_details || {};

        const audit_details = {
            'company_id': company_id,
            'screen_name': 'payments',
            'module_name': 'payments',
            'client_ip': clientIp || ip,
            'user_id': userId || user_id
        };

        const sql = SQL`
                    WITH claim_payment AS (
                        SELECT
                              ch.claim_id
                            , efp.payment_id
                            , pa.applied_dt
                        FROM billing.charges AS ch
                        INNER JOIN billing.payment_applications AS pa ON pa.charge_id = ch.id
                        INNER JOIN billing.payments AS p ON pa.payment_id  = p.id
                        INNER JOIN billing.edi_file_payments AS efp ON pa.payment_id = efp.payment_id
                        WHERE efp.edi_file_id = ${file_id}  AND mode = 'eft'
                        GROUP BY ch.claim_id, efp.payment_id, pa.applied_dt
                        ORDER BY pa.applied_dt DESC
                    )
                    , unapplied_charges AS (
                        SELECT
                              cp.payment_id
                            , jsonb_build_object(
                                  'charge_id', ch.id
                                , 'payment', 0
                                , 'adjustment', 0
                                , 'cas_details', '[]'::jsonb
                                , 'applied_dt', cp.applied_dt
                            )
                        FROM billing.charges ch
                        INNER JOIN billing.claims AS c ON ch.claim_id = c.id
                        INNER JOIN claim_payment AS cp ON cp.claim_id = c.id
                        WHERE ch.id NOT IN ( SELECT charge_id
                                             FROM  billing.payment_applications pa
                                             WHERE pa.charge_id = ch.id
                                             AND pa.payment_id = cp.payment_id
                                             AND pa.applied_dt = cp.applied_dt
                                           )
                    )
                    , insert_payment_adjustment AS (
                        SELECT
                            billing.create_payment_applications(
                                  uc.payment_id
                                , null
                                , ${userId || user_id}
                                , jsonb_build_array(uc.jsonb_build_object)::jsonb
                                , (${audit_details})::jsonb
                            )
                        FROM unapplied_charges uc
                    )
                    SELECT * FROM insert_payment_adjustment `;

        return await query(sql);
    },

    processRemittance: async (remittanceJson, args) => {
        let {
            file_id,
            company_id,
            userId,
            facility_id,
            clientIp,
            log_details,
            ip
        } = args;

        let {
            user_id = null,
            default_facility_id = null
        } = log_details || {};

        let auditDetails = {
            'company_id': company_id,
            'screen_name': 'payments',
            'module_name': 'payments',
            'client_ip': clientIp || ip,
            'user_id': userId || user_id
        };

        const sql = SQL`SELECT billing.can_bc_process_remittance(
                            ${facility_id || default_facility_id}
                          , ${file_id}::BIGINT
                          , ${JSON.stringify(remittanceJson)}::JSONB
                          , ${JSON.stringify(auditDetails)}::JSONB
                        )`;

        return await query(sql);
    },

    /*
     * Get Files list from edi_files table based on status
     * @param {args} JSON
     */
    getFilesList: async (args) => {
        const {
            status,
            fileTypes
        } = args;

        const sql = SQL` WITH user_data AS (
                            SELECT
                                company_id,
                                default_facility_id,
                                id AS user_id
                            FROM users
                            WHERE username ILIKE 'radmin'
                            LIMIT 1
                        )
                        SELECT
                              ef.file_store_id
                            , ef.file_type
                            , ef.file_path
                            , ef.file_size
                            , ef.status
                            , fs.root_directory
                            , ef.uploaded_file_name
                            , ef.id file_id
                            , (SELECT row_to_json(_) FROM (SELECT * FROM user_data) AS _) AS log_details
                        FROM billing.edi_files ef
                        INNER JOIN file_stores fs ON fs.id = ef.file_store_id
                        INNER JOIN companies comp ON comp.id = fs.company_id
                        WHERE ef.status = ${status}
                            AND ef.file_type = ANY(${fileTypes}) LIMIT 10`;

        return await query(sql);
    },

    storeEligibilityResponse: async (data) => {
        const sql = SQL` WITH
                            eligibility_response AS (
                                SELECT
                                    "dataCentreNumber" AS data_centre_number
                                  , "dataCentreSequenceNumber" AS data_centre_sequence_number
                                  , CASE
                                        WHEN NULLIF("statusCoverageCode", '') IS NULL
                                        THEN jsonb_build_object(
                                                'results', jsonb_agg(jsonb_build_object(
                                                            'Patient Name', "nameVerify",
                                                            'Payee Number', "payeeNumber",
                                                            'Reference Number', "officeFolioNumber",
                                                            'Patient Status', "patientStatusReplyText",
                                                            'Eligibility Date', "serviceValidDate",
                                                            'Date of request', "dateOfRequest",
                                                            'response', "statusCoverageCode",
                                                            'ELIG_ON_DOS', 'YES',
                                                            'Msgs', "coverageReplyText",
                                                            'responseDescription', "coverageReplyText"
                                                          ))
                                             )
                                        ELSE jsonb_build_object(
                                                'err', jsonb_agg(jsonb_build_object(
                                                        'Patient Name', "nameVerify",
                                                        'Payee Number', "payeeNumber",
                                                        'Reference Number', "officeFolioNumber",
                                                        'Patient Status', "patientStatusReplyText",
                                                        'Eligibility Date', "serviceValidDate",
                                                        'Date of request', "dateOfRequest",
                                                        'response', "statusCoverageCode",
                                                        'ELIG_ON_DOS', 'NO',
                                                        'Msgs', "coverageReplyText",
                                                        'errDescription', "coverageReplyText"
                                                      ))
                                                )
                                        END AS eligibility_response
                                      , NULLIF("serviceValidDate", '') AS eligibility_date
                                    FROM jsonb_to_recordset(${JSON.stringify(data)}) AS (
                                        "dataCentreNumber" TEXT,
                                        "dataCentreSequenceNumber" BIGINT,
                                        "nameVerify" TEXT,
                                        "dateOfRequest" TEXT,
                                        "statusCoverageCode" TEXT,
                                        "serviceValidDate" TEXT,
                                        "coverageReplyText" TEXT,
                                        "patientStatusReplyText" TEXT,
                                        "payeeNumber" TEXT,
                                        "officeFolioNumber" TEXT,
                                        "filler" TEXT
                                    )
                                    GROUP BY "dataCentreNumber"
                                            , "dataCentreSequenceNumber"
                                            , "statusCoverageCode"
                                            , "serviceValidDate"
                            )
                            , default_insurance_details AS (
                                SELECT
                                    id
                                FROM public.insurance_providers
                                WHERE insurance_code ILIKE 'msp'
                                LIMIT 1
                            )
                            INSERT INTO eligibility_log
                            (
                                patient_id
                              , patient_insurance_id
                              , eligibility_response
                              , eligibility_dt
                            )
                            SELECT
                                s.patient_id
                              , pi.id
                              , er.eligibility_response
                              , er.eligibility_date::TIMESTAMPTZ
                            FROM eligibility_response er
                            INNER JOIN billing.edi_file_batch_eligibility befbe ON befbe.sequence_number = er.data_centre_sequence_number
                                AND befbe.data_centre_number = er.data_centre_number
                            INNER JOIN studies s ON s.id = befbe.study_id
                            INNER JOIN patient_insurances pi ON pi.patient_id = s.patient_id
                            INNER JOIN default_insurance_details dinsd ON TRUE
                            WHERE pi.insurance_provider_id = dinsd.id`;

        return await queryRows(sql);

    },

    /**
    * getLastUpdatedSequenceByDataCenterNumber - Last sequence number of billing provider
    * @param {string} can_bc_data_centre_number  - billing provider data centre number
    *
    *  @returns {Int} sequence number
    */
    getLastUpdatedSequenceByDataCenterNumber: async(can_bc_data_centre_number) => {
        const sql = SQL`
                    SELECT
                        bp.id,
                        bp.can_bc_data_centre_sequence_number,
                        bp.can_bc_msp_portal_username AS msp_portal_username,
                        bp.can_bc_msp_portal_password AS msp_portal_password,
                        bp.can_bc_msp_portal_external_url AS msp_portal_external_url
                    FROM billing.providers bp
                    WHERE bp.can_bc_data_centre_number = ${can_bc_data_centre_number}`;
        return (await queryRows(sql)).pop();
    },

    /**
     * getAllBillingProviderCredentials - Get all billing provider's MSP portal credential
     * @param {bigint} companyId  - company id
     */
    getAllBillingProviderCredentials: async (companyId, isEmailReminder) => {
        const sql = SQL`
                        SELECT
                            bp.email
                            , bp.name
                            , bp.can_bc_msp_portal_username
                            , bp.can_bc_msp_portal_password
                            , bp.can_bc_msp_portal_external_url
                            , abs(extract(day from CURRENT_DATE::timestamp - bp.can_bc_msp_portal_password_updated_date::timestamp)) AS days
                        FROM billing.providers bp
                        WHERE bp.company_id = ${companyId}
                        AND bp.can_bc_msp_portal_username IS NOT NULL
                        AND bp.can_bc_msp_portal_password IS NOT NULL
                        AND bp.can_bc_msp_portal_external_url IS NOT NULL`;

        if (isEmailReminder) {
            // Exa to trigger remainder mail on 35 days, 39 days,  41 days from last password updated date
            sql.append(' AND abs(extract(day from CURRENT_DATE::timestamp - bp.can_bc_msp_portal_password_updated_date::timestamp)) >= 35');
        }

        return await queryRows(sql);
    },

    /**
    * getDefaultBillingProvider - Get default billing provider MSP portal credential
    * @param {bigint} facility_id  - facility id
    * @param {bigint} companyId  - company id
    */
    getDefaultBillingProvider: async(facility_id, companyId) => {
        const sql = SQL`
                        SELECT
                          bp.can_bc_msp_portal_username
                          , bp.can_bc_msp_portal_password
                          , bp.can_bc_msp_portal_external_url
                        FROM billing.facility_settings bfs
                        INNER JOIN billing.providers bp ON bp.id = bfs.default_provider_id
                        WHERE bfs.facility_id = ${facility_id}
                        AND bp.company_id = ${companyId}
                        AND bp.can_bc_msp_portal_username IS NOT NULL
                        AND bp.can_bc_msp_portal_password IS NOT NULL
                        AND bp.can_bc_msp_portal_external_url IS NOT NULL`;

        return (await queryRows(sql)).pop();
    },

};

module.exports = bcData;
