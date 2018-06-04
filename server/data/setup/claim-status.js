const { query, SQL } = require('../index');

module.exports = {

    getData: async function (params) {
        let whereQuery = [];
        params.sortOrder = params.sortOrder || ' ASC';
        let {
            code,
            description,
            isSystemStatus,
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

        if(isSystemStatus == 'true'){
            whereQuery.push(' is_system_status ');
        }else if(isSystemStatus == 'false'){
            whereQuery.push(' NOT is_system_status ');
        }

        const sql = SQL`SELECT 
                          id
                        , code
                        , description
                        , is_system_status
                        , COUNT(1) OVER (range unbounded preceding) AS total_records
                    FROM   
                        billing.claim_status `;

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
                        , is_system_status
                    FROM   
                        billing.claim_status 
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
            isSystemStatus
        } = params;

        let inactivated_date = isActive ? null : ' now() ';

        const sql = SQL`INSERT INTO 
                        billing.claim_status (
                              company_id
                            , code
                            , description
                            , inactivated_dt
                            , is_system_status)
                        VALUES(
                               ${companyId}
                             , ${code}
                             , ${description}
                             , ${inactivated_date}
                             , ${isSystemStatus} )
                        RETURNING id`;

        return await query(sql);
    },

    update: async (params) => {

        let {
            code,
            description,
            id,
            isActive,
            isSystemStatus
        } = params;

        let inactivated_date = isActive ? null : ' now() ';

        const sql = SQL`UPDATE
                             billing.claim_status 
                        SET  
                              code = ${code}
                            , description = ${description}
                            , inactivated_dt = ${inactivated_date}
                            , is_system_status = ${isSystemStatus}
                        WHERE
                            id = ${id} `;

        return await query(sql);
    },

    delete: async (params) => {
        const { id } = params;

        const sql = SQL`DELETE FROM 
                            billing.claim_status 
                        WHERE id = ${id}`;

        return await query(sql);
    }
};
