const {
    SQL,
    query,
    queryWithAudit
} = require('../index');

module.exports = {

    getData: async function (params) {
        let whereQuery = [];
        params.sortOrder = params.sortOrder || ' ASC';
        let {
            code,
            description,
            accounting_entry_type,
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

        if (accounting_entry_type) {
            whereQuery.push(` accounting_entry_type ILIKE '%${accounting_entry_type}%'`);
        }

        const sql = SQL`SELECT 
                          id
                        , code
                        , description
                        , accounting_entry_type
                        , inactivated_dt
                        , COUNT(1) OVER (range unbounded preceding) AS total_records
                    FROM   
                        billing.adjustment_codes `;

        if (whereQuery.length) {
            sql.append(SQL` WHERE `)
                .append(whereQuery.join(' AND '));
        }

        sql.append(SQL` ORDER BY  `)
            .append(sortField)
            .append(' ')
            .append(sortOrder)
            .append(SQL` LIMIT ${pageSize}`)
            .append(SQL` OFFSET ${((pageNo * pageSize) - pageSize)}`);

        return await query(sql);
    },

    getDataById: async (params) => {
        const { id } = params;

        const sql = SQL`SELECT 
                          id
                        , code
                        , description
                        , accounting_entry_type
                        , inactivated_dt
                    FROM   
                        billing.adjustment_codes 
                    WHERE 
                        id = ${id} `;

        return await query(sql);
    },

    create: async (params) => {
        let {
            code,
            description,
            type,
            isActive,
            companyId
        } = params;

        let inactivated_date = isActive ? null : ' now() ';

        const sql = SQL`
                    INSERT INTO billing.adjustment_codes 
                    ( 
                        company_id , 
                        code , 
                        description , 
                        accounting_entry_type , 
                        inactivated_dt 
                    ) 
                    VALUES 
                    ( 
                        ${companyId} , 
                        ${code} , 
                        ${description} , 
                        ${type} , 
                        ${inactivated_date} 
                    )
                    RETURNING *, '{}'::jsonb old_values
        `;

        return await queryWithAudit(sql, {
            ...params,
            logDescription: `Created ${description}(${code})`
        });
    },

    update: async (params) => {

        let {
            code,
            description,
            type,
            id,
            isActive
        } = params;

        let inactivated_date = isActive ? null : ' now() ';

        const sql = SQL`UPDATE
                             billing.adjustment_codes 
                        SET  
                              code = ${code}
                            , description = ${description}
                            , accounting_entry_type = ${type}
                            , inactivated_dt = ${inactivated_date}
                        WHERE
                            id = ${id} 
                        RETURNING *,
                            (
                                SELECT row_to_json(old_row) 
                                FROM   (SELECT * 
                                        FROM   billing.adjustment_codes 
                                        WHERE  id = ${id}) old_row 
                            ) old_values
                    `;

        return await queryWithAudit(sql, {
            ...params,
            logDescription: `Updated ${description}(${code})`
        });
    },

    delete: async (params) => {
        const {
            id,
            code,
            description
        } = params;

        const sql = SQL`DELETE FROM 
                            billing.adjustment_codes 
                        WHERE id = ${id}
                        RETURNING *, '{}'::jsonb old_values
                        `;

        return await queryWithAudit(sql, {
            ...params,
            logDescription: `Deleted ${description} (${code})`
        });
    }
};
