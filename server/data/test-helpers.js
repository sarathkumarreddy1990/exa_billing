const { query } = require('./index');

module.exports = {

    getStudyIds: async function () {

        const sql = `SELECT 
                        MAX(ps.id) as id
                     FROM public.studies ps
                     WHERE 
                        ps.study_status in ('CHI','SCH') 
                    AND NOT ps.has_deleted 
                    AND NOT EXISTS (SELECT 
                                        1 
                                    FROM billing.charges_studies bcs 
                                    WHERE 
                                    ps.id = bcs.study_id)`;

        return await query(sql);

    },

    getPatientId: async function () {

        const sql = `SELECT 
                        MAX(pp.id) as id
                     FROM public.patients pp
                     INNER JOIN public.patient_insurances ppi on ppi.patient_id = pp.id
                     WHERE 
                        NOT pp.has_deleted `;

        return await query(sql);

    }

};