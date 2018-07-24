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

        whereQuery.push(` filter_type = '${filter_type}' AND user_id = ${userId}`);

        let get_all = SQL` SELECT
        id
        ,filter_order
        ,filter_type
        ,filter_name
        ,filter_info
        ,display_as_tab
        ,is_global_filter
        ,display_in_ddl
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

    delete: async function (params) {
        let delete_data = SQL` DELETE FROM billing.grid_filters WHERE id = ${params.id} RETURNING  * ,'{}'::jsonb old_values `;
        return await queryWithAudit(delete_data, {
            ...params,
            logDescription: `Deleted. ${params.name} `
        });
    }
};
