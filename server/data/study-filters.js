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
        const filterType = args.flag === 'claim_workbench'
            ? 'claims'
            : 'studies';

        sqlQuery = SQL`
            SELECT
                us.worklist_filter_info AS perms_filter,
                bgf.filter_info AS joined_filter_info,
                bus.grid_field_settings AS grid_options,
                row_to_json(u.*) AS user_details,
                bgf.*
            FROM public.user_settings us
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
            LEFT JOIN billing.grid_filters bgf ON bgf.user_id = us.user_id
            LEFT JOIN billing.user_settings bus ON bus.user_id = us.user_id
            WHERE
                us.user_id = ${args.user_id}
                AND CASE
                        WHEN ${args.id} > 0
                        THEN (
                            bgf.id = ${args.id}
                            AND bgf.filter_type = ${filterType}
                            AND bus.grid_name = ${filterType}
                        )
                        ELSE bus.grid_name = ${filterType}
                    END
        `;

        return await query(sqlQuery);
    }
};
