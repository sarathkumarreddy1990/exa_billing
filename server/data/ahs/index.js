const { query, SQL, audit } = require('../index');
const moment = require('moment');
const sprintf = require('sprintf');

const {
    promisify,
} = require('util');

const fs = require('fs');
const readDirAsync = promisify(fs.readdir);
const writeFileAsync = promisify(fs.writeFile);

const path = require('path');
const crypto = require('crypto');
const _ = require('lodash');
const mkdirp = require('mkdirp');
const logger = require('../../../logger');
const config = require('../../config');

const toBillingNotes = (obj) => {
    return obj.errorCodes.map((errorCode) => {
        return `${errorCode} - ${errorDescriptionsByCode[errorCode]}`;
    });
};


module.exports = {

    saveAddedClaims: async (args) => {

        const {
            claimIds,
        } = args;

        const sql = SQL`
            WITH
                numbers AS (
                    SELECT
                        ( COALESCE(MAX(batch_number), '0') :: INT + 1 ) % 1000000 AS batch_number,
                        COALESCE(MAX(sequence_number), '0') :: INT                AS sequence_number
                    FROM
                        billing.edi_file_claims
                ),
                inserted_efc AS (
                    INSERT INTO billing.edi_file_claims (
                        claim_id,
                        batch_number,
                        sequence_number,
                        can_ahs_action_code
                    )
                    SELECT
                        claims,
                        numbers.batch_number :: TEXT,
                        ( numbers.sequence_number + row_number() OVER () ) % 10000000,
                        'A'
                    FROM
                        UNNEST(${claimIds} :: BIGINT[]) claims,
                        numbers
                    WHERE
                        -- Check if claim submission already started and file just hasn't
                        -- been created or responded to yet
                        NOT EXISTS (
                            SELECT
                                1
                            FROM
                                billing.edi_file_claims efc
                            LEFT JOIN billing.edi_related_files erf
                                ON erf.submission_file_id = efc.edi_file_id
                            WHERE
                                efc.claim_id = claims
                                AND (
                                    efc.edi_file_id IS NULL
                                    OR erf.response_file_id IS NULL
                                )
                            LIMIT
                                1
                        )
                    RETURNING
                        *
                ),
                status AS (
                    SELECT
                        id
                    FROM
                        billing.claim_status
                    WHERE
                        code = 'PA'
                    LIMIT
                        1
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
                )
            
            SELECT
                inserted_efc.can_ahs_action_code             AS action_code,
                comp.can_ahs_submitter_prefix                AS submitter_prefix,
                inserted_efc.batch_number                    AS batch_number,
                TO_CHAR(bc.claim_dt, 'YY')                   AS year,
                TO_CHAR(bc.claim_dt, 'MM')                   AS source_code,
                inserted_efc.sequence_number                 AS sequence_number,
                billing.can_ahs_calculate_check_digit_claim_number(
                    comp.can_ahs_submitter_prefix,
                    TO_CHAR(bc.claim_dt, 'MM'),
                    TO_CHAR(bc.claim_dt, 'YY'),
                    LPAD(inserted_efc.sequence_number :: TEXT, 7, '0')
                )                                            AS check_digit,
            
                -- currently hard-coded - AHS does not support another code right now
                'CIP1'                                       AS transaction_type,
            
                pc_app.can_ahs_prid                          AS service_provider_prid,
                sc.code                                      AS skill_code,
                p.can_ahs_uli                                AS service_recipient_uli,
                p.can_ahs_registration_number                AS service_recipient_registration_number,
                p.can_ahs_registration_number_province       AS service_recipient_registration_number_province,
                cpt.ref_code                                 AS health_service_code,
                CASE
                    WHEN s.hospital_admission_dt IS NULL
                        THEN TO_CHAR(s.study_dt, 'YYYYMMDD')
                        ELSE TO_CHAR(s.hospital_admission_dt, 'YYYYMMDD')
                END                                          AS service_start_date,
                row_number() OVER (ENCOUNTER_WINDOW)         AS encounter_number,
            
                -- @TODO - put ICD JOIN into lateral and get them in order
                icd.codes                                    AS diagnosis_codes,
            
            
                -- @TODO - this may need + 1 for the days extract to make same-day considered as "1 consecutive day"
                -- Documentation is unclear so leaving as-is until testing
                CASE
                    WHEN s.hospital_admission_dt IS NULL
                        THEN scpt.units
                        ELSE EXTRACT(DAYS FROM s.study_dt - s.hospital_admission_dt)
                END                                          AS calls,
                fee_mod.codes                                AS fee_modifiers,
            
                f.can_ahs_facility_number                    AS facility_number,
                fc.code                                      AS functional_centre,
                CASE
                    WHEN f.can_ahs_facility_number :: INT > 0
                        THEN NULL
                        ELSE o.order_info -> 'patientLocation'
                END                                          AS location_code,
            
                orig_fac.facility_number                     AS originating_facility,
                CASE
                    WHEN s.can_ahs_originating_facility_id IS NOT NULL
                        THEN NULL
                        ELSE s.can_ahs_originating_location
                END                                          AS originating_location,
            
                bc.can_ahs_business_arrangement              AS business_arrangement,
                bc.can_ahs_pay_to_code                       AS pay_to_code,
                bc.can_ahs_pay_to_uli                        AS pay_to_uli,
            
                -- Use this to create person data segment CPD1
                bc.can_ahs_pay_to_details                    AS pay_to_details,
                bc.can_ahs_locum_arrangement                 AS locum_arrangement,
                pc_ref.can_ahs_prid                          AS referral_id,
            
                CASE
                    WHEN LOWER(pc_ref.contact_info -> 'STATE') NOT IN ( 'ab', 'alberta' )
                        THEN TRUE
                        ELSE NULL
                END                                          AS oop_referral_indicator,
                CASE
                    WHEN p.can_ahs_uli IS NULL AND p.can_ahs_registration_number_province NOT IN ( 'ab', 'qc' )
                        THEN p.can_ahs_registration_number_province
                        ELSE ''
                END                                          AS recovery_code,
                bc.id                                        AS chart_number,
                totals.charges_bill_fee_total                AS claimed_amount,
                bc.can_ahs_claimed_amount_indicator          AS claimed_amount_indicator,
                bc.can_ahs_confidential                      AS confidential_indicator,
                bc.can_ahs_good_faith                        AS good_faith_indicator,
                bc.can_ahs_newborn_code                      AS newborn_code,
                bc.can_ahs_emsaf_reason                      AS emsaf_reason,
                bc.can_ahs_paper_supporting_docs             AS paper_supporting_documentation_indicator,
                TO_CHAR(s.hospital_admission_dt, 'YYYYMMDD') AS hospital_admission_date,
                s.can_ahs_tooth_code                         AS tooth_code,
                s.can_ahs_tooth_surface1                     AS tooth_surface1,
                s.can_ahs_tooth_surface2                     AS tooth_surface2,
                s.can_ahs_tooth_surface3                     AS tooth_surface3,
                s.can_ahs_tooth_surface4                     AS tooth_surface4,
                s.can_ahs_tooth_surface5                     AS tooth_surface5
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
                ON p.id = s.patient_id
            LEFT JOIN public.cpt_codes cpt
                ON cpt.id = bch.cpt_id
            LEFT JOIN public.study_cpt scpt
                ON scpt.study_id = s.id
            LEFT JOIN public.facilities f
                ON f.id = s.facility_id
            
            LEFT JOIN LATERAL (
                SELECT
                    ARRAY_AGG(code) AS codes
                FROM
                    public.icd_codes
                WHERE
                    id IN (
                        SELECT
                            icd_id
                        FROM
                            billing.claim_icds
                        WHERE
                            claim_id = bc.id
                        ORDER BY
                            id
                        LIMIT
                            3
                    )
            ) icd ON TRUE
            
            -- (SELECT code FROM public.modifiers WHERE id = bch.modifier1_id AND modifier1) AS modifier_1,
            -- (SELECT code FROM public.modifiers WHERE id = bch.modifier2_id AND modifier2) AS modifier_2,
            -- (SELECT code FROM public.modifiers WHERE id = bch.modifier3_id AND modifier3) AS modifier_3
            
            LEFT JOIN LATERAL (
                SELECT
                    ARRAY_AGG(mods.code) AS codes
                FROM (
                    WITH all_mods AS (
                        SELECT
                            1 AS sort_order,
                            code
                        FROM
                            public.modifiers
                        WHERE
                            id = bch.modifier1_id
                        UNION
                        SELECT
                            2 AS sort_order,
                            code
                        FROM
                            public.modifiers
                        WHERE
                            id = bch.modifier2_id
                        UNION
                        SELECT
                            3 AS sort_order,
                            code
                        FROM
                            public.modifiers
                        WHERE
                            id = bch.modifier3_id
                    )
                    SELECT
                        code
                    FROM
                        all_mods
                    ORDER BY
                        sort_order
                ) mods
            ) fee_mod ON TRUE
            
            WINDOW ENCOUNTER_WINDOW AS (
                PARTITION BY
                    pc_app.can_ahs_prid,
                    p.id,
                    s.study_dt :: DATE
                ORDER BY
                    s.study_dt,
                    s.id
            )
            
            ORDER BY
                sequence_number
        `;

        return (await query(sql.text, sql.values)).rows;
    },

};
