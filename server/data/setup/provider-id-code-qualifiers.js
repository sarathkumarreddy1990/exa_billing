const { query, SQL } = require('../index');

module.exports = {

    getData: async function (params) {

        params.code = '';
        params.description = '';
        params.pageNo = 1;
        params.pageSize = 10;
        params.sortField = ' qualifier_code ';
        params.sortOrder = params.sortOrder || ' DESC';
        let {
            code,
            description,
            sortOrder,
            sortField,
            pageNo,
            pageSize
        } = params;

        let whereQuery = [];
        
        if (code) {
            whereQuery.push(` qualifier_code ILIKE '%${code}%'`);
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
                                                  , ${inactivated_dt}
                                                ) RETURNING id`;

        return await query(sql);
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
                              id = ${id}`;

        return await query(sql);
    },

    delete: async function (params) {

        let { id } = params;

        const sql = SQL` DELETE FROM
                             billing.provider_id_code_qualifiers
                         WHERE
                             id = ${id}`;

        return await query(sql);
    }
};