const {
    SQL,
    query
} = require('./index');

module.exports = {
    getData: async function (args) {
        const sqlQuery = SQL `
                    SELECT
                        id AS filter_id, *
                    FROM
                        billing.grid_filters
                    WHERE
                        filter_type = 'studies'
                        AND (user_id = ${args.userId} OR is_global_filter)
                        AND inactivated_dt is null
                    ORDER BY
                         filter_order `;

        return await query(sqlQuery);
    },

    getUserWLFilters: async function (args) {
        let sqlQuery;

        if(args.id > 0) {
            sqlQuery = SQL `
                        SELECT
                            filter_info  AS perms_filter,
                            bus.grid_field_settings AS grid_options,
                            grid_filters.*
                        FROM
                            billing.grid_filters
                        LEFT JOIN billing.user_settings bus ON bus.user_id = grid_filters.user_id
                        WHERE
                            grid_filters.id = ${args.id} `;

        } else {
            sqlQuery = SQL`
                        SELECT
                            us.worklist_filter_info AS perms_filter,
                            bus.grid_field_settings AS grid_options,
                            row_to_json(u.*)        AS user_details
                        FROM
                            public.user_settings us
                        LEFT JOIN billing.user_settings bus ON bus.user_id = us.user_id
                        JOIN LATERAL (
                            SELECT
                                user_type,
                                facilities,
                                default_facility_id,
                                all_facilities,
                                user_group_id
                            FROM users
                            WHERE id = us.user_id
                        ) u ON TRUE
                        WHERE
                            us.user_id = ${args.user_id}
            `;
        }

        return await query(sqlQuery);
    }
};
