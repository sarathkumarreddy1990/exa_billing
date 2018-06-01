const { query, SQL } = require('../index');

module.exports = {

    getData: async function (params) {
        let whereQuery = [];
        params.sortOrder = params.sortOrder || ' DESC';
        let {
            code,
            description,
            type,
            sortOrder,
            sortField,
            pageNo,
            pageSize
        } = params;

        if (code) {
            whereQuery.push(` code ILIKE '${code}'`);
        }

        if (description) {
            whereQuery.push(` description ILIKE '${description}'`);
        }

        if (type) {
            whereQuery.push(` accounting_entry_type ILIKE '${type}'`);
        }

        const sql = SQL`SELECT 
                          id
                        , code
                        , description
                        , accounting_entry_type
                    FROM   
                        billing.adjustment_codes `;

        if (whereQuery.length) {
            sql.append(SQL` WHERE `)
                .append(whereQuery.join(' AND '));
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
                        , accounting_entry_type
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
            company_id
        } = params;

        let inactivated_date = isActive ? null : ' now() ';

        const sql = SQL`INSERT INTO 
                        billing.adjustment_codes (
                              company_id
                            , code
                            , description
                            , accounting_entry_type
                            , inactivated_dt)
                        VALUES(
                               ${company_id}
                             , ${code}
                             , ${description}
                             , ${type} 
                             , ${inactivated_date} )`;

        return await query(sql);
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
                            id = ${id} `;

        return await query(sql);
    },

    delete: async (params) => {
        const { id } = params;

        const sql = SQL`DELETE FROM 
                            billing.adjustment_codes 
                        WHERE id = ${id}`;

        return await query(sql);
    }
};