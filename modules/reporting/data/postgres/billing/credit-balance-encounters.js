const _ = require('lodash')
    , Promise = require('bluebird')
    , db = require('../db')
    , dataHelper = require('../dataHelper')
    , queryBuilder = require('../queryBuilder')
    , logger = require('../../../../../logger');

// generate query template ***only once*** !!!

const creditBalanceEncounterDataSetQueryTemplate = _.template(`
WITH get_patient_balance As (
    SELECT 
       bc.patient_id AS patient_id,
       sum(bgct.claim_balance_total) AS pat_balance
    FROM billing.claims bc
    INNER JOIN public.patients pp ON pp.id = bc.patient_id
    INNER JOIN LATERAL billing.get_claim_totals(bc.id) bgct ON true
    WHERE  <%=companyId%>
    AND <%= claimDate %>
    AND payer_type = 'patient'
    <% if (facilityIds) { %>AND <% print(facilityIds); } %>        
    <% if(billingProID) { %> AND <% print(billingProID); } %>
    GROUP BY bc.patient_id
),
get_insurance_balance As (
    SELECT 
       bc.patient_id AS patient_id,
       sum(bgct.claim_balance_total) AS ins_balance
    FROM billing.claims bc
    INNER JOIN public.patients pp ON pp.id = bc.patient_id
    INNER JOIN LATERAL billing.get_claim_totals(bc.id) bgct ON true
    WHERE  <%=companyId%>
    AND <%= claimDate %>
    AND payer_type != 'patient'
    <% if (facilityIds) { %>AND <% print(facilityIds); } %>        
    <% if(billingProID) { %> AND <% print(billingProID); } %>
    GROUP BY bc.patient_id
),
 agg AS(
    SELECT
    get_full_name(pp.last_name, pp.first_name, pp.middle_name, pp.prefix_name, pp.suffix_name) AS Patient,
    bc.id AS claim_id,
    pp.account_no AS account_number,
    bcs.description AS status,
    to_char(bc.claim_dt, 'MM/DD/YYYY') AS encounter_date,
    round(bgct.claim_balance_total::numeric) AS total,
    bc.payer_type,
    CASE WHEN bc.payer_type = 'patient' THEN pat_balance ELSE 0::money END AS patient_balance,
    CASE WHEN bc.payer_type != 'patient' THEN ins_balance ELSE 0::money END AS insurance_balance
FROM billing.claims bc
     INNER JOIN get_patient_balance gpb on gpb.patient_id = bc.patient_id
     INNER JOIN get_insurance_balance gib on gib.patient_id = bc.patient_id
     INNER JOIN public.patients pp ON pp.id = bc.patient_id
     INNER JOIN billing.claim_status bcs ON bcs.id = bc.claim_status_id
     INNER JOIN LATERAL billing.get_claim_totals(bc.id) bgct ON true
	   WHERE 1 = 1
    AND <%=companyId%>
    AND bgct.claim_balance_total < 0::money
    AND <%= claimDate %>
    <% if (facilityIds) { %>AND <% print(facilityIds); } %>        
    <% if(billingProID) { %> AND <% print(billingProID); } %>
GROUP BY
    bc.id,
    pp.account_no ,
    Patient,
    Total,
    bcs.description,
    pat_balance,
    insurance_balance
)
SELECT
    agg.patient  AS "Patient Name",
    agg.claim_id AS "Claim ID",
    agg.status AS "Status",
    agg.account_number AS "Account #",
    agg.encounter_date As "Accounting Date",
    agg.total || ' CR' AS "Total", 
    CASE WHEN payer_type = 'patient' THEN  (agg.patient_balance::numeric  - agg.total)::text ELSE '    ─ ─   ' END  AS  "Patient Balance",
    CASE WHEN payer_type != 'patient' THEN (agg.insurance_balance::numeric - agg.total)::text  ELSE '    ─ ─   ' END  AS  "Insurance Balance"

FROM agg
UNION 
SELECT
    NULL,
    NULL,
    '─ Credit Total ─',
    NULL,
    NULL,
    sum(total) || ' CR',
    NULL,
    NULL
FROM
	agg
ORDER BY
"Claim ID"
`);

const api = {

    /**
     * STAGE 2
     * This method is called by controller pipline after report data is initialized (common lookups are available).
     */
    getReportData: (initialReportData) => {
        return Promise.join(
            api.createcreditBalanceEncounterDataSet(initialReportData.report.params),
            // other data sets could be added here...
            (creditBalanceEncounterDataSet) => {
                // add report filters                
                initialReportData.filters = api.createReportFilters(initialReportData);

                // add report specific data sets
                initialReportData.dataSets.push(creditBalanceEncounterDataSet);
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

        if (params.allFacilities && (params.facilityIds && params.facilityIds.length < 0))
            filtersUsed.push({ name: 'facilities', label: 'Facilities', value: 'All' });
        else {
            const facilityNames = _(lookups.facilities).filter(f => params.facilityIds && params.facilityIds.indexOf(f.id) > -1).map(f => f.name).value();
            filtersUsed.push({ name: 'facilities', label: 'Facilities', value: facilityNames });
        }

        // // Billing provider Filter
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
    // --- DATA SET - creditBalanceEncounter count

    createcreditBalanceEncounterDataSet: (reportParams) => {
        // 1 - build the query context. Each report will 'know' how to do this, based on report params and query/queries to be executed...
        const queryContext = api.getcreditBalanceEncounterDataSetQueryContext(reportParams);
        console.log('context__', queryContext)
        // 2 - geenrate query to execute
        const query = creditBalanceEncounterDataSetQueryTemplate(queryContext.templateData);
        // 3a - get the report data and return a promise
        return db.queryForReportData(query, queryContext.queryParams);
    },

    // query context is all about query building: 1 - query parameters and 2 - query template data
    // every report and/or query may have a different logic to build a query context...
    getcreditBalanceEncounterDataSetQueryContext: (reportParams) => {
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
