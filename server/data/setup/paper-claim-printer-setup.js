const { query, SQL } = require('../index');

module.exports = {

    getData: async function (params) {

        params.printer_name = '';
        params.left_margin = 0;
        params.right_margin = 0;
        params.top_margin = 0;
        params.bottom_margin = 0;
        params.pageNo = 1;
        params.pageSize = 10;
        params.sortField = ' printer_name ';
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
            bottomMargin} = params;
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
                                                  , ${bottomMargin}
                                                ) RETURNING id`;

        return await query(sql);
    },

    update: async function (params) {

        let {
            id,
            printerName,
            isActive,
            leftMargin,
            rightMargin,
            topMargin,
            bottomMargin} = params;
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
                              id = ${id}`;

        return await query(sql);
    },

    delete: async function (params) {

        let { id } = params;

        const sql = SQL` DELETE FROM
                             billing.paper_claim_printer_setup
                         WHERE
                             id = ${id}`;

        return await query(sql);
    }
};