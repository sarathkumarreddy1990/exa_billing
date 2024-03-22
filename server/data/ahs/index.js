'use strict';

const { query, SQL } = require('../index');
const moment = require('moment');

const {
    promisify,
} = require('util');

const fs = require('fs');
const writeFileAsync = promisify(fs.writeFile);
const statAsync = promisify(fs.stat);

const crypto = require('crypto');
const mkdirp = require('mkdirp');
const mkdirpAsync = promisify(mkdirp);
const logger = require('../../../logger');
const shared = require('../../shared');

const ahsData = {

    updateClaimsStatus: async (args) => {
        const {
            claimIds,
            statusCode,
            claimNote,
            userId
        } = args;
        const sql = SQL` WITH status AS (
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
                                    SELECT
                                        (COALESCE(ahs_claim_number, '')
                                            || CASE WHEN ahs_claim_number IS NOT NULL THEN ' - ' ELSE '' END
                                            || ${claimNote}
                                        )
                                        , 'auto'
                                        , claim_id
                                        , ${userId}
                                        , now()
                                    FROM UNNEST(
                                        ${claimIds}::int[]
                                    ) claim_id
                                    LEFT JOIN billing.can_ahs_get_claim_number(claim_id) ahs_claim_number ON TRUE
                                    RETURNING *
                                )
                                UPDATE
                                    billing.claims
                                SET
                                    claim_status_id = status.id,
                                    submitted_dt = timezone(get_facility_tz(facility_id::int), now()::timestamp)
                                FROM
                                    status
                                WHERE
                                    billing.claims.id = ANY(${claimIds}:: BIGINT[])
                                RETURNING
                                    billing.claims.*`;

        return  await query(sql.text, sql.values);
    },

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

        if ( fileInfo ) {
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

        return  await query(sql.text, sql.values);
    },

    /**
     * To fetch the template info for the WCB C568/C570 templates
     * @param {Object} {
     *                  templateName,
     *                  companyId
     *                 }
     * @returns {Object} template_info
     */
    getWCBTemplate: async ({ templateName, companyId }) => {
        const sql = SQL`
            SELECT
                COALESCE(bet.template_info, '{}'::JSONB) AS template_info
            FROM billing.edi_templates bet
            WHERE bet.company_id = ${companyId}
            AND bet.template_type = 'edi'
            AND UPPER(TRIM(bet.name)) = UPPER(TRIM(${templateName}))
            LIMIT 1
        `;

        let {
            rows = []
        } = await query(sql.text, sql.values);

        return rows?.[0]?.template_info || null;
    },

    /**
     * To fetch the details for wcb claim submission
     * @param {Object} args
     * @returns {Object} {
     *          err,
     *          dir_path,
     *          file_store_id,
     *          created_dt,
     *          batch_number,
     *          rows
     *      }
     */
    getWcbClaimsData: async (args) => {
        const {
            companyId,
            claimIds,
            submission_code
        } = args;
        let errMsg = '';

        const fileSqlResponse = await ahsData.getCompanyFileStore(companyId);

        if (!fileSqlResponse || !fileSqlResponse?.rows?.length) {
            errMsg = `Company file store missing for companyId ${companyId}`;

            logger.error(errMsg);
            return {
                err: errMsg
            };
        }

        const {
            root_directory,
            file_store_id
        } = fileSqlResponse.rows[0] || {};

        const now = moment();
        const today = now.format(`YYYY/MM/DD`);
        const file_path = `WCB/${today}`;
        const dir_path = `${root_directory}/${file_path}`;
        const created_dt = now.format();

        // Logic changes as per one claim in one file

        const sql = SQL`
            WITH get_charges_data AS (
                SELECT
                    JSONB_BUILD_OBJECT (
                        'charge_bill_fee', bill_fee::NUMERIC
                        , 'units', bch.units
                        , 'calls'
                        , (
                            CASE
                                WHEN s.hospital_admission_dt IS NULL
                                THEN bch.units
                                ELSE EXTRACT(DAYS FROM s.study_dt - s.hospital_admission_dt)
                            END
                        )::INT
                        , 'health_service_code', cpt.display_code
                        , 'fee_modifiers', ARRAY[fee_mod.mod1, fee_mod.mod2, fee_mod.mod3]
                        , 'attachments', st.attachments
                        , 'service_start_date'
                        , CASE
                            WHEN s.hospital_admission_dt IS NULL
                            THEN TO_CHAR(timezone(f.time_zone, bc.claim_dt)::DATE, 'YYYYMMDD')
                            ELSE TO_CHAR(s.hospital_admission_dt, 'YYYYMMDD')
                        END
                        , 'billing_number', LPAD(pc_app.can_prid, 8, '0')
                        , 'practitioner_billing_number', LPAD(p_app.provider_info->'WCBBillingNumber' , 8, '0')
                        , 'invoice_type_code', 'MEDCARE'
                        , 'invoice_type_description', ''
                        , 'provider_skill_code', scc.code
                        , 'encounter_no', bc.encounter_no
                        , 'contract_id', '000001'
                        , 'place_of_service', pos.code
                        , 'orientation', orientation_data.orientation
                        , 'diagnosis_codes', COALESCE(icd.codes, '{}')
                    ) AS charge_details
                    , claim_id
                FROM billing.charges bch
                INNER JOIN billing.claims bc ON bc.id = bch.claim_id
                INNER JOIN public.facilities f ON f.id = bc.facility_id
                INNER JOIN public.cpt_codes cpt ON cpt.id = bch.cpt_id
                LEFT JOIN billing.charges_studies bcs ON bcs.charge_id = bch.id
                LEFT JOIN studies s ON s.id = bcs.study_id
                LEFT JOIN public.provider_contacts pc_app ON pc_app.id = bc.rendering_provider_contact_id
                LEFT JOIN public.providers p_app ON p_app.id = pc_app.provider_id
                LEFT JOIN public.skill_codes scc ON scc.id = bc.can_ahs_skill_code_id
                LEFT JOIN public.places_of_service pos ON pos.id = bc.place_of_service_id
                LEFT JOIN LATERAL (
                    SELECT
                        (
                            SELECT
                                code
                            FROM public.modifiers
                            WHERE
                                id = bch.modifier1_id
                                AND NOT is_implicit
                        ) AS mod1,
                        (
                            SELECT
                                code
                            FROM public.modifiers
                            WHERE
                                id = bch.modifier2_id
                                AND NOT is_implicit
                        ) AS mod2,
                        (
                            SELECT
                                code
                            FROM
                                public.modifiers
                            WHERE
                                id = bch.modifier3_id
                                AND NOT is_implicit
                        ) AS mod3
                ) fee_mod ON TRUE
                LEFT JOIN LATERAL (
                    SELECT
                        JSONB_AGG(attachment.attachments) AS attachments
                    FROM (
                        SELECT
                            JSONB_BUILD_OBJECT(
                                'study_id', study_id
                                , 'attachment_name', (study_transcriptions.id || '' || study_id || TO_CHAR(now(), 'YYYYMMDDHH24MISSMS') || 'attachment' || '.rtf')
                                , 'attachment_type', 'OTHER'
                                , 'attachment_description', 'This attachment contains approved report for the study'
                                , 'attachment_content', NULLIF(transcription_text, '')
                                , 'approved_dt', approved_dt
                                , 'approving_provider_id', approving_provider_id
                            ) AS attachments
                        FROM study_transcriptions
                        WHERE
                            study_id = s.id
                        LIMIT 3
                    ) AS attachment
                ) st ON TRUE
                LEFT JOIN LATERAL (
                    WITH bci AS (
                        SELECT
                            JSONB_BUILD_OBJECT(
                                'icd_code', icd.code
                                , 'icd_description', icd.description
                            ) AS icd_codes
                            , bci.claim_id
                        FROM billing.claim_icds bci
                        JOIN public.icd_codes icd ON bci.icd_id = icd.id
                        WHERE
                            bci.claim_id = bc.id
                        ORDER BY bci.id
                        LIMIT 3
                    )
                    SELECT
                        ARRAY_AGG(icd_codes) AS codes
                    FROM bci
                    GROUP BY bci.claim_id
                ) icd ON TRUE
                LEFT JOIN LATERAL (
                    SELECT JSONB_AGG(orientations.orientation) AS orientation
                    FROM (
                        SELECT
                            JSONB_BUILD_OBJECT(
                                'body_part_code', cawid.body_part_code
                                , 'body_part_description', cawid.body_part_code
                                , 'side_of_body_code', cawid.orientation_code
                                , 'side_of_body_description', cawid.orientation_code -- Handled side of body and body part description using code in encoder
                                , 'nature_of_injury_code', nic.code
                                , 'nature_of_injury_description', nic.description
                            ) AS orientation
                        FROM billing.claims bic
                        LEFT JOIN billing.can_ahs_wcb_injury_details cawid ON cawid.claim_id = bic.id
                        LEFT JOIN public.can_wcb_injury_codes nic ON nic.id = cawid.injury_id
                        WHERE
                            bic.id = bc.id
                            AND nic.injury_code_type = 'n'
                        LIMIT 5
                    ) orientations
                ) AS orientation_data ON TRUE
            )
            , claim_details AS (
                SELECT
                    bc.id AS exa_claim_id
                    , bc.original_reference AS wcb_claim_number
                    , TO_CHAR(now(), 'YYYYMMDD') AS created_date
                    , TO_CHAR(now(), 'YYYYMMDDHHMI') AS created_date_time
                    , ${submission_code} AS submission_code
                    , TO_CHAR(bc.can_wcb_referral_date, 'YYYYMMDD') AS referral_date
                    , bc.id AS clinic_reference_number
                    , bgct.charges_bill_fee_total::NUMERIC AS total_bill_fee
                    , bc.encounter_no
                    , nextVal('billing.edi_file_claims_sequence_number_seq') % 10000000 AS batch_sequence_number
                    , JSONB_BUILD_OBJECT(
                        'patient_mrn', p.account_no,
                        'last_name', p.last_name,
                        'first_name', p.first_name,
                        'middle_name', p.middle_name,
                        'birth_date', TO_CHAR(p.birth_date, 'YYYYMMDD'),
                        'gender', p.gender,
                        'address1', REGEXP_REPLACE(COALESCE(p.patient_info -> 'c1AddressLine1', ''), '[#-]', '', 'g'),
                        'address2', REGEXP_REPLACE(COALESCE(p.patient_info -> 'c1AddressLine2', ''), '[#-]', '', 'g'),
                        'city', COALESCE(p.patient_info -> 'c1City', ''),
                        'postal_code', REGEXP_REPLACE(COALESCE(p.patient_info -> 'c1Zip', p.patient_info -> 'c1PostalCode', ''), '\\s', '', 'g'),
                        'province_code', COALESCE(p.patient_info -> 'c1State', p.patient_info -> 'c1Province', ''),
                        'country_code', COALESCE(TRIM(p.patient_info -> 'c1country'), ''),
                        'phone_number', NULLIF(TRIM(p.patient_info->'c1HomePhone'), ''),
                        'phone_area_code', SUBSTRING(REGEXP_REPLACE(TRIM(p.patient_info->'c1HomePhone'), '[()#-]', '', 'g'), 1, 3),
                        'patient_phn', (
                            CASE
                                WHEN ppaa.province_alpha_2_code = 'AB' AND i.issuer_type = 'uli_phn'
                                THEN ppaa.alt_account_no
                                ELSE NULL
                            END),
                        'patient_phn_flag', (
                            CASE
                                WHEN ppaa.province_alpha_2_code = 'AB' AND i.issuer_type = 'uli_phn'
                                THEN 'N'
                                ELSE 'Y'
                            END)
                      ) AS patient_data
                    , JSONB_BUILD_OBJECT(
                        'last_name', p_ref.last_name,
                        'first_name', p_ref.first_name,
                        'middle_name', p_ref.middle_initial,
                        'suffix', p_ref.suffix,
                        'prefix', null,
                        'address1', TRIM(REGEXP_REPLACE(COALESCE(pc_ref.contact_info -> 'ADDR1', ''), '[#-]', '', 'g')),
                        'address2', TRIM(REGEXP_REPLACE(COALESCE(pc_ref.contact_info -> 'ADDR2', ''), '[#-]', '', 'g')),
                        'city', COALESCE(pc_ref.contact_info -> 'CITY', ''),
                        'postal_code', REGEXP_REPLACE(COALESCE(pc_ref.contact_info -> 'ZIP', pc_ref.contact_info -> 'POSTALCODE', ''), '\\s', '', 'g'),
                        'province_code', COALESCE(pc_ref.contact_info -> 'STATE', pc_ref.contact_info -> 'STATE_NAME', ''),
                        'country_code', COALESCE(pc_ref.contact_info -> 'COUNTRY', '')
                      ) AS ref_provider_data
                    , JSONB_BUILD_OBJECT(
                        'last_name', p_app.last_name,
                        'first_name', p_app.first_name,
                        'middle_name', p_app.middle_initial,
                        'suffix', p_app.suffix,
                        'address1', TRIM(REGEXP_REPLACE(COALESCE(pc_app.contact_info -> 'ADDR1', ''), '[#-]', '', 'g')),
                        'address2', TRIM(REGEXP_REPLACE(COALESCE(pc_app.contact_info -> 'ADDR2', ''), '[#-]', '', 'g')),
                        'city', COALESCE(pc_app.contact_info -> 'CITY', ''),
                        'postal_code', REGEXP_REPLACE(COALESCE(pc_app.contact_info -> 'ZIP', pc_app.contact_info -> 'POSTALCODE', ''), '\\s', '', 'g'),
                        'province_code', COALESCE(pc_app.contact_info -> 'STATE', pc_app.contact_info -> 'STATE_NAME', ''),
                        'country_code', COALESCE(pc_app.contact_info -> 'COUNTRY', ''),
                        'fax_area_code', SUBSTRING(REGEXP_REPLACE(TRIM(pc_app.contact_info -> 'FAXNO'), '[()#-]', '', 'g'), 1, 3),
                        'fax_number', NULLIF(pc_app.contact_info-> 'FAXNO', ''),
                        'provider_skill_code', scc.code,
                        'contract_id', '000001',
                        'role', 'GP',
                        'billing_number', LPAD(pc_app.can_prid, 8, '0'),
                        'practitioner_billing_number', LPAD(p_app.provider_info->'WCBBillingNumber', 8, '0')
                    ) AS practitioner_data
                    , bp.address_line1 AS invoice_submitter_address
                    , bp.city AS invoice_submitter_city
                    , get_full_name(p_app.last_name, p_app.first_name, p_app.middle_initial, NULL, p_app.suffix) AS invoice_submitter_name
                    , bp.npi_no AS invoice_submitter_id
                    , bp.state AS invoice_submitter_state
                    , bp.zip_code AS invoice_submitter_zipcode
                    , bc.patient_id
                    , bc.facility_id
                    , bc.accident_state
                    , TO_CHAR(bc.current_illness_date, 'YYYYMMDD') AS accident_date
                    , 'MEDCARE' AS invoice_type_code
                    , '' AS invoice_type_description      -- value will be provided only if invoice_type_code = MEDSUPPLY
                    , pos.code AS place_of_service
                    , '' AS additional_injuries
                    , cd.charges
                FROM billing.claims bc
                INNER JOIN public.facilities f ON f.id = bc.facility_id
                INNER JOIN billing.claim_status bcs ON bcs.id = bc.claim_status_id
                INNER JOIN public.patients p ON p.id = bc.patient_id
                INNER JOIN billing.providers bp ON bp.id = bc.billing_provider_id
                LEFT JOIN public.skill_codes scc ON scc.id = bc.can_ahs_skill_code_id
                LEFT JOIN public.places_of_service pos ON pos.id = bc.place_of_service_id
                LEFT JOIN public.patient_alt_accounts ppaa ON ppaa.patient_id = bc.patient_id
                    AND ppaa.issuer_id = bc.can_issuer_id
                    AND LOWER(ppaa.country_alpha_3_code) = 'can'
                    AND ppaa.is_primary
                LEFT JOIN public.issuers i ON i.id = ppaa.issuer_id
                    AND i.inactivated_dt IS NULL
                    AND i.issuer_type = 'uli_phn'
                LEFT JOIN public.provider_contacts pc_app ON pc_app.id = bc.rendering_provider_contact_id
                LEFT JOIN public.providers p_app ON p_app.id = pc_app.provider_id
                LEFT JOIN public.provider_contacts pc_ref ON pc_ref.id = bc.referring_provider_contact_id
                LEFT JOIN public.providers p_ref ON p_ref.id = pc_ref.provider_id
                LEFT JOIN LATERAL billing.get_claim_totals(bc.id) bgct ON TRUE
                LEFT JOIN LATERAL (
                    SELECT
                        JSONB_AGG(charge_details) AS charges
                        , claim_id
                    FROM get_charges_data
                    GROUP BY claim_id
                ) cd ON cd.claim_id = bc.id
                WHERE bc.id = ANY(${claimIds})
                ORDER BY bc.id DESC
            )
            SELECT
                'EXA' AS sender_application
                , c.company_name AS sender_facility
                , gbn.batch_number
                , TO_CHAR(now(), 'YYYYMMDDHHMI') AS created_date_time
                , '' AS file_comment
                , '' AS batch_comment
                , LPAD(cd.claims_count, 3, '0') AS batch_count
                , LPAD(cd.claims_count, 3, '0') AS file_batch_count
                , cd.claims_count || ' REPORTS IN THIS FILE' AS file_trailer_comment
                , ${submission_code} || gbn.batch_number AS submitter_transaction_id
                , ${submission_code} || '.' || gbn.batch_number || '.' || TO_CHAR(now(), 'YYYYMMDDHHMISS') || '.xml' AS file_name
                , cd.claims_data
            FROM companies c
            LEFT JOIN LATERAL (
                SELECT
                    JSONB_AGG(
                        ROW_TO_JSON(cd.*)
                    ) AS claims_data
                    , COUNT(DISTINCT cd.exa_claim_id)::TEXT AS claims_count
                FROM claim_details cd
            ) cd ON TRUE
            LEFT JOIN LATERAL (
                SELECT
                    NEXTVAL('billing.edi_file_claims_batch_number_seq') % 1000000 AS batch_number
            ) gbn ON TRUE
            WHERE c.id = ${companyId}
        `;

        let { rows = [] } = await query(sql.text, sql.values);

        if (!rows?.length) {
            errMsg = 'Error occured on fetching claim details...';

            return {
                err: errMsg,
                rows
            };
        }

        return {
            err: null,
            dir_path,
            file_store_id,
            created_dt,
            batch_number: rows?.[0]?.batch_number || '',
            rows: rows
        };
    },

    getClaimsData: async (args) => {

        const {
            claimIds,
        } = args;
        const sql = SQL`
            SELECT
                bc.id AS claim_id,
                pp.first_name AS patient_first_name,
                pp.last_name AS patient_last_name,
                pp.gender AS patient_gender,
                pp.birth_date::DATE AS patient_birth_date,
                cawid.id AS wcb_injury_id,
                COALESCE(bc.encounter_no, '1')::TEXT AS encounters,
                pp.patient_info->'c1AddressLine1' AS patient_address,
                pp.patient_info->'c1City' AS patient_city,
                COALESCE(pp.patient_info -> 'c1State', pp.patient_info -> 'c1Province', '') AS patient_postal_code,
                bc.current_illness_date AS accident_date,
                p_app.first_name AS practitioner_first_name,
                p_app.last_name AS practitioner_last_name,
                scc.code AS practitioner_skill_code,
                p_ref.first_name AS ref_phy_name,
                bc.billing_method,
                bc.can_ahs_pay_to_code                       AS pay_to_code,
                pc.can_submitter_prefix                  AS submitter_prefix,
                bc.can_ahs_business_arrangement              AS business_arrangement,
                bc.can_supporting_text                   AS supporting_text_1,
                f.can_facility_number                        AS facility_number,
                icd.codes[1]                                 AS diagnosis_code_1,
                pip.insurance_name                           AS "payerName",
                get_full_name(pp.last_name,pp.first_name)    AS "patientName",
                claim_notes                                  AS "claimNotes",
                pp.first_name                                AS "patient_first_name",
                pc_app.can_prid                          AS "service_provider_prid",
                LOWER(pip.insurance_code) AS insurance_code,
                ppaa.country_alpha_3_code = 'can' AND ppaa.province_alpha_2_code = 'AB' AS is_alberta_phn,
                ppaa.alt_account_no AS patient_phn,
                pc_c.can_prid AS "provider_prid",
                CASE
                    WHEN LOWER(COALESCE(
                        pc_c.contact_info -> 'STATE',
                        pc_c.contact_info -> 'STATE_NAME',
                        ''
                    )) NOT IN ( 'ab', 'alberta', '' )
                    THEN 'Y'
                    ELSE ''
                END AS oop_referral_indicator,
                COALESCE(pp.patient_info -> 'c1State', pp.patient_info -> 'c1Province', '') AS province_code,
                NULLIF(bgct.charges_bill_fee_total, 0::MONEY) AS "claim_totalCharge",
                bcs.code AS claim_status_code,
                bc.original_reference,
                bc.payer_type,
                pos.code AS place_of_service,
                pip.insurance_code AS payer_code,
                cd.charges_details
                FROM billing.claims bc
                INNER JOIN billing.claim_status bcs ON bcs.id = bc.claim_status_id
                INNER JOIN billing.get_claim_totals(bc.id) bgct ON TRUE
                LEFT JOIN public.companies pc ON pc.id = bc.company_id
                LEFT JOIN public.patients pp ON pp.id = bc.patient_id
                LEFT JOIN public.skill_codes scc ON scc.id = bc.can_ahs_skill_code_id
                LEFT JOIN public.provider_contacts pc_app ON pc_app.id = bc.rendering_provider_contact_id
                LEFT JOIN public.providers p_app ON p_app.id = pc_app.provider_id
                LEFT JOIN public.provider_contacts pc_c ON pc_c.id = bc.referring_provider_contact_id
                LEFT JOIN public.providers p_ref ON p_ref.id = pc_c.provider_id
                LEFT JOIN public.facilities f ON f.id = bc.facility_id
                LEFT JOIN public.places_of_service pos ON pos.id = bc.place_of_service_id
                LEFT JOIN billing.claim_patient_insurances bcpi ON bcpi.claim_id = bc.id AND bcpi.coverage_level = 'primary'
                LEFT JOIN public.patient_insurances ppi  ON ppi.id = bcpi.patient_insurance_id
                LEFT JOIN public.insurance_providers pip ON pip.id = ppi.insurance_provider_id
                LEFT JOIN LATERAL (
                    SELECT id
                    FROM billing.can_ahs_wcb_injury_details cawid
                    WHERE cawid.claim_id = bc.id
                    LIMIT 1
                ) cawid ON TRUE
                LEFT JOIN public.patient_alt_accounts ppaa ON ppaa.patient_id = bc.patient_id
                    AND ppaa.issuer_id = bc.can_issuer_id
                    AND ppaa.is_primary
                LEFT JOIN LATERAL (
                    WITH bci AS (
                        SELECT
                            bci.id,
                            bci.claim_id,
                            icd.code
                        FROM
                            billing.claim_icds bci
                        JOIN public.icd_codes icd
                             ON icd_id = icd.id
                        WHERE
                            claim_id = bc.id
                        ORDER BY
                            bci.id
                        LIMIT
                            3
                    )
                    SELECT
                        ARRAY_AGG(code) AS codes
                    FROM
                        bci
                    GROUP BY
                        bci.claim_id
                ) icd ON TRUE
                LEFT JOIN LATERAL (
                    SELECT
                        JSONB_AGG(
                            JSONB_BUILD_OBJECT(
                                'service_date', bch.charge_dt
                                , 'health_service_code', pcc.display_code
                                , 'health_service_description', pcc.display_description
                                , 'skill_code', s.code
                                , 'calls'
                                , CASE
                                    WHEN s.hospital_admission_dt IS NULL
                                    THEN bch.units
                                    ELSE EXTRACT(DAYS FROM s.study_dt - s.hospital_admission_dt)
                                  END::TEXT
                                , 'fee_submitted', bch.bill_fee
                            )
                        ) AS charges_details
                        , bch.claim_id
                    FROM billing.charges bch
                    LEFT JOIN public.cpt_codes pcc ON pcc.id = bch.cpt_id
                    LEFT JOIN LATERAL (
                        SELECT
                            sc.code,
                            s.hospital_admission_dt,
                            s.study_dt
                        FROM billing.charges_studies bchs
                        LEFT JOIN public.studies s ON s.id = bchs.study_id
                        LEFT JOIN public.skill_codes sc ON sc.id = s.can_ahs_skill_code_id
                        WHERE bchs.charge_id = bch.id
                    ) AS s ON TRUE
                    WHERE bch.claim_id = ANY (${claimIds})
                    GROUP BY
                        bch.claim_id
                ) AS cd ON cd.claim_id = bc.id
                WHERE bc.id = ANY (${claimIds})
                ORDER BY bc.id DESC
            `;

        return (await query(sql.text, sql.values)).rows;
    },

    updateAHSClaimNumbers: async ({claimIds}) => {
        const sql = SQL`
            UPDATE billing.claims bc
            SET can_ahs_claim_number = billing.can_ahs_get_claim_number(ids)
            FROM UNNEST(${claimIds}::BIGINT[]) ids
            WHERE bc.id = ids
            RETURNING id, can_ahs_claim_number
        `;

        return await query(sql.text, sql.values);
    },

    saveAddedClaims: async function (args) {

        const {
            companyId,
            claimIds,
            source
        } = args;

        let data = ``;
        let file_type = '';

        const fileSqlResponse = await ahsData.getCompanyFileStore(companyId);

        if ( !fileSqlResponse || fileSqlResponse.rows.length === 0 ) {
            return null;
        }

        const {
            file_store_id,
            root_directory,
            submitter_prefix,
        } = fileSqlResponse.rows.pop();

        const now = moment();
        const created_dt = now.format();
        const today = now.format(`YYYY/MM/DD`);
        const file_name = `${submitter_prefix}_${shared.getUID().replace(/\./g, '')}`;
        const file_path = `AHS/${today}`;
        const dir_path = `${root_directory}/${file_path}`;
        const fullPath = `${dir_path}/${file_name}`;

        await mkdirpAsync(dir_path);
        await writeFileAsync(fullPath, data, { 'encoding': `utf8` });

        let {
            size: file_size,
        } = await statAsync(fullPath);

        let file_md5 = crypto
            .createHash(`MD5`)
            .update(data, `utf8`)
            .digest(`hex`);

        switch (source) {
            case 'delete':
                file_type = 'can_ahs_d';
                break;
            case 'reassessment':
                file_type = 'can_ahs_r';
                break;
            case 'change':
                file_type = 'can_ahs_c';
                break;
            default:
                file_type = 'can_ahs_a';
        }

        const edi_file_id = await this.storeFile({
            file_name,
            file_md5,
            file_size,
            file_type,
            file_store_id,
            companyId,
            file_path,
            created_dt,
        });

        const sql = SQL`
            WITH
                resubmission_claims AS(
                    SELECT
                        claim_id
                      , MAX(batch_number) AS batch_number
                      , MAX(sequence_number) AS sequence_number
                      , MAX(edi_file_id) AS edi_file_id
                      , MAX(can_ahs_year_source_code) AS can_ahs_year_source_code
                    FROM billing.edi_file_claims
                    WHERE claim_id = ANY(${claimIds}) AND can_ahs_action_code = 'a'
                    GROUP BY can_ahs_action_code, claim_id
                    ORDER BY sequence_number DESC
                ),
                status AS (
                    SELECT
                        id
                    FROM
                        billing.claim_status
                    WHERE
                        code = 'PS'
                    LIMIT
                        1
                ),
                inserted_efc AS (
                    INSERT INTO billing.edi_file_claims (
                        claim_id,
                        batch_number,
                        sequence_number,
                        can_ahs_action_code,
                        edi_file_id,
                        can_ahs_year_source_code
                    )
                    SELECT
                        c.id,
                        n.batch_number::TEXT,
                        CASE
                            WHEN ${source} = 'reassessment' OR ${source} = 'change' OR ${source} = 'delete'
                                THEN rsc.sequence_number
                            ELSE nextVal('billing.edi_file_claims_sequence_number_seq') % 10000000
                        END,
                        CASE
                            WHEN ${source} = 'reassessment'
                            THEN 'r'
                            WHEN ${source} = 'delete'
                            THEN 'd'
                            WHEN ${source} = 'change'
                            THEN 'c'
                            ELSE 'a'
                        END,
                        ${edi_file_id},
                        CASE
                            WHEN ${source} = 'add'
                            THEN TO_CHAR(CURRENT_DATE, 'YYMM')
                            ELSE rsc.can_ahs_year_source_code
                        END
                    FROM billing.claims c
                    INNER JOIN (
                        SELECT nextVal('billing.edi_file_claims_batch_number_seq') % 1000000 AS batch_number
                    ) n ON TRUE
                    LEFT JOIN resubmission_claims rsc ON rsc.claim_id = c.id
                    WHERE c.id = ANY(${claimIds})
                    RETURNING
                        *
                ),
                updated AS (
                    UPDATE
                        billing.claims
                    SET
                        claim_status_id = status.id
                    FROM
                        status
                    WHERE
                        billing.claims.id IN (
                            SELECT DISTINCT
                                claim_id
                            FROM
                                inserted_efc
                        )
                    RETURNING
                        billing.claims.*
                ),
                patient_id_nums AS (
                    SELECT DISTINCT
                        u.patient_id,
                        alt.is_primary,
                        province_alpha_2_code,
                        i.issuer_type,
                        alt.alt_account_no
                    FROM
                        updated u
                    LEFT JOIN public.patient_alt_accounts alt
                        ON alt.patient_id = u.patient_id
                    LEFT JOIN public.issuers i
                        ON i.id = alt.issuer_id
                    WHERE
                        i.id IS NOT NULL
                        AND LOWER(TRIM(country_alpha_3_code)) = 'can'
                        AND i.inactivated_dt IS NULL
                    GROUP BY
                        u.patient_id,
                        alt.is_primary,
                        i.issuer_type,
                        province_alpha_2_code,
                        alt.alt_account_no
                    ORDER BY
                        alt.is_primary,
                        i.issuer_type,
                        province_alpha_2_code
                ),
                nums AS (
                    SELECT DISTINCT
                        pin.patient_id,

                        (SELECT alt_account_no FROM patient_id_nums WHERE patient_id = pin.patient_id AND issuer_type = 'uli_phn' AND is_primary LIMIT 1)                            AS service_recipient_phn,
                        (SELECT province_alpha_2_code FROM patient_id_nums WHERE patient_id = pin.patient_id AND issuer_type = 'uli_phn' AND is_primary LIMIT 1)                            AS service_recipient_phn_province,

                        (SELECT alt_account_no FROM patient_id_nums WHERE patient_id = pin.patient_id AND issuer_type = 'uli_phn_parent' LIMIT 1)                            AS service_recipient_parent_phn,
                        (SELECT province_alpha_2_code FROM patient_id_nums WHERE patient_id = pin.patient_id AND issuer_type = 'uli_phn_parent' LIMIT 1)                            AS service_recipient_parent_phn_province,

                        (SELECT alt_account_no FROM patient_id_nums WHERE patient_id = pin.patient_id AND issuer_type = 'registration_number' LIMIT 1)                   AS service_recipient_registration_number,
                        (SELECT province_alpha_2_code FROM patient_id_nums WHERE patient_id = pin.patient_id AND issuer_type = 'registration_number' LIMIT 1)                   AS service_recipient_registration_number_province,

                        (SELECT alt_account_no FROM patient_id_nums WHERE patient_id = pin.patient_id AND issuer_type = 'registration_number_parent' LIMIT 1)            AS service_recipient_parent_registration_number,
                        (SELECT province_alpha_2_code FROM patient_id_nums WHERE patient_id = pin.patient_id AND issuer_type = 'registration_number_parent' LIMIT 1)            AS service_recipient_parent_registration_number_province,

                        (SELECT alt_account_no FROM patient_id_nums WHERE patient_id = pin.patient_id AND issuer_type = 'pid' LIMIT 1)                                   AS service_recipient_pid,
                        (SELECT province_alpha_2_code FROM patient_id_nums WHERE patient_id = pin.patient_id AND issuer_type = 'pid' LIMIT 1)                            AS service_recipient_pid_province
                    FROM
                        patient_id_nums pin
                ),
                oop_claim_info AS (
                    SELECT
                        nums.patient_id,
                        CASE
                            WHEN nums.service_recipient_phn IS NOT NULL AND nums.service_recipient_phn_province = 'AB'
                            AND (
                                nums.service_recipient_registration_number IS NULL
                                OR (
                                    nums.service_recipient_registration_number_province = 'AB'
                                    AND nums.service_recipient_registration_number IS NOT NULL
                                )
                            )
                            AND (
                                nums.service_recipient_pid IS NULL
                                OR (
                                    nums.service_recipient_pid_province = 'AB'
                                )
                                OR (
                                    nums.service_recipient_phn_province = 'AB'
                                    AND nums.service_recipient_registration_number_province = 'AB'
                                    AND nums.service_recipient_pid_province != 'AB'
                                )
                            )
                            THEN nums.service_recipient_phn
                            ELSE NULL
                        END AS service_recipient_phn,
                        CASE
                            WHEN nums.service_recipient_registration_number IS NOT NULL
                                AND (
                                    nums.service_recipient_phn IS NULL
                                    OR nums.service_recipient_phn_province != 'AB'
                                    OR (
                                        nums.service_recipient_phn_province = 'AB'
                                        AND nums.service_recipient_registration_number_province != 'AB'
                                    )
                                )
                            THEN nums.service_recipient_registration_number
                            WHEN nums.service_recipient_pid IS NOT NULL AND (
                                nums.service_recipient_phn IS NULL
                                OR nums.service_recipient_phn_province != 'AB'
                                OR (
                                    nums.service_recipient_phn_province = 'AB'
                                    AND nums.service_recipient_pid_province != 'AB'
                                )
                            )
                            AND (
                                nums.service_recipient_registration_number IS NULL
                                OR nums.service_recipient_registration_number_province != 'AB'
                            )
                            THEN nums.service_recipient_pid
                            ELSE NULL
                        END AS service_recipient_registration_number,
                        CASE
                            WHEN nums.service_recipient_registration_number IS NOT NULL
                            AND (
                                nums.service_recipient_phn IS NULL
                                OR nums.service_recipient_phn_province != 'AB'
                                OR (
                                    nums.service_recipient_phn_province = 'AB'
                                    AND nums.service_recipient_registration_number_province != 'AB'
                                )
                            )
                            THEN 'registration_number'
                            WHEN nums.service_recipient_pid IS NOT NULL AND (
                                nums.service_recipient_phn IS NULL
                                OR nums.service_recipient_phn_province != 'AB'
                                OR (
                                    nums.service_recipient_phn_province = 'AB'
                                    AND nums.service_recipient_pid_province != 'AB'
                                )
                            )
                            AND (
                                nums.service_recipient_registration_number IS NULL
                                OR nums.service_recipient_registration_number_province != 'AB'
                            )
                            THEN 'pid'
                            ELSE NULL
                        END AS service_recipient_account_type
                    FROM nums
                ),
                claim_info AS (
                    SELECT
                        bc.id                                        AS claim_id,
                        inserted_efc.can_ahs_action_code             AS action_code,
                        comp.can_submitter_prefix                AS submitter_prefix,
                        inserted_efc.batch_number                    AS batch_number,
                        inserted_efc.can_ahs_year_source_code        AS year_source_code,
                        inserted_efc.sequence_number                 AS sequence_number,
                        billing.get_can_ahs_mod10_for_claim_sequence_number(
                            inserted_efc.sequence_number :: INT8
                        )                                            AS check_digit,
                        p_app.provider_info->'WCBBillingNumber'      AS wcb_billing_number,

                        -- currently hard-coded - AHS does not support another code right now
                        'CIP1'                                       AS transaction_type,

                        'RGLR'                                      AS claim_type,
                        pc_app.can_prid                             AS service_provider_prid,

                        CASE
                            WHEN
                                (
                                    SELECT
                                        COUNT(*)
                                    FROM
                                        provider_skill_codes psc
                                    INNER JOIN
                                        provider_contacts AS pc
                                    ON
                                        pc.provider_id = psc.provider_id
                                    WHERE
                                        pc.id = bc.rendering_provider_contact_id ) > 1
                            THEN
                                sc.code
                            ELSE
                                NULL
                        END  AS skill_code,
                        oci.service_recipient_phn,
                        nums.service_recipient_phn_province,
                        nums.service_recipient_parent_phn,
                        nums.service_recipient_parent_phn_province,
                        oci.service_recipient_registration_number,
                        nums.service_recipient_registration_number_province,
                        nums.service_recipient_parent_registration_number,
                        nums.service_recipient_parent_registration_number_province,
                        CASE
                            WHEN oci.service_recipient_phn IS NOT NULL
                            THEN NULL
                            ELSE JSONB_BUILD_OBJECT(
                                'person_type', 'RECP',
                                'first_name', p.first_name,
                                'middle_name', p.middle_name,
                                'last_name', p.last_name,
                                'birth_date', TO_CHAR(p.birth_date, 'YYYYMMDD'),
                                'gender_code', p.gender,
                                'address1', REGEXP_REPLACE(COALESCE(p.patient_info -> 'c1AddressLine1', ''), '[#-]', '', 'g'),
                                'address2', REGEXP_REPLACE(COALESCE(p.patient_info -> 'c1AddressLine2', ''), '[#-]', '', 'g'),
                                'address3', '',
                                'city', COALESCE(p.patient_info -> 'c1City', ''),
                                'postal_code', REGEXP_REPLACE(COALESCE(p.patient_info -> 'c1Zip', p.patient_info -> 'c1PostalCode', ''), '\\s', '', 'g'),
                                'province_code', COALESCE(p.patient_info -> 'c1State', p.patient_info -> 'c1Province', ''),
                                'country_code', COALESCE(p.patient_info -> 'c1country', ''),
                                'parent_phn', COALESCE(nums.service_recipient_parent_phn, ''),
                                'parent_registration_number', COALESCE(nums.service_recipient_parent_registration_number, '')
                            )
                        END                                          AS service_recipient_details,

                        cpt.display_code                             AS health_service_code,
                        CASE
                            WHEN s.hospital_admission_dt IS NULL
                                THEN TO_CHAR(timezone(f.time_zone, bc.claim_dt)::date, 'YYYYMMDD')
                                ELSE TO_CHAR(s.hospital_admission_dt, 'YYYYMMDD')
                        END                                          AS service_start_date,
                        bc.encounter_no AS encounter_number,
                        icd.codes[1]                                 AS diagnosis_code_1,
                        icd.codes[2]                                 AS diagnosis_code_2,
                        icd.codes[3]                                 AS diagnosis_code_3,

                        -- @TODO - this may need + 1 for the days extract to make same-day considered as "1 consecutive day"
                        -- Documentation is unclear so leaving as-is until testing
                        (
                            CASE
                                WHEN s.hospital_admission_dt IS NULL
                                THEN bch.units
                                ELSE EXTRACT(DAYS FROM s.study_dt - s.hospital_admission_dt)
                            END
                        ) :: INT                                        AS calls,

                    --     fee_mod.codes[1]                             AS fee_modifier_1,
                    --     fee_mod.codes[2]                             AS fee_modifier_2,
                    --     fee_mod.codes[3]                             AS fee_modifier_3,
                        fee_mod.mod1 AS fee_modifier_1,
                        fee_mod.mod2 AS fee_modifier_2,
                        fee_mod.mod3 AS fee_modifier_3,
                        f.can_facility_number                        AS facility_number,
                        fc.code                                      AS functional_centre,
                        CASE
                            WHEN NULLIF(f.can_facility_number, '') :: INT > 0
                            THEN ''
                            ELSE COALESCE(NULLIF((o.order_info -> 'patientLocation'), ''), 'OTHR')
                        END                                          AS location_code,

                        orig_fac.facility_number                     AS originating_facility,
                        CASE
                            WHEN s.can_ahs_originating_facility_id IS NOT NULL
                            THEN ''
                            ELSE s.can_ahs_originating_location
                        END                                          AS originating_location,

                        bc.can_ahs_business_arrangement              AS business_arrangement,
                        bc.can_ahs_pay_to_code                       AS pay_to_code,
                        bc.can_ahs_pay_to_uli                        AS pay_to_uli,

                        -- Use this to create person data segment CPD1
                        bc.can_ahs_pay_to_details                    AS pay_to_details,
                        bc.can_ahs_locum_arrangement                 AS locum_arrangement,
                        pc_ref.can_prid                          AS referral_id,

                        CASE
                            WHEN LOWER(COALESCE(
                                pc_ref.contact_info -> 'STATE',
                                pc_ref.contact_info -> 'STATE_NAME',
                                ''
                            )) NOT IN ( 'ab', 'alberta', '' )
                            THEN 'Y'
                            ELSE ''
                        END                                          AS oop_referral_indicator,

                        CASE
                            WHEN NULLIF(pc_ref.can_prid, '') IS NULL AND p_ref.id IS NOT NULL
                            THEN JSONB_BUILD_OBJECT(
                                'person_type', 'RFRC',
                                'first_name', p_ref.first_name,
                                'middle_name', p_ref.middle_initial,
                                'last_name', p_ref.last_name,
                                'birth_date', '',
                                'gender_code', '',
                                'address1', (
                                    CASE
                                        WHEN pc_ref.provider_group_id IS NOT NULL
                                        THEN ( SELECT group_name FROM provider_groups WHERE id = pc_ref.provider_group_id )
                                        ELSE TRIM(
                                            regexp_replace(COALESCE(pc_ref.contact_info -> 'ADDR1', ''), '[#-]', '', 'g') || ' ' ||
                                            regexp_replace(COALESCE(pc_ref.contact_info -> 'ADDR2', ''), '[#-]', '', 'g')
                                        )
                                    END
                                ),
                                'address2', (
                                    CASE
                                        WHEN pc_ref.provider_group_id IS NOT NULL
                                        THEN TRIM(
                                            regexp_replace(COALESCE(pc_ref.contact_info -> 'ADDR1', ''), '[#-]', '', 'g') || ' ' ||
                                            regexp_replace(COALESCE(pc_ref.contact_info -> 'ADDR2', ''), '[#-]', '', 'g')
                                        )
                                        ELSE ''
                                    END
                                ),
                                'address3', '',
                                'city', COALESCE(pc_ref.contact_info -> 'CITY', ''),
                                'postal_code', REGEXP_REPLACE(COALESCE(pc_ref.contact_info -> 'ZIP', pc_ref.contact_info -> 'POSTALCODE', ''), '\\s', '', 'g'),
                                'province_code', COALESCE(pc_ref.contact_info -> 'STATE', pc_ref.contact_info -> 'STATE_NAME', ''),
                                'country_code', COALESCE(pc_ref.contact_info -> 'COUNTRY', ''),
                                'parent_phn', '',
                                'parent_registration_number', ''
                            )
                            ELSE NULL
                        END                                          AS referring_provider_details,

                        CASE
                            WHEN oci.service_recipient_registration_number IS NOT NULL
                            THEN CASE
                                    WHEN oci.service_recipient_account_type = 'registration_number'
                                        AND LOWER(nums.service_recipient_registration_number_province) NOT IN ('ab', 'qc')
                                    THEN nums.service_recipient_registration_number_province
                                    WHEN oci.service_recipient_account_type = 'pid'
                                        AND LOWER(nums.service_recipient_pid_province) NOT IN ('ab', 'qc')
                                    THEN nums.service_recipient_pid_province
                                END
                            ELSE ''
                        END                                          AS recovery_code,
                        bc.id                                        AS chart_number,

                        totals.charges_bill_fee_total :: NUMERIC     AS claimed_amount,

                        CASE
                            WHEN bc.can_ahs_claimed_amount_indicator
                            THEN 'Y'
                            ELSE ''
                        END                                          AS claimed_amount_indicator,

                        CASE
                            WHEN bc.can_confidential
                            THEN 'Y'
                            ELSE ''
                        END                                          AS confidential_indicator,

                        ''                                           AS good_faith_indicator,

                        bc.can_ahs_newborn_code                      AS newborn_code,

                        CASE
                            WHEN NULLIF(bc.can_ahs_emsaf_reason, '') IS NOT NULL
                            THEN 'Y'
                            ELSE 'N'
                        END                                          AS emsaf_indicator,

                        bc.can_ahs_emsaf_reason                      AS emsaf_reason,

                        CASE
                            WHEN bc.can_ahs_paper_supporting_docs
                            THEN 'Y'
                            ELSE ''
                        END             AS paper_supporting_documentation_indicator,

                        TO_CHAR(s.hospital_admission_dt, 'YYYYMMDD') AS hospital_admission_date,
                        s.can_ahs_tooth_code                         AS tooth_code,
                        s.can_ahs_tooth_surface1                     AS tooth_surface1,
                        s.can_ahs_tooth_surface2                     AS tooth_surface2,
                        s.can_ahs_tooth_surface3                     AS tooth_surface3,
                        s.can_ahs_tooth_surface4                     AS tooth_surface4,
                        s.can_ahs_tooth_surface5                     AS tooth_surface5,
                        bc.can_supporting_text,
                        inserted_efc.edi_file_id
                    FROM
                        inserted_efc
                    LEFT JOIN updated bc
                        ON bc.id = inserted_efc.claim_id

                    LEFT JOIN LATERAL (
                        SELECT
                            charges_bill_fee_total
                        FROM
                            billing.get_claim_totals(bc.id)
                        LIMIT
                            1
                    ) totals ON TRUE

                    LEFT JOIN billing.charges bch
                        ON bch.claim_id = bc.id
                    LEFT JOIN billing.charges_studies bchs
                        ON bchs.charge_id = bch.id
                    LEFT JOIN public.studies s
                        ON s.id = bchs.study_id
                    LEFT JOIN public.orders o
                        ON o.id = s.order_id
                    LEFT JOIN LATERAL (
                        SELECT
                            study_id,
                            approving_provider_id,
                            approved_dt
                        FROM study_transcriptions
                        WHERE study_id = s.id
                        ORDER BY approved_dt DESC
                        LIMIT 1
                    ) st ON TRUE
                    LEFT JOIN public.companies comp
                        ON comp.id = 1
                    LEFT JOIN public.provider_contacts pc_app
                        ON pc_app.id = bc.rendering_provider_contact_id
                    LEFT JOIN public.providers p_app
                        ON p_app.id = pc_app.provider_id
                    LEFT JOIN public.provider_contacts pc_ref
                        ON pc_ref.id = bc.referring_provider_contact_id
                    LEFT JOIN public.providers p_ref
                        ON p_ref.id = pc_ref.provider_id
                    LEFT JOIN public.skill_codes sc
                        ON sc.id = bc.can_ahs_skill_code_id
                    LEFT JOIN public.functional_centres fc
                        ON fc.id = s.can_ahs_functional_centre_id
                    LEFT JOIN public.originating_facilities orig_fac
                        ON orig_fac.id = s.can_ahs_originating_facility_id
                    LEFT JOIN public.patients p
                        ON p.id = bc.patient_id
                    LEFT JOIN nums
                        ON nums.patient_id = p.id
                    LEFT JOIN oop_claim_info oci
                        ON nums.patient_id = oci.patient_id
                    LEFT JOIN public.cpt_codes cpt
                        ON cpt.id = bch.cpt_id
                    LEFT JOIN public.facilities f
                        ON f.id = bc.facility_id

                    LEFT JOIN LATERAL (
                        WITH bci AS (
                            SELECT
                                bci.id,
                                bci.claim_id,
                                icd.code
                            FROM
                                billing.claim_icds bci
                            JOIN public.icd_codes icd
                                 ON icd_id = icd.id
                            WHERE
                                claim_id = bc.id
                            ORDER BY
                                bci.id
                            LIMIT
                                3
                        )
                        SELECT
                            ARRAY_AGG(code) AS codes
                        FROM
                            bci
                        GROUP BY
                            bci.claim_id
                    ) icd ON TRUE
                    LEFT JOIN LATERAL (
                        SELECT
                            ( SELECT
                                code
                                FROM public.modifiers WHERE id = bch.modifier1_id AND NOT is_implicit ) AS mod1,
                            ( SELECT
                                code
                                FROM public.modifiers WHERE id = bch.modifier2_id AND NOT is_implicit ) AS mod2,
                            ( SELECT
                                code
                                FROM public.modifiers WHERE id = bch.modifier3_id AND NOT is_implicit ) AS mod3
                    ) fee_mod ON TRUE
                    LEFT JOIN resubmission_claims rsc ON rsc.claim_id = bc.id

                    -- LEFT JOIN LATERAL (
                    --     SELECT
                    --         ARRAY_AGG(mods.code) AS codes
                    --     FROM (
                    --         WITH all_mods AS (
                    --             SELECT
                    --                 1 AS sort_order,
                    --                 code
                    --             FROM
                    --                 public.modifiers
                    --             WHERE
                    --                 id = bch.modifier1_id
                    --             UNION
                    --             SELECT
                    --                 2 AS sort_order,
                    --                 code
                    --             FROM
                    --                 public.modifiers
                    --             WHERE
                    --                 id = bch.modifier2_id
                    --             UNION
                    --             SELECT
                    --                 3 AS sort_order,
                    --                 code
                    --             FROM
                    --                 public.modifiers
                    --             WHERE
                    --                 id = bch.modifier3_id
                    --         )
                    --         SELECT
                    --             code
                    --         FROM
                    --             all_mods
                    --         ORDER BY
                    --             sort_order
                    --     ) mods
                    -- ) fee_mod ON TRUE
                ),
                supporting_texts AS (
                    SELECT
                        ARRAY_AGG(a.claim_id)       AS claim_ids,
                        ARRAY_AGG(a.claim_number)   AS claim_numbers,
                        a.supporting_text
                    FROM (
                        SELECT
                            info.claim_id,
                            COALESCE(
                                billing.can_ahs_get_claim_number(info.claim_id),
                                (
                                    info.submitter_prefix ||
                                    info.year_source_code ||
                                    LPAD(info.sequence_number::TEXT, 7, '0') ||
                                    info.check_digit
                                )
                            ) AS claim_number,
                            TRIM(LOWER(info.can_supporting_text))       AS supporting_text
                        FROM
                            claim_info info
                        WHERE
                            TRIM(COALESCE(info.can_supporting_text, '')) != ''
                        ORDER BY
                            info.sequence_number
                    ) a
                    GROUP BY
                        a.supporting_text
                )
                SELECT
                    claim_info.*,
                    supporting_texts.supporting_text,
                    -- CASE
                    --     WHEN claim_info.claim_id = supporting_texts.claim_ids[1]
                    --     THEN supporting_texts.supporting_text
                    --     ELSE NULL
                    -- END AS supporting_text,
                    CASE
                        WHEN (
                            ARRAY_LENGTH(supporting_texts.claim_ids, 1) > 1
                            -- AND claim_info.claim_id = supporting_texts.claim_ids[1]
                        )
                        THEN ARRAY_REMOVE(
                            supporting_texts.claim_numbers,
                            supporting_texts.claim_numbers[1]
                        )
                        ELSE NULL
                    END AS cross_reference_claim_numbers
                FROM
                    claim_info
                LEFT JOIN supporting_texts
                    ON claim_info.claim_id = supporting_texts.claim_ids[1]
                    -- ON claim_info.claim_id = ANY(supporting_texts.claim_ids)
                ORDER BY
                    claim_info.sequence_number
        `;

        const result = await query(sql.text, sql.values);

        if (!result || result.rows && result.rows.length === 0) {
            return null;
        }

        return {
            edi_file_id,
            dir_path,
            file_name,
            rows: result.rows,
        };
    },

    /**
     * To store claims submitted in one edi file based on the batch number
     * @param  {object} args {
     *                      edi_file_id: Number,
     *                      claim_id: Number,
     *                      batch_number: Text,
     *                      action_code: Text
     *                  }
     */
    storeFileClaims: async (args) => {
        const {
            edi_file_id,
            action_code = null,
            batch_number = null,
            template_data = []
        } = args;

        const sql = SQL`
            WITH template_details AS (
                SELECT
                    claim_id::BIGINT
                    , batch_sequence_number::INT AS batch_sequence_number
                    , template_data::JSONB
                FROM JSONB_TO_RECORDSET(${JSON.stringify(template_data)}) AS td (
                    claim_id TEXT
                    , batch_sequence_number TEXT
                    , template_data TEXT
                )
            )
            INSERT INTO billing.edi_file_claims (
                edi_file_id,
                claim_id,
                batch_number,
                sequence_number,
                can_ahs_action_code,
                template_data
            )
            SELECT
                ${edi_file_id},
                c.id,
                ${batch_number},
                td.batch_sequence_number,
                CASE
                    WHEN ${action_code} = 'submit'
                    THEN 'can_ab_wcb_c568'
                    WHEN ${action_code} = 'change'
                    THEN 'can_ab_wcb_c570'
                END,
                td.template_data
            FROM billing.claims c
            INNER JOIN template_details td ON td.claim_id = c.id
            RETURNING
                id
        `;

        const { rows } = await query(sql.text, sql.values);
        return rows;
    },

    /**
     * {@param} company_id
     * {@response} Returns file store for configured company
     */
    getCompanyFileStore: (company_id) => {
        const fileSql = SQL`
        SELECT
            fs.id AS file_store_id,
            fs.root_directory,
            c.can_submitter_prefix AS submitter_prefix
        FROM file_stores fs
        INNER JOIN companies c ON c.file_store_id = fs.id
        WHERE c.id = ${company_id}
    `;

        return query(fileSql.text, fileSql.values);

    },

    storeFile: async info => {
        const {
            file_name,
            file_md5,
            file_size,
            file_type,
            created_dt,
            file_store_id,
            companyId,
            file_path,
        } = info;

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
                CASE
                    WHEN EXISTS (
                            SELECT 1
                            FROM billing.edi_files
                            WHERE file_md5 = ${file_md5}
                        )
                    THEN 'duplicate'
                    ELSE 'pending'
                END,
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


    /**
   * Handle incoming Batch Balance report file
   *
   * @param  {object} args    {
   *                              company_id: Number,
   *                              balance_claim_report: Object,   // Batch balance claims json object
   *                          }
   * @returns {object}        {
   *                              response: boolean
   *                          }
   */
    batchBalanceClaims: async (args) => {
        const {
            fileData,
        } = args;

        const {
            company_id
        } = args.log_details;
        const batchBalanceReportJson = JSON.stringify([fileData]) || JSON.stringify([{}]);

        const sql = SQL` SELECT billing.can_ahs_handle_claim_balance_report(${batchBalanceReportJson}::jsonb, ${company_id}) AS bbr_response`;

        return await query(sql);
    },

    /**
    * Handle incoming Batch Balance report file
    *
    * @param  {object} args    {
    *                              fileId: Number,
    *                              facilityId: Number,
    *                              fileData: Object,   // ARD paymenrs json object
    *                              userId: Number
    *                          }
    * @returns {object}        {
    *                              response: boolean
    *                          }
    */
    applyPayments: async args => {
        let {
            file_id,
            fileData,
            ip
        } = args;

        let {
            company_id,
            user_id,
            default_facility_id
        } = args.log_details;

        let auditDetails = {
            'company_id': company_id,
            'screen_name': 'payments',
            'module_name': 'payments',
            'client_ip': ip,
            'user_id': user_id
        };

        const sql = SQL` SELECT billing.can_ahs_apply_payments(${default_facility_id}, ${file_id}::BIGINT, ${JSON.stringify(fileData)}::JSONB, ${JSON.stringify(auditDetails)}::JSONB) AS applied_payments `;

        return await query(sql);
    },

    /**
     * Update supporting text on claim reassessment
     * @param  {object} args    {
     *                             claimId: Number,
     *                             supportingText: Text,
     *                          }
     * @returns updated records
     */
    updateSupportingText: async (args) => {
        let {
            claimId,
            supportingText
        } = args;

        claimId = claimId.split(',');
        const sql = SQL`
                        UPDATE
                            billing.claims
                        SET can_supporting_text = CASE
                                                    WHEN TRIM(${supportingText}) = ''
                                                    THEN can_supporting_text
                                                    ELSE COALESCE(TRIM(${supportingText})::TEXT, '') || ' ' || COALESCE(can_supporting_text, '')
                                                  END
                        WHERE id = ANY(${claimId}::BIGINT[])`;
        return await query(sql);
    },

    /**
     * Get pending transaction count for deleting the claim
     * @param {number} targetId
     * @returns count of transactions pending from AHS
     */
    getPendingTransactionCount: async (args) => {
        const {
            targetId
        } = args;

        const sql = SQL` SELECT
                             COUNT(efc.id) AS pending_transaction_count
                           , COUNT(pa.id) AS payment_entry_count
                           , bgct.charges_bill_fee_total::NUMERIC AS claim_total_amount
                           , bgct.claim_balance_total::NUMERIC AS claim_balance_amount
                           , bgct.payments_applied_total::NUMERIC as claim_applied
                           , bgct.adjustments_applied_total::NUMERIC as claim_adjustment
                         FROM billing.claims AS bc
                         INNER JOIN billing.charges AS bch ON bch.claim_id = bc.id
                         LEFT JOIN billing.edi_file_claims AS efc ON efc.claim_id = bc.id
                         LEFT JOIN billing.payment_applications AS pa ON pa.charge_id = bch.id
                         LEFT JOIN billing.get_claim_totals(${targetId}) AS bgct ON TRUE
                         WHERE bc.id = ${targetId}
                         GROUP BY bgct.claim_balance_total, bgct.charges_bill_fee_total, bgct.payments_applied_total, bgct.adjustments_applied_total `;

        return await query(sql);
    },

    /**
     * To validate the frequency of claim for submission
     * @param {array} claimIds
     * @returns incorrect_claims and unique_frequency_count
     */
    validateAhsClaim: async (claimIds) => {

        const sql = SQL`WITH
                            submitted_claim AS (
                                SELECT
                                      bc.id
                                    , COUNT(efc.claim_id) AS submitted_claim_count
                                FROM billing.claims bc
                                LEFT JOIN  billing.edi_file_claims efc ON bc.id = efc.claim_id
                                WHERE bc.id = ANY(${claimIds})
                                AND (bc.frequency = 'corrected')
                                GROUP BY bc.id
                                HAVING COUNT(efc.claim_id) = 0
                            ),
                            check_frequency AS (
                                SELECT
                                      COUNT(1) AS claim_frequency_count
                                    , COALESCE(NULLIF(bc.frequency, 'void'), 'original') AS frequency
                                FROM  billing.claims bc
                                WHERE id = ANY(${claimIds})
                                GROUP BY COALESCE(NULLIF(bc.frequency, 'void'), 'original')
                            )
                            SELECT
                                  (SELECT
                                       json_agg(row_to_json(incorrect_claims_agg))
                                   FROM (SELECT * FROM submitted_claim) AS incorrect_claims_agg
                                  ) AS incorrect_claims
                                , (SELECT
                                       json_agg(row_to_json(check_frequency_agg))
                                   FROM (SELECT * FROM check_frequency) AS check_frequency_agg
                                  ) AS unique_frequency_count`;

        return await query(sql);
    },
    /**
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
                            ef.file_store_id,
                            ef.file_type,
                            ef.file_path,
                            ef.file_size,
                            ef.status,
                            fs.root_directory,
                            ef.uploaded_file_name,
                            ef.id file_id,
                            comp.can_submitter_prefix,
                            (SELECT row_to_json(_) FROM (SELECT * FROM user_data) AS _) AS log_details
                        FROM billing.edi_files ef
                        INNER JOIN file_stores fs ON fs.id = ef.file_store_id
                        INNER JOIN companies comp ON comp.id = fs.company_id
                        WHERE ef.status = ${status}
                            AND ef.file_type = ANY(${fileTypes})
                        ORDER BY ef.file_type DESC, ef.id ASC LIMIT 10`;

        return await query(sql);
    },
    /**
     * Update File status
     * @param  {object} args    {
     *                             FileId: Number
     *                          }
     */
    updateFileStatus: async (args) => {
        let {
            fileId,
            status
        } = args;

        const sql = SQL` UPDATE billing.edi_files
                      SET status = ${status}
                      WHERE id = ${fileId}`;

        return await query(sql);
    },

    /**
     * Purging claim data
     * @param {String} args.type
     * @param {Number} args.userId
     * @param {String} args.clientIp
     * @param {Number} args.targetId
     * @param {Number} args.companyId
     * @param {String} args.entityName
     */
    purgeClaim: async (args) => {
        const { targetId, clientIp, entityName, userId, companyId, type } = args;
        const screenName = 'claims';

        let audit_json = {
            client_ip: clientIp,
            screen_name: screenName,
            entity_name: entityName,
            module_name: screenName,
            user_id: userId,
            company_id: companyId
        };

        args.audit_json = JSON.stringify(audit_json);

        const sql = SQL` SELECT billing.purge_claim_or_charge(${targetId}, ${type}, ${args.audit_json}::jsonb)`;

        try {
            return await query(sql);
        }
        catch (err) {
            return err;
        }
    },

    getWCBFilePathById: async ({file_id, company_id}) => {

        const sql = SQL`
        SELECT
            ef.id
            , ef.status
            , ef.file_type
            , ef.file_path
            , fs.root_directory
            , ef.uploaded_file_name
        FROM billing.edi_files ef
        INNER JOIN file_stores fs on fs.id = ef.file_store_id
        WHERE ef.id = ${file_id}
        AND ef.company_id = ${company_id}`;

        return await query(sql);
    },

    updateWCBFileStatus: async ({ file_id }) => {

        const sql = SQL`
        UPDATE billing.edi_files
            SET status =
                CASE
                    WHEN EXISTS (
                        SELECT 1
                        FROM billing.edi_file_payments
                        WHERE edi_file_id = ${file_id}
                    )
                    THEN 'success'
                    ELSE
                        'failure'
                END
        WHERE id = ${file_id}
        RETURNING id, status `;

        return await query(sql);
    },

    applyWCBPayments: async args => {
        let {
            clientIp,
            userId,
            payment,
            overPayment,
            company_id,
            facility_id,
            file_id,
            uploaded_file_name
        } = args;

        let auditDetails = {
            'company_id': company_id,
            'screen_name': 'payments',
            'module_name': 'payments',
            'client_ip': clientIp,
            'user_id': userId,
        };

        const sql = SQL`
        WITH file_claims AS (
            SELECT
                ROW_NUMBER() OVER() AS row_id
                , NULLIF(fc."DisbursementNumber", '')::TEXT AS disbursement_number
                , NULLIF(fc."DisbursementType", '') AS disbursement_type
                , NULLIF(fc."DisbursementAmount", '')::NUMERIC AS disbursement_amount
                , NULLIF(fc."PaymentReasonCode", '') AS payment_reason_code
                , NULLIF(fc."PaymentStatus", '') AS payment_status
                , NULLIF(fc."PaymentAmount", '')::NUMERIC AS payment_amount
                , NULLIF(fc."ClaimNumber", '')::BIGINT AS claim_no
                , NULLIF(fc."WorkerPHN", '')::BIGINT AS worker_phn
                , NULLIF(fc."EncounterNumber", '')::BIGINT AS encounter_no
                , NULLIF(fc."DisbursementIssueDate", '')::DATE AS disbursement_issue_date
                , NULLIF(fc."DisbursementXRefNumber",'')::BIGINT AS disbursement_xref_no
                , NULLIF(fc."DisbursementRecipientBillingNumber",'')::TEXT AS disbursement_billing_no
                , NULLIF(fc."ServiceCode", '') AS service_code
                , NULLIF(fc."OverpaymentRecoveryAmount", '')::NUMERIC AS ovp_recovery_amount
            FROM jsonb_to_recordset(${JSON.stringify(payment)}) AS fc
            (
                "DisbursementNumber" TEXT
                , "DisbursementType" TEXT
                , "DisbursementAmount" TEXT
                , "PaymentReasonCode" TEXT
                , "PaymentStatus" TEXT
                , "PaymentAmount" TEXT
                , "ClaimNumber" TEXT
                , "WorkerPHN" TEXT
                , "EncounterNumber" TEXT
                , "DisbursementIssueDate" TEXT
                , "ServiceCode" TEXT
                , "OverpaymentRecoveryAmount" TEXT
                , "DisbursementXRefNumber" TEXT
                , "DisbursementRecipientBillingNumber" TEXT
            )
        )
        , payment_claims AS (
            SELECT
                row_id
                , payment_status
                , payment_amount
                , payment_reason_code
                , disbursement_type
                , claim_no
                , disbursement_issue_date AS payment_date
                , 'PAY' AS payment_type
                , string_to_array(regexp_replace(service_code, '[^a-zA-Z0-9., ]','','g'),',') AS service_code
                , ('WCB File Name: ' || COALESCE(${uploaded_file_name}::TEXT, ' ') || E'\n' ||
                    ' Disbursement Number: ' || COALESCE(disbursement_number,' ') || E'\n' ||
                    ' Disbursement Type: ' || COALESCE(disbursement_type,' ') || E'\n' ||
                    ' Disbursement XRef Number: ' || COALESCE(disbursement_xref_no::TEXT,' ') || E'\n' ||
                    ' Disbursement Billing Number: ' || COALESCE(disbursement_billing_no,' ') || E'\n' ||
                    ' Disbursement Issue Date: '|| COALESCE (disbursement_issue_date::TEXT,' ') || E'\n' ||
                    ' Disbursement Amount: '|| COALESCE (disbursement_amount::TEXT,' ')
                ) AS payment_notes
                , disbursement_number AS card_number
            FROM file_claims

        )
        , grouped_records AS (
            SELECT
                disbursement_number
                , fc.disbursement_type
                , fc.disbursement_amount
                , fc.disbursement_issue_date
                , fc.disbursement_xref_no
                , fc.disbursement_billing_no
                , jsonb_agg(row_to_json(pc.*)) AS payment
            FROM file_claims fc
            INNER JOIN (
                SELECT
                    *
                    , BTRIM(service_codes) AS cpt_code
                FROM payment_claims pc
                LEFT JOIN UNNEST(pc.service_code) AS service_codes ON TRUE
            ) pc ON pc.row_id = fc.row_id
            GROUP BY
                disbursement_number
                , fc.disbursement_amount
                , fc.disbursement_type
                , fc.disbursement_issue_date
                , fc.disbursement_xref_no
                , fc.disbursement_billing_no
        )
        , overpayment_claims AS (
            SELECT
                NULLIF(opc."OVPClaimNumber", '')::TEXT AS claim_no
                , NULLIF(opc."DateOfOverpayment",'')::DATE AS payment_date
                , NULLIF(opc."RecoveryAmount",'')::NUMERIC AS payment_amount
                , NULLIF(opc."OVPReason",'')::TEXT AS payment_reason_code
                , NULL AS payment_status
                , 'EFT' AS disbursement_type
                , 'OVP' AS payment_type
            FROM jsonb_to_recordset(${JSON.stringify(overPayment)}) AS opc
                (
                    "OVPClaimNumber" TEXT
                    , "RecoveryAmount" TEXT
                    , "OVPReason" TEXT
                    , "DateOfOverpayment" TEXT
                )
        )
        , recovery_claims AS (
            SELECT
                NULLIF(opc."RecoveredFromClaimNumber", '')::TEXT AS recovered_claim_no
                , NULLIF(opc."DateOfOverpayment",'')::DATE AS ovp_date
                , NULLIF(opc."RecoveryAmount",'')::NUMERIC AS recovery_amount
                , NULLIF(opc."OVPReason",'')::TEXT AS ovp_reason
                , NULL AS payment_status
                , 'EFT' AS disbursement_type
                , 'REC' AS payment_type
                FROM jsonb_to_recordset(${JSON.stringify(overPayment)}) AS opc
                (
                    "RecoveredFromClaimNumber" TEXT
                    , "RecoveryAmount" TEXT
                    , "OVPReason" TEXT
                    , "DateOfOverpayment" TEXT
                )
        )
        , overpayment_recovery_claims AS (
            SELECT
                NULLIF(fc."ClaimNumber", '')::TEXT AS claim_no
                , NULLIF(fc."DisbursementIssueDate", '')::DATE AS disbursement_date
                , NULLIF(fc."OverpaymentRecoveryAmount", '')::NUMERIC AS ovp_recovery_amount
                , NULL AS ovp_reason
                , NULL AS payment_status
                , 'EFT' AS disbursement_type
                , 'OVPR' AS payment_type
            FROM jsonb_to_recordset(${JSON.stringify(payment)}) AS fc
            (
                "PaymentReasonCode" TEXT
                , "ClaimNumber" TEXT
                , "OverpaymentRecoveryAmount" TEXT
                , "DisbursementIssueDate" TEXT
            )
        )
        , total_overpayment_details AS (
            SELECT
                jsonb_build_array(row_to_json(overpayment_details.*)) AS payment
            FROM (
                SELECT * FROM overpayment_claims WHERE claim_no IS NOT NULL
                UNION
                SELECT * FROM overpayment_recovery_claims WHERE ovp_recovery_amount IS NOT NULL
                UNION
                SELECT * FROM recovery_claims WHERE recovered_claim_no IS NOT NULL
            ) overpayment_details
        )
        , total_payment_records AS (
            SELECT payment FROM grouped_records
            UNION
            SELECT payment FROM total_overpayment_details
        )

        SELECT
            billing.can_ahs_wcb_apply_payments(
                ${facility_id}::INTEGER
                , ${file_id}::BIGINT
                , p.payment
                , ${JSON.stringify(auditDetails)}::JSONB
            ) AS applied_payments
        FROM total_payment_records p;
        `;

        return await query(sql);
    },

    saveAHSClaims: async (args) => {
        const {
            claimIds
            , auditDetails
        } = args;

        const sql = SQL`
            WITH charge_details AS (
                SELECT
                    RANK() OVER (
                        PARTITION BY charges.claim_id
                        ORDER BY charges.id DESC
                    ) AS charge_index
                    , charges.*
                    , bcs.study_id
                FROM billing.charges
                LEFT JOIN billing.charges_studies bcs ON bcs.charge_id = charges.id
                WHERE
                    charges.claim_id = ANY(${claimIds}:: BIGINT[])
            )
            , claim_details AS (
                SELECT
                    bc.*
                    , claim_charges::JSONB
                FROM billing.claims bc
                INNER JOIN (
                    SELECT
                        JSONB_AGG(ROW_TO_JSON(cd)) AS claim_charges
                        , claim_id
                    FROM charge_details cd
                    WHERE
                        charge_index > 1
                    GROUP BY claim_id
                ) cc ON cc.claim_id = bc.id
            )
            , insurance_details AS (
                SELECT
                    JSONB_AGG(ROW_TO_JSON(ins_det)) AS insurance_details
                    , claim_id
                FROM (
                    SELECT
                        pi.*
                        , null AS claim_patient_insurance_id
                        , false AS is_update_patient_info
                        , bcpi.claim_id
                FROM patient_insurances pi
                INNER JOIN billing.claim_patient_insurances bcpi ON bcpi.patient_insurance_id = pi.id
                ) AS ins_det
                GROUP BY
                    claim_id
            )
            , claim_icds AS (
                SELECT
                    JSONB_AGG(ROW_TO_JSON(icds)) AS icd_details
                    , claim_id
                FROM (
                    SELECT
                        icd_id
                        , claim_id
                        , false AS is_deleted
                    FROM billing.claim_icds icds
                ) AS icds
                GROUP BY claim_id
            )
            , save_claim AS (
                SELECT
                    billing.can_ahs_create_claim_per_charge(
                        claim_det::JSONB
                        , insurance_details
                        , icd_details
                        , ${auditDetails}::JSONB
                        , true
                    ) as inserted_claims
                FROM (
                    SELECT
                        ROW_TO_JSON(claim_details) AS claim_det
                        , claim_details.id
                    FROM claim_details
                ) cd
                LEFT JOIN insurance_details idd ON idd.claim_id = cd.id
                LEFT JOIN claim_icds ci ON ci.claim_id = cd.id
                WHERE
                    cd.id = ANY(${claimIds}:: BIGINT[])
            )

            SELECT
                ARRAY_AGG(inserted_claim_ids) AS ahs_claim_ids
            FROM
                save_claim
                , UNNEST(inserted_claims) inserted_claim_ids `;

        const { rows = [] } = await query(sql);
        return rows?.length && rows[0]?.ahs_claim_ids || [];
    },

    deleteCharges: async (args) => {
        const {
            claimIds
            , auditDetails
        } = args;

        const sql = SQL`
            WITH delete_charges AS (
                SELECT
                    RANK () OVER (
                        PARTITION BY charges.claim_id
                        ORDER BY charges.id DESC
                    ) AS charge_index
                    , id
                FROM billing.charges
                WHERE charges.claim_id = ANY(${claimIds}:: BIGINT[])
            )
            SELECT
                billing.purge_claim_or_charge (
                    id
                    , 'charge'
                    , ${auditDetails}::JSONB
                )
            FROM delete_charges
            WHERE charge_index > 1 `

        return await query(sql);
    },

    getCorrectionTemplateData: async (args) => {
        const sql = SQL`
            SELECT
                claim_id
                , template_data
            FROM (
                SELECT
                    DENSE_RANK()OVER( PARTITION BY claim_id ORDER BY id DESC) AS row
                    , claim_id
                    , template_data
                FROM billing.edi_file_claims
                WHERE
                    claim_id = ANY(${args})
            ) AS td
            WHERE
                row = 1 `
        const { rows = [] } = await query(sql);

        return rows?.length && rows;
    }
};

module.exports = ahsData;
