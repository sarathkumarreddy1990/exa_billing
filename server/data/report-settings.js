const { query, SQL } = require('./index');

module.exports = {
    getReportSetting: async function (params) {
        const {
            companyId,
            report_id,
            code
        } = params;
        const sql = SQL`SELECT
                rs.country_alpha_3_code,
                rs.value,
                ( cs.acr_write_off_debit_adjustment_code_id IS NOT NULL AND 
                  cs.acr_write_off_credit_adjustment_code_id IS NOT NULL 
                ) AS claim_write_off_required
            FROM report_settings rs
            LEFT JOIN billing.company_settings cs ON cs.company_id = ${companyId}
            WHERE rs.company_id = ${companyId}
            AND rs.report_id = ${report_id}
            AND rs.code = ${code}
            AND rs.country_alpha_3_code = (SELECT country_alpha_3_code
                                        FROM public.sites
                                        WHERE id = 1)`;

        return await query(sql);
    }
};
