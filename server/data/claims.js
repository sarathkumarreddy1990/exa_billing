const { query, SQL } = require('./index');

module.exports = {

    getLineItemsDetails: async function (params) {

        const studyIds = params.study_ids.split('~').map(Number);

        let sql = SQL`
                     SELECT json_agg(row_to_json(charge)) "charges" FROM
                     (SELECT
                           sc.id AS study_cpt_id
                         , s.study_dt
                         , s.facility_id
                         , s.accession_no
                         , sc.study_id            
                         , sc.cpt_code
                         , COALESCE(sc.study_cpt_info->'modifiers1', '') AS m1
                         , COALESCE(sc.study_cpt_info->'modifiers2', '') AS m2
                         , COALESCE(sc.study_cpt_info->'modifiers3', '') AS m3
                         , COALESCE(sc.study_cpt_info->'modifiers4', '') AS m4
                         , string_to_array(regexp_replace(study_cpt_info->'diagCodes_pointer', '[^0-9,]', '', 'g'),',')::int[] AS icd_pointers
                         , COALESCE(sc.study_cpt_info->'bill_fee','1')::NUMERIC AS bill_fee
                         , COALESCE(sc.study_cpt_info->'allowed_fee','0')::NUMERIC AS allowed_fee
                         , COALESCE(sc.study_cpt_info->'units','1')::NUMERIC AS units
                         , ( COALESCE(sc.study_cpt_info->'bill_fee','0')::NUMERIC * COALESCE(sc.study_cpt_info->'units','1')::NUMERIC ) AS total_bill_fee
                         , ( COALESCE(sc.study_cpt_info->'allowed_fee','0')::NUMERIC * COALESCE(sc.study_cpt_info->'units','1')::NUMERIC ) AS total_allowed_fee
                         , sc.authorization_info->'authorization_no' AS authorization_no
                         , display_description
                         , additional_info
                         , sc.cpt_code_id
                     FROM study_cpt sc
                     LEFT JOIN studies s ON s.id = sc.study_id
                     INNER JOIN cpt_codes on sc.cpt_code_id = cpt_codes.id
                     WHERE study_id = ANY(${studyIds}) ORDER BY s.accession_no DESC
                     ) AS charge `;

        return await query(sql);
    },

    getPatientInsurances: async function (params) {

        const patient_insurance_query = SQL`
                                SELECT
                                    pi.id
                                  , ip.id AS insurance_provider_id
                                  , ip.insurance_name
                                  , ip.insurance_code
                                  , ip.insurance_info->'billingMethod' AS billing_method
                                  , ip.insurance_info->'City' AS ins_city
                                  , ip.insurance_info->'State' AS ins_state
                                  , ip.insurance_info->'ZipCode' AS ins_zip_code
                                  , ip.insurance_info->'Address1' AS ins_pri_address
                                  , pi.coverage_level
                                  , pi.subscriber_relationship_id   
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
                                FROM 
                                    patient_insurances pi
                                LEFT JOIN insurance_providers ip ON ip.id= pi.insurance_provider_id                                  
                            WHERE 
                                pi.patient_id = ${params.patient_id}
                        ORDER BY pi.id asc `;

        return await query(patient_insurance_query);
    },

    getPatientInsurancesById: async function (params) {

        let { id } = params;

        const patient_insurance_query = SQL`
                       SELECT
                                 pi.id
                               , ip.id AS insurance_provider_id
                               , ip.insurance_name
                               , ip.insurance_info->'billingMethod' AS billing_method
                               , ip.insurance_info->'City' AS ins_city
                               , ip.insurance_info->'State' AS ins_state
                               , ip.insurance_info->'ZipCode' AS ins_zip_code
                               , ip.insurance_info->'Address1' AS ins_pri_address
                               , ip.insurance_code
                               , pi.coverage_level
                               , pi.subscriber_relationship_id   
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
                           FROM 
                                patient_insurances pi
                           LEFT JOIN 
                               insurance_providers ip ON ip.id= pi.insurance_provider_id                                   
                           WHERE pi.id = ${id}  `;
        return await query(patient_insurance_query);
    },

    getMasterDetails: async function (params) {

        const biling_query = SQL`
                                 SELECT * FROM
                                 (
                                   SELECT json_agg(row_to_json(bpQuery)) "billingProvidersList" FROM
                                     (SELECT
                                             id
                                            ,name AS full_name
                                         FROM billing.providers
                                         WHERE company_id = ${params.company_id} AND inactivated_dt IS NULL ) AS bpQuery
                                 ) billingProvidersList
                                 ,(
                                     SELECT json_agg(row_to_json(posList)) "posList" FROM
                                         ( 
                                             SELECT 
                                                 id
                                                 ,code
                                                 ,description 
                                                FROM public.places_of_service 
                                             WHERE  company_id = ${params.company_id} AND inactivated_dt IS NULL 
                                         ) AS posList
                                  ) posList
                                  ,(
                                     SELECT json_agg(row_to_json(relations)) relationships FROM
                                         ( 
                                             SELECT 
                                                 id
                                                 ,description 
                                             FROM public.relationship_status 
                                             WHERE company_id = ${params.company_id} AND inactivated_dt IS NULL 
                                         ) AS relations
                                     ) relationships 
                                     , (
                                         SELECT json_agg(row_to_json(adjustment_code_list)) "adjustment_code_details" FROM(
                                         SELECT
                                              id, 
                                              code, 
                                              description, 
                                              accounting_entry_type 
                                         FROM
                                             billing.adjustment_codes 
                                         WHERE
                                              inactivated_dt IS NULL 
                                         ) AS adjustment_code_list
                                     ) adjustment_code_details `;

        return await query(biling_query);
    },
    
    save: async function(params){
       
        let {
            claims
            , insurances
            , claim_icds
        } = params;

        const claim_sql = SQL`
        WITH save_patient_insurances AS  (
            INSERT INTO patient_insurances (
                      patient_id
                    , insurance_provider_id
                    , subscriber_zipcode
                    , subscriber_relationship_id
                    , coverage_level
                    , policy_number
                    , group_number
                    , subscriber_employment_status_id
                    , subscriber_firstname
                    , subscriber_lastname
                    , subscriber_middlename
                    , subscriber_name_suffix
                    , subscriber_gender
                    , subscriber_address_line1
                    , subscriber_address_line2
                    , subscriber_city
                    , subscriber_state
                    , assign_benefits_to_patient
                    , subscriber_dob
                    , valid_from_date
                    , valid_to_date
                    , medicare_insurance_type_code
            ) 
            SELECT
                    patient_id
                    , insurance_provider_id
                    , subscriber_zipcode
                    , subscriber_relationship_id
                    , coverage_level
                    , policy_number
                    , group_number
                    , subscriber_employment_status_id
                    , subscriber_firstname
                    , subscriber_lastname
                    , subscriber_middlename
                    , subscriber_name_suffix
                    , subscriber_gender
                    , subscriber_address_line1
                    , subscriber_address_line2
                    , subscriber_city
                    , subscriber_state
                    , assign_benefits_to_patient
                    , subscriber_dob
                    , now()
                    , now() + interval '1 month'
                    , medicare_insurance_type_code
            FROM
                 json_to_recordset(${JSON.stringify(insurances)}) AS insurances (
                      patient_id bigint
                    , insurance_provider_id bigint 
                    , subscriber_zipcode bigint
                    , subscriber_relationship_id bigint
                    , coverage_level text 
                    , policy_number text 
                    , group_number text
                    , subscriber_employment_status_id bigint 
                    , subscriber_firstname text 
                    , subscriber_lastname text 
                    , subscriber_middlename text
                    , subscriber_name_suffix text
                    , subscriber_gender text 
                    , subscriber_address_line1 text
                    , subscriber_address_line2 text
                    , subscriber_city text
                    , subscriber_state text
                    , assign_benefits_to_patient boolean  
                    , subscriber_dob date  
                    , valid_from_date date
                    , valid_to_date date
                    , medicare_insurance_type_code bigint ) RETURNING id, coverage_level
        ),
        save_claim AS (
            INSERT INTO  billing.claims (
                      company_id
                    , facility_id
                    , patient_id
                    , billing_provider_id
                    , place_of_service_id
                    , billing_code_id
                    , billing_class_id
                    , created_by
                    , billing_method
                    , billing_notes
                    , claim_dt
                    , current_illness_date
                    , same_illness_first_date
                    , unable_to_work_from_date
                    , unable_to_work_to_date
                    , hospitalization_from_date
                    , hospitalization_to_date
                    , claim_notes
                    , original_reference
                    , authorization_no
                    , frequency
                    , is_auto_accident
                    , is_other_accident
                    , is_employed
                    , service_by_outside_lab
                    , payer_type
                    , claim_status_id
                    , primary_patient_insurance_id
                    , secondary_patient_insurance_id
                    , tertiary_patient_insurance_id
                    , ordering_facility_id
                    , referring_provider_contact_id
            )
            values(
                      ${claims.company_id}
                    , ${claims.facility_id}
                    , ${claims.patient_id}
                    , ${claims.billing_provider_id}
                    , ${claims.place_of_service_id}
                    , ${claims.billing_code_id}
                    , ${claims.billing_class_id}
                    , ${claims.created_by}
                    , ${claims.billing_method}
                    , ${claims.billing_notes}
                    , ${claims.claim_dt}
                    , ${claims.current_illness_date}
                    , ${claims.same_illness_first_date}
                    , ${claims.unable_to_work_from_date}
                    , ${claims.unable_to_work_to_date}
                    , ${claims.hospitalization_from_date}
                    , ${claims.hospitalization_to_date}
                    , ${claims.claim_notes}
                    , ${claims.original_reference}
                    , ${claims.authorization_no}
                    , ${claims.frequency}
                    , ${claims.is_auto_accident}
                    , ${claims.is_other_accident}
                    , ${claims.is_employed}
                    , ${claims.service_by_outside_lab}
                    , ${claims.payer_type}
                    , ${claims.claim_status_id}
                    ,(SELECT id FROM save_patient_insurances WHERE coverage_level = 'primary')
                    ,(SELECT id FROM save_patient_insurances WHERE coverage_level = 'secondary')
                    ,(SELECT id FROM save_patient_insurances WHERE coverage_level = 'tertiary')
                    ,${claims.ordering_facility_id}::bigint
                    ,${claims.referring_provider_contact_id}::bigint
                      
            ) RETURNING id
        )
       ,
        save_claim_icds AS (
            INSERT INTO billing.claim_icds (
                      claim_id 
                    , icd_id 
            )
            SELECT
                    ( SELECT id FROM save_claim )
                    , icd_id 
            FROM
                json_to_recordset(${JSON.stringify(claim_icds)}) AS icds (
                      icd_id bigint 
                )
        )
        SELECT * FROM save_claim `;
        return await query(claim_sql);
    },

    saveCharges: async function(params){

        const charge_sql=SQL`
                    WITH save_charges AS (
                         INSERT INTO billing.charges (
                                    claim_id     
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
                                  , authorization_no
                         )
                         values ( 
                                  ${params.claim_id}
                                 ,${params.cpt_id}
                                 ,${params.modifier1_id}
                                 ,${params.modifier2_id}
                                 ,${params.modifier3_id}
                                 ,${params.modifier4_id}
                                 ,${params.bill_fee}
                                 ,${params.allowed_amount}
                                 ,${params.units}
                                 ,${params.created_by}
                                 ,${params.charge_dt}
                                 ,${params.pointer1}
                                 ,${params.pointer2}
                                 ,${params.pointer3}
                                 ,${params.pointer4}
                                 ,${params.authorization_no}
                         ) RETURNING billing.charges.id
                     )
                     , save_charge_study AS (
                         INSERT INTO billing.charges_studies (
                             charge_id
                           , study_id
                         )
                         values(
                             (SELECT id FROM save_charges )
                             ,${params.study_id}
                         )
                     )
                     select * from save_charges `;

        return await query(charge_sql);
    },

    getClaimData: async (params) => {

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
                    , p.account_no AS patient_account_no
                    , p.birth_date::text AS patient_dob
                    , p.full_name AS patient_full_name
                    , ref_pr.full_name AS ref_prov_full_name
                    , ref_pr.provider_code AS ref_prov_code
                    , ref_pr.provider_info->'NPI' AS referring_prov_npi_no
                    , rend_pr.full_name AS reading_phy_full_name
                    , rend_pr.provider_info->'NPI' AS rendering_prov_npi_no
                    , pg.group_info->'AddressLine1' AS service_facility_addressLine1
                    , pg.group_info->'City' AS service_facility_city
                    , pg.group_name AS service_facility_name
                    , pg.group_info->'npi_no' AS service_facility_npi_no
                    , pg.group_info->'State' AS service_facility_state
                    , pg.group_info->'Zip' AS service_facility_zip
                    , ipp.insurance_info->'Address1' AS p_address1
                    , ipp.insurance_info->'PayerID' AS p_payer_id
                    , ipp.insurance_info->'City' AS p_city
                    , ipp.insurance_info->'State' AS p_state
                    , ipp.insurance_info->'ZipCode' AS p_zip
                    , ipp.insurance_name AS p_insurance_name
                    , COALESCE(ipp.insurance_info->'billingMethod','') AS p_billing_method
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
                    , COALESCE(ips.insurance_info->'billingMethod','') AS s_billing_method
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
                    , COALESCE(ipt.insurance_info->'billingMethod','') AS t_billing_method
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
                            FROM billing.charges ch 
                                INNER JOIN public.cpt_codes cpt ON ch.cpt_id = cpt.id 
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
                    
                       WHERE 
                        c.id = ${params.id}`;

        return await query(get_claim_sql);
    },

    update: async (args) => {
        console.log('----',args)
        const insurances = args.insurances;
        const claim_icds = JSON.stringify(args.claim_icds);
        const claim = (args.claims);
        const sqlQry = SQL`
        WITH insurance_details AS (
                  SELECT
                    patient_id
                  , insurance_provider_id
                  , subscriber_zipcode
                  , subscriber_relationship_id
                  , coverage_level
                  , policy_number
                  , group_number
                  , subscriber_employment_status_id
                  , subscriber_firstname
                  , subscriber_lastname
                  , subscriber_middlename
                  , subscriber_name_suffix
                  , subscriber_gender
                  , subscriber_address_line1
                  , subscriber_address_line2
                  , subscriber_city
                  , subscriber_state
                  , assign_benefits_to_patient
                  , subscriber_dob
                  , medicare_insurance_type_code
                  , claim_insurance_id
                  , is_deleted
                  , valid_from_date
                  , valid_to_date
            FROM
                json_to_recordset(${JSON.stringify(insurances)}) AS insurances (
                   patient_id bigint
                 , insurance_provider_id bigint 
                 , subscriber_zipcode bigint
                 , subscriber_relationship_id bigint
                 , coverage_level text 
                 , policy_number text 
                 , group_number text
                 , subscriber_employment_status_id bigint 
                 , subscriber_firstname text 
                 , subscriber_lastname text 
                 , subscriber_middlename text
                 , subscriber_name_suffix text
                 , subscriber_gender text 
                 , subscriber_address_line1 text
                 , subscriber_address_line2 text
                 , subscriber_city text
                 , subscriber_state text
                 , assign_benefits_to_patient boolean  
                 , subscriber_dob date  
                 , medicare_insurance_type_code bigint
                 , claim_insurance_id bigint
                 , is_deleted boolean 
                 , valid_from_date date
                 , valid_to_date date )
        ),
        save_insurance AS (
                INSERT INTO patient_insurances (
                    patient_id
                  , insurance_provider_id
                  , subscriber_zipcode
                  , subscriber_relationship_id
                  , coverage_level
                  , policy_number
                  , group_number
                  , subscriber_employment_status_id
                  , subscriber_firstname
                  , subscriber_lastname
                  , subscriber_middlename
                  , subscriber_name_suffix
                  , subscriber_gender
                  , subscriber_address_line1
                  , subscriber_address_line2
                  , subscriber_city
                  , subscriber_state
                  , assign_benefits_to_patient
                  , subscriber_dob
                  , medicare_insurance_type_code
                  , valid_from_date
                  , valid_to_date
            )
            SELECT
                      patient_id
                    , insurance_provider_id
                    , subscriber_zipcode
                    , subscriber_relationship_id
                    , coverage_level
                    , policy_number
                    , group_number
                    , subscriber_employment_status_id
                    , subscriber_firstname
                    , subscriber_lastname
                    , subscriber_middlename
                    , subscriber_name_suffix
                    , subscriber_gender
                    , subscriber_address_line1
                    , subscriber_address_line1
                    , subscriber_city
                    , subscriber_state
                    , assign_benefits_to_patient
                    , subscriber_dob
                    , medicare_insurance_type_code
                    , now()
                    , now() + interval '1 month'
            FROM
                insurance_details
            WHERE
                claim_insurance_id IS NULL
                AND NOT is_deleted
                RETURNING id, coverage_level
        ),
        update_insurance AS (
                    UPDATE
                        patient_insurances
                    SET
                      insurance_provider_id = ins.insurance_provider_id
                    , subscriber_zipcode = ins.subscriber_zipcode
                    , subscriber_relationship_id = ins.subscriber_relationship_id
                    , coverage_level = ins.coverage_level
                    , policy_number = ins.policy_number
                    , group_number = ins.group_number
                    , subscriber_employment_status_id = ins.subscriber_employment_status_id
                    , subscriber_firstname = ins.subscriber_firstname
                    , subscriber_lastname = ins.subscriber_lastname
                    , subscriber_middlename = ins.subscriber_middlename
                    , subscriber_name_suffix = ins.subscriber_name_suffix
                    , subscriber_gender = ins.subscriber_gender
                    , subscriber_address_line1 = ins.subscriber_address_line1
                    , subscriber_address_line2 = ins.subscriber_address_line2
                    , subscriber_city = ins.subscriber_city
                    , subscriber_state = ins.subscriber_state
                    , assign_benefits_to_patient = ins.assign_benefits_to_patient
                    , subscriber_dob = ins.subscriber_dob
                    , medicare_insurance_type_code = ins.medicare_insurance_type_code
            FROM
                insurance_details ins
            WHERE
                ins.claim_insurance_id = patient_insurances.id
                AND ins.claim_insurance_id IS NOT NULL
                AND NOT is_deleted
        ),
        insurance_deletion AS (
            DELETE FROM 
                patient_insurances 
            USING insurance_details ins
            WHERE 
                patient_insurances.id = ins.claim_insurance_id
                AND ins.claim_insurance_id IS NOT NULL
                AND is_deleted
        ),
        icd_details AS (
            SELECT
                      id
                    , claim_id
                    , icd_id
                    , is_deleted
                    
            FROM
                json_to_recordset(${claim_icds}) AS x (
                      id bigint
                    , claim_id bigint
                    , icd_id bigint
                    , is_deleted boolean
                )
        ),
        icd_insertion AS (
            INSERT INTO billing.claim_icds (
                      claim_id
                    , icd_id
            )
            (   SELECT
                      claim_id
                    , icd_id
                FROM
                    icd_details
                WHERE
                    id IS NULL
                    AND  NOT is_deleted
            ) RETURNING billing.claim_icds.id, billing.claim_icds.icd_id
        ),
        update_icds AS (
            DELETE FROM
                billing.claim_icds
            USING icd_details icd
            WHERE
                 billing.claim_icds.id = icd.id
                AND billing.claim_icds.icd_id = icd.icd_id
                AND  icd.is_deleted
                AND  icd.id is NOT NULL  RETURNING billing.claim_icds.id
        ),
        update_claim_header AS (
            UPDATE
                billing.claims
            SET
                  facility_id = ${ claim.facility_id}
                , billing_provider_id = ${ claim.billing_provider_id}
                , rendering_provider_contact_id = ${ claim.rendering_provider_contact_id}
                , referring_provider_contact_id = ${ claim.referring_provider_contact_id}
                , ordering_facility_id = ${ claim.ordering_facility_id}
                , place_of_service_id = ${ claim.place_of_service_id}
                , claim_status_id = ${ claim.claim_status_id}
                , billing_code_id = ${ claim.billing_code_id}
                , billing_class_id = ${ claim.billing_class_id}
                , billing_method = ${ claim.billing_method}
                , billing_notes = ${ claim.billing_notes}
                , current_illness_date = ${ claim.current_illness_date}
                , same_illness_first_date = ${ claim.same_illness_first_date}
                , unable_to_work_from_date = ${ claim.unable_to_work_from_date}
                , unable_to_work_to_date = ${ claim.unable_to_work_to_date}
                , hospitalization_from_date = ${ claim.hospitalization_from_date}
                , hospitalization_to_date = ${ claim.hospitalization_to_date}
                , claim_notes = ${ claim.claim_notes}
                , original_reference = ${ claim.original_reference}
                , authorization_no = ${ claim.authorization_no}
                , frequency = ${ claim.claim_frequency}
                , is_auto_accident = ${ claim.is_auto_accident}
                , is_other_accident = ${ claim.is_other_accident}
                , is_employed = ${ claim.is_employed}
                , service_by_outside_lab = ${ claim.service_by_outside_lab}
            WHERE
                billing.claims.id = ${ claim.claim_id}
        )
        
        SELECT * FROM save_insurance `;

        return await query(sqlQry);
       

    }
};
