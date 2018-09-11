const _ = require('lodash')
    , Promise = require('bluebird')
    , db = require('../db')
    , dataHelper = require('../dataHelper')
    , queryBuilder = require('../queryBuilder')
    , logger = require('../../../../../logger');

// generate query template ***only once*** !!!

const InsuranceVSLOPDataSetQueryTemplate = _.template(`
WITH study_cte AS (
    SELECT
      bc.id AS claim_id,
      ps.id AS study_id,
      ps.modality_id,
      bc.claim_dt,
      unnest(ARRAY [ bc.primary_patient_insurance_id, bc.secondary_patient_insurance_id, bc.tertiary_patient_insurance_id ]) AS patient_insurance_id
    FROM
      public.studies AS ps
      INNER JOIN billing.charges_studies bcs ON bcs.study_id = ps.id
      INNER JOIN billing.charges bch ON bch.id = bcs.charge_id
      INNER JOIN billing.claims bc ON bc.id = bch.claim_id
      <% if (billingProID) { %> INNER JOIN billing.providers bp ON bp.id = bc.billing_provider_id <% } %>
    WHERE 1=1
    AND NOT ps.has_deleted
    AND ps.accession_no NOT ILIKE '%.c'
      AND  <%= companyId %>
      AND <%= claimDate %>
      <% if (facilityIds) { %>AND <% print(facilityIds); } %>
      <% if(billingProID) { %> AND <% print(billingProID); } %>
  ),
  insurance_flag_cte AS (
    SELECT
      s.study_id, s.modality_id, s.claim_dt, -- this will be selected AS max
      CASE WHEN s.patient_insurance_id IS NULL THEN - 1 -- no insurance is assigned, counted as not_assigned
      WHEN pippt.code IS NULL THEN 0 -- none of the insurance assigned has provider type, counted as other
      WHEN pippt.code != 'PI' THEN 1 -- none of the insurance is PI, but one is other than PI, counted as insurance
      WHEN pippt.code = 'PI' THEN 2 -- one of the insurance is PI, counted as lop
      END AS flag
    FROM
      study_cte AS s
    LEFT JOIN public.patient_insurances ppi ON s.patient_insurance_id = ppi.id
    LEFT JOIN public.insurance_providers pip ON pip.id = ppi.insurance_provider_id
    LEFT JOIN public.insurance_provider_payer_types pippt ON pippt.id = pip.provider_payer_type_id)
  ,insurance_cte AS (
    SELECT
      study_id,
      modality_id,
      claim_dt,
      max(flag) AS flag
    FROM
      insurance_flag_cte
    GROUP BY
      study_id, modality_id, claim_dt
  )
  , count_cte AS (
      SELECT
        modality_id,
        claim_dt,
        count(*) FILTER ( WHERE flag = 2) AS lop_count,
        count(*) FILTER ( WHERE flag = 1) AS insurance_count,
        count(*) FILTER ( WHERE flag = 0) AS other_count,
        count(*) FILTER ( WHERE flag = - 1) AS not_assigned_count
      FROM
        insurance_cte
      GROUP BY
        modality_id, claim_dt
  )
  , modality_sum_cte AS (
        SELECT
          modality_id, sum(lop_count) AS lop_sum, sum(insurance_count) AS insurance_sum, sum(other_count) AS other_sum, sum(not_assigned_count) AS not_assigned_sum
        FROM
          count_cte
        GROUP BY
          modality_id)
  , grand_sum_cte AS (
          SELECT
            sum(lop_count) AS lop_sum,
            sum(insurance_count) AS insurance_sum,
            sum(other_count) AS other_sum,
            sum(not_assigned_count) AS not_assigned_sum
          FROM
            count_cte)
  , union_cte AS (
            SELECT
              coalesce(m.modality_code, 'N/A') AS modality_code,
              NULL AS claim_dt,
              insurance_sum AS insurance,
              lop_sum AS lop,
              other_sum AS other,
              not_assigned_sum AS not_assigned,
              insurance_sum + lop_sum + other_sum + not_assigned_sum AS total,
              NULL::DATE AS sort_calim_date
            FROM
              modality_sum_cte AS c
            LEFT JOIN modalities AS m ON c.modality_id = m.id
        UNION
        SELECT
          NULL AS modality_code,
          NULL AS claim_dt,
          insurance_sum AS insurance,
          lop_sum AS lop,
          other_sum AS other,
          not_assigned_sum AS not_assigned,
          insurance_sum + lop_sum + other_sum + not_assigned_sum AS total,
          NULL::DATE AS sort_calim_date
        FROM
          grand_sum_cte
        UNION
        SELECT
          coalesce(m.modality_code, 'N/A') AS modality_code,
          to_char(c.claim_dt, 'MM/DD/YYYY') AS claim_dt,
          coalesce(c.insurance_count, 0) AS insurance,
          coalesce(c.lop_count, 0) AS lop,
          coalesce(c.other_count, 0) AS other,
          coalesce(c.not_assigned_count, 0) AS not_assigned,
          coalesce(c.insurance_count, 0) + coalesce(c.lop_count, 0) + coalesce(c.other_count, 0) + coalesce(c.not_assigned_count, 0) AS total,
          c.claim_dt AS sort_calim_date
        FROM
          count_cte AS c
        LEFT JOIN modalities AS m ON c.modality_id = m.id
  )
    SELECT
      CASE WHEN claim_dt IS NULL THEN NULL
       ELSE modality_code
      END AS "Modality",
      CASE WHEN modality_code IS NOT NULL AND claim_dt IS NULL THEN 'Modality Totals'
           WHEN modality_code IS NULL AND claim_dt IS NULL THEN 'Grand Total'
           ELSE claim_dt
      END AS "Date",
      insurance AS "Insurance",
      lop AS "LOP",
      other AS "Other",
      not_assigned AS "Not Assigned",
      total AS "Total"
   FROM union_cte
   ORDER BY
         modality_code
       , sort_calim_date
`);

const api = {

    /**
     * STAGE 2
     * This method is called by controller pipline after report data is initialized (common lookups are available).
     */
    getReportData: (initialReportData) => {
        return Promise.join(
            api.createInsuranceVSLOPDataSet(initialReportData.report.params),
            dataHelper.getBillingProviderInfo(initialReportData.report.params.companyId, initialReportData.report.params.billingProvider),
            // other data sets could be added here...
            (InsuranceVSLOPDataSet, providerInfo) => {
                // add report filters
                initialReportData.lookups.billingProviderInfo = providerInfo || [];
                initialReportData.filters = api.createReportFilters(initialReportData);

                // add report specific data sets
                initialReportData.dataSets.push(InsuranceVSLOPDataSet);
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

        filtersUsed.push({ name: 'fromDate', label: 'Date From', value: params.fromDate });
        filtersUsed.push({ name: 'toDate', label: 'Date To', value: params.toDate });

        if (params.allFacilities && params.facilityIds)
            filtersUsed.push({ name: 'facilities', label: 'Facilities', value: 'All' });
        else {
            const facilityNames = _(lookups.facilities).filter(f => params.facilityIds && params.facilityIds.map(Number).indexOf(parseInt(f.id, 10)) > -1).map(f => f.name).value();
            filtersUsed.push({ name: 'facilities', label: 'Facilities', value: facilityNames });
        }

        // Billing provider Filter
        if (params.allBillingProvider == 'true')
            filtersUsed.push({ name: 'billingProviderInfo', label: 'Billing Provider', value: 'All' });
        else {
            const billingProviderInfo = _(lookups.billingProviderInfo).map(f => f.name).value();
            filtersUsed.push({ name: 'billingProviderInfo', label: 'Billing Provider', value: billingProviderInfo });
        }
        return filtersUsed;
    },

    // ================================================================================================================
    // --- DATA SET - InsuranceVSLOP count

    createInsuranceVSLOPDataSet: (reportParams) => {
        // 1 - build the query context. Each report will 'know' how to do this, based on report params and query/queries to be executed...
        const queryContext = api.getInsuranceVSLOPDataSetQueryContext(reportParams);
        console.log('context__', queryContext)
        // 2 - geenrate query to execute
        const query = InsuranceVSLOPDataSetQueryTemplate(queryContext.templateData);
        // 3a - get the report data and return a promise
        return db.queryForReportData(query, queryContext.queryParams);
    },

    // query context is all about query building: 1 - query parameters and 2 - query template data
    // every report and/or query may have a different logic to build a query context...
    getInsuranceVSLOPDataSetQueryContext: (reportParams) => {
        const params = [];
        const filters = {
            companyId: null,
            claimDate: null,
            facilityIds: null,
            billingProID: null
        };

        // company id
        params.push(reportParams.companyId);
        filters.companyId = queryBuilder.where('bc.company_id', '=', [params.length]);

        //  claim_date
        if (reportParams.fromDate === reportParams.toDate) {
            params.push(reportParams.fromDate);
            filters.claimDate = queryBuilder.whereDate('bc.claim_dt', '=', [params.length], 'f.time_zone');
        } else {
            params.push(reportParams.fromDate);
            params.push(reportParams.toDate);
            filters.claimDate = queryBuilder.whereDateBetween('bc.claim_dt', [params.length - 1, params.length], 'f.time_zone');
        }

        //claim facilities
        if (!reportParams.allFacilities && reportParams.facilityIds) {
            params.push(reportParams.facilityIds);
            filters.facilityIds = queryBuilder.whereIn('bc.facility_id', [params.length]);
        }

        // billingProvider single or multiple
        if (reportParams.billingProvider) {
            params.push(reportParams.billingProvider);
            filters.billingProID = queryBuilder.whereIn('bp.id', [params.length]);
        }

        return {
            queryParams: params,
            templateData: filters
        }
    }
}

module.exports = api;
