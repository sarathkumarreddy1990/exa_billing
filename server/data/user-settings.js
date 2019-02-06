const { query, SQL } = require('./index');
let path = require('path');
const fs = require('fs');
const { promisify } = require('util');
const readFileAsync = promisify(fs.readFile);

module.exports = {

    save: async function (args) {

        let querySetting = SQL`
        WITH insert_user_setting AS
        (
        INSERT INTO billing.user_settings
             (
                 user_id
                 ,field_order
                 ,grid_name
                 ,default_column_order_by
                 ,default_column
                 ,default_tab
                 ,paper_claim_full_template_id
                 ,paper_claim_original_template_id
                 ,direct_invoice_template_id
                 ,patient_invoice_template_id
                 ,company_id
                 ,default_date_range
                )
            SELECT
                  ${args.userId}
                , ${args.claimSettingFields}
                , ${args.flag}
                , ${args.claim_sort_order}
                , ${args.claim_col_name}
                , ${args.default_tab}
                , ${args.paper_claim_full}
                , ${args.paper_claim_original}
                , ${args.direct_invoice}
                , ${args.patient_invoice}
                , ${args.companyId}
                , 'this_year'
            WHERE NOT EXISTS (
                SELECT * FROM billing.user_settings WHERE user_id = ${args.userId} AND grid_name = ${args.flag}
            )
            RETURNING * , '{}'::jsonb old_values
        ),
        update_user_setting AS
        (
            UPDATE
                billing.user_settings
            SET field_order = ${args.claimSettingFields}
                ,grid_name = ${args.flag}
                ,default_column_order_by = ${args.claim_sort_order}
                ,default_column = ${args.claim_col_name}
                ,default_tab = ${args.default_tab}
                ,paper_claim_full_template_id = ${args.paper_claim_full}
                ,paper_claim_original_template_id = ${args.paper_claim_original}
                ,direct_invoice_template_id = ${args.direct_invoice}
                ,patient_invoice_template_id = ${args.patient_invoice}
            WHERE
                user_id = ${args.userId}
                AND grid_name = ${args.flag}
            RETURNING *,
            (
                SELECT row_to_json(old_row)
                FROM   (SELECT *
                        FROM   billing.user_settings
                        WHERE  user_id = ${args.userId}  AND grid_name = ${args.flag} ) old_row
            ) old_values
        ),
        insert_audit_usersettings AS (
            SELECT billing.create_audit(
                  ${args.companyId}
                , 'user_settings'
                , id
                , ${args.screenName}
                , 'setup'
                , insert_user_setting.default_tab || '   User Settings created '
                , ${args.clientIp}
                , json_build_object(
                    'old_values', COALESCE(old_values, '{}'),
                    'new_values', (SELECT row_to_json(temp_row)::jsonb - 'old_values'::text FROM (SELECT * FROM insert_user_setting) temp_row)
                  )::jsonb
                , ${args.userId}
              ) AS id
            FROM insert_user_setting
            WHERE id IS NOT NULL
        ),
        update_audit_usersettings AS (
            SELECT billing.create_audit(
                  ${args.companyId}
                , 'user_settings'
                , id
                , ${args.screenName}
                , 'setup'
                , update_user_setting.default_tab || '   User Settings Updated '
                , ${args.clientIp}
                , json_build_object(
                    'old_values', COALESCE(old_values, '{}'),
                    'new_values', (SELECT row_to_json(temp_row)::jsonb - 'old_values'::text FROM (SELECT * FROM update_user_setting ) temp_row)
                  )::jsonb
                , ${args.userId}
              ) AS id
            FROM update_user_setting
            WHERE id IS NOT NULL
        )
        SELECT id FROM insert_audit_usersettings
        UNION
        SELECT id FROM update_audit_usersettings`;

        return await query(querySetting);
    },

    updateGridSettings: async function(params) {
        let {
            userId
            , clientIp
            , gridName
            , fieldOrder
            , companyId
            , screenName
            , moduleName
            , entityName
        } = params;
        let defaulTab = gridName === "studies" ? "All_Studies" : "All_Claims";
        let sql = SQL`WITH insert_user_settings AS (
                        INSERT INTO billing.user_settings
                        (
                              company_id
                            , user_id
                            , field_order
                            , default_tab
                            , grid_name
                            , default_date_range
                        )
                        SELECT
                              ${companyId}
                            , ${userId}
                            , ${fieldOrder}
                            , ${defaulTab}
                            , ${gridName}
                            , 'this_year'
                        WHERE NOT EXISTS (SELECT 
                                            1 
                                          FROM billing.user_settings WHERE 
                                          grid_name = ${gridName} 
                                          AND user_id = ${userId})
                        RETURNING * , '{}'::jsonb old_values
                    ),
                    update_user_settings AS(
                        UPDATE
                            billing.user_settings
                        SET 
                            field_order = ${fieldOrder}
                        WHERE grid_name = ${gridName}
                        AND user_id = ${userId}
                        AND NOT EXISTS (SELECT 1 FROM insert_user_settings)
                        RETURNING *,
                        (
                            SELECT row_to_json(old_row)
                            FROM   (SELECT *
                                    FROM   billing.user_settings
                                    WHERE  user_id = ${userId}  AND grid_name = ${gridName} ) old_row
                        ) old_values
                    ),
                    insert_audit_usersettings AS (
                        SELECT billing.create_audit(
                              ${companyId}
                            , ${entityName}
                            , id
                            , ${screenName}
                            , ${moduleName}
                            , 'Inserted ' || ${gridName} || ' grid order, Inserted by Id: ' || ${userId}
                            , ${clientIp}
                            , json_build_object(
                                'old_values', COALESCE(old_values, '{}'),
                                'new_values', (SELECT row_to_json(temp_row)::jsonb - 'old_values'::text FROM (SELECT * FROM insert_user_settings) temp_row)
                              )::jsonb
                            , ${userId}
                          ) AS id
                        FROM insert_user_settings
                        WHERE id IS NOT NULL
                    ),
                    update_audit_usersettings AS (
                        SELECT billing.create_audit(
                              ${companyId}
                            , ${entityName}
                            , id
                            , ${screenName}
                            , ${moduleName}
                            , 'Updated ' || ${gridName} || ' grid order, Updated by Id: ' || ${userId}
                            , ${clientIp}
                            , json_build_object(
                                'old_values', COALESCE(old_values, '{}'),
                                'new_values', (SELECT row_to_json(temp_row)::jsonb - 'old_values'::text FROM (SELECT * FROM update_user_settings ) temp_row)
                              )::jsonb
                            , ${userId}
                          ) AS id
                        FROM update_user_settings
                        WHERE id IS NOT NULL
                    )
                    SELECT id FROM insert_audit_usersettings
                    UNION
                    SELECT id FROM update_audit_usersettings`;

        return await query(sql);
    },

    getGridFieldById: async function (params) {

        let select_field = SQL`
        SELECT
              field_order
            , grid_name
            , default_column
            , default_column_order_by
            , id AS user_setting_id
            , default_column
            , paper_claim_full_template_id AS "paper_claim_full"
            , paper_claim_original_template_id AS "paper_claim_original"
            , direct_invoice_template_id AS "direct_invoice"
            , patient_invoice_template_id AS "patient_invoice"

        FROM
           billing.user_settings WHERE user_id = ${params.userId}
           AND grid_name = ${params.gridName} `;


        return await query(select_field);
    },

    getGridFields: async function () {

        let file_path = path.join(__dirname, '../resx/grid-fields.json');
        let gridFields = readFileAsync(file_path, 'utf8');

        return await gridFields;
    }
};
