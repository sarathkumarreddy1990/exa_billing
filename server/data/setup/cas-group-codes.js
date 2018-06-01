const { query, SQL } = require('../index');

module.exports = {

    getData: async function () {

        const sql = SQL`SELECT 
                            id
                            , company_id
                            , inactivated_dt
                            , code
                            , name
                            , description
                            , COUNT(1) OVER (range unbounded preceding) as total_records
                        FROM   billing.cas_group_codes
                        ORDER  BY id DESC 
                        LIMIT  10 `;

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
                                                  , ${inactivated_dt}
                                                ) RETURNING id`;

        return await query(sql);
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
                              id = ${id}`;

        return await query(sql);
    },

    delete: async function (params) {

        let { id } = params;

        const sql = SQL` DELETE FROM
                             billing.cas_group_codes
                         WHERE
                             id = ${id}`;

        return await query(sql);
    }
};