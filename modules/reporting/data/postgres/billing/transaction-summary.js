const _ = require('lodash');
const Promise = require('bluebird');
const db = require('../db');
const dataHelper = require('../dataHelper');
const queryBuilder = require('../queryBuilder');
const logger = require('../../../../../logger');

// generate query template ***only once*** !!!

const transactionSummaryDataSetQueryTemplate = _.template(`
    WITH transaction_summary_by_month AS (
        SELECT
            Date_trunc('month', bp.accounting_date) AS txn_month,
            SUM(CASE WHEN amount_type = 'payment' THEN bpa.amount else 0::MONEY end ) AS payment_amount,
            SUM(CASE WHEN amount_type = 'adjustment' AND COALESCE(accounting_entry_type,'') != 'refund_debit' THEN bpa.amount else 0::MONEY END ) AS adjustment_amount,
            SUM(CASE WHEN amount_type = 'adjustment' AND COALESCE(accounting_entry_type,'') = 'refund_debit' THEN bpa.amount else 0::MONEY END ) AS refund_amount
        FROM billing.payments bp
        INNER JOIN billing.payment_applications bpa ON bpa.payment_id = bp.id
        INNER JOIN billing.charges bc ON bc.id = bpa.charge_id
        INNER JOIN billing.claims bcl ON bcl.id = bc.claim_id
        INNER JOIN facilities f ON f.id = bcl.facility_id
        <% if (billingProID) { %> INNER JOIN billing.providers bbp ON bbp.id = bcl.billing_provider_id <% } %>
        LEFT JOIN billing.adjustment_codes bac ON bac.id = bpa.adjustment_code_id
        WHERE TRUE
            AND <%= accounting_date %>
            <% if (facilityIds) { %>AND <% print(facilityIds); } %>
            <% if(billingProID) { %> AND <% print(billingProID); } %>
        GROUP BY
             (date_trunc('month', bp.accounting_date))
    ),
    charge_summary AS (
        SELECT
            Date_trunc('month', bc.claim_dt) AS txn_month,
            SUM(bill_fee*units) AS charge
        FROM
            billing.charges bch
        INNER JOIN billing.claims bc ON bc.id = bch.claim_id
        INNER JOIN facilities f ON f.id = bc.facility_id
        <% if (billingProID) { %> INNER JOIN billing.providers bbp ON bbp.id = bc.billing_provider_id <% } %>
        WHERE TRUE
            AND <%=claimDate%>
            <% if (facilityIds) { %>AND <% print(facilityIds); } %>
            <% if(billingProID) { %> AND <% print(billingProID); } %>
        GROUP BY
             (date_trunc('month', bc.claim_dt) )
    ),
    transction_summary_amount_by_month AS (
        SELECT
            COALESCE(to_char(ts.txn_month, 'MON-yy'), to_char(cs.txn_month, 'MON-yy') ) AS "Date",
            COALESCE(cs.charge,0::MONEY) AS "Charges",
            SUM(COALESCE(ts.payment_amount,0::MONEY)) AS "Payments",
            SUM(COALESCE(adjustment_amount,0::MONEY)) AS "Adjustments",
            SUM(COALESCE(refund_amount,0::MONEY)) AS "Refunds",
            (COALESCE(cs.charge, 0::MONEY) - SUM (COALESCE(ts.payment_amount,0::MONEY) + COALESCE(ts.adjustment_amount,0::MONEY) + COALESCE(ts.refund_amount,0::MONEY))) AS "Net Activity"
        FROM
             transaction_summary_by_month ts
        FULL JOIN charge_summary cs ON ts.txn_month = cs.txn_month
        GROUP BY
            COALESCE(to_char(ts.txn_month, 'MON-yy'), to_char(cs.txn_month, 'MON-yy') ) ,
            cs.charge
        ORDER BY
            to_date(COALESCE(to_char(ts.txn_month, 'MON-yy'), to_char(cs.txn_month, 'MON-yy') ),'MON-yy')
    ),
    transction_summary_total_amount_by_month AS (
        SELECT
            SUM(by_month."Charges") AS "charge",
            SUM(by_month."Payments") AS "payments",
            SUM(by_month."Adjustments") AS "adjustments",
            SUM(by_month."Refunds") AS "refunds",
            SUM(by_month."Net Activity") AS "net_activity"
        FROM
            transction_summary_amount_by_month AS by_month
    )
    (
        SELECT
            "Date",
            "Charges",
            "Payments",
            "Adjustments",
            "Refunds",
            "Net Activity"
        FROM
            transction_summary_amount_by_month
    )
    UNION ALL
    (
        SELECT
            NULL,
            charge,
            Payments,
            adjustments,
            refunds,
            net_activity
        FROM
            transction_summary_total_amount_by_month
    )
 `);

// Template by Month wise

const transactionSummaryByDateDataSetQueryTemplate = _.template(`
    WITH transaction_summary_by_day AS (
        SELECT
            Date_trunc('day', bp.accounting_date) AS txn_month,
            SUM(CASE WHEN amount_type = 'payment' THEN bpa.amount else 0::MONEY end ) AS payment_amount,
            SUM(CASE WHEN amount_type = 'adjustment' AND COALESCE(accounting_entry_type,'') != 'refund_debit' THEN bpa.amount else 0::MONEY END ) AS adjustment_amount,
            SUM(CASE WHEN amount_type = 'adjustment' AND COALESCE(accounting_entry_type,'') = 'refund_debit' THEN bpa.amount else 0::MONEY END ) AS refund_amount
        FROM
            billing.payments bp
        INNER JOIN billing.payment_applications bpa ON bpa.payment_id = bp.id
        INNER JOIN billing.charges bc ON bc.id = bpa.charge_id
        INNER JOIN billing.claims bcl ON bcl.id = bc.claim_id
        INNER JOIN facilities f ON f.id = bcl.facility_id
        <% if (billingProID) { %> INNER JOIN billing.providers bbp ON bbp.id = bcl.billing_provider_id <% } %>
            LEFT JOIN billing.adjustment_codes bac ON bac.id = bpa.adjustment_code_id
        WHERE TRUE
            AND <%= accounting_date %>
            <% if (facilityIds) { %>AND <% print(facilityIds); } %>
            <% if(billingProID) { %> AND <% print(billingProID); } %>
        GROUP BY
            (date_trunc('day', bp.accounting_date))
    ),
    charge_summary AS (
        SELECT
            DATE_TRUNC('day', timezone(get_facility_tz(bc.facility_id::integer), bc.claim_dt)::DATE ) AS txn_month,
            SUM(bill_fee*units) AS charge
        FROM
             billing.charges bch
        INNER JOIN billing.claims bc ON bc.id = bch.claim_id
        INNER JOIN facilities f ON f.id = bc.facility_id
        <% if (billingProID) { %> INNER JOIN billing.providers bbp ON bbp.id = bc.billing_provider_id <% } %>
        WHERE TRUE
            AND<%= claimDate %>
            <% if (facilityIds) { %>AND <% print(facilityIds); } %>
            <% if(billingProID) { %> AND <% print(billingProID); } %>
        GROUP BY
            (DATE_TRUNC('day', timezone(get_facility_tz(bc.facility_id::integer), bc.claim_dt)::DATE))
    ),
    transction_summary_amount_by_day AS (
        SELECT
            COALESCE(to_char(ts.txn_month, 'MM/DD/YYYY'), to_char(cs.txn_month, 'MM/DD/YYYY') ) AS "Date",
            COALESCE(cs.charge,0::MONEY)  AS "Charges",
            SUM(COALESCE(ts.payment_amount,0::MONEY)) AS "Payments",
            SUM(COALESCE(adjustment_amount,0::MONEY)) AS "Adjustments",
            SUM(COALESCE(refund_amount,0::MONEY)) AS "Refunds",
            (COALESCE(cs.charge, 0::MONEY) - SUM ( COALESCE(ts.payment_amount,0::MONEY) +  COALESCE(ts.adjustment_amount,0::MONEY) + COALESCE(ts.refund_amount,0::MONEY))) AS "Net Activity"
        FROM
            transaction_summary_by_day ts
        FULL JOIN charge_summary cs ON ts.txn_month = cs.txn_month
        GROUP BY
            COALESCE(to_char(ts.txn_month, 'MM/DD/YYYY'), to_char(cs.txn_month, 'MM/DD/YYYY') ) ,
            cs.charge
        ORDER BY
            to_date(COALESCE(to_char(ts.txn_month, 'MM/DD/YYYY'), to_char(cs.txn_month, 'MM/DD/YYYY') ),'MM/DD/YYYY')
    ),
    transction_summary_total_amount_by_day AS (
        SELECT
            SUM(by_day."Charges") AS "charge",
            SUM(by_day."Payments") AS "payments",
            SUM(by_day."Adjustments") AS "adjustments",
            SUM(by_day."Refunds") AS "refunds",
            SUM(by_day."Net Activity") AS "net_activity"
        FROM
            transction_summary_amount_by_day AS by_day
    )
    (
        SELECT
            "Date",
            "Charges",
            "Payments",
            "Adjustments",
            "Refunds",
            "Net Activity"
        FROM
            transction_summary_amount_by_day
    )
    UNION ALL
    (
        SELECT
            NULL,
            charge,
            Payments,
            adjustments,
            refunds,
            net_activity
        FROM
            transction_summary_total_amount_by_day
    )
`);

const api = {

    /**
     * STAGE 2
     * This method is called by controller pipline after report data is initialized (common lookups are available).
     */
    getReportData: (initialReportData) => {
        return Promise.join(
            api.createtransactionSummaryDataSet(initialReportData.report.params),
            dataHelper.getBillingProviderInfo(initialReportData.report.params.companyId, initialReportData.report.params.billingProvider),
            // other data sets could be added here...
            (transactionSummaryDataSet, providerInfo) => {
                // add report filters
                initialReportData.lookups.billingProviderInfo = providerInfo || [];
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
        let rawReportDataSet = rawReportData.dataSets[0];
        if (rawReportDataSet && rawReportDataSet.rowCount === 0) {
            return Promise.resolve(rawReportData);
        }
        return new Promise((resolve, reject) => {
            let transactionSummaryColumns = rawReportDataSet.columns;
            const rowIndexes = {
                charge_amount: _.findIndex(transactionSummaryColumns, ['name', 'Charges']),
                payment_amount: _.findIndex(transactionSummaryColumns, ['name', 'Payments']),
                adjustment_amount: _.findIndex(transactionSummaryColumns, ['name', 'Adjustments']),
                refund_amount: _.findIndex(transactionSummaryColumns, ['name', 'Refunds']),
                net_activity_amount: _.findIndex(transactionSummaryColumns, ['name', 'Net Activity'])
            }
            transactionSummaryColumns[rowIndexes.charge_amount].cssClass = 'text-right';
            transactionSummaryColumns[rowIndexes.payment_amount].cssClass = 'text-right';
            transactionSummaryColumns[rowIndexes.adjustment_amount].cssClass = 'text-right';
            transactionSummaryColumns[rowIndexes.refund_amount].cssClass = 'text-right';
            transactionSummaryColumns[rowIndexes.net_activity_amount].cssClass = 'text-right';
            return resolve(rawReportData);
        });
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
    // --- DATA SET - transactionSummary count

    createtransactionSummaryDataSet: (reportParams) => {
        // 1 - build the query context. Each report will 'know' how to do this, based on report params and query/queries to be executed...
        const queryContext = api.gettransactionSummaryDataSetQueryContext(reportParams);
        console.log('context__', queryContext)
        // 2 - geenrate query to execute
        const query = reportParams.totalByMonthOrDay == 'false' ? transactionSummaryDataSetQueryTemplate(queryContext.templateData) : transactionSummaryByDateDataSetQueryTemplate(queryContext.templateData);
        // 3a - get the report data and return a promise
        return db.queryForReportData(query, queryContext.queryParams);
    },

    // query context is all about query building: 1 - query parameters and 2 - query template data
    // every report and/or query may have a different logic to build a query context...
    gettransactionSummaryDataSetQueryContext: (reportParams) => {
        const params = [];
        const filters = {
            claimDate: null,
            facilityIds: null,
            billingProID: null,
            accounting_date: null

        };



        //claim facilities
        if (!reportParams.allFacilities && reportParams.facilityIds) {
            params.push(reportParams.facilityIds);
            filters.facilityIds = queryBuilder.whereIn('f.id', [params.length]);
        }

        //  Accounting Date
        if (reportParams.fromDate === reportParams.toDate) {
            params.push(reportParams.fromDate);
            filters.accounting_date = queryBuilder.whereDate('bp.accounting_date', '=', [params.length]);
        } else {
            params.push(reportParams.fromDate);
            params.push(reportParams.toDate);
            filters.accounting_date = queryBuilder.whereDateBetween('bp.accounting_date', [params.length - 1, params.length]);
        }

        //  Claim Date
        if (reportParams.fromDate === reportParams.toDate) {
            params.push(reportParams.fromDate);
            filters.claimDate = queryBuilder.whereDateInTz('bc.claim_dt', '=', [params.length], 'f.time_zone');
        } else {
            params.push(reportParams.fromDate);
            params.push(reportParams.toDate);
            filters.claimDate = queryBuilder.whereDateInTzBetween('bc.claim_dt', [params.length - 1, params.length], 'f.time_zone');
        }

        // billingProvider single or multiple
        if (reportParams.billingProvider) {
            params.push(reportParams.billingProvider);
            filters.billingProID = queryBuilder.whereIn('bbp.id', [params.length]);
        }

        return {
            queryParams: params,
            templateData: filters
        }
    }
}

module.exports = api;
