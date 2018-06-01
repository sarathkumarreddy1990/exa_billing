const _ = require('lodash')
    , Promise = require('bluebird')
    , db = require('../db')
    , dataHelper = require('../dataHelper')
    , queryBuilder = require('../queryBuilder')    
    , logger = require('../../../../../logger');

// generate query template ***only once*** !!!

const transactionSummaryDataSetQueryTemplate = _.template(`
WITH transaction_summary_by_month as (
    SELECT
        Date_trunc('month', bp.accounting_dt) AS txn_month,
        sum(CASE when amount_type = 'payment' then bpa.amount else 0::money end ) as payment_amount,
        sum(CASE when amount_type = 'adjustment' then bpa.amount else 0::money end ) as adjustment_amount
    FROM billing.payments bp
    INNER JOIN billing.payment_applications bpa on bpa.payment_id = bp.id
    INNER JOIN billing.charges bc on bc.id = bpa.charge_id
    WHERE 1 = 1
    AND <%= companyId %>
    GROUP BY  (date_trunc('month', bp.accounting_dt))
    ),
    charge_summary AS(select
        Date_trunc('month', charge_dt) AS txn_month,
        sum(bill_fee*units) as charge
    FROM billing.charges 
    GROUP BY (date_trunc('month', charge_dt) ))
    SELECT
        COALESCE(to_char(ts.txn_month, 'MON-yy'), to_char(cs.txn_month, 'MON-yy') ) AS "Date",
        coalesce(cs.charge,0::money)  AS "Charge",
        SUM(coalesce(ts.payment_amount,0::money)) AS "Payments",
        SUM(coalesce(adjustment_amount,0::money)) AS "Adjustments",
        cs.charge - SUM ( coalesce(ts.payment_amount,0::money) +  coalesce(ts.adjustment_amount,0::money)) AS "Net Activity"
    
    FROM transaction_summary_by_month ts
    FULL  JOIN charge_summary cs ON ts.txn_month = cs.txn_month
    GROUP BY
         COALESCE(to_char(ts.txn_month, 'MON-yy'), to_char(cs.txn_month, 'MON-yy') ) , cs.charge
    ORDER BY
          to_date(COALESCE(to_char(ts.txn_month, 'MON-yy'), to_char(cs.txn_month, 'MON-yy') ),'MON-yy')
    
`);

const api = {

    /**
     * STAGE 2
     * This method is called by controller pipline after report data is initialized (common lookups are available).
     */
    getReportData: (initialReportData) => {
        return Promise.join(            
            api.createtransactionSummaryDataSet(initialReportData.report.params),
            // other data sets could be added here...
            (transactionSummaryDataSet) => {
                // add report filters                
                initialReportData.filters = api.createReportFilters(initialReportData);

                // add report specific data sets
                initialReportData.dataSets.push(transactionSummaryDataSet);
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
    // --- DATA SET - transactionSummary count

    createtransactionSummaryDataSet: (reportParams) => {
        // 1 - build the query context. Each report will 'know' how to do this, based on report params and query/queries to be executed...
        const queryContext = api.gettransactionSummaryDataSetQueryContext(reportParams);
        console.log('context__', queryContext)
        // 2 - geenrate query to execute
        const query = transactionSummaryDataSetQueryTemplate(queryContext.templateData);
        // 3a - get the report data and return a promise
        return db.queryForReportData(query, queryContext.queryParams);
    },

    // query context is all about query building: 1 - query parameters and 2 - query template data
    // every report and/or query may have a different logic to build a query context...
    gettransactionSummaryDataSetQueryContext: (reportParams) => {
        const params = [];
        const filters = {
            companyId: null
           
        };

        // company id
        params.push(reportParams.companyId);
        filters.companyId = queryBuilder.where('bp.company_id', '=', [params.length]);

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
