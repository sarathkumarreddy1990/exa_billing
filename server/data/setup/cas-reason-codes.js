const { query, SQL, queryWithAudit } = require('../index');

module.exports = {

    getData: async function (params) {
        let whereQuery = [];
        params.sortOrder = params.sortOrder || ' ASC';
        let {
            code,
            description,
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

        const sql = SQL`SELECT
                          id
                        , code
                        , description
                        , inactivated_dt
                        , COUNT(1) OVER (range unbounded preceding) AS total_records
                    FROM
                        billing.cas_reason_codes `;

        if (whereQuery.length) {
            sql.append(SQL` WHERE `)
                .append(whereQuery.join(' AND '));
        }

        sql.append(SQL` ORDER BY `)
            .append(sortField)
            .append(' ')
            .append(sortOrder)
            .append(SQL` LIMIT ${pageSize}`)
            .append(SQL` OFFSET ${(pageNo * pageSize - pageSize)}`);

        return await query(sql);
    },

    getDataById: async (params) => {
        const { id } = params;

        const sql = SQL`SELECT
                          id
                        , code
                        , description
                        , inactivated_dt
                    FROM
                        billing.cas_reason_codes
                    WHERE
                        id = ${id} `;

        return await query(sql);
    },

    create: async (params) => {
        let {
            code,
            description,
            isActive,
            companyId
        } = params;

        let inactivated_date = isActive ? null : ' now() ';

        const sql = SQL`INSERT INTO
                        billing.cas_reason_codes (
                              company_id
                            , code
                            , description
                            , inactivated_dt)
                        SELECT
                               ${companyId}
                             , ${code}
                             , ${description}
                             , ${inactivated_date}
                        WHERE NOT EXISTS (
                            SELECT  1
                            FROM    billing.cas_reason_codes
                            WHERE   company_id = ${companyId}
                                    AND code = ${code}
                        )
                        RETURNING *, '{}'::jsonb old_values`;

        return await queryWithAudit(sql, {
            ...params,
            logDescription: `Add: CAS Reason Code(${code}) created `
        });
    },

    update: async (params) => {

        let {
            code,
            description,
            id,
            isActive,
            companyId,
        } = params;

        let inactivated_date = isActive ? null : ' now() ';

        const sql = SQL`UPDATE
                             billing.cas_reason_codes
                        SET
                              code = ${code}
                            , description = ${description}
                            , inactivated_dt = ${inactivated_date}
                        WHERE
                            id = ${id}
                            AND NOT EXISTS (
                                SELECT  1
                                FROM    billing.cas_reason_codes
                                WHERE   id != ${id}
                                        AND company_id = ${companyId}
                                        AND code = ${code}
                            )
                            RETURNING *,
                            (
                                SELECT row_to_json(old_row)
                                FROM   (SELECT *
                                        FROM   billing.cas_reason_codes
                                        WHERE  id = ${id}) old_row
                            ) old_values`;

        return await queryWithAudit(sql, {
            ...params,
            logDescription: `Update: CAS Reason Code(${code}) updated`
        });
    },

    delete: async (params) => {
        const {
            id,
            code,
            description
        } = params;

        const sql = SQL`DELETE FROM
                            billing.cas_reason_codes
                        WHERE id = ${id} RETURNING *, '{}'::jsonb old_values`;

        return await queryWithAudit(sql, {
            ...params,
            logDescription: `Deleted ${description} (${code})`
        });
    }
};
