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
                row_to_json(u.*) AS user_details,
                bus.grid_options,
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
            LEFT JOIN LATERAL (
                SELECT
                    bgf.filter_name,
                    bgf.filter_order,
                    bgf.filter_type,
                    bgf.filter_info,
                    bgf.display_as_tab,
                    bgf.is_global_filter,
                    bgf.display_in_ddl,
                    bgf.inactivated_dt
                FROM billing.grid_filters bgf
                WHERE (bgf.user_id = ${args.user_id} OR bgf.is_global_filter)
                    AND bgf.filter_type = ${filterType}
                    AND bgf.id = ${args.id}
            ) AS bgf ON TRUE
            LEFT JOIN LATERAL (
                SELECT
                    bus.grid_field_settings AS grid_options
                FROM billing.user_settings bus
                WHERE bus.user_id = us.user_id
                AND bus.grid_name = ${filterType}
            ) bus ON TRUE
            WHERE
                us.user_id = ${args.user_id}
        `;

        return await query(sqlQuery);
    }
};
