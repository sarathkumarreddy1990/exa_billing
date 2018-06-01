const { query, SQL } = require('../index');

module.exports = {

    getData: async function (params) {
        let whereQuery = '';
        params.qcode = '';
        params.qdesc = '';
        params.pageNo = 1;
        params.pageSize = 10;
        params.sortField = 'id';
        params.sortOrder = params.sortOrder || ` DESC`;
        let {
            qcode,
            qdesc,
            sortOrder,
            sortField,
            pageNo,
            pageSize
        } = params;

        if (params.qcode && params.qdesc) {
            whereQuery = `WHERE code ILIKE '${qcode}' AND description ILIKE '${qdesc}'`;
        } else if (params.qcode && !params.qdesc) {
            whereQuery = `WHERE code ILIKE '${qcode}' `;
        } else if (!params.qcode && params.qdesc) {
            whereQuery = `WHERE description ILIKE '${qdesc}' `;
        } else {
            whereQuery = ` `;
        }

        const sql = SQL`SELECT 
                          id
                        , code
                        , description
                    FROM   
                        billing.cas_reason_codes `;

        if (whereQuery) {
            sql.append(whereQuery);
        }

        sql.append(SQL` ORDER BY ${sortField} `)
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
                    FROM   
                        billing.cas_reason_codes 
                    WHERE 
                        id = ${id} `;

        return await query(sql);
    },

    create: async (params) => {
        let {
            code,
            desc,
            is_active,
            company_id
        } = params;

        let inactivated_date = is_active ? ' now() ' : null;

        const sql = SQL`INSERT INTO 
                        billing.cas_reason_codes (
                              company_id
                            , code
                            , description
                            , inactivated_dt)
                        VALUES(
                               ${company_id}
                             , ${code}
                             , ${desc}
                             , ${inactivated_date} )`;

        return await query(sql);
    },

    update: async (params) => {

        let {
            code,
            desc,
            id,
            is_active
        } = params;

        let inactivated_date = is_active ? ' now() ' : null;

        const sql = SQL`UPDATE
                             billing.cas_reason_codes 
                        SET  
                              code = ${code}
                            , description = ${desc}
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
