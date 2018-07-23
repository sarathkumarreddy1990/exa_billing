const _ = require('lodash')
    , Promise = require('bluebird')
    , db = require('../db')
    , dataHelper = require('../dataHelper')
    , queryBuilder = require('../queryBuilder')
    , logger = require('../../../../../logger');

// generate query template ***only once*** !!!
const referringProviderSummaryDataSetQueryTemplate = _.template(`
WITH referringProviderSummary as (
    SELECT
        pp.provider_code AS provider_code,
        pp.full_name AS provider_name,
        COUNT(pp.id) AS orderCount,
        (SELECT charges_bill_fee_total FROM billing.get_claim_totals(bc.id)) AS BillingFee,
        (SELECT charges_allowed_amount_total FROM billing.get_claim_totals(bc.id)) AS AllowedFee
    FROM 
        billing.claims bc    
    INNER JOIN public.provider_contacts ppc ON ppc.id = bc.referring_provider_contact_id
    INNER JOIN public.providers pp ON pp.id = ppc.provider_id
    <% if (billingProID) { %> INNER JOIN billing.providers bp ON bp.id = bc.billing_provider_id <% } %>
    WHERE 1=1 
        AND <%= companyId %>
        AND <%= claimDate %>
        <% if (facilityIds) { %>AND <% print(facilityIds); } %>        
        <% if(billingProID) { %> AND <% print(billingProID); } %>
    GROUP BY 
        pp.provider_code,
        pp.full_name,
        bc.id
    ORDER BY 
        pp.full_name ASC
 )
    SELECT 
        provider_code AS "Provider Code",
        provider_name AS "Provider Name",
        SUM(orderCount) AS "Count" ,
        SUM(BillingFee) AS "Bill Fee", 
        SUM(AllowedFee) AS "Allowed Fee"
    FROM
         referringProviderSummary
    GROUP BY "Provider Code","Provider Name"
`);

const api = {

    /**
     * STAGE 2
     * This method is called by controller pipline after report data is initialized (common lookups are available).
     */
    getReportData: (initialReportData) => {
        return Promise.join(
            api.createreferringProviderSummaryDataSet(initialReportData.report.params),
            dataHelper.getBillingProviderInfo(initialReportData.report.params.companyId, initialReportData.report.params.billingProvider),

            // other data sets could be added here...
        (referringProviderSummaryDataSet, providerInfo) => {
            // add report filters    
            initialReportData.lookups.billingProviderInfo = providerInfo || [];            
            initialReportData.filters = api.createReportFilters(initialReportData);

            // add report specific data sets
            initialReportData.dataSets.push(referringProviderSummaryDataSet);
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
    // --- DATA SET - referringProviderSummary count

    createreferringProviderSummaryDataSet: (reportParams) => {

        // 1 - build the query context. Each report will 'know' how to do this, based on report params and query/queries to be executed...
        const queryContext = api.getreferringProviderSummaryDataSetQueryContext(reportParams);
        console.log('context__', queryContext)
        // 2 - generate query to execute
        const query = referringProviderSummaryDataSetQueryTemplate(queryContext.templateData);
        // 3a - get the report data and return a promise
        return db.queryForReportData(query, queryContext.queryParams);
    },

    // query context is all about query building: 1 - query parameters and 2 - query template data
    // every report and/or query may have a different logic to build a query context...
    getreferringProviderSummaryDataSetQueryContext: (reportParams) => {
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
            filters.billingProID = queryBuilder.whereIn('bc.billing_provider_id', [params.length]);
        }

        return {
            queryParams: params,
            templateData: filters
        }
    }
}

module.exports = api;
