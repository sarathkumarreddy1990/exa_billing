const { query, SQL } = require('../index');

module.exports = {

    getData: async function (params) {
        let whereQuery = [];
        params.sortOrder = params.sortOrder || ' ASC';
        let {
            code,
            description,
            sortOrder,
            sortField,
            pageNo,
            pageSize
        } = params;

        if (code) {
            whereQuery.push(` code ILIKE '%${code}%'`);
        }

        if (description) {
            whereQuery.push(` description ILIKE '%${description}%'`);
        }

        const sql = SQL`SELECT 
                          id
                        , code
                        , description
                        , COUNT(1) OVER (range unbounded preceding) AS total_records
                    FROM   
                        billing.messages `;

        if (whereQuery.length) {
            sql.append(SQL` WHERE `)
                .append(whereQuery.join(' AND '));
        }

        sql.append(SQL` ORDER BY `)
            .append(sortField)
            .append(' ')
            .append(sortOrder)
            .append(SQL` LIMIT ${pageSize} `)
            .append(SQL` OFFSET ${((pageNo * pageSize) - pageSize)}`);

        return await query(sql);
    },

    getDataById: async (params) => {
        const { id } = params;

        const sql = SQL`SELECT
        id
            , code
            , description
        FROM
        billing.messages
        WHERE
        id = ${id} `;

        return await query(sql);
    },

    createOrUpdate: async (params) => {
        let {
            id,
            code,
            description,
            companyId,
            screenName,
            moduleName,
            clientIp,
            userId
        } = params;


        const sql = SQL`WITH insert_message AS(
                            INSERT INTO  billing.messages (
                                company_id
                                , code
                                , description)
                            SELECT 
                                ${companyId}
                              , ${code}
                              , ${description}    
                            WHERE NOT EXISTS(SELECT 1 FROM billing.messages WHERE id = ${id})
                            RETURNING *, '{}'::jsonb old_values),
                            update_messages AS(UPDATE
                                billing.messages 
                            SET  
                                code = ${code}
                              , description = ${description} 
                            WHERE id = ${id} 
                            AND NOT EXISTS (SELECT 1 FROM insert_message)
                            RETURNING *,
                            (
                            SELECT row_to_json(old_row) 
                            FROM   (SELECT * 
                                        FROM   billing.providers 
                                        WHERE  id = ${id}) old_row 
                            ) old_values),
                        insert_audit_cte AS(
                            SELECT billing.create_audit(
                                ${companyId},
                                ${screenName},
                                id,
                                ${screenName},
                                ${moduleName},
                                'Billing message created ' || code ,
                                ${clientIp || '127.0.0.1'},
                                json_build_object(
                                    'old_values', (SELECT COALESCE(old_values, '{}') FROM insert_message),
                                    'new_values', (SELECT row_to_json(temp_row)::jsonb - 'old_values'::text FROM (SELECT * FROM insert_message) temp_row)
                                )::jsonb,
                                ${userId || 0}
                            ) id
                            from insert_message
                        ),
                        update_audit_cte AS(
                            SELECT billing.create_audit(
                                ${companyId},
                                ${screenName},
                                id,
                                ${screenName},
                                ${moduleName},
                                'Billing message updated ' || code ,
                                ${clientIp || '127.0.0.1'},
                                json_build_object(
                                    'old_values', (SELECT COALESCE(old_values, '{}') FROM update_messages),
                                    'new_values', (SELECT row_to_json(temp_row)::jsonb - 'old_values'::text FROM (SELECT * FROM update_messages) temp_row)
                                )::jsonb,
                                ${userId || 0}
                            ) id
                            from update_messages
                        )
                        SELECT id FROM insert_audit_cte 
                        UNION
                        SELECT id FROM update_audit_cte `;

        return await query(sql);
    }
};
