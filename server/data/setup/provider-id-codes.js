const { query, SQL } = require('../index');

module.exports = {

    getData: async function (params) {

        let { provider_id } = params;

        const sql = SQL`SELECT 
                            pc.id,
                            pc.qualifier_id
                            , pc.billing_provider_id
                            , pc.insurance_provider_id
                            , ip.insurance_name
                            , pc.payer_assigned_provider_id
                            , pcq.description as qualifier_desc
                            , COUNT(1) OVER (range unbounded preceding) as total_records
                        FROM   billing.provider_id_codes as pc
                        LEFT JOIN billing.provider_id_code_qualifiers pcq ON pc.qualifier_id = pcq.id
                        LEFT JOIN insurance_providers ip ON pc.insurance_provider_id = ip.id
                        WHERE 
                            billing_provider_id = ${provider_id}
                        ORDER  BY  pcq.id DESC 
                        LIMIT  10  `;

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
                        FROM   billing.provider_id_codes
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
                                                  , ${payerAssignedProviderId}
                                                ) RETURNING id`;

        return await query(sql);
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
                        AND billing_provider_id = ${providerId}`;

        return await query(sql);
    },

    delete: async function (params) {

        let {
            id,
            provider_id } = params;

        const sql = SQL` DELETE FROM
                             billing.provider_id_codes
                         WHERE
                             id = ${id}
                         AND billing_provider_id = ${provider_id}`;

        return await query(sql);
    }
};