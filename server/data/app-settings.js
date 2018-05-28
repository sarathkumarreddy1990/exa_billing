const { query, SQL } = require('./index');

module.exports = {

    getData: async function (params) {
        let { companyID, userID } = params;

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
                                    AND    is_active)AS facilities )
                    , cte_company AS(
                                    SELECT id AS "companyID",
                                            company_code,
                                            company_name,
                                            time_zone
                                    FROM   companies
                                    WHERE  id=${companyID}
                                    AND    NOT has_deleted )
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
                                            default_facility_id
                                   FROM   users
                                   WHERE  company_id=${companyID}
                                   AND    NOT has_deleted
                                   AND    is_active
                                   AND    id=${userID} ) AS users)
                , cte_user_settings AS(
                                    SELECT row_to_json(userSettings) userSettings
                                    FROM  (
                                    SELECT id AS user_setting_id,
                                         study_fields,
                                         page_size,
                                         sort_column,
                                         sort_order ,
                                         field_order,
                                         worklist_filter_info,
                                         grid_options,
                                         grid_field_settings
                                    FROM   user_settings
                                    WHERE  user_id=${userID}  ) AS userSettings)
               , cte_study_status AS(
                                    SELECT Json_agg(Row_to_json(study_status)) study_status
                                    FROM  (
                                    SELECT id,
                                          status_code,
                                          status_desc,
                                          facility_id,
                                          order_related,
                                          waiting_time
                                    FROM   study_status
                                    WHERE  NOT has_deleted ) AS study_status)
               SELECT *
               FROM   cte_company,
                      cte_facilities,
                      cte_modalities,
                      cte_user,
                      cte_user_settings,
                      cte_study_status
               `;

        return await query(sql);
    }
};
