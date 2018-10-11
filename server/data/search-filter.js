const config = require('../config');
const studyfilterdata = require('./study-filters');
const filterValidator = require('./filter-validator')();
const moment = require('moment');
const { query, SQL } = require('./index');
const util = require('./util');

const colModel = [
    {
        name: 'insurance_providers'
        , searchColumns: [`(ARRAY[
        COALESCE( (SELECT insurance_name FROM insurance_providers WHERE id IN (SELECT insurance_provider_id FROM patient_insurances WHERE id = orders.primary_patient_insurance_id) LIMIT 1), null),
        COALESCE( (SELECT insurance_name FROM insurance_providers WHERE id IN (SELECT insurance_provider_id FROM patient_insurances WHERE id = orders.secondary_patient_insurance_id) LIMIT 1), null),
        COALESCE( (SELECT insurance_name FROM insurance_providers WHERE id IN (SELECT insurance_provider_id FROM patient_insurances WHERE id = orders.tertiary_patient_insurance_id) LIMIT 1), null)
        ])`]
        , searchFlag: 'arrayString'
    },
    {
        name: 'study_description',
        searchFlag: '%'
    },
    {
        name: 'study_dt',
        searchColumns: ['studies.study_dt'],
        searchFlag: 'daterange'
    },
    {
        name: 'study_status',
        searchFlag: 'status'
    },
    {
        name: 'status_last_changed_dt',
        searchFlag: 'daterange',
        searchColumns: ['studies.status_last_changed_dt'],
        hidden: false
    },
    {
        name: 'station',
        searchColumns: [`study_info->'station'`],
        searchFlag: 'hstore'
    },
    {
        name: 'body_part',
        searchColumns: ['studies.body_part'],
        searchFlag: '%'
    },
    {
        name: 'department',
        searchFlag: 'hstore',
        searchColumns: [`study_info->'department'`]
    },
    {
        name: 'check_indate',
        searchFlag: 'hstore_daterange',
        searchColumns: [`study_info->'Check-InDt'`]
    },
    {
        name: 'reason_for_study',
        searchFlag: '%'
    },
    {
        name: 'stat_level',
        searchFlag: 'int'
    },
    {
        name: 'claim_no',
        searchFlag: 'int',
        searchColumns: ['orders.id']
    },
    {
        name: 'no_of_series',
        searchFlag: 'intNullContain'
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
        name: 'refphy_name',
        searchColumns: ['providers_ref.full_name'],
        searchFlag: '%'
    },
    {
        name: 'facility_name',
        searchColumns: ['facilities.id'],
        searchFlag: 'int'
    },
    {
        name: 'gender',
        searchColumns: ['patients.gender'],
        searchFlag: 'left%'
    },
    {
        name: 'accession_no',
        searchColumns: ['studies.accession_no'],
        searchFlag: '%'
    },
    {
        name: 'account_no',
        searchColumns: ['patients.account_no'],
        searchFlag: '%'
    },
    {
        name: 'institution',
        searchFlag: '%'
    },
    {
        name: 'study_flag',
        searchColumns: [`studies.study_info->'study_flag_id'`],
        searchFlag: '='
    },
    {
        name: 'priority',
        searchColumns: ['studies.priority'],
        searchFlag: '='
    },
    {
        name: 'last_name',
        searchColumns: ['patients.last_name'],
        searchFlag: '%'
    },
    {
        name: 'first_name',
        searchColumns: ['patients.first_name'],
        searchFlag: '%'
    },
    {
        name: 'study_received_dt',
        searchColumns: ['studies.study_received_dt'],
        searchFlag: 'daterange'
    },
    {
        name: 'modalities',
        searchColumns: ['studies.modalities'],
        searchFlag: '%'
    },
    {
        name: 'readphy_name',
        searchColumns: [`study_info->'readDescription'`, `study_details->>'name_phys_reading_study'`],
        searchFlag: ['hstore', 'json'],
        searchCondition: 'OR'
    },
    {
        name: 'patient_age',
        searchColumns: ['dicom_age(extract(days FROM (studies.study_dt - patients.birth_date))::integer)'],
        searchFlag: '%'
    },
    {
        name: 'order_type',
        searchColumns: ['orders.order_type'],
        searchFlag: '%'
    },
    {
        name: 'vehicle_name',
        searchColumns: ['vehicles.vehicle_name'],
        searchFlag: '%'
    },
    {
        name: 'requesting_date',
        searchFlag: 'hstore',
        searchColumns: ['order_info-> \'requestingDate\'']
    },
    {
        name: 'claim_status',
        searchColumns: ['adj1.description'],
        searchFlag: '%'
    },
    {
        name: 'ordering_facility',
        searchColumns: ["orders.order_info->'ordering_facility'"],
        searchFlag: 'hstore'
    },
    {
        name: 'technologist_name',
        searchColumns: ['providers.full_name'],
        searchFlag: '%'
    },
    {
        name: 'attorney_name',
        searchColumns: [`(
            SELECT
                get_full_name(last_name, first_name, middle_initial, NULL, suffix)
            FROM
                providers
            WHERE
                studies.attorney_provider_id = providers.id
        )`],
        searchFlag: '%'
    },
    {
        name: 'mudatacaptured',
        searchColumns: ['orders.mu_passed'],
        searchFlag: 'bool_null'
    },
    {
        name: 'as_authorization',
        searchColumns: ['auth.as_authorization'],
        searchFlag: '%'
    },
    {
        name: 'mu_last_updated',
        searchColumns: ['orders.mu_last_updated'],
        searchFlag: 'daterange'
    },
    {
        name: 'mu_last_updated_by',
        searchColumns: ["orders.order_info->'lastMuUpdatedBy'"],
        searchFlag: 'hstore'
    },
    {
        name: 'send_status',
        searchColumns: ["studies.study_info->'send_status'"],
        searchFlag: 'hstore_null'
    },
    {
        name: 'fax_status',
        searchColumns: ["studies.study_info->'fax_status'"],
        searchFlag: 'hstore_null'
    },
    {
        name: 'billing_code',
        searchColumns: ['adj2.description'],
        searchFlag: '%'
    },
    {
        name: 'billing_class',
        searchColumns: ['adj3.description'],
        searchFlag: '%'
    },
    {
        name: 'scheduled_dt',
        searchColumns: ['studies.schedule_dt'],
        searchFlag: 'daterange',
        hidden: false
    },
    {
        name: 'approving_provider',
        searchFlag: '%',
        searchColumns: ['approving_provider_ref.full_name']
    },
    {
        name: 'approved_dt',
        searchFlag: 'daterange',
        searchColumns: ['studies.approved_dt']
    },
    {
        name: 'modality_room_id',
        searchFlag: 'int',
        searchColumns: ['orders.modality_room_id']
    },
    {
        name: 'report_queue_status',
        searchFlag: '=',
        searchColumns: ['report_delivery.report_queue_status']
    },
    {
        name: 'has_deleted',
        searchColumns: ['studies.has_deleted'],
        searchFlag: 'bool_null'
    },
    // This takes the hstore key as the "fieldValue" and verifies it isn't 'false' or NULL
    {
        name: 'image_delivery',
        searchColumns: ['provider_contacts.contact_info'],
        searchFlag: 'hstore_bool_multi'
    },
    {
        name: 'tat_level',
        searchColumns: ['tat.level'],
        searchFlag: 'int'
    },
    {
        name: 'stat_level',
        searchColumns: ['studies.stat_level'],
        searchFlag: 'int'
    },
    {
        name: 'visit_no',
        searchColumns: [`orders.order_info->'visit_no'`],
        searchFlag: 'hstore'
    },
    {
        name: 'patient_room',
        searchColumns: [`orders.order_info->'patientRoom'`],
        searchFlag: 'hstore'
    },
    {
        name: 'ins_provider_type',
        searchColumns: ['insurance_providers.provider_types'],
        searchFlag: 'arrayString'
    },
    {
        name: 'billed_status',
        searchFlag: '='
    },
    {
        name: 'claim_id',
        searchColumns: ['(SELECT claim_id FROM billing.charges_studies inner JOIN billing.charges ON charges.id= charges_studies.charge_id  WHERE study_id = studies.id LIMIT 1) '],
        searchFlag: '='
    },
    {
        name: 'eligibility_verified',
        searchColumns: [`(eligibility.verified OR COALESCE(orders.order_info->'manually_verified', 'false')::BOOLEAN)`]
        , searchFlag: 'bool_null'
    }
];

const api = {

    approvingProviderJoinSubselect: `
    SELECT provider_contacts.provider_id
    FROM provider_contacts
        JOIN study_transcriptions ON study_transcriptions.approving_provider_id = provider_contacts.id
    WHERE
            study_transcriptions.study_id = studies.id
        AND study_transcriptions.approving_provider_id IS NOT NULL
    GROUP BY provider_contacts.provider_id, study_transcriptions.approved_dt
    ORDER BY max(study_transcriptions.approved_dt) DESC
    LIMIT 1
    `,

    getSettingsFilter: function () {
        return ` COALESCE(dicom_status,'')
        in ('CO','IP','NA','') `;
    },


    getTables: function ( filter ) {
        // This assumes all columns are prefixed with their table name table.column
        let tables = {};
        let reg = /([a-zA-Z0-9_]+)\..*?/g;
        let res = null;

        while ( (res = reg.exec(filter)) ) {
            tables[ res[ 1 ] ] = true;
        }

        return tables;
    },

    getReportQueueStatusQuery: function () {
        return `(SELECT current_status
            FROM report_delivery_queue
            WHERE report_delivery_queue.study_id = studies.id
            ORDER BY report_delivery_queue.id DESC LIMIT 1)
            `;
    },

    getReportQueueStatusFilter: function () {
        return `
            (SELECT current_status
             FROM report_delivery_queue
             WHERE report_delivery_queue.study_id = studies.id
             ORDER BY report_delivery_queue.id DESC
             LIMIT 1)
        `;
    },

    getSortFields: function (args, screenName, report_queue_status_query) {
        //console.log('getSortFields: ', args, screenName);
        switch (args) {
            case 'study_id': return 'studies.id';
            case 'claim_id': return '(SELECT claim_id FROM billing.charges_studies inner JOIN billing.charges ON charges.id= charges_studies.charge_id  WHERE study_id = studies.id LIMIT 1) ';
            case 'insurance_providers': return `(ARRAY[
                COALESCE( (SELECT insurance_name FROM insurance_providers WHERE id IN (SELECT insurance_provider_id FROM patient_insurances WHERE id = orders.primary_patient_insurance_id) LIMIT 1), null),
                COALESCE( (SELECT insurance_name FROM insurance_providers WHERE id IN (SELECT insurance_provider_id FROM patient_insurances WHERE id = orders.secondary_patient_insurance_id) LIMIT 1), null),
                COALESCE( (SELECT insurance_name FROM insurance_providers WHERE id IN (SELECT insurance_provider_id FROM patient_insurances WHERE id = orders.tertiary_patient_insurance_id) LIMIT 1), null)
                ])`;
            case 'image_delivery': return 'imagedelivery.image_delivery';
            case 'station': return "study_info->'station'";
            case 'has_deleted': return 'studies.has_deleted';
            case 'send_status': return "studies.study_info->'send_status'";
            case 'billing_code': return "orders.order_info->'billing_code'";
            case 'billing_class': return "orders.order_info->'billing_class'";
            case 'fax_status': return "studies.study_info->'fax_status'";
            case 'no_of_instances': return 'studies.no_of_instances';
            case 'department': return "studies.study_info->'department'";
            case 'created_date': return 'orders.ordered_dt';
            case 'dicom_status': // this might not be needed any more
            case 'status_code': return 'studies.study_status';
            case 'patient_name': return 'patients.last_name';
            case 'last_name': return 'patients.last_name';
            case 'first_name': return 'patients.first_name';
            case 'full_name': return 'patients.full_name';
            case 'birth_date': return 'patients.birth_date::text';
            case 'refphy_name':
            case 'ref_phy':
                if (screenName == 'Encounter') {
                    return 'providers.full_name';
                }

                if (screenName == 'Orders') {
                    return 'orders.referring_providers[1]';
                }

                return 'providers_ref.full_name';
            case 'attorney_name':
                return `(SELECT
                        get_full_name(last_name, first_name, middle_initial, NULL, suffix)
                    FROM
                        providers
                    WHERE
                        studies.attorney_provider_id = providers.id)
                    `;
            case 'study_description':
            case 'display_description':
                if (screenName == 'Encounter') {
                    return 'cpt_codes.display_description';
                }

                return 'studies.study_description';
            case 'readphy_name': return `study_info->'readDescription'`;
            case 'study_received_dt': return 'studies.study_received_dt';
            case 'approved_dt': return 'studies.approved_dt';
            case 'study_status_description':
                if (screenName == 'Encounter') {
                    return 'orders.order_status_desc';
                }

                return 'study_status.status_desc';
            case 'study_flag': return 'study_flags.description';
            case 'priority': return 'studies.priority';
            case 'modalities':
                if (screenName == 'Orders') {
                    return 'modalities.modality_code';
                }

                return 'studies.modalities';
            case 'body_part': return 'studies.body_part';
            case 'status_last_changed_dt': return 'studies.status_last_changed_dt';
            case 'scheduled_dt':
            case 'schedule_date': return 'studies.schedule_dt';
            case 'study_dt': return 'studies.study_dt';
            case 'study_status':
                if (screenName == 'Encounter') {
                    return 'orders.order_status_desc';
                }

                return 'studies.study_status';
            case 'patient_age':
                if (screenName == 'Encounter') {
                    return `order_info->'patient_age'`;
                }

                return 'extract(days from (studies.study_dt - patients.birth_date))';
            case 'gender': return 'patients.gender';
            case 'mu_last_updated_by': return `orders.order_info->'lastMuUpdatedBy'`;
            case 'accession_no':
                if (screenName == 'Encounter') {
                    return 'orders.id';
                }

                return 'studies.accession_no';
            case 'requesting_date': return `to_timestamp(orders.order_info->'requestingDate', 'MM/DD/YYYY')`;
            case 'days_count': return `studies.study_info->'preOrderDays'`;
            case 'days_left': return `studies.study_info->'preOrderDays'`;
            case 'ordering_facility': return `orders.order_info->'ordering_facility'`;
            case 'technologist_name': return 'providers.full_name';
            case 'claim_status': return `orders.order_info->'claim_status'`;
            case 'check_indate': return `text_to_isots(studies.study_info->'Check-InDt')`;             // optimization! use sutom immutable function (instead of timestamptz) and corresponding index to improve query time
            case 'approving_provider_ref': return 'approving_provider_ref.full_name';
            case 'approving_provider': return 'approving_provider_ref.full_name';
            case 'claim_no': return 'orders.id';
            case 'ordered_by': return 'orders.ordered_by';
            case 'vehicle_name': return 'vehicles.vehicle_name';
            case 'order_type': return 'orders.order_type';
            case 'cpt_codes': return 'studies.cpt_codes';
            case 'mu_last_updated': return 'orders.mu_last_updated';
            case 'report_queue_status': return report_queue_status_query;
            case 'account_no': return 'patients.account_no';
            case 'modality_room_id': return 'orders.modality_room_id';
            case 'institution': return 'studies.institution';
            case 'as_authorization': return 'auth.as_authorization';
            case 'facility_name': return 'facilities.facility_name';
            case 'tat_level': return 'tat.level';
            case 'patient_room': return `orders.order_info->'patientRoom'`; //***For EXA-7148 -- Add Room Number colum to Facility Portal***//
            case 'visit_no': return `orders.order_info->'visit_no'`;
            case 'billed_status': return `(SELECT  CASE WHEN (SELECT 1 FROM billing.charges_studies inner JOIN billing.charges ON charges.id=
                                                charges_studies.charge_id  WHERE study_id = studies.id LIMIT 1) >0 THEN 'billed'
                                                ELSE 'unbilled' END)`;
            case 'study_cpt_id': return 'study_cpt.study_cpt_id';
            case 'ins_provider_type': return 'insurance_providers.provider_types';
            case "eligibility_verified": return `(COALESCE(eligibility.verified, false) OR COALESCE(orders.order_info->'manually_verified', 'false')::BOOLEAN)`;

        }

        return args;
    },

    // one of the columns must be a "number" as that is used for sorting
    // row_number() over( order by "column" ) as number
    getWLQuery: function (columns, args, params) {
        args.sortField = api.getSortFields(args.sortField, 'Study');


        if (args.filterQuery){
            args.filterQuery += ' AND ';
        }else{
            args.filterQuery = ' WHERE ';
        }

        args.filterQuery += ` studies.study_dt IS NOT NULL
                                AND  studies.order_id IS NOT NULL AND studies.patient_id IS NOT NULL   `;



        if (args.customArgs && args.customArgs.isOrdingFacility == 'true' && args.customArgs.provider_group_id && args.customArgs.provider_group_id > 0) {

            args.filterQuery += ` AND studies.provider_group_id = $${params.length + 1} AND `;

            params.push(args.customArgs.provider_group_id);

            if (args.customArgs.currentFlag == 'scheduled_appointments'){
                args.filterQuery += ' (orders.vehicle_id > 0 OR orders.technologist_id > 0) '; // TODO: why not null
            }else{
                args.filterQuery += ' ((orders.vehicle_id IS NULL OR orders.vehicle_id = 0) AND (orders.technologist_id IS NULL OR orders.technologist_id = 0) ) ';

            }
        }

        let tables = Object.assign({}, api.getTables(args.sortField), api.getTables(args.filterQuery), api.getTables(args.permissionQuery), api.getTables(columns));

        const permissionQuery = args.permissionQuery ? ` INNER JOIN (${args.permissionQuery}) pquery ON pquery.id = studies.id ` : '';

        const query = `
            SELECT
                ${columns}
            FROM
                studies
            ${permissionQuery}
            ${api.getWLQueryJoin(tables) + args.filterQuery}
            `;
        return query;
    },
    getWLQueryJoin: function (columns) {
        let tables = columns instanceof Object && columns || api.getTables(columns);
        let imp_orders = tables.vehicles || tables.users || tables.providers || tables.auth || tables.eligibility;
        let imp_provider_contacts = tables.imagedelivery || tables.providers_ref;
        let imp_facilities = tables.tat;
        let r = '';

        if (tables.facilities || imp_facilities) {r += ' INNER JOIN facilities ON studies.facility_id = facilities.id ';}//AND (facilities.is_active = true OR facilities.facility_info->'show_studies' = 'true') `;

        if (tables.patients) {r += ' INNER JOIN patients ON studies.patient_id = patients.id ';}

        if (tables.orders || imp_orders){ r += ' INNER JOIN orders ON studies.order_id = orders.id ';}

        if (tables.tat) {r += `
                            LEFT JOIN LATERAL (
                                SELECT get_study_tat_level(studies.study_unread_dt,facilities.max_tat) AS level)  tat ON studies.study_unread_dt IS NOT NULL
                                AND studies.study_status NOT IN ('RE','APP','APCD','INC') `;}

        if (tables.modalities){ r += ' LEFT JOIN modalities ON studies.modality_id = modalities.id '; }// This should be inner

        if (tables.cpt_codes) {r += ' LEFT JOIN cpt_codes ON studies.procedure_id = cpt_codes.id ';}

        if (tables.auth){
            r += `
                LEFT JOIN LATERAL (
                    SELECT get_authorization(studies.id,studies.facility_id,studies.modality_id,studies.patient_id,(ARRAY[coalesce(orders.primary_patient_insurance_id,0), coalesce(orders.secondary_patient_insurance_id,0), coalesce(orders.tertiary_patient_insurance_id,0)]),studies.study_dt)::text AS as_authorization
                ) AS auth ON true
                `;
        }

        if(tables.study_cpt){
            r += `   LEFT JOIN LATERAL (
                SELECT study_cpt.id as study_cpt_id FROM study_cpt INNER JOIN cpt_codes cpt ON  cpt.id=study_cpt.cpt_code_id    WHERE study_id = studies.id AND NOT study_cpt.has_deleted   AND NOT cpt.has_deleted   LIMIT 1
            ) AS study_cpt ON true `;
        }


        if (tables.insurance_providers){
            r += `
                  LEFT JOIN LATERAL(
                            SELECT
                            array_agg(ippt.description) FILTER (WHERE ippt.description is not null) provider_types,
                            orders.id AS order_id
                                FROM orders
                            LEFT JOIN patient_insurances pat_ins ON ( pat_ins.id = orders.primary_patient_insurance_id OR pat_ins.id = orders.secondary_patient_insurance_id OR pat_ins.id =  orders.tertiary_patient_insurance_id )
                            LEFT JOIN insurance_providers insp ON pat_ins.insurance_provider_id = insp.id
                            LEFT JOIN insurance_provider_payer_types  ippt ON ippt.id = COALESCE (insp.provider_payer_type_id, 0)
                            WHERE orders.id = studies.order_id
                        GROUP BY orders.id
                  ) AS insurance_providers ON true
                  `;
        }

        if (tables.vehicles) {r += ' LEFT JOIN vehicles ON orders.vehicle_id = vehicles.id ';}

        if (tables.providers){ r += ' LEFT JOIN providers ON orders.technologist_id = providers.id ';}

        if (tables.attorneys) {r += ' LEFT JOIN providers AS attorneys ON attorneys.id = studies.attorney_provider_id ';}

        if (tables.users){ r += ' LEFT JOIN users ON orders.ordered_by = users.id ';}

        if (tables.approving_provider_ref) {
            r += `
                LEFT JOIN providers AS approving_provider_ref on approving_provider_ref.id = (
                    ${api.approvingProviderJoinSubselect}
                ) `;
        }

        if (tables.provider_contacts || imp_provider_contacts){ r += ' LEFT JOIN provider_contacts ON studies.referring_physician_id = provider_contacts.id ';}

        if (tables.providers_ref){ r += ' LEFT JOIN providers AS providers_ref ON provider_contacts.provider_id = providers_ref.id ';}

        if (tables.imagedelivery){
            r += `
                LEFT JOIN LATERAL (
                    SELECT array_to_string(
                        ARRAY [
                            replace(
                                NULLIF(provider_contacts.contact_info -> 'delivery_cd', 'false'), 'true', 'CD'
                            ),
                            replace(
                                NULLIF(provider_contacts.contact_info -> 'delivery_film', 'false'), 'true', 'Film'
                            ),
                            replace(
                                NULLIF(provider_contacts.contact_info -> 'delivery_paper', 'false'), 'true', 'Paper'
                            )
                        ], ', '
                    ) AS image_delivery
                ) AS imagedelivery ON TRUE
                `;
        }

        if (tables.eligibility){
            r += `
                LEFT JOIN LATERAL (
                    SELECT
                        COALESCE(
                            eligibility_response->'data'->'coverage'->>'active',
                            'false'
                        )::boolean       AS verified,
                        eligibility_dt   AS dt
                    FROM
                        eligibility_log
                    WHERE
                        eligibility_log.patient_id = studies.patient_id
                    ORDER BY
                        eligibility_log.id DESC
                    LIMIT 1
                ) eligibility ON TRUE `;

        }

        if (tables.study_status){ r += ` LEFT JOIN study_status ON (
            CASE studies.study_status WHEN 'TE' THEN 'INC'
            ELSE studies.study_status END = study_status.status_code AND studies.facility_id = study_status.facility_id) `;}

        if (tables.study_flags){ r += ` LEFT JOIN study_flags
        ON study_flags.id = (studies.study_info->'study_flag_id')::int `;}

        if (tables.report_delivery){
            r += `
                LEFT JOIN LATERAL (
                    SELECT current_status AS report_queue_status
                    FROM report_delivery_queue
                    WHERE report_delivery_queue.study_id = studies.id
                    ORDER BY report_delivery_queue.id
                    LIMIT 1
                ) AS report_delivery ON TRUE
                `;
        }
        //if (tables.user_study_assignments && user_id) r += ` LEFT JOIN user_study_assignments ON (user_study_assignments.study_id = studies.id AND user_study_assignments.user_id = ${user_id}) `;
        //if (tables.user_patient_assignments && user_id) r += ` LEFT JOIN user_patient_assignments ON (user_patient_assignments.patient_id = studies.patient_id AND user_patient_assignments.user_id = ${user_id}) `;

        return r;
    },

    getWLQueryColumns: function () {
        function product(type) { return (config.get('license') || ['PACS']).includes(type) || (config.get('license') || ['PACS']).includes('ALL'); } // TODO: use proper product checking code !!!!

        // ADDING A NEW WORKLIST COLUMN <-- Search for this
        let stdcolumns = [
            'study_flags.description AS study_flag',
            'study_flags.color_code AS study_color_code',
            // Studies Table
            'studies.id as study_id',
            'studies.linked_study_id',
            `studies.study_info-> 'Check-InDt'
                AS check_indate`,
            `studies.study_info-> 'current_status_waiting_time'
                AS current_status_waiting_time`,
            'providers_ref.full_name AS refphy_name',
            `studies.study_info-> 'readDescription'
                AS readphy_name`,
            `studies.study_info-> 'station'
                AS station`,
            `studies.study_info-> 'study_description'
                AS study_status_description`, // TODO: what is this ?? why is it different then study_description ?!
            `studies.study_info-> 'department'
                AS department`,
            `studies.study_info-> 'send_status'
                AS send_status`,
            `studies.study_info-> 'fax_status'
                AS fax_status`,
            `(select ae_info->'is_sde' AS is_sde from application_entities
                WHERE id::varchar= studies.study_info-> 'ae_title_id') AS is_sde`, // TODO: move this into join possibly
            `study_info->'sde_study'
                AS sde_study`, // TODO: why do we need 2 of these fields separately instead of one ?!?
            'studies.study_info', // TODO: Why do we need this !!! (its an hstore ??? we already extract data from it)
            'studies.study_uid as study_uid',
            'studies.priority',
            'studies.no_of_instances',
            'studies.no_of_series',
            'studies.stat_level',
            //'studies.patient_age', // TODO: remove column from db
            `dicom_age(extract(days from (studies.study_dt - patients.birth_date))::integer)
                AS patient_age`,
            'studies.modalities',
            'studies.has_unread_dicoms', // TODO: What is this !!
            'studies.dictation_started', // TODO: this is "was live" flag, shouldnt we just use study status and not this !!
            'studies.modality_id as modality_id', // TODO: Why do we need this ?? we should just need modality code
            `(SELECT  CASE WHEN (SELECT claim_id FROM billing.charges_studies inner JOIN billing.charges ON charges.id=
                charges_studies.charge_id  WHERE study_id = studies.id LIMIT 1) >0 THEN 'billed'
            ELSE 'unbilled' END) as billed_status `,
            'studies.facility_id as facility_id',
            'studies.order_id', // TODO: Why do we need this !!
            'has_priors(studies.id,studies.patient_id)', // TODO: how about we use patients.study_count !! for this potentially (if its updated)
            'studies.dicom_status',
            'studies.accession_no',
            'studies.study_status', //??? TODO: why do we need study_status and status_code with same info
            'studies.study_status as status_code',
            'studies.referring_physician_id', // TODO: Why is this any different from referring_provider and why do i need id if having name already ?
            'studies.cpt_codes',
            'studies.notes as notes', // TODO: this should not be returned as column (maybe has_notes but now whole notes)
            'studies.has_deleted', // TODO: this column should not be deleted Status should be deleted and if its really purged it shouldnt be there
            'studies.study_description',
            'studies.institution as institution',
            '(SELECT claim_id FROM billing.charges_studies inner JOIN billing.charges ON charges.id= charges_studies.charge_id  WHERE study_id = studies.id LIMIT 1) as claim_id',
            'studies.approved_dt as approved_dt',
            'studies.study_received_dt',
            'studies.body_part',
            'studies.reason_for_study',
            'studies.study_dt::text',
            `to_char(studies.study_created_dt, 'YYYY-MM-DD')
                AS study_created_dt`,
            'studies.status_last_changed_dt::text',
            'studies.patient_id as patient_id',
            '(extract(epoch from (current_timestamp - studies.status_last_changed_dt))/60)::int AS max_waiting_time', // TODO: why do we need "current_status_waiting_time" as this should be it
            // Orders Table
            // TODO: move this into join
            `COALESCE((
                                SELECT users.username
                                FROM users
                                WHERE COALESCE(orders.order_info->'manually_verified_by', '0')::bigint = users.id
                            ), '') AS manually_verified_by`,
            `timezone(facilities.time_zone, COALESCE(orders.order_info->'manually_verified_dt', NULL)::timestamp)::text
                AS manually_verified_dt`,
            `orders.order_info-> 'ordering_facility'
                AS ordering_facility`,
            `orders.order_info-> 'requestingDate'
                AS requesting_date`,
            `orders.order_info-> 'visit_no'
                AS visit_no`,
            'orders.order_status',
            'orders.order_status AS order_status_code', // TODO: why is this ? suplicated in similar fashion as study_status
            'orders.order_type',
            'orders.ordered_by',                    // TODO: isnt this the same as the results for users ??
            'orders.has_deleted as orders_deleted', // TODO: why do we need this ? shouldnt we delete ordered completely ?
            'orders.icd_codes',
            'orders.modality_room_id', // TODO: this MUST be part of study and not order, order has no ROOM
            'studies.schedule_dt::text as scheduled_dt',
            `array_to_string(orders.referring_provider_ids, '~')
            AS referring_provider_ids`, // TODO: why do we need this !!
            `array_to_string(orders.referring_providers, '~')
            AS referring_providers`, // TODO: why do we need this !!
            // Patients
            'patients.account_no as account_no',
            'patients.last_name as last_name',
            'patients.first_name as first_name',
            'patients.full_name as patient_name',       // TODO: use function to create full_name instead of the full_name column (we can index based on function result instead of the column)
            'patients.birth_date::text as birth_date',
            'substring(patients.gender,1,1) as gender', //TODO: remove once we are sure that all Genders are single letter
            // Users (orders.ordered_by) TODO: make this just a full_name instead of the first/last pair and name it properly
            'users.last_name as userlastname',
            'users.first_name as userfirstname',
            // Modality (from studies.modality_id => modalities )
            'modalities.modality_code as modality_code',
            'modalities.modality_name as modality_name',
            'facilities.facility_name as facility_name',
            // TODO: this seems to be used only in mobile (maybe move it to mobile configuration if so)
            'providers.full_name as technologist_name',
            // TODO: why are we returning alerts for a study in worklist ?!?
            `provider_contacts.contact_info->'providerAlerts'
                AS "providerAlerts"`,
            // TODO: move this into JOIN
            `
                                (
                                    SELECT
                                        get_full_name(last_name, first_name, middle_initial, NULL, suffix)
                                    FROM
                                        providers
                                    WHERE
                                        studies.attorney_provider_id = providers.id
                                ) AS attorney_name
                            `,
            'approving_provider_ref.full_name AS approving_provider',
            `imagedelivery.image_delivery
                AS image_delivery`,
            `auth.as_authorization
                AS as_authorization`,
            'report_delivery.report_queue_status',
            `are_notes_empty(studies.notes, patients.notes, orders.order_notes)
                AS empty_notes_flag`,
            `study_cpt.study_cpt_id`,
            // Lock
            // TODO: move this out of postgres (or at least as JOIN for now)
            `(
                                SELECT
                                    STRING_AGG(users.first_name || ' ' || users.last_name, ', ')
                                FROM users
                                LEFT JOIN user_locks ON user_locks.user_id = users.id AND lock_type = 'viewer' AND user_locks.locked_dt > (now() - INTERVAL '1 hours')
                                WHERE user_locks.study_id = studies.id
                        ) AS locked_by`,
            `studies.stat_level AS stat_level`,
            `order_info->'patientRoom' AS patient_room`,
            `insurance_providers.provider_types AS ins_provider_type`,
            `(SELECT array_agg(insurance_name) FROM insurance_providers WHERE id IN (SELECT insurance_provider_id FROM patient_insurances WHERE id = orders.primary_patient_insurance_id OR id = orders.secondary_patient_insurance_id OR id = orders.tertiary_patient_insurance_id )) AS insurance_providers`,
            `(COALESCE(eligibility.verified, false) OR COALESCE(orders.order_info->'manually_verified', 'false')::BOOLEAN)   AS eligibility_verified`,
            `eligibility.dt AS eligibility_dt`
        ];

        return stdcolumns.concat(
            product('TAT') && [
                `COALESCE(tat.level,-1)
                    AS tat_level`
            ],
            product('BILLING') && [                
                `orders.order_info-> 'payer_type'
                    AS payer_type`, // Billing
                'orders.id as claim_no', // Billing
                ` '' AS claim_status`,
                ` '' AS billing_code`,
                ` '' AS billing_class`
            ],
            product('MU') && [
                'orders.mu_last_updated',
                `orders.order_info-> 'lastMuUpdatedBy'
                    AS mu_last_updated_by`,
                `orders.order_info-> 'muDataCaptured'
                    AS muDataCaptured`,
                'orders.mu_passed'
            ],
            product('MOBILE') && [
                'vehicles.vehicle_name'
            ]
        ).join(',');
    },

    getWorkList:  async function (args) {
        let sortField = (args.sortField || '').trim();
        let sortOrder = (args.sortOrder || '').trim();

        if (sortField == 'tat_level') {

            if (sortOrder && sortOrder.toUpperCase() == 'DESC') {
                sortOrder += ' NULLS LAST';
            }
            else{
                sortOrder += ' NULLS FIRST';
            }
        }

        sortField = api.getSortFields(sortField, 'Study', args.report_queue_status_query);

        let params = [];
        const tables = api.getTables([sortField]);
        let sort = '';
        let sorting = [];

        if (sortField){
            sorting.push(`${sortField} ${sortOrder}`);
        }

        if (tables.studies || !sortField){
            sorting.push('studies.id DESC');
        }

        sort = ` ORDER BY  ${sorting.join(',')} `;

        let limit = !args.pageSize ? '' :
            ` LIMIT ${args.pageSize} `
            ;

        let offset = !args.pageNo ? '' :
            ` OFFSET ${((args.pageNo - 1) * args.pageSize) || 0} `
            ;

        let innerQuery = api.getWLQuery(`
                            row_number() over(${sort}) as number
                            , studies.id AS study_id
                            `, args, params);

        innerQuery += limit + offset;

        // optimization! convert INNER to LEFT OUTER joins and add relevant WHERE clauses
        args.filterQuery += ' AND studies.patient_id IS NOT NULL AND studies.order_id IS NOT NULL ';
        // TODO: switch these function calls into JOINS (perhaps)

        let columns = api.getWLQueryColumns();
        let sql = `
            SELECT
            ${columns}
            ${(args.report_queue_status_query && ('  , ' + args.report_queue_status_query + ' AS report_queue_status') || '')}
            FROM (${innerQuery}) as FinalStudies
            INNER JOIN studies ON FinalStudies.study_id = studies.id
            ${api.getWLQueryJoin(columns)}
            ORDER BY FinalStudies.number
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

    getWL: async function (args) {
        const AND = (a, q) => a + ((a.length > 0) ? '\nAND ' : '') + q;

        let whereClause = {
            default: '',
            query: '',
            studyFilter: '',
            userFilter: '',
            permission_filter: ` studies.company_id = ${args.company_id} `
        };

        if (args.customArgs && args.customArgs.isOrdingFacility !== 'true') {
            whereClause.permission_filter = AND(whereClause.permission_filter, ' studies.study_dt IS NOT NULL ');
        }

        let statOverride = args.customArgs && args.customArgs.statOverride === 'true';

        let includeDeleted_study = false;

        let includeDeleted_perms = null;

        args.report_queue_status_query = await api.getReportQueueStatusQuery();

        // Study Filters
        const filter_id = (args.customArgs.filter_id > 0) ? args.customArgs.filter_id : 0;
        const filter_options = {
            id: filter_id,
            flag: 'home_study',
            user_id: args.user_id,
            statOverride: statOverride,
            directCall: true
        };

        // TODO: it would be nice if we could run this within DB and create query there instead of back and forth between DB and node

        const response = await studyfilterdata.getUserWLFilters(filter_options);

        //studyfilterdata.getUserWLFilters(filter_options, function (err, response) {

        const filter = response.rows[0] ||{};

        const {
            joined_filter_info
        } = filter;

        const filter_query = joined_filter_info && util.getCombinedQuery(joined_filter_info, args.user_id, args.statOverride) || '';
        const newFilter = Object.assign(filter, { filter_query });

        newFilter.perms_filter = util.getStudyFilterQuery(filter.perm_filter, args.user_id, args.statOverride);

        let responseUserSetting=[newFilter];

        let permission_query = SQL`
        -- permission query
        `;

        if (responseUserSetting.length > 0) {
            let userSetting = responseUserSetting[0];

            const perms_filter = userSetting.perms_filter;

            if (perms_filter && perms_filter.options) {
                includeDeleted_perms = perms_filter.options.includeDeleted;
            }


            const studyFilter = userSetting;

            if (studyFilter) {

                if (studyFilter.filter_info) {
                    const {
                        options = {
                            'showDicomStudies': false,
                            'showRisOrders': false,
                            'showAssignedStudies': false,
                            'includeDeleted': false
                        }
                    } = studyFilter.filter_info;

                    const {
                        includeDeleted
                    } = options;

                    includeDeleted_study = includeDeleted;
                    whereClause.studyFilter = AND(whereClause.studyFilter, api.getSettingsFilter());
                }

                if (studyFilter.filter_query){
                    whereClause.studyFilter = AND(whereClause.studyFilter, studyFilter.filter_query);
                }

                if (includeDeleted_study !== includeDeleted_perms) {
                    switch (includeDeleted_study) {
                        case false:
                            whereClause.default = AND(whereClause.default, ' NOT studies.has_deleted ');
                            break;
                        case true:
                            whereClause.default = AND(whereClause.default, ' studies.has_deleted ');
                            break;
                    }
                }

                if (studyFilter.perms_filter) {
                    whereClause.studyFilter = AND(whereClause.studyFilter, studyFilter.perms_filter);
                }
            }

            //BEGIN PERMISSION QUERY

            {
                //showEncOnly = (showEncOnly == false) ? userSetting.worklist_filter_info.options.showEncOnly : showEncOnly;    // Totally crashes the worklist when you try to respect the user filter Show Encounters Only option
                statOverride = !statOverride && perms_filter && perms_filter.options && perms_filter.options.statOverride || statOverride;

                whereClause.permission_filter = AND(whereClause.permission_filter, api.getSettingsFilter());

                if (userSetting.userDetails) { // this is permissions based on use facilities [why base on orders vs studies facility_id ??]
                    if (userSetting.userDetails.user_type != 'SU' && userSetting.userDetails.all_facilities != true) {
                        whereClause.permission_filter = AND(whereClause.permission_filter, ` studies.facility_id = ANY(ARRAY[${userSetting.userDetails.facilities}]) `);
                    }
                }

                switch (includeDeleted_perms) {
                    case false:
                        whereClause.permission_filter = AND(whereClause.permission_filter, ' NOT studies.has_deleted ');
                        break;
                    case true:
                        whereClause.permission_filter = AND(whereClause.permission_filter, ' studies.has_deleted ');
                        break;
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

            if (args.customArgs && args.customArgs.isOrdingFacility == 'true' && args.customArgs.provider_group_id > 0) {
                args.customArgs.provider_group_id = args.linked_ordering_facility_id ? args.linked_ordering_facility_id : args.customArgs.provider_group_id;
                let from = moment(args.customArgs.fromDate, 'YYYY-MM-DD');
                let to = moment(args.customArgs.toDate, 'YYYY-MM-DD');

                if (args.customArgs.fromDate && args.customArgs.toDate) {
                    whereClause.default += `
                        AND (
                              (to_facility_date(studies.facility_id, studies.study_created_dt)  BETWEEN ('${from.format()}')::date AND ('${to.format()}')::date)
                           OR (to_facility_date(studies.facility_id, studies.study_dt)          BETWEEN ('${from.format()}')::date AND ('${to.format()}')::date)
                           OR (order_info->'requestingDate' <> '' AND date(COALESCE(orders.order_info->'requestingDate',null)) BETWEEN ('${from.format()}')::date AND ('${to.format()}')::date)
                        )
                    `;
                }

                if (args.customArgs.orderFilter && args.customArgs.orderFilter != '') {
                    whereClause.default += args.customArgs.orderFilter == 'OF' ? ' AND orders.order_source = \'OF\'' : ' AND orders.order_source = \'RF\'';
                }
            }

            // Default conditions and study filter conditions
            whereClause.query = whereClause.default;

            if (whereClause.studyFilter) {
                whereClause.query += ` AND ${whereClause.studyFilter} `;
            }

            const query_options = {
                defaultwherefilter: whereClause.query,
                statusCode: args.customArgs && args.customArgs.statusCode ? args.customArgs.statusCode : [],
                isFrom: 'Studies',
                statOverride: statOverride
            };

            let column = JSON.parse(args.filterCol);
            let data = JSON.parse(args.filterData);

            if (column.indexOf('study_dt') == -1 && (args.customArgs.filter_id == 'All_Studies')) {
                data.push(moment().subtract(29, 'days').format('YYYY-MM-DD') + ' - ' + moment().format('YYYY-MM-DD'));
                column.push('study_dt');
            }

            args.filterCol = JSON.stringify(column);
            args.filterData = JSON.stringify(data);

            const response = await filterValidator.generateQuery(colModel, args.filterCol, args.filterData, query_options);
            args.filterQuery = response;

            if (userSetting.user_details) {
                if (userSetting.user_details.user_type != 'SU' && userSetting.user_details.all_facilities != true) {
                    let flist = userSetting.user_details.facilities;

                    args.permissionFacilities = typeof (flist) === 'number' ? [flist] : Array.isArray(flist.map(Number)) ? flist : flist.split(',').map(Number);
                }
            }

            if(args.isCount){
                return await api.getWorkListCount(args);
            }

            return await api.getWorkList(args);
        }
    }
};

module.exports = api;

