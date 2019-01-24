const { query } = require('./index');



module.exports = {

    getData: async function (args) {

        const sqlQuery = `
                    SELECT id AS filter_id, *
                    FROM   billing.grid_filters
                    WHERE  filter_type = 'studies'
                            AND (user_id = $1 OR is_global_filter)
                            AND inactivated_dt is null
                    ORDER  BY filter_order
                        `;

        return await query(sqlQuery, [args.userId]);

    },

    getUserWLFilters: async function (args) {

        const sqlQuery = `
                        SELECT
                        filter_info    AS perm_filter,
                        grid_filters.*
                        FROM billing.grid_filters
                        WHERE grid_filters.id = $1
        `;

        return await query(sqlQuery, [args.id]);
    }
};
