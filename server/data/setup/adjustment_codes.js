const { query, SQL } = require('../index');

module.exports = {

    getData: async function (params) {
        let whereQuery = '';
        params.sortOrder = params.sortOrder ? params.sortOrder : ` DESC`;

        const sql = SQL`SELECT 
                          id AS adj_code_id
                        , code
                        , desctiption
                        , accounting_entry_type
                    FROM   
                        billing.adjustment_codes `;
        if (whereQuery) {
            sql.append(whereQuery);
        }
        sql.append(SQL` ORDER BY id `);
        sql.append(params.sortOrder)

        return await query(sql);
    },

    getDataById: async (params) => {
        const { id } = params;
        const sql = SQL`SELECT 
                          id AS adj_code_id
                        , code
                        , desctiption
                        , accounting_entry_type
                    FROM   
                        billing.adjustment_codes 
                    WHERE 
                        id = ${id} `;
        return await query(sql);

    },

    createAdjustment: async (params) => {
        let { code, desc, type, inactive_date } = params;
        inactive_date = inactive_date ? ` now() `: null;
        const sql = SQL`INSERT INTO 
                        billing.adjustment_codes (
                              company_id
                            , code
                            , desctiption
                            , accounting_entry_type
                            , inactivated_dt)
                        VALUES(
                               1
                             , ${code}
                             , ${desc}
                             , ${type} 
                             , ${inactive_date} )`;
        return await query(sql);
    },

    updateAdjustment: async (params) => {
        let { code, desc, type, id, inactive_date } = params;
        inactive_date = inactive_date ? ` now() `: null;
        const sql = SQL`UPDATE
                             billing.adjustment_codes 
                        SET  
                              company_id = 1
                            , code = ${code}
                            , desctiption = ${desc}
                            , accounting_entry_type = ${type}
                            , inactivated_dt = ${inactive_date}
                        WHERE
                            id = ${id} `;
        return await query(sql);
    },

    deleteAdjustment: async (params) => {
        const { id } = params;
        const sql = SQL`DELETE FROM 
                            billing.adjustment_codes 
                        WHERE id = ${id}`;
        return await query(sql);
    }
};