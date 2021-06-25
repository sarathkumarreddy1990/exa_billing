const studyfilterdata = require('./../study-filters');
const filterValidator = require('./../filter-validator')();
const config = require('../../config');
const moment = require('moment');
const { query, SQL } = require('./../index');
const util = require('./../util');
const _ = require('lodash');

const colModel = [
    {
        name: 'claim_dt',
        searchColumns: ['claims.claim_dt'],
        searchFlag: 'daterange'
    },
    {
        name: 'modalities',
        searchColumns: ['studies.modalities'],
        searchFlag: '%'
    },
    {
        name: 'created_dt',
        searchColumns: ['claims.created_dt'],
        searchFlag: 'daterange'
    },
    {
        name: 'submitted_dt',
        searchColumns: ['claims.submitted_dt'],
        searchFlag: 'daterange'
    },
    {
        name: 'claim_status',
        searchFlag: 'int',
        searchColumns: ['claims.claim_status_id']
    },
    {
        name: 'patient_name',
        searchColumns: ['patients.full_name'],
        searchFlag: '%'
    },
    {
        name: 'reason_code',
        searchColumns: ['cas_reason_codes.code'],
        searchFlag: 'arrayString'
    },
    {
        name: 'birth_date',
        searchColumns: ['patients.birth_date'],
        searchFlag: 'date'
    },
    {
        name: 'account_no',
        searchColumns: ['patients.account_no'],
        searchFlag: '%'
    },
    {
        name: 'patient_ssn',
        searchFlag: 'hstore',
        searchColumns: [`patients.patient_info->'ssn'`]
    },
    {
        name: 'billing_provider',
        searchFlag: 'int',
        searchColumns: ['billing_providers.id']
    },
    {
        name: 'place_of_service',
        searchFlag: 'int',
        searchColumns: ['places_of_service.id']
    },
    {
        name: 'referring_providers',
        searchColumns: ['ref_provider.full_name'],
        searchFlag: '%'
    },
    {
        name: 'rendering_provider',
        searchColumns: ['render_provider.full_name'],
        searchFlag: '%'
    },
    {
        name: 'billing_fee',
        searchFlag: 'money',
        searchColumns: ['bgct.charges_bill_fee_total']
    },
    {
        name: 'invoice_no',
        searchFlag: '%',
        searchColumns: ['claims.invoice_no']
    },
    {
        name: 'billing_method',
        searchFlag: '%',
        searchColumns: ['claims.billing_method']
    },
    {
        name: 'followup_date',
        searchColumns: ['claim_followups.followup_date'],
        searchFlag: 'date'
    },
    {
        name: 'current_illness_date',
        searchColumns: ['claims.current_illness_date'],
        searchFlag: 'date'
    },
    {
        name: 'claim_no',
        searchFlag: 'int',
        searchColumns: ['claims.id']
    },
    {
        name: 'can_ahs_claim_no',
        searchFlag: '%',
        searchColumns: ['billing.can_ahs_get_claim_number(claims.id)']
    },
    {
        name: 'policy_number',
        searchFlag: '%',
        searchColumns: ['patient_insurances.policy_number']
    },
    {
        name: 'group_number',
        searchFlag: '%',
        searchColumns: ['patient_insurances.group_number']
    },
    {
        name: 'payer_type',
        searchFlag: '%',
        searchColumns: ['claims.payer_type']
    },
    {
        name: 'payer_name',
        searchFlag: '%',
        searchColumns: [`(  CASE payer_type
                WHEN 'primary_insurance' THEN payer_insurance.insurance_name
                WHEN 'secondary_insurance' THEN payer_insurance.insurance_name
                WHEN 'tertiary_insurance' THEN payer_insurance.insurance_name
	            WHEN 'ordering_facility' THEN ordering_facilities.name
	            WHEN 'referring_provider' THEN ref_provider.full_name
	            WHEN 'rendering_provider' THEN render_provider.full_name
	            WHEN 'patient' THEN patients.full_name        END) `]
    },
    {
        name: 'clearing_house',
        searchColumns: [`edi_clearinghouses.id`],
        searchFlag: 'int'
    },
    {
        name: 'edi_template',
        searchColumns: [`payer_insurance.insurance_info->'edi_template'`],
        searchFlag: '%'
    },
    {
        name: 'claim_balance',
        searchColumns: ['bgct.claim_balance_total'],
        searchFlag: 'money'
    },
    {
        name: 'billing_code',
        searchColumns: ['claims.billing_code_id'],
        searchFlag: 'int'
    },
    {
        name: 'billing_class',
        searchColumns: ['claims.billing_class_id'],
        searchFlag: 'int'
    },
    {
        name: 'gender',
        searchColumns: ['patients.gender'],
        searchFlag: 'left%'
    },
    {
        name: 'billing_notes',
        searchColumns: ['claims.billing_notes'],
        searchFlag: '%'
    },
    {
        name: 'assigned_to',
        searchColumns: ['users.id'],
        searchFlag: '='
    },
    {
        name: 'first_statement_dt',
        searchColumns: ['claim_comment.created_dt'],
        searchFlag: 'daterange'
    },
    {
        name: 'facility_name',
        searchColumns: ['claims.facility_id'], //since search column assigned as facility_id in grid dropdown
        searchFlag: 'int'
    },
    {
        name: 'ordering_facility_name',
        searchColumns: ['ordering_facilities.name'],
        searchFlag: '%'
    },
    {
        name: 'charge_description',
        searchColumns: ['charge_details.charge_description'],
        searchFlag: '%'
    },
    {
        name: 'ins_provider_type',
        searchColumns: ['insurance_provider_payer_types.description'],
        searchFlag: '%'
    },
    {
        name: 'icd_description',
        searchColumns: ['claim_icds.description'],
        searchFlag: 'arrayString'
    },
    {
        name: 'claim_action',
        searchColumns: [`(CASE
                WHEN claims.frequency = 'corrected'
                THEN 'corrected_claim'
                WHEN (claims.frequency != 'corrected' OR claims.frequency IS NULL)
                THEN 'new_claim' END)`],
        searchFlag: '='
    },
    {
        name: 'insurance_providers'
        , searchColumns: [`ins_prov.insurance_name`]
        , searchFlag: '%'
    },
    {
        name: 'can_mhs_microfilm_no'
        , searchColumns:[`claims.can_mhs_microfilm_no`]
        , searchFlag: '%'
    },
    {
        name: 'pid_alt_account',
        searchColumns: ['patient_alt_accounts.pid_alt_account'],
        searchFlag: 'arrayString'
    },
    {
        name: 'phn_alt_account',
        searchColumns: ['patient_alt_accounts.phn_alt_account'],
        searchFlag: 'arrayString'
    },
    {
        name: 'can_bc_claim_sequence_numbers',
        searchColumns: ['billing.can_bc_get_claim_sequence_numbers(claims.id)'],
        searchFlag: 'arrayString'
    }
];

const api = {

    getCombinedQuery: (joined_filters) => {
        const queries = joined_filters.reduce((queries, { filter_info }) => {
            const sqlQuery = util.getClaimFilterQuery(filter_info, 'claims');

            if (sqlQuery) {
                queries.push(sqlQuery);
            }

            return queries;
        }, []);

        if (queries.length) {
            const joinedQueries = queries.join(') OR (');
            return `(( ${joinedQueries} ))`;
        }

        return '';
    },


    getTables: function (filter) {
        // This assumes all columns are prefixed with their table name table.column
        let tables = {};
        let reg = /([a-zA-Z0-9_]+)\..*?/g;
        let res = null;

        while ((res = reg.exec(filter))) {
            tables[res[1]] = true;
        }

        return tables;
    },

    getSortFields: function (args) {
        //console.log('getSortFields: ', args, screenName);
        switch (args) {
            case 'study_dt':
            case 'study_received_dt': return 'claims.claim_dt';
            case 'created_dt': return 'claims.created_dt';
            case 'claim_status': return 'claim_status.description';
            case 'claim_id':
            case 'id': return 'claims.id';
            case 'patient_name': return 'patients.full_name';
            case 'reason_code': return 'cas_reason_codes.code';
            case 'birth_date': return 'patients.birth_date::text';
            case 'account_no': return 'patients.account_no';
            case 'patient_ssn': return `patients.patient_info->'ssn'`;
            case 'billing_provider': return 'billing_providers.name';
            case 'place_of_service': return 'places_of_service.description';
            case 'referring_providers': return 'ref_provider.full_name';
            case 'rendering_provider': return 'render_provider.full_name';
            case 'ordering_facility_name': return 'ordering_facilities.name';
            case 'facility_name': return 'facilities.facility_name';
            case 'billing_fee': return 'bgct.charges_bill_fee_total';
            case 'invoice_no': return 'claims.invoice_no';
            case 'billing_method': return 'claims.billing_method';
            case 'modalities': return 'studies.modalities';
            case 'followup_date': return 'claim_followups.followup_date::text';
            case 'current_illness_date': return 'claims.current_illness_date::text';
            case 'claim_no': return 'claims.id';
            case 'can_ahs_claim_no': return 'billing.can_ahs_get_claim_number(claims.id)';
            case 'policy_number': return 'patient_insurances.policy_number';
            case 'group_number': return 'patient_insurances.group_number';
            case 'payer_type':
            case 'ref_phy': return 'claims.payer_type';
            case 'assigned_to': return 'users.username';
            case 'payer_name':
                return `(  CASE payer_type
                WHEN 'primary_insurance' THEN payer_insurance.insurance_name
                WHEN 'secondary_insurance' THEN payer_insurance.insurance_name
                WHEN 'tertiary_insurance' THEN payer_insurance.insurance_name
	            WHEN 'ordering_facility' THEN ordering_facilities.name
	            WHEN 'referring_provider' THEN ref_provider.full_name
	            WHEN 'rendering_provider' THEN render_provider.full_name
	            WHEN 'patient' THEN patients.full_name        END)
                    `;
            case 'clearing_house': return 'edi_clearinghouses.name';
            case 'claim_balance': return 'bgct.claim_balance_total';
            case 'billing_code': return 'billing_codes.description';
            case 'billing_class': return 'billing_classes.description';
            case 'gender': return 'patients.gender';
            case 'billing_notes': return '(claims.billing_notes  IS NULL) ,claims.billing_notes ';
            case 'submitted_dt': return 'claims.submitted_dt';
            case 'first_statement_dt': return 'claim_comment.created_dt';
            case 'charge_description': return `nullif(charge_details.charge_description,'')`;
            case 'ins_provider_type': return 'insurance_provider_payer_types.description';
            case 'icd_description': return 'claim_icds.description';
            case 'claim_action': return 'claims.frequency';
            case 'insurance_providers': return `ins_prov.insurance_name`;
            case 'can_mhs_microfilm_no': return `claims.can_mhs_microfilm_no`;
            case 'pid_alt_account': return 'patient_alt_accounts.pid_alt_account';
            case 'phn_alt_account': return 'patient_alt_accounts.phn_alt_account';
            case 'can_bc_claim_sequence_numbers': return 'billing.can_bc_get_claim_sequence_numbers(claims.id)';
        }

        return args;
    },

    // one of the columns must be a "number" as that is used for sorting
    // row_number() over( order by "column" ) as number
    getWLQuery: function (columns, args) {
        args.sortField = api.getSortFields(args.sortField);


        let tables = Object.assign({}, api.getTables(args.sortField), api.getTables(args.filterQuery), api.getTables(args.permissionQuery), api.getTables(columns));

        const permissionQuery = args.permissionQuery ? ` INNER JOIN (${args.permissionQuery}) pquery ON pquery.id = studies.id ` : '';

        const query = `
            SELECT
                ${columns}
            FROM
                billing.claims
                INNER JOIN facilities ON facilities.id=claims.facility_id
            ${permissionQuery}
            ${api.getWLQueryJoin(tables, true, args.customArgs.filter_id, args.user_id, args.isCount) + args.filterQuery}
            `;
        return query;
    },
    getWLQueryJoin: function (columns, isInnerQuery, filterID, userID, isCount) {
        let tables = isInnerQuery ? columns : api.getTables(columns);

        let r = '';

        if ((!isCount && columns && tables.bgct) || (isCount && tables.bgct)) {
            r = ' INNER JOIN LATERAL billing.get_claim_totals(claims.id) bgct ON TRUE ';
        }

        if (tables.patients) { r += ' INNER JOIN patients ON claims.patient_id = patients.id '; }

        //  if (tables.facilities) { r += ' INNER JOIN facilities ON facilities.id=claims.facility_id '; }
        if (tables.studies) {
            r += `  LEFT JOIN LATERAL (
                SELECT
                    studies.modalities,
                    billing.claims.id
                FROM studies
                INNER JOIN billing.charges ON charges.claim_id = claims.id
                INNER JOIN billing.charges_studies ON charges_studies.charge_id = charges.id
                and studies.id = charges_studies.study_id
                GROUP BY billing.claims.id, studies.modalities
            ) studies ON TRUE `}

        if (tables.claim_status) { r += ' INNER JOIN billing.claim_status  ON claim_status.id=claims.claim_status_id'; }

        if (tables.billing_providers) { r += ' INNER JOIN billing.providers AS billing_providers ON billing_providers.id=claims.billing_provider_id'; }

        if (tables.places_of_service) { r += ' LEFT JOIN places_of_service  ON places_of_service.id=claims.place_of_service_id '; }

        if (tables.ref_provider) {
            r += ` LEFT JOIN provider_contacts  ON provider_contacts.id=claims.referring_provider_contact_id
                                        LEFT JOIN providers as ref_provider ON ref_provider.id=provider_contacts.provider_id`;
        } // This should be inner

        if (tables.render_provider) {
            r += ` LEFT JOIN provider_contacts as rendering_pro_contact ON rendering_pro_contact.id=claims.rendering_provider_contact_id
                                           LEFT JOIN providers as render_provider ON render_provider.id=rendering_pro_contact.provider_id`;
        }

        if (tables.patient_alt_accounts) {
            r += `
                INNER JOIN LATERAL (
                    SELECT
                        ARRAY_AGG(pa.alt_account_no) FILTER (WHERE i.issuer_type = 'pid') AS pid_alt_account,
                        ARRAY_AGG(pa.alt_account_no) FILTER (WHERE i.issuer_type = 'uli_phn' AND pa.is_primary) AS phn_alt_account
                     FROM patient_alt_accounts pa
                     INNER JOIN issuers i ON pa.issuer_id = i.id
                     WHERE pa.patient_id = claims.patient_id
                ) patient_alt_accounts ON TRUE `;
        }

        if (filterID == 'Follow_up_queue' && isInnerQuery) {
            r += ' INNER JOIN billing.claim_followups ON  claim_followups.claim_id=claims.id left join users on users.id=assigned_to';
        } else if (tables.claim_followups) {
            r += ` LEFT JOIN billing.claim_followups  ON claim_followups.claim_id=claims.id and assigned_to=${userID}
                   left join users on users.id=assigned_to `;
        }

        if (tables.cas_reason_codes) {
            r += ` LEFT JOIN LATERAL (
                       SELECT ARRAY(
                           SELECT
                                ( CASE
                                    WHEN pa.created_dt IS NULL OR cc.created_dt >= pa.created_dt
                                    THEN bcrc.code
                                    ELSE bcr.code
                                END
                            ) AS code
                        FROM billing.claims bc
                        INNER JOIN billing.claim_status bcs ON bcs.id = bc.claim_status_id
                        INNER JOIN billing.charges ch ON ch.claim_id = bc.id
                        LEFT JOIN billing.claim_explanatory_codes cc ON cc.claim_id = ch.claim_id
                        LEFT JOIN billing.payment_applications bpa ON bpa.charge_id = ch.id
                        LEFT JOIN billing.cas_payment_application_details pa ON pa.payment_application_id = bpa.id
                        LEFT JOIN billing.cas_reason_codes bcrc ON bcrc.id = cc.cas_reason_code_id
                        LEFT JOIN billing.cas_reason_codes bcr ON bcr.id = pa.cas_reason_code_id
                        WHERE (bcrc.code IS NOT NULL OR bcr.code IS NOT NULL) AND bcs.code NOT IN('PA', 'PP')
                        AND bc.id = claims.id
                        ORDER BY cc.created_dt, pa.created_dt DESC
                        )  AS code
                    ) AS cas_reason_codes
                    ON true `;
        }


        if (tables.insurance_provider_payer_types || tables.ins_prov) {
            r += ` LEFT JOIN patient_insurances ins_prov_pat_ins ON ins_prov_pat_ins.id = primary_patient_insurance_id
                   LEFT JOIN insurance_providers ins_prov ON ins_prov.id = ins_prov_pat_ins.insurance_provider_id
                   LEFT JOIN insurance_provider_payer_types  ON insurance_provider_payer_types.id = ins_prov.provider_payer_type_id `;
        }

        if (tables.patient_insurances || tables.payer_insurance || tables.edi_clearinghouses) {
            r += `
                LEFT JOIN patient_insurances ON patient_insurances.id =
                (  CASE payer_type
                WHEN 'primary_insurance' THEN primary_patient_insurance_id
                WHEN 'secondary_insurance' THEN secondary_patient_insurance_id
                WHEN 'tertiary_insurance' THEN tertiary_patient_insurance_id
                END)`;
            r += ' LEFT JOIN insurance_providers payer_insurance ON patient_insurances.insurance_provider_id = payer_insurance.id ';
            r += ' LEFT JOIN billing.insurance_provider_details ON insurance_provider_details.insurance_provider_id = payer_insurance.id ';
            r += ' LEFT JOIN billing.edi_clearinghouses ON  billing.edi_clearinghouses.id=insurance_provider_details.clearing_house_id';
        }


        if (tables.ordering_facilities || tables.ordering_facility_contacts) {
            r += ` LEFT JOIN ordering_facility_contacts ON ordering_facility_contacts.id = claims.ordering_facility_contact_id
                   LEFT JOIN ordering_facilities ON ordering_facilities.id = ordering_facility_contacts.ordering_facility_id`;
        }
        if (tables.billing_codes) { r += '  LEFT JOIN billing.billing_codes ON claims.billing_code_id = billing_codes.id '; }

        if (tables.billing_classes) { r += '  LEFT JOIN billing.billing_classes ON claims.billing_class_id = billing_classes.id '; }

        if(tables.charge_details) {
            r += ` LEFT JOIN LATERAL (
                        SELECT
                            i_bch.claim_id,
                            i_pcc.short_description AS charge_description
                        FROM billing.charges i_bch
                        INNER JOIN public.cpt_codes i_pcc on i_pcc.id = i_bch.cpt_id
                        WHERE i_bch.claim_id = claims.id
                        ORDER BY i_pcc.id DESC
                        LIMIT 1 ) charge_details ON charge_details.claim_id = claims.id `;
        }

        if(tables.claim_comment){
            r += ` LEFT JOIN LATERAL (
                    SELECT
                        created_dt
                    FROM billing.claim_comments cc
                    WHERE
                        cc.claim_id = claims.id
                        AND cc.type = 'patient_statement'
                    ORDER BY created_dt ASC
                    LIMIT 1
            ) AS claim_comment ON TRUE `;

        }

        if (tables.payment_details) {
            r += ` INNER JOIN LATERAL (
                    SELECT
                        distinct array_agg(pa.payment_id) AS payment_ids,
                        claims.id as claim_id
                    FROM
                        billing.charges AS c
                    INNER JOIN billing.claims ON claims.id = c.claim_id
                    INNER JOIN billing.payment_applications AS pa ON pa.charge_id = c.id
                    GROUP BY claims.id
            ) AS payment_details ON payment_details.claim_id = claims.id `;

        }

        if(tables.claim_icds) {
            r += `
                LEFT JOIN LATERAL (
                    SELECT
                        ARRAY_AGG(description) AS description
                    FROM icd_codes
                    INNER JOIN billing.claim_icds ON claim_icds.icd_id = icd_codes.id
                    WHERE claim_id = claims.id
                ) AS claim_icds ON TRUE `;
        }

        return r;
    },

    getWLQueryColumns: function (args) {

        // ADDING A NEW WORKLIST COLUMN <-- Search for this
        let stdcolumns = [
            'claims.id',
            'studies.modalities',
            'claims.id as claim_id',
            'claims.claim_dt',
            'claims.created_dt',
            'claims.facility_id',
            'claim_status.description as claim_status',
            'claim_status.code as claim_status_code',
            'patients.full_name as patient_name',
            'cas_reason_codes.code as reason_code',
            'patients.account_no',
            'patients.birth_date::text as birth_date',
            'claims.submitted_dt',
            `patients.patient_info->'ssn'
            as patient_ssn`,
            'billing_providers.name as billing_provider',
            'places_of_service.description AS place_of_service',
            'ref_provider.full_name as   referring_providers',
            'render_provider.full_name as   rendering_provider',
            'ordering_facilities.name AS ordering_facility_name',
            'facilities.facility_name as facility_name',
            'bgct.charges_bill_fee_total as billing_fee',
            'claims.current_illness_date::text as current_illness_date',
            'claims.id As claim_no',
            'billing.can_ahs_get_claim_number(claims.id) AS can_ahs_claim_no',
            'patient_insurances.policy_number',
            'patient_insurances.group_number',
            'claims.payer_type',
            'claims.billing_method',
            `edi_clearinghouses.name as clearing_house`,
            `payer_insurance.insurance_info->'edi_template'
            as edi_template`,
            `(  CASE payer_type
            WHEN 'primary_insurance' THEN payer_insurance.insurance_name
            WHEN 'secondary_insurance' THEN payer_insurance.insurance_name
            WHEN 'tertiary_insurance' THEN payer_insurance.insurance_name
            WHEN 'ordering_facility' THEN ordering_facilities.name
            WHEN 'referring_provider' THEN ref_provider.full_name
            WHEN 'rendering_provider' THEN render_provider.full_name
            WHEN 'patient' THEN patients.full_name        END) as payer_name`,
            'bgct.claim_balance_total as claim_balance',
            'billing_codes.description as billing_code',
            'billing_codes.id as billing_code_id',
            'billing_classes.description as billing_class',
            'billing_classes.id as billing_class_id',
            'claims.billing_notes',
            'patients.gender',
            'patients.id as patient_id',
            'invoice_no',
            'claim_comment.created_dt AS first_statement_dt',
            'charge_details.charge_description',
            'insurance_provider_payer_types.description AS ins_provider_type',
            'bgct.payment_ids AS payment_id',
            `CASE
                WHEN (
                        SELECT
                            country_alpha_3_code
                        FROM
                            sites
                        WHERE
                            id = 1
                     ) = 'can'
                THEN
                    public.get_eligibility_status(claims.primary_patient_insurance_id , claims.claim_dt)
                ELSE
                    null
            END AS as_eligibility_status`,
            `claim_icds.description AS icd_description`,
            `(CASE
                 WHEN claims.frequency = 'corrected'
                 THEN 'corrected_claim'
                 WHEN (claims.frequency != 'corrected' OR claims.frequency IS NULL)
                 THEN 'new_claim'
              END) AS claim_action`,
            `ins_prov.insurance_name AS insurance_providers`,
            `claims.can_mhs_microfilm_no`,
            `patient_alt_accounts.pid_alt_account`,
            `patient_alt_accounts.phn_alt_account`,
            `billing.can_bc_get_claim_sequence_numbers(claims.id) AS can_bc_claim_sequence_numbers`,
            `AGE(CURRENT_DATE, submitted_dt) >= '3 days'::INTERVAL AND claim_status.code = 'PA' AS claim_resubmission_flag`
        ];

        if(args.customArgs.filter_id=='Follow_up_queue'){

            stdcolumns.push( ' FinalClaims.assigned_dt::text as followup_date ');
            stdcolumns.push( ' FinalClaims.assigned_user_id as assigned_id ');
            stdcolumns.push( ' FinalClaims.assigned_user as assigned_to ');

        }
        else
        {

            stdcolumns.push( ' claim_followups.followup_date::text as followup_date ');
            stdcolumns.push( ' users.id as assigned_id ');
            stdcolumns.push( ` users.username||'('||get_full_name(users.first_name,users.last_name)||')' as assigned_to `);

        }

        return stdcolumns;

    },

    getWorkList: async function (args) {
        let sortField = (args.sortField || '').trim();
        let sortOrder = (args.sortOrder || '').trim();
        sortField = api.getSortFields(sortField);

        if (args.customArgs && args.customArgs.flag === 'exportExcel') {
            if (config.get('claimsExportRecordsCount')) {
                args.pageSize = config.get('claimsExportRecordsCount');
            } else {
                args.pageSize = 1000;
            }
        }

        let params = [];
        const tables = api.getTables([sortField]);
        let sort = '';
        let sorting = [];

        if (sortField) {
            sorting.push(`${sortField} ${sortOrder}`);
        }

        if (tables.claims || !sortField) {
            sorting.push('claims.id DESC');
        }

        sort = ` ORDER BY  ${sorting.join(',')} `;

        let limit = !args.pageSize ? '' :
            ` LIMIT ${args.pageSize} `
            ;

        let offset = !args.pageNo ? '' :
            ` OFFSET ${((args.pageNo - 1) * args.pageSize) || 0} `
            ;
        let followupselect = '';

        if(args.customArgs.filter_id=='Follow_up_queue'){
            followupselect = `, users.id as assigned_user_id , users.username||'('||get_full_name(users.first_name,users.last_name)||')' as assigned_user,claim_followups.followup_date::text as assigned_dt `;
        }

        let innerQuery = api.getWLQuery(`
                            row_number() over(${sort}) as number
                            , claims.id AS claim_id
                            ${followupselect}
                            `, args, params);

        innerQuery += limit + offset;

        // optimization! convert INNER to LEFT OUTER joins and add relevant WHERE clauses
        //args.filterQuery += ` AND claims.company_id = ${args.comapny_id} `;



        // TODO: switch these function calls into JOINS (perhaps)
        let columns = api.getWLQueryColumns(args);
        let sql = `
            SELECT
            ${columns},
            FinalClaims.number
            FROM (${innerQuery}) as FinalClaims
            INNER JOIN billing.claims ON FinalClaims.claim_id = claims.id
            INNER JOIN facilities ON facilities.id = claims.facility_id
            ${api.getWLQueryJoin(columns, '', args.customArgs.filter_id, args.user_id, args.isCount)}
            ORDER BY FinalClaims.number
            `
            ;
        return await query(sql, params);
    },

    getWorkListCount: async function (args) {

        let columns = args.isClaimBalanceTotal ? 'claims.id AS claim_id' : 'count(1) as total_records';
        let params = [];
        let innerQuery = api.getWLQuery(columns, args, params);
        let result = args.isClaimBalanceTotal ? innerQuery : await query(innerQuery, params);

        return result;

    },
    setBalanceFilterFlag: function (args, colModel) {
        let column = JSON.parse(args.filterCol);
        let data = JSON.parse(args.filterData);

        if (args.isDatePickerClear !== 'true' && column.indexOf('claim_dt') == -1  && (args.customArgs.filter_id == 'Follow_up_queue' || args.customArgs.filter_id == 'All_Claims') ) {
            data.push(moment().subtract(89, 'days').format('YYYY-MM-DD') + ' - ' + moment().format('YYYY-MM-DD'));
            column.push('claim_dt');
            args.filterCol = JSON.stringify(column);
            args.filterData = JSON.stringify(data);
        }

        if (column.indexOf('claim_balance') > -1) {

            let colIndex = column.indexOf('claim_balance');

            for (let i = 0; i < colModel.length; i++) {
                if (colModel[i].name == 'claim_balance') {
                    let colValue = data[colIndex].slice(1);
                    data[colIndex] = data[colIndex].charAt(0);

                    switch (data[colIndex]) {
                        case '=':
                            colModel[i].searchFlag = '='; //Equals
                            break;
                        case '<':
                            colModel[i].searchFlag = 'lt'; //Less than
                            break;
                        case '>':
                            colModel[i].searchFlag = 'gt'; //Greated that
                            break;
                        case '|':
                            colModel[i].searchFlag = 'bw'; //0 < x < 5
                            break;
                        case 'default':
                            colModel[i].searchFlag = '='; //Equals by default
                            break;
                    }

                    data[colIndex] = colValue;
                    args.filterData = JSON.stringify(data);
                    break;
                }
            }
        }
    },

    getWL: async function (args) {
        const AND = (a, q) => a + ((a.length > 0) ? '\nAND ' : '') + q;
        let whereClause = {
            default: '',
            query: '',
            studyFilter: '',
            userFilter: '',
            permission_filter: ` claims.company_id = ${args.company_id || args.companyId} `
        };


        let statOverride = args.customArgs && args.customArgs.statOverride === 'true';

        // Study Filters
        const filter_id = (args.customArgs.filter_id > 0) ? args.customArgs.filter_id : 0;
        const filter_options = {
            id: filter_id,
            flag: 'claim_workbench',
            user_id: args.user_id,
            statOverride: statOverride,
            directCall: true
        };

        // TODO: it would be nice if we could run this within DB and create query there instead of back and forth between DB and node

        const response = await studyfilterdata.getUserWLFilters(filter_options);

        //studyfilterdata.getUserWLFilters(filter_options, function (err, response) {
        const filter = response.rows && response.rows.length > 0 ? response.rows[0] : {};

        // const {
        //     joined_filter_info
        // } = filter;

        // const filter_query = joined_filter_info && api.getCombinedQuery(joined_filter_info) || '';
        const newFilter = {};

        newFilter.perms_filter = util.getClaimFilterQuery(filter.perm_filter, 'claims', args.user_id, args.statOverride);
        let responseUserSetting = [newFilter];

        let permission_query = SQL`
            -- permission query
            `;

        if (responseUserSetting.length > 0) {
            let userSetting = responseUserSetting[0];

            const perms_filter = userSetting.perms_filter;

            const studyFilter = userSetting;

            if (studyFilter) {

                if (studyFilter.perms_filter) {
                    whereClause.studyFilter = AND(whereClause.studyFilter, studyFilter.perms_filter);
                }

            }

            //BEGIN PERMISSION QUERY

            {
                //showEncOnly = (showEncOnly == false) ? userSetting.worklist_filter_info.options.showEncOnly : showEncOnly;    // Totally crashes the worklist when you try to respect the user filter Show Encounters Only option

                statOverride = !statOverride && perms_filter && perms_filter.options && perms_filter.options.statOverride || statOverride;

                if (userSetting.userDetails) { // this is permissions based on use facilities [why base on orders vs studies facility_id ??]
                    if (userSetting.userDetails.user_type != 'SU' && userSetting.userDetails.all_facilities != true) {

                        whereClause.permission_filter = AND(whereClause.permission_filter, ` claims.facility_id = ANY(ARRAY[${userSetting.userDetails.facilities}]) `);
                    }
                }

                if (args.customArgs.filter_id === 'resubmission_claims') {
                    // filter the claims whose submitted date is more than or equal to 72 hours[3 days] and claim status in 'PA'
                    whereClause.permission_filter = AND( whereClause.permission_filter, ` claims.billing_method = 'electronic_billing'
                                         AND AGE(CURRENT_DATE, submitted_dt) >= '3 days'::INTERVAL
                                         AND claim_status.code IN ('PA', 'PS') `);
                }

                permission_query.append(whereClause.permission_filter);

                whereClause.permission_query = permission_query.text;
            }
            //END PERMISSION QUERY

            whereClause.default =
                `
               (
                   ${whereClause.permission_query}
               )
               `;

            // Default conditions and study filter conditions
            whereClause.query = whereClause.default;

            if (whereClause.studyFilter) { whereClause.query += `  AND ${whereClause.studyFilter} `; }

            const query_options = {
                defaultwherefilter: whereClause.query,
                statusCode: args.customArgs && args.customArgs.statusCode ? args.customArgs.statusCode : [],
                isFrom: 'Claims',
                statOverride: statOverride
            };

            if (args.filterCol && args.filterData) {
                api.setBalanceFilterFlag(args, colModel);
            }
            // Prevents DB function for filtering claim balance & Payment_id -- start
            let paymentIdFilter ='';

            if (args.isClaimBalanceTotal && args.filterCol && args.filterCol.indexOf('claim_balance') > -1) {
                args.colModel = _.find(colModel, { name: 'claim_balance' });
                api.removeSearchFilterData(args, 'claim_balance');
            }

            if (args.filterCol && args.filterCol.indexOf('payment_id') > -1) {
                api.removeSearchFilterData(args, 'payment_id');

                if (args.filterPaymentIds) {
                    args.filterPaymentIds = args.filterPaymentIds.split(',');
                    args.filterPaymentIds = _.filter(args.filterPaymentIds, _.size);
                    paymentIdFilter = ` AND payment_details.payment_ids @> ARRAY[${args.filterPaymentIds}]::BIGINT[] `;
                }
            }
            // End
            const response = await filterValidator.generateQuery(colModel, args.filterCol, args.filterData, query_options);
            args.filterQuery = response;
            args.filterQuery += paymentIdFilter; // Append payment_id filter WHERE Condition

            if (args.customArgs.filter_id === 'Follow_up_queue' && args.filterCol.indexOf('assigned_to') === -1) {
                args.filterQuery += ` AND claim_followups.assigned_to = ${args.userId} `;
            }

            if (userSetting.user_details) {
                if (userSetting.user_details.user_type != 'SU' && userSetting.user_details.all_facilities != true) {
                    let flist = userSetting.user_details.facilities;

                    args.permissionFacilities = typeof (flist) === 'number' ? [flist] : Array.isArray(flist.map(Number)) ? flist : flist.split(',').map(Number);
                }
            }

            let result;

            if (args.isCount || args.isClaimBalanceTotal) { // Using worklist count query for getting claims total balance (EXA-12065)

                result = await api.getWorkListCount(args);

            } else {

                result = await api.getWorkList(args);
            }

            return result;

        }
    },

    removeSearchFilterData: function (args, filterCol) {

        let filterElements = JSON.parse(args.filterCol);
        let filterData = JSON.parse(args.filterData);
        let colIndex = _.findIndex(filterElements, (col) => {
            return (col === filterCol);
        });

        if (colIndex > -1) {

            if (filterCol === 'claim_balance') {
                args.claimBalancefilterData = filterData[colIndex];
            } else if (filterCol === 'payment_id') {
                args.filterPaymentIds = filterData[colIndex];
            }

            filterElements.splice(colIndex, 1);
            filterData.splice(colIndex, 1);
        }
        args.filterCol = JSON.stringify(filterElements);
        args.filterData = JSON.stringify(filterData);
    }
};

module.exports = api;

