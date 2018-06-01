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
                     WHERE study_id = ANY(${studyIds}) AND sc.cpt_code_id > 0  ORDER BY s.accession_no DESC
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
                    ,( SELECT CASE WHEN 'primary_insurance' =  ${claims.payer_type} THEN (SELECT id FROM save_patient_insurances WHERE coverage_level = 'primary')
                        ELSE NULL
                        END )
                    ,( SELECT CASE WHEN 'secondary_insurance' =  ${claims.payer_type} THEN (SELECT id FROM save_patient_insurances WHERE coverage_level = 'secondary')
			    	    ELSE NULL
                    END )
                    ,( SELECT CASE WHEN 'tertiary_insurance' =  ${claims.payer_type} THEN (SELECT id FROM save_patient_insurances WHERE coverage_level = 'tertiary')
			    	    ELSE NULL
                        END )
                    ,( SELECT CASE WHEN 'ordering_facility' =  ${claims.payer_type} THEN  ${claims.ordering_facility_id}::bigint
			    	    ELSE NULL
                        END )    
                    ,( SELECT CASE WHEN 'referring_provider' =  ${claims.payer_type} THEN ${claims.referring_provider_contact_id}::bigint
			    	    ELSE NULL
                        END )    
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
    }
};
