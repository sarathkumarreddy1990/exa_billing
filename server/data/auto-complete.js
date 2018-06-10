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

        if (params.q != '') {
            insur_sql.append(search_query);
        }

        insur_sql.append(SQL` ORDER BY  ${params.sortField} `)
            .append(params.sortOrder)
            .append(SQL` LIMIT ${params.pageSize}`)
            .append(SQL` OFFSET ${((params.page - 1) * params.pageSize)}`);

        return await query(insur_sql);
    },
    getProviders: async function (params) {

        let provider_search = ` AND (p.full_name ILIKE '%${params.q}%' OR p.provider_code ILIKE '%${params.q}%' ) `;

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

        if (params.q != '') {
            sql_provider.append(provider_search);
        }

        sql_provider.append(SQL` ORDER BY  ${params.sortField} `)
            .append(params.sortOrder)
            .append(SQL` LIMIT ${params.pageSize}`)
            .append(SQL` OFFSET ${((params.page - 1) * params.pageSize)}`);

        return await query(sql_provider);
    },
    getICDcodes: async function (params) {

        let ics_search = ` AND (code ILIKE '%${params.q}%' OR description ILIKE '%${params.q}%' ) `;

        const icd_sql = SQL`SELECT
                                       id
                                     , code
                                     , description
                                     , code_type
                                     , COUNT(1) OVER (range unbounded preceding) AS total_records
                                FROM icd_codes AS icd
                                WHERE 
                                    icd.is_active AND NOT icd.has_deleted AND icd.company_id = ${params.company_id} `;

        if (params.q != '') {
            icd_sql.append(ics_search);
        }

        icd_sql.append(SQL` ORDER BY  ${params.sortField} `)
            .append(params.sortOrder)
            .append(SQL` LIMIT ${params.pageSize}`)
            .append(SQL` OFFSET ${((params.page - 1) * params.pageSize)}`);

        return await query(icd_sql);
    },
    getProviderGroups: async function (params) {

        let provider_group_q = ` AND (group_code ILIKE '%${params.q}%' OR group_name ILIKE '%${params.q}%' ) `;

        const provider_group_sql = SQL`SELECT
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

        if (params.q != '') {
            provider_group_sql.append(provider_group_q);
        }

        provider_group_sql.append(SQL` ORDER BY  ${params.sortField} `)
            .append(params.sortOrder)
            .append(SQL` LIMIT ${params.pageSize}`)
            .append(SQL` OFFSET ${((params.page - 1) * params.pageSize)}`);

        return await query(provider_group_sql);
    },
    getInsurances: async function (params) {

        let insurance_q = ` AND (insurance_name ILIKE '%${params.q}%' OR insurance_code ILIKE '%${params.q}%' ) `;

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

        if (params.q != '') {
            insurance_sql.append(insurance_q);
        }

        insurance_sql.append(SQL` ORDER BY  ${params.sortField} `)
            .append(params.sortOrder)
            .append(SQL` LIMIT ${params.pageSize}`)
            .append(SQL` OFFSET ${((params.page - 1) * params.pageSize)}`);

        return await query(insurance_sql);
    },

    getPatients: async function (params) {
        const sql_patient = SQL`
              SELECT
              account_no,
              gender,
              patients.birth_date AS DOB,
              patients.id,
              full_name,
              patients.owner_id,
              total_records         
            FROM (
                SELECT
                    distinct(patients.id) as patients_id,
                    COUNT(1) OVER (RANGE UNBOUNDED PRECEDING) AS total_records
                FROM
                    patients                
                WHERE  
                    NOT patients.has_deleted 
                    AND patients.company_id =  ${params.company_id}                                 
                AND is_active          
                ORDER BY patients.id ASC 
                LIMIT ${params.pageSize}
                OFFSET ${((params.page - 1) * params.pageSize)}   
                ) 
            AS finalPatients INNER JOIN patients ON finalPatients.patients_id = patients.id                  
            ORDER BY patients.id ASC
        `;

        return await query(sql_patient);
    },

    getOrderingFacility: async function (params) {

        let facility_q = ` AND (group_code ILIKE '%${params.q}%' OR group_name ILIKE '%${params.q}%' ) `;

        const sqlOrderingFacility = SQL`
            SELECT
                id
                ,id As provider_group_id
                ,group_code
                ,group_name
                ,group_info
                ,is_active
                ,company_id
                ,(SELECT COUNT(1) FROM provider_groups 
                WHERE
                    provider_groups.has_deleted = false
                    AND (provider_groups.group_type = 'OF'  OR provider_groups.group_type IS NULL)
                    AND provider_groups.company_id = 1 AND is_active = TRUE
                ) AS total_records
            
            FROM provider_groups    
            WHERE
                provider_groups.has_deleted = false
                AND (provider_groups.group_type = 'OF'  OR provider_groups.group_type IS NULL)
                AND provider_groups.company_id = 1 AND is_active = TRUE `;

        if (params.q != '') {
            sqlOrderingFacility.append(facility_q);
        }

        sqlOrderingFacility.append(SQL` ORDER BY group_name `)
            .append(params.sortOrder)
            .append(SQL` LIMIT ${params.pageSize}`)
            .append(SQL` OFFSET ${((params.page - 1) * params.pageSize)}`);

        return await query(sqlOrderingFacility);
    },

    getProvidersAc: async function (params) {

        let providers_q = ` AND (p.provider_code ILIKE '%${params.q}%' OR p.full_name ILIKE '%${params.q}%' ) `;

        const sqlProvides = SQL`
            SELECT
            p.id,
            p.full_name,
            p.last_name,
            p.first_name,
            p.marketing_rep,
            p.middle_initial,
            p.is_active,
            p.suffix,
            p.provider_type,
            p.provider_code,
            pc.contact_info,
            p.facilities, (
                SELECT
                    count(1)
                FROM
                    providers p
                    JOIN provider_contacts pc ON p.id = pc.provider_id
            WHERE
                p.has_deleted = FALSE
                AND p.is_active = TRUE
                AND p.sys_provider = FALSE
                AND pc.is_active = TRUE
                AND pc.has_deleted = FALSE
                AND p.company_id = ${params.company_id}
                    ) AS total_records,
                    pc.id,
                    p.id as provider_id
                    FROM
                        providers p
                    JOIN
                        provider_contacts pc ON p.id = pc.provider_id
            WHERE
                p.has_deleted = FALSE
                AND p.is_active = TRUE
                AND p.sys_provider = FALSE
                AND pc.is_active = TRUE
                AND pc.has_deleted = FALSE
                AND p.company_id = ${params.company_id} `;

        if (params.q != '') {
            sqlProvides.append(providers_q);
        }

        sqlProvides.append(SQL` ORDER BY last_name ASC `)
            .append(SQL` LIMIT ${params.pageSize}`)
            .append(SQL` OFFSET ${((params.page - 1) * params.pageSize)}`);

        return await query(sqlProvides);
    }
};
