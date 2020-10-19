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
    }

};

module.exports = bcData;
