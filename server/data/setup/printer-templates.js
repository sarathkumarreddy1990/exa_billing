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
            name,
            template_type,
            sortOrder,
            sortField,
            pageNo,
            pageSize
        } = params;

        if (name) {
            whereQuery.push(` name ILIKE '%${name}%'`);
        }

        if (template_type) {
            whereQuery.push(` template_type ILIKE '%${template_type}%'`);
        }

        const sql = SQL`SELECT 
                          id
                        , name
                        , inactivated_dt
                        , template_type
                        , COUNT(1) OVER (range unbounded preceding) AS total_records
                    FROM   
                        billing.printer_templates `;

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
                        , name
                        , left_margin 
                        , right_margin 
                        , top_margin 
                        , bottom_margin 
                        , template_content
                        , inactivated_dt
                        , page_width
                        , page_height
                        , template_type
                    FROM   
                        billing.printer_templates 
                    WHERE 
                        id = ${id} `;

        return await query(sql);
    },

    create: async (params) => {
        let {
            name,
            isActive,
            companyId,
            marginRight,
            marginLeft,
            marginTop,
            marginBottom,
            height,
            width,
            type,
            templateContent
        } = params;

        let inactivated_date = isActive ? null : ' now() ';

        const sql = SQL`
                    INSERT INTO billing.printer_templates 
                    ( 
                        company_id, 
                        name, 
                        template_content,
                        inactivated_dt,
                        left_margin,
                        right_margin,
                        top_margin,
                        bottom_margin,
                        page_height,
                        page_width,
                        template_type
                    ) 
                    VALUES 
                    ( 
                        ${companyId}, 
                        ${name}, 
                        ${templateContent}, 
                        ${inactivated_date},
                        ${marginLeft},
                        ${marginRight},
                        ${marginTop},
                        ${marginBottom},
                        ${height},
                        ${width},
                        ${type} 
                    )
                    RETURNING *, '{}'::jsonb old_values
        `;

        return await queryWithAudit(sql, {
            ...params,
            logDescription: `Created ${name}`
        });
    },

    update: async (params) => {

        let {
            name,
            //flag,
            id,
            isActive,
            marginRight,
            marginLeft,
            marginTop,
            marginBottom,
            height,
            width,
            type,
            templateContent
        } = params;

        let inactivated_date = isActive ? null : ' now() ';

        let sql = SQL`UPDATE
                             billing.printer_templates 
                        SET  
                                name = ${name}
                              , template_content = ${templateContent}
                              , inactivated_dt = ${inactivated_date}
                              , left_margin = ${marginLeft}
                              , right_margin = ${marginRight}
                              , top_margin = ${marginTop}
                              , bottom_margin = ${marginBottom}
                              , page_height = ${height}
                              , page_width = ${width}
                              , template_type = ${type}
                        WHERE
                            id = ${id} 
                        RETURNING *,
                            (
                                SELECT row_to_json(old_row) 
                                FROM   (SELECT * 
                                        FROM   billing.printer_templates 
                                        WHERE  id = ${id}) old_row 
                            ) old_values
                    `;

        return await queryWithAudit(sql, {
            ...params,
            logDescription: `Updated ${name}`
        });
    },

    delete: async (params) => {
        const {
            id,
            name
        } = params;

        const sql = SQL`DELETE FROM 
                            billing.printer_templates 
                        WHERE id = ${id}
                        RETURNING *, '{}'::jsonb old_values
                        `;

        return await queryWithAudit(sql, {
            ...params,
            logDescription: `Deleted ${name}`
        });
    }
};
