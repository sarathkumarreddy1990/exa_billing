const {SQL, query } = require('../index');


module.exports = {

    save: async function (args) { 
        let insert_study_filter = SQL` INSERT INTO billing.grid_filters (
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
        SELECT        
            ${args.userId}
            ,${args.filterOrder}
            ,${args.filterType}
            ,${args.filterName}
            ,${args.jsonData}
            ,${args.isDisplayAsTab}
            ,${args.isGlobal}
            ,${args.isDisplayInDropDown}
            ,${args.isActive}
            FROM 
            billing.grid_filters
            WHERE user_id != ${args.userId}
         `;
        
        return await query(insert_study_filter);
    }
};