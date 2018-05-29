const { query, SQL } = require('./index');

module.exports = {

    getData: async function () {

        return await query(`
                        SELECT studies.id as study_id,patients.full_name as patient_name,patients.birth_date,patients.account_no,*
                        FROM   studies 
                        LEFT JOIN patients on patients.id = studies.patient_id
                        ORDER  BY studies.id DESC 
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
