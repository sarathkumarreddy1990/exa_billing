const { query, SQL, queryWithAudit } = require('../index');

module.exports = {

    getData: async function ({ companyId }) {

        const sql = SQL`
            SELECT
                 cps.id
                , cps.company_id
                , cps.acr_claim_status_id
                , cps.acr_min_balance_amount::numeric
                , cps.acr_claim_status_statement_days
                , cps.acr_write_off_adjustment_code_id
                , cps.acr_claim_status_statement_count
                , cps.acr_claim_status_last_payment_days
                , adj.description AS adjustment_desc
                , adj.code AS adjustment_code
            FROM   billing.company_settings cps
            LEFT JOIN billing.adjustment_codes adj ON adj.id = cps.acr_write_off_adjustment_code_id
            WHERE
                cps.company_id = ${companyId}`;

        return await query(sql);

    },

    create: async function (params) {

        let {
            userId,
            companyId,
            acrStatementDays,
            acrStatementCount,
            WriteOffAdjCodeId,
            acrLastPaymentDays,
            minimumAccountBalance,
        } = params;

        const sql = SQL`INSERT INTO billing.company_settings (
                            company_id,
                            acr_claim_status_id,
                            acr_min_balance_amount,
                            acr_write_off_adjustment_code_id,
                            acr_claim_status_statement_days,
                            acr_claim_status_statement_count,
                            acr_claim_status_last_payment_days
                        )
                        SELECT
                            ${companyId}
                            , (SELECT id FROM billing.claim_status WHERE company_id = ${companyId} and code = 'CR' and description = 'Collections Review')
                            , ${minimumAccountBalance}
                            , ${WriteOffAdjCodeId || null}
                            , ${acrStatementDays  || null}
                            , ${acrStatementCount || null}
                            , ${acrLastPaymentDays || null}
                        WHERE NOT EXISTS (
                            SELECT 1 FROM billing.company_settings WHERE company_id = ${companyId}
                        )
                        RETURNING *, '{}'::jsonb old_values `;

        return await queryWithAudit(sql, {
            ...params,
            logDescription: `New: Automatic collections review createdBy ${userId}`
        });
    },

    update: async function (params) {

        let {
            userId,
            companyId,
            acrStatementDays,
            acrStatementCount,
            WriteOffAdjCodeId,
            acrLastPaymentDays,
            minimumAccountBalance,
        } = params;

        const sql = SQL`UPDATE
                            billing.company_settings
                        SET
                            acr_min_balance_amount  = ${minimumAccountBalance},
                            acr_write_off_adjustment_code_id  = ${WriteOffAdjCodeId || null},
                            acr_claim_status_statement_days  = ${acrStatementDays || null},
                            acr_claim_status_statement_count  = ${acrStatementCount || null},
                            acr_claim_status_last_payment_days = ${acrLastPaymentDays || null}
                        WHERE
                            company_id = ${companyId}
                            RETURNING *,
                            (
                                SELECT row_to_json(old_row)
                                FROM( SELECT *
                                        FROM   billing.company_settings
                                        WHERE  company_id = ${companyId}
                                    ) old_row
                            ) old_values`;

        return await queryWithAudit(sql, {
            ...params,
            logDescription: `Update: Automatic collections review updatedBy ${userId}`
        });
    },

    delete: async (params) => {
        const {
            userId,
            companyId
        } = params;

        const sql = SQL`DELETE FROM
                            billing.company_settings
                        WHERE company_id = ${companyId}
                        RETURNING *, '{}'::jsonb old_values`;

        return await queryWithAudit(sql, {
            ...params,
            logDescription: `Deleted: Automatic collections review deletedBy ${userId}`
        });
    }
};
