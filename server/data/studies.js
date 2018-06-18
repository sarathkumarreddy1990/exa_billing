const { query, SQL } = require('./index');
const  SearchFilter = require('./search-filter');

module.exports = {

    getData: async function (args) {

        return await SearchFilter.getWL(args);
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
