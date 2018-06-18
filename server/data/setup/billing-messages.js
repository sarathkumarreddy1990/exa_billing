const { query, SQL, queryWithAudit } = require('../index');

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

    create: async (params) => {
        let {
            code,
            description,
            companyId
        } = params;

        const sql = SQL`WITH update_message AS(
                        UPDATE
                            billing.messages 
                        SET  
                              code = ${code}
                            , description = ${description}
                        WHERE 
                        code = ${code}
                        RETURNING id)
                        INSERT INTO  billing.messages (
                              company_id
                            , code
                            , description)
                        SELECT 
                              ${companyId}
                            , ${code}
                            , ${description} 
                        WHERE NOT EXISTS(SELECT * FROM update_message)
                        RETURNING *, '{}'::jsonb old_values`;

        return await queryWithAudit(sql, {
            ...params,
            logDescription: `Created ${description}(${code})`
        });
    }
};
