const { query, SQL, queryWithAudit } = require('../index');

module.exports = {

    getData: async function (params) {

        params.sortOrder = params.sortOrder || ' DESC';
        let {
            code,
            name,
            description,
            sortOrder,
            sortField,
            pageNo,
            pageSize
        } = params;

        let whereQuery = [];

        if (code) {
            whereQuery.push(` code ILIKE '%${code}%'`);
        }

        if (name) {
            whereQuery.push(` name ILIKE '%${name}%'`);
        }

        if (description) {
            whereQuery.push(` description ILIKE '%${description}%'`);
        }

        const sql = SQL`SELECT 
                            id
                            , company_id
                            , inactivated_dt
                            , code
                            , name
                            , description
                            , COUNT(1) OVER (range unbounded preceding) as total_records
                        FROM   billing.cas_group_codes`;

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
                            , code
                            , name
                            , description
                        FROM   billing.cas_group_codes
                        WHERE 
                            id = ${id} `;

        return await query(sql);
    },

    create: async function (params) {

        let {
            companyId,
            code,
            name,
            description,
            isActive } = params;
        let inactivated_dt = isActive ? null : 'now()';

        const sql = SQL` INSERT INTO billing.cas_group_codes
                                                (   company_id
                                                  , code
                                                  , name
                                                  , description
                                                  , inactivated_dt)
                                                values
                                                (
                                                    ${companyId}
                                                  , ${code}
                                                  , ${name}
                                                  , ${description}
                                                  , ${inactivated_dt} ) 
                                                  RETURNING *, '{}'::jsonb old_values`;

        return await queryWithAudit(sql, {
            ...params,
            logDescription: `Created ${description}(${code})`
        });
    },

    update: async function (params) {

        let { id,
            code,
            name,
            description,
            isActive } = params;
        let inactivated_dt = isActive ? null : 'now()';

        const sql = SQL` UPDATE
                              billing.cas_group_codes
                         SET
                              code = ${code}
                            , name = ${name}
                            , description = ${description}
                            , inactivated_dt = ${inactivated_dt}
                         WHERE
                              id = ${id} 
                              RETURNING *,
                              (
                                  SELECT row_to_json(old_row) 
                                  FROM   (SELECT * 
                                          FROM   billing.cas_group_codes 
                                          WHERE  id = ${id}) old_row 
                              ) old_values`;

        return await queryWithAudit(sql, {
            ...params,
            logDescription: `Updated ${description}(${code})`
        });
    },

    delete: async function (params) {

        let { id } = params;

        const sql = SQL` DELETE FROM
                             billing.cas_group_codes
                         WHERE
                             id = ${id} RETURNING *, '{}'::jsonb old_values`;

        return await queryWithAudit(sql, {
            ...params,
            logDescription: 'Deleted.'
        });
    }
};