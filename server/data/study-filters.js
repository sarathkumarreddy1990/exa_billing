const { query } = require('./index');

module.exports = {

    getData: async function () {

        return await query(`
                        SELECT id as filter_id,*
                        FROM   study_filters
                        order by id desc
                        LIMIT  10 `);
    }
};
