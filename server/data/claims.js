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
                               , lower(pi.coverage_level) as coverage_level
                               , pi.subscriber_relationship                        
                               , ip.insurance_code
                               , pi.subscriber_info->'ExpireDate' as ExpireDate
                           FROM 
                               patient_insuarances pi
                           LEFT JOIN 
                               insurance_providers ip ON ip.id= pi.insurance_provider_id                                   
                           WHERE 
                               pi.has_deleted=False
                               AND pi.patient_id = ${params.patient_id}
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
                               , lower(pi.coverage_level) as coverage_level
                               , ip.insurance_code
                               , pi.subscriber_relationship_id   
                               , pi.subscriber_info->'ExpireDate' as ExpireDate
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
                               patient_insuarances pi
                           LEFT JOIN 
                               insurance_providers ip ON ip.id= pi.insurance_provider_id                                   
                           WHERE 
                               pi.has_deleted=False
                               AND pi.id = ${id}  `;
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
        const claim = (params.claims);
        const claim_insurances = JSON.stringify(params.insurances);
        const claim_charges = JSON.stringify(params.charges);
        const claim_icds = JSON.stringify(params.claim_icds);

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
                    , 11
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
                 json_to_recordset(${claim_insurances}) AS insurances (
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
                      ${ claim.company_id}
                    , ${ claim.facility_id}
                    , ${ claim.patient_id}
                    , ${ claim.billing_provider_id}
                    , ${ claim.place_of_service_id}
                    , ${ claim.billing_code_id}
                    , ${ claim.billing_class_id}
                    , ${ claim.created_by}
                    , ${ claim.billing_method}
                    , ${ claim.billing_notes}
                    , ${ claim.claim_dt}
                    , ${ claim.current_illness_date}
                    , ${ claim.same_illness_first_date}
                    , ${ claim.unable_to_work_from_date}
                    , ${ claim.unable_to_work_to_date}
                    , ${ claim.hospitalization_from_date}
                    , ${ claim.hospitalization_to_date}
                    , ${ claim.claim_notes}
                    , ${ claim.original_reference}
                    , ${ claim.authorization_no}
                    , ${ claim.frequency}
                    , ${ claim.is_auto_accident}
                    , ${ claim.is_other_accident}
                    , ${ claim.is_employed}
                    , ${ claim.service_by_outside_lab}
                    , ${ claim.payer_type}
                    , 2
                    ,( SELECT CASE WHEN 'primary_insurance' =  ${claim.payer_type} THEN (SELECT id FROM save_patient_insurances WHERE coverage_level = 'primary')
                        ELSE NULL
                        END )
                    ,(SELECT CASE WHEN 'secondary_insurance' =  ${claim.payer_type} THEN (SELECT id FROM save_patient_insurances WHERE coverage_level = 'secondary')
			    	    ELSE NULL
                        END )
                     ,(SELECT CASE WHEN 'tertiary_insurance' =  ${claim.payer_type} THEN (SELECT id FROM save_patient_insurances WHERE coverage_level = 'tertiary')
			    	    ELSE NULL
                        END )
                     ,(SELECT CASE WHEN 'ordering_facility' =  ${claim.payer_type} THEN  ${claim.ordering_facility_id}::bigint
			    	    ELSE NULL
                        END )    
                     ,(SELECT CASE WHEN 'referring_provider' =  ${claim.payer_type} THEN ${claim.referring_provider_contact_id}::bigint
			    	    ELSE NULL
                        END )    
            ) RETURNING id
        )
       , charge_details AS (
            SELECT
                 ( SELECT id FROM save_claim )::bigint as claim_id
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
                 , study_id
            FROM
                json_to_recordset((${claim_charges})) AS charge (
                  claim_id bigint
                , cpt_id bigint
                , modifier1_id bigint
                , modifier2_id bigint
                , modifier3_id bigint
                , modifier4_id bigint
                , bill_fee money
                , allowed_amount money
                , units numeric(7,3)
                , created_by bigint
                , charge_dt timestamp with time zone
                , pointer1 text
                , pointer2 text
                , pointer3 text
                , pointer4 text
                , authorization_no text
                , study_id bigint
            )
        )
        , save_charges AS (
            INSERT INTO  billing.charges (
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
            (SELECT
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
            FROM
                charge_details
            ) RETURNING billing.charges.id, billing.charges.cpt_id, billing.charges.created_by
        ),
        save_claim_icds AS (
            INSERT INTO billing.claim_icds (
                      claim_id 
                    , icd_id 
            )
            SELECT
                    ( SELECT id FROM save_claim )
                    , icd_id 
            FROM
                json_to_recordset(${claim_icds}) AS icds (
                      icd_id bigint 
                )
        )
        SELECT * FROM save_claim`;

        return await query(claim_sql);
    }
};
