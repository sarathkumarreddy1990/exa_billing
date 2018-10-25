const { query, SQL, queryWithAudit } = require('../index');


module.exports = {

    save: async function (args) {

        args.userId = args.userId ? args.userId : 1;
        let inactivated_dt = args.isActive ? null : 'now()'; //is_active
        let auditMsgUpdate = args.filterType == 'claims' ? 'Update : Claim Filter Updated ' : 'Update : Study Filter Updated ';
        let auditMsgIns = args.filterType == 'claims' ? 'Create : Claim Filter Added ' : 'Create : Study Filter Added ';
        let auditScreenName = args.filterType == 'claims' ? 'Claim Filter ' : 'Study Filter';

        let insert_update_study_filter = SQL` WITH update_grid_filter AS
        ( UPDATE
        billing.grid_filters
        SET
        filter_order = ${args.filterOrder}
            ,filter_type = ${args.filterType}
            ,filter_name = ${args.filterName}
            ,filter_info = ${args.jsonData}
            ,display_as_tab = ${args.isDisplayAsTab}
            ,is_global_filter = ${args.isGlobal}
            ,display_in_ddl = ${args.isDisplayInDropDown}
            ,inactivated_dt = ${inactivated_dt}
            WHERE
        id = ${args.id}
            AND NOT EXISTS (SELECT 1 FROM  billing.grid_filters WHERE filter_name ILIKE ${args.filterName} AND id !=  ${args.id} LIMIT 1)
        RETURNING *,(SELECT row_to_json(old_row)
        FROM   (SELECT * FROM   billing.grid_filters
        WHERE  id = ${args.id}) old_row) old_values
        ),
         insert_grid_filter AS
        (
            INSERT INTO billing.grid_filters (
                user_id
                ,filter_order
                ,filter_type
                ,filter_name
                ,filter_info
                ,display_as_tab
                ,is_global_filter
                ,display_in_ddl
                ,inactivated_dt
            )
            SELECT
                ${args.userId}
                ,${args.filterOrder}
                ,${args.filterType}
                ,${args.filterName}
                ,${args.jsonData}
                ,${args.isDisplayAsTab}
                ,${args.isGlobal}
                ,${args.isDisplayInDropDown}
                ,${inactivated_dt}
                WHERE NOT EXISTS (
                    SELECT 1 FROM billing.grid_filters WHERE filter_name ILIKE ${args.filterName} LIMIT 1
                ) AND NOT EXISTS(SELECT * FROM update_grid_filter)
                RETURNING *, '{}'::jsonb old_values
        ),
        insert_audit_cte AS(
            SELECT billing.create_audit(
                ${args.companyId},
                ${args.screenName},
                id,
                ${auditScreenName},
                ${args.moduleName},
                ${auditMsgIns} || ${args.filterName},
                ${args.clientIp || '127.0.0.1'},
                json_build_object(
                    'old_values', (SELECT COALESCE(old_values, '{}') FROM insert_grid_filter),
                    'new_values', (SELECT row_to_json(temp_row)::jsonb - 'old_values'::text FROM (SELECT * FROM insert_grid_filter) temp_row)
                )::jsonb,
                ${args.userId || 0}
            ) id
            from insert_grid_filter
        ),
        update_audit_cte AS(
            SELECT billing.create_audit(
                ${args.companyId},
                ${args.screenName},
                id,
                ${auditScreenName},
                ${args.moduleName},
                ${auditMsgUpdate} || (${args.filterName}) ,
                ${args.clientIp || '127.0.0.1'},
                json_build_object(
                    'old_values', (SELECT COALESCE(old_values, '{}') FROM update_grid_filter),
                    'new_values', (SELECT row_to_json(temp_row)::jsonb - 'old_values'::text FROM (SELECT * FROM update_grid_filter) temp_row)
                 )::jsonb,
                ${args.userId || 0}
            ) id
            from update_grid_filter
        )
        SELECT id FROM insert_audit_cte
        UNION
        SELECT id FROM update_audit_cte `;

        return await query(insert_update_study_filter);
    },

    get: async function (args) {
        args.sortOrder = args.sortOrder || ' ASC';
        let whereQuery = [];
        let { filter_name, filter_order, filter_type, sortOrder, sortField, pageNo, pageSize, userId } = args;

        if (filter_name) {
            whereQuery.push(` filter_name ILIKE '%${filter_name}%'`);
        }

        if (filter_order) {
            whereQuery.push(` filter_order :: TEXT ILIKE '%${filter_order}%'`);
        }

        whereQuery.push(` filter_type = '${filter_type}' AND (user_id = ${userId} OR is_global_filter)`);

        let get_all = SQL` SELECT
        id
        ,filter_order
        ,filter_type
        ,filter_name
        ,filter_info
        ,display_as_tab
        ,is_global_filter
        ,display_in_ddl
        ,user_id
        ,inactivated_dt IS NULL AS is_active
        ,COUNT(1) OVER (range unbounded preceding) AS total_records
        FROM  billing.grid_filters`;

        get_all.append(SQL` WHERE `).append(whereQuery.join(' AND '));

        get_all.append(SQL` ORDER BY `)
            .append(sortField)
            .append(' ')
            .append(sortOrder)
            .append(SQL` LIMIT ${pageSize} `)
            .append(SQL` OFFSET ${((pageNo * pageSize) - pageSize)}`);

        return await query(get_all);
    },

    getById: async function (params) {

        let get_data = SQL`
            SELECT
                id
                ,filter_order
                ,filter_type
                ,filter_name
                ,filter_info
                ,display_as_tab
                ,is_global_filter
                ,display_in_ddl
                ,inactivated_dt IS NULL AS is_active
            FROM billing.grid_filters WHERE id =${params.id} `;

        return await query(get_data);
    },
    setSelectedTab: async function (params) {
        const {
            selectedTab
            , userId
            , gridName
            , defaultColumn
            , orderBy
            , fieldOrder
            , companyId
            , screenName
            , moduleName
            , clientIp
        } = params;

        const sql = SQL` WITH update_user_settings AS (
            UPDATE
                billing.user_settings
            SET
                default_tab = ${selectedTab}
            WHERE
                user_id = ${userId}
                AND grid_name = ${gridName}
            RETURNING *,
            (
                SELECT row_to_json(old_row)
                FROM   (SELECT *
                        FROM   billing.user_settings
                        WHERE  user_id = ${userId} and grid_name = ${gridName}) old_row
            ) old_values
        ),
        create_user_settings AS (
            INSERT INTO billing.user_settings(
                default_column
                , default_column_order_by
                , default_tab
                , field_order
                , grid_name
                , user_id
                , company_id
                , default_date_range
            )
            SELECT
                ${defaultColumn}
                , ${orderBy}
                , ${selectedTab}
                , ${fieldOrder}
                , ${gridName}
                , ${userId}
                , ${companyId}
                , 'this_year'
            WHERE NOT EXISTS ( SELECT id FROM update_user_settings )
            RETURNING *, '{}'::jsonb old_values
        ),
        update_audit_user_settings AS (
            SELECT billing.create_audit(
                ${companyId}
              , 'user settings'
              , id
              , ${screenName}
              , ${moduleName}
              , 'Default Tab for ' || ${gridName} || '  grid in User Settings Updated '
              , ${clientIp}
              , json_build_object(
                  'old_values', COALESCE(old_values, '{}'),
                  'new_values', (SELECT row_to_json(temp_row)::jsonb - 'old_values'::text FROM (SELECT * FROM update_user_settings ) temp_row)
                )::jsonb
              , ${userId}
            ) AS id
          FROM update_user_settings
          WHERE id IS NOT NULL
        ),
        create_audit_user_settings AS (
            SELECT billing.create_audit(
                ${companyId}
              , 'user settings'
              , id
              , ${screenName}
              , ${moduleName}
              , 'User Settings created: ' || ${gridName} || '  grid'
              , ${clientIp}
              , json_build_object(
                  'old_values', COALESCE(old_values, '{}'),
                  'new_values', (SELECT row_to_json(temp_row)::jsonb - 'old_values'::text FROM (SELECT * FROM create_user_settings ) temp_row)
                )::jsonb
              , ${userId}
            ) AS id
          FROM create_user_settings
          WHERE id IS NOT NULL
        )
        SELECT * FROM update_audit_user_settings UNION SELECT * FROM create_audit_user_settings `;
        return await query(sql);
    },

    delete: async function (params) {
        let delete_data = SQL` DELETE FROM billing.grid_filters WHERE id = ${params.id} RETURNING  * ,'{}'::jsonb old_values `;
        return await queryWithAudit(delete_data, {
            ...params,
            logDescription: `Deleted. ${params.name} `
        });
    }
};
