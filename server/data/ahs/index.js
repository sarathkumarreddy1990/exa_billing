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
                    p.can_ahs_registration_number_province                                             AS service_recipient_registration_number_province
            FROM
                billing.claims bc
            LEFT JOIN billing.charges bch
                ON bch.claim_id = bc.id
            LEFT JOIN billing.charges_studies bchs
                ON bchs.charge_id = bch.id
            LEFT JOIN public.studies s
                ON s.id = bchs.study_id
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
            
            WHERE
                bc.id = ANY(${claimIds})

        `;

        const sql1 = SQL`
            SELECT
                bc.id AS claim_id,
                bc.billing_method,
                claim_notes AS "claimNotes",
                npi_no AS "groupNumber",    -- this sucks
                rend_pr.provider_info -> 'NPI' AS "providerNumber",
                (
                    SELECT json_agg(item)
                    FROM (
                        SELECT
                        key AS speciality_code,
                        value AS speciality_desc
                    FROM speciality_codes
                    WHERE value = ANY(rend_pr.specialities)
                    ) item
                ) AS "specialtyCodes",
                33 AS "specialtyCode",  -- NOTE this is only meant to be a temporary workaround
                (SELECT JSON_agg(Row_to_json(claim_details)) FROM (
                WITH cte_insurance_details AS (
                SELECT
                (Row_to_json(insuranceDetails)) AS "insuranceDetails"
                FROM (SELECT
                ppi.policy_number AS "healthNumber",
                ppi.group_number AS "versionCode",
                pp.birth_date AS "dateOfBirth",
                bc.id AS "accountingNumber",
                'P' AS "payee",                                                 -- TODO
                '    ' AS "masterNumber",                                       -- TODO
                reff_pr.provider_info -> 'NPI' AS "referringProviderNumber",    -- TODO HSTORES should have keys changed
                'IHF' AS "serviceLocationIndicator",                            -- TODO this should probably be set at the company level
                ppi.policy_number AS "registrationNumber",                      -- TODO this is really just the insurance subscriber policy #
                pp.last_name AS "patientLastName",                              -- TODO this should be coming from the patient_insurances table
                pp.first_name AS "patientFirstName",                            -- TODO this should be coming from the patient_insurances table
                get_full_name(pp.last_name,pp.first_name) AS "patientName",
                pip.insurance_name AS "payerName",
                pp.gender AS "patientSex",                                      -- TODO this should be coming from the patient_insurances table
                pp.patient_info -> 'c1State' AS "provinceCode",               -- TODO this should be coming from the patient_insurances table
                pp.patient_info->'c1AddressLine1' AS "patientAddress",
                pip.insurance_code AS "paymentProgram",
                reff_pr.id AS "referringProvider",
                rend_pr.id AS "renderingProvider",
                reff_pr.provider_info -> 'NPI' AS "referringProviderNumber",
                reff_pr.provider_info -> 'NPI' AS "referringProviderNpi",
                rend_pr.provider_info -> 'NPI' AS "renderingProviderNpi",
                bp.address_line1 AS "billing_pro_addressLine1",
                bp.city AS billing_pro_city,
                bp.name AS "billing_pro_firstName",
                bp.state AS "billing_pro_state",
                bp.zip_code AS "billing_pro_zip",
                CASE WHEN (SELECT charges_bill_fee_total FROM billing.get_claim_totals(bc.id)) > 0::money
                    THEN (SELECT charges_bill_fee_total FROM billing.get_claim_totals(bc.id)) ELSE null END AS "claim_totalCharge",
                pp.patient_info->'c1AddressLine1' AS "patient_address1",
                pp.patient_info->'c1City' AS "patient_city",
                pp.birth_date AS "patient_dob",
                COALESCE (NULLIF(pp.first_name, ''), '') AS "patient_firstName",
                COALESCE (NULLIF(pp.last_name, ''), '') AS "patient_lastName",
                COALESCE (NULLIF(pp.gender, ''), '') AS "patient_gender",
                pp.patient_info->'c1State' AS "patient_province",
                pp.patient_info->'c1Zip' AS "patient_zipCode",
                rend_pr.first_name AS "reading_physician_full_name",
                reff_pr.first_name AS "ref_full_name",
                pg.group_info->'AddressLine1' AS "service_facility_addressLine1",
                pg.group_info->'City' AS "service_facility_city",
                pg.group_name AS "service_facility_firstName",
                pg.group_info->'State' AS "service_facility_state",
                pg.group_info->'Zip' AS "service_facility_zip"
                FROM public.patient_insurances ppi
                INNER JOIN public.insurance_providers pip ON pip.id = ppi.insurance_provider_id
                WHERE ppi.id = bc.primary_patient_insurance_id) AS insuranceDetails)
                , charge_details AS (
                SELECT JSON_agg(Row_to_json(items)) "items" FROM (
                SELECT
                pcc.display_code AS "serviceCode",
                (bch.bill_fee * bch.units) AS "feeSubmitted",
                bch.units AS "numberOfServices",
                charge_dt AS "serviceDate",
                billing.get_charge_icds (bch.id) AS diagnosticCodes
                FROM billing.charges bch
                INNER JOIN public.cpt_codes pcc ON pcc.id = bch.cpt_id
                LEFT JOIN LATERAL
                (
                  SELECT
                      SUM(COALESCE(bpa.amount::numeric,0)) AS charge_payment
                  FROM billing.payment_applications bpa
                  WHERE bpa.charge_id = bch.id
                ) cp ON TRUE
                WHERE bch.claim_id = bc.id AND NOT bch.is_excluded
                AND ((bch.bill_fee::numeric * bch.units) - (COALESCE(cp.charge_payment,0))) > 0) AS items )
                SELECT * FROM cte_insurance_details, charge_details) AS claim_details ) AS "claims"
                FROM billing.claims bc
                LEFT JOIN public.provider_groups pg ON pg.id = bc.ordering_facility_id
                INNER JOIN public.companies pc ON pc.id = bc.company_id
                INNER JOIN public.patients pp ON pp.id = bc.patient_id
                INNER JOIN billing.providers bp ON bp.id = bc.billing_provider_id
                LEFT JOIN public.provider_contacts rend_ppc ON rend_ppc.id = bc.rendering_provider_contact_id
                LEFT JOIN public.providers rend_pr ON rend_pr.id = rend_ppc.provider_id
                LEFT JOIN public.provider_contacts reff_ppc ON reff_ppc.id = bc.referring_provider_contact_id
                LEFT JOIN public.providers reff_pr ON reff_pr.id = reff_ppc.provider_id
                WHERE bc.id = ANY (${claimIds})
                ORDER BY bc.id DESC
            `;

        return (await query(sql.text, sql.values)).rows;
    },

};
