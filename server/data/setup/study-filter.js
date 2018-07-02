const { SQL, query } = require('../index');


module.exports = {

    save: async function (args) {

        args.userId = args.userId ? args.userId : 1;
        let inactivated_dt = args.isActive ? null : 'now()'; //is_active

        let insert_update_study_filter = SQL` WITH insert_grid_filter AS
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
                )
                RETURNING id
        ),
        update_grid_filter AS
        (
            UPDATE
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
            AND NOT EXISTS (
                SELECT 1 FROM  billing.grid_filters 
                WHERE filter_name ILIKE ${args.filterName}
                AND id !=  ${args.id}
                LIMIT 1
            )
            RETURNING id
        )
        SELECT id FROM insert_grid_filter
        UNION
        SELECT id FROM update_grid_filter
         `;


        return await query(insert_update_study_filter);
    },

    get: async function (args) {
        args.sortOrder = args.sortOrder || ' ASC';
        let whereQuery = [];
        let {   filter_name,   filter_order,  filter_type,  sortOrder,    sortField,  pageNo,   pageSize   } = args;

        if(filter_name){
            whereQuery.push(` filter_name ILIKE '%${filter_name}%'`);
        }

        if(filter_order){
            whereQuery.push(` filter_order :: TEXT ILIKE '%${filter_order}%'`);
        }

        whereQuery.push(` filter_type = '${filter_type}' AND deleted_dt IS NULL`);

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
        let delete_data = SQL` DELETE FROM billing.grid_filters WHERE id = ${params.id} `;

        return await query(delete_data);
    }
};