const { query, queryRows, SQL } = require('../index');
const { getClaimPatientInsurances } = require('../../shared/index');

module.exports = {

    getKeys: async function () {
        const sql = SQL`SELECT * FROM
         (
            SELECT
                jsonb_array_elements(web_config) AS info from sites) AS info_tab
            WHERE
                info->>'id' IN ('insPokitdok', 'pokitdok_client_id', 'pokitdok_client_secret', 'CHCPokitdokBaseURL', 'CHCPokitdokAccessTokenURL') `;

        return await query(sql);
    },

    getLineItemsDetails: async function (params) {

        const studyIds = params.study_ids.split(',').map(Number);

        const firstStudyId = studyIds.length > 0 ? studyIds[0] : null;

        let sql = SQL`WITH
                        get_study_date AS(
                            SELECT
                               study_dt
                               , patient_id
                               , order_id
                               , ordering_facility_contact_id
                               , ofc.billing_type
                            FROM public.studies
                            LEFT JOIN ordering_facility_contacts ofc ON ofc.id = studies.ordering_facility_contact_id
                            WHERE studies.id = ${firstStudyId}
                        ),
                        get_ordering_facility_data AS (
                            SELECT
                                s.id AS study_id
                                , ofc.id AS ordering_facility_contact_id
                                , ofc.location
                                , ofc.billing_type
                                , of.name AS ordering_facility_name
                                , of.id
                                , ofc.place_of_service_id
                                , oft.description AS ordering_facility_type
                            FROM studies s
                            INNER JOIN facilities f ON f.id = s.facility_id
                            LEFT JOIN ordering_facility_contacts ofcp ON (
                                ofcp.ordering_facility_id = f.ordering_facility_id
                                AND ofcp.is_primary
                            )
                            INNER JOIN ordering_facility_contacts ofc ON ofc.id = COALESCE(s.ordering_facility_contact_id, ofcp.id)
                            INNER JOIN ordering_facilities of ON of.id = ofc.ordering_facility_id
                            LEFT JOIN ordering_facility_types oft ON oft.id = ofc.ordering_facility_type_id
                            WHERE s.id = ${firstStudyId}
                        ), order_level_beneficiary AS (
                            SELECT
                                patient_insurance_id,
                                coverage_level
                            FROM public.order_patient_insurances
                            WHERE order_id = (SELECT order_id FROM get_study_date)
                            ORDER BY coverage_level ASC
                        ), insurances AS (
                            SELECT
                                ins.*
                              FROM (
                                SELECT
                                      pi.id AS claim_patient_insurance_id
                                    , pi.patient_id
                                    , ip.id AS insurance_provider_id
                                    , ip.insurance_name AS insurance_provider_name
                                    , pi.subscriber_relationship_id
                                    , pi.subscriber_dob
                                    , COALESCE(olb.coverage_level, pi.coverage_level) AS coverage_level
                                    , pi.policy_number
                                    , pi.group_number
                                    , pi.subscriber_firstname
                                    , pi.subscriber_lastname
                                    , pi.subscriber_middlename
                                    , pi.subscriber_name_suffix
                                    , pi.subscriber_gender
                                    , pi.subscriber_address_line1
                                    , pi.subscriber_address_line2
                                    , pi.subscriber_country_code
                                    , pi.subscriber_city
                                    , pi.subscriber_state
                                    , pi.subscriber_zipcode
                                    , true as assign_benefits_to_patient
                                    , pi.medicare_insurance_type_code
                                    , pi.subscriber_employment_status_id
                                    , pi.valid_from_date
                                    , pi.valid_to_date
                                    , ipd.billing_method
                                    , ipd.is_split_claim_enabled
                                    , ROW_NUMBER() OVER (PARTITION BY COALESCE(olb.coverage_level, pi.coverage_level) ORDER BY (olb.patient_insurance_id, pi.id) ASC) AS rank
                                FROM
                                    public.patient_insurances pi
                                INNER JOIN public.insurance_providers ip ON ip.id = pi.insurance_provider_id
                                LEFT JOIN billing.insurance_provider_details ipd on ipd.insurance_provider_id = ip.id
                                LEFT JOIN order_level_beneficiary olb ON TRUE
                                WHERE pi.patient_id = (SELECT COALESCE(NULLIF(patient_id,'0'),'0')::NUMERIC FROM get_study_date)
                                AND EXISTS (
                                    SELECT 1
                                    FROM public.patient_insurances ppi
                                    WHERE ppi.id = pi.id
                                    AND (
                                        ppi.valid_to_date >= (SELECT COALESCE(study_dt, now()) FROM get_study_date)
                                        OR ppi.valid_to_date IS NULL
                                    )
                                )
                                AND CASE
                                        WHEN EXISTS (SELECT 1 FROM order_level_beneficiary)
                                        THEN pi.id = olb.patient_insurance_id
                                        ELSE TRUE
                                    END
                            ) ins
                            WHERE ins.rank = 1
                        ),
                        census_fee_charges_details AS (
                            SELECT (CASE
                                WHEN (${params.isMobileBillingEnabled} = 'true' AND (
                                    SELECT
                                        is_split_claim_enabled
                                    FROM insurances
                                    WHERE coverage_level = 'primary' AND is_split_claim_enabled IS TRUE)
                                    AND (SELECT billing_type from get_ordering_facility_data) != 'facility'
                                ) THEN ARRAY['insurance']
                                WHEN (${params.isMobileBillingEnabled} = 'true' AND  (SELECT billing_type from get_ordering_facility_data) = 'split')
                                THEN ARRAY['insurance']
                                ELSE NULL
                            END) AS split_types
                        ),
                        claim_charges AS (
                            SELECT
                                  sc.id AS study_cpt_id
                                , s.study_dt
                                , s.facility_id
                                , s.accession_no
                                , sc.study_id
                                , sc.cpt_code
                                , sc.modifier1_id AS m1
                                , sc.modifier2_id AS m2
                                , sc.modifier3_id AS m3
                                , sc.modifier4_id AS m4
                                , string_to_array(regexp_replace(study_cpt_info->'diagCodes_pointer', '[^0-9,]', '', 'g'),',')::int[] AS icd_pointers
                                , CASE
                                    WHEN (${params.isMobileBillingEnabled} AND (SELECT billing_type FROM get_ordering_facility_data) = 'facility') AND NOT sc.is_custom_bill_fee
                                    THEN billing.get_computed_bill_fee(null, pcc.id, sc.modifier1_id, sc.modifier2_id, sc.modifier3_id, sc.modifier4_id, 'billing', 'ordering_facility',
                                        (SELECT ordering_facility_contact_id FROM get_ordering_facility_data), o.facility_id, s.id)::NUMERIC
                                    WHEN (SELECT claim_patient_insurance_id FROM insurances where coverage_level = 'primary') IS NOT NULL AND NOT sc.is_custom_bill_fee
                                    THEN billing.get_computed_bill_fee(null,pcc.id,sc.modifier1_id,sc.modifier2_id,sc.modifier3_id,sc.modifier4_id,'billing','primary_insurance',
                                        (SELECT claim_patient_insurance_id FROM insurances where coverage_level = 'primary'), o.facility_id, s.id)::NUMERIC
                                    WHEN sc.is_custom_bill_fee
                                    THEN sc.bill_fee::NUMERIC
                                    ELSE
                                        billing.get_computed_bill_fee(null,pcc.id,sc.modifier1_id,sc.modifier2_id,sc.modifier3_id,sc.modifier4_id,'billing','patient',${params.patient_id},o.facility_id, s.id)::NUMERIC
                                  END AS bill_fee
                                , CASE
                                    WHEN (${params.isMobileBillingEnabled} AND (SELECT billing_type FROM get_ordering_facility_data) = 'facility') AND NOT sc.is_custom_bill_fee
                                    THEN billing.get_computed_bill_fee(null, pcc.id, sc.modifier1_id, sc.modifier2_id, sc.modifier3_id, sc.modifier4_id, 'allowed', 'ordering_facility',
                                        (SELECT ordering_facility_contact_id FROM get_ordering_facility_data), o.facility_id, s.id)::NUMERIC
                                    WHEN (SELECT claim_patient_insurance_id FROM insurances where coverage_level = 'primary') IS NOT NULL AND NOT sc.is_custom_bill_fee
                                    THEN billing.get_computed_bill_fee(null,pcc.id,sc.modifier1_id,sc.modifier2_id,sc.modifier3_id,sc.modifier4_id,'allowed','primary_insurance',
                                        (SELECT claim_patient_insurance_id FROM insurances where coverage_level = 'primary'), o.facility_id, s.id)::NUMERIC
                                    WHEN sc.is_custom_bill_fee
                                    THEN sc.allowed_amount::NUMERIC
                                    ELSE
                                        billing.get_computed_bill_fee(null,pcc.id,sc.modifier1_id,sc.modifier2_id,sc.modifier3_id,sc.modifier4_id,'allowed','patient',${params.patient_id},o.facility_id, s.id)::NUMERIC
                                  END AS allowed_fee
                                , COALESCE(sc.units,'1')::NUMERIC AS units
                                , sca.authorization_no AS authorization_no
                                , display_description
                                , additional_info
                                , sc.cpt_code_id AS cpt_id
                                , sc.is_billable
                                , pcc.charge_type
                                , sc.is_custom_bill_fee
                                , sc.professional_fee
                                , sc.technical_fee
                                , sc.is_billing_rule_applied
                                , sc.is_billing_rule_cpt_add_fee
                                , sc.billing_rule_fee::NUMERIC
                            FROM public.study_cpt sc
                            INNER JOIN public.studies s ON s.id = sc.study_id
                            INNER JOIN public.cpt_codes pcc on sc.cpt_code_id = pcc.id
                            INNER JOIN public.orders o on o.id = s.order_id
                            LEFT JOIN public.study_cpt_ndc scn ON scn.study_cpt_id = sc.id
                            LEFT JOIN public.study_cpt_authorizations sca ON (
                                sca.study_cpt_id = sc.id
                                AND sca.authorization_type = 'primary'
                                AND sca.deleted_dt IS NULL
                            )
                            LEFT JOIN LATERAL (
                                SELECT UNNEST(census_fee_charges_details.split_types) AS split_type FROM census_fee_charges_details
                            ) AS split ON TRUE
                            WHERE
                                sc.study_id = ANY(${studyIds}) AND sc.deleted_dt IS NULL
                            ORDER BY
                                sc.id ASC
                        )
                        , order_ids AS (
                            SELECT order_id FROM public.studies s WHERE s.id = ${firstStudyId}
                        )
                        ,claim_details AS (
                                    SELECT
                                        orders.facility_id,
                                        NULLIF(order_info->'currentDate','')::DATE AS current_illness_date,
                                        NULLIF(order_info->'similarIll','')::DATE AS same_illness_first_date,
                                        NULLIF(order_info->'wTo','')::DATE AS unable_to_work_to_date,
                                        NULLIF(order_info->'wFrom','')::DATE AS unable_to_work_from_date,
                                        NULLIF(order_info->'hTo','')::DATE AS hospitalization_to_date,
                                        NULLIF(order_info->'hFrom','')::DATE AS hospitalization_from_date,
                                        COALESCE(NULLIF(order_info->'outsideLab',''), 'false')::boolean AS service_by_outside_lab,
                                        order_info->'original_ref' AS original_reference,
                                        orders.order_info -> 'authorization_no' AS authorization_no,
                                        CASE
                                            WHEN order_info ->'frequency_code' = '1'
                                            THEN 'original'
                                            WHEN order_info ->'frequency_code' = '7'
                                            THEN 'corrected'
                                            WHEN order_info ->'frequency_code' = '8'
                                            THEN 'void'
                                            ELSE NULL
                                        END AS frequency,
                                        COALESCE(NULLIF(order_info->'oa',''), 'false')::boolean AS is_other_accident,
                                        COALESCE(NULLIF(order_info->'aa',''), 'false')::boolean AS is_auto_accident,
                                        COALESCE(NULLIF(order_info->'emp',''), 'false')::boolean AS is_employed,
                                        COALESCE(NULLIF(order_info->'accident_state',''), '') AS accident_state,
                                        orders.can_wcb_referral_date,
                                        referring_provider.ref_prov_full_name,
                                        referring_provider.referring_provider_contact_id,
                                        referring_provider.is_pri_ref_provider,
                                        referring_provider.specialities,
                                        referring_provider.referring_prov_npi_no,
                                        ordering_provider.ord_prov_full_name,
                                        ordering_provider.ordering_provider_contact_id,
                                        ordering_provider.is_pri_ord_provider,
                                        ordering_provider.specialities,
                                        ordering_provider.ordering_prov_npi_no,
                                        studies_details.referring_pro_study_desc,
                                        studies_details.rendering_provider_contact_id,
                                        studies_details.reading_phy_full_name,
                                        studies_details.rendering_prov_npi_no,
                                        providers.id as fac_rendering_provider_contact_id,
                                        providers.full_name as fac_reading_phy_full_name,
                                        providers.fac_rendering_prov_npi_no,
                                        facility_info->'service_facility_id' as service_facility_id,
                                        facility_info->'service_facility_name' as service_facility_name,
                                        ofd.ordering_facility_contact_id,
                                        ofd.id AS ordering_facility_id,
                                        ofd.ordering_facility_name,
                                        ofd.location,
                                        ofd.place_of_service_id AS ord_fac_place_of_service,
                                        ofd.ordering_facility_type,
                                        ordering_facility_ptn.ordering_facility_contact_id AS ptn_ordering_facility_contact_id,
                                        ordering_facility_ptn.id AS ptn_ordering_facility_id,
                                        ordering_facility_ptn.ordering_facility_name AS ptn_ordering_facility_name,
                                        ordering_facility_ptn.location AS ptn_location,
                                        ordering_facility_ptn.place_of_service_id AS ptn_ord_fac_place_of_service,
                                        order_info->'pos' AS pos,
                                        ofd.billing_type AS billing_type,
                                        bfs.default_provider_id AS fac_billing_provider_id,
                                        orders.order_status AS order_status,
                                        order_info -> 'pos_type_code' AS pos_type_code,
                                        order_info -> 'pos' AS pos_map_code,
                                        facilities.place_of_service_id AS fac_place_of_service_id,
                                        p.full_name AS patient_name,
                                        p.account_no AS patient_account_no,
                                        p.birth_date AS patient_dob,
                                        p.gender AS patient_gender,
                                        get_patient_alerts_to_jsonb(p.id, TRUE) AS alerts,
                                        p.patient_info,
                                        facilities.can_ahs_business_arrangement AS can_ahs_business_arrangement_facility,
                                        studies_details.can_ahs_locum_arrangement_provider,
                                        studies_details.nature_of_injury_code_id,
                                        studies_details.area_of_injury_code_id,
                                        studies_details.can_ahs_skill_code_id,
                                        studies_details.skill_code as skill_code,
                                        COALESCE(NULLIF((SELECT split_types IS NOT NULL FROM census_fee_charges_details), FALSE), (SELECT billing_type from get_ordering_facility_data) = 'split') AS is_split_claim,
                                        (
                                            SELECT
                                                jsonb_agg(jsonb_build_object(
                                                    'issuer_id', paa.issuer_id,
                                                    'issuer_type', iss.issuer_type,
                                                    'alt_account_no', paa.alt_account_no,
                                                    'is_primary', paa.is_primary,
                                                    'id', paa.id,
                                                    'country_alpha_3_code', paa.country_alpha_3_code,
                                                    'province_alpha_2_code', paa.province_alpha_2_code
                                                ))
                                            FROM
                                                patient_alt_accounts paa
                                            INNER JOIN
                                                issuers iss ON paa.issuer_id = iss.id
                                            WHERE
                                                patient_id = ${params.patient_id}
                                        ) AS patient_alt_acc_nos,
                                        (SELECT
                                            is_split_claim_enabled
                                        FROM insurances
                                        WHERE coverage_level = 'primary') AS is_split_claim_enabled
                                    FROM
                                        orders
                                        INNER JOIN order_ids oi ON oi.order_id = orders.id
                                        INNER JOIN facilities ON  facilities.id= orders.facility_id
                                        INNER JOIN patients p ON p.id= orders.patient_id
                                        LEFT JOIN billing.facility_settings bfs ON bfs.facility_id = facilities.id
                                        LEFT JOIN ordering_facility_contacts ON (
                                            ordering_facility_contacts.ordering_facility_id = facilities.ordering_facility_id
                                            AND ordering_facility_contacts.is_primary
                                        )
                                        LEFT JOIN get_ordering_facility_data ofd ON ofd.study_id = ${firstStudyId}
                                        LEFT JOIN LATERAL (
                                            SELECT
                                                ofc.id AS ordering_facility_contact_id,
                                                ofc.location,
                                                ofc.billing_type,
                                                of.name AS ordering_facility_name,
                                                of.id,
                                                ofc.place_of_service_id
                                            FROM
                                                public.ordering_facilities of
                                            INNER JOIN ordering_facility_contacts ofc
                                                ON ofc.ordering_facility_id = of.id
                                            INNER JOIN patients p
                                                ON p.default_ordering_facility_contact_id = ofc.id
                                            WHERE
                                                p.id = orders.patient_id
                                        ) ordering_facility_ptn  ON TRUE
                                        LEFT JOIN LATERAL (
                                            SELECT
                                                pc.id,
                                                p.full_name,
                                                p.provider_info->'NPI' AS fac_rendering_prov_npi_no
                                            FROM provider_contacts pc
                                            INNER JOIN providers p ON p.id = pc.provider_id
                                            WHERE pc.id = NULLIF(facility_info->'rendering_provider_id', '')::INT
                                            LIMIT 1
                                        ) providers ON true
                                        LEFT JOIN LATERAL (
                                            SELECT
                                                pc.id AS referring_provider_contact_id,
                                                pc.is_primary AS is_pri_ref_provider,
                                                p.full_name AS ref_prov_full_name,
                                                p.specialities,
                                                p.provider_info->'NPI' AS referring_prov_npi_no
                                            FROM
                                                providers p
                                            INNER JOIN provider_contacts pc ON pc.provider_id = p.id
                                            INNER JOIN studies s ON s.order_id = orders.id
                                            WHERE s.id = ${firstStudyId}
                                            AND pc.id = s.referring_physician_id
                                            AND p.deleted_dt IS NULL
                                            AND pc.deleted_dt IS NULL
                                            AND p.provider_type = 'RF'
                                        ) referring_provider ON true
                                        LEFT JOIN LATERAL (
                                            SELECT
                                                pc.id AS ordering_provider_contact_id,
                                                pc.is_primary AS is_pri_ord_provider,
                                                p.full_name AS ord_prov_full_name,
                                                p.specialities,
                                                p.provider_info->'NPI' AS ordering_prov_npi_no
                                            FROM
                                                providers p
                                            INNER JOIN provider_contacts pc ON pc.provider_id = p.id
                                            INNER JOIN studies s ON s.order_id = orders.id
                                            WHERE s.id = ${firstStudyId}
                                            AND pc.id = s.ordering_provider_contact_id
                                            AND p.deleted_dt IS NULL
                                            AND pc.deleted_dt IS NULL
                                            AND p.provider_type = 'RF'
                                        ) ordering_provider ON true
                                        JOIN LATERAL (
                                            SELECT
                                                p.full_name AS reading_phy_full_name,
                                                p.provider_info->'NPI' AS rendering_prov_npi_no,
                                                pc.id AS rendering_provider_contact_id,
                                                pc.can_locum_arrangement AS can_ahs_locum_arrangement_provider,
                                                nature_of_injury_code_id,
                                                area_of_injury_code_id,
                                                sca.authorization_no,
                                                s.study_info->'refDescription' AS referring_pro_study_desc,
                                                s.can_ahs_skill_code_id,
                                                sc.code AS skill_code
                                            FROM
                                                public.studies s
                                                LEFT JOIN public.skill_codes sc ON sc.id = s.can_ahs_skill_code_id
                                                LEFT JOIN public.study_transcriptions st ON st.study_id = s.id
                                                LEFT JOIN public.study_cpt cpt ON cpt.study_id = s.id
                                                LEFT JOIN public.study_cpt_authorizations sca ON (
                                                    sca.study_cpt_id = cpt.id
                                                    AND sca.authorization_type = 'primary'
                                                    AND sca.deleted_dt IS NULL
                                                )
                                                LEFT JOIN provider_contacts pc ON pc.id = (
                                                    CASE
                                                        WHEN st.approving_provider_id IS NOT NULL
                                                        THEN st.approving_provider_id
                                                        WHEN s.reading_physician_id IS NOT NULL
                                                        THEN s.reading_physician_id
                                                        WHEN NULLIF(facilities.facility_info->'rendering_provider_id', '') IS NOT NULL
                                                        THEN (facilities.facility_info->'rendering_provider_id')::INTEGER
                                                    END
                                                )
                                                LEFT JOIN providers p ON p.id = pc.provider_id
                                                WHERE s.id = ${firstStudyId}
                                                ORDER BY
                                                    cpt.id ASC
                                                LIMIT 1
                                        ) as studies_details ON TRUE
                            )
                            , wcb_injury_details AS (
                                SELECT
                                    jsonb_agg(
                                        jsonb_build_object(
                                            'study_id', s.id,
                                            'injury_detail_id', pcawid.id,
                                            'body_part_code', pcawid.body_part_code,
                                            'orientation_code', pcawid.orientation_code,
                                            'injury_id', pcawid.injury_id,
                                            'injury_description', pcawic.description
                                        )
                                    ) AS injury_details
                                FROM public.studies s
                                LEFT JOIN public.can_ahs_wcb_injury_details pcawid ON pcawid.study_id = s.id
                                LEFT JOIN public.can_wcb_injury_codes pcawic ON pcawic.id = pcawid.injury_id
                                WHERE s.id = ${firstStudyId}
                                    AND pcawic.injury_code_type = 'n'
                                    AND pcawic.inactivated_dt IS NULL
                            )
                            ,claim_problems AS (
                                        SELECT
                                            DISTINCT icd_codes.id
                                            ,code
                                            ,icd_codes.description
                                            ,pi.order_no
                                        FROM public.icd_codes
                                        INNER JOIN patient_icds pi ON pi.icd_id = icd_codes.id
                                        INNER JOIN public.orders o on o.id = pi.order_id
                                        INNER JOIN public.studies s ON s.order_id = o.id
                                        WHERE s.id = ANY(${studyIds})
                                        AND s.deleted_dt IS NULL
                                        AND pi.deleted_dt IS NULL
                                        ORDER BY pi.order_no
                            )
                            SELECT  ( SELECT COALESCE(json_agg(row_to_json(charge)),'[]') charges
                                        FROM (
                                                SELECT
                                                *
                                                FROM claim_charges
                                            ) AS charge
                                    ) AS charges
                                    , (
                                        SELECT COALESCE(injury_details, '[]') AS injury_details
                                        FROM wcb_injury_details
                                    ) AS injury_details
                                    ,( SELECT COALESCE(json_agg(row_to_json(claims)),'[]') claim_details
                                        FROM (
                                                SELECT
                                                *
                                                FROM claim_details
                                            ) AS claims
                                    ) AS claim_details
                                    , ( SELECT study_dt FROM get_study_date )
                                    ,( SELECT COALESCE(json_agg(row_to_json(claim_problems)),'[]') problems
                                        FROM (
                                                SELECT
                                                *
                                                FROM claim_problems
                                            ) AS claim_problems
                                    ) AS problems `;

        return await query(sql);
    },


    getPatientInsurances: async function (params) {

        const sql = SQL`WITH
                order_level_beneficiary AS (
                    SELECT
                        opi.patient_insurance_id,
                        opi.coverage_level
                    FROM order_patient_insurances  opi
                    WHERE opi.order_id = ANY(${params.order_ids})
                    ORDER BY opi.order_id ASC
                ),
                beneficiary_details as (
                        SELECT
                              pi.id
                            , ip.id AS insurance_provider_id
                            , ip.insurance_name
                            , ip.insurance_info->'City' AS ins_city
                            , ip.insurance_info->'State' AS ins_state
                            , ip.insurance_info->'ZipCode' AS ins_zip_code
                            , ip.insurance_info->'Address1' AS ins_pri_address
                            , ip.insurance_info->'PhoneNo' AS ins_phone_no
                            , ip.insurance_code
                            , pi.subscriber_relationship_id
                            , pi.valid_from_date
                            , pi.valid_to_date
                            , pi.subscriber_employment_status_id
                            , pi.subscriber_dob::text
                            , pi.medicare_insurance_type_code
                            , COALESCE(olb.coverage_level, pi.coverage_level) AS coverage_level
                            , pi.policy_number
                            , pi.group_name
                            , pi.group_number
                            , pi.precertification_phone_number
                            , pi.precertification_fax_number
                            , pi.subscriber_firstname
                            , pi.subscriber_lastname
                            , pi.subscriber_middlename
                            , pi.subscriber_name_suffix
                            , pi.subscriber_gender
                            , pi.subscriber_address_line1
                            , pi.subscriber_address_line2
                            , pi.subscriber_country_code
                            , pi.subscriber_city
                            , pi.subscriber_state
                            , pi.subscriber_zipcode
                            , pi.subscriber_zipcode_plus
                            , pi.assign_benefits_to_patient
                            , ipd.billing_method
                            , ipd.is_split_claim_enabled
                        FROM
                            public.patient_insurances pi
                        INNER JOIN public.insurance_providers ip ON ip.id= pi.insurance_provider_id
                        LEFT JOIN billing.insurance_provider_details ipd on ipd.insurance_provider_id = ip.id
                        LEFT JOIN order_level_beneficiary olb ON TRUE
                        WHERE pi.patient_id = ${params.patient_id}
                        AND EXISTS ( SELECT
                                        1
                                    FROM public.patient_insurances i_pi
                                    WHERE (i_pi.valid_to_date >= (${params.claim_date})::DATE OR i_pi.valid_to_date IS NULL)
                                    AND i_pi.id = pi.id)
                        AND CASE
                                WHEN EXISTS(SELECT 1 FROM order_level_beneficiary)
                                THEN pi.id = olb.patient_insurance_id
                                ELSE TRUE
                            END
                        AND ip.inactivated_dt IS NULL
                        ORDER BY COALESCE(olb.patient_insurance_id, pi.id) ASC
                ),
                existing_insurance as (
                        SELECT
                              pi.id
                            , ip.id AS insurance_provider_id
                            , ip.insurance_name
                            , ip.insurance_code
                            , ip.insurance_info->'City' AS ins_city
                            , ip.insurance_info->'State' AS ins_state
                            , ip.insurance_info->'ZipCode' AS ins_zip_code
                            , ip.insurance_info->'Address1' AS ins_pri_address
                            , ip.insurance_info->'partner_id' AS ins_partner_id
                            , ip.insurance_info->'PhoneNo' AS ins_phone_no
                            , pi.coverage_level
                            , pi.subscriber_relationship_id
                            , pi.valid_from_date
                            , pi.valid_to_date
                            , pi.subscriber_employment_status_id
                            , pi.subscriber_dob::text
                            , pi.medicare_insurance_type_code
                            , pi.coverage_level
                            , pi.policy_number
                            , pi.group_name
                            , pi.group_number
                            , pi.precertification_phone_number
                            , pi.precertification_fax_number
                            , pi.subscriber_firstname
                            , pi.subscriber_lastname
                            , pi.subscriber_middlename
                            , pi.subscriber_name_suffix
                            , pi.subscriber_gender
                            , pi.subscriber_address_line1
                            , pi.subscriber_address_line2
                            , pi.subscriber_country_code
                            , pi.subscriber_city
                            , pi.subscriber_state
                            , pi.subscriber_zipcode
                            , pi.subscriber_zipcode_plus
                            , pi.assign_benefits_to_patient
                            , f.facility_info -> 'npino' as npi_no
                            , f.facility_info -> 'federal_tax_id' as federal_tax_id
                            , f.facility_info -> 'enable_insurance_eligibility' as enable_insurance_eligibility
                            , (pi.valid_to_date >= CURRENT_DATE OR pi.valid_to_date IS NULL) AS is_active
                            , ipd.billing_method
                        FROM public.patient_insurances pi
                        INNER JOIN public.insurance_providers ip ON ip.id= pi.insurance_provider_id
                        LEFT JOIN billing.insurance_provider_details ipd on ipd.insurance_provider_id = ip.id
                        LEFT JOIN public.patients p ON p.id= pi.patient_id
                        LEFT JOIN public.patient_facilities pf ON pf.patient_id = pi.patient_id
                        LEFT JOIN public.facilities f ON f.id = pf.facility_id AND pf.is_default
                        WHERE
                            pi.patient_id = ${params.patient_id}
                            AND ip.inactivated_dt IS NULL
                        ORDER BY pi.id asc
                )
                SELECT
                  ( SELECT json_agg(row_to_json(beneficiary_details)) beneficiary_details
                      FROM (
                              SELECT
                                    *
                              FROM
                                  beneficiary_details

                          ) AS beneficiary_details
                  ) AS beneficiary_details,
                  ( SELECT json_agg(row_to_json(existing_insurance)) existing_insurance
                      FROM (
                              SELECT
                                    *
                              FROM
                                  existing_insurance

                          ) AS existing_insurance
                  ) AS existing_insurance,
                  ( SELECT
                        patient_info::jsonb
                    FROM
                        patients
                    WHERE
                        id = ${params.patient_id}
                  ) AS patient_info `;

        return await query(sql);
    },

    getPatientInsurancesById: async function (params) {

        let { id } = params;

        const sql = SQL`SELECT
                              pi.id
                            , ip.id AS insurance_provider_id
                            , ip.insurance_name
                            , ip.insurance_info->'City' AS ins_city
                            , ip.insurance_info->'State' AS ins_state
                            , ip.insurance_info->'ZipCode' AS ins_zip_code
                            , ip.insurance_info->'Address1' AS ins_pri_address
                            , ip.insurance_info->'PhoneNo' AS ins_phone_no
                            , ip.insurance_code
                            , pi.coverage_level
                            , pi.subscriber_relationship_id
                            , pi.valid_from_date
                            , pi.valid_to_date
                            , pi.subscriber_employment_status_id
                            , pi.subscriber_dob::text
                            , pi.medicare_insurance_type_code
                            , pi.coverage_level
                            , pi.policy_number
                            , pi.group_name
                            , pi.group_number
                            , pi.precertification_phone_number
                            , pi.precertification_fax_number
                            , pi.subscriber_firstname
                            , pi.subscriber_lastname
                            , pi.subscriber_middlename
                            , pi.subscriber_name_suffix
                            , pi.subscriber_gender
                            , pi.subscriber_address_line1
                            , pi.subscriber_address_line2
                            , pi.subscriber_country_code
                            , pi.subscriber_city
                            , pi.subscriber_state
                            , pi.subscriber_zipcode
                            , pi.subscriber_zipcode_plus
                            , pi.assign_benefits_to_patient
                            , ipd.billing_method
                           FROM public.patient_insurances pi
                           INNER JOIN public.insurance_providers ip ON ip.id= pi.insurance_provider_id
                           LEFT JOIN billing.insurance_provider_details ipd on ipd.insurance_provider_id = ip.id
                           WHERE
                                pi.id = ${id}  `;

        return await query(sql);
    },

    save: async function (params) {
        let {
            claims
            , insurances
            , claim_icds
            , auditDetails
            , is_alberta_billing
            , is_ohip_billing
        } = params;

        let createClaimFunction = 'billing.create_claim_charge';

        if (is_alberta_billing) {
            createClaimFunction = 'billing.can_ahs_create_claim_per_charge';
        } else if (is_ohip_billing) {
            createClaimFunction = 'billing.can_ohip_create_claim_split_charge';
        }

        const sql = SQL`SELECT `
            .append(createClaimFunction)
            .append(SQL`(
            jsonb_array_elements(${JSON.stringify(claims)})::jsonb,
                (${JSON.stringify(insurances)})::jsonb,
                (${JSON.stringify(claim_icds)})::jsonb,
                (${JSON.stringify(auditDetails)})::jsonb
            ) as result`);

        if (!is_alberta_billing && !is_ohip_billing) {
            sql.append(SQL`
                WHERE NOT EXISTS (
                    SELECT  1
                    FROM    billing.charges_studies
                    WHERE   study_id = ${claims[0].study_id}
                    LIMIT   1
                );
            `);
        }

        return await query(sql);
    },

    getClaimData: async (params) => {

        const {
            id,
            patient_id
        } = params;

        const get_claim_sql = SQL`
                SELECT
                      c.id AS claim_id
                    , c.company_id
                    , c.facility_id
                    , c.patient_id
                    , c.billing_provider_id
                    , c.can_issuer_id
                    , c.rendering_provider_contact_id
                    , c.can_ahs_skill_code_id
                    , psc.code AS skill_code
                    , c.referring_provider_contact_id
                    , c.ordering_facility_contact_id
                    , claim_ins.primary_patient_insurance_id
                    , claim_ins.secondary_patient_insurance_id
                    , claim_ins.tertiary_patient_insurance_id
                    , c.place_of_service_id
                    , c.pos_map_code
                    , c.billing_code_id
                    , c.billing_class_id
                    , c.created_by
                    , c.billing_method
                    , c.billing_notes
                    , c.billing_type AS claim_billing_type
                    , c.claim_dt::text
                    , c.created_dt::text
                    , c.current_illness_date::text
                    , c.same_illness_first_date::text
                    , c.unable_to_work_from_date::text
                    , c.unable_to_work_to_date::text
                    , c.hospitalization_from_date::text
                    , c.hospitalization_to_date::text
                    , c.claim_notes
                    , c.original_reference
                    , c.authorization_no
                    , c.frequency
                    , c.can_submission_code_id
                    , c.is_auto_accident
                    , c.is_other_accident
                    , c.is_employed
                    , c.can_wcb_referral_date
                    , c.accident_state
                    , c.service_by_outside_lab
                    , c.payer_type
                    , c.claim_status_id
                    , c.xmin as claim_row_version
                    , c.can_ahs_pay_to_code
                    , c.can_ahs_pay_to_uli
                    , c.can_ahs_pay_to_details
                    , c.can_ahs_business_arrangement
                    , c.can_ahs_locum_arrangement
                    , f.can_ahs_business_arrangement AS can_ahs_business_arrangement_facility
                    , rend_pc.can_locum_arrangement AS can_ahs_locum_arrangement_provider
                    , c.can_ahs_claimed_amount_indicator
                    , c.can_confidential
                    , c.can_ahs_newborn_code
                    , c.can_ahs_emsaf_reason
                    , c.can_ahs_paper_supporting_docs
                    , c.can_supporting_text
                    , c.can_ohip_manual_review_indicator AS manual_review_indicator
                    , c.delay_reason_id
                    , cst.code AS claim_status_code
                    , p.account_no AS patient_account_no
                    , p.birth_date::text AS patient_dob
                    , p.full_name AS patient_name
                    , p.gender AS patient_gender
                    , (
                        SELECT
                            ARRAY_AGG(note)
                        FROM
                            billing.claim_comments bcc
                        WHERE
                            bcc.claim_id = ${id}
                            AND 'edit_claim' = ANY(bcc.alert_screens)
                    ) AS edit_claim_alerts
                    , (
                        SELECT
                            jsonb_agg(jsonb_build_object(
                                'issuer_id', paa.issuer_id,
                                'issuer_type', i_.issuer_type,
                                'alt_account_no', paa.alt_account_no,
                                'is_primary', paa.is_primary,
                                'id', paa.id,
                                'country_alpha_3_code', paa.country_alpha_3_code,
                                'province_alpha_2_code', paa.province_alpha_2_code
                            ))
                        FROM patient_alt_accounts paa
                        INNER JOIN issuers i_ ON paa.issuer_id = i_.id
                        WHERE patient_id = ${patient_id}
                    ) AS patient_alt_acc_nos
                    , (SELECT alt_account_no FROM patient_alt_accounts LEFT JOIN issuers i ON i.id = issuer_id WHERE patient_id = p.id AND i.issuer_type = 'uli_phn' AND province_alpha_2_code = 'ab' LIMIT 1) AS can_ahs_uli_phn
                    , get_patient_alerts_to_jsonb(p.id, TRUE) AS alerts
                    , p.patient_info
                    , ref_pr.full_name AS ref_prov_full_name
                    , ref_pr.provider_code AS ref_prov_code
                    , ref_pr.provider_info->'NPI' AS referring_prov_npi_no
                    , ref_pr.specialities
                    , ref_pc.is_primary AS is_pri_ref_provider
                    , rend_pr.full_name AS reading_phy_full_name
                    , rend_pr.provider_info->'NPI' AS rendering_prov_npi_no
                    , pof.address_line_1 AS service_facility_addressLine1
                    , pof.id AS ordering_facility_id
                    , pof.city AS ordering_facility_city
                    , pof.name AS ordering_facility_name
                    , pof.npi_number AS ordering_facility_npi_no
                    , pof.state AS ordering_facility_state
                    , pof.zip_code AS ordering_facility_zip
                    , pofc.location
                    , c.billing_type
                    , poft.description AS ordering_facility_type
                    , ofcp.id AS ptn_ordering_facility_contact_id
                    , ofcp.location AS ptn_location
                    , ofp.name AS ptn_ordering_facility_name
                    , ofp.id AS ptn_ordering_facility_id
                    , ofcp.place_of_service_id AS ptn_ord_fac_place_of_service
                    , ipp.insurance_info->'Address1' AS p_address1
                    , ipp.insurance_info->'PayerID' AS p_payer_id
                    , ipp.insurance_info->'City' AS p_city
                    , ipp.insurance_info->'PhoneNo' AS p_phone_no
                    , ipp.insurance_info->'State' AS p_state
                    , ipp.insurance_info->'ZipCode' AS p_zip
                    , ipp.insurance_name AS p_insurance_name
                    , ipp.insurance_code AS p_insurance_code
                    , (SELECT billing_method as p_billing_method FROM billing.insurance_provider_details WHERE insurance_provider_id = ipp.id)
                    , (SELECT is_split_claim_enabled AS is_split_claim_enabled FROM billing.insurance_provider_details WHERE insurance_provider_id = ipp.id)
                    , cpi.insurance_provider_id AS p_insurance_provider_id
                    , cpi.subscriber_zipcode AS p_subscriber_zipcode
                    , cpi.subscriber_zipcode_plus AS p_subscriber_zipcode_plus
                    , cpi.subscriber_relationship_id AS p_subscriber_relationship_id
                    , cpi.coverage_level AS p_coverage_level
                    , cpi.policy_number AS p_policy_number
                    , cpi.group_number AS p_group_number
                    , cpi.subscriber_employment_status_id AS p_subscriber_employment_status_id
                    , cpi.subscriber_firstname AS p_subscriber_firstname
                    , cpi.subscriber_lastname AS p_subscriber_lastname
                    , cpi.subscriber_middlename AS p_subscriber_middlename
                    , cpi.subscriber_name_suffix AS p_subscriber_name_suffix
                    , cpi.subscriber_gender AS p_subscriber_gender
                    , cpi.subscriber_address_line1 AS p_subscriber_address_line1
                    , cpi.subscriber_address_line2 AS p_subscriber_address_line2
                    , cpi.subscriber_country_code AS p_subscriber_country_code
                    , cpi.subscriber_city AS p_subscriber_city
                    , cpi.subscriber_state AS p_subscriber_state
                    , cpi.assign_benefits_to_patient AS p_assign_benefits_to_patient
                    , cpi.subscriber_dob::text AS p_subscriber_dob
                    , cpi.valid_from_date AS p_valid_from_date
                    , COALESCE(ipp.inactivated_dt::DATE, cpi.valid_to_date) AS p_valid_to_date
                    , cpi.medicare_insurance_type_code AS p_medicare_insurance_type_code
                    , ips.insurance_info->'Address1' AS s_address1
                    , ips.insurance_info->'PayerID' AS s_payer_id
                    , ips.insurance_info->'City' AS s_city
                    , ips.insurance_info->'PhoneNo' AS s_phone_no
                    , ips.insurance_info->'State' AS s_state
                    , ips.insurance_info->'ZipCode' AS s_zip
                    , ips.insurance_name AS s_insurance_name
                    , (SELECT billing_method as s_billing_method FROM billing.insurance_provider_details WHERE insurance_provider_id = ips.id)
                    , csi.insurance_provider_id AS s_insurance_provider_id
                    , csi.subscriber_zipcode AS s_subscriber_zipcode
                    , csi.subscriber_zipcode_plus AS s_subscriber_zipcode_plus
                    , csi.subscriber_relationship_id AS s_subscriber_relationship_id
                    , csi.coverage_level AS s_coverage_level
                    , csi.policy_number AS s_policy_number
                    , csi.group_number AS s_group_number
                    , csi.subscriber_employment_status_id AS s_subscriber_employment_status_id
                    , csi.subscriber_firstname AS s_subscriber_firstname
                    , csi.subscriber_lastname AS s_subscriber_lastname
                    , csi.subscriber_middlename AS s_subscriber_middlename
                    , csi.subscriber_name_suffix AS s_subscriber_name_suffix
                    , csi.subscriber_gender AS s_subscriber_gender
                    , csi.subscriber_address_line1 AS s_subscriber_address_line1
                    , csi.subscriber_address_line2 AS s_subscriber_address_line2
                    , csi.subscriber_country_code AS s_subscriber_country_code
                    , csi.subscriber_city AS s_subscriber_city
                    , csi.subscriber_state AS s_subscriber_state
                    , csi.assign_benefits_to_patient AS s_assign_benefits_to_patient
                    , csi.subscriber_dob::text AS s_subscriber_dob
                    , csi.valid_from_date AS s_valid_from_date
                    , COALESCE(ips.inactivated_dt::DATE, csi.valid_to_date) AS s_valid_to_date
                    , csi.medicare_insurance_type_code AS s_medicare_insurance_type_code
                    , ipt.insurance_info->'Address1' AS t_address1
                    , ipt.insurance_info->'PayerID' AS t_payer_id
                    , ipt.insurance_info->'City' AS t_city
                    , ipt.insurance_info->'PhoneNo' AS t_phone_no
                    , ipt.insurance_info->'State' AS t_state
                    , ipt.insurance_info->'ZipCode' AS t_zip
                    , ipt.insurance_name AS t_insurance_name
                    , (SELECT billing_method as t_billing_method FROM billing.insurance_provider_details WHERE insurance_provider_id = ipt.id)
                    , cti.insurance_provider_id AS t_insurance_provider_id
                    , cti.subscriber_zipcode AS t_subscriber_zipcode
                    , cti.subscriber_zipcode_plus AS t_subscriber_zipcode_plus
                    , cti.subscriber_relationship_id AS t_subscriber_relationship_id
                    , cti.coverage_level AS t_coverage_level
                    , cti.policy_number AS t_policy_number
                    , cti.group_number AS t_group_number
                    , cti.subscriber_employment_status_id AS t_subscriber_employment_status_id
                    , cti.subscriber_firstname AS t_subscriber_firstname
                    , cti.subscriber_lastname AS t_subscriber_lastname
                    , cti.subscriber_middlename AS t_subscriber_middlename
                    , cti.subscriber_name_suffix AS t_subscriber_name_suffix
                    , cti.subscriber_gender AS t_subscriber_gender
                    , cti.subscriber_address_line1 AS t_subscriber_address_line1
                    , cti.subscriber_address_line2 AS t_subscriber_address_line2
                    , cti.subscriber_country_code AS t_subscriber_country_code
                    , cti.subscriber_city AS t_subscriber_city
                    , cti.subscriber_state AS t_subscriber_state
                    , cti.assign_benefits_to_patient AS t_assign_benefits_to_patient
                    , cti.subscriber_dob::text AS t_subscriber_dob
                    , cti.valid_from_date AS t_valid_from_date
                    , COALESCE(ipt.inactivated_dt::DATE, cti.valid_to_date) AS t_valid_to_date
                    , cti.medicare_insurance_type_code AS t_medicare_insurance_type_code
                    , f.facility_info -> 'npino' as npi_no
                    , f.facility_info -> 'federal_tax_id' as federal_tax_id
                    , f.facility_info -> 'enable_insurance_eligibility' as enable_insurance_eligibility
                    , f.facility_info -> 'rendering_provider_id' AS fac_rendering_provider_contact_id
                    , c.can_wcb_rejected
                    , c.can_mhs_receipt_date::text AS can_mhs_receipt_date
                    , c.can_mhs_microfilm_no
                    , public.get_issuer_details(c.patient_id , 'uli_phn') AS phn_acc_no
                    , (
                        SELECT array_agg(row_to_json(pointer)) AS claim_charges
                        FROM (
                            SELECT
                                  ch.id
                                , claim_id
                                , ch.cpt_id
                                , modifier1_id
                                , modifier2_id
                                , modifier3_id
                                , modifier4_id
                                , pointer1
                                , pointer2
                                , pointer3
                                , pointer4
                                , cpt.display_code AS cpt_code
                                , cpt.display_description
                                , ch.units
                                , ch.charge_dt
                                , ch.bill_fee::numeric
                                , is_excluded
                                , ch.allowed_amount::numeric as allowed_fee
                                , ch.authorization_no
                                , (ch.units * ch.bill_fee)::numeric as total_bill_fee
                                , (ch.units * ch.allowed_amount)::numeric as total_allowed_fee
                                , chs.study_id
                                , (SELECT accession_no FROM public.studies WHERE id = chs.study_id )
                                , pb.referral_code              AS can_ahs_referral_code
                                , pb.support_documentation      AS can_ahs_supporting_text_required
                                , (SELECT EXISTS (SELECT * FROM billing.payment_applications WHERE charge_id = ch.id )) as payment_exists
                                , ch.is_custom_bill_fee
                            FROM billing.charges ch
                                INNER JOIN public.cpt_codes cpt ON ch.cpt_id = cpt.id
                                LEFT JOIN LATERAL (
                                    SELECT
                                        pb.cpt_id AS cpt_code_id
                                        , pb.referral_code
                                        , pb.support_documentation
                                    FROM plan_benefits pb
                                    WHERE
                                        pb.cpt_id = cpt.id
                                        AND ch.charge_dt::DATE BETWEEN pb.effective_date AND pb.end_date
                                    ORDER BY (pb.end_date, pb.effective_date) DESC
                                    LIMIT 1
                                ) pb ON TRUE
                                LEFT JOIN billing.charges_studies chs ON chs.charge_id = ch.id
                            WHERE
                                claim_id = c.id
                            ORDER BY ch.id, ch.line_num ASC
                      ) pointer) AS claim_charges
                    , (
                        SELECT array_agg(row_to_json(icd_query)) AS icd_data
                        FROM (
                            SELECT
                                  ci.id
                                , icd_id
                                , icd.code
                                , icd.description
                                , icd.code_type
                                , icd.is_active /* icd_codes.is_active  */
                            FROM billing.claim_icds ci
                            INNER JOIN public.icd_codes icd ON ci.icd_id = icd.id
                            WHERE claim_id = c.id
                            ORDER BY id ASC
                      ) icd_query) AS claim_icd_data
                    , (
                        SELECT array_agg(row_to_json(injury_data)) AS injury_details
                        FROM (
                            SELECT
                                  cawid.id AS injury_detail_id
                                , cawid.body_part_code
                                , cawid.orientation_code
                                , cawid.injury_id
                                , wic.description AS injury_description
                            FROM billing.can_ahs_wcb_injury_details cawid
                            LEFT JOIN public.can_wcb_injury_codes wic ON wic.id = cawid.injury_id
                            WHERE
                               cawid.claim_id = c.id
                               AND wic.injury_code_type = 'n'
                            ORDER BY
                               cawid.id ASC
                        ) injury_data) AS injury_details
                    , (
                        SELECT json_agg(row_to_json(existing_insurance)) AS existing_insurance
                        FROM (
                            SELECT
                              pi.id
                            , ip.id AS insurance_provider_id
                            , pi.policy_number
                            , (pi.valid_to_date >= CURRENT_DATE OR pi.valid_to_date IS NULL) AS is_active
                            , ip.insurance_name
                            , ip.insurance_code
                            , ip.insurance_info->'partner_id' AS ins_partner_id
                            , pi.coverage_level
                            , pi.valid_to_date
                        FROM public.patient_insurances pi
                        INNER JOIN public.insurance_providers ip ON ip.id = pi.insurance_provider_id
                        WHERE
                            pi.patient_id = c.patient_id
                            AND ip.inactivated_dt IS NULL
                        ORDER BY pi.coverage_level,pi.id ASC
                      ) existing_insurance) AS existing_insurance
                    , (
                        SELECT json_agg(row_to_json(claim_fee_details)) AS claim_fee_details
                        FROM (
                            SELECT
                                  COALESCE(sum(bpa.amount) FILTER(where bp.payer_type = 'patient' AND amount_type = 'payment'),0::money)::numeric AS patient_paid
                                , COALESCE(sum(bpa.amount) FILTER(where bp.payer_type != 'patient' AND amount_type = 'payment'),0::money)::numeric AS others_paid
                                , SUM(CASE WHEN (amount_type = 'adjustment' AND (accounting_entry_type != 'refund_debit' OR adjustment_code_id IS NULL)) THEN bpa.amount ELSE 0::money END)::numeric AS adjustment
                                , SUM(CASE WHEN accounting_entry_type = 'refund_debit' THEN bpa.amount ELSE 0::money END)::numeric AS refund_amount
                                , (SELECT SUM(claim_balance_total) FROM billing.get_claim_totals(c.id))::numeric AS balance
                                , (SELECT charges_bill_fee_total from billing.get_claim_totals(c.id))::numeric AS bill_fee
                            FROM billing.claims bc
                            INNER JOIN billing.charges ch ON ch.claim_id = bc.id
                            LEFT JOIN billing.payment_applications bpa ON bpa.charge_id = ch.id
                            LEFT JOIN billing.payments bp ON bp.id = bpa.payment_id
                            LEFT JOIN billing.adjustment_codes adj ON adj.id = bpa.adjustment_code_id
                         WHERE
                            bc.id = c.id
                      ) claim_fee_details) AS claim_fee_details
                    , (
                        SELECT COALESCE(json_agg(row_to_json(payment_details)),'[]') AS payment_details
                        FROM (
                            SELECT
                                p.id,
                                pa.payment_application_id,
                                p.patient_id,
                                p.payment_reason_id,
                                p.amount::numeric,
                                p.accounting_date::text,
                                p.payer_type,
                                p.mode,
                                p.card_name,
                                p.card_number,
                                COALESCE(pa.amount::numeric::text,'0.00') AS payment_applied,
                                COALESCE(pa.adjustment::numeric::text,'0.00') AS adjustment_applied,
                                payer_details.payer_info,
                                row_number() OVER( ORDER BY p.id ) as row_index,
                                p.payment_dt,
                                p.facility_id
                            FROM
                                billing.payments AS p
                                INNER JOIN (
                                    SELECT
                                        pa.payment_id,
                                        max(pa.id) AS payment_application_id,
                                        sum(pa.amount) FILTER (WHERE  amount_type='payment') AS amount,
                                        sum(pa.amount) FILTER (WHERE  amount_type='adjustment') AS adjustment
                                    FROM
                                        billing.charges AS c
                                        INNER JOIN billing.payment_applications AS pa ON pa.charge_id = c.id
                                        WHERE c.claim_id = ${id}
                                        GROUP BY pa.applied_dt, pa.payment_id
                                ) AS pa ON p.id = pa.payment_id
                                LEFT JOIN (
                                    SELECT
                                    ( CASE
                                        WHEN p1.payer_type = 'insurance' THEN
                                            json_build_object(
                                                'payer_name',ins_pro.insurance_name,
                                                'payer_id',ins_pro.id,
                                                'payer_type_name',p1.payer_type
                                            )
                                        WHEN p1.payer_type = 'patient' THEN
                                            json_build_object(
                                                'payer_name',pat.full_name,
                                                'payer_id',pat.id,
                                                'payer_type_name',p1.payer_type
                                            )
                                        WHEN p1.payer_type = 'ordering_facility' THEN
                                            json_build_object(
                                                'payer_name', ordering_facilities.name,
                                                'payer_id', ordering_facilities.id,
                                                'payer_type_name', p1.payer_type
                                            )
                                        WHEN p1.payer_type = 'ordering_provider' THEN
                                            json_build_object(
                                                'payer_name',providers.full_name,
                                                'payer_id',pro_cont.id,
                                                'payer_type_name',p1.payer_type
                                            )
                                        ELSE null
                                        END
                                    ) AS payer_info,
                                    p1.id
                                    FROM billing.payments p1
                                        LEFT JOIN insurance_providers ins_pro ON ins_pro.id= p1.insurance_provider_id
                                        LEFT JOIN patients pat ON pat.id = p1.patient_id
                                        LEFT JOIN provider_contacts pro_cont ON pro_cont.id= p1.provider_contact_id
                                        LEFT JOIN providers ON providers.id= pro_cont.provider_id
                                        LEFT JOIN ordering_facilities ON ordering_facilities.id = p1.ordering_facility_id
                                ) AS payer_details ON payer_details.id = p.id
                            ORDER BY
                                p.id ASC
                                , pa.payment_application_id ASC
                        ) payment_details
                    ) AS payment_details
                    , c.area_of_injury_code_id
                    , c.nature_of_injury_code_id
                    , COALESCE(c.encounter_no, 1)::SMALLINT AS can_ahs_encounter_no
                    FROM
                        billing.claims c
                        INNER JOIN public.patients p ON p.id = c.patient_id `
            .append(getClaimPatientInsurances('c'))
            .append(`
                        LEFT JOIN public.patient_insurances cpi ON cpi.id = claim_ins.primary_patient_insurance_id
                        LEFT JOIN public.patient_insurances csi ON csi.id = claim_ins.secondary_patient_insurance_id
                        LEFT JOIN public.patient_insurances cti ON cti.id = claim_ins.tertiary_patient_insurance_id
                        LEFT JOIN public.insurance_providers ipp ON ipp.id = cpi.insurance_provider_id
                        LEFT JOIN public.insurance_providers ips ON ips.id = csi.insurance_provider_id
                        LEFT JOIN public.insurance_providers ipt ON ipt.id = cti.insurance_provider_id
                        LEFT JOIN public.provider_contacts ref_pc ON ref_pc.id = c.referring_provider_contact_id
                        LEFT JOIN public.providers ref_pr ON ref_pc.provider_id = ref_pr.id
                        LEFT JOIN public.provider_contacts rend_pc ON rend_pc.id = c.rendering_provider_contact_id
                        LEFT JOIN public.providers rend_pr ON rend_pc.provider_id = rend_pr.id
                        LEFT JOIN public.ordering_facility_contacts pofc ON pofc.id = c.ordering_facility_contact_id
                        LEFT JOIN public.ordering_facilities pof ON pof.id = pofc.ordering_facility_id
                        LEFT JOIN public.ordering_facility_types poft ON poft.id = pofc.ordering_facility_type_id
                        LEFT JOIN public.facilities f ON c.facility_id = f.id
                        LEFT JOIN billing.claim_status cst ON cst.id = c.claim_status_id
                        LEFT JOIN public.skill_codes psc ON psc.id = c.can_ahs_skill_code_id
                        LEFT JOIN public.ordering_facility_contacts ofcp ON ofcp.id = p.default_ordering_facility_contact_id
                        LEFT JOIN public.ordering_facilities ofp ON ofp.id = ofcp.ordering_facility_id
                    WHERE
                        c.id = ${id}`);

        return await query(get_claim_sql);
    },

    update: async function (args) {
        let {
            claims,
            insurances,
            claim_icds,
            charges,
            auditDetails,
        } = args;

        const sqlQry = SQL`
        SELECT billing.update_claim_charge (
            (${JSON.stringify(claims)})::jsonb,
            (${JSON.stringify(insurances)})::jsonb,
            (${JSON.stringify(claim_icds)})::jsonb,
            (${JSON.stringify(auditDetails)})::jsonb,
            (${JSON.stringify(charges)})::jsonb
        ) AS result
        `;

        return await query(sqlQry);
    },

    getProviderInfo: async (billingProviderId, insuranceProviderId) => {

        let sqlQry = SQL`
                SELECT name,
                    npi_no,
                    (SELECT insurance_info -> 'partner_id'
                    FROM   insurance_providers
                    WHERE  id = ${insuranceProviderId}) AS trading_partner_id
                FROM   billing.providers
                WHERE  id = ${billingProviderId}
        `;

        return await queryRows(sqlQry);
    },

    getFolderPath: async (params) => {

        let sqlQry = SQL`
        SELECT account_no, facility_info->'pokitdok_response' as filepath from public.patients p
        INNER JOIN patient_facilities pf on pf.patient_id=p.id
        INNER JOIN public.facilities f on f.id = pf.facility_id AND pf.is_default where p.id = ${params.patient_id} `;

        return await query(sqlQry);
    },

    getClaimVersion: async (params) => {

        let sqlQry = SQL`
        SELECT xmin as claim_row_version from billing.claims where id = ${params.id} `;

        return await query(sqlQry);
    },

    getStudiesByPatientId: async function (params) {

        let { id } = params;

        const sql = SQL`
        SELECT * FROM (
            SELECT json_agg(row_to_json(charge)) "charges"
                    FROM (
                            SELECT
                                 studies.id
                                ,studies.patient_id
                                ,studies.modality_id
                                ,studies.facility_id
                                ,accession_no
                                ,study_description
                                ,study_status
                                ,study_dt
                                ,facilities.facility_name
                                ,ofc.billing_type
                            FROM studies
                                LEFT JOIN orders ON orders.id=studies.order_id
                                INNER JOIN facilities ON studies.facility_id=facilities.id
                                LEFT JOIN ordering_facility_contacts ofc ON ofc.id = studies.ordering_facility_contact_id
                            WHERE
                                studies.deleted_dt IS NULL
                                AND study_dt IS NOT NULL
                                AND studies.patient_id = ${id}
                                AND studies.study_status NOT IN ('CAN', 'ABRT', 'NOS')
                                AND NOT EXISTS ( SELECT 1 FROM billing.charges_studies WHERE study_id = studies.id )
                            ORDER BY study_dt DESC
                    ) AS charge
            ) charge_details
            ,(
                SELECT (row_to_json(patient_default_details)) "patient_details"
                    FROM
                        (
                        SELECT
                            p.id AS patient_id
                            ,p.full_name AS patient_name
                            ,p.birth_date AS patient_dob
                            ,p.gender AS patient_gender
                            ,p.account_no AS patient_account_no
                            ,p.alt_account_no
                            ,p.last_name
                            ,p.first_name
                            ,p.dicom_patient_id
                            ,p.is_active
                            ,p.patient_info
                            ,get_patient_alerts_to_jsonb(p.id, TRUE) AS alerts
                            ,f.id AS facility_id
                            ,fs.default_provider_id AS billing_provider_id
                            ,pofc.id AS service_facility_contact_id
                            ,pofc.location AS service_facility_contact_name
                            ,pof.id AS service_facility_id
                            ,pof.name AS service_facility_name
                            ,oft.description AS ordering_facility_type
                            ,pofc.billing_type
                            ,COALESCE(NULLIF(f.facility_info->'rendering_provider_id',''),'0')::numeric AS rendering_provider_id
                            ,fac_prov_cont.id AS rendering_provider_contact_id
                            ,fac_prov.full_name AS rendering_provider_full_name
                            ,f.place_of_service_id AS fac_place_of_service_id
                            ,pofc.place_of_service_id AS ord_fac_place_of_service_id
                            ,pos_map.more_info -> 'pos_dispatching_address' AS pos_map_code
                            ,(
                                SELECT
                                    jsonb_agg(jsonb_build_object(
                                        'issuer_id', paa.issuer_id,
                                        'issuer_type', iss.issuer_type,
                                        'alt_account_no', paa.alt_account_no,
                                        'is_primary', paa.is_primary,
                                        'id', paa.id,
                                        'country_alpha_3_code', paa.country_alpha_3_code,
                                        'province_alpha_2_code', paa.province_alpha_2_code
                                    ))
                                FROM
                                    patient_alt_accounts paa
                                INNER JOIN
                                    issuers iss ON paa.issuer_id = iss.id
                                WHERE
                                    patient_id = ${id}
                            ) AS patient_alt_acc_nos
                        FROM
                            patients p
                        INNER JOIN patient_facilities pfc ON pfc.patient_id = p.id
                        INNER JOIN facilities f ON f.id = pfc.facility_id AND pfc.is_default
                        LEFT JOIN public.ordering_facilities pof ON pof.id = f.ordering_facility_id
                        LEFT JOIN public.ordering_facility_contacts pofc ON pofc.ordering_facility_id = pof.id AND pofc.is_primary IS TRUE
                        LEFT JOIN public.ordering_facility_types oft ON oft.id = pofc.ordering_facility_type_id
                        LEFT JOIN provider_contacts fac_prov_cont ON f.facility_info->'rendering_provider_id'::text = fac_prov_cont.id::text
                        LEFT JOIN providers fac_prov ON fac_prov.id = fac_prov_cont.provider_id
                        LEFT JOIN billing.facility_settings fs ON fs.facility_id = pfc.facility_id AND pfc.is_default
                        LEFT JOIN public.pos_map ON pos_map.id = pof.pos_map_id
                        WHERE p.id = ${id}
                    ) AS patient_default_details
            ) patient_info `;

        return await query(sql);

    },

    getPatientAltAccNumber: async function (args) {

        const { id } = args;

        const sql = SQL`
            SELECT
                paa.id
                , paa.issuer_id::INT
                , i.issuer_type
                , paa.alt_account_no
                , paa.is_primary
                , paa.country_alpha_3_code
                , paa.province_alpha_2_code
            FROM
                patient_alt_accounts paa
            INNER JOIN
                issuers i ON paa.issuer_id = i.id
            WHERE
                patient_id = ${id}`;

        return await query(sql);

    },

    getClaimsByPatient: async function (args) {
        const {
            id,
            countFlag,
            pageNo,
            pageSize
        } = args;

        let joinQuery = `
            INNER JOIN billing.charges ch ON ch.claim_id = c.id
            INNER JOIN public.cpt_codes cpt ON ch.cpt_id = cpt.id
        `;

        let whereQuery = SQL` WHERE c.patient_id = ${id} AND c.claim_dt > (CURRENT_DATE - INTERVAL '12 months') `;

        let sql = '';

        if (countFlag == 'true') {

            sql = SQL`
                SELECT
                    COUNT(ch.id) AS charges_total_records,
                    COUNT(DISTINCT c.id) AS claims_total_records
                FROM billing.claims c
                `;

            sql.append(joinQuery);
            sql.append(whereQuery);
        } else {

            sql = SQL`
                SELECT
                    claim_id AS claim_no
                    , cpt.display_code AS cpt_code
                    , cpt.display_description AS description
                    , c.claim_dt AS study_dt
                FROM
                    billing.claims c
                `;

            sql.append(joinQuery);
            sql.append(whereQuery);

            sql.append(SQL`
                ORDER BY claim_id DESC
                LIMIT ${pageSize}
                OFFSET ${pageSize * (pageNo - 1)}
            `);
        }

        return await query(sql);
    },

    getExistingPayer: async (params) => {

        let sqlQry = SQL`
                SELECT
                    payer_type
                FROM
                    billing.claims
                WHERE
                    id = ${params.id}`;

        return await query(sqlQry);
    },

    saveICD: async (params) => {
        let sqlQry = SQL`
                INSERT INTO public.icd_codes(
                            code
                            ,description
                            ,is_active  /* icd_codes.is_active */
                            ,company_id
                            ,code_type
                            ,deleted_dt
                            ,created_dt
                )
                SELECT
                       ${params.code}
                    ,  ${params.description}
                    , true
                    , ${params.companyId}
                    , ${params.code_type}
                    , NULL
                    , now()
                WHERE NOT EXISTS ( SELECT id FROM public.icd_codes  WHERE code ILIKE ${params.code}  AND company_id = ${params.companyId} AND NOT has_deleted) /* icd_codes.has_deleted */
                RETURNING *, '{}'::jsonb old_values
                `;

        return await query(sqlQry);

    },

    getICD: async (params) => {
        let sqlQry = SQL`
            SELECT
                *
            FROM
                public.icd_codes
           WHERE code ILIKE ${params.code}  AND company_id = ${params.companyId} AND NOT has_deleted
        `; // icd_codes.has_deleted

        return await query(sqlQry);
    },

    getApprovedReportsByPatient: async (params) => {
        let sqlQry = SQL`
            SELECT
             id
            FROM
                public.studies
                WHERE
                patient_id = ${params.patient_id}
                AND study_status='APP'
                AND deleted_dt IS NULL
            ORDER BY study_dt
        `;

        return await query(sqlQry);
    },

    deleteInsuranceProvider: async (params) => {

        const {
            userId,
            claim_id,
            clientIp,
            companyId,
            payer_type,
            entityName,
            screenName,
            moduleName,
            is_current_responsible,
        } = params;

        let payer ='';

        if(payer_type == 'primary_insurance'){
            payer = 'Primary Insurances';
        } else if(payer_type == 'secondary_insurance'){
            payer = 'Secondary Insurances';
        } else if(payer_type == 'tertiary_insurance'){
            payer = 'Tertiary Insurances';
        }

        let description = `${payer} Deleted from claim ${claim_id}, Responsible and Billing method changed to patient `;
        let sql = SQL`
        WITH delete_claim_patient_insurances AS (
                DELETE FROM billing.claim_patient_insurances
                WHERE claim_id = ${claim_id} AND coverage_level = ${payer_type.split('_')[0]}
        ), update_claim AS (
            UPDATE billing.claims
                SET
                payer_type =
                    CASE ${is_current_responsible}
                        WHEN 'true' THEN 'patient' ELSE payer_type
                    END,
                billing_method =
                    CASE ${is_current_responsible}
                        WHEN 'true' THEN 'patient_payment' ELSE billing_method
                    END
            WHERE id = ${claim_id}
            RETURNING xmin as claim_row_version ,*,
            (
                SELECT row_to_json(old_row)
                FROM   (SELECT *
                        FROM   billing.claims
                        WHERE  id = ${claim_id}) old_row
            ) old_values),
            claim_update_audit_cte AS (
                SELECT billing.create_audit (
                        ${companyId},
                        ${entityName || screenName},
                        ${claim_id},
                        ${screenName},
                        ${moduleName},
                        ${description},
                        ${clientIp || '127.0.0.1'},
                    json_build_object(
                        'old_values', COALESCE(uc.old_values, '{}'),
                        'new_values', ( SELECT row_to_json(temp_row)::jsonb - 'old_values'::text FROM ( SELECT * FROM update_claim) temp_row))::jsonb,
                        ${userId || 0}) id,claim_row_version
                FROM update_claim uc)
                SELECT * FROM claim_update_audit_cte `;

        return await query(sql);
    },

    getClaimAppliedPayments: async function (params) {

        let { id } = params;
        const sqlQry = SQL`WITH
                payment_details AS (
                        SELECT
                            p.id,
                            pa.payment_application_id,
                            p.patient_id,
                            p.payment_reason_id,
                            p.amount::numeric,
                            p.accounting_date::text,
                            p.payer_type,
                            p.mode,
                            p.card_name,
                            p.card_number,
                            COALESCE(pa.amount::numeric::text,'0.00') AS payment_applied,
                            COALESCE(pa.adjustment::numeric::text,'0.00') AS adjustment_applied,
                            payer_details.payer_info,
                            claim_details.xmin AS claim_row_version,
                            claim_details.payer_type AS current_claim_payer_type,
                            row_number() OVER( ORDER BY p.id ) as row_index
                        FROM
                            billing.payments AS p
                            INNER JOIN (
                                SELECT
                                    pa.payment_id,
                                    max(pa.id) AS payment_application_id,
                                    sum(pa.amount) FILTER (WHERE  amount_type='payment') AS amount,
                                    sum(pa.amount) FILTER (WHERE  amount_type='adjustment') AS adjustment
                                FROM
                                    billing.charges AS c
                                    INNER JOIN billing.payment_applications AS pa ON pa.charge_id = c.id
                                    WHERE c.claim_id = ${id}
                                    GROUP BY pa.applied_dt, pa.payment_id
                            ) AS pa ON p.id = pa.payment_id
                            LEFT JOIN (
                                SELECT
                                ( CASE
                                    WHEN p1.payer_type = 'insurance' THEN
                                        json_build_object(
                                            'payer_name',ins_pro.insurance_name,
                                            'payer_id',ins_pro.id,
                                            'payer_type_name',p1.payer_type
                                        )
                                    WHEN p1.payer_type = 'patient' THEN
                                        json_build_object(
                                            'payer_name',pat.full_name,
                                            'payer_id',pat.id,
                                            'payer_type_name',p1.payer_type
                                        )
                                    WHEN p1.payer_type = 'ordering_facility' THEN
                                        json_build_object(
                                            'payer_name', ordering_facilities.name,
                                            'payer_id', ordering_facilities.id,
                                            'payer_type_name', p1.payer_type
                                        )
                                    WHEN p1.payer_type = 'ordering_provider' THEN
                                        json_build_object(
                                            'payer_name',providers.full_name,
                                            'payer_id',pro_cont.id,
                                            'payer_type_name',p1.payer_type
                                        )
                                    ELSE null
                                    END
                                ) AS payer_info,
                                p1.id
                                FROM billing.payments p1
                                    LEFT JOIN insurance_providers ins_pro ON ins_pro.id= p1.insurance_provider_id
                                    LEFT JOIN patients pat ON pat.id = p1.patient_id
                                    LEFT JOIN provider_contacts pro_cont ON pro_cont.id= p1.provider_contact_id
                                    LEFT JOIN providers ON providers.id= pro_cont.provider_id
                                    LEFT JOIN ordering_facilities ON ordering_facilities.id = p1.ordering_facility_id
                            ) AS payer_details ON payer_details.id = p.id
                            LEFT JOIN LATERAL (
                                SELECT
                                    xmin,
                                    payer_type
                                FROM
                                    billing.claims c
                                WHERE c.id = ${id}
                            ) AS claim_details ON TRUE
                        ORDER BY
                            p.id ASC
                            , pa.payment_application_id ASC
                    ),
                    claim_fee_details AS (
                        SELECT
                              COALESCE(sum(bpa.amount) FILTER(where bp.payer_type = 'patient' AND amount_type = 'payment'),0::money)::numeric AS patient_paid
                            , COALESCE(sum(bpa.amount) FILTER(where bp.payer_type != 'patient' AND amount_type = 'payment'),0::money)::numeric AS others_paid
                            , SUM(CASE WHEN (amount_type = 'adjustment' AND (accounting_entry_type != 'refund_debit' OR adjustment_code_id IS NULL)) THEN bpa.amount ELSE 0::money END)::numeric AS adjustment
                            , SUM(CASE WHEN accounting_entry_type = 'refund_debit' THEN bpa.amount ELSE 0::money END)::numeric AS refund_amount
                            , gct.claim_balance_total::numeric AS balance
                            , gct.charges_bill_fee_total::numeric AS bill_fee
                        FROM billing.claims bc
                            INNER JOIN billing.charges ch ON ch.claim_id = bc.id
                            INNER JOIN billing.get_claim_totals(bc.id) gct ON TRUE
                            LEFT JOIN billing.payment_applications bpa ON bpa.charge_id = ch.id
                            LEFT JOIN billing.payments bp ON bp.id = bpa.payment_id
                            LEFT JOIN billing.adjustment_codes adj ON adj.id = bpa.adjustment_code_id
                        WHERE
                            bc.id = ${id}
                            GROUP BY gct.claim_balance_total ,gct.charges_bill_fee_total
                    )
                    SELECT
                    (
                        SELECT json_agg(row_to_json(payment_details.*)) AS payment_details FROM payment_details
                    ),
                    (    SELECT json_agg(row_to_json(claim_fee_details.*)) AS claim_fee_details FROM claim_fee_details
                    ) `;

        return await query(sqlQry);

    },

    getChargesByPatientId : async function (params) {
        let {
            patient_id,
            current_date
        } = params;

        let sql = SQL`
                    SELECT
                         sc.study_id
                        , s.patient_id
                        , s.study_dt AS study_time
                        , s.accession_no
                        , sc.cpt_code_id AS cpt_id
                        , sc.cpt_code AS cpt_code
                        , display_description AS cpt_description
                        , modifier1.code AS m1
                        , modifier2.code AS m2
                        , modifier3.code AS m3
                        , s.facility_id
                    FROM public.study_cpt sc
                    INNER JOIN public.cpt_codes pcc ON sc.cpt_code_id = pcc.id
                    INNER JOIN studies s ON s.id = sc.study_id
                    INNER JOIN orders o ON s.order_id = o.id
                    LEFT JOIN modifiers AS modifier1 ON modifier1.id = sc.modifier1_id
                    LEFT JOIN modifiers AS modifier2 ON modifier2.id = sc.modifier2_id
                    LEFT JOIN modifiers AS modifier3 ON modifier3.id = sc.modifier3_id
                    WHERE s.patient_id = ${patient_id}
                    AND to_facility_date(s.facility_id, s.study_dt) = ${current_date}
                    AND o.order_status NOT IN ('CAN','NOS')
                    AND s.study_status NOT IN ('CAN','NOS')
                    AND sc.deleted_dt IS NULL
                    ORDER BY sc.study_id DESC `;

        return await query(sql);
    },

    getBusinessArrangement: async (params) => {
        let {
            facility_id,
            rendering_provider_id
        } = params;

        let sql = SQL`
                    SELECT
                    (
                        SELECT
                            f.can_ahs_business_arrangement
                        FROM
                            facilities f
                        WHERE
                            f.id = ${facility_id}
                    ) AS can_ahs_business_arrangement_facility,
                    (
                        SELECT
                            pc.can_locum_arrangement
                        FROM
                            provider_contacts pc
                        WHERE
                            pc.id = ${rendering_provider_id}
                    ) AS can_ahs_locum_arrangement_provider `;

        return await query(sql);
    },

    updateNotes: async (params) => {
        const {
            claimId,
            billingNotes,
            claimNotes,
            canSupportingText
        } = params;

        let sql = SQL`
                    UPDATE BILLING.CLAIMS
                    SET billing_notes = ${billingNotes}`;

        if (params.billingRegionCode === 'can_MB') {
            sql.append(SQL`, claim_notes = ${claimNotes}`);
        } else if (params.billingRegionCode === 'can_BC') {
            sql.append(SQL`, can_supporting_text = ${canSupportingText}`);
        }

        sql.append(SQL` WHERE id = ${claimId} RETURNING id`);

        return await query(sql);
    },

    getTechnicalAndProfessionalModifier: async () => {

        let sql = SQL`
                    SELECT
                        (SELECT id FROM modifiers WHERE code = '26') AS professional_modifier_id
                        , (SELECT id FROM modifiers WHERE code = 'TC') AS technical_modifier_id`;

        return await queryRows(sql);
    }
};
