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
            process_type,
            process_status,
            colorCode,
            sortOrder,
            sortField,
            pageNo,
            pageSize
        } = params;

        if (process_type) {
            whereQuery.push(` process_type ILIKE '%${process_type}%'`);
        }

        if (process_status) {
            whereQuery.push(` coalesce(claim_status.description, process_status) ILIKE '%${process_status}%'`);
        }

        if (colorCode) {
            whereQuery.push(` color_code ILIKE '%${colorCode}%'`);
        }

        const sql = SQL`SELECT
                            status_color_codes.id
                            , process_type
                            , coalesce(claim_status.description, process_status) process_status
                            , color_code
                            , COUNT(1) OVER (range unbounded preceding) AS total_records
                        FROM
                            billing.status_color_codes
                        LEFT JOIN
                            billing.claim_status
                        ON
                            claim_status.code = status_color_codes.process_status`;

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
        const { id } = params;

        const sql = SQL`SELECT
                          id
                          , process_type
                          , process_status
                          , color_code
                    FROM
                        billing.status_color_codes
                    WHERE
                        id = ${id} `;

        return await query(sql);
    },

    create: async (params) => {
        let {
            processType,
            processStatus,
            colorCode,
            companyId
        } = params;

        const sql = SQL`
                    INSERT INTO billing.status_color_codes
                    (
                          company_id
                        , process_type
                        , process_status
                        , color_code
                    )
                    VALUES
                    (
                        ${companyId} ,
                        ${processType} ,
                        ${processStatus} ,
                        ${colorCode}
                    )
                    RETURNING *, '{}'::jsonb old_values
        `;
        return await queryWithAudit(sql, {
            ...params,
            logDescription: `Add: Status Color Code(${colorCode}) created`
        });
    },

    update: async (params) => {

        let {
            processType,
            processStatus,
            colorCode,
            id
        } = params;

        const sql = SQL`UPDATE
                             billing.status_color_codes
                        SET
                              process_type = ${processType}
                            , process_status = ${processStatus}
                            , color_code = ${colorCode}
                        WHERE
                            id = ${id}
                        RETURNING *,
                            (
                                SELECT row_to_json(old_row)
                                FROM   (SELECT *
                                        FROM   billing.status_color_codes
                                        WHERE  id = ${id}) old_row
                            ) old_values
                    `;

        return await queryWithAudit(sql, {
            ...params,
            logDescription: `Update: Status Color Code(${colorCode}) updated`
        });
    },

    delete: async (params) => {
        const {
            id,
            processType,
            processStatus
        } = params;

        const sql = SQL`DELETE FROM
                            billing.status_color_codes
                        WHERE id = ${id}
                        RETURNING *, '{}'::jsonb old_values
                        `;

        return await queryWithAudit(sql, {
            ...params,
            logDescription: `Deleted ${processType}(${processStatus})`
        });
    }
};
