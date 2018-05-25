const { query, SQL } = require('./index');

module.exports = {

    getData: async function () {

        return await query(`
                        SELECT id as study_id,*
                        FROM   studies 
                        ORDER  BY id DESC 
                        LIMIT  10 `);
    },

    getDataByDate: async function (params) {
        let { fromDate, toDate } = params;

        let sql = SQL`
                    SELECT   * 
                    FROM     studies 
                    WHERE    study_dt BETWEEN ${fromDate}::date AND      ${toDate}::date 
                    ORDER BY id DESC limit 10
                    `;

        return await query(sql);
    }
};
