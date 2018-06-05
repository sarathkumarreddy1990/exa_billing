const { query, SQL } = require('./index');

module.exports = {

    getData: async function (params) {
        let { companyID, userID, siteID} = params;

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
                                            sys_config,
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
                                          waiting_time
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
                                    WHERE  NOT is_system_status AND company_id=${companyID} ) AS claim_status)
                , cte_billing_codes AS(
                                    SELECT Json_agg(Row_to_json(billing_codes)) billing_codes
                                    FROM  (
                                    SELECT id,
                                        code,
                                        description
                                    FROM   billing.billing_codes
                                    WHERE  company_id=${companyID} ) AS billing_codes)
                , cte_billing_classes AS(
                                    SELECT Json_agg(Row_to_json(billing_classes)) billing_classes
                                    FROM  (
                                    SELECT id,
                                        code,
                                        description
                                    FROM   billing.billing_classes
                                    WHERE  company_id=${companyID} ) AS billing_classes)
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
                      cte_studyflag,
                      cte_sites
               `;

        return await query(sql);
    }
};
