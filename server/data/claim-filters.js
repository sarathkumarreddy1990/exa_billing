const { query } = require('./index');

module.exports = {

    getData: async function () {

        return await query(`
                        SELECT id as filter_id,*
                        FROM   billing.grid_filters
                        WHERE filter_type = 2
                        order by id  `);
    }
};
