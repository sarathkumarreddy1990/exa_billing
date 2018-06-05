const { query } = require('../index');


module.exports = {
    save: async function (args) {

        let insert_study_filter = ` INSERT INTO billing.grid_filters (
            user_id
            ,filter_order
            ,filter_type
            ,filter_name
            ,filter_info
            ,display_as_tab
            ,is_global_filter
            ,display_in_ddl
            ,is_active
        )
        VALUES
        (
            ${args.userId}
            ,${args.filterOrder}
            ,${args.filterType}
            ,'${args.filterName}'
            ,'${JSON.stringify(args.json)}'
            ,${args.isDisplayAsTab}
            ,${args.isGlobal}
            ,${args.isDisplayInDropDown}
            ,${args.isActive}
        )
         `;

        return await query(insert_study_filter);
    }
};