const { query, SQL, queryWithAudit } = require('../index');

module.exports = {

    getData: async function ({ userId, companyId }) {

        const sql = SQL`
            SELECT
                 cps.id
                , cps.user_id
                , cps.statement_frequency
                , cps.minimum_account_balance::numeric
                , cps.payment_frequency_stmt_wise
                , cps.can_process_auto_collections
                , cps.write_off_adjustment_code_id
                , cps.payment_frequency_last_pymt_wise
                , adj.description AS adjustment_desc
                , adj.code AS adjustment_code
            FROM   billing.collections_process_settings cps
            LEFT JOIN billing.adjustment_codes adj ON adj.id = cps.write_off_adjustment_code_id
            WHERE
                cps.user_id = ${userId}
                AND cps.company_id = ${companyId}`;

        return await query(sql);

    },

    create: async function (params) {

        let {
            userId,
            companyId,
            statementFreq,
            WriteOffAdjCodeId,
            paymentFreqStmtWise,
            minimumAccountBalance,
            isAutoCollectionProcess,
            paymentFreqLastPaymentWise,
        } = params;

        const sql = SQL`INSERT INTO billing.collections_process_settings (
                            user_id,
                            company_id,
                            created_by,
                            created_dt,
                            updated_by,
                            updated_dt,
                            statement_frequency,
                            minimum_account_balance,
                            payment_frequency_stmt_wise,
                            can_process_auto_collections,
                            write_off_adjustment_code_id,
                            payment_frequency_last_pymt_wise
                        )
                        SELECT
                            ${userId}
                            , ${companyId}
                            , ${userId}
                            , now()
                            , ${userId}
                            , now()
                            , ${statementFreq || null}
                            , ${minimumAccountBalance}
                            , ${paymentFreqStmtWise || null}
                            , ${isAutoCollectionProcess}
                            , ${WriteOffAdjCodeId || null}
                            , ${paymentFreqLastPaymentWise || null}
                        WHERE NOT EXISTS (
                            SELECT 1 FROM billing.collections_process_settings WHERE user_id = ${userId} AND company_id = ${companyId}
                        )
                        RETURNING *, '{}'::jsonb old_values `;

        return await queryWithAudit(sql, {
            ...params,
            logDescription: `New: Collections process createdBy ${userId}`
        });
    },

    update: async function (params) {

        let {
            userId,
            companyId,
            statementFreq,
            WriteOffAdjCodeId,
            paymentFreqStmtWise,
            minimumAccountBalance,
            isAutoCollectionProcess,
            paymentFreqLastPaymentWise,
        } = params;

        const sql = SQL`UPDATE
                            billing.collections_process_settings
                        SET
                            user_id = ${userId},
                            company_id = ${companyId},
                            updated_by = ${userId},
                            updated_dt = now(),
                            statement_frequency = ${statementFreq || null},
                            minimum_account_balance = ${minimumAccountBalance},
                            payment_frequency_stmt_wise = ${paymentFreqStmtWise || null},
                            can_process_auto_collections = ${isAutoCollectionProcess},
                            write_off_adjustment_code_id = ${WriteOffAdjCodeId || null},
                            payment_frequency_last_pymt_wise = ${paymentFreqLastPaymentWise || null}
                        WHERE
                            AND user_id = ${userId}
                            AND company_id = ${companyId}
                            RETURNING *,
                            (
                                SELECT row_to_json(old_row)
                                FROM( SELECT *
                                        FROM   billing.collections_process_settings
                                        WHERE  user_id = ${userId}
                                        AND company_id = ${companyId}
                                    ) old_row
                            ) old_values`;

        return await queryWithAudit(sql, {
            ...params,
            logDescription: `Update: Collections process updatedBy ${userId}`
        });
    },

    delete: async (params) => {
        const {
            userId,
            companyId
        } = params;

        const sql = SQL`DELETE FROM
                            billing.collections_process_settings
                        WHERE user_id = ${userId}
                        AND company_id = ${companyId}
                        RETURNING *, '{}'::jsonb old_values`;

        return await queryWithAudit(sql, {
            ...params,
            logDescription: `Deleted: Collections process deletedBy ${userId}`
        });
    }
};
