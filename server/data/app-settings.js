const { query, SQL } = require('./index');

module.exports = {

    getData: async function (params) {
        let { companyID, userID, siteID } = params;

        let sql = SQL`
                    WITH cte_call_categories AS
                    (
                        SELECT Json_agg(Row_to_json(call_categories)) AS "callCategories"
                        FROM (
                                SELECT
                                      id
                                    , reason as name
                                FROM reason_codes
                                WHERE
                                    company_id = ${companyID}
                                AND category = 'CALL_CATEGORIES'
                                AND deleted_dt IS NULL
                                ORDER BY reason
                             ) AS call_categories
                    )

                    , cte_facilities AS
                    (
                            SELECT Json_agg(Row_to_json(facilities)) facilities
                            FROM   (
                                     SELECT id,
                                        facility_code,
                                        facility_name,
                                        time_zone,
                                        file_store_id,
                                        imagine_software_external_provider_id AS external_provider_id,
                                        facility_logo,
                                        is_active
                                    FROM   facilities
                                    WHERE  company_id=${companyID}
                                    AND    deleted_dt IS NULL
                                    ORDER BY
                                        facility_name )AS facilities )
                    , cte_ordering_facilities AS (
                            SELECT Json_agg(Row_to_json(ordering_facilities)) ordering_facilities
                            FROM (
                                    SELECT
                                         id,
                                         code AS ordering_faciltiy_code,
                                         name AS ordering_facility_name
                                    FROM ordering_facilities
                                    WHERE company_id = ${companyID}
                                    AND deleted_dt IS NULL
                                    ORDER BY
                                    name )AS ordering_facilities
                    )
                    , cte_company AS(
                            SELECT (Row_to_json(company)) company
                            FROM   (
                                    SELECT id ,
                                            company_code,
                                            company_name,
                                            time_zone,
                                            hstore_to_json(sys_config) as sys_config,
                                            scan_document_types,
                                            file_store_id,
                                            email_config
                                    FROM   companies
                                    WHERE  id=${companyID}
                                    AND    deleted_dt IS NULL )AS company )
                    , cte_modalities AS(
                                  SELECT Json_agg(Row_to_json(modalities)) modalities
                                  FROM   (
                                           SELECT   id,
                                                modality_code,
                                                modality_name
                                            FROM     modalities
                                            WHERE    company_id=${companyID}
                                            AND      deleted_dt IS NULL
                                            AND      is_active
                                            ORDER BY priority ASC ) AS modalities)
                    , cte_user AS(
                                   SELECT row_to_json(users) "userInfo"
                                   FROM  ( SELECT users.id AS "userID",
                                            username,
                                            first_name,
                                            last_name,
                                            middle_initial,
                                            suffix,
                                            facilities as user_facilities,
                                            user_type,
                                            document_types,
                                            default_facility_id,
                                            hstore_to_json(user_settings) AS user_settings,
                                            get_full_name(last_name, first_name, middle_initial, NULL, suffix) AS "userFullName"
                                   FROM   users
                                   INNER JOIN user_groups ON user_groups.id = users.user_group_id
                                   WHERE  users.company_id = ${companyID}
                                   AND    users.deleted_dt IS NULL
                                   AND    users.is_active
                                   AND    users.id = ${userID} ) AS users)
                , cte_user_settings AS(
                                    SELECT Json_agg(row_to_json(userSettings)) userSettings
                                    FROM  (
                                    SELECT id AS user_setting_id,
                                        field_order,
                                        grid_name,
                                        grid_field_settings,
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
                                    WHERE deleted_dt IS NULL) AS study_status)
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
                                        description,
                                        color_code
                                    FROM   billing.billing_codes
                                    WHERE  company_id=${companyID} AND inactivated_dt IS NULL
                                    ORDER BY description) AS billing_codes)
                , cte_billing_classes AS(
                                    SELECT Json_agg(Row_to_json(billing_classes)) billing_classes
                                    FROM  (
                                    SELECT id,
                                        code,
                                        description,
                                        color_code
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
                                    WHERE  company_id=${companyID} AND deleted_dt IS NULL) AS studyflag)
                , cte_sites AS(
                                SELECT id as siteID,
                                    stat_level_config,
                                    tat_config,
                                    country_alpha_3_code,
                                    province_alpha_2_code
                                    FROM   sites
                                    WHERE  id=${siteID})
                , cte_mobile_rad_details AS (
                                SELECT
                                    data AS enable_mobile_rad
                                FROM( SELECT
                                        jsonb_array_elements(web_config) AS data
                                    FROM sites
                                    WHERE  id=${siteID}
                                ) AS row WHERE data->>'id' = 'enableMobileRad'
                )
                
                , cte_multi_panel_trans_editor AS (
                    SELECT
                        data AS multipanel_transcription_editor
                    FROM  (
                        SELECT
                            jsonb_array_elements(web_config) AS data
                        FROM sites
                        WHERE  id = ${siteID}
                    ) AS row WHERE data->>'id' = 'multipanel_transcription_editor'
                )                
                , cte_hidden_reports AS (
                                SELECT Json_agg(Row_to_json(hidden_reports)) hidden_reports
                                FROM  (
                                    SELECT report_id,value::boolean
                                    FROM report_settings
                                    WHERE company_id = ${companyID}
                                    AND code = 'hidden'
                                    AND country_alpha_3_code = (SELECT country_alpha_3_code
                                                                FROM public.sites
                                                                WHERE id = ${siteID})) AS hidden_reports
                                )
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
                                    inactivated_dt is null is_active /* billing.printer_templates.is_active */
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
                                    distinct users.id,
                                    username,
                                    first_name,
                                    last_name,
                                    user_groups.document_types,
                                    user_type
                                    FROM
                                        public.users
                                    INNER JOIN public.user_groups on user_groups.id = users.user_group_id
                                    INNER JOIN public.user_roles AS ur ON ur.id = ANY (user_groups.user_roles)
                                WHERE
                                     ( LOWER(user_groups.group_name) = 'billing' OR LOWER(ur.role_name) = 'billing'
                                     OR LOWER(ur.role_name) = 'billing1.5'
                                     OR (group_info->'user_nav') ? 'billing'
                                    ) AND
                                     users.deleted_dt IS NULL AND
                                     users.is_active AND
                                     users.company_id = ${companyID} ) AS billing_user_list)
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
                                        WHERE  company_id=${companyID}
                                        AND ( (effective_date IS NULL AND end_date IS NULL)
                                              OR (CURRENT_DATE between effective_date AND end_date)
                                            )
                                    ) AS modifiers)
                ,cte_user_facilities as(
                                    SELECT Json_agg(Row_to_json(userFacilities)) "userFacilities"
                                    FROM   (
                                            SELECT facilities.id,
                                                facility_code,
                                                facility_name,
                                                time_zone,
                                                file_store_id,
                                                facilities.is_active
                                            FROM   facilities
                                            INNER JOIN users ON users.id=${userID}
                                            WHERE  facilities.company_id=${companyID}
                                            AND    facilities.deleted_dt IS NULL
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
                    AND deleted_dt IS NULL
                    AND facility_id IN (
                        SELECT id AS facility_id
                        FROM facilities
                        WHERE company_id = ${companyID} AND deleted_dt IS NULL
                    )
                ORDER BY modality_room_name ) AS modality_room
                ),
                cte_custom_study_status AS(
                    SELECT Json_agg(Row_to_json(custom_study_status)) custom_study_status
                    FROM  (
                        SELECT DISTINCT
                            status_code,
                            status_desc,
                            order_related
                        FROM study_status
                        INNER JOIN facilities ON (
                            facilities.id = study_status.facility_id
                            AND facilities.deleted_dt IS NULL
                        )
                        WHERE
                            can_edit
                            AND study_status.deleted_dt IS NULL
                            AND company_id = ${companyID}
                        ORDER BY status_code ASC ) AS custom_study_status
                    ),
                cte_vehicle_list AS(
                    SELECT COALESCE(Json_agg(Row_to_json(vehicles)),'[]') vehicles
                    FROM (
                        SELECT
                            id
                            , vehicle_name
                        FROM vehicles
                        WHERE deleted_dt IS NULL ) AS vehicles
                ),
                cte_clearing_house AS(
                    SELECT COALESCE(Json_agg(Row_to_json(clearing_house)),'[]') clearing_house
                    FROM  (
                        SELECT
                            id
                            , company_id
                            , inactivated_dt
                            , code
                            , name
                            , receiver_name
                            , receiver_id
                            , communication_info
                        FROM billing.edi_clearinghouses WHERE inactivated_dt IS NULL) AS clearing_house
                ),
                cte_cas_reason_codes AS(
                    SELECT COALESCE(Json_agg(Row_to_json(cas_reason_codes)),'[]') cas_reason_codes
                    FROM  (
                        SELECT
                            id
                            , company_id
                            , inactivated_dt
                            , code
                            , description
                        FROM billing.cas_reason_codes WHERE inactivated_dt IS NULL) AS cas_reason_codes
                ),
                cte_cities AS (
                    SELECT
                        JSON_AGG(c) cities
                    FROM
                        ( SELECT * FROM cities ) c
                ),
                cte_grid_filter AS(
                    SELECT json_agg(row_to_json(grid_filter))grid_filter
                        FROM
                            (
                                SELECT
                                    id AS user_setting_id
                                    , user_id
                                    , filter_order
                                    , filter_type
                                    , filter_name
                                    , filter_info
                                    , inactivated_dt IS NULL AS is_active
                                FROM billing.grid_filters
                                WHERE (user_id= ${userID}  OR is_global_filter)
                            ) AS grid_filter),

                cte_claim_submission_codes AS(
                    SELECT COALESCE(JSON_AGG(ROW_TO_JSON(submission_codes)),'[]') claim_submission_codes
                        FROM
                            (
                                SELECT
                                    id
                                    , code
                                    , description
                                    , country_code
                                    , province_code
                                FROM billing.claim_submission_codes
                                WHERE inactivated_dt IS NULL
                            ) AS submission_codes),

                cte_wcb_injury_nature AS (
                    SELECT  coalesce(JSON_AGG(ROW_TO_JSON(wcb_nature_code)), '[]') "wcb_nature_code"
                        FROM (SELECT
                                    id,
                                    code,
                                    description,
                                    (inactivated_dt IS NULL) AS is_active
                            FROM public.can_wcb_injury_codes
                            WHERE injury_code_type = 'n'
                        )  AS wcb_nature_code
                ),

                cte_wcb_injury_area AS (
                    SELECT  coalesce(JSON_AGG(ROW_TO_JSON(wcb_area_code)), '[]') "wcb_area_code"
                        FROM (SELECT
                                    id,
                                    code,
                                    description,
                                    (inactivated_dt IS NULL) AS is_active
                            FROM public.can_wcb_injury_codes
                            WHERE injury_code_type = 'a'
                        )  AS wcb_area_code
                ),

                cte_rendering_provider AS (
                    SELECT  COALESCE(JSON_AGG(ROW_TO_JSON(rendering_provider)), '[]') "rendering_provider"
                        FROM (
                            SELECT
                                DISTINCT p.full_name,
                                p.provider_code
                        FROM public.providers p
                        INNER JOIN provider_contacts pc ON pc.provider_id = p.id
                        WHERE
                            p.deleted_dt IS NULL
                            AND pc.deleted_dt IS NULL
                            AND p.is_active
                            AND p.provider_type = 'PR'
                            AND NOT p.sys_provider
                        ORDER BY p.full_name asc
                    )  AS rendering_provider
                ),
                cte_delay_reasons AS (
                    SELECT COALESCE(JSON_AGG(ROW_TO_JSON(delay_reasons)), '[]') "delay_reasons"
                    FROM (
                        SELECT
                                id AS delay_reason_id,
                                code,
                                description
                        FROM billing.delay_reasons bdr
                        WHERE
                            bdr.inactivated_dt IS NULL
                            AND bdr.company_id = ${companyID}
                        ORDER BY bdr.id asc
                    )  AS delay_reasons
                ),
                cte_ordering_facility_types AS (
                    SELECT COALESCE(JSONB_AGG(ROW_TO_JSON(ordering_facility_types)), '[]') "ordering_facility_types"
                    FROM (
                        SELECT
                            id,
                            description,
                            is_system_type
                        FROM public.ordering_facility_types oft
                        WHERE
                            oft.company_id = ${companyID}
                    ) AS ordering_facility_types
                )

               SELECT *
               FROM   cte_call_categories,
                      cte_company,
                      cte_facilities,
                      cte_ordering_facilities,
                      cte_modalities,
                      cte_user,
                      cte_user_settings,
                      cte_study_status,
                      cte_claim_status,
                      cte_billing_codes,
                      cte_billing_classes,
                      cte_provider_id_code_qualifiers,
                      cte_sites,
                      cte_hidden_reports,
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
                      cte_modality_rooms,
                      cte_custom_study_status,
                      cte_clearing_house,
                      cte_vehicle_list,
                      cte_cas_reason_codes,
                      cte_cities,
                      cte_grid_filter,
                      cte_claim_submission_codes,
                      cte_delay_reasons,
                      cte_wcb_injury_nature,
                      cte_wcb_injury_area,
                      cte_mobile_rad_details,
                      cte_rendering_provider,
                      cte_ordering_facility_types,
                      cte_multi_panel_trans_editor
               `;

        return await query(sql);
    }
};
