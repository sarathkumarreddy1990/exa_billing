const { query, SQL } = require('./index');

module.exports = {
    getReportSetting: async function (params) {
        const {
            companyId,
            report_id,
            code
        } = params;
        const sql = SQL`SELECT country_alpha_3_code,value
            FROM billing.report_settings
            WHERE company_id = ${companyId}
            AND report_id = ${report_id}
            AND code = ${code}
            AND country_alpha_3_code = (SELECT country_alpha_3_code
                                        FROM public.sites
                                        WHERE id = 1)`;

        return await query(sql);
    }
};
