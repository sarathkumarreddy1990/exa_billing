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
            pageSize} = params;

        let whereQuery = [];

        if (insurance_name) {
            whereQuery.push(` ip.insurance_name ILIKE '%${insurance_name}%'`);
        }

        if (claimclearinghouse) {
            whereQuery.push(` ch.name ILIKE '%${claimclearinghouse}%'`);
        }

        const sql = SQL`SELECT 
                              ip.id
                            , ip.insurance_name 
                            , ch.id AS claimclearinghouse
                            , COUNT(1) OVER (range unbounded preceding) AS total_records
                        FROM 
                            public.insurance_providers ip
                        LEFT JOIN billing.insurance_provider_clearinghouses ipch ON ipch.insurance_id  = ip.id
                        LEFT JOIN billing.edi_clearinghouses ch ON ch.id = ipch.clearing_house_id `;

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
                        FROM 
                            public.insurance_providers ip
                        LEFT JOIN billing.insurance_provider_clearinghouses ipch ON ipch.insurance_id  = ip.id
                        LEFT JOIN billing.edi_clearinghouses ch ON ch.id = ipch.clearing_house_id
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
            userId
        } = params;

        const sql = SQL` WITH insert_house AS (
                            INSERT INTO billing.insurance_provider_clearinghouses(
                                  insurance_id
                                , clearing_house_id
                            )
                            SELECT
                                  ${id}
                                , ${claimClearingHouse}
                            WHERE NOT EXISTS (SELECT 1 FROM billing.insurance_provider_clearinghouses WHERE insurance_id = ${id})
                            RETURNING *, '{}'::jsonb old_values
                        )
                        , update_house AS (
                                UPDATE
                                    billing.insurance_provider_clearinghouses
                                SET
                                    clearing_house_id = ${claimClearingHouse}
                                WHERE
                                    insurance_id = ${id} 
                                    AND NOT EXISTS (SELECT 1 FROM insert_house)
                                RETURNING *,
                                (
                                    SELECT row_to_json(old_row) 
                                    FROM   (SELECT * 
                                            FROM   billing.insurance_provider_clearinghouses 
                                            WHERE  insurance_id = ${id}) old_row 
                                ) old_values
                            ),
                            insert_audit_cte AS(
                                SELECT billing.create_audit(
                                    ${companyId},
                                    ${screenName},
                                    insurance_id,
                                    ${screenName},
                                    ${moduleName},
                                    'Clearing House of Ins Prov created ' || insurance_id ,
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
                                    insurance_id,
                                    ${screenName},
                                    ${moduleName},
                                    'Clearing House of Ins Prov updated ' || insurance_id ,
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
