'use strict';
const { queryRows, SQL, query } = require('../index');

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
                            , ppg.can_facility_number
                            , ppg.can_bc_service_clr_code
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
                        INNER JOIN public.provider_groups ppg ON ppg.id = c.ordering_facility_id
                        INNER JOIN public.patients pp  ON  pp.id = c.patient_id
                        INNER JOIN public.facilities pf ON pf.id = c.facility_id
                        LEFT JOIN billing.providers bp ON bp.id = c.billing_provider_id
                        LEFT JOIN public.places_of_service ppos ON ppos.id = ppg.place_of_service_id
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
                        , 'can_bc_submit'
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
            userId
        } = params;
        const audit_details = {
            'company_id': company_id,
            'screen_name': 'payments',
            'module_name': 'payments',
            'client_ip': clientIp,
            'user_id': userId
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
                            , json_build_object(
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
                                , ${userId}
                                , json_build_array(uc.json_build_object)::jsonb
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
            log_details = {},
            ip
        } = args;

        let {
            user_id = null,
            default_facility_id = null
        } = log_details;

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

    storeEligibilityResponse: async (data, {uploaded_file_name}) => {
        const sql = SQL` WITH
                            eligibility_response AS (
                                SELECT
                                    "dataCentreNumber" AS data_centre_number
                                  , "dataCentreSequenceNumber" AS data_centre_sequence_number
                                  , CASE
                                        WHEN NULLIF("statusCoverageCode", '') IS NULL
                                        THEN json_build_object(
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
                                        ELSE json_build_object(
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
                                WHERE code ILIKE 'msp'
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
                              , er.eligibility_date
                              , er.service_eligibility_date::TIMESTAMPTZ
                            FROM eligibility_response er
                            INNER JOIN billing.edi_file_charges befc ON befc.sequence_number = er.data_centre_sequence_number
                                AND befc.data_centre_number = er.data_centre_number
                            INNER JOIN billing.charges_studies bchs ON bchs.charge_id = befc.charge_id
                            INNER JOIN studies s ON s.id = bchs.study_id
                            INNER JOIN patient_insurances pi ON pi.patient_id = s.patient_id
                            WHERE pi.insurance_provider_id = default_insurance_details.id`;

        return await query(sql);

    }
};

module.exports = bcData;
