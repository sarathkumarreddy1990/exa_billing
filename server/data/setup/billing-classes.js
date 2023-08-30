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
            pageSize,
            colorCode
        } = params;

        if (code) {
            whereQuery.push(` code ILIKE '%${code}%'`);
        }

        if (description) {
            whereQuery.push(` description ILIKE '%${description}%'`);
        }

        if (colorCode) {
            whereQuery.push(` color_code ILIKE '%${colorCode}%'`);
        }

        const sql = SQL`SELECT 
                          id
                        , code
                        , description
                        , inactivated_dt
                        , color_code
                        , COUNT(1) OVER (range unbounded preceding) AS total_records
                    FROM   
                        billing.billing_classes `;

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
                        , inactivated_dt
                        , color_code
                    FROM   
                        billing.billing_classes 
                    WHERE 
                        id = ${id} `;

        return await query(sql);
    },

    create: async (params) => {
        let {
            code,
            description,
            isActive,
            companyId,
            colorCode
        } = params;

        let inactivated_date = isActive ? null : ' now() ';

        const sql = SQL`INSERT INTO 
                        billing.billing_classes (
                              company_id
                            , code
                            , description
                            , inactivated_dt
                            , color_code)
                        SELECT
                               ${companyId}
                             , ${code}
                             , ${description}
                             , ${inactivated_date}
                             , ${colorCode}
                        WHERE NOT EXISTS (
                                SELECT 1
                                FROM billing.billing_classes
                                WHERE code = ${code}
                        )
                             RETURNING *, '{}'::jsonb old_values`;

        return await queryWithAudit(sql, {
            ...params,
            logDescription: `Add: New Billing Class(${code}) created`
        });
    },

    update: async (params) => {

        let {
            code,
            description,
            id,
            isActive,
            colorCode
        } = params;

        let inactivated_date = isActive ? null : ' now() ';

        const sql = SQL`UPDATE
                             billing.billing_classes 
                        SET  
                              code = ${code}
                            , description = ${description}
                            , inactivated_dt = ${inactivated_date}
                            , color_code = ${colorCode}
                        WHERE
                            id = ${id} 
                            RETURNING *,
                                (
                                    SELECT row_to_json(old_row) 
                                    FROM   (SELECT * 
                                            FROM   billing.billing_classes 
                                            WHERE  id = ${id}) old_row 
                                ) old_values`;

        return await queryWithAudit(sql, {
            ...params,
            logDescription: `Update: Billing Class(${code}) updated`
        });
    },

    delete: async (params) => {
        const {
            id,
            code,
            description
        } = params;

        const sql = SQL`DELETE FROM 
                            billing.billing_classes 
                        WHERE id = ${id} RETURNING *, '{}'::jsonb old_values`;

        return await queryWithAudit(sql, {
            ...params,
            logDescription: `Deleted ${description} (${code})`
        });
    }
};
