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

    getClaimsData: async (args) => {

        const {
            claimIds,
        } = args;

        const sql = SQL`
            WITH numbers AS (
                SELECT
                    MAX(COALESCE(batch_number, '0') :: INT) + 1 AS batch_number,
                    MAX(COALESCE(sequence_number, '0') :: INT)  AS sequence_number
                FROM
                    billing.edi_file_claims
            )
            SELECT
                ( SELECT batch_number FROM numbers )                                               AS batch_number,
                comp.can_ahs_submitter_prefix                                                      AS submitter_prefix,
                TO_CHAR(bc.claim_dt, 'YY')                                                         AS current_year,
                TO_CHAR(bc.claim_dt, 'MM')                                                         AS source_code,
                ( SELECT sequence_number FROM numbers ) + row_number() OVER (ORDER BY bc.claim_dt) AS sequence_number,
                ''                                                                                 AS check_digit,
                'CIP1'                                                                             AS transaction_type, -- currently hard-coded - AHS does not support another code right now
                pc_app.can_ahs_prid                                                                AS service_provider_prid,
                sc.code                                                                            AS skill_code,
                p.can_ahs_uli                                                                      AS service_recipient_uli,
                p.can_ahs_registration_number                                                      AS service_recipient_registration_number,
                p.can_ahs_registration_number_province                                             AS service_recipient_registration_number_province,
                cpt.ref_code                                                                       AS health_service_code,
                TO_CHAR(s.study_dt, 'YYYYMMDD')                                                    AS service_start_date,
            
                -- @TODO - calculate encounter number here
                -- '' AS encounter_number,
            
                -- @TODO - put ICD JOIN into lateral and get them in order
                -- ARRAY_AGG(icd.code) AS diagnosis_codes
            
                scpt.units                                                                         AS calls,
            
                -- Modifiers
                -- @TODO
            
                f.can_ahs_facility_number                                                          AS facility_number,
                fc.code                                                                            AS functional_centre,
                CASE
                    WHEN f.can_ahs_facility_number :: INT > 0
                    THEN o.order_info -> 'patientLocation'
                    ELSE ''
                END                                                                                AS location_code,
            
                -- Need Originating Facility stuff here
                -- @TODO
            
                bc.can_ahs_business_arrangement                                                    AS business_arrangement,
                bc.can_ahs_pay_to_code                                                             AS pay_to_code,
                bc.can_ahs_pay_to_uli                                                              AS pay_to_uli,
            
                -- Use this to create person data segment CPD1
                bc.can_ahs_pay_to_details                                                          AS pay_to_details,
            
                bc.can_ahs_locum_arrangement                                                       AS locum_arrangement,
                pc_ref.can_ahs_prid                                                                AS referral_id,
                CASE
                    WHEN LOWER(pc_ref.contact_info -> 'STATE') NOT IN ( 'ab', 'alberta' )
                    THEN 'Y'
                    ELSE ''
                END                                                                                AS oop_referral_indicator,
                CASE
                    WHEN p.can_ahs_uli IS NULL AND p.can_ahs_registration_number_province NOT IN ( 'ab', 'qc' )
                    THEN p.can_ahs_registration_number_province
                    ELSE ''
                END                                                                                AS recovery_code,
                bc.id                                                                              AS chart_number
            FROM
                billing.claims bc
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
            LEFT JOIN public.patients p
                ON p.id = s.patient_id
            LEFT JOIN public.cpt_codes cpt
                ON cpt.id = bch.cpt_id
            LEFT JOIN billing.claim_icds bcicd
                ON bcicd.claim_id = bc.id
            LEFT JOIN public.icd_codes icd
                ON icd.id = bcicd.icd_id
            LEFT JOIN public.study_cpt scpt
                ON scpt.study_id = s.id
            LEFT JOIN public.facilities f
                ON f.id = s.facility_id

            
            WHERE
                bc.id = ANY(${claimIds})

        `;

        return (await query(sql.text, sql.values)).rows;
    },

};
