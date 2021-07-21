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
        const sqlQuery = SQL `
                        SELECT
                            filter_info  AS perm_filter,
                            grid_filters.*
                        FROM
                            billing.grid_filters
                        WHERE
                            grid_filters.id = ${args.id} `;

        return await query(sqlQuery);
    }
};
