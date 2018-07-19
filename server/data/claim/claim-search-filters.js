const studyfilterdata = require('./../study-filters');
const filterValidator = require('./../filter-validator')();
const config = require('../../config');
const { query, SQL } = require('./../index');
const util = require('./../util');

const colModel = [
    {
        name: 'claim_dt',
        searchColumns: ['claims.claim_dt'],
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
        searchFlag: '%',
        searchColumns: ['billing_providers.name']
    },
    {
        name: 'place_of_service',
        searchFlag: '%',
        searchColumns: ['places_of_service.description']
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
        searchColumns: ['(select charges_bill_fee_total from BILLING.get_claim_totals(claims.id))']
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
        searchFlag:'%',
        searchColumns: [`(  CASE payer_type 
                WHEN 'primary_insurance' THEN insurance_providers.insurance_name
                WHEN 'secondary_insurance' THEN insurance_providers.insurance_name
                WHEN 'tertiary_insurance' THEN insurance_providers.insurance_name
	            WHEN 'ordering_facility' THEN provider_groups.group_name
	            WHEN 'referring_provider' THEN ref_provider.full_name
	            WHEN 'rendering_provider' THEN render_provider.full_name
	            WHEN 'patient' THEN patients.full_name        END) `] },
    {
        name: 'clearing_house',
        searchColumns: [`edi_clearinghouses.name`],
        searchFlag: '%'
    },
    {
        name: 'edi_template',
        searchColumns: [`insurance_providers.insurance_info->'edi_template'`],
        searchFlag: '%'
    },   
    {
        name: 'claim_balance',
        searchColumns: ['(select charges_bill_fee_total - (payments_applied_total + adjustments_applied_total + refund_amount) from BILLING.get_claim_totals(claims.id)) '],
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
        name: 'claim_notes',
        searchColumns: ['claims.claim_notes'],
        searchFlag: '%'
    },
    {
        name: 'assigned_to',
        searchColumns: ['users.id'],
        searchFlag: '='
    }
];

const api = {

    getCombinedQuery: (joined_filters) => {
        const queries = joined_filters.reduce((queries, { filter_info }) => {
            const sqlQuery = util.getClaimFilterQuery(filter_info);

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
            case 'claim_status': return 'claim_status.description';
            case 'claim_id': 
            case 'id': return 'claims.id';           
            case 'patient_name': return 'patients.full_name';
            case 'birth_date': return 'patients.birth_date::text';
            case 'account_no': return 'patients.account_no';
            case 'patient_ssn': return `patients.patient_info->'ssn'`;
            case 'billing_provider': return 'billing_providers.name';
            case 'place_of_service': return 'places_of_service.description';
            case 'referring_providers': return 'ref_provider.full_name';
            case 'rendering_provider': return 'render_provider.full_name';
            case 'billing_fee': return '(select charges_bill_fee_total from BILLING.get_claim_totals(claims.id))';
            case 'invoice_no': return 'claims.invoice_no';
            case 'billing_method': return 'claims.billing_method';
            case 'followup_date': return 'claim_followups.followup_date::text';
            case 'current_illness_date': return 'claims.current_illness_date::text';
            case 'claim_no': return 'claims.id';
            case 'policy_number': return 'patient_insurances.policy_number';
            case 'group_number': return 'patient_insurances.group_number';
            case 'payer_type':
            case 'ref_phy': return 'claims.payer_type';
            case 'assigned_to' : return 'users.username';
            case 'payer_name':
                return `(  CASE payer_type 
                WHEN 'primary_insurance' THEN insurance_providers.insurance_name
                WHEN 'secondary_insurance' THEN insurance_providers.insurance_name
                WHEN 'tertiary_insurance' THEN insurance_providers.insurance_name
	            WHEN 'ordering_facility' THEN provider_groups.group_name
	            WHEN 'referring_provider' THEN ref_provider.full_name
	            WHEN 'rendering_provider' THEN render_provider.full_name
	            WHEN 'patient' THEN patients.full_name        END) 
                    `;
            case 'clearing_house': return 'edi_clearinghouses.name';
            case 'claim_balance': return '(select charges_bill_fee_total - (payments_applied_total + adjustments_applied_total + refund_amount) FROM BILLING.get_claim_totals(claims.id))';
            case 'billing_code': return 'billing_codes.description';
            case 'billing_class': return 'billing_classes.description';
            case 'gender': return 'patients.gender';
            case 'claim_notes': return 'claims.claim_notes';
            case 'submitted_dt': return 'claims.submitted_dt';
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
            ${permissionQuery}
            ${api.getWLQueryJoin(tables, true, args.customArgs.filter_id) + args.filterQuery}
            `;
        return query;
    },
    getWLQueryJoin: function (columns, isInnerQuery, filterID) {
        let tables = isInnerQuery ? columns : api.getTables(columns);
        let r = '';
        
        if (tables.patients) { r += ' INNER JOIN patients ON claims.patient_id = patients.id '; }

        if (tables.facilities) { r += ' INNER JOIN facilities ON facilities.id=claims.facility_id '; }

        if (tables.claim_status) { r += ' LEFT JOIN billing.claim_status  ON claim_status.id=claims.claim_status_id'; }

        if (tables.billing_providers) { r += ' LEFT JOIN billing.providers AS billing_providers ON billing_providers.id=claims.billing_provider_id'; }

        if (tables.places_of_service) { r += ' LEFT JOIN places_of_service  ON places_of_service.id=claims.place_of_service_id '; }

        if (tables.ref_provider) {
            r += ` LEFT JOIN provider_contacts  ON provider_contacts.id=claims.referring_provider_contact_id 
                                        LEFT JOIN providers as ref_provider ON ref_provider.id=provider_contacts.provider_id`;
        } // This should be inner

        if (tables.render_provider) {
            r += ` LEFT JOIN provider_contacts as rendering_pro_contact ON rendering_pro_contact.id=claims.rendering_provider_contact_id
                                           LEFT JOIN providers as render_provider ON render_provider.id=rendering_pro_contact.provider_id`;
        }

        if(filterID=='Follow_up_queue'){
            r += ' INNER JOIN billing.claim_followups ON  claim_followups.claim_id=claims.id left join users on users.id=assigned_to';
        }else if (tables.claim_followups) {
            r += ' LEFT JOIN billing.claim_followups  ON claim_followups.claim_id=claims.id left join users on users.id=assigned_to';
        }

        if (tables.patient_insurances || tables.insurance_providers || tables.edi_clearinghouses) {
            r += `
                LEFT JOIN patient_insurances ON patient_insurances.id = 
                (  CASE payer_type 
                WHEN 'primary_insurance' THEN primary_patient_insurance_id
                WHEN 'secondary_insurance' THEN secondary_patient_insurance_id
                WHEN 'tertiary_insurance' THEN tertiary_patient_insurance_id
                END)`;

            r += ' LEFT JOIN insurance_providers ON patient_insurances.insurance_provider_id = insurance_providers.id ';
            r += ' LEFT JOIN billing.insurance_provider_details ON insurance_provider_details.insurance_provider_id = insurance_providers.id ';
            r += ' LEFT JOIN   billing.edi_clearinghouses ON  billing.edi_clearinghouses.id=insurance_provider_details.clearing_house_id';
             
        }
       
        if (tables.provider_groups) { r += '  LEFT JOIN provider_groups ON claims.ordering_facility_id = provider_groups.id '; }

        if (tables.billing_codes) { r += '  LEFT JOIN billing.billing_codes ON claims.billing_code_id = billing_codes.id '; }

        if (tables.billing_classes) { r += '  LEFT JOIN billing.billing_classes ON claims.billing_class_id = billing_classes.id '; }

        return r;
    },

    getWLQueryColumns: function () {

        // ADDING A NEW WORKLIST COLUMN <-- Search for this
        let stdcolumns = [
            'claims.id',
            'claims.id as claim_id',
            'claims.claim_dt',
            'claims.facility_id',
            'claim_status.description as claim_status',
            'claim_status.code as claim_status_code',
            'patients.full_name as patient_name',
            'patients.account_no',
            'patients.birth_date::text as birth_date',
            'claims.submitted_dt',
            `patients.patient_info->'ssn' 
            as patient_ssn`,
            'billing_providers.name as billing_provider',
            'places_of_service.description AS place_of_service',
            'ref_provider.full_name as   referring_providers',
            'render_provider.full_name as   rendering_provider',
            '(select charges_bill_fee_total from BILLING.get_claim_totals(claims.id)) as billing_fee',
            'claim_followups.followup_date::text as followup_date',
            'users.username as assigned_to',
            'claims.current_illness_date::text as current_illness_date',
            'claims.id As claim_no',
            'patient_insurances.policy_number',
            'patient_insurances.group_number',
            'claims.payer_type',
            'claims.billing_method',
            `edi_clearinghouses.name as clearing_house`,
            `insurance_providers.insurance_info->'edi_template' 
            as edi_template`,           
            `(  CASE payer_type 
            WHEN 'primary_insurance' THEN insurance_providers.insurance_name
            WHEN 'secondary_insurance' THEN insurance_providers.insurance_name
            WHEN 'tertiary_insurance' THEN insurance_providers.insurance_name
            WHEN 'ordering_facility' THEN provider_groups.group_name
            WHEN 'referring_provider' THEN ref_provider.full_name
            WHEN 'rendering_provider' THEN render_provider.full_name
            WHEN 'patient' THEN patients.full_name        END) as payer_name`,
            '(select charges_bill_fee_total - (payments_applied_total + adjustments_applied_total + refund_amount) from BILLING.get_claim_totals(claims.id)) as claim_balance',
            'billing_codes.description as billing_code',
            'billing_classes.description as billing_class',
            'claims.claim_notes',
            'patients.gender',
            'patients.id as patient_id',
            'invoice_no'
        ];
        return stdcolumns;
    },

    getWorkList: async function (args) {
        let sortField = (args.sortField || '').trim();
        let sortOrder = (args.sortOrder || '').trim();
        sortField = api.getSortFields(sortField);

        if (args.customArgs && args.customArgs.flag === 'exportExcel') {
            if (config.get('claimCsvRecords')) {
                args.pageSize = config.get('claimCsvRecords');
            } else {
                args.pageSize = 25000;
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

        //if(args.customArgs.filter_id=='Follow_up_queue'){
            //args.filterQuery += ` AND claim_followups.assigned_to = ${args.userId} `;
        //}

        let innerQuery = api.getWLQuery(`
                            row_number() over(${sort}) as number
                            , claims.id AS claim_id
                            `, args, params);

        innerQuery += limit + offset;

        // optimization! convert INNER to LEFT OUTER joins and add relevant WHERE clauses
        //args.filterQuery += ` AND claims.company_id = ${args.comapny_id} `;

        

        // TODO: switch these function calls into JOINS (perhaps)
        let columns = api.getWLQueryColumns();
        let sql = `
            SELECT
            ${columns}            
            FROM (${innerQuery}) as FinalClaims
            INNER JOIN billing.claims ON FinalClaims.claim_id = claims.id
            ${api.getWLQueryJoin(columns, '', args.customArgs.filter_id)}
            ORDER BY FinalClaims.number
            `
            ;

        return await query(sql, params);
    },

    getWorkListCount: async function (args) {
        let select_total = 'count(1) as total_records';
        let params = [];
        let innerQuery = api.getWLQuery(select_total, args, params);
        return await query(innerQuery, params);
    },
    setBalanceFilterFlag: function (args, colModel) {
        let column = JSON.parse(args.filterCol);
        let data = JSON.parse(args.filterData);

        if (column.indexOf('claim_balance') > -1) {

            let colIndex = column.indexOf('claim_balance');

            for (let i = 0; i < colModel.length; i++) {
                if (colModel[i].name == 'claim_balance') {
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
                        case 'default':
                            colModel[i].searchFlag = '='; //Equals by default
                            break;
                    }
                    
                    data[colIndex] = '0';
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
            permission_filter: ` claims.company_id = ${args.company_id} `
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
        const filter = response.rows&&response.rows.length>0?response.rows[0]:{};

        // const {
        //     joined_filter_info
        // } = filter;

        // const filter_query = joined_filter_info && api.getCombinedQuery(joined_filter_info) || '';
        const newFilter = {};

        newFilter.perms_filter= util.getClaimFilterQuery(filter.perm_filter, args.user_id, args.statOverride);
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

            if(args.filterCol && args.filterData){
                api.setBalanceFilterFlag(args, colModel);
            }
            
            const response = await filterValidator.generateQuery(colModel, args.filterCol, args.filterData, query_options);
            args.filterQuery = response;

            if (userSetting.user_details) {
                if (userSetting.user_details.user_type != 'SU' && userSetting.user_details.all_facilities != true) {
                    let flist = userSetting.user_details.facilities;

                    args.permissionFacilities = typeof (flist) === 'number' ? [flist] : Array.isArray(flist.map(Number)) ? flist : flist.split(',').map(Number);
                }
            }
            
            let result;

            if (args.isCount) {

                result= await api.getWorkListCount(args);

            } else {

                result =await api.getWorkList(args);
            }

            return result;

        }
    }
};

module.exports = api;

