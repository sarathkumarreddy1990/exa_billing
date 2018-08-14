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
                        , is_default
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
            templateContent,
            isDefault,
            screenName,
            clientIp,
            userId
        } = params;

        let inactivated_date = isActive ? null : ' now() ';

        const sql = SQL`
                    WITH update_template AS (
                        UPDATE billing.printer_templates
                        SET
                            is_default = false
                        WHERE
                            is_default
                            AND template_type = ${type}
                            AND ${isDefault}
                        RETURNING *, '{}'::jsonb old_values
                    )
                    , create_template AS (
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
                            template_type,
                            is_default
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
                            ${type},
                            ${isDefault}
                        )
                        RETURNING *, '{}'::jsonb old_values
                    )
            , insert_audit_template AS (
                SELECT billing.create_audit(
                      ${companyId}
                    , 'claims'
                    , id
                    , ${screenName}
                    , 'claims'
                    , 'Add: New Printer Template ' || ${name} || '   created  '
                    , ${clientIp}
                    , json_build_object(
                        'old_values', COALESCE(old_values, '{}'),
                        'new_values', (SELECT row_to_json(temp_row)::jsonb - 'old_values'::text FROM (SELECT * FROM create_template limit 1) temp_row)
                      )::jsonb
                    , ${userId}
                  ) AS id
                FROM create_template
                WHERE id IS NOT NULL
            )
            , update_audit_template AS (
                SELECT billing.create_audit(
                      ${companyId}
                    , 'claims'
                    , id
                    , ${screenName}
                    , 'claims'
                    , 'Printer Template (' || update_template.name ||  ') Updated  to Default '
                    , ${clientIp}
                    , json_build_object(
                        'old_values', COALESCE(old_values, '{}'),
                        'new_values', (SELECT row_to_json(temp_row)::jsonb - 'old_values'::text FROM (SELECT * FROM update_template limit 1 ) temp_row)
                      )::jsonb
                    , ${userId}
                  ) AS id
                FROM update_template
                WHERE id IS NOT NULL
            )
            SELECT * FROM insert_audit_template UNION SELECT * FROM update_audit_template
        `;

        return await query(sql);
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
            templateContent,
            isDefault,
            companyId,
            screenName,
            clientIp,
            userId
        } = params;

        let inactivated_date = isActive ? null : ' now() ';

        let sql = SQL` WITH update_default AS (
                            UPDATE billing.printer_templates
                            SET
                                is_default = false
                            WHERE
                                id != ${id}
                                AND is_default
                                AND template_type = ${type}
                                AND ${isDefault}
                            RETURNING * ,'{}'::jsonb old_values
                        )
                        , update_template AS (
                            UPDATE
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
                                , is_default = ${isDefault}
                            WHERE
                                id = ${id}
                            RETURNING *,
                                (
                                    SELECT row_to_json(old_row)
                                    FROM   (SELECT *
                                            FROM   billing.printer_templates
                                            WHERE  id = ${id}) old_row
                                ) old_values
                        )
                        , update_audit_template AS (
                            SELECT billing.create_audit(
                                  ${companyId}
                                , 'claims'
                                , id
                                , ${screenName}
                                , 'claims'
                                , 'Printer Template Updated  ' || update_template.name
                                , ${clientIp}
                                , json_build_object(
                                    'old_values', COALESCE(old_values, '{}'),
                                    'new_values', (SELECT row_to_json(temp_row)::jsonb - 'old_values'::text FROM (SELECT * FROM update_template limit 1) temp_row)
                                  )::jsonb
                                , ${userId}
                              ) AS id
                            FROM update_template
                            WHERE id IS NOT NULL
                        )
                        , update_audit_template_default AS (
                            SELECT billing.create_audit(
                                  ${companyId}
                                , 'claims'
                                , id
                                , ${screenName}
                                , 'claims'
                                , 'Printer Template (' || update_template.name ||  ') Updated  to Default '
                                , ${clientIp}
                                , json_build_object(
                                    'old_values', COALESCE(old_values, '{}'),
                                    'new_values', (SELECT row_to_json(temp_row)::jsonb - 'old_values'::text FROM (SELECT * FROM update_default limit 1 ) temp_row)
                                  )::jsonb
                                , ${userId}
                              ) AS id
                            FROM update_template
                            WHERE id IS NOT NULL
                        )
                        SELECT * FROM update_audit_template UNION SELECT * FROM update_audit_template_default
                    `;

        return await query(sql);
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
