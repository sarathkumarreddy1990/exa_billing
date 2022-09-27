const { query, SQL, queryWithAudit } = require('../index');

module.exports = {

    getData: async function (params) {


        params.sortOrder = params.sortOrder || ' DESC';
        params.sortField = params.sortField || 'id';

        let {
            provider_id,
            pageNo,
            pageSize,
            sortField,
            sortOrder,
            insurance_name,
            payer_assigned_provider_id,
            qualifier_desc
        } = params;

        let whereQuery = [];

        whereQuery.push(` billing_provider_id = ${provider_id} `);

        if (insurance_name) {
            whereQuery.push(` ip.insurance_name ILIKE '%${insurance_name}%'`);
        }

        if (payer_assigned_provider_id) {
            whereQuery.push(` pc.payer_assigned_provider_id ILIKE '%${payer_assigned_provider_id}%'`);
        }

        if (qualifier_desc) {
            whereQuery.push(` pcq.description ILIKE '%${qualifier_desc}%'`);
        }

        const sql = SQL`
            SELECT
                pc.id
              , pc.qualifier_id
              , pc.billing_provider_id
              , pc.insurance_provider_id
              , ip.insurance_name
              , pc.payer_assigned_provider_id
              , pcq.description as qualifier_desc
              , COUNT(1) OVER (range unbounded preceding) as total_records
            FROM billing.provider_id_codes as pc
            INNER JOIN billing.provider_id_code_qualifiers pcq ON pc.qualifier_id = pcq.id
            INNER JOIN insurance_providers ip ON pc.insurance_provider_id = ip.id`;

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

        let {
            id,
            provider_id } = params;

        const sql = SQL`SELECT
                              id
                            , qualifier_id
                            , billing_provider_id
                            , insurance_provider_id
                            , payer_assigned_provider_id
                        FROM billing.provider_id_codes
                        WHERE
                            id = ${id}
                        AND billing_provider_id = ${provider_id}`;

        return await query(sql);
    },

    create: async function (params) {

        let {
            qualifierId,
            providerId,
            insuranceProviderId,
            payerAssignedProviderId } = params;

        const sql = SQL` INSERT INTO billing.provider_id_codes
                                                (   qualifier_id
                                                  , billing_provider_id
                                                  , insurance_provider_id
                                                  , payer_assigned_provider_id)
                                                values
                                                (
                                                    ${qualifierId}
                                                  , ${providerId}
                                                  , ${insuranceProviderId}
                                                  , ${payerAssignedProviderId})
                                                  RETURNING *, '{}'::jsonb old_values`;

        return await queryWithAudit(sql, {
            ...params,
            logDescription: `Add: New Provider Id Code(${qualifierId}) created`
        });
    },

    update: async function (params) {

        let {
            id,
            qualifierId,
            providerId,
            insuranceProviderId,
            payerAssignedProviderId } = params;


        const sql = SQL` UPDATE
                              billing.provider_id_codes
                         SET
                              qualifier_id = ${qualifierId}
                            , insurance_provider_id = ${insuranceProviderId}
                            , payer_assigned_provider_id = ${payerAssignedProviderId}
                         WHERE
                            id = ${id}
                        AND billing_provider_id = ${providerId}
                        RETURNING *,
                            (
                                SELECT row_to_json(old_row)
                                FROM   (SELECT *
                                        FROM   billing.provider_id_codes
                                        WHERE  id = ${id}) old_row
                            ) old_values`;

        return await queryWithAudit(sql, {
            ...params,
            logDescription: `Update: Provider Id Code(${qualifierId}) updated`
        });
    },

    delete: async function (params) {

        let {
            id,
            provider_id } = params;

        const sql = SQL` DELETE FROM
                             billing.provider_id_codes
                         WHERE
                             id = ${id}
                         AND billing_provider_id = ${provider_id}
                         RETURNING *, '{}'::jsonb old_values`;

        return await queryWithAudit(sql, {
            ...params,
            logDescription: `Deleted ${provider_id}(${id})`
        });
    }
};
