const {
    SQL,
    query,
    queryWithAudit,
    queryCteWithAudit
} = require('../index');

module.exports = {
    labelCpts: async (params) => {
        const { cpt_ids } = params;
        const sql = SQL`
            SELECT
                id,
                short_description,
                display_code
            FROM
                cpt_codes
            WHERE
                id = ANY(${cpt_ids})`;

        return await query(sql);

    },

    labelModifiers: async (params) => {
        const { modifier_ids } = params;
        const sql = SQL`
            SELECT
                id,
                description
            FROM
                modifiers
            WHERE
                id = ANY(${modifier_ids})`;

        return await query(sql);
    },

    autocompleteCpts: async function (params) {
        params.sortOrder = params.sortOrder || ' ASC';

        let {
            term,
            sortOrder,
            sortField,
            page,
            pageSize
        } = params;


        const sql = SQL`
            SELECT
                id,
                short_description,
                display_code,
                COUNT(1) OVER (range unbounded preceding) AS total_records
            FROM
                cpt_codes`;

        if (term) {
            sql.append(` WHERE short_description ILIKE '%`);
            sql.append(term);
            sql.append(`%' OR display_code ILIKE '%`);
            sql.append(term);
            sql.append(`%'`);
        }

        sql.append(SQL` ORDER BY  `)
            .append(sortField)
            .append(' ')
            .append(sortOrder)
            .append(SQL` LIMIT ${pageSize}`)
            .append(SQL` OFFSET ${((page * pageSize) - pageSize)}`);

        return await query(sql);
    },

    autocompleteModifiers: async function (params) {
        params.sortOrder = params.sortOrder || ' ASC';

        let {
            term,
            sortOrder,
            sortField,
            page,
            pageSize
        } = params;


        const sql = SQL`
            SELECT
                id,
                description,
                COUNT(1) OVER (range unbounded preceding) AS total_records
            FROM
                modifiers`;

        if (term) {
            sql.append(SQL` WHERE (description ILIKE '%`)
                .append(term)
                .append(SQL`%')`);
        }

        sql.append(SQL` ORDER BY  `)
            .append(sortField)
            .append(' ')
            .append(sortOrder)
            .append(SQL` LIMIT ${pageSize}`)
            .append(SQL` OFFSET ${((page * pageSize) - pageSize)}`);

        return await query(sql);
    },

    findRelevantTemplates: async function (params) {
        let {
            cpts,
            modifiers
        } = params;

        if (cpts || modifiers) {
            const sql = SQL``;
            const selSql = `
                SELECT
                    id,
                    template_name,
                    supporting_text,
                    get_supporting_text_template_cpt_code_ids(id) AS cpt_ids,
                    get_supporting_text_template_modifier_ids(id) AS modifier_ids
                FROM
                    billing.supporting_text_templates
                `;

            if (cpts) {
                sql.append(selSql)
                .append(SQL`WHERE ${cpts} :: BIGINT[] && (get_supporting_text_template_cpt_code_ids(id))`)
                .append(modifiers ? ` UNION` : ``);
            }

            if (modifiers) {
                sql.append(selSql)
                .append(SQL`WHERE ${modifiers} :: BIGINT[] && (get_supporting_text_template_modifier_ids(id))`);
            }

            return await query(sql);
        } else {
            return { rows: [] };
        }
    },

    getDataById: async (params) => {
        const { id } = params;
        const sql = SQL`
            SELECT
                id,
                template_name,
                supporting_text,
                get_supporting_text_template_cpt_code_ids(id) AS cpt_ids,
                get_supporting_text_template_modifier_ids(id) AS modifier_ids
            FROM
                billing.supporting_text_templates
            WHERE
                billing.supporting_text_templates.id = ${id}`;

        return await query(sql);
    },

    getData: async function (params) {
        let whereQuery = [];
        params.sortOrder = params.sortOrder || ' ASC';

        let {
            template_name,
            supporting_text,
            sortOrder,
            sortField,
            pageNo,
            pageSize
        } = params;

        if (template_name) {
            whereQuery.push(` template_name ILIKE '%${template_name}%'`);
        } else if (supporting_text) {
            whereQuery.push(` supporting_text ILIKE '%${supporting_text}%'`);
        }

        const sql = SQL`
            SELECT
                id,
                template_name,
                supporting_text,
                COUNT(1) OVER (range unbounded preceding) AS total_records
            FROM
                billing.supporting_text_templates`;

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

    create: async (params) => {
        let {
            templateName,
            supportingText,
            associatedCptsIds,
            associatedModifiersIds,
            companyId
        } = params;

        const sql = SQL`
            WITH cte AS (
                INSERT INTO billing.supporting_text_templates
                (
                    company_id,
                    template_name,
                    supporting_text
                )
                SELECT
                    ${companyId},
                    ${templateName},
                    ${supportingText}
                WHERE NOT EXISTS (
                    SELECT 1
                    FROM
                        billing.supporting_text_templates
                    WHERE
                        Lower(Trim(template_name, e'\t\r\n ')) = Lower(Trim(${templateName}, e'\t\r\n '))
                )
                RETURNING *,
                    '{}'::jsonb old_values
            ),

            insert_cpts_cte AS (
                INSERT INTO billing.supporting_text_template_cpt_codes(supporting_text_template_id, cpt_code_id)
                SELECT id, cpt_code_id
                FROM UNNEST((${associatedCptsIds})::BIGINT[]) AS cpt_code_id
                JOIN cte ON TRUE
                ON CONFLICT DO NOTHING
            ),

            insert_modifiers_cte AS (
                INSERT INTO billing.supporting_text_template_modifiers(supporting_text_template_id, modifier_id)
                SELECT id, modifier_id
                FROM UNNEST((${associatedModifiersIds})::BIGINT[]) AS modifier_id
                JOIN cte ON TRUE
                ON CONFLICT DO NOTHING
            )
        `;

        return await queryCteWithAudit(sql, {
            ...params,
            logDescription: `Add: Supporting text tempate (${templateName}) created containing text: ${supportingText}`
        });
    },

    update: async (params) => {
        let {
            id,
            templateName,
            supportingText,
            associatedCptsIds,
            associatedModifiersIds,
            companyId
        } = params;

        const sql = SQL`
        WITH cte AS (
            UPDATE
                billing.supporting_text_templates
            SET
                template_name = ${templateName},
                supporting_text = ${supportingText}
            WHERE
                id = ${id}
            AND company_id = ${companyId}
            AND NOT EXISTS (
                SELECT 1
                FROM
                    billing.supporting_text_templates
                WHERE
                    Lower(Trim(template_name, e'\t\r\n ')) = Lower(Trim(${templateName}, e'\t\r\n '))
                AND id != ${id}
            )
            RETURNING *,
                (
                    SELECT row_to_json(old_row)
                    FROM   (SELECT *
                            FROM   billing.supporting_text_templates
                            WHERE  id = ${id}) old_row
                ) old_values
        ),

        delete_cpts AS (
            DELETE FROM billing.supporting_text_template_cpt_codes
            USING cte AS c
            WHERE supporting_text_template_id = c.id
            AND NOT (cpt_code_id = ANY ((${associatedCptsIds})::BIGINT[]))
        ),

        insert_cpts AS (
            INSERT INTO billing.supporting_text_template_cpt_codes(supporting_text_template_id, cpt_code_id)
            SELECT id, cpt_code_id
            FROM UNNEST((${associatedCptsIds})::BIGINT[]) AS cpt_code_id
            JOIN cte ON TRUE
            ON CONFLICT DO NOTHING
        ),

        delete_modifiers AS (
            DELETE FROM billing.supporting_text_template_modifiers
            USING cte AS c
            WHERE supporting_text_template_id = c.id
            AND NOT (modifier_id = ANY ((${associatedModifiersIds})::BIGINT[]))
        ),

        insert_modifiers AS (
            INSERT INTO billing.supporting_text_template_modifiers(supporting_text_template_id, modifier_id)
            SELECT id, modifier_id
            FROM UNNEST((${associatedModifiersIds})::BIGINT[]) AS modifier_id
            JOIN cte ON TRUE
            ON CONFLICT DO NOTHING
        )

        `;

        return await queryCteWithAudit(sql, {
            ...params,
            logDescription: `Updated supporting text template: ${templateName}.`
        });

    },

    delete: async (params) => {
        const {
            id,
            templateName,
        } = params;

        const sql = SQL`
        WITH delete_cpts AS (
            DELETE FROM billing.supporting_text_template_cpt_codes
            WHERE supporting_text_template_id = ${id}
        ),

        delete_modifiers AS (
            DELETE FROM billing.supporting_text_template_modifiers
            WHERE supporting_text_template_id = ${id}
        ),

        cte AS (
            DELETE FROM
                billing.supporting_text_templates
            WHERE
                id = ${id}
            RETURNING *,
                '{}'::jsonb old_values
        )
        `;


        return await queryCteWithAudit(sql, {
            ...params,
            logDescription: `Deleted supporting text template: ${templateName}.`
        });
    }
};
