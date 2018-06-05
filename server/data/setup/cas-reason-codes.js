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
                        , inactivated_dt
                        , COUNT(1) OVER (range unbounded preceding) AS total_records
                    FROM   
                        billing.cas_reason_codes `;

        if (whereQuery.length) {
            sql.append(SQL` WHERE `)
                .append(whereQuery.join(' AND '));
        }

        sql.append(SQL` ORDER BY `)
            .append(sortField)
            .append(' ')
            .append(sortOrder)
            .append(SQL` LIMIT ${pageSize}`)
            .append(SQL` OFFSET ${(pageNo * pageSize - pageSize)}`);

        return await query(sql);
    },

    getDataById: async (params) => {
        const { id } = params;

        const sql = SQL`SELECT 
                          id
                        , code
                        , description
                        , inactivated_dt
                    FROM   
                        billing.cas_reason_codes 
                    WHERE 
                        id = ${id} `;

        return await query(sql);
    },

    create: async (params) => {
        let {
            code,
            description,
            isActive,
            companyId
        } = params;

        let inactivated_date = isActive ? null : ' now() ';

        const sql = SQL`INSERT INTO 
                        billing.cas_reason_codes (
                              company_id
                            , code
                            , description
                            , inactivated_dt)
                        VALUES(
                               ${companyId}
                             , ${code}
                             , ${description}
                             , ${inactivated_date} )
                        RETURNING id`;

        return await query(sql);
    },

    update: async (params) => {

        let {
            code,
            description,
            id,
            isActive
        } = params;

        let inactivated_date = isActive ? null : ' now() ';

        const sql = SQL`UPDATE
                             billing.cas_reason_codes 
                        SET  
                              code = ${code}
                            , description = ${description}
                            , inactivated_dt = ${inactivated_date}
                        WHERE
                            id = ${id} `;

        return await query(sql);
    },

    delete: async (params) => {
        const { id } = params;

        const sql = SQL`DELETE FROM 
                            billing.cas_reason_codes 
                        WHERE id = ${id}`;

        return await query(sql);
    }
};
