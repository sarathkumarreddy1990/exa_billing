const _ = require('lodash')
    , Promise = require('bluebird')
    , db = require('../db')
    , dataHelper = require('../dataHelper')
    , queryBuilder = require('../queryBuilder')
    , logger = require('../../../../../logger');

// generate query template ***only once*** !!!

const modalitySummaryDataSetQueryTemplate = _.template(`
WITH modalitySummary as (
    SELECT
    m.modality_name AS modality_name,
    count(DISTINCT o.id) AS order_count,
    count(DISTINCT s.id) AS study_count, -- why was this in v1 referred to as "order_count" ?
    count(DISTINCT cs.study_id) AS studies_count, -- just another way to get study count which may be faster
    count(c.id) AS charges_count,
    sum(c.bill_fee * c.units) AS charges_bill_fee_total 
--, sum(c.allowed_amount * c.units) AS charges_allowed_amount_total   
FROM
    public.orders AS o
    INNER JOIN public.studies s ON o.id = s.order_id
    INNER JOIN modalities m ON m.id = s.modality_id
    INNER JOIN billing.charges_studies cs ON s.id = cs.study_id
    INNER JOIN billing.charges c ON c.id = cs.charge_id
    INNER JOIN billing.claims bc ON bc.id = c.claim_id
    INNER JOIN facilities f ON f.id = bc.facility_id
    <% if (billingProID) { %> INNER JOIN billing.providers bp ON bp.id = bc.billing_provider_id <% } %>
WHERE 1=1
AND <%= companyId %>
AND <%= claimDate %>
<% if (facilityIds) { %>AND <% print(facilityIds); } %>        
<% if(billingProID) { %> AND <% print(billingProID); } %>
AND  <%= companyId %>
    AND NOT o.has_deleted
    AND NOT o.is_quick_appt
    AND o.order_status NOT IN ('NOS', 'ABRT', 'ORD', 'CAN')
    AND s.study_dt IS NOT NULL
    AND s.study_status NOT IN ('NOS', 'ABRT', 'CAN')
    AND NOT s.has_deleted
GROUP BY
    ROLLUP (m.modality_name)
)
SELECT 
    modality_name AS "Modality Name",
    order_count AS "Claim Count", 
    study_count AS "Study Count",
    studies_count AS "Studies Count",
    charges_count AS "Charges Count",
    charges_bill_fee_total AS "Total Bill Fee"
FROM
     modalitySummary 
`);

const api = {

    /**
     * STAGE 2
     * This method is called by controller pipline after report data is initialized (common lookups are available).
     */
    getReportData: (initialReportData) => {
        return Promise.join(
            api.createmodalitySummaryDataSet(initialReportData.report.params),
            dataHelper.getBillingProviderInfo(initialReportData.report.params.companyId, initialReportData.report.params.billingProvider),
            // other data sets could be added here...
            (modalitySummaryDataSet, providerInfo) => {
                // add report filters   
                initialReportData.lookups.billingProviderInfo = providerInfo || [];             
                initialReportData.filters = api.createReportFilters(initialReportData);

                // add report specific data sets
                initialReportData.dataSets.push(modalitySummaryDataSet);
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

        // Facility Filter
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
    // --- DATA SET - modalitySummary count

    createmodalitySummaryDataSet: (reportParams) => {
        // 1 - build the query context. Each report will 'know' how to do this, based on report params and query/queries to be executed...
        const queryContext = api.getmodalitySummaryDataSetQueryContext(reportParams);
        console.log('context__', queryContext)
        // 2 - geenrate query to execute
        const query = modalitySummaryDataSetQueryTemplate(queryContext.templateData);
        // 3a - get the report data and return a promise
        return db.queryForReportData(query, queryContext.queryParams);
    },

    // query context is all about query building: 1 - query parameters and 2 - query template data
    // every report and/or query may have a different logic to build a query context...
    getmodalitySummaryDataSetQueryContext: (reportParams) => {
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
