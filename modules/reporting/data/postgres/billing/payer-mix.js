const _ = require('lodash')
    , Promise = require('bluebird')
    , db = require('../db')
    , dataHelper = require('../dataHelper')
    , queryBuilder = require('../queryBuilder')
    , logger = require('../../../../../logger');

// generate query template ***only once*** !!!

const payerMixDataSetQueryTemplate = _.template(`
WITH payerMixDetails AS (
    SELECT
        pcc.display_code AS display_code,
        pip.insurance_code AS insurance_code,
        pip.insurance_name AS insurance_name,
        pf.facility_name AS facility_name,
        to_char(bc.claim_dt, 'MM/DD/YYYY') AS claim_date,
        SUM(bch.bill_fee) AS bill_fee,
        COUNT(bc.id) AS claim_count
    FROM 
        billing.claims bc
    INNER JOIN billing.charges bch ON bch.claim_id = bc.id 
    INNER JOIN public.cpt_codes pcc ON pcc.id = bch.cpt_id
    INNER JOIN public.facilities pf ON pf.id = bc.facility_id
    LEFT JOIN public.patient_insurances ppi ON ppi.id = ANY (ARRAY[bc.primary_patient_insurance_id,bc.secondary_patient_insurance_id,bc.tertiary_patient_insurance_id])
    LEFT JOIN public.insurance_providers pip ON pip.id= ppi.insurance_provider_id 
    <% if (billingProID) { %> INNER JOIN billing.providers bp ON bp.id = bc.billing_provider_id <% } %>
    WHERE 1=1
        AND <%= companyId %>
        AND <%= claimDate %>
        <% if (facilityIds) { %>AND <% print(facilityIds); } %>        
        <% if(billingProID) { %> AND <% print(billingProID); } %>
        GROUP BY grouping sets(
            ( pip.insurance_name ),
            ( pcc.display_code,
              pip.insurance_code,
              pip.insurance_name,
              pf.facility_name,
              bc.claim_dt))
    ORDER BY 
        insurance_name,
        facility_name ASC
    )
    SELECT
        display_code AS "CPT Code",
        insurance_code AS "Insurance Code",
        insurance_name AS "Insurance Name",
        COALESCE(facility_name,' ─ ─ Total ─ ─ ') AS "Facility Name",
        claim_date AS "Claim Date",
        bill_fee AS "Bill Fee",
        claim_count AS "Claim Count"
    FROM
         payerMixDetails
    UNION ALL
    SELECT
        null::TEXT AS "CPT Code",
        null::TEXT AS "Insurance Code",
        null::TEXT AS "Insurance Name",
        '─ GRAND TOTAL ─'::TEXT AS "Facility Name",
        null::TEXT AS "Claim Date",
        SUM(bill_fee) AS "Bill Fee",
        SUM(claim_count) AS "Claim Count"
    FROM
         payerMixDetails
    WHERE  facility_name is not null
`);

const api = {

    /**
     * STAGE 2
     * This method is called by controller pipline after report data is initialized (common lookups are available).
     */
    getReportData: (initialReportData) => {
        return Promise.join(
            api.createpayerMixDataSet(initialReportData.report.params),
            dataHelper.getBillingProviderInfo(initialReportData.report.params.companyId, initialReportData.report.params.billingProvider),
            // other data sets could be added here...
            (payerMixDataSet, providerInfo) => {
                // add report filters       
                initialReportData.lookups.billingProviderInfo = providerInfo || [];
                initialReportData.filters = api.createReportFilters(initialReportData);
                // add report specific data sets
                initialReportData.dataSets.push(payerMixDataSet);
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

        filtersUsed.push({ name: 'fromDate', label: 'Date From', value: params.fromDate });
        filtersUsed.push({ name: 'toDate', label: 'Date To', value: params.toDate });
        return filtersUsed;
    },

    // ================================================================================================================
    // --- DATA SET - payerMix count

    createpayerMixDataSet: (reportParams) => {
        // 1 - build the query context. Each report will 'know' how to do this, based on report params and query/queries to be executed...
        const queryContext = api.getpayerMixDataSetQueryContext(reportParams);
        console.log('context__', queryContext)
        // 2 - geenrate query to execute
        const query = payerMixDataSetQueryTemplate(queryContext.templateData);
        // 3a - get the report data and return a promise
        return db.queryForReportData(query, queryContext.queryParams);
    },

    // query context is all about query building: 1 - query parameters and 2 - query template data
    // every report and/or query may have a different logic to build a query context...
    getpayerMixDataSetQueryContext: (reportParams) => {
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

        //claim facilities
        if (!reportParams.allFacilities && reportParams.facilityIds) {
            params.push(reportParams.facilityIds);
            filters.facilityIds = queryBuilder.whereIn('bc.facility_id', [params.length]);
        }

        //  scheduled_dt
        if (reportParams.fromDate === reportParams.toDate) {
            params.push(reportParams.fromDate);
            filters.claimDate = queryBuilder.whereDate('bc.claim_dt', '=', [params.length], 'f.time_zone');
        } else {
            params.push(reportParams.fromDate);
            params.push(reportParams.toDate);
            filters.claimDate = queryBuilder.whereDateBetween('bc.claim_dt', [params.length - 1, params.length], 'f.time_zone');
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
