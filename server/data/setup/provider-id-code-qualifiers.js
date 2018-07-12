const { query, SQL, queryWithAudit } = require('../index');

module.exports = {

    getData: async function (params) {


        params.sortOrder = params.sortOrder || ' DESC';
        let {
            qualifier_code,
            description,
            sortOrder,
            sortField,
            pageNo,
            pageSize
        } = params;

        let whereQuery = [];

        if (qualifier_code) {
            whereQuery.push(` qualifier_code ILIKE '%${qualifier_code}%'`);
        }

        if (description) {
            whereQuery.push(` description ILIKE '%${description}%'`);
        }

        const sql = SQL`SELECT 
                            id
                            , company_id
                            , inactivated_dt
                            , qualifier_code
                            , description
                            , COUNT(1) OVER (range unbounded preceding) as total_records
                        FROM   billing.provider_id_code_qualifiers`;

        if (whereQuery.length) {
            sql.append(SQL` WHERE `)
                .append(whereQuery.join(' AND '));
        }

        sql.append(SQL` ORDER BY `)
            .append(sortField)
            .append(' ')
            .append(sortOrder)
            .append(SQL` LIMIT ${pageSize}`)
            .append(SQL` OFFSET ${((pageNo * pageSize) - pageSize)}`);

        return await query(sql);
    },

    getById: async function (params) {

        let { id } = params;

        const sql = SQL`SELECT 
                              id
                            , company_id
                            , inactivated_dt
                            , qualifier_code
                            , description
                        FROM   billing.provider_id_code_qualifiers
                        WHERE 
                            id = ${id} `;

        return await query(sql);
    },

    create: async function (params) {

        let {
            companyId,
            code,
            description,
            isActive } = params;
        let inactivated_dt = isActive ? null : 'now()';

        const sql = SQL` INSERT INTO billing.provider_id_code_qualifiers
                                                (   company_id
                                                  , qualifier_code
                                                  , description
                                                  , inactivated_dt)
                                                values
                                                (
                                                    ${companyId}
                                                  , ${code}
                                                  , ${description}
                                                  , ${inactivated_dt})
                                                  RETURNING *, '{}'::jsonb old_values`;

        return await queryWithAudit(sql, {
            ...params,
            logDescription: `Created ${description}(${code})`
        });
    },

    update: async function (params) {

        let { id,
            code,
            description,
            isActive } = params;
        let inactivated_dt = isActive ? null : 'now()';

        const sql = SQL` UPDATE
                              billing.provider_id_code_qualifiers
                         SET
                              qualifier_code = ${code}
                            , description = ${description}
                            , inactivated_dt = ${inactivated_dt}
                         WHERE
                              id = ${id} 
                              RETURNING *,
                                  (
                                      SELECT row_to_json(old_row) 
                                      FROM   (SELECT * 
                                              FROM   billing.provider_id_code_qualifiers 
                                              WHERE  id = ${id}) old_row 
                                  ) old_values`;

        return await queryWithAudit(sql, {
            ...params,
            logDescription: `Updated ${description}(${code})`
        });
    },

    delete: async function (params) {

    const {
            id,
            code,
            description
        } = params;

        const sql = SQL` DELETE FROM
                             billing.provider_id_code_qualifiers
                       
                             WHERE id = ${id} RETURNING *, '{}'::jsonb old_values`;

        return await queryWithAudit(sql, {
            ...params,
            logDescription: `Deleted ${description} (${code})`
        });
    }
};
