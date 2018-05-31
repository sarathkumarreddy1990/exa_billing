const { query, SQL } = require('./index');

module.exports = {

    getCptAutoCompleteDetails: async function (params) {

        let search_query = ` AND (cpt_codes.display_code ILIKE '%${params.q}%' OR cpt_codes.short_description ILIKE '%${params.q}%' OR cpt_codes.display_description ILIKE  '%${params.q}%') `;
        const insur_sql = SQL`SELECT
                                  id
                                 , display_code
                                 , display_description
                                 , is_batch
                                 , additional_info -> 'global_fee' AS globalfee
                                 , additional_info -> 'tech_fee' as tech_fee
                                 , additional_info -> 'prof_fee' as prof_fee
                                 , additional_info -> 'service_Type' AS service_type
                                 , additional_info -> 'modifier' AS modifier
                                 , modalities
                                 , facilities
                                 , linked_cpt_ids
                                 , linked_cpt_codes
                                 , units
                                 , is_active
                                 , duration
                                 , additional_info
                                 , ref_code
                                 , additional_info -> 'ndc_code' as ndc_code
                                 , 184 as total_records
                                 , exam_prep_instructions
                                 , rvu
                                 , COUNT(1) OVER (range unbounded preceding) as total_records
                                FROM 
                                    cpt_codes
                                WHERE           
                                    NOT has_deleted AND company_id = ${params.company_id} AND is_active `;
        if (params.q != ''){
            insur_sql.append(search_query);
        }
        insur_sql.append(SQL` ORDER BY  ${params.sortField} `)
            .append(params.sortOrder)
            .append(SQL` LIMIT ${params.pageSize}`)
            .append(SQL` OFFSET ${((params.page * params.pageSize) - params.pageSize)}`);

        return await query(insur_sql);
    },
    getProviders: async function (params) {
        const sql_provider = SQL`SELECT
                                      pc.id AS id
                                    , p.first_name
                                    , p.id AS provider_id
                                    , p.is_active AS is_active
                                    , pc.id AS provider_contact_id
                                    , p.last_name
                                    , p.full_name
                                    , p.provider_code
                                    , hstore_to_json(contact_info) AS contact_info
                                    , COUNT(1) OVER (range unbounded preceding) AS total_records 
                            FROM public.providers p
                                INNER JOIN
                                    provider_contacts pc ON pc.provider_id = p.id
                            WHERE NOT p.has_deleted AND NOT pc.has_deleted AND p.is_active AND p.company_id = ${params.company_id} AND p.provider_type = ${params.provider_type} `;
        sql_provider.append(SQL` ORDER BY  ${params.sortField} `)
            .append(params.sortOrder)
            .append(SQL` LIMIT ${params.pageSize}`)
            .append(SQL` OFFSET ${((params.page * params.pageSize) - params.pageSize)}`);
        return await query(sql_provider);
    },
    getICDcodes: async function (params) {
        const icd_sql = SQL`SELECT
                                       id
                                     , code
                                     , description
                                     , code_type
                                     , COUNT(1) OVER (range unbounded preceding) AS total_records
                                FROM icd_codes AS icd
                                WHERE 
                                    icd.is_active AND NOT icd.has_deleted AND icd.company_id = ${params.company_id} `;
        icd_sql.append(SQL` ORDER BY  ${params.sortField} `)
            .append(params.sortOrder)
            .append(SQL` LIMIT ${params.pageSize}`)
            .append(SQL` OFFSET ${((params.page * params.pageSize) - params.pageSize)}`);
        return await query(icd_sql);
    },
    getProviderGroups: async function (params) {
        const icd_sql = SQL`SELECT
                                     id
                                     ,id As provider_group_id
                                     ,group_code
                                     ,group_name
                                     ,group_info
                                     ,is_active
                                     ,company_id
                                     ,COUNT(1) OVER (range unbounded preceding) AS total_records
                                FROM provider_groups
                                WHERE 
                                    NOT provider_groups.has_deleted AND (provider_groups.group_type = ${params.groupType}  OR provider_groups.group_type IS NULL) 
                                    AND provider_groups.company_id = ${params.company_id} AND is_active `;
        icd_sql.append(SQL` ORDER BY  ${params.sortField} `)
            .append(params.sortOrder)
            .append(SQL` LIMIT ${params.pageSize}`)
            .append(SQL` OFFSET ${((params.page * params.pageSize) - params.pageSize)}`);
        return await query(icd_sql);
    },
    getInsurances: async function (params) {
        const insurance_sql = SQL`SELECT
                                id
                                , insurance_code
                                , insurance_name
                                , hstore_to_json(insurance_info) AS insurance_info
                                , COUNT(1) OVER (range unbounded preceding) as total_records
                            FROM 
                                insurance_providers
                            WHERE 
                                NOT has_deleted AND company_id = ${params.company_id} AND is_active `;
        insurance_sql.append(SQL` ORDER BY  ${params.sortField} `)
            .append(params.sortOrder)
            .append(SQL` LIMIT ${params.pageSize}`)
            .append(SQL` OFFSET ${((params.page * params.pageSize) - params.pageSize)}`);
        return await query(insurance_sql);
    }

};
