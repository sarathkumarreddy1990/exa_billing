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
            sortOrder,
            sortField,
            pageNo,
            pageSize
        } = params;

        if (name) {
            whereQuery.push(` name ILIKE '%${name}%'`);
        }

        const sql = SQL`SELECT 
                          id
                        , name
                        , inactivated_dt
                        , COUNT(1) OVER (range unbounded preceding) AS total_records
                    FROM   
                        billing.paper_claim_templates `;

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
                        , orginal_form_template
                        , full_form_template
                        , inactivated_dt
                    FROM   
                        billing.paper_claim_templates 
                    WHERE 
                        id = ${id} `;

        return await query(sql);
    },

    create: async (params) => {
        let {
            name,
            orginalFormTemplate,
            fullFormTemplate,
            isActive,
            companyId,
            marginRight,
            marginLeft,
            marginTop,
            marginBottom,
        } = params;

        let inactivated_date = isActive ? null : ' now() ';

        const sql = SQL`
                    INSERT INTO billing.paper_claim_templates 
                    ( 
                        company_id, 
                        name, 
                        orginal_form_template,
                        full_form_template,
                        inactivated_dt,
                        left_margin,
                        right_margin,
                        top_margin,
                        bottom_margin
                    ) 
                    VALUES 
                    ( 
                        ${companyId}, 
                        ${name}, 
                        ${orginalFormTemplate}, 
                        ${fullFormTemplate}, 
                        ${inactivated_date},
                        ${marginLeft},
                        ${marginRight},
                        ${marginTop},
                        ${marginBottom} 
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
            orginalFormTemplate,
            fullFormTemplate,
            id,
            isActive,
            marginRight,
            marginLeft,
            marginTop,
            marginBottom,
        } = params;

        let inactivated_date = isActive ? null : ' now() ';

        let sql = SQL`UPDATE
                             billing.paper_claim_templates 
                        SET  
                              name = ${name}
                              , orginal_form_template = ${orginalFormTemplate}
                              , full_form_template = ${fullFormTemplate}
                              , inactivated_dt = ${inactivated_date}
                              , left_margin = ${marginLeft}
                              , right_margin = ${marginRight}
                              , top_margin = ${marginTop}
                              , bottom_margin = ${marginBottom}
                        WHERE
                            id = ${id} 
                        RETURNING *,
                            (
                                SELECT row_to_json(old_row) 
                                FROM   (SELECT * 
                                        FROM   billing.paper_claim_templates 
                                        WHERE  id = ${id}) old_row 
                            ) old_values
                    `;

        return await queryWithAudit(sql, {
            ...params,
            logDescription: `Updated ${name}`
        });
    },

    delete: async (params) => {
        const { id } = params;

        const sql = SQL`DELETE FROM 
                            billing.paper_claim_templates 
                        WHERE id = ${id}
                        RETURNING *, '{}'::jsonb old_values
                        `;

        return await queryWithAudit(sql, {
            ...params,
            logDescription: 'Deleted.'
        });
    }
};
