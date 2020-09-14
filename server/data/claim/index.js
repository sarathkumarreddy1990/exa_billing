const { query, queryRows, SQL } = require('../index');

module.exports = {

    getKeys: async function () {
        const sql = SQL`SELECT * FROM
         (
             SELECT json_array_elements(web_config) AS info from sites)AS info_tab
            WHERE info->>'id' IN('insPokitdok' , 'pokitdok_client_id' , 'pokitdok_client_secret') `;

        return await query(sql);
    },

    getLineItemsDetails: async function (params) {

        const studyIds = params.study_ids.split(',').map(Number);

        const firstStudyId = studyIds.length > 0 ? studyIds[0] : null;

        let sql = SQL`WITH
                        get_study_date AS(
                            SELECT
                               study_dt
                            FROM public.studies
                            WHERE id = ${firstStudyId}
                        ),
                        beneficiary_details as (
                            SELECT
                                pi.id
                            FROM
                                public.patient_insurances pi
                            INNER JOIN public.insurance_providers ip ON ip.id= pi.insurance_provider_id
                            LEFT JOIN billing.insurance_provider_details ipd on ipd.insurance_provider_id = ip.id
                            LEFT JOIN LATERAL (
                                SELECT
                                    MIN(valid_to_date) as valid_to_date
                                FROM
                                    public.patient_insurances
                                WHERE
                                    patient_id = ${params.patient_id}
                                    AND (valid_to_date >= (SELECT study_dt::DATE FROM get_study_date)  OR valid_to_date IS NULL)
                                    AND (valid_from_date <= (SELECT study_dt::DATE FROM get_study_date) OR valid_from_date IS NULL)
                                    AND coverage_level = 'primary'
                            ) as expiry ON TRUE
                                WHERE
                                    pi.patient_id = ${params.patient_id}  AND (expiry.valid_to_date = pi.valid_to_date OR expiry.valid_to_date IS NULL) AND pi.coverage_level = 'primary'
                                ORDER BY id ASC
                                LIMIT 1
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
                                , (CASE WHEN (select id from beneficiary_details) IS NOT NULL THEN
                                    billing.get_computed_bill_fee(null,cpt_codes.id,sc.modifier1_id,sc.modifier2_id,sc.modifier3_id,sc.modifier4_id,'billing','primary_insurance',(select id from beneficiary_details), o.facility_id)::NUMERIC
                                  ELSE
                                    billing.get_computed_bill_fee(null,cpt_codes.id,sc.modifier1_id,sc.modifier2_id,sc.modifier3_id,sc.modifier4_id,'billing','patient',${params.patient_id},o.facility_id)::NUMERIC
                                  END) as bill_fee
                                , (CASE WHEN (select id from beneficiary_details) IS NOT NULL THEN
                                    billing.get_computed_bill_fee(null,cpt_codes.id,sc.modifier1_id,sc.modifier2_id,sc.modifier3_id,sc.modifier4_id,'allowed','primary_insurance',(select id from beneficiary_details), o.facility_id)::NUMERIC
                                  ELSE
                                    billing.get_computed_bill_fee(null,cpt_codes.id,sc.modifier1_id,sc.modifier2_id,sc.modifier3_id,sc.modifier4_id,'allowed','patient',${params.patient_id},o.facility_id)::NUMERIC
                                  END) as allowed_fee
                                , COALESCE(sc.units,'1')::NUMERIC AS units
                                , COALESCE ( NULLIF(sc.authorization_info->'Primary', '')::json->'authorization_no', 'null') AS authorization_no
                                , display_description
                                , additional_info
                                , sc.cpt_code_id AS cpt_id
                            FROM public.study_cpt sc
                            INNER JOIN public.studies s ON s.id = sc.study_id
                            INNER JOIN public.cpt_codes on sc.cpt_code_id = cpt_codes.id
                            INNER JOIN public.orders o on o.id = s.order_id
                            WHERE
                                study_id = ANY(${studyIds}) AND sc.has_deleted = FALSE /* study_cpt.has_deleted */
                            ORDER BY s.accession_no DESC

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
                                        order_info->'authorization_no' AS authorization_no,
                                        order_info->'frequency_code' AS frequency,
                                        COALESCE(NULLIF(order_info->'oa',''), 'false')::boolean AS is_other_accident,
                                        COALESCE(NULLIF(order_info->'aa',''), 'false')::boolean AS is_auto_accident,
                                        COALESCE(NULLIF(order_info->'emp',''), 'false')::boolean AS is_employed,
                                        COALESCE(NULLIF(order_info->'accident_state',''), '') AS accident_state,
                                        referring_provider.ref_prov_full_name,
                                        referring_provider.referring_provider_contact_id,
                                        (   SELECT
                                                    studies.study_info->'refDescription'
                                            FROM
                                                    studies
                                            WHERE
                                                studies.order_id IN (SELECT order_id FROM public.studies s WHERE s.id = ${firstStudyId})
                                            ORDER BY studies.order_id DESC LIMIT 1 ) AS
                                        referring_pro_study_desc,
                                        studies_details.rendering_provider_contact_id,
                                        studies_details.reading_phy_full_name,
                                        providers.id as fac_rendering_provider_contact_id,
                                        providers.full_name as fac_reading_phy_full_name,
                                        facility_info->'service_facility_id' as service_facility_id,
                                        facility_info->'service_facility_name' as service_facility_name,
                                        (
                                            SELECT
                                                default_provider_id
                                            FROM
                                                billing.facility_settings
                                            WHERE
                                                facility_id = orders.facility_id
                                        ) AS fac_billing_provider_id,
                                        order_info -> 'ordering_facility_id' AS ordering_facility_id,
                                        order_info -> 'ordering_facility' AS ordering_facility_name,
                                        orders.order_status AS order_status,
                                        order_info -> 'pos_type_code' AS pos_type_code,
                                        facilities.place_of_service_id AS fac_place_of_service_id,
                                        p.full_name AS patient_name,
                                        p.account_no AS patient_account_no,
                                        p.birth_date AS patient_dob,
                                        p.gender AS patient_gender,
                                        get_patient_alerts_to_jsonb(p.id, TRUE) AS alerts,
                                        p.patient_info,
                                        facilities.can_ahs_business_arrangement AS can_ahs_business_arrangement_facility,
                                        studies_details.can_ahs_locum_arrangement_provider,
                                        (SELECT nature_of_injury_code_id FROM studies WHERE id=${firstStudyId}),
                                        (SELECT area_of_injury_code_id FROM studies WHERE id=${firstStudyId})
                                    FROM
                                        orders
                                        INNER JOIN facilities ON  facilities.id= orders.facility_id
                                        INNER JOIN patients p ON p.id= orders.patient_id
                                        LEFT JOIN LATERAL (
                                            SELECT pc.id, p.full_name FROM provider_contacts pc
                                                INNER JOIN providers p ON p.id = pc.provider_id
                                            WHERE	pc.id = nullif(facility_info->'rendering_provider_id', '')::integer limit 1
                                        ) providers ON true
                                        LEFT JOIN LATERAL (
                                            SELECT
                                                pc.id AS referring_provider_contact_id,
                                                p.full_name AS ref_prov_full_name
                                            FROM
                                                providers p
                                            INNER JOIN provider_contacts pc ON pc.provider_id = p.id
                                            WHERE pc.id = COALESCE(NULLIF(orders.referring_provider_ids [ 1 ],'0'),'0')::numeric
                                            AND p.deleted_dt IS NULL
                                            AND pc.deleted_dt IS NULL
                                            AND p.provider_type = 'RF'
                                        ) referring_provider ON true
                                        JOIN LATERAL (
                                            SELECT
                                                p.full_name AS reading_phy_full_name,
                                                pc.id AS rendering_provider_contact_id,
                                                pc.can_ahs_locum_arrangement AS can_ahs_locum_arrangement_provider
                                            FROM
                                                public.studies s
                                                LEFT JOIN public.study_transcriptions st ON st.study_id = s.id
                                                LEFT JOIN public.study_cpt cpt ON cpt.study_id = s.id
                                                LEFT JOIN provider_contacts pc ON pc.id = st.approving_provider_id
                                                LEFT JOIN providers p ON p.id = pc.provider_id
                                                WHERE s.id = ${firstStudyId}
                                                ORDER BY cpt.id ASC LIMIT 1
                                        ) as studies_details ON TRUE
                                    WHERE orders.id IN (SELECT order_id FROM public.studies s WHERE s.id = ${firstStudyId})
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
                                        ORDER BY pi.order_no
                            )
                            SELECT  ( SELECT COALESCE(json_agg(row_to_json(charge)),'[]') charges
		                                FROM (
                                                SELECT
		                                	    *
                                                FROM claim_charges
                                            ) AS charge
                                    ) AS charges
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
                    SELECT ARRAY[COALESCE(primary_patient_insurance_id, '0')::bigint, COALESCE(secondary_patient_insurance_id, '0')::bigint, COALESCE(tertiary_patient_insurance_id, '0')::bigint] AS patient_ins_id
                    FROM public.orders
                    WHERE primary_patient_insurance_id IS NOT NULL
                    AND id = ANY(${params.order_ids})
                    ORDER BY id ASC
                    LIMIT 1
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
                            , pi.subscriber_city
                            , pi.subscriber_state
                            , pi.subscriber_zipcode
                            , pi.assign_benefits_to_patient
                            , ipd.billing_method
                        FROM
                            public.patient_insurances pi
                        INNER JOIN public.insurance_providers ip ON ip.id= pi.insurance_provider_id
                        LEFT JOIN billing.insurance_provider_details ipd on ipd.insurance_provider_id = ip.id
                        LEFT JOIN LATERAL (
                            SELECT
                                coverage_level,
                                MIN(valid_to_date) as valid_to_date
                            FROM
                                public.patient_insurances
                            WHERE
                                patient_id = ${params.patient_id} AND (valid_to_date >= (${params.claim_date})::date  OR valid_to_date IS NULL)
                                AND (valid_from_date <= (${params.claim_date})::date OR valid_from_date IS NULL)
                                AND CASE WHEN EXISTS(SELECT patient_ins_id FROM order_level_beneficiary) THEN patient_insurances.id = ANY(SELECT UNNEST(patient_ins_id) FROM order_level_beneficiary) ELSE TRUE END
                                GROUP BY coverage_level
                        ) as expiry ON TRUE
                        WHERE
                            pi.patient_id = ${params.patient_id}  AND (expiry.valid_to_date = pi.valid_to_date OR expiry.valid_to_date IS NULL) AND expiry.coverage_level = pi.coverage_level
                            AND CASE WHEN EXISTS(SELECT patient_ins_id FROM order_level_beneficiary) THEN pi.id = ANY(SELECT UNNEST(patient_ins_id) FROM order_level_beneficiary) ELSE TRUE END
                            ORDER BY id ASC
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
                            , pi.subscriber_city
                            , pi.subscriber_state
                            , pi.subscriber_zipcode
                            , pi.assign_benefits_to_patient
                            , f.facility_info -> 'npino' as npi_no
                            , f.facility_info -> 'federal_tax_id' as federal_tax_id
                            , f.facility_info -> 'enable_insurance_eligibility' as enable_insurance_eligibility
                            , ipd.billing_method
                        FROM public.patient_insurances pi
                        INNER JOIN public.insurance_providers ip ON ip.id= pi.insurance_provider_id
                        LEFT JOIN billing.insurance_provider_details ipd on ipd.insurance_provider_id = ip.id
                        LEFT JOIN public.patients p ON p.id= pi.patient_id
                        LEFT JOIN public.facilities f ON p.facility_id = f.id
                        WHERE
                            pi.patient_id = ${params.patient_id}
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
                            , pi.subscriber_city
                            , pi.subscriber_state
                            , pi.subscriber_zipcode
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
            , charges
            , auditDetails
            , is_alberta_billing
        } = params;

        const claimCreateFunction = is_alberta_billing
            ? `billing.can_ahs_create_claim_per_charge`
            : `billing.create_claim_charge`;

        const sql = SQL`SELECT `
            .append(claimCreateFunction)
            .append(SQL`(
                (${JSON.stringify(claims)})::jsonb,
                (${JSON.stringify(insurances)})::jsonb,
                (${JSON.stringify(claim_icds)})::jsonb,
                (${JSON.stringify(auditDetails)})::jsonb,
                (${JSON.stringify(charges)})::jsonb
            ) as result`);

        return await query(sql);
    },

    getClaimData: async (params) => {

        const {
            id
        } = params;

        const get_claim_sql = SQL`
                SELECT
                      c.id AS claim_id
                    , c.company_id
                    , c.facility_id
                    , c.patient_id
                    , c.billing_provider_id
                    , c.rendering_provider_contact_id
                    , c.referring_provider_contact_id
                    , c.primary_patient_insurance_id
                    , c.secondary_patient_insurance_id
                    , c.tertiary_patient_insurance_id
                    , c.ordering_facility_id
                    , c.place_of_service_id
                    , c.billing_code_id
                    , c.billing_class_id
                    , c.created_by
                    , c.billing_method
                    , c.billing_notes
                    , c.claim_dt::text
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
                    , c.accident_state
                    , c.service_by_outside_lab
                    , c.payer_type
                    , c.claim_status_id
                    , c.primary_patient_insurance_id
                    , c.secondary_patient_insurance_id
                    , c.tertiary_patient_insurance_id
                    , c.ordering_facility_id
                    , c.xmin as claim_row_version
                    , c.can_ahs_pay_to_code
                    , c.can_ahs_pay_to_uli
                    , c.can_ahs_pay_to_details
                    , c.can_ahs_business_arrangement
                    , c.can_ahs_locum_arrangement
                    , f.can_ahs_business_arrangement AS can_ahs_business_arrangement_facility
                    , rend_pc.can_ahs_locum_arrangement AS can_ahs_locum_arrangement_provider
                    , c.can_ahs_claimed_amount_indicator
                    , c.can_confidential
                    , c.can_ahs_newborn_code
                    , c.can_ahs_emsaf_reason
                    , c.can_ahs_paper_supporting_docs
                    , c.can_supporting_text
                    , cst.code AS claim_status_code
                    , p.account_no AS patient_account_no
                    , p.birth_date::text AS patient_dob
                    , p.full_name AS patient_name
                    , p.gender AS patient_gender
                    , (SELECT alt_account_no FROM patient_alt_accounts LEFT JOIN issuers i ON i.id = issuer_id WHERE patient_id = p.id AND i.issuer_type = 'uli_phn' AND province_alpha_2_code = 'ab' LIMIT 1) AS can_ahs_uli_phn
                    , get_patient_alerts_to_jsonb(p.id, TRUE) AS alerts
                    , p.patient_info
                    , ref_pr.full_name AS ref_prov_full_name
                    , ref_pr.provider_code AS ref_prov_code
                    , ref_pr.provider_info->'NPI' AS referring_prov_npi_no
                    , rend_pr.full_name AS reading_phy_full_name
                    , rend_pr.provider_info->'NPI' AS rendering_prov_npi_no
                    , pg.group_info->'AddressLine1' AS service_facility_addressLine1
                    , pg.group_info->'City' AS ordering_facility_city
                    , pg.group_name AS ordering_facility_name
                    , pg.group_info->'npi_no' AS ordering_facility_npi_no
                    , pg.group_info->'State' AS ordering_facility_state
                    , pg.group_info->'Zip' AS ordering_facility_zip
                    , ipp.insurance_info->'Address1' AS p_address1
                    , ipp.insurance_info->'PayerID' AS p_payer_id
                    , ipp.insurance_info->'City' AS p_city
                    , ipp.insurance_info->'PhoneNo' AS p_phone_no
                    , ipp.insurance_info->'State' AS p_state
                    , ipp.insurance_info->'ZipCode' AS p_zip
                    , ipp.insurance_name AS p_insurance_name
                    , ipp.insurance_code AS p_insurance_code
                    , (SELECT billing_method as p_billing_method FROM billing.insurance_provider_details WHERE insurance_provider_id = ipp.id)
                    , cpi.insurance_provider_id AS p_insurance_provider_id
                    , cpi.subscriber_zipcode AS p_subscriber_zipcode
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
                    , cpi.subscriber_city AS p_subscriber_city
                    , cpi.subscriber_state AS p_subscriber_state
                    , cpi.assign_benefits_to_patient AS p_assign_benefits_to_patient
                    , cpi.subscriber_dob::text AS p_subscriber_dob
                    , cpi.valid_from_date AS p_valid_from_date
                    , cpi.valid_to_date AS p_valid_to_date
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
                    , csi.subscriber_city AS s_subscriber_city
                    , csi.subscriber_state AS s_subscriber_state
                    , csi.assign_benefits_to_patient AS s_assign_benefits_to_patient
                    , csi.subscriber_dob::text AS s_subscriber_dob
                    , csi.valid_from_date AS s_valid_from_date
                    , csi.valid_to_date AS s_valid_to_date
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
                    , cti.subscriber_city AS t_subscriber_city
                    , cti.subscriber_state AS t_subscriber_state
                    , cti.assign_benefits_to_patient AS t_assign_benefits_to_patient
                    , cti.subscriber_dob::text AS t_subscriber_dob
                    , cti.valid_from_date AS t_valid_from_date
                    , cti.valid_to_date AS t_valid_to_date
                    , cti.medicare_insurance_type_code AS t_medicare_insurance_type_code
                    , f.facility_info -> 'npino' as npi_no
                    , f.facility_info -> 'federal_tax_id' as federal_tax_id
                    , f.facility_info -> 'enable_insurance_eligibility' as enable_insurance_eligibility
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
                            FROM billing.charges ch
                                INNER JOIN public.cpt_codes cpt ON ch.cpt_id = cpt.id
                                LEFT JOIN public.plan_benefits pb ON pb.cpt_id = cpt.id
                                LEFT JOIN billing.charges_studies chs ON chs.charge_id = ch.id
                            WHERE
                                claim_id = c.id
                                AND (
                                    pb.id IS NULL
                                    OR CURRENT_DATE BETWEEN pb.effective_date AND pb.end_date
                                )
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
                        SELECT json_agg(row_to_json(existing_insurance)) AS existing_insurance
                        FROM (
                            SELECT
                              pi.id
                            , ip.id AS insurance_provider_id
                            , ip.insurance_name
                            , ip.insurance_code
                            , ip.insurance_info->'partner_id' AS ins_partner_id
                            , pi.coverage_level
                        FROM public.patient_insurances pi
                        INNER JOIN public.insurance_providers ip ON ip.id = pi.insurance_provider_id
                        WHERE
                            pi.patient_id = c.patient_id
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
                                                'payer_name',provider_groups.group_name ,
                                                'payer_id',provider_groups.id,
                                                'payer_type_name',p1.payer_type
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
                                        LEFT JOIN provider_groups ON provider_groups.id= p1.provider_group_id
                                ) AS payer_details ON payer_details.id = p.id
                            ORDER BY p.id ASC
                        ) payment_details
                    ) AS payment_details
                    , c.area_of_injury_code_id
                    , c.nature_of_injury_code_id
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
                        LEFT JOIN public.providers rend_pr ON rend_pc.provider_id = rend_pr.id
                        LEFT JOIN public.provider_groups pg ON pg.id = c.ordering_facility_id
                        LEFT JOIN public.facilities f ON c.facility_id = f.id
                        LEFT JOIN billing.claim_status cst ON cst.id = c.claim_status_id
                    WHERE
                        c.id = ${id}`;

        return await query(get_claim_sql);
    },

    update: async function (args) {

        let {
            claims
            , insurances
            , claim_icds
            , charges
            , auditDetails } = args;


        const sqlQry = SQL`SELECT billing.update_claim_charge (
            (${JSON.stringify(claims)})::jsonb,
            (${JSON.stringify(insurances)})::jsonb,
            (${JSON.stringify(claim_icds)})::jsonb,
            (${JSON.stringify(auditDetails)})::jsonb,
            (${JSON.stringify(charges)})::jsonb) as result`;

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
        SELECT account_no, facility_info->'pokitdok_response' as filepath from public.patients p INNER JOIN public.facilities f on f.id = p.facility_id where p.id = ${params.patient_id} `;

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
                            FROM studies
                                LEFT JOIN orders ON orders.id=studies.order_id
                                INNER JOIN facilities ON studies.facility_id=facilities.id
                            WHERE
                                studies.deleted_dt IS NULL
                                AND study_dt IS NOT NULL
                                AND studies.patient_id = ${id}
                                AND NOT EXISTS ( SELECT 1 FROM billing.charges_studies WHERE study_id = studies.id )
                            ORDER BY id ASC
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
                            ,get_patient_alerts_to_jsonb(p.id, TRUE) AS alerts
                            ,f.id AS facility_id
                            ,fs.default_provider_id AS billing_provider_id
                            ,COALESCE(NULLIF(f.facility_info->'service_facility_id',''),'0')::numeric AS service_facility_id
                            ,COALESCE(NULLIF(f.facility_info->'rendering_provider_id',''),'0')::numeric AS rendering_provider_id
                            ,facility_info->'service_facility_name' as service_facility_name
                            ,fac_prov_cont.id AS rendering_provider_contact_id
                            ,fac_prov.full_name AS rendering_provider_full_name
                            ,f.place_of_service_id AS fac_place_of_service_id
                        FROM
                            patients p
                        INNER JOIN facilities f ON f.id = p.facility_id
                        LEFT JOIN provider_contacts fac_prov_cont ON f.facility_info->'rendering_provider_id'::text = fac_prov_cont.id::text
                        LEFT JOIN providers fac_prov ON fac_prov.id = fac_prov_cont.provider_id
                        LEFT JOIN billing.facility_settings fs ON fs.facility_id = p.facility_id
                        WHERE p.id = ${id}
                    ) AS patient_default_details
            ) patient_info `;

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
        let sql = SQL`WITH update_claim AS(
            UPDATE billing.claims
                SET
                primary_patient_insurance_id =
                    CASE ${payer_type}
                     WHEN 'primary_insurance' THEN NULL ELSE primary_patient_insurance_id
                    END,
                secondary_patient_insurance_id =
                    CASE ${payer_type}
                        WHEN 'secondary_insurance' THEN NULL ELSE secondary_patient_insurance_id
                    END,
                tertiary_patient_insurance_id =
                    CASE ${payer_type}
                        WHEN 'tertiary_insurance' THEN NULL ELSE tertiary_patient_insurance_id
                    END,
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
                                            'payer_name',provider_groups.group_name ,
                                            'payer_id',provider_groups.id,
                                            'payer_type_name',p1.payer_type
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
                                    LEFT JOIN provider_groups ON provider_groups.id= p1.provider_group_id
                            ) AS payer_details ON payer_details.id = p.id
                            LEFT JOIN LATERAL (
                                SELECT
                                    xmin,
                                    payer_type
                                FROM
                                    billing.claims c
                                WHERE c.id = ${id}
                            ) AS claim_details ON TRUE
                        ORDER BY p.id ASC
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
                    (	SELECT json_agg(row_to_json(claim_fee_details.*)) AS claim_fee_details FROM claim_fee_details
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
                    AND NOT sc.has_deleted
                    ORDER BY sc.study_id DESC `;

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
    }
};
