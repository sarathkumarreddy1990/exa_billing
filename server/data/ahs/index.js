'use strict';

const { query, SQL, audit } = require('../index');
const moment = require('moment');
const sprintf = require('sprintf');

const {
    promisify,
} = require('util');

const fs = require('fs');
const writeFileAsync = promisify(fs.writeFile);
const statAsync = promisify(fs.stat);

const path = require('path');
const crypto = require('crypto');
const _ = require('lodash');
const mkdirp = require('mkdirp');
const mkdirpAsync = promisify(mkdirp);
const logger = require('../../../logger');
const config = require('../../config');
const shared = require('../../shared');

const claimEncoder = require('../../../modules/ahs/encoder/claims');

const toBillingNotes = (obj) => {
    return obj.errorCodes.map((errorCode) => {
        return `${errorCode} - ${errorDescriptionsByCode[errorCode]}`;
    });
};

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
                                    VALUES (
                                          ${claimNote}
                                        , 'auto'
                                        , UNNEST(${claimIds}::int[])
                                        , ${userId}
                                        , now()
                                    ) RETURNING *
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

    getClaimsData: async (args) => {

        const {
            claimIds,
        } = args;
        const sql = SQL`
            SELECT
                bc.id AS claim_id,
                bc.billing_method,
                bc.can_ahs_pay_to_code                       AS pay_to_code,
                pc.can_submitter_prefix                  AS submitter_prefix,
                bc.can_ahs_business_arrangement              AS business_arrangement,
                bc.can_ahs_supporting_text                   AS supporting_text_1,
                f.can_facility_number                        AS facility_number,
                icd.codes[1]                                 AS diagnosis_code_1,
                pip.insurance_name                           AS "payerName",
                get_full_name(pp.last_name,pp.first_name)    AS "patientName",
                claim_notes                                  AS "claimNotes",
                pp.first_name                                AS "patient_first_name",
                pc_app.can_prid                          AS "service_provider_prid",
                COALESCE(pp.patient_info -> 'c1State', pp.patient_info -> 'c1Province', '') AS province_code,
                (SELECT
                    charges_bill_fee_total
                FROM
                    billing.get_claim_totals(bc.id)) AS "claim_totalCharge",
                bcs.code AS claim_status_code
                FROM billing.claims bc
                INNER JOIN billing.claim_status bcs ON bcs.id = bc.claim_status_id
                LEFT JOIN public.companies pc ON pc.id = bc.company_id
                LEFT JOIN public.patients pp ON pp.id = bc.patient_id
                LEFT JOIN billing.charges bch ON bch.claim_id = bc.id
                LEFT JOIN public.cpt_codes pcc ON pcc.id = bch.cpt_id
                LEFT JOIN billing.charges_studies bchs ON bchs.charge_id = bch.id
                LEFT JOIN public.studies s ON s.id = bchs.study_id
                LEFT JOIN public.study_transcriptions st ON st.study_id = s.id
                LEFT JOIN public.provider_contacts pc_app ON pc_app.id = st.approving_provider_id
                LEFT JOIN public.facilities f ON f.id = bc.facility_id
                LEFT JOIN public.patient_insurances ppi  ON ppi.id = bc.primary_patient_insurance_id
                LEFT JOIN public.insurance_providers pip ON pip.id = ppi.insurance_provider_id
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
                WHERE bc.id = ANY (${claimIds})
                ORDER BY bc.id DESC
            `;

        return (await query(sql.text, sql.values)).rows;
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
        const file_name = `${submitter_prefix}_${shared.getUID()}`;
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
	                FROM billing.edi_file_claims
	                WHERE claim_id = ANY(${claimIds}) AND can_ahs_action_code = 'a'
	                GROUP BY can_ahs_action_code, claim_id
	                ORDER BY sequence_number DESC
                ),
                numbers AS (
                    SELECT
                        ( COALESCE(MAX(batch_number :: INT), 0) + 1 ) % 1000000     AS batch_number,
                        COALESCE(MAX(sequence_number), '0') :: INT                  AS sequence_number
                    FROM
                        billing.edi_file_claims
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
                        edi_file_id
                    )
                    SELECT
                        c.id,
                        n.batch_number::TEXT,
                        CASE
                            WHEN ${source} = 'reassessment' OR ${source} = 'change'
                                THEN rsc.sequence_number
                            ELSE ( n.sequence_number + row_number() OVER () ) % 10000000
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
                        ${edi_file_id}
                    FROM billing.claims c
                    INNER JOIN numbers n ON TRUE
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
                        (SELECT province_alpha_2_code FROM patient_id_nums WHERE patient_id = pin.patient_id AND issuer_type = 'registration_number_parent' LIMIT 1)            AS service_recipient_parent_registration_number_province
                    FROM
                        patient_id_nums pin
                ),
                claim_info AS (
                    SELECT
                        bc.id                                        AS claim_id,
                        inserted_efc.can_ahs_action_code             AS action_code,
                        comp.can_submitter_prefix                AS submitter_prefix,
                        inserted_efc.batch_number                    AS batch_number,
                        TO_CHAR(bc.claim_dt, 'YY')                   AS year,
                        TO_CHAR(bc.claim_dt, 'MM')                   AS source_code,
                        inserted_efc.sequence_number                 AS sequence_number,
                        luhn_generate_checkdigit(
                            inserted_efc.sequence_number :: INT8
                        )                                            AS check_digit,

                        -- currently hard-coded - AHS does not support another code right now
                        'CIP1'                                       AS transaction_type,

                        CASE
                            WHEN inserted_efc.can_ahs_action_code IN ('a', 'c')
                            THEN 'RGLR'
                            ELSE ''
                        END                                          AS claim_type,

                        pc_app.can_prid                             AS service_provider_prid,
                        sc.code                                         AS skill_code,

                        nums.service_recipient_phn,
                        nums.service_recipient_phn_province,
                        nums.service_recipient_parent_phn,
                        nums.service_recipient_parent_phn_province,
                        nums.service_recipient_registration_number,
                        nums.service_recipient_registration_number_province,
                        nums.service_recipient_parent_registration_number,
                        nums.service_recipient_parent_registration_number_province,
                        CASE
                            WHEN (
                                nums.service_recipient_phn IS NOT NULL
                                OR (
                                    nums.service_recipient_registration_number IS NOT NULL
                                    AND nums.service_recipient_registration_number_province IS NOT NULL
                                )
                            )
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
                                THEN TO_CHAR(timezone(f.time_zone, s.study_dt)::date, 'YYYYMMDD')
                                ELSE TO_CHAR(s.hospital_admission_dt, 'YYYYMMDD')
                        END                                          AS service_start_date,
                        (row_number() OVER (ENCOUNTER_WINDOW))::INT  AS encounter_number,
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
                            WHEN f.can_facility_number :: INT > 0
                            THEN ''
                            ELSE COALESCE(o.order_info -> 'patientLocation', 'OTHR')
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
                            )) NOT IN ( 'ab', 'alberta' )
                            THEN 'Y'
                            ELSE ''
                        END                                          AS oop_referral_indicator,

                        CASE
                            WHEN pc_ref.can_prid IS NULL AND p_ref.id IS NOT NULL
                            THEN JSONB_BUILD_OBJECT(
                                'person_type', 'RFRC',
                                'first_name', p_ref.first_name,
                                'middle_name', p_ref.middle_initial,
                                'last_name', p_ref.last_name,
                                'birth_date', '',
                                'gender_code', '',
                                'address1', COALESCE(
                                    ( SELECT group_name FROM provider_groups WHERE id = pc_ref.provider_group_id ),
                                    TRIM(
                                        regexp_replace(COALESCE(pc_ref.contact_info -> 'ADDR1', ''), '[#-]', '', 'g') || ' ' ||
                                        regexp_replace(COALESCE(pc_ref.contact_info -> 'ADDR2', ''), '[#-]', '', 'g')
                                    ),
                                    ''
                                ),
                                'address2', (
                                    CASE
                                        WHEN pc_ref.provider_group_id IS NULL
                                        THEN ''
                                        ELSE TRIM(regexp_replace(COALESCE(pc_ref.contact_info -> 'ADDR1', ''), '[#-]', '', 'g') || ' ' ||
                                                 regexp_replace(COALESCE(pc_ref.contact_info -> 'ADDR2', ''), '[#-]', '', 'g'))
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
                            WHEN (
                                ( nums.service_recipient_phn IS NULL OR LOWER(nums.service_recipient_phn_province) != 'ab' ) 
                                AND nums.service_recipient_registration_number_province NOT IN ( 'ab', 'qc' )
                            )
                            THEN nums.service_recipient_registration_number_province
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
                            WHEN bc.can_ahs_emsaf_reason IS NOT NULL
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
                        bc.can_ahs_supporting_text,
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
                    LEFT JOIN public.study_transcriptions st
                        ON st.study_id = s.id
                    LEFT JOIN public.companies comp
                        ON comp.id = s.company_id
                    LEFT JOIN public.provider_contacts pc_app
                        ON pc_app.id = st.approving_provider_id
                    LEFT JOIN public.providers p_app
                        ON p_app.id = pc_app.provider_id
                    LEFT JOIN public.provider_contacts pc_ref
                        ON pc_ref.id = s.referring_physician_id
                    LEFT JOIN public.providers p_ref
                        ON p_ref.id = pc_ref.provider_id
                    LEFT JOIN public.skill_codes sc
                        ON sc.id = s.can_ahs_skill_code_id
                    LEFT JOIN public.functional_centres fc
                        ON fc.id = s.can_ahs_functional_centre_id
                    LEFT JOIN public.originating_facilities orig_fac
                        ON orig_fac.id = s.can_ahs_originating_facility_id
                    LEFT JOIN public.patients p
                        ON p.id = bc.patient_id
                    LEFT JOIN nums
                        ON nums.patient_id = p.id
                    LEFT JOIN public.cpt_codes cpt
                        ON cpt.id = bch.cpt_id
                    LEFT JOIN public.facilities f
                        ON f.id = s.facility_id

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
                            ( SELECT code FROM public.modifiers WHERE id = bch.modifier1_id ) AS mod1,
                            ( SELECT code FROM public.modifiers WHERE id = bch.modifier2_id ) AS mod2,
                            ( SELECT code FROM public.modifiers WHERE id = bch.modifier3_id ) AS mod3
                    ) fee_mod ON TRUE

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

                    WINDOW ENCOUNTER_WINDOW AS (
                        PARTITION BY
                            pc_app.can_prid,
                            p.id,
                            s.study_dt :: DATE
                        ORDER BY
                            s.study_dt,
                            s.id
                    )
                ),
                supporting_texts AS (
                    SELECT
                        ARRAY_AGG(a.claim_id)       AS claim_ids,
                        ARRAY_AGG(a.claim_number)   AS claim_numbers,
                        a.supporting_text
                    FROM (
                        SELECT
                            info.claim_id,
                            billing.can_ahs_get_claim_number(info.claim_id) AS claim_number,
                            TRIM(LOWER(info.can_ahs_supporting_text))       AS supporting_text
                        FROM
                            claim_info info
                        WHERE
                            TRIM(COALESCE(info.can_ahs_supporting_text, '')) != ''
                            AND billing.can_ahs_get_claim_number(info.claim_id) IS NOT NULL
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

        const sql = SQL` SELECT billing.can_ahs_handle_claim_balance_report(${batchBalanceReportJson}::jsonb, ${company_id})`;

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
        } = args.log_details

        let auditDetails = {
            'company_id': company_id,
            'screen_name': 'payments',
            'module_name': 'payments',
            'client_ip': ip,
            'user_id': user_id
        };

        const sql = SQL` SELECT billing.can_ahs_apply_payments(${default_facility_id}, ${file_id}::BIGINT, ${JSON.stringify(fileData)}::JSONB, ${JSON.stringify(auditDetails)}::JSONB) `;

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
        const {
            claimId,
            supportingText
        } = args;
        const sql = SQL`
                     UPDATE
                         billing.claims
                     SET
                         can_ahs_supporting_text = ${supportingText}
                     WHERE id = ${claimId}`;
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
                             COUNT(1) AS pending_transaction_count
                         FROM billing.edi_file_claims efc
                         WHERE efc.claim_id = ${targetId}
                         AND NOT did_not_process `;

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
    getFilesList: async(args) => {
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
                            file_store_id,
                            file_type,
                            file_path,
                            file_size,
                            status,
                            fs.root_directory,
                            uploaded_file_name,
                            ef.id file_id,
                            (SELECT row_to_json(_) FROM (SELECT * FROM user_data) AS _) AS log_details
                         FROM billing.edi_files ef
                         INNER JOIN file_stores fs ON fs.id = ef.file_store_id
                         WHERE ef.status = ${status}
                               AND ef.file_type = ANY(${fileTypes}) LIMIT 10`;

        return await query(sql);
    },
    /**
     * Update File status
     * @param  {object} args    {
     *                             FileId: Number
     *                          }
     */
    updateFileStatus: async(args) => {
        let {
            fileId,
            status
        } = args;

        const sql = SQL` UPDATE billing.edi_files
                      SET status = ${status}
                      WHERE id = ${fileId}`;

        return await query(sql);
    }

};

module.exports = ahsData;
