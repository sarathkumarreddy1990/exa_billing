const _ = require('lodash')
    , Promise = require('bluebird')
    , db = require('../db')
    , dataHelper = require('../dataHelper')
    , queryBuilder = require('../queryBuilder')
    , logger = require('../../../../../logger');
;

const summaryQueryTemplate = _.template(`
WITH chargeReport AS (
    SELECT
        get_full_name(p.last_name, p.first_name,p.middle_name, p.prefix_name, p.suffix_name) AS patient_name,
        SUM(bill_fee*units) AS total_charge,
        SUM(allowed_amount*units) AS total_contract
    FROM
        billing.charges bch
    INNER JOIN billing.claims bc on bc.id = bch.claim_id
    <% if (billingProID) { %> INNER JOIN billing.providers bp ON bp.id = bc.billing_provider_id <% } %>
    INNER JOIN public.patients p on p.id = bc.patient_id
    INNER JOIN facilities f on f.id = bc.facility_id
    where 1=1
    AND  <%= companyId %>
    AND <%= claimDate %>
    <% if (facilityIds) { %>AND <% print(facilityIds); } %>
    <% if(billingProID) { %> AND <% print(billingProID); } %>
    GROUP BY
        ROLLUP (patient_name)
    ORDER BY
        patient_name
  )
  SELECT
        COALESCE(patient_name, 'Grand Total')     AS "Patient Name",
        total_charge  AS "Total Charge",
        total_contract AS "Total Contract"
  FROM
     chargeReport cc
        `);
// Data set #2, detailed query
const detailQueryTemplate = _.template(`
          WITH detail_data as
         (
            SELECT
      get_full_name(pp.last_name, pp.first_name,pp.middle_name, pp.prefix_name, pp.suffix_name)
                                                      	    AS "Patient Name"
	, pp.account_no 										AS "Account #"
	, bc.id 											    AS "Claim #"
    , to_char(pp.birth_date,'MM/DD/YYYY')                   AS "DOB"
    , billing.get_charge_icds(bch.id)                       AS "Diagnostic"
	, display_code                                          AS "CPT"
	, pm1.code                                             	AS "M1"
	, pm2.code                                              AS "M2"
	, pm3.code                                              AS "M3"
    , pm4.code                                              AS "M4"
    , (bch.bill_fee*bch.units)								AS "Charge"
	, (bch.allowed_amount*bch.units)						AS "Contract"

FROM billing.charges bch
INNER JOIN billing.claims bc on bc.id = bch.claim_id
<% if (billingProID) { %> INNER JOIN billing.providers bp ON bp.id = bc.billing_provider_id <% } %>
INNER JOIN public.patients pp on pp.id = bc.patient_id
INNER JOIN public.cpt_codes pcc on pcc.id = bch.cpt_id
LEFT JOIN public.modifiers pm1 on pm1.id = bch.modifier1_id
LEFT JOIN public.modifiers pm2 on pm2.id = bch.modifier2_id
LEFT JOIN public.modifiers pm3 on pm3.id = bch.modifier3_id
LEFT JOIN public.modifiers pm4 on pm4.id = bch.modifier4_id
where 1=1
AND  <%= companyId %>
AND <%= claimDate %>
<% if (facilityIds) { %>AND <% print(facilityIds); } %>
<% if(billingProID) { %> AND <% print(billingProID); } %>
ORDER BY
        "Patient Name"
 )

                SELECT
       * from detail_data
            `);

const api = {

    /**
     * STAGE 2
     * This method is called by controller pipline after report data is initialized (common lookups are available).
     */
    getReportData: (initialReportData) => {


        return Promise.join(
            api.createSummaryDataSet(initialReportData.report.params),
            api.createDetailDataSet(initialReportData.report.params),
            // other data sets could be added here...
            dataHelper.getBillingProviderInfo(initialReportData.report.params.companyId, initialReportData.report.params.billingProvider),
            (summaryDataSet, detailDataSet, providerInfo) => {

                initialReportData.lookups.billingProviderInfo = providerInfo || [];
                initialReportData.dataSets.push(detailDataSet);
                initialReportData.dataSets[0].summaryDataSets = [summaryDataSet];
                initialReportData.dataSetCount = initialReportData.dataSets.length;
                initialReportData.filters = api.createReportFilters(initialReportData);
                return initialReportData;
            });
    },

    transformReportData: (rawReportData) => {
        //   if (rawReportData.dataSets[0].rowCount === 0) {
        return Promise.resolve(rawReportData);
        // }
    },
    getJsReportOptions: (reportParams, reportDefinition) => {
        return reportDefinition.jsreport[reportParams.reportFormat];
    },
    // ================================================================================================================
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
    // --- DATA SET #1
    createSummaryDataSet: (reportParams) => {
        const queryContext = api.getSummaryQueryContext(reportParams);
        const query = summaryQueryTemplate(queryContext.templateData);
        return db.queryForReportData(query, queryContext.queryParams, false);
    },
    getSummaryQueryContext: (reportParams) => {
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
            filters.claimDate = queryBuilder.whereDate(' bc.claim_dt', '=', [params.length], 'f.time_zone');
        } else {
            params.push(reportParams.fromDate);
            params.push(reportParams.toDate);
            filters.claimDate = queryBuilder.whereDateBetween(' bc.claim_dt', [params.length - 1, params.length], 'f.time_zone');
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
    },
    // ================================================================================================================
    // --- DATA SET #2
    createDetailDataSet: (reportParams) => {
        // 1 - build the query context. Each report will 'know' how to do this, based on report params and query/queries to be executed...
        const queryContext = api.getDetailQueryContext(reportParams);
        // 2 - geenrate query to execute
        const query = detailQueryTemplate(queryContext.templateData);
        // 3a - get the report data and return a promise
        return db.queryForReportData(query, queryContext.queryParams);
    },

    getDetailQueryContext: (reportParams) => {
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
