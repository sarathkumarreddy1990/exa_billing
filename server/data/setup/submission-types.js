const {
    SQL,
    query,
    queryWithAudit
} = require('../index');

module.exports = {

    getData: async function (params) {
        let whereQuery = [];
        let {
            code,
            description,
            country_code,
            province_code,
            sortOrder = ' ASC',
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

        if (country_code) {
            whereQuery.push(` country_code ILIKE '%${country_code}%'`);
        }

        if (province_code) {
            whereQuery.push(` province_code ILIKE '%${province_code}%'`);
        }

        const sql = SQL`SELECT
                          id
                        , code
                        , description
                        , country_code
                        , province_code
                        , inactivated_dt
                        , COUNT(1) OVER (range unbounded preceding) AS total_records
                    FROM
                        billing.claim_submission_codes `;

        if (whereQuery.length) {
            sql.append(SQL` WHERE `)
                .append(whereQuery.join(' AND '));
        }

        sql.append(SQL` ORDER BY`)
            .append(` ${sortField}`)
            .append(` ${sortOrder}`)
            .append(SQL` LIMIT ${pageSize}`)
            .append(SQL` OFFSET ${((pageNo * pageSize) - pageSize)}`);

        return await query(sql);
    },

    getDataById: async ({ id }) => {

        const sql = SQL`SELECT
                          id
                        , code
                        , description
                        , country_code
                        , province_code
                        , inactivated_dt
                    FROM
                        billing.claim_submission_codes
                    WHERE
                        id = ${id} `;

        return await query(sql);
    },

    create: async (params) => {
        let {
            code,
            description,
            country_code,
            province_code,
            isInActive,
            companyId
        } = params;

        let inactivated_dt = isInActive ? ' now() ' : null;

        const sql = SQL`
                    INSERT INTO billing.claim_submission_codes
                    (
                        company_id,
                        code,
                        description,
                        country_code,
                        province_code,
                        inactivated_dt
                    )
                    VALUES
                    (
                        ${companyId},
                        ${code},
                        ${description},
                        ${country_code},
                        ${province_code},
                        ${inactivated_dt}
                    )
                    RETURNING *, '{}'::jsonb old_values
        `;

        return await queryWithAudit(sql, {
            ...params,
            logDescription: `Add: New Submission type(${code}) created`
        });
    },

    update: async (params) => {

        let {
            code,
            description,
            country_code,
            province_code,
            isInActive,
            id
        } = params;

        let inactivated_dt = isInActive ? ' now() ' : null;

        const sql = SQL`UPDATE
                             billing.claim_submission_codes
                        SET
                              code = ${code}
                            , description = ${description}
                            , country_code = ${country_code}
                            , province_code = ${province_code}
                            , inactivated_dt = ${inactivated_dt}
                        WHERE
                            id = ${id}
                        RETURNING *,
                            (
                                SELECT row_to_json(old_row)
                                FROM   (SELECT *
                                        FROM   billing.claim_submission_codes
                                        WHERE  id = ${id}) old_row
                            ) old_values
                    `;

        return await queryWithAudit(sql, {
            ...params,
            logDescription: `Update: Submission Types(${code}) updated`
        });
    },

    deleteData: async (params) => {
        let {
            id,
            code
        } = params;

        const sql = SQL`DELETE FROM
                            billing.claim_submission_codes
                        WHERE id = ${id}
                        RETURNING *, '{}'::jsonb old_values
                        `;

        return await queryWithAudit(sql, {
            ...params,
            logDescription: `Delete: Submission Types(${code}) deleted`
        });
    }
};
