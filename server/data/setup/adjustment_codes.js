const { query, SQL } = require('../index');

module.exports = {

    getData: async function (params) {
        let whereQuery = '';
        params.sortOrder = params.sortOrder || ' DESC';

        const sql = SQL`SELECT 
                          id
                        , code
                        , desctiption
                        , accounting_entry_type
                    FROM   
                        billing.adjustment_codes `;

        if (whereQuery) {
            sql.append(whereQuery);
        }

        sql.append(SQL` ORDER BY id `);
        sql.append(params.sortOrder);

        return await query(sql);
    },

    getDataById: async (params) => {
        const { id } = params;

        const sql = SQL`SELECT 
                          id
                        , code
                        , desctiption
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
            desc,
            type,
            is_active,
            company_id
        } = params;

        let inactivated_date = is_active ? ' now() ' : null;

        const sql = SQL`INSERT INTO 
                        billing.adjustment_codes (
                              company_id
                            , code
                            , desctiption
                            , accounting_entry_type
                            , inactivated_dt)
                        VALUES(
                               ${company_id}
                             , ${code}
                             , ${desc}
                             , ${type} 
                             , ${inactivated_date} )`;

        return await query(sql);
    },

    update: async (params) => {

        let {
            code,
            desc,
            type,
            id,
            is_active
        } = params;

        let inactivated_date = is_active ? ' now() ' : null;

        const sql = SQL`UPDATE
                             billing.adjustment_codes 
                        SET  
                              code = ${code}
                            , desctiption = ${desc}
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
