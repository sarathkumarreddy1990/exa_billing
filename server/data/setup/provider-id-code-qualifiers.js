const { query, SQL } = require('../index');

module.exports = {

    getData: async function () {

        const sql = SQL`SELECT 
                            id
                            , company_id
                            , inactivated_dt
                            , qualifier_code
                            , description
                            , COUNT(1) OVER (range unbounded preceding) as total_records
                        FROM   billing.provider_id_code_qualifiers
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