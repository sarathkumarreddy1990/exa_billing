const { query, SQL } = require('./index');

module.exports = {
    getStudyStatus: async function () {
        const sql_status = `WITH distinct_cte AS (
                               SELECT DISTINCT status_code,status_desc FROM study_status
                            )

                            SELECT status_code,array_agg(status_desc) AS status_desc
                            FROM distinct_cte
                            GROUP BY status_code
                            ORDER BY status_desc`;

        return await query(sql_status);
    },

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
                                 , is_active /* cpt_codes.is_active */
                                 , duration
                                 , additional_info
                                 , ref_code
                                 , additional_info -> 'ndc_code' as ndc_code
                                 , 184 as total_records
                                 , exam_prep_instructions
                                 , rvu
                                 , COUNT(1) OVER (range unbounded preceding) as total_records
                                 , charge_type
                                FROM
                                    cpt_codes
                                WHERE
                                    NOT has_deleted AND company_id = ${params.company_id} AND is_active `; // cpt_codes.has_deleted

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
        let {
            q,
            page,
            pageSize,
            sortField,
            sortOrder,
            company_id,
            billingRegion,
            provider_type
        } = params;

        let provider_search = ` AND (p.full_name ILIKE '%${q}%' OR p.provider_code ILIKE '%${q}%' ) `;

        const sql_provider = SQL`
            SELECT
                  pc.id AS id
                , p.first_name
                , p.id AS provider_id
                , p.is_active AS is_active /* public.providers.is_active */
                , pc.id AS provider_contact_id
                , p.last_name
                , p.full_name
                , p.provider_code
                , p.specialities
                , p.provider_info->'NPI' AS npi_no
                , hstore_to_json(contact_info) AS contact_info
                , COUNT(1) OVER (range unbounded preceding) AS total_records
            FROM public.providers p
                INNER JOIN
                    provider_contacts pc ON pc.provider_id = p.id
            WHERE
                p.deleted_dt IS NULL
                AND pc.is_active
                AND pc.deleted_dt IS NULL
                AND pc.is_active
                AND p.is_active /* public.providers.is_active */
                AND p.company_id = ${company_id}
                AND p.provider_type = ${provider_type}
                AND NOT p.sys_provider -- we dont want system providers
        `; // provider_contacts.has_deleted

        if (billingRegion === 'can_AB' && provider_type === 'RF') {
            sql_provider.append(SQL` AND pc.is_primary`);
        }

        if (params.q != '') {
            sql_provider.append(provider_search);
        }

        sql_provider.append(SQL` ORDER BY  ${sortField} `)
            .append(sortOrder)
            .append(SQL` LIMIT ${pageSize}`)
            .append(SQL` OFFSET ${((page - 1) * pageSize)}`);

        return await query(sql_provider);
    },
    getICDcodes: async function (params) {
        let {
            company_id,
            page = 1,
            pageSize = 10,
            term,
            sortField = "code",
            sortOrder = "ASC"
        } = params;

        let ics_search = ` AND (code ILIKE '%${term}%' OR description ILIKE '%${term}%' ) `;

        const icd_sql = SQL`SELECT
                                       id
                                     , code
                                     , description
                                     , code_type
                                     , COUNT(1) OVER (range unbounded preceding) AS total_records
                                FROM icd_codes AS icd
                                WHERE
                                    icd.is_active AND NOT icd.has_deleted AND icd.company_id = ${company_id} `; // icd_codes.has_deleted icd_codes.is_active

        if (term) {
            icd_sql.append(ics_search);
        }

        icd_sql.append(SQL` ORDER BY  ${sortField} `)
            .append(sortOrder)
            .append(SQL` LIMIT ${pageSize}`)
            .append(SQL` OFFSET ${((page - 1) * pageSize)}`);

        return await query(icd_sql);
    },

    getProviderSkillCodes: async function (params) {
        let skill_code_search = ` AND (sc.code ILIKE '%${params.q}%' ) `;
        const skill_code_sql = SQL`
            SELECT
                psc.provider_id,
                psc.skill_code_id AS id,
                sc.code,
                sc.description,
                COUNT(1) OVER (range unbounded preceding) AS total_records
            FROM
                provider_skill_codes psc
            INNER JOIN skill_codes sc ON psc.skill_code_id = sc.id
            LEFT JOIN provider_contacts pc ON pc.provider_id = psc.provider_id
            WHERE
                pc.id = ${params.reading_physician_id}
        `;

        if (params.q != '') {
            skill_code_sql.append(skill_code_search);
        }

        skill_code_sql.append(SQL` ORDER BY  ${params.sortField} `)
            .append(params.sortOrder)
            .append(SQL` LIMIT ${params.pageSize}`)
            .append(SQL` OFFSET ${((params.page - 1) * params.pageSize)}`);

        return await query(skill_code_sql);
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
                                , ipd.is_split_claim_enabled
                            FROM
                                insurance_providers
                            LEFT JOIN billing.insurance_provider_details ipd on ipd.insurance_provider_id = insurance_providers.id
                            WHERE
                                insurance_providers.deleted_dt IS NULL AND company_id = ${params.company_id} `; // insurance_providers.has_deleted

        if (params.isInactive == 'false') {
            insurance_sql.append(`AND insurance_providers.inactivated_dt IS NULL`); // insurance_providers.is_active
        }

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

        const patient_q = (params.q === '') ? `` : `
            AND (
                CASE
                    WHEN trim('${params.q}') ~* ','
                        THEN patients.full_name ~* (
                            '('
                            || trim(split_part(trim('${params.q}'), ',' , 1))
                            || '.*,.*'
                            || trim(split_part(trim('${params.q}'), ',' , 2))
                            || '.*)|('
                            || trim(split_part(trim('${params.q}'), ',' , 2))
                            || '.*,.*'
                            || trim(split_part(trim('${params.q}'), ',' , 1))
                            || '.*)'
                        )
                    WHEN trim('${params.q}') ~* '\\d\\d/\\d\\d/\\d\\d\\d\\d'
                        THEN patients.birth_date = to_date(trim('${params.q}'), 'mm/dd/yyyy')
                    WHEN trim('${params.q}') ~* '\\d\\d\\d\\d-\\d\\d\\-\\d\\d'
                        THEN patients.birth_date = to_date(trim('${params.q}'), 'yyyy-mm-dd')
                    ELSE
                        (patients.full_name ~* trim('${params.q}') OR patients.account_no ~* trim('${params.q}'))
                END
            )
        `;

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
                    patients.deleted_dt IS NULL
                    AND patients.company_id =  ${params.company_id} `;

        if (params.q != '') {
            sql_patient.append(patient_q);
        }

        sql_patient.append(SQL` AND is_active /* patients.is_active */
                ORDER BY patients.id ASC
                )
            AS finalPatients INNER JOIN patients ON finalPatients.patients_id = patients.id `)
            .append(SQL` ORDER BY full_name `)
            .append(params.sortOrder)
            .append(SQL` LIMIT ${params.pageSize}`)
            .append(SQL` OFFSET ${((params.page - 1) * params.pageSize)}`);

        return await query(sql_patient);
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
                                            OR (group_info -> 'user_nav') ? 'billing'
                                         )
                                    AND users.deleted_dt IS NULL
                                    ${users_q}
                                    AND users.is_active
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

        user_role_sql.append(SQL`ORDER BY ${params.sortField}`)
            .append(SQL` `)
            .append(params.sortOrder)
            .append(SQL` LIMIT ${params.pageSize}`)
            .append(SQL` OFFSET ${((params.page * params.pageSize) - params.pageSize)}`);

        return await query(user_role_sql);
    },

    insurance_payer_types: async function (params) {
        let {
            q,
            sortField,
            sortOrder,
            pageSize,
            page
        } = params;

        let payer_q = ` AND (description ILIKE '%${q}%' OR code ILIKE '%${q}%' ) `;
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

        if (q != '') {
            sqlInsurancePayerType.append(payer_q);
        }

        sqlInsurancePayerType.append(SQL`ORDER BY  ${sortField}`)
            .append(SQL` `)
            .append(sortOrder)
            .append(SQL` LIMIT ${pageSize}`)
            .append(SQL` OFFSET ${((page * pageSize) - pageSize)}`);

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
        let {
            q,
            sortField,
            sortOrder,
            pageSize,
            page,
            groupType
        } = params;

        let provider_group_q = ` AND (group_code ILIKE '%${q}%' OR group_name ILIKE '%${q}%' ) `;

        const provider_group_sql = SQL`SELECT
                                     id
                                     ,id As provider_group_id
                                     ,group_code
                                     ,group_name
                                     ,group_info
                                     ,is_active /* provider_groups.is_active */
                                     ,company_id
                                     ,COUNT(1) OVER (range unbounded preceding) AS total_records
                                FROM provider_groups
                                WHERE
                                    provider_groups.deleted_dt IS NULL
                                    AND provider_groups.company_id = ${params.companyId}
                                    AND is_active `;

        if (q != '') {
            provider_group_sql.append(provider_group_q);
        }

        if(groupType) {
            provider_group_sql.append(` AND group_type = '${groupType}' `);
        }

        provider_group_sql.append(SQL` ORDER BY  ${sortField} `)
            .append(sortOrder)
            .append(SQL` LIMIT ${pageSize}`)
            .append(SQL` OFFSET ${((page - 1) * pageSize)}`);

        return await query(provider_group_sql);
    },

    getAdjustmentCodes: async function (params) {

        let adj_code_search = ` AND (code ILIKE '%${params.q}%' OR description ILIKE '%${params.q}%' ) `;

        const adj_code_sql = SQL`SELECT
                                       id
                                     , code
                                     , description
                                     , accounting_entry_type
                                     , COUNT(1) OVER (range unbounded preceding) AS total_records
                                FROM billing.adjustment_codes AS bac
                                WHERE
                                bac.inactivated_dt IS NULL AND bac.company_id = ${params.company_id} `;

        if (params.q != '') {
            adj_code_sql.append(adj_code_search);
        }

        adj_code_sql.append(SQL` ORDER BY  ${params.sortField} `)
            .append(params.sortOrder)
            .append(SQL` LIMIT ${params.pageSize}`)
            .append(SQL` OFFSET ${((params.page - 1) * params.pageSize)}`);

        return await query(adj_code_sql);
    },

    getWCBCodes: async (params) => {
        let {
            q,
            codeType,
            sortField,
            sortOrder,
            page,
            pageSize
        } = params;

        let wcb_code_search = ` AND (pwic.code ILIKE '%${q}%' OR pwic.description ILIKE '%${q}%') `;

        const wcb_code_sql = SQL`SELECT
                                       id
                                     , code
                                     , description
                                     , injury_code_type
                                     , COUNT(1) OVER (range unbounded preceding) AS total_records
                                FROM public.can_wcb_injury_codes AS pwic
                                WHERE pwic.injury_code_type = ${codeType}
                                AND pwic.inactivated_dt IS NULL `;

        if (q != '') {
            wcb_code_sql.append(wcb_code_search);
        }

        wcb_code_sql.append(SQL` ORDER BY  ${sortField} `)
            .append(sortOrder)
            .append(SQL` LIMIT ${pageSize}`)
            .append(SQL` OFFSET ${((page - 1) * pageSize)}`);

        return await query(wcb_code_sql);
    },

    getOrderingFacilities: async (args) => {
        let {
            company_id,
            sortField,
            sortOrder,
            pageSize,
            page,
            q,
            isCensus,
            hideInactive
        } = args;
        let whereQuery = '';

        if (q) {
            whereQuery += ` AND (code ILIKE '%${q}%' OR name ILIKE '%${q}%' ) `;
        }

        const inactiveQuery = hideInactive === 'true' || !isCensus
                ? 'AND ofc.inactivated_dt IS NULL'
                : '';

        if (isCensus) {
            whereQuery += `AND ofc.billing_type = 'census'`;
        }

        const sql = SQL`
            WITH get_ordering_facility_count AS (
                SELECT
                    COUNT(DISTINCT of.id) AS total_records
                FROM ordering_facilities of
                INNER JOIN ordering_facility_contacts ofc ON of.id = ofc.ordering_facility_id`
            .append(`
                WHERE
                    of.deleted_dt IS NULL
                    AND of.inactivated_dt IS NULL
                    ${inactiveQuery}
                    AND of.company_id = ${company_id} `)
            .append(whereQuery)
            .append(`
            )
            SELECT
                DISTINCT of.id
                , of.code AS ordering_facility_code
                , of.name AS ordering_facility_name
                , of.inactivated_dt
                , of.company_id
                , gofc.total_records
            FROM ordering_facilities of
            INNER JOIN ordering_facility_contacts ofc ON of.id = ofc.ordering_facility_id
            INNER JOIN get_ordering_facility_count gofc ON TRUE`)
            .append(`
            WHERE  of.deleted_dt IS NULL
                AND of.inactivated_dt IS NULL
                ${inactiveQuery}
                AND of.company_id = ${company_id}
            ${whereQuery} `);

        sql.append(`
                    ORDER BY
                        ${sortField} ${sortOrder}
                    LIMIT
                        ${pageSize}
                    OFFSET
                        ${(page - 1) * pageSize} `);

        return await query(sql);
    },

    getOrderingFacilityContacts: async (args) => {
        let {
            company_id,
            sortField,
            sortOrder,
            facility_id,
            pageSize,
            page,
            q
        } = args;
        let whereQuery = '';

        let facility_query = '';
        if (facility_id) {
            facility_query = ` AND EXISTS (
                SELECT 1
                FROM ordering_facility_facilities
                WHERE ordering_facility_id = pof.id
                AND facility_id = ${facility_id}
            )`;
        }

        if (q) {
            whereQuery = SQL` AND (
                pofc.location ILIKE '%' || ${q} || '%' OR
                pof.name ILIKE '%' || ${q} || '%'
            ) `;
        }

        const sql = SQL`
            WITH get_ordering_facility_contacts_count AS (
                SELECT
                    COUNT(1) AS total_records
                FROM public.ordering_facility_contacts pofc
                INNER JOIN public.ordering_facilities pof ON pof.id = pofc.ordering_facility_id AND pof.deleted_dt IS NULL
                WHERE pofc.inactivated_dt IS NULL
                    AND pof.inactivated_dt IS NULL
                    AND pof.company_id = ${company_id}`
            .append(facility_query)
            .append(whereQuery)
            .append(`
            )
            SELECT
                DISTINCT(pofc.location)
                , pofc.id
                , pofc.phone_number
                , pofc.fax_number
                , pofc.email
                , pofc.billing_type
                , pof.code AS ordering_facility_code
                , pof.name AS ordering_facility_name
                , pof.address_line_1
                , pof.address_line_2
                , pof.city
                , pof.state
                , pof.zip_code
                , pof.zip_plus
                , COALESCE(oft.description, '') AS ordering_facility_type
                , gofc.total_records
            FROM public.ordering_facility_contacts pofc
            INNER JOIN public.ordering_facilities pof ON pof.id = pofc.ordering_facility_id AND pof.deleted_dt IS NULL
            INNER JOIN get_ordering_facility_contacts_count gofc ON TRUE
            LEFT JOIN ordering_facility_types oft ON oft.id = pofc.ordering_facility_type_id
            WHERE pofc.inactivated_dt IS NULL
                AND pof.inactivated_dt IS NULL
                AND pof.company_id = ${company_id}`)
            .append(facility_query)
            .append(whereQuery);

        sql.append(`
                    ORDER BY
                        ${sortField || 'pofc.location'} ${sortOrder || 'ASC'}
                    LIMIT
                        ${pageSize}
                    OFFSET
                        ${(page - 1) * pageSize} `);

        return await query(sql);
    },

    getServiceFacilities: async (args) => {
        let {
            company_id
        } = args;

        const sql = SQL `SELECT
                              pof.id
                            , pof.code
                            , pof.name
                        FROM public.ordering_facilities pof
                        WHERE
                            pof.deleted_dt IS NULL
                            AND pof.company_id = ${company_id}
                        `;
        return await query(sql);
    },

    getPatientAltAccounts: async (params) => {
        let {
            patient_id,
            sortField,
            sortOrder,
            pageSize,
            page,
        } = params;

        const sql = SQL`
            SELECT
                paa.id
                , paa.issuer_id
                , i.issuer_type
                , paa.alt_account_no
                , paa.is_primary
                , paa.country_alpha_3_code
                , paa.province_alpha_2_code
            FROM patient_alt_accounts paa
            INNER JOIN issuers i ON paa.issuer_id = i.id
        `;

        sql.append(SQL` WHERE patient_id = ${patient_id} `);
        if (sortField && sortOrder) {
            sql.append(SQL` ORDER BY `)
                .append(sortField)
                .append(SQL` `)
                .append(sortOrder);
        }

        if (pageSize && page) {
            sql.append(SQL` LIMIT ${pageSize} OFFSET ${((page - 1) * pageSize)} `);
        }

        return await query(sql);
    },
};
