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

        let sql = SQL`SELECT * FROM (
            SELECT json_agg(row_to_json(charge)) "charges" 
                      FROM (SELECT
                                  sc.id AS study_cpt_id
                                , s.study_dt
                                , s.facility_id
                                , s.accession_no
                                , sc.study_id            
                                , sc.cpt_code
                                , atp.modifier1_id AS m1
                                , atp.modifier2_id AS m2
                                , atp.modifier3_id AS m3
                                , atp.modifier4_id AS m4
                                , string_to_array(regexp_replace(study_cpt_info->'diagCodes_pointer', '[^0-9,]', '', 'g'),',')::int[] AS icd_pointers
                                , COALESCE(sc.study_cpt_info->'bill_fee','1')::NUMERIC AS bill_fee
                                , COALESCE(sc.study_cpt_info->'allowed_fee','0')::NUMERIC AS allowed_fee
                                , COALESCE(sc.study_cpt_info->'units','1')::NUMERIC AS units
                                , (COALESCE(sc.study_cpt_info->'bill_fee','0')::NUMERIC * COALESCE(sc.study_cpt_info->'units','1')::NUMERIC) AS total_bill_fee
                                , (COALESCE(sc.study_cpt_info->'allowed_fee','0')::NUMERIC * COALESCE(sc.study_cpt_info->'units','1')::NUMERIC) AS total_allowed_fee
                                , sc.authorization_info->'authorization_no' AS authorization_no
                                , display_description
                                , additional_info
                                , sc.cpt_code_id AS cpt_id
                                , ARRAY( SELECT icd_codes.id||'~'|| code ||'~'|| icd_codes.description FROM public.icd_codes WHERE id = ANY(o.icd_code_ids_billing) ) as icd_codes_billing
				                , o.icd_code_ids_billing as icd_codes_billing_order 
                            FROM public.study_cpt sc
                            INNER JOIN public.studies s ON s.id = sc.study_id
                            INNER JOIN public.cpt_codes on sc.cpt_code_id = cpt_codes.id
                            INNER JOIN public.orders o on o.id = s.order_id
                            INNER JOIN appointment_types at ON at.id = s.appointment_type_id
                            INNER JOIN appointment_type_procedures atp ON atp.procedure_id = sc.cpt_code_id
                            WHERE
                                study_id = ANY(${studyIds})
                            ORDER BY s.accession_no DESC
                            ) AS charge
                        ) charge_details
                            ,(
                                SELECT json_agg(row_to_json(claim_default_details)) "claim_details" FROM
                                    (SELECT
                                        facility_id,
                                        order_info->'currentDate' AS current_illness_date,
                                        order_info->'similarIll' AS same_illness_first_date,
                                        order_info->'wTo' AS unable_to_work_to_date,
                                        order_info->'wFrom' AS unable_to_work_from_date,
                                        order_info->'hTo' AS hospitalization_to_dt,
                                        order_info->'hFrom' AS hospitalization_from_date,
                                        order_info->'claim_notes' AS claim_notes,
                                        COALESCE(NULLIF(order_info->'outsideLab',''), 'false')::boolean AS service_by_outside_lab,
                                        order_info->'original_ref' AS original_reference,
                                        order_info->'authorization_no' AS authorization_no,
                                        order_info->'frequency_code' AS frequency,
                                        COALESCE(NULLIF(order_info->'oa',''), 'false')::boolean AS is_other_accident,
                                        COALESCE(NULLIF(order_info->'aa',''), 'false')::boolean AS is_auto_accident,
                                        COALESCE(NULLIF(order_info->'emp',''), 'false')::boolean AS is_employed,
                                        order_info -> 'rendering_provider_id' AS rendering_provider_contact_id,
                                        order_info -> 'claim_status' AS claim_status,
                                        order_info->'billing_code' AS billing_code,
                                        order_info->'billing_class' AS billing_class,
                                        orders.referring_providers [ 1 ] AS ref_prov_full_name,
                                        referring_provider_ids [ 1 ] AS referring_provider_contact_id,
                                        (   SELECT
                                                    studies.study_info->'refDescription'
                                            FROM
                                                    studies
                                            WHERE
                                                studies.order_id IN (SELECT order_id FROM public.studies s WHERE s.id = ${firstStudyId})
                                            ORDER BY studies.order_id DESC LIMIT 1 ) AS
                                        referring_pro_study_desc,
                                        providers.full_name AS reading_phy_full_name,
                                        order_info -> 'ordering_facility_id' AS ordering_facility_id,
                                        order_info -> 'ordering_facility' AS ordering_facility_name,
                                        order_info -> 'pos' AS pos_type,
                                        orders.order_status AS order_status, (
                                            SELECT
                                                claim_status
                                            FROM
                                                claims
                                            WHERE
                                                order_id = orders.id
                                                AND (claims.has_expired != 'true' OR has_expired IS NULL)
                                                ORDER BY
                                                id DESC
                                                LIMIT 1
                                                ) AS claim_status,
                                        order_info -> 'billing_provider' AS billing_provider_id,
                                        order_info -> 'pos_type_code' AS pos_type_code
                                    FROM
                                        orders
                                    LEFT JOIN provider_contacts ON COALESCE (NULLIF (order_info -> 'rendering_provider_id',''),'0') = provider_contacts.id::text
                                    LEFT JOIN providers ON providers.id = provider_contacts.provider_id
                                    WHERE orders.id IN (SELECT order_id FROM public.studies s WHERE s.id = ${firstStudyId})
                                    ) AS claim_default_details
                            ) claims_info `;

        return await query(sql);
    },

    getPatientInsurances: async function (params) {

        const sql = SQL`WITH 
                beneficiary_details as (
                        SELECT
                              pi.id
                            , ip.id AS insurance_provider_id
                            , ip.insurance_name
                            , ip.insurance_info->'City' AS ins_city
                            , ip.insurance_info->'State' AS ins_state
                            , ip.insurance_info->'ZipCode' AS ins_zip_code
                            , ip.insurance_info->'Address1' AS ins_pri_address
                            , ip.insurance_code
                            , pi.coverage_level
                            , pi.subscriber_relationship_id   
                            , pi.valid_from_date
                            , pi.valid_to_date
                            , pi.subscriber_employment_status_id                     
                            , pi.subscriber_dob
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
                                patient_id = ${params.patient_id} AND valid_to_date >= (${params.claim_date})::date 
                                GROUP BY coverage_level 
                        ) as expiry ON TRUE                           
                        WHERE 
                            pi.patient_id = ${params.patient_id}  AND expiry.valid_to_date = pi.valid_to_date AND expiry.coverage_level = pi.coverage_level 
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
                            , pi.coverage_level
                            , pi.subscriber_relationship_id   
                            , pi.valid_from_date
                            , pi.valid_to_date
                            , pi.subscriber_employment_status_id                     
                            , pi.subscriber_dob
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
                  ) AS existing_insurance `;

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
                            , ip.insurance_code
                            , pi.coverage_level
                            , pi.subscriber_relationship_id 
                            , pi.valid_from_date  
                            , pi.valid_to_date
                            , pi.subscriber_employment_status_id                     
                            , pi.subscriber_dob
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
            , auditDetails } = params;


        const sql = SQL`SELECT billing.create_claim_charge (
                    (${JSON.stringify(claims)})::json,
                    (${JSON.stringify(insurances)})::json,
                    (${JSON.stringify(claim_icds)})::json,
                    (${JSON.stringify(auditDetails)})::json,
                    (${JSON.stringify(charges)})::json) as result `;

        return await query(sql);
    },

    saveCharges: async function (params) {

        const sql = SQL`WITH save_charges AS (
                                INSERT INTO billing.charges 
                                    ( claim_id     
                                    , cpt_id
                                    , modifier1_id
                                    , modifier2_id
                                    , modifier3_id
                                    , modifier4_id
                                    , bill_fee
                                    , allowed_amount
                                    , units
                                    , created_by
                                    , charge_dt
                                    , pointer1
                                    , pointer2
                                    , pointer3
                                    , pointer4
                                    , authorization_no)
                                values 
                                    ( ${params.claim_id}
                                    , ${params.cpt_id}
                                    , ${params.modifier1_id}
                                    , ${params.modifier2_id}
                                    , ${params.modifier3_id}
                                    , ${params.modifier4_id}
                                    , ${params.bill_fee}
                                    , ${params.allowed_amount}
                                    , ${params.units}
                                    , ${params.created_by}
                                    , ${params.charge_dt}
                                    , ${params.pointer1}
                                    , ${params.pointer2}
                                    , ${params.pointer3}
                                    , ${params.pointer4}
                                    , ${params.authorization_no}
                                ) RETURNING billing.charges.id
                            ), 
                            save_charge_study AS (
                                    INSERT INTO billing.charges_studies
                                        ( charge_id
                                        , study_id )
                                    SELECT
                                    (SELECT id FROM save_charges )
                                    , ${params.study_id}
                            ) select * from save_charges `;

        return await query(sql);
    },

    saveChargesOnly: async function (params) {

        const sql = SQL`INSERT INTO billing.charges 
                                    ( claim_id     
                                    , cpt_id
                                    , modifier1_id
                                    , modifier2_id
                                    , modifier3_id
                                    , modifier4_id
                                    , bill_fee
                                    , allowed_amount
                                    , units
                                    , created_by
                                    , charge_dt
                                    , pointer1
                                    , pointer2
                                    , pointer3
                                    , pointer4
                                    , authorization_no)
                                values 
                                    ( ${params.claim_id}
                                    , ${params.cpt_id}
                                    , ${params.modifier1_id}
                                    , ${params.modifier2_id}
                                    , ${params.modifier3_id}
                                    , ${params.modifier4_id}
                                    , ${params.bill_fee}
                                    , ${params.allowed_amount}
                                    , ${params.units}
                                    , ${params.created_by}
                                    , ${params.charge_dt}
                                    , ${params.pointer1}
                                    , ${params.pointer2}
                                    , ${params.pointer3}
                                    , ${params.pointer4}
                                    , ${params.authorization_no}
                                ) `;

        return await query(sql);
    },

    getClaimData: async (params) => {

        const {
            id
        } = params;

        const get_claim_sql = SQL`
                SELECT 
                      c.company_id
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
                    , c.claim_dt
                    , c.current_illness_date
                    , c.same_illness_first_date
                    , c.unable_to_work_from_date
                    , c.unable_to_work_to_date
                    , c.hospitalization_from_date
                    , c.hospitalization_to_date
                    , c.claim_notes
                    , c.original_reference
                    , c.authorization_no
                    , c.frequency
                    , c.is_auto_accident
                    , c.is_other_accident
                    , c.is_employed
                    , c.service_by_outside_lab
                    , c.payer_type
                    , c.claim_status_id
                    , c.primary_patient_insurance_id
                    , c.secondary_patient_insurance_id
                    , c.tertiary_patient_insurance_id
                    , c.ordering_facility_id
                    , c.referring_provider_contact_id
                    , c.xmin as claim_row_version
                    , p.account_no AS patient_account_no
                    , p.birth_date::text AS patient_dob
                    , p.full_name AS patient_full_name
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
                    , ipp.insurance_info->'State' AS p_state
                    , ipp.insurance_info->'ZipCode' AS p_zip
                    , ipp.insurance_name AS p_insurance_name
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
                    , cpi.subscriber_dob AS p_subscriber_dob
                    , cpi.valid_from_date AS p_valid_from_date
                    , cpi.valid_to_date AS p_valid_to_date
                    , cpi.medicare_insurance_type_code AS p_medicare_insurance_type_code
                    , ips.insurance_info->'Address1' AS s_address1
                    , ips.insurance_info->'PayerID' AS s_payer_id
                    , ips.insurance_info->'City' AS s_city
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
                    , csi.subscriber_dob AS s_subscriber_dob
                    , csi.valid_from_date AS s_valid_from_date
                    , csi.valid_to_date AS s_valid_to_date
                    , csi.medicare_insurance_type_code AS s_medicare_insurance_type_code
                    , ipt.insurance_info->'Address1' AS t_address1
                    , ipt.insurance_info->'PayerID' AS t_payer_id
                    , ipt.insurance_info->'City' AS t_city
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
                    , cti.subscriber_dob AS t_subscriber_dob
                    , cti.valid_from_date AS t_valid_from_date
                    , cti.valid_to_date AS t_valid_to_date
                    , cti.medicare_insurance_type_code AS t_medicare_insurance_type_code
                    , f.facility_info -> 'npino' as npi_no
                    , f.facility_info -> 'federal_tax_id' as federal_tax_id
                    , f.facility_info -> 'enable_insurance_eligibility' as enable_insurance_eligibility
                    , (
                        SELECT array_agg(row_to_json(pointer)) AS claim_charges 
                        FROM (
                            SELECT 
                                  ch.id 
                                , claim_id
                                , cpt_id
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
                                , ch.allowed_amount::numeric as allowed_fee
                                , ch.authorization_no
                                , (ch.units * ch.bill_fee)::numeric as total_bill_fee
                                , (ch.units * ch.allowed_amount)::numeric as total_allowed_fee
                                , chs.study_id
                                , (SELECT EXISTS (SELECT * FROM billing.payment_applications WHERE charge_id = ch.id )) as payment_exists
                            FROM billing.charges ch 
                                INNER JOIN public.cpt_codes cpt ON ch.cpt_id = cpt.id 
                                LEFT JOIN billing.charges_studies chs ON chs.charge_id = ch.id
                            WHERE claim_id = c.id 
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
                                , icd.is_active
                            FROM billing.claim_icds ci 
                            INNER JOIN public.icd_codes icd ON ci.icd_id = icd.id 
                            WHERE claim_id = c.id
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
                        LEFT JOIN public.facilities f ON p.facility_id = f.id
                    WHERE 
                        c.id = ${id}`;

        return await query(get_claim_sql);
    },

    update: async function (args) {

        let self = this;
        let result;
        let {
            claims
            , insurances
            , claim_icds
            , charges
            , auditDetails} = args;


        const sqlQry = SQL`SELECT billing.update_claim_charge (
            (${JSON.stringify(claims)})::json,
            (${JSON.stringify(insurances)})::json,
            (${JSON.stringify(claim_icds)})::json,
            (${JSON.stringify(auditDetails)})::json,
            (${JSON.stringify(charges)})::json) as result`;
            
        if (claims.payer_type == 'patient') {

            await self.updateIns_claims(claims);
            result = await query(sqlQry);

        } else {

            await query(sqlQry);
            result = await self.updateIns_claims(claims);
        }

        return result;
    },

    updateIns_claims: async (params) => {

        let sqlQry = SQL`
        UPDATE
            billing.claims
        SET
          payer_type = ${params.payer_type}
        WHERE
            billing.claims.id = ${params.claim_id} 
        RETURNING id    `;

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

        const sql = SQL`SELECT
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
                            studies.has_deleted=False AND studies.patient_id = ${id}
                            AND NOT EXISTS ( SELECT 1 FROM billing.charges_studies WHERE study_id = studies.id )
                        ORDER BY id ASC `;

        return await query(sql);

    }
};
