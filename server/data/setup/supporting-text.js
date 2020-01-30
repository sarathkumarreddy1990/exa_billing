const {
    SQL,
    query,
    queryWithAudit
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
            sql.append(SQL` WHERE (short_description ILIKE '%`)
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
        params.sortOrder = params.sortOrder || ' ASC';

        let {
            cpts,
            modifiers
        } = params;

        const sql = SQL`
            SELECT
                id,
                template_name,
                supporting_text,
                cpt_ids,
                modifier_ids
            FROM
                billing.supporting_text_templates`;

        sql.append(SQL` WHERE '0' = ANY (cpt_ids) `);

        if (cpts) {
            for (var i = 0; i < cpts.length; i++) {
                sql.append(SQL` OR ${cpts[i]} = ANY (cpt_ids)  `);
            }
        }

        if (modifiers) {
            for (var i = 0; i < modifiers.length; i++) {
                sql.append(SQL` OR ${modifiers[i]} = ANY (modifier_ids)  `);
            }
        }
        return await query(sql);
    },

    getDataById: async (params) => {
        const { id } = params;
        const sql = SQL`
            SELECT
                id,
                template_name,
                supporting_text,
                COALESCE(cpt_ids, ARRAY[]::integer[]) as cpt_ids,
                COALESCE(modifier_ids, ARRAY[]::integer[]) as modifier_ids
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
            INSERT INTO billing.supporting_text_templates
            (
                company_id,
                template_name,
                supporting_text,
                cpt_ids,
                modifier_ids
            )
            VALUES
            (
                ${companyId},
                ${templateName},
                ${supportingText},
                ${associatedCptsIds},
                ${associatedModifiersIds}
            )
            RETURNING *,
                '{}'::jsonb old_values`;

        return await queryWithAudit(sql, {
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
            UPDATE
                billing.supporting_text_templates,
            SET
                template_name = ${templateName},
                supporting_text = ${supportingText},
                cpt_ids = ${associatedCptsIds},
                modifier_ids = ${associatedModifiersIds}
            WHERE
                id = ${id}
                AND company_id = ${companyId}
            RETURNING *,
                (
                    SELECT row_to_json(old_row)
                    FROM   (SELECT *
                            FROM   billing.supporting_text_templates
                            WHERE  id = ${id}) old_row
                ) old_values`;

        return await queryWithAudit(sql, {
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
            DELETE FROM
                billing.supporting_text_templates
            WHERE
                id = ${id}
            RETURNING *,
                '{}'::jsonb old_values`;


        return await queryWithAudit(sql, {
            ...params,
            logDescription: `Deleted supporting text template: ${templateName}.`
        });
    },
};
