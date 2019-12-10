const {
    SQL,
    query,
    queryWithAudit
} = require('../index');

module.exports = {

    getData: async function (params) {

        const sql = SQL`
            SELECT 'hello, world'
        `;
        return await query(sql);
    },


};
