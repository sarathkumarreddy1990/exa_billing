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
       id as claim_id 
    FROM billing.claims 
    WHERE 1=1 
    and payer_type = 'patient'
    ),
     billing_comments as 
    (
    select cc.claim_id as id,'claim' as type ,note as comments ,created_dt::date as commented_dt,null as amount,u.username as commented_by,null as code from  billing.claim_comments cc
    INNER JOIN claim_data cd on cd.claim_id = cc.claim_id
    inner join users u  on u.id = cc.created_by
    where cc.type in ('co_pay','co_insurance','deductible') 
    UNION ALL
    select  c.claim_id as id,'charge' as type,cc.short_description as comments,c.charge_dt::date as commented_dt,(c.bill_fee*c.units) as amount,u.username as commented_by,cc.display_code as code from billing.charges c
    INNER JOIN claim_data cd on cd.claim_id = c.claim_id
    inner join cpt_codes cc on cc.id = c.cpt_id 
    inner join users u  on u.id = c.created_by
    UNION ALL
    select  bc.claim_id as id,amount_type as type,
    CASE WHEN bp.payer_type = 'patient' THEN
               pp.full_name
         WHEN bp.payer_type = 'insurance' THEN
               pip.insurance_name
         WHEN bp.payer_type = 'ordering_facility' THEN
               pg.group_name
         WHEN bp.payer_type = 'ordering_provider' THEN
               p.full_name
    END as comments,
    bp.accounting_dt::date as commented_dt,
    pa.amount as amount,
    u.username as commented_by,
    CASE amount_type 
         WHEN 'adjustment' THEN 'Adj'
         WHEN 'payment' THEN (CASE bp.payer_type  
                             WHEN 'patient' THEN 'Patient'
                             WHEN 'insurance' THEN 'Insurance'
                             WHEN 'ordering_facility' THEN 'Ordering facility'
                             WHEN 'ordering_provider' THEN 'Provider'
                             END)
    END as code
    from billing.payments bp
    inner join billing.payment_applications pa on pa.payment_id = bp.id
    inner join billing.charges bc on bc.id = pa.charge_id 
    INNER JOIN claim_data cd on cd.claim_id = bc.claim_id
    inner join users u  on u.id = bp.created_by
    LEFT JOIN public.patients pp on pp.id = bp.patient_id
    LEFT JOIN public.insurance_providers pip on pip.id = bp.insurance_provider_id
    LEFT JOIN public.provider_groups  pg on pg.id = bp.provider_group_id
    LEFT JOIN public.provider_contacts  pc on pc.id = bp.provider_contact_id
    LEFT JOIN public.providers p on p.id = pc.provider_id
    WHERE 1=1 
    AND  <%= companyId %>
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
        to_char(commented_dt, 'MM/DD/YYYY') as enc_date,
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
        <% if (payToProvider == 'false') {%>
        bp.name as billing_provider_name,
        bp.pay_to_address_line1 as billing_proaddress1,
        bp.pay_to_address_line1 as billing_proaddress2,
        bp.pay_to_city as billing_procity,
        bp.pay_to_state as billing_prostate,
        bp.pay_to_zip_code as billing_prozip,
        bp.pay_to_zip_code_plus as billing_zip_plus,
        bp.pay_to_phone_number as billing_phoneno,
        <% } else { %>
            bp.name as billing_provider_name,
        bp.address_line1 as billing_proaddress1,
        bp.address_line2 as billing_proaddress2,
        bp.city as billing_procity,
        bp.state as billing_prostate,
        bp.zip_code as billing_prozip,
        bp.zip_code_plus as billing_zip_plus,
        bp.phone_number as billing_phoneno,
            <% } %>
        type as payment_type,
        CASE type WHEN 'charge' THEN 1 ELSE 2 END AS sort_order
    FROM public.patients p 
         INNER JOIN billing.claims bc on bc.patient_id = p.id
         INNER JOIN billing_comments pc on pc.id = bc.id 
         INNER JOIN billing.providers bp on bp.id = bc.billing_provider_id
         INNER JOIN facilities f on f.id = bc.facility_id
         WHERE 1= 1
           <% if (billingProviderIds) { %>AND <% print(billingProviderIds); } %>
           <% if (facilityIds) { %>AND <% print(facilityIds); } %>
         <% if (patientIds) { %>AND <% print(patientIds); } %>             
         AND <%= whereDate %>             

    order by first_name),
    detail_cte AS(
    select * From main_detail_cte
    where (payment_type != 'adjustment' or (payment_type = 'adjustment' AND amount != 0::money))
    AND sum_amount >=  <%= minAmount  %>::money
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
    billing_messages as (SELECT (select description from billing.messages where company_id = 1 and CODE = '0-30') as msg0to30,
                                (select description from billing.messages where company_id = 1 and CODE = '31-60') as msg31to60,
                                (select description from billing.messages where company_id = 1 and CODE = '61-90') as msg61to90,
                                (select description from billing.messages where company_id = 1 and CODE = '91-120') as msg91to120,
                                (select description from billing.messages where company_id = 1 and CODE = '>120') as msggrater120,
                                (select description from billing.messages where company_id = 1 and CODE = 'collections') as collection
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
          , -1                   AS pid  
          , -1                   AS enc_id
          , null::date           AS enc_date
          , -1                   AS row_flag
          , -1                   AS sort_order
          , -1                   AS statement_flag
          UNION
    
          -- Billing Information
          
              SELECT
                billing_provider_name
              , billing_proaddress1
              , billing_proaddress2
              , billing_procity
              , billing_prostate
              , billing_prozip
              , billing_zip_plus
              , billing_phoneno
              ,  to_char(<%= statementDate %>::date, 'MM/DD/YYYY')
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
              , pid
            
          , 0
          , null
          , 0
          , 0                              AS sort_order
          , 0
          FROM detail_cte
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
              , pid
              , 0
              , null
              , 0
              , 0                              AS sort_order
              , 1
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
              ,  to_char(<%= statementDate %>::date, 'MM/DD/YYYY')
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
              , pid
              , 0
              , null
              , 0
              , 0                              AS sort_order
              , 2
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
          , enc_date::text
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
          , pid
          , enc_id
          , enc_date::date
          , row_flag
          , sort_order
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
          , pid
          , enc_id
          , null
          , 5
          , 98   AS sort_order
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
          , 'Statement Total'
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
          , pid
          , null
          , null
          , 6
          , 99   AS sort_order
          , 0
          FROM statement_cte
    
          UNION 
              SELECT
                billing_provider_name
              , billing_proaddress1
              , billing_proaddress2
              , billing_procity
              , billing_prostate
              , billing_prozip
              , billing_zip_plus
              , billing_phoneno
              , to_char(<%= statementDate %>::date, 'MM/DD/YYYY')
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
              , pid
            
              , null
              , null
              , 6
              , 99   AS sort_order
              , 1
              FROM detail_cte
              
          
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
              , pid
              , null
              , null
              , 6
              , 99   AS sort_order
              , 2
              FROM statement_cte
              
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
          , row_flag
          , CASE row_flag WHEN 1 THEN c15 WHEN 2 THEN c16 WHEN 3 THEN c17 ELSE '' END AS enc_amount
          , statement_flag
          FROM all_cte          
          ORDER BY 
            pid
          , enc_id
          , sort_order
          , enc_date
          , row_flag
          , statement_flag
          , c13;
        
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

        if (initialReportData.report.params.minAmount) {
            initialReportData.report.params.minAmount = parseFloat(initialReportData.report.params.minAmount);
        }

        
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
        if (params.allFacilities && (params.facilityIds && params.facilityIds.length < 0))
            filtersUsed.push({ name: 'facilities', label: 'Facilities', value: 'All' });
        else {
            const facilityNames = _(lookups.facilities).filter(f => params.facilityIds && params.facilityIds.indexOf(f.id) > -1).map(f => f.name).value();
            filtersUsed.push({ name: 'facilities', label: 'Facilities', value: facilityNames });
        }

        // Billing provider Filter
        if (params.allBillingProvider == 'true')
            filtersUsed.push({ name: 'billingProviderInfo', label: 'Billing Provider', value: 'All' });
        else {
            const billingProviderInfo = _(lookups.billingProviderInfo).map(f => f.name).value();
            filtersUsed.push({ name: 'billingProviderInfo', label: 'Billing Provider', value: billingProviderInfo });
        }

        // Min Amount 
        filtersUsed.push({ name: 'minAmount', label: 'Minumum Amount', value: params.minAmount });

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
            facilityIds: null,
            statementDate: null
           
        };

        // company id
        params.push(reportParams.companyId);
        filters.companyId = queryBuilder.where('bc.id', '=', [params.length]);

          // patients
          if (reportParams.patientOption === 'S' && reportParams.patientIds) {
            params.push(reportParams.patientIds);
            filters.patientIds = queryBuilder.whereIn(`p.id`, [params.length]);
          }

          //claim facilities
        if (!reportParams.allFacilities && reportParams.facilityIds) {
            params.push(reportParams.facilityIds);
            filters.facilityIds = queryBuilder.whereIn('bc.facility_id', [params.length]);
        }

           // billing providers
        if (reportParams.billingProviderIds && reportParams.billingProviderIds.length > 0) {
            params.push(reportParams.billingProviderIds);
            filters.billingProviderIds = queryBuilder.whereIn(`bp.id`, [params.length]);
          }

           // Min Amount
        filters.minAmount = reportParams.minAmount || 0;

        params.push(reportParams.sDate);
        filters.sDate = `$${params.length}::date`;
        filters.statementDate = `$${params.length}::date`;
        
        filters.whereDate = queryBuilder.whereDateInTz(`bc.claim_dt`, `<=`, [params.length], `f.time_zone`);   
        filters.payToProvider = reportParams.payToProvider ;

        return {
            queryParams: params,
            templateData: filters         
        }
    }
}

module.exports = api;
