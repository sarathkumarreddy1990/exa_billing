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
            insurance_id,
            clearing_house_id,
            sortOrder,
            sortField,
            pageNo,
            pageSize
        } = params;

        if (insurance_id) {
            whereQuery.push(` insurance_id ILIKE '%${insurance_id}%'`);
        }

        if (clearing_house_id) {
            whereQuery.push(` clearing_house_id ILIKE '%${clearing_house_id}%'`);
        }

        const sql = SQL`SELECT 
                          insurance_id
                        , clearing_house_id
                        , COUNT(1) OVER (range unbounded preceding) AS total_records
                    FROM   
                        billing.insurance_provider_clearinghouses `;

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
        const { insurance_id } = params;

        const sql = SQL`SELECT 
                          insurance_id
                        , clearing_house_id
                    FROM   
                        billing.insurance_provider_clearinghouses 
                    WHERE 
                        insurance_id = ${insurance_id} `;

        return await query(sql);
    },

    create: async (params) => {
        let {
            insuranceId,
            clearingHouseId
        } = params;

        const sql = SQL`
                    INSERT INTO billing.insurance_provider_clearinghouses 
                    ( 
                        insurance_id , 
                        clearing_house_id 
                    ) 
                    VALUES 
                    (
                        ${insuranceId} , 
                        ${clearingHouseId} 
                    )
                    RETURNING *, '{}'::jsonb old_values
        `;

        return await queryWithAudit(sql, {
            ...params,
            logDescription: `Created ${insuranceId}(${clearingHouseId})`
        });
    },

    update: async (params) => {

        let {
            insuranceId,
            clearingHouseId
        } = params;

        const sql = SQL`UPDATE
                             billing.insurance_provider_clearinghouses 
                        SET  
                            clearing_house_id = ${clearingHouseId}
                        WHERE
                        insurance_id = ${insuranceId} 
                        RETURNING *,
                            (
                                SELECT row_to_json(old_row) 
                                FROM   (SELECT * 
                                        FROM   billing.insurance_provider_clearinghouses 
                                        WHERE  insurance_id = ${insuranceId}) old_row 
                            ) old_values
                    `;

        return await queryWithAudit(sql, {
            ...params,
            logDescription: `Updated ${insuranceId}(${clearingHouseId})`
        });
    },

    delete: async (params) => {
        const { clearingHouseId } = params;

        const sql = SQL`DELETE FROM 
                            billing.insurance_provider_clearinghouses 
                        WHERE insurance_id = ${clearingHouseId}
                        RETURNING *, '{}'::jsonb old_values
                        `;

        return await queryWithAudit(sql, {
            ...params,
            logDescription: 'Deleted.'
        });
    }
};
