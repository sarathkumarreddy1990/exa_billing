const { query, SQL } = require('../index');

module.exports = {

    getData: async function () {

        return await query(`
                        SELECT id,*
                        FROM   billing.cas_group_codes 
                        ORDER  BY id DESC 
                        LIMIT  10 `);
    },

    getById: async function (params) {
        let { id } = params;

        let sql = SQL`
                    SELECT   * 
                    FROM     billing.cas_group_codes 
                    WHERE    id = ${id}
                    ORDER BY id DESC limit 10
                    `;

        return await query(sql);
    }
};