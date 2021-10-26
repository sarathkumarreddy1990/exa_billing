const { query, SQL, queryWithAudit } = require('../index');

module.exports = {
    getList: async(params)=> {
        let whereQuery = [];
        params.sortOrder = params.sortOrder || ' ASC';
        let {
            code,
            description,
            sortOrder,
            sortField,
            pageNo,
            pageSize,
            companyId,
            is_active,
        } = params;

        if (code) {
            whereQuery.push(` code ILIKE '%${code}%'`);
        }

        if (description) {
            whereQuery.push(` description ILIKE '%${description}%'`);
        }

        if(is_active === 'false') {
            whereQuery.push(' inactivated_dt IS NOT NULL ');
        }

        if(is_active === 'true') {
            whereQuery.push(' inactivated_dt IS NULL ');
        }

        let sql = SQL`
                        SELECT
                            id,
                            code,
                            description,
                            is_system_code,
                            inactivated_dt IS NULL AS is_active
                        FROM billing.delay_reasons
                        WHERE company_id = ${companyId}`;

        if (whereQuery.length) {
            sql.append(` AND ${whereQuery.join(' AND ')} `);
        }

        sql.append(SQL` ORDER BY `)
            .append(sortField)
            .append(' ')
            .append(sortOrder)
            .append(SQL` LIMIT ${pageSize} `)
            .append(SQL` OFFSET ${((pageNo * pageSize) - pageSize)}`);

        return await query(sql);
    },

    getListCount:  async(params)=> {
        let whereQuery = [];
        let {
            code,
            description,
            companyId,
            is_active,
        } = params;

        if (code) {
            whereQuery.push(` code ILIKE '%${code}%'`);
        }

        if (description) {
            whereQuery.push(` description ILIKE '%${description}%'`);
        }

        if(is_active === 'false') {
            whereQuery.push(' inactivated_dt IS NOT NULL ');
        }

        if(is_active === 'true') {
            whereQuery.push(' inactivated_dt IS NULL ');
        }

        let sql = SQL`
                        SELECT
                            count(1) AS total_records
                        FROM billing.delay_reasons
                        WHERE company_id = ${companyId}`;

        if (whereQuery.length) {
            sql.append(` AND ${whereQuery.join(' AND ')} `);
        }

        return await query(sql);
    },

    getDelayReason:  async({companyId, id})=> {
        const sql = SQL`
                        SELECT
                            id,
                            code,
                            description,
                            is_system_code,
                            inactivated_dt
                        FROM billing.delay_reasons
                        WHERE company_id = ${companyId} AND id = ${id}`;
        return await query(sql);
    },

    saveDelayReason:  async(params)=> {

        let {
            companyId,
            code,
            description,
            isActive
        } = params;

        let inactivated_date = isActive ? null : ' now() ';

        const sql = SQL`
                        INSERT INTO billing.delay_reasons (
                            code,
                            description,
                            inactivated_dt,
                            company_id)
                        VALUES (
                            ${code},
                            ${description},
                            ${inactivated_date},
                            ${companyId}
                        )
                        RETURNING *, '{}'::jsonb old_values `;

        return await queryWithAudit(sql, {
            ...params,
            logDescription: `Add: New Delay Reason Code(${code}) created`
        });
    },

    updateDelayReason: async(params) => {
        let { id,
            code,
            description,
            isActive
        } = params;

        let inactivated_date = isActive ? null : ' now() ';

        const sql = SQL`
                        UPDATE billing.delay_reasons SET
                            code = ${code},
                            description = ${description},
                            inactivated_dt = ${inactivated_date}
                            WHERE id = ${id}
                            RETURNING *,
                            (
                                SELECT row_to_json(old_row)
                                FROM   (SELECT *
                                        FROM   billing.delay_reasons
                                        WHERE  id = ${id}) old_row
                            ) old_values
       `;

        return await queryWithAudit(sql, {
            ...params,
            logDescription: `Update: Delay Reason Code(${code}) updated`
        });
    },

    delete: async (params) => {
        const {
            id,
            code,
            description
        } = params;

        const sql = SQL`
                        DELETE FROM billing.delay_reasons
                        WHERE id = ${id}
                        RETURNING *, '{}'::jsonb old_values`;

        return await queryWithAudit(sql, {
            ...params,
            logDescription: `Deleted ${description} (${code})`
        });
    }
};
