const { query } = require('./index');

module.exports = {

    getStudyIds: async function () {

        const sql = `SELECT 
                        MAX(ps.id) as id
                     FROM public.studies ps
                     INNER JOIN billing.charges_studies  bcs on ps.id != bcs.study_id
                     WHERE 
                        ps.study_status in ('CHI','SCH') 
                    AND NOT ps.has_deleted `;

        return await query(sql);

    }

};