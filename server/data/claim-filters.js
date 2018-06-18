const { query } = require('./index');

module.exports = {

    getData: async function (args) {

        const sqlQuery = (`
                        SELECT id as filter_id,*
                        FROM   billing.grid_filters
                        WHERE filter_type = 'claims' AND user_id=$1
                        order by id  `);

        return await query(sqlQuery, [args.userId]);
    }
};
