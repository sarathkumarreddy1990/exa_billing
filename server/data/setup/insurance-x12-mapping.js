const { query, SQL } = require('../index');

module.exports = {

    getData: async function (params) {

        params.sortOrder = params.sortOrder || ' DESC';
        let {
            insurance_name,
            claimclearinghouse,
            sortOrder,
            sortField,
            pageNo,
            pageSize,
            billing_method
        } = params;

        let whereQuery = [];

        if (insurance_name) {
            whereQuery.push(` ip.insurance_name ILIKE '%${insurance_name}%'`);
        }

        if (claimclearinghouse) {
            whereQuery.push(` ch.name ILIKE '%${claimclearinghouse}%'`);
        }

        if (billing_method) {
            whereQuery.push(` bip.billing_method ILIKE '%${billing_method}%'`);
        }

        const sql = SQL`SELECT 
                              ip.id
                            , ip.insurance_name 
                            , ch.id AS claimclearinghouse
                            , billing_method
                            , COUNT(1) OVER (range unbounded preceding) AS total_records
                        FROM 
                            public.insurance_providers ip
                        LEFT JOIN billing.insurance_providers bip ON bip.insurance_provider_id  = ip.id
                        LEFT JOIN billing.edi_clearinghouses ch ON ch.id = bip.clearing_house_id `;

        if (whereQuery.length) {
            sql.append(SQL` WHERE `)
                .append(whereQuery.join(' AND '));
        }

        sql.append(SQL` ORDER BY `)
            .append(sortField)
            .append(' ')
            .append(sortOrder)
            .append(SQL` LIMIT ${pageSize}`)
            .append(SQL` OFFSET ${((pageNo * pageSize) - pageSize)}`);

        return await query(sql);

    },

    getById: async function (params) {

        let { id } = params;

        const sql = SQL`SELECT 
                              ip.id
                            , ip.insurance_name 
                            , ch.id AS claimclearinghouse
                            , billing_method
                        FROM 
                            public.insurance_providers ip
                        LEFT JOIN billing.insurance_providers bip ON bip.insurance_provider_id  = ip.id
                        LEFT JOIN billing.edi_clearinghouses ch ON ch.id = bip.clearing_house_id
                        WHERE 
                            ip.id = ${id} `;

        return await query(sql);
    },

    update: async function (params) {

        let { 
            id,
            claimClearingHouse,
            companyId,
            screenName,
            moduleName,
            clientIp,
            userId,
            billingMethod
        } = params;

        const sql = SQL` WITH insert_house AS (
                            INSERT INTO billing.insurance_providers(
                                  insurance_provider_id
                                , clearing_house_id
                                , billing_method
                            )
                            SELECT
                                  ${id}
                                , ${claimClearingHouse}
                                , ${billingMethod}
                            WHERE NOT EXISTS (SELECT 1 FROM billing.insurance_providers WHERE insurance_provider_id = ${id})
                            RETURNING *, '{}'::jsonb old_values
                        )
                        , update_house AS (
                                UPDATE
                                    billing.insurance_providers
                                SET
                                      clearing_house_id = ${claimClearingHouse}
                                    , billing_method = ${billingMethod}
                                WHERE
                                    insurance_provider_id = ${id} 
                                    AND NOT EXISTS (SELECT 1 FROM insert_house)
                                RETURNING *,
                                (
                                    SELECT row_to_json(old_row) 
                                    FROM   (SELECT * 
                                            FROM   billing.insurance_providers 
                                            WHERE  insurance_provider_id = ${id}) old_row 
                                ) old_values
                            ),
                            insert_audit_cte AS(
                                SELECT billing.create_audit(
                                    ${companyId},
                                    ${screenName},
                                    insurance_provider_id,
                                    ${screenName},
                                    ${moduleName},
                                    'Clearing House of Ins Prov created ' || insurance_provider_id ,
                                    ${clientIp || '127.0.0.1'},
                                    json_build_object(
                                        'old_values', (SELECT COALESCE(old_values, '{}') FROM insert_house),
                                        'new_values', (SELECT row_to_json(temp_row)::jsonb - 'old_values'::text FROM (SELECT * FROM insert_house) temp_row)
                                    )::jsonb,
                                    ${userId || 0}
                                ) id
                                from insert_house
                            ),
                            update_audit_cte AS(
                                SELECT billing.create_audit(
                                    ${companyId},
                                    ${screenName},
                                    insurance_provider_id,
                                    ${screenName},
                                    ${moduleName},
                                    'Clearing House of Ins Prov updated ' || insurance_provider_id ,
                                    ${clientIp || '127.0.0.1'},
                                    json_build_object(
                                        'old_values', (SELECT COALESCE(old_values, '{}') FROM update_house),
                                        'new_values', (SELECT row_to_json(temp_row)::jsonb - 'old_values'::text FROM (SELECT * FROM update_house) temp_row)
                                    )::jsonb,
                                    ${userId || 0}
                                ) id
                                from update_house
                            )
                            SELECT id FROM insert_audit_cte 
                            UNION
                            SELECT id FROM update_audit_cte `;

        return await query(sql);
    }
};
