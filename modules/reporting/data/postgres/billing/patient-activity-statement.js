const _ = require('lodash')
    , Promise = require('bluebird')
    , db = require('../db')
    , dataHelper = require('../dataHelper')
    , queryBuilder = require('../queryBuilder')
    , logger = require('../../../../../logger');

// generate query template ***only once*** !!!

const patientStatementDataSetQueryTemplate = _.template(`


WITH claim_data as(
    SELECT
       bc.id as claim_id
    FROM billing.claims bc
    <% if (billingProviderIds) { %> INNER JOIN billing.providers bp ON bp.id = bc.billing_provider_id <% } %>
    WHERE 1=1
    AND <%= patientIds %>
    <% if(billingProviderIds) { %> AND <% print(billingProviderIds); } %>
    <% if(reportBy == 'false') { %> AND <% print(claimDate); } %>
    ),
    patient_insurance AS (
        select
        CASE coverage_level
						WHEN 'primary' THEN 'P'
						WHEN 'secondary' THEN 'S'
                        WHEN 'tertiary' THEN 'T' END AS cov_level,
        to_char(valid_from_date, 'MM/DD/YYYY') as valid_from_date,
        to_char(valid_to_date, 'MM/DD/YYYY') AS valid_to_date,
        policy_number AS policy_no,
        group_number AS group_no,
        ip.insurance_name    AS company_name
  from
     patient_insurances pis
     INNER JOIN insurance_providers AS ip ON ip.id = pis.insurance_provider_id
     INNER JOIN billing.claims bc ON bc.patient_id = pis.patient_id
     INNER JOIN claim_data cd ON cd.claim_id = bc.id
     INNER JOIN facilities f on f.id = bc.facility_id
     ORDER BY cov_level
      ),
    billing_comments as
    (
    <% if (billingComments == "true")  { %>
    SELECT
          cc.claim_id AS id
        , 'claim' AS type
        , note AS comments
        , created_dt AS commented_dt
        , null AS amount
        , u.username AS commented_by
        , null AS code
        , cc.id as charge_id
    FROM
          billing.claim_comments cc
    INNER JOIN claim_data cd on cd.claim_id = cc.claim_id
    INNER JOIN users u  on u.id = cc.created_by
    UNION
    <% } %>
    SELECT
        c.claim_id as id,
        'charge' as type,
        cc.short_description as comments,
        c.charge_dt  AS commented_dt,
        (c.bill_fee*c.units) as amount,
        u.username as commented_by,
        cc.display_code as code,
        c.id as charge_id
    FROM billing.charges c
    INNER JOIN claim_data cd ON cd.claim_id = c.claim_id
    INNER JOIN cpt_codes cc ON cc.id = c.cpt_id
    INNER JOIN users u  ON u.id = c.created_by
    UNION
    SELECT
      bc.claim_id as id,
      amount_type as type,
      CASE WHEN bp.payer_type = 'patient' THEN
               pp.full_name
         WHEN bp.payer_type = 'insurance' THEN
               pip.insurance_name
         WHEN bp.payer_type = 'ordering_facility' THEN
               pg.group_name
         WHEN bp.payer_type = 'ordering_provider' THEN
               p.full_name
    END AS comments,
    bp.accounting_date as commented_dt,
    sum(pa.amount) as amount,
    u.username as commented_by,
    CASE amount_type
         WHEN 'adjustment' THEN 'Adj'
         WHEN 'payment' THEN (CASE bp.payer_type
                             WHEN 'patient' THEN 'Patient'
                             WHEN 'insurance' THEN 'Insurance'
                             WHEN 'ordering_facility' THEN 'Ordering facility'
                             WHEN 'ordering_provider' THEN 'Provider'
                             END)
    END as code,
    ROW_NUMBER () OVER (ORDER BY bp.id) as charge_id -- Require rownumber for each selected row
    FROM
         billing.payments bp
    INNER JOIN billing.payment_applications pa on pa.payment_id = bp.id
    INNER JOIN billing.charges bc on bc.id = pa.charge_id
    INNER JOIN claim_data cd on cd.claim_id = bc.claim_id
    INNER join users u  on u.id = bp.created_by
    LEFT JOIN public.patients pp on pp.id = bp.patient_id
    LEFT JOIN public.insurance_providers pip on pip.id = bp.insurance_provider_id
    LEFT JOIN public.provider_groups  pg on pg.id = bp.provider_group_id
    LEFT JOIN public.provider_contacts  pc on pc.id = bp.provider_contact_id
    LEFT JOIN public.providers p on p.id = pc.provider_id
    GROUP BY bc.claim_id,amount_type,comments,bp.id,u.username,code,pa.applied_dt
    ORDER BY charge_id ASC
    ),
    main_detail_cte as (
    SELECT
        p.id as pid,
        sum((CASE type WHEN 'charge' then amount
                      WHEN 'payment' then amount
                      WHEN 'adjustment' then amount
            ELSE 0::money
            END) * (CASE WHEN type in('payment','adjustment') then -1
            ELSE 1
            END)) OVER (PARTITION BY p.id) AS sum_amount,
        p.first_name,
        p.middle_name,
        p.last_name,
        get_full_name(p.last_name,p.first_name,p.middle_name,p.prefix_name,p.suffix_name) as full_name,
        p.account_no AS account_no,
        p.patient_info->'c1AddressLine1' AS address1,
        p.patient_info->'c1AddressLine2' AS address2,
        p.patient_info->'c1City' AS city,
        p.patient_info->'c1State' AS state,
        p.patient_info->'c1Zip' AS zip,
        commented_dt as enc_date,
        comments as description,
        pc.code,
        pc.id as enc_id,
        CASE type WHEN 'charge' THEN 1
            WHEN 'payment' THEN 2
            WHEN 'adjustment' THEN 3
            ELSE 4
            END AS row_flag,
        ((CASE type WHEN 'charge' then amount
                      WHEN 'payment' then amount
                      WHEN 'adjustment' then amount
            ELSE 0::money
            END) * (CASE WHEN type in('payment','adjustment') then -1
            ELSE 1
            END)) AS amount,
        case when type = 'charge' then amount end as charge,
        case when type = 'payment' then amount end as payment,
        case when type = 'adjustment' then amount end as adjustment,
        bp.name as billing_provider_name,
        pi.coverage_level  as billing_proaddress1,
        pi.group_number as billing_proaddress2,
        pi.policy_number as billing_procity,
        to_char(pi.valid_to_date, 'MM/DD/YYYY') as billing_prostate,
        bp.zip_code as billing_prozip,
        bp.zip_code_plus as billing_zip_plus,
        bp.phone_number as billing_phoneno,
        type as payment_type,
        CASE type WHEN 'charge' THEN 1 ELSE 2 END AS sort_order,
        charge_id
    FROM public.patients p
         INNER JOIN billing.claims bc on bc.patient_id = p.id
         INNER JOIN billing_comments pc on pc.id = bc.id
         INNER JOIN billing.providers bp on bp.id = bc.billing_provider_id
         INNER JOIN facilities f on f.id = bc.facility_id
         LEFT JOIN public.patient_insurances pi on pi.id = (CASE WHEN  bc.payer_type = 'primary_insurance' THEN
         primary_patient_insurance_id
   WHEN  bc.payer_type = 'secondary_insurance' THEN
         secondary_patient_insurance_id
   WHEN  bc.payer_type = 'tertiary_insurance' THEN
         tertiary_patient_insurance_id
   END)),
    detail_cte AS(
    SELECT
     *
    From main_detail_cte
    where (payment_type != 'adjustment' or (payment_type = 'adjustment' AND amount != 0::money))
    ),
    sum_encounter_cte AS (
    SELECT
            pid
          , enc_id
          , max(enc_date::date) AS bucket_date
          , sum(amount)         AS enc_total_amount
          FROM detail_cte
          GROUP BY
            pid
          , enc_id
    ),
    sum_statement_credit_cte AS (
          SELECT
            pid
          , sum(enc_total_amount) FILTER (WHERE bucket_date between <%= sDate %> - interval '30 days' and  <%= sDate %>) as current_amount
          , sum(enc_total_amount) FILTER (WHERE bucket_date between <%= sDate %> - interval '60 days' and  <%= sDate %>- interval '31 days') as over30_amount
          , sum(enc_total_amount) FILTER (WHERE bucket_date between <%= sDate %> - interval '90 days' and  <%= sDate %>- interval '61 days') as over60_amount
          , sum(enc_total_amount) FILTER (WHERE bucket_date between <%= sDate %> - interval '120 days' and <%= sDate %> - interval '91 days') as over90_amount
          , sum(enc_total_amount) FILTER (WHERE bucket_date <= <%= sDate %> - interval '121 days') as over120_amount
          , sum(enc_total_amount) AS statement_total_amount

          FROM sum_encounter_cte
          GROUP BY pid
    ),
    billing_messages as (SELECT (select description from billing.messages where <%= companyId %> and CODE = '0-30') as msg0to30,
                                (select description from billing.messages where <%= companyId %> and CODE = '31-60') as msg31to60,
                                (select description from billing.messages where <%= companyId %> and CODE = '61-90') as msg61to90,
                                (select description from billing.messages where <%= companyId %> and CODE = '91-120') as msg91to120,
                                (select description from billing.messages where <%= companyId %> and CODE = '>120') as msggrater120,
                                (select description from billing.messages where <%= companyId %> and CODE = 'collections') as collection
    ),
    statement_cte AS (
          SELECT
            statement_total_amount
          , current_amount
          , over30_amount
          , over60_amount
          , over90_amount
          , over120_amount
          , (SELECT CASE
             WHEN over120_amount IS NOT NULL THEN msggrater120
             WHEN over90_amount IS NOT NULL THEN msg91to120
             WHEN over60_amount IS NOT NULL THEN msg61to90
             WHEN over30_amount IS NOT NULL THEN msg61to90
             WHEN current_amount IS NOT NULL THEN msg0to30
             ELSE null
             END
             FROM billing_messages ) AS billing_msg
          , pid AS pid
          FROM sum_statement_credit_cte
          ),
          -- Selected Claim id based billing_provider_name fetch
          billing_provider_cte AS (
            SELECT
                bp.name AS billing_provider_name
            FROM
                billing.providers bp
            INNER JOIN billing.claims bc on bc.billing_provider_id = bp.id
            WHERE
            <% if(claimId) { %>
                   <% if(billingProviderIds) { %> <% print(billingProviderIds); } else { %>  bc.id =  <%= claimId %> <% } %>
            <% } else { %>
                 <%= patientIds %>
            <% } %>
          ),
          all_cte AS (
          -- 1st Header, Billing Provider, update the columns in the dataset
          -- 2nd Header, Patient
          SELECT
            'PatientID'          AS c1
          , 'PatientFirstName'   AS c2
          , 'PatientMiddleName'  AS c3
          , 'PatientLastName'    AS c4
          , 'PatientMRN'         AS c5
          , 'PatientAddress1'    AS c6
          , 'PatientAddress2'    AS c7
          , 'PatientCity'        AS c8
          , 'PatientState'       AS c9
          , 'PatientZip'         AS c10
          , 'EncounterDate'      AS c11
          , 'Description'        AS c12
          , 'Code'               AS c13
          , 'EncounterID'        AS c14
          , 'Charge'             AS c15
          , 'Payment'            AS c16
          , 'Adjustments'        AS c17
          , 'Deductible'         AS c18
          , 'CoPay'              AS c19
          , 'CoInsurance'        AS c20
          , 'Current'            AS c21
          , 'Over30'             AS c22
          , 'Over60'             AS c23
          , 'Over90'             AS c24
          , 'Over120'            AS c25
          , 'BillingMessage'     AS c26
          , 'ValidFrom'          AS c27
          , 'Coverage'           AS c28
          , 'Policy#'            AS c29
          , 'Group#'             AS c30
          , 'Company Name'       AS c31
          , -1                   AS pid
          , -1                   AS enc_id
          , null::date           AS enc_date
          , -1                   AS row_flag
          , -1                   AS sort_order
          , -1                   AS statement_flag
          , ''                   AS charge_id
          , null                 AS c32
          UNION
          -- Coverage Info

        SELECT
           null
          ,null
          ,null
          ,null
          ,null
          ,null
          ,null
          ,null
          ,null
          , null
          , null
          , null
          , null
          , null
          , null
          , null
          , null
          , null
          , null
          , null
          , null
          , null
          , null
          , null
          , null
          , null
          , valid_to_date
          , cov_level
          , policy_no
          , group_no
          , company_name
          , null

      , 0
      , null
      , 0
      , 0                              AS sort_order
      , 0
      , null
      , null
      FROM patient_insurance

      UNION
         -- Statement Amount
              SELECT
                null
              , null
              , null
              , null
              , null
              , null
              , null
              , null
              , null
              , null
              , null
              , null
              , null
              , null
              , null
              , null
              , coalesce(statement_total_amount::text, '0.00')
              , null
              , null
              , null
              , null
              , null
              , null
              , null
              , null
              , null
              , null
              , null
              , null
              , null
              , null
              , pid
              , 0
              , null
              , 0
              , 0                              AS sort_order
              , 1
              , null
              , null
              FROM sum_statement_credit_cte
              UNION


              -- Patient Info
              SELECT
                null
              , null
              , null
              , null
              , null
              , null
              , null
              , null
              , to_char('2018-04-12'::date, 'MM/DD/YYYY')
              , full_name
              , account_no
              , address1
              , address2
              , city
              , state
              , zip
              , null
              , null
              , null
              , null
              , null
              , null
              , null
              , null
              , null
              , null
              , null
              , null
              , null
              , null
              , null
              , pid
              , 0
              , null
              , 0
              , 0                              AS sort_order
              , 2
              , null
              , null
              FROM detail_cte
              UNION


          -- Details
          SELECT
            pid::text
          , first_name
          , middle_name
          , last_name
          , account_no
          , address1
          , address2
          , city
          , state
          , zip
          , to_char(enc_date ,'MM/DD/YYYY') AS enc_date
          , description
          , code
          , enc_id::text
          , charge::text
          , payment::text
          , adjustment::text
          , null
          , null
          , null
          , null
          , null
          , null
          , null
          , null
          , null
          , null
          , null
          , null
          , null
          , null
          , pid
          , enc_id
          , to_char(enc_date ,'MM/DD/YYYY')::date AS enc_date
          , row_flag
          , sort_order
          , null
          , charge_id::text
          , null
          FROM detail_cte
          UNION

          -- Encounter Total, sum per pid and enc_id, both should be in select
          SELECT
            pid::text
          , null
          , null
          , null
          , null
          , null
          , null
          , null
          , null
          , null
          , null
          , null
          , null
          , null
          , null
          , 'Encounter Total'
          , coalesce(enc_total_amount::text,'0.00')
          , null
          , null
          , null
          , null
          , null
          , null
          , null
          , null
          , null
          , null
          , null
          , null
          , null
          , null
          , pid
          , enc_id
          , null
          , 5
          , 98   AS sort_order
          , null
          , null
          , null
          FROM sum_encounter_cte
          UNION

          -- Statement Totals, 30, 60, 90, 120, Balance
          SELECT
            null
          , null
          , null
          , null
          , null
          , null
          , null
          , null
          , null
          , null
          , null
          , null
          , null
          , null
          , null
          , 'Total'
          , coalesce(statement_total_amount::text, '0.00')
          , null
          , null
          , null
          , coalesce(current_amount::text, '0.00')
          , coalesce(over30_amount::text, '0.00')
          , coalesce(over60_amount::text, '0.00')
          , coalesce(over90_amount::text, '0.00')
          , coalesce(over120_amount::text, '0.00')
          , billing_msg
          , null
          , null
          , null
          , null
          , null
          , pid
          , null
          , null
          , 6
          , 99   AS sort_order
          , 0
          , null
          , null
          FROM statement_cte

          UNION

              SELECT
                null
              , null
              , null
              , null
              , null
              , null
              , null
              , null
              , null
              , null
              , null
              , null
              , null
              , null
              , null
              , null
              , null
              , null
              , null
              , null
              , null
              , null
              , null
              , null
              , null
              , billing_msg
              , null
              , null
              , null
              , null
              , null
              , pid
              , null
              , null
              , 6
              , 99   AS sort_order
              , 2
              , null
              , null
              FROM statement_cte

        UNION
        -- Billing Provider Information based on claim Id

              SELECT
                null
              , null
              , null
              , null
              , null
              , null
              , null
              , null
              , null
              , null
              , null
              , null
              , null
              , null
              , null
              , null
              , null
              , null
              , null
              , null
              , null
              , null
              , null
              , null
              , null
              , null
              , null
              , null
              , null
              , null
              , null
              , null
              , 0
              , null
              , 6
              , 99   AS sort_order
              , 2
              , null
              , billing_provider_name
              FROM
                billing_provider_cte
          )

          -- Main Query, added rowFlag and encounterAmount for HTML and PDF
          SELECT
            CASE
            WHEN row_flag = 5 THEN null
            ELSE c1
            END
          , c2
          , c3
          , c4
          , c5
          , c6
          , c7
          , c8
          , c9
          , c10
          , c11
          , c12
          , c13
          , c14
          , c15
          , c16
          , c17
          , c18
          , c19
          , c20
          , c21
          , c22
          , c23
          , c24
          , c25
          , c26
          , c27
          , c28
          , c29
          , c30
          , c31
          , row_flag
          , CASE row_flag WHEN 1 THEN c15 WHEN 2 THEN c16 WHEN 3 THEN c17 ELSE '' END AS enc_amount
          ,  CASE  WHEN c28 IS NOT NULL then 12 else statement_flag end as statement_flag
          , c32
          FROM all_cte
          ORDER BY
            pid
          , enc_id
          , sort_order
          , enc_date
          , row_flag
          , statement_flag
          , charge_id
          , c13
          , c28;

`);

const api = {
    getReportData: (initialReportData) => {
        if (initialReportData.report.params.patientOption) {
            initialReportData.report.params.patientOption = initialReportData.report.params.patientOption === 'S' && initialReportData.report.params.patientIds === undefined ? 'All' : initialReportData.report.params.patientOption;
        }

        // convert patientIds array of string to integer
        if (initialReportData.report.params.patientIds) {
            initialReportData.report.params.patientIds = initialReportData.report.params.patientIds.map(Number);
        }

        // if (initialReportData.report.params.billingProvider) {
        //     initialReportData.report.params.billingProviderIds = initialReportData.report.params.billingProvider === 'All' ? [] : initialReportData.report.params.billingProvider.split().map(Number);
        // }


        if (initialReportData.report.params.payToProvider && initialReportData.report.params.payToProvider !== undefined) {
            initialReportData.report.params.payToProvider = initialReportData.report.params.payToProvider === 'true';
        } else {
            initialReportData.report.params.payToProvider = false;
        }

        return Promise.join(
            api.createpatientStatementDataSet(initialReportData.report.params),
            dataHelper.getBillingProviderInfo(initialReportData.report.params.companyId, initialReportData.report.params.billingProvider),
            dataHelper.getPatientInfo(initialReportData.report.params.companyId, initialReportData.report.params.patientIds),
            // other data sets could be added here...
            (patientStatementDataSet, providerInfo, patientInfo) => {
                // add report filters
                initialReportData.filters = api.createReportFilters(initialReportData);
                initialReportData.lookups.billingProviderInfo = providerInfo || [];
                initialReportData.lookups.patients = patientInfo || [];

                // add report specific data sets
                initialReportData.dataSets.push(patientStatementDataSet);
                initialReportData.dataSetCount = initialReportData.dataSets.length;
                return initialReportData;
            });
    },

    transformReportData: (rawReportData) => {
        return Promise.resolve(rawReportData);
    },

    getJsReportOptions: (reportParams, reportDefinition) => {
        return reportDefinition.jsreport[reportParams.reportFormat];
    },

    createReportFilters: (initialReportData) => {
        const lookups = initialReportData.lookups;
        const params = initialReportData.report.params;
        const filtersUsed = [];
        filtersUsed.push({ name: 'company', label: 'Company', value: lookups.company.name });


        // Facility Filter
        if (params.allFacilities && params.facilityIds)
            filtersUsed.push({ name: 'facilities', label: 'Facilities', value: 'All' });
        else {
            const facilityNames = _(lookups.facilities).filter(f => params.facilityIds && params.facilityIds.map(Number).indexOf(parseInt(f.id, 10)) > -1).map(f => f.name).value();
            filtersUsed.push({ name: 'facilities', label: 'Facilities', value: facilityNames });
        }


        filtersUsed.push({ name: 'sDate', label: 'Statement Date', value: params.sDate });

        const patientNames = params.patientOption === 'All' ? 'All' : _(lookups.patients).map(f => f.name).value();
        filtersUsed.push({ name: 'patientNames', label: 'Patients', value: patientNames });

        filtersUsed.push({ name: 'payToProvider', label: 'Use address of Pay-To Provider', value: params.payToProvider ? 'Yes' : 'No' })


        filtersUsed.push({ name: 'fromDate', label: 'Date From', value: params.fromDate });
        filtersUsed.push({ name: 'toDate', label: 'Date To', value: params.toDate });
        return filtersUsed;
    },

    // ================================================================================================================
    // --- DATA SET - patientStatement count

    createpatientStatementDataSet: (reportParams) => {
        // 1 - build the query context. Each report will 'know' how to do this, based on report params and query/queries to be executed...
        const queryContext = api.getpatientStatementDataSetQueryContext(reportParams);
        console.log('context__', queryContext)
        // 2 - geenrate query to execute
        const query = patientStatementDataSetQueryTemplate(queryContext.templateData);
        // 3a - get the report data and return a promise
        return db.queryForReportData(query, queryContext.queryParams);
    },

    // query context is all about query building: 1 - query parameters and 2 - query template data
    // every report and/or query may have a different logic to build a query context...
    getpatientStatementDataSetQueryContext: (reportParams) => {
        const params = [];
        const filters = {
            companyId: null,
            patientIds: null,
            billingProviderIds: null,
            reportBy: null,
            claimDate: null,
            commentDate: null,
            chargeDate: null,
            accountDate: null,
            patientInsIds: null,
            billingComments: null,
            claimId: null
        };

        // company id
        params.push(reportParams.companyId);
        filters.companyId = queryBuilder.where('company_id', '=', [params.length]);

        params.push(reportParams.patientIID);
        filters.patientIds = queryBuilder.where('bc.patient_id', '=', [params.length]);
        filters.patientInsIds = queryBuilder.where('pis.patient_id', '=', [params.length]);


        // params.push(reportParams.sDate);
        // filters.sDate = `$${params.length}::date`;

        //  claim date
        if (reportParams.reportBy == "true") {
            params.push(reportParams.sDate);
            filters.sDate = `$${params.length}::date`;
        }
        else {
            params.push(reportParams.sDate);
            filters.sDate = `$${params.length}::date`;
            params.push(reportParams.fromDate);
            params.push(reportParams.toDate);
            filters.claimDate = queryBuilder.whereDateBetween('bc.claim_dt', [params.length - 1, params.length], 'f.time_zone');
            filters.commentDate = queryBuilder.whereDateBetween('cc.created_dt', [params.length - 1, params.length], 'f.time_zone');
            filters.chargeDate = queryBuilder.whereDateBetween('c.charge_dt', [params.length - 1, params.length], 'f.time_zone');
            filters.accountDate = queryBuilder.whereDateBetween('bp.accounting_date', [params.length - 1, params.length]);
        }

        filters.billingComments = reportParams.billingComments;

        // billingProvider single or multiple
        if (reportParams.billingProviderIds && reportParams.billingProviderIds.length > 0 && reportParams.billingProviderIds[0] != "0") {
            params.push(reportParams.billingProviderIds);
            filters.billingProviderIds = queryBuilder.whereIn(`bp.id`, [params.length]);
        }

        filters.reportBy =  reportParams.reportBy;

        filters.claimId = reportParams.claimId;

        return {
            queryParams: params,
            templateData: filters
        }
    }
}

module.exports = api;
