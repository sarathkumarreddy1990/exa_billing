const { query, SQL, queryWithAudit } = require('../index');

module.exports = {

    getData: async function (params) {

        params.sortOrder = params.sortOrder || ' DESC';
        let {
            insurance_name,
            claimclearinghouse,
            claimrequesttemplate,
            claimReqTempProv,
            sortOrder,
            sortField,
            pageNo,
            pageSize} = params;

        let whereQuery = [];

        if (insurance_name) {
            whereQuery.push(` insurance_name ILIKE '%${insurance_name}%'`);
        }

        if (claimclearinghouse) {
            whereQuery.push(` insurance_info->'claimClearingHouse' ILIKE '%${claimclearinghouse}%'`);
        }

        if (claimrequesttemplate) {
            whereQuery.push(` insurance_info->'edi_template' ILIKE '%${claimrequesttemplate}%'`);
        }

        if (claimReqTempProv) {
            whereQuery.push(` insurance_info->'claim_req_temp_prov' ILIKE '%${claimReqTempProv}%'`);
        }

        const sql = SQL`SELECT 
                            id
                            , company_id
                            , insurance_name
                            , insurance_info->'claimClearingHouse' AS claimClearingHouse
                            , insurance_info->'edi_template' AS claimRequestTemplate
                            , insurance_info->'claim_req_temp_prov' AS claimReqTempProv
                            , COUNT(1) OVER (range unbounded preceding) as total_records
                        FROM   public.insurance_providers`;

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
                              , insurance_name
                              , insurance_info->'claimClearingHouse' AS claimClearingHouse
                              , insurance_info->'edi_template' AS claimRequestTemplate
                              , insurance_info->'claim_req_temp_prov' AS claimReqTempProv
                        FROM   public.insurance_providers
                        WHERE 
                            id = ${id} `;

        return await query(sql);
    },

    update: async function (params) {

        let { 
            id,
            name,
            claimClearingHouse,
            claimRequestTemplate,
            claimReqTempProv} = params;

        const sql = SQL` UPDATE
                            public.insurance_providers
                         SET
                            insurance_info = insurance_info || hstore(ARRAY['claimClearingHouse','edi_template','claim_req_temp_prov'],
                                                                ARRAY[${claimClearingHouse},${claimRequestTemplate},${claimReqTempProv}])
                         WHERE
                              id = ${id} 
                              RETURNING *,
                              (
                                  SELECT row_to_json(old_row) 
                                  FROM   (SELECT * 
                                          FROM   public.insurance_providers 
                                          WHERE  id = ${id}) old_row 
                              ) old_values`;

        return await queryWithAudit(sql, {
            ...params,
            logDescription: `Updated ${name}`
        });
    }
};
