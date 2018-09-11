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
                                , ipd.billing_method
                                , COUNT(1) OVER (range unbounded preceding) as total_records
                            FROM
                                insurance_providers
                            LEFT JOIN billing.insurance_provider_details ipd on ipd.insurance_provider_id = insurance_providers.id
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

        let patient_q = ` AND full_name ILIKE '%${params.q}%' OR account_no ILIKE '%${params.q}%' `;

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
                    AND patients.company_id =  ${params.company_id} `;

        if (params.q != '') {
            sql_patient.append(patient_q);
        }

        sql_patient.append(SQL` AND is_active
                ORDER BY patients.id ASC
                )
            AS finalPatients INNER JOIN patients ON finalPatients.patients_id = patients.id `)
            .append(SQL` ORDER BY full_name `)
            .append(params.sortOrder)
            .append(SQL` LIMIT ${params.pageSize}`)
            .append(SQL` OFFSET ${((params.page - 1) * params.pageSize)}`);

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

    getUsers: async function (params) {
        let users_q = '';

        if (params.q) {
            users_q = ` AND (username ILIKE '%${params.q}%' ) `;
        }

        const user_sql = `SELECT
                                users.id AS id,
                                username AS user_name,
                                first_name AS first_name,
                                last_name AS last_name,
                                middle_initial AS middle_name,
                                suffix AS suffix,
                                users.user_group_id AS users_group_id,
                                users.user_type AS users_type,
                                users.password_changed_dt AS change_pwd_dt,
                                user_group_details.total_records as total_records
                            FROM public.users
                            INNER JOIN LATERAL (
                                SELECT
                                    users.id,
                                    COUNT(1) OVER (range UNBOUNDED PRECEDING) AS total_records
                                FROM
                                    public.users
                                    INNER JOIN user_groups ON user_groups.id = users.user_group_id
                                    INNER JOIN public.user_roles AS ur ON ur.id = ANY (user_groups.user_roles)
                                    WHERE( LOWER(user_groups.group_name) = 'billing'
                                            OR LOWER(ur.role_name) = 'billing'
                                            OR LOWER(ur.role_name) = 'billing1.5'
                                            OR (group_info -> 'user_nav')::jsonb ? 'billing'
                                         )
                                    AND users.has_deleted = FALSE
                                    ${users_q}
                                    AND users.is_active
                                    AND users.has_deleted = FALSE
                                    AND users.company_id= ${params.company_id}
                                    GROUP BY users.id
                                    LIMIT ${params.pageSize}
                                    OFFSET ${((params.page * params.pageSize) - params.pageSize)}
                            ) user_group_details ON user_group_details.id = users.id
                            ORDER BY username ASC`;
        return await query(user_sql);
    },

    getUserRoles: async function (params) {

        let users_role_q = ` AND (role_name ILIKE '%${params.q}%' ) `;

        const user_role_sql = SQL`SELECT
                                user_roles.id AS id,
                                role_name AS role_name,
                                role_description AS role_decriptions,
                                COUNT(1) OVER (range unbounded preceding) AS total_records
                            FROM
                                    public.user_roles
                            WHERE
                                    user_roles.has_deleted=FALSE AND
                                    user_roles.is_active AND
                                    user_roles.company_id= ${params.company_id} `;

        if (params.q != '') {
            user_role_sql.append(users_role_q);
        }

        user_role_sql.append(SQL`ORDER BY  ${params.sortField}`)
            .append(SQL` `)
            .append(params.sortOrder)
            .append(SQL` LIMIT ${params.pageSize}`)
            .append(SQL` OFFSET ${((params.page * params.pageSize) - params.pageSize)}`);

        return await query(user_role_sql);
    },

    insurance_payer_types: async function (params) {

        let payer_q = ` AND (description ILIKE '%${params.q}%' OR code ILIKE '%${params.q}%' ) `;

        const sqlInsurancePayerType = SQL`
            SELECT
                id
                , code
                , description
                ,company_id
                ,(SELECT COUNT(1) FROM insurance_provider_payer_types  ) AS total_records
            FROM insurance_provider_payer_types
            WHERE
            inactivated_dt IS  NULL `;

        if (params.q != '') {
            sqlInsurancePayerType.append(payer_q);
        }

        sqlInsurancePayerType.append(SQL`ORDER BY  ${params.sortField}`)
            .append(SQL` `)
            .append(params.sortOrder);

        return await query(sqlInsurancePayerType);
    },

    getEDITemplateList: async () =>{
        const sql = SQL`SELECT
                              id
                            , name
                        FROM
                        billing.edi_templates
                        WHERE template_type = 'edi' `;

        return await query(sql);
    },

    getProviderGroupDetail: async function (params) {

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
                                    NOT provider_groups.has_deleted
                                    AND provider_groups.company_id = ${params.company_id} AND is_active `;

        if (params.q != '') {
            provider_group_sql.append(provider_group_q);
        }

        provider_group_sql.append(SQL` ORDER BY  ${params.sortField} `)
            .append(params.sortOrder)
            .append(SQL` LIMIT ${params.pageSize}`)
            .append(SQL` OFFSET ${((params.page - 1) * params.pageSize)}`);

        return await query(provider_group_sql);
    }
};
