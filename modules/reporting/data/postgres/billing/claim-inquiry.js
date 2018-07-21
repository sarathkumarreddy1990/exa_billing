const _ = require('lodash')
    , Promise = require('bluebird')
    , db = require('../db')
    , dataHelper = require('../dataHelper')
    , queryBuilder = require('../queryBuilder')
    , logger = require('../../../../../logger');

// generate query template ***only once*** !!!

const claimInquiryDataSetQueryTemplate = _.template(`
WITH claim_data as (
    SELECT 
       bc.id as claim_id,
       p.full_name as patient_name,
       p.account_no,
       COALESCE(p.patient_info->'ssn','') AS ssn,
       COALESCE(to_char(p.birth_date,'MM/DD/YYYY'),'') AS dob,
       COALESCE(p.patient_info->'c1HomePhone','') AS phone,
       claim_totals.claim_balance_total,
       bc.payer_type,
       NULLIF(ip.insurance_name,'')  AS insurance_name,
       NULLIF(ip.insurance_code,'')  AS insurance_code,
       NULLIF(ip.insurance_info->'Address1','')  AS address1,
       NULLIF(ip.insurance_info->'Address2','')  AS address2,
       NULLIF(ip.insurance_info->'City','') AS city,
       NULLIF(ip.insurance_info->'State','')  AS state,
       NULLIF(ip.insurance_info->'ZipCode','')  AS zip,
       NULLIF(ip.insurance_info->'ZipPlus','')  AS zip_plus,
       NULLIF(ip.insurance_info->'PhoneNo','')  AS phone_no,
       NULLIF(ip.insurance_info->'FaxNo','')  AS fax_no,
       bc.claim_dt,
       CASE
         WHEN bc.payer_type = 'primary_insurance' THEN ip.insurance_name
         WHEN bc.payer_type = 'secondary_insurance'  THEN ip.insurance_name
         WHEN bc.payer_type = 'tertiary_insurance' THEN ip.insurance_name
         WHEN bc.payer_type = 'patient'  THEN p.full_name
         WHEN bc.payer_type = 'ordering_facility' THEN f.facility_name
         WHEN bc.payer_type = 'referring_provider' THEN null
         ELSE  NULL
       END AS carrier,
       json_build_object('coverage_level',pi.coverage_level,'insurance_name',ip.insurance_name,'expire_date',pi.valid_to_date,'PolicyNo',pi.policy_number, 'GroupNo',pi.group_number),
       bp.name,
       (SELECT 
            claim_balance_total 
        FROM 
            billing.get_claim_totals(bc.id)) AS claim_balance
    FROM 
        billing.claims bc
    INNER JOIN LATERAL billing.get_claim_totals(bc.id) AS claim_totals ON TRUE
    INNER JOIN public.patients p on p.id = bc.patient_id
    INNER JOIN public.facilities f on f.id = bc.facility_id
    INNER JOIN billing.providers bp on bp.id = bc.billing_provider_id
    LEFT JOIN public.patient_insurances pi on pi.id = (
                                                CASE WHEN  bc.payer_type = 'primary_insurance' THEN
                                                   primary_patient_insurance_id
                                                WHEN  bc.payer_type = 'secondary_insurance' THEN
                                                   secondary_patient_insurance_id
                                                WHEN  bc.payer_type = 'tertiary_insurance' THEN
                                                   tertiary_patient_insurance_id
                                                END
                                            )
    LEFT JOIN public.insurance_providers ip on ip.id = pi.insurance_provider_id
    WHERE 1=1
    AND  <%= companyId %>
     ORDER BY p.full_name,p.account_no ASC)    
    SELECT
         *
    FROM
         claim_data LIMIT 1000
`);

const claimInquiryDataSetQueryTemplate1 = _.template(`
with claim_data_comments as (
    SELECT 
    bc.id as claim_id,
    p.full_name as patient_name,
    p.account_no,
    COALESCE(p.patient_info->'ssn','') AS ssn,
    COALESCE(to_char(p.birth_date,'MM/DD/YYYY'),'') AS dob,
    COALESCE(p.patient_info->'c1HomePhone','') AS phone,
    claim_totals.claim_balance_total,
    bc.payer_type,
    NULLIF(ip.insurance_name,'')  AS insurance_name,
    NULLIF(ip.insurance_code,'')  AS insurance_code,
    NULLIF(ip.insurance_info->'Address1','')  AS address1,
    NULLIF(ip.insurance_info->'Address2','')  AS address2,
    NULLIF(ip.insurance_info->'City','') AS city,
    NULLIF(ip.insurance_info->'State','')  AS state,
    NULLIF(ip.insurance_info->'ZipCode','')  AS zip,
    NULLIF(ip.insurance_info->'ZipPlus','')  AS zip_plus,
    NULLIF(ip.insurance_info->'PhoneNo','')  AS phone_no,
    NULLIF(ip.insurance_info->'FaxNo','')  AS fax_no,
    bc.claim_dt,
    CASE
      WHEN bc.payer_type = 'primary_insurance' THEN ip.insurance_name
      WHEN bc.payer_type = 'secondary_insurance'  THEN ip.insurance_name
      WHEN bc.payer_type = 'tertiary_insurance' THEN ip.insurance_name
      WHEN bc.payer_type = 'patient'  THEN p.full_name
      WHEN bc.payer_type = 'ordering_facility' THEN f.facility_name
      WHEN bc.payer_type = 'referring_provider' THEN null
      ELSE  NULL
    END AS carrier,
    json_build_object('coverage_level',pi.coverage_level,'insurance_name',ip.insurance_name,'expire_date',pi.valid_to_date,'PolicyNo',pi.policy_number, 'GroupNo',pi.group_number),
    bp.name,
    (SELECT 
         claim_balance_total 
     FROM 
         billing.get_claim_totals(bc.id)) AS claim_balance
 FROM 
     billing.claims bc
 INNER JOIN LATERAL billing.get_claim_totals(bc.id) AS claim_totals ON TRUE
 INNER JOIN public.patients p on p.id = bc.patient_id
 INNER JOIN public.facilities f on f.id = bc.facility_id
 INNER JOIN billing.providers bp on bp.id = bc.billing_provider_id
 LEFT JOIN public.patient_insurances pi on pi.id = (
                                             CASE WHEN  bc.payer_type = 'primary_insurance' THEN
                                                primary_patient_insurance_id
                                             WHEN  bc.payer_type = 'secondary_insurance' THEN
                                                secondary_patient_insurance_id
                                             WHEN  bc.payer_type = 'tertiary_insurance' THEN
                                                tertiary_patient_insurance_id
                                             END
                                         )
 LEFT JOIN public.insurance_providers ip on ip.id = pi.insurance_provider_id
 WHERE 1=1
 AND  <%= companyId %>
  ORDER BY p.full_name,p.account_no ASC),  
  
  billing_comments as 
    (
    SELECT 
             cc.claim_id AS id
            ,'claim' AS type 
            , note   AS comments 
            , created_dt::date AS commented_dt
            , null AS charges
            , u.username AS commented_by
            , null::money AS adjustment_amount 
            , null::money AS payment_amount
            , null::bigint AS payment_id 
            , null AS cpt_codes  
    FROM
          billing.claim_comments cc
    INNER JOIN claim_data_comments cd on cd.claim_id = cc.claim_id
    INNER join users u  on u.id = cc.created_by 
    UNION ALL
    SELECT
            c.claim_id AS id
          , 'charge' AS type
          , cc.short_description AS comments
          , c.charge_dt::date AS commented_dt
          , (c.bill_fee*c.units) AS amount
          , u.username AS commented_by
          , null::money AS adjustment_amount
          , null::money AS payment_amount
          , null::bigint AS payment_id
          , cc.display_code as cpt_codes 
    FROM
         billing.charges c
    INNER JOIN claim_data_comments cd on cd.claim_id = c.claim_id
    INNER JOIN cpt_codes cc on cc.id = c.cpt_id 
    INNER JOIN users u  on u.id = c.created_by
    UNION ALL
    SELECT
            bc.claim_id AS id
          , amount_type AS type,
            CASE 
                WHEN bp.payer_type = 'patient' THEN
                    pp.full_name
                WHEN bp.payer_type = 'insurance' THEN
                    pip.insurance_name
                WHEN bp.payer_type = 'ordering_facility' THEN
                    pg.group_name
                WHEN bp.payer_type = 'ordering_provider' THEN
                    p.full_name
                END     AS comments,
            bp.accounting_dt::date as commented_dt,
            pa.amount as amount,
            u.username as commented_by,
            (bp.amount) AS total_payment, 
            (SELECT adjustments_applied_total FROM billing.get_payment_totals(bp.id)) AS adjustments,
            bp.id as payment_id,
            null      
    FROM 
                billing.payments bp
    INNER JOIN billing.payment_applications pa on pa.payment_id = bp.id
    INNER JOIN billing.charges bc on bc.id = pa.charge_id 
    INNER JOIN claim_data_comments cd on cd.claim_id = bc.claim_id
    INNER JOIN users u  on u.id = bp.created_by
    LEFT JOIN public.patients pp on pp.id = bp.patient_id
    LEFT JOIN public.insurance_providers pip on pip.id = bp.insurance_provider_id
    LEFT JOIN public.provider_groups  pg on pg.id = bp.provider_group_id
    LEFT JOIN public.provider_contacts  pc on pc.id = bp.provider_contact_id
    LEFT JOIN public.providers p on p.id = pc.provider_id
    )
    SELECT 
        *
    FROM
       billing_comments
`);

const api = {

    /**
     * STAGE 2
     * This method is called by controller pipline after report data is initialized (common lookups are available).
     */
    getReportData: (initialReportData) => {
        return Promise.join(
            api.createclaimInquiryDataSet(initialReportData.report.params),
            api.createclaimInquiryDataSet1(initialReportData.report.params),
            // other data sets could be added here...
            (claimInquiryDataSet, claimInquiryDataSet1) => {
                // add report filters                
                initialReportData.filters = api.createReportFilters(initialReportData);
                for (i = 0; i < claimInquiryDataSet.rows.length; i++) {
                    var comments = [];
                    for (j = 0; j < claimInquiryDataSet1.rows.length; j++) {
                        if (claimInquiryDataSet1.rows[j][0] === claimInquiryDataSet.rows[i][0]) {
                            comments.push(claimInquiryDataSet1.rows[j]);
                        }
                    }
                    claimInquiryDataSet.rows[i].push(comments);

                }
                // add report specific data sets
                initialReportData.dataSets.push(claimInquiryDataSet);
                initialReportData.dataSetCount = initialReportData.dataSets.length;
                return initialReportData;
            });
    },

    /**
     * STAGE 3
     * This method is called by controller pipeline after getReportData().
     * All data sets will be avaliable and can be used for any complex, interdependent data set manipulations.
     * Note:
     *  If no transformations are to take place just return resolved promise => return Promise.resolve(rawReportData);
     */
    transformReportData: (rawReportData) => {
        return Promise.resolve(rawReportData);
    },

    /**
     * Report specific jsreport options, which will be merged with default ones in the controller.
     * Allows each report to add its own, or override default settings.
     * Note:
     *  You must at least set a template (based on format)!
     */
    getJsReportOptions: (reportParams, reportDefinition) => {
        // here you could dynamically modify jsreport options *per report*....
        // if options defined in report definition are all that is needed, then just select them based on report format
        return reportDefinition.jsreport[reportParams.reportFormat];
    },

    // ================================================================================================================
    // PRIVATE ;) functions

    createReportFilters: (initialReportData) => {
        const lookups = initialReportData.lookups;
        const params = initialReportData.report.params;
        const filtersUsed = [];
        filtersUsed.push({ name: 'company', label: 'Company', value: lookups.company.name });

        // if (params.allFacilities && (params.facilityIds && params.facilityIds.length < 0))
        //     filtersUsed.push({ name: 'facilities', label: 'Facilities', value: 'All' });
        // else {
        //     const facilityNames = _(lookups.facilities).filter(f => params.facilityIds && params.facilityIds.indexOf(f.id) > -1).map(f => f.name).value();
        //     filtersUsed.push({ name: 'facilities', label: 'Facilities', value: facilityNames });
        // }
        // // Billing provider Filter
        // if (params.allBillingProvider == 'true')
        //     filtersUsed.push({ name: 'billingProviderInfo', label: 'Billing Provider', value: 'All' });
        // else {
        //     const billingProviderInfo = _(lookups.billingProviderInfo).map(f => f.name).value();
        //     filtersUsed.push({ name: 'billingProviderInfo', label: 'Billing Provider', value: billingProviderInfo });
        // }

        // filtersUsed.push({ name: 'fromDate', label: 'Date From', value: params.fromDate });
        // filtersUsed.push({ name: 'toDate', label: 'Date To', value: params.toDate });
        return filtersUsed;
    },

    // ================================================================================================================
    // --- DATA SET - claimInquiry count

    createclaimInquiryDataSet: (reportParams) => {
        // 1 - build the query context. Each report will 'know' how to do this, based on report params and query/queries to be executed...
        const queryContext = api.getclaimInquiryDataSetQueryContext(reportParams);
        console.log('context__', queryContext)
        // 2 - geenrate query to execute
        const query = claimInquiryDataSetQueryTemplate(queryContext.templateData);
        // 3a - get the report data and return a promise
        return db.queryForReportData(query, queryContext.queryParams);
    },

    createclaimInquiryDataSet1: (reportParams) => {
        // 1 - build the query context. Each report will 'know' how to do this, based on report params and query/queries to be executed...
        const queryContext = api.getclaimInquiryDataSetQueryContext(reportParams);
        console.log('context__', queryContext)
        // 2 - geenrate query to execute
        const query = claimInquiryDataSetQueryTemplate1(queryContext.templateData);
        // 3a - get the report data and return a promise
        return db.queryForReportData(query, queryContext.queryParams);
    },

    // query context is all about query building: 1 - query parameters and 2 - query template data
    // every report and/or query may have a different logic to build a query context...
    getclaimInquiryDataSetQueryContext: (reportParams) => {
        const params = [];
        const filters = {
            companyId: null

        };

        // company id
        params.push(reportParams.companyId);
        filters.companyId = queryBuilder.where('bc.company_id', '=', [params.length]);

        // // order facilities
        // if (!reportParams.allFacilities && reportParams.facilityIds) {
        //     params.push(reportParams.facilityIds);
        //     filters.facilityIds = queryBuilder.whereIn('c.facility_id', [params.length]);
        // }

        // //  scheduled_dt
        // if (reportParams.fromDate === reportParams.toDate) {
        //     params.push(reportParams.fromDate);
        //     filters.studyDate = queryBuilder.whereDate('c.claim_dt', '=', [params.length], 'f.time_zone');
        // } else {
        //     params.push(reportParams.fromDate);
        //     params.push(reportParams.toDate);
        //     filters.studyDate = queryBuilder.whereDateBetween('c.claim_dt', [params.length - 1, params.length], 'f.time_zone');
        // }
        // // billingProvider single or multiple
        // if (reportParams.billingProvider) {
        //     params.push(reportParams.billingProvider);
        //     filters.billingProID = queryBuilder.whereIn('bp.id', [params.length]);
        // }

        return {
            queryParams: params,
            templateData: filters
        }
    }
}

module.exports = api;
