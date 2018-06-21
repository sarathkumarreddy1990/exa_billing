const { query, SQL, queryWithAudit } = require('../index');

module.exports = {

    getData: async function (params) {

        params.sortOrder = params.sortOrder || ' DESC';
        let {
            printerName,
            leftMargin,
            rightMargin,
            topMargin,
            bottomMargin,
            sortOrder,
            sortField,
            pageNo,
            pageSize
        } = params;

        let whereQuery = [];

        if (printerName) {
            whereQuery.push(` printer_name ILIKE '%${printerName}%'`);
        }

        if (leftMargin) {
            whereQuery.push(` left_margin = ${leftMargin}::numiric `);
        }

        if (rightMargin) {
            whereQuery.push(` right_margin = ${rightMargin}::numiric `);
        }

        if (topMargin) {
            whereQuery.push(` top_margin = ${topMargin}::numiric `);
        }

        if (bottomMargin) {
            whereQuery.push(` bottom_margin = ${bottomMargin}::numiric `);
        }

        const sql = SQL`SELECT 
                            id
                            , company_id
                            , printer_name
                            , inactivated_dt
                            , left_margin
                            , right_margin
                            , top_margin
                            , bottom_margin
                            , COUNT(1) OVER (range unbounded preceding) as total_records
                        FROM   billing.paper_claim_printer_setup`;

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
                              , printer_name
                              , inactivated_dt
                              , left_margin
                              , right_margin
                              , top_margin
                              , bottom_margin
                        FROM   billing.paper_claim_printer_setup
                        WHERE 
                            id = ${id} `;

        return await query(sql);
    },

    create: async function (params) {

        let {
            companyId,
            printerName,
            isActive,
            leftMargin,
            rightMargin,
            topMargin,
            bottomMargin } = params;
        let inactivated_dt = isActive ? null : 'now()';

        const sql = SQL` INSERT INTO billing.paper_claim_printer_setup
                                                (   company_id
                                                    , printer_name
                                                    , inactivated_dt
                                                    , left_margin
                                                    , right_margin
                                                    , top_margin
                                                    , bottom_margin)
                                                values
                                                (
                                                    ${companyId}
                                                  , ${printerName}
                                                  , ${inactivated_dt}
                                                  , ${leftMargin}
                                                  , ${rightMargin}
                                                  , ${topMargin}
                                                  , ${bottomMargin})
                                                  RETURNING *, '{}'::jsonb old_values`;

        return await queryWithAudit(sql, {
            ...params,
            logDescription: `Created ${printerName}`
        });
    },

    update: async function (params) {

        let {
            id,
            printerName,
            isActive,
            leftMargin,
            rightMargin,
            topMargin,
            bottomMargin } = params;
        let inactivated_dt = isActive ? null : 'now()';

        const sql = SQL` UPDATE
                              billing.paper_claim_printer_setup
                         SET
                            printer_name = ${printerName}
                          , inactivated_dt = ${inactivated_dt}
                          , left_margin = ${leftMargin}
                          , right_margin = ${rightMargin}
                          , top_margin = ${topMargin}
                          , bottom_margin = ${bottomMargin}
                         WHERE
                              id = ${id} RETURNING *,
                              (
                                  SELECT row_to_json(old_row) 
                                  FROM   (SELECT * 
                                          FROM   billing.paper_claim_printer_setup 
                                          WHERE  id = ${id}) old_row 
                              ) old_values`;

        return await queryWithAudit(sql, {
            ...params,
            logDescription: `Updated ${printerName}`
        });
    },

    delete: async function (params) {

        let { id } = params;

        const sql = SQL` DELETE FROM
                             billing.paper_claim_printer_setup
                         WHERE
                             id = ${id}  RETURNING *, '{}'::jsonb old_values`;

        return await queryWithAudit(sql, {
            ...params,
            logDescription: 'Deleted.'
        });
    }
};