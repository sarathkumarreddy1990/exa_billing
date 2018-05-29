const { query } = require('./index');

module.exports = {

    getData: async function () {

        return await query(`
                        SELECT id as filter_id,*
                        FROM   study_filters
                        WHERE NOT has_deleted
                        order by id asc
                        LIMIT  5 `);
    }
};
