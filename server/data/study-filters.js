const { query } = require('./index');



module.exports = {

    getData: async function (args) {

        const sqlQuery =`
                        SELECT id as filter_id,*
                        FROM   billing.grid_filters
                        WHERE filter_type='studies' AND user_id=$1
                        order by id `;

        return await query(sqlQuery, [args.userId]);

    },

    getUserWLFilters: async function (args) {

        const sqlQuery = `
                        SELECT
                        filter_info    AS perm_filter,
                        grid_filters.*
                        FROM billing.grid_filters
                        WHERE grid_filters.id = $2 AND user_id=$1
        `;

        return await query(sqlQuery, [args.user_id, args.id]);
    }
};
