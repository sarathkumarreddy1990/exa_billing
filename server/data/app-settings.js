const { query, SQL } = require('./index');

module.exports = {

    getData: async function (params) {
        let { companyID, userID, siteID } = params;

        let sql = SQL`
                    WITH cte_facilities AS
                    (
                            SELECT Json_agg(Row_to_json(facilities)) facilities
                            FROM   (
                                     SELECT id,
                                        facility_code,
                                        facility_name,
                                        time_zone,
                                        file_store_id
                                    FROM   facilities
                                    WHERE  company_id=${companyID}
                                    AND    NOT has_deleted
                                    AND    is_active 
                                    ORDER BY 
                                        facility_name )AS facilities )
                    , cte_company AS(
                            SELECT (Row_to_json(company)) company
                            FROM   (
                                    SELECT id ,
                                            company_code,
                                            company_name,
                                            time_zone,
                                            hstore_to_json(sys_config) as sys_config,
                                            file_store_id
                                    FROM   companies
                                    WHERE  id=${companyID}
                                    AND    NOT has_deleted )AS company )
                    , cte_modalities AS(
                                  SELECT Json_agg(Row_to_json(modalities)) modalities
                                  FROM   (
                                           SELECT   id,
                                                modality_code,
                                                modality_name
                                            FROM     modalities
                                            WHERE    company_id=${companyID}
                                            AND      NOT has_deleted
                                            AND      is_active
                                            ORDER BY priority ASC ) AS modalities)
                    , cte_user AS(
                                   SELECT row_to_json(users) "userInfo"
                                   FROM  ( SELECT id AS "userID",
                                            username,
                                            first_name,
                                            last_name,
                                            middle_initial,
                                            suffix,
                                            facilities as user_facilities,
                                            user_type,
                                            default_facility_id,
                                            hstore_to_json(user_settings) AS user_settings
                                   FROM   users
                                   WHERE  company_id=${companyID}
                                   AND    NOT has_deleted
                                   AND    is_active
                                   AND    id=${userID} ) AS users)
                , cte_user_settings AS(
                                    SELECT Json_agg(row_to_json(userSettings)) userSettings
                                    FROM  (
                                    SELECT id AS user_setting_id,
                                        field_order,
                                        grid_name,
                                        default_column_order_by,
                                        default_column ,
                                        default_tab
                                    FROM   billing.user_settings
                                    WHERE  user_id=${userID}  ) AS userSettings)
               , cte_study_status AS(
                                    SELECT Json_agg(Row_to_json(study_status)) study_status
                                    FROM  (
                                    SELECT id,
                                          status_code,
                                          status_desc,
                                          facility_id,
                                          order_related,
                                          waiting_time,
                                          color_code
                                    FROM   study_status
                                    WHERE  NOT has_deleted ) AS study_status)
                , cte_claim_status AS(
                                    SELECT Json_agg(Row_to_json(claim_status)) claim_status
                                    FROM  (
                                    SELECT id,
                                        code,
                                        description,
                                        is_system_status
                                    FROM   billing.claim_status
                                    WHERE  company_id=${companyID} AND inactivated_dt IS NULL
                                    ORDER  BY display_order, description ) AS claim_status)
                , cte_billing_codes AS(
                                    SELECT Json_agg(Row_to_json(billing_codes)) billing_codes
                                    FROM  (
                                    SELECT id,
                                        code,
                                        description
                                    FROM   billing.billing_codes
                                    WHERE  company_id=${companyID} AND inactivated_dt IS NULL ) AS billing_codes)
                , cte_billing_classes AS(
                                    SELECT Json_agg(Row_to_json(billing_classes)) billing_classes
                                    FROM  (
                                    SELECT id,
                                        code,
                                        description
                                    FROM   billing.billing_classes
                                    WHERE  company_id=${companyID} AND inactivated_dt IS NULL ) AS billing_classes)
                , cte_provider_id_code_qualifiers AS(
                                    SELECT Json_agg(Row_to_json(provider_id_code_qualifiers)) provider_id_code_qualifiers
                                    FROM  (
                                    SELECT id,
                                    qualifier_code,
                                    description
                                    FROM   billing.provider_id_code_qualifiers
                                    WHERE  company_id=${companyID} AND inactivated_dt IS NULL) AS provider_id_code_qualifiers)
                , cte_studyflag AS(
                                    SELECT Json_agg(Row_to_json(studyflag)) studyflag
                                    FROM  (
                                    SELECT id,
                                        color_code,
                                        description
                                    FROM   study_flags
                                    WHERE  company_id=${companyID} AND NOT has_deleted) AS studyflag)
                , cte_sites AS(                                   
                                SELECT id as siteID,
                                    stat_level_config,
                                    tat_config
                                    FROM   sites
                                    WHERE  id=${siteID})
                , cte_employment_status AS(
                                    SELECT Json_agg(Row_to_json(employment_status)) employment_status
                                    FROM  (
                                    SELECT id,
                                    description
                                    FROM   employment_status
                                    WHERE  company_id=${companyID} AND inactivated_dt IS NULL ) AS employment_status)
                , cte_relationship_status AS(
                                    SELECT Json_agg(Row_to_json(relationship_status)) relationship_status
                                    FROM  (
                                    SELECT id,
                                    description
                                    FROM   relationship_status
                                    WHERE  company_id=${companyID} AND inactivated_dt IS NULL ) AS relationship_status)
                , cte_states AS(
                                    SELECT Json_agg(Row_to_json(states)) states
                                    FROM  (
                                    SELECT 
                                    app_states
                                    FROM   companies
                                    WHERE  id=${companyID} ) AS states)
                , cte_status_color_codes AS(
                                    SELECT Json_agg(Row_to_json(status_color_codes)) status_color_codes
                                    FROM  (
                                    SELECT 
                                    id,
                                    process_type,
                                    process_status,
                                    color_code
                                    FROM   billing.status_color_codes
                                    WHERE  company_id=${companyID} ) AS status_color_codes)
                , cte_printer_templates AS(
                                    SELECT Json_agg(Row_to_json(printer_templates)) printer_templates
                                    FROM  (
                                    SELECT 
                                    id,
                                    name,
                                    template_type,
                                    inactivated_dt is null is_active
                                    FROM   billing.printer_templates
                                    WHERE  company_id=${companyID} ) AS printer_templates)
                , cte_billing_providers AS(
                                    SELECT Json_agg(Row_to_json(billing_providers)) billing_providers
                                    FROM  (
                                    SELECT
                                    id
                                    ,name AS full_name
                                    FROM billing.providers
                                    WHERE company_id = ${companyID} AND inactivated_dt IS NULL ) AS billing_providers)
                , cte_places_of_service AS(
                                    SELECT Json_agg(Row_to_json(places_of_service)) places_of_service
                                    FROM  (
                                    SELECT
                                    id
                                    , code
                                    , description 
                                    FROM public.places_of_service
                                    WHERE company_id = ${companyID} AND inactivated_dt IS NULL ) AS places_of_service)
                , cte_adjustment_code_list AS(
                                    SELECT Json_agg(Row_to_json(adjustment_code_list)) adjustment_code_list
                                    FROM  (
                                    SELECT
                                    id
                                    , code 
                                    , description
                                    , accounting_entry_type  
                                    FROM billing.adjustment_codes 
                                    WHERE company_id = ${companyID} AND inactivated_dt IS NULL ) AS adjustment_code_list)
                , cte_user_group_list AS(
                                    SELECT Json_agg(Row_to_json(billing_user_list)) billing_user_list
                                    FROM  (
                                    SELECT 
                                    username,
                                    first_name,
                                    last_name,
                                    user_type,
                                    users.id
                                    FROM users inner join user_groups on user_groups.id=user_group_id 
                                    WHERE (group_name='Billing' OR user_type='SU')        
                                    AND users.has_deleted=false and users.is_active = true
                                    AND users.company_id = ${companyID} ) AS billing_user_list)
                , cte_payment_reasons_list AS(
                                    SELECT Json_agg(Row_to_json(payment_reasons)) payment_reasons
                                    FROM  (
                                    SELECT 
                                        id,
                                        code,
                                        description
                                    FROM 
                                        billing.payment_reasons
                                    WHERE
                                        company_id = ${companyID} AND inactivated_dt IS NULL) AS payment_reasons)
                , cte_modifiers AS(
                                     SELECT Json_agg(Row_to_json(modifiers)) modifiers
                                    FROM  (
                                        SELECT id,
                                        modifier_amount,
                                        override_amount,
                                        code,
                                        description,
                                        level,
                                        sign,
                                        type,
                                        modifier1,
                                        modifier2,
                                        modifier3,
                                        modifier4
                                        FROM   modifiers
                                        WHERE  company_id=${companyID}  ) AS modifiers)
                ,cte_user_facilities as(
                                    SELECT Json_agg(Row_to_json(userFacilities)) "userFacilities"
                                    FROM   (
                                            SELECT facilities.id,
                                                facility_code,
                                                facility_name,
                                                time_zone,
                                                file_store_id
                                            FROM   facilities
                                            INNER JOIN users ON users.id=${userID}
                                            WHERE  facilities.company_id=${companyID} 
                                            AND    NOT facilities.has_deleted
                                            AND    facilities.is_active 
                                            AND (facilities.id) = ANY(users.facilities )
                                            ORDER BY 
                                            facility_name )AS userFacilities 
                ),
                cte_currentDate as (
                    SELECT 
                        now() as currentDate
                ), 
                cte_insurance_provider_payer_types AS(
                    SELECT Json_agg(Row_to_json(insurance_provider_payer_types)) insurance_provider_payer_types
                   FROM  (
                       SELECT id,
                       description,
                       code
                       FROM   insurance_provider_payer_types
                       WHERE  company_id=${companyID} AND inactivated_dt IS NULL ) AS insurance_provider_payer_types
                ),
                cte_modality_rooms AS(
                    SELECT Json_agg(Row_to_json(modality_room)) modality_room
                   FROM  (
                    SELECT
                    id,
                    modality_room_code,
                    modality_room_name,
                    display_order,
                    color_code,
                    modalities
                FROM modality_rooms
                WHERE
                    is_active
                    AND NOT has_deleted
                    AND facility_id IN (
                        SELECT id AS facility_id
                        FROM facilities
                        WHERE company_id = ${companyID} AND NOT has_deleted
                    )
                ORDER BY modality_room_name ) AS modality_room
                )
               SELECT *
               FROM   cte_company,
                      cte_facilities,
                      cte_modalities,
                      cte_user,
                      cte_user_settings,
                      cte_study_status,
                      cte_claim_status,
                      cte_billing_codes,
                      cte_billing_classes,
                      cte_provider_id_code_qualifiers,
                      cte_sites,
                      cte_studyflag,
                      cte_employment_status,
                      cte_relationship_status,
                      cte_states,
                      cte_status_color_codes,
                      cte_printer_templates,
                      cte_billing_providers,
                      cte_places_of_service,
                      cte_adjustment_code_list,
                      cte_user_group_list,
                      cte_payment_reasons_list,
                      cte_modifiers,
                      cte_user_facilities,
                      cte_currentDate,
                      cte_insurance_provider_payer_types,
                      cte_modality_rooms
               `;

        return await query(sql);
    }
};
