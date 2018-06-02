const { query, SQL } = require('../index');

module.exports = {

    getData: async function (params) {

        let whereQuery = [];
        params.code = '';
        params.description = '';
        params.pageNo = 1;
        params.pageSize = 10;
        params.sortField = ' code ';
        params.sortOrder = params.sortOrder || ' DESC';

        let {
            code,
            description,
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


        const sql = SQL`SELECT 
                          id
                        , company_id
                        , inactivated_dt
                        , code
                        , description
                        , reading_provider_percent_level
                        , COUNT(1) OVER (range unbounded preceding) AS total_records
                    FROM   
                        public.provider_level_codes `;

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

    getById: async (params) => {
        const { id } = params;

        const sql = SQL`SELECT 
                          id
                        , company_id
                        , inactivated_dt
                        , code
                        , description
                        , reading_provider_percent_level
                    FROM   
                    public.provider_level_codes 
                    WHERE 
                        id = ${id} `;

        return await query(sql);
    },

    create: async (params) => {

        let {
            code,
            description,
            isActive,
            readingProviderPercentLevel,
            companyId
        } = params;

        let inactivated_dt = isActive ? null : ' now() ';

        const sql = SQL`INSERT INTO 
                        public.provider_level_codes (
                              company_id
                              , inactivated_dt
                              , code
                              , description
                              , reading_provider_percent_level)
                        VALUES(
                               ${companyId}
                             , ${inactivated_dt}
                             , ${code}
                             , ${description} 
                             , ${readingProviderPercentLevel} 
                            ) RETURNING id`;

        return await query(sql);
    },

    update: async (params) => {

        let {
            id,
            code,
            description,
            isActive,
            readingProviderPercentLevel
        } = params;

        let inactivated_dt = isActive ? null : ' now() ';

        const sql = SQL`UPDATE
                        public.provider_level_codes 
                        SET  
                              code = ${code}
                            , description = ${description}
                            , reading_provider_percent_level = ${readingProviderPercentLevel}
                            , inactivated_dt = ${inactivated_dt}
                        WHERE
                            id = ${id} `;

        return await query(sql);
    },

    delete: async (params) => {
        const { id } = params;

        const sql = SQL`DELETE FROM 
                            public.provider_level_codes 
                        WHERE id = ${id}`;

        return await query(sql);
    }
};