const _ = require('lodash')
    , Promise = require('bluebird')
    , db = require('../db')
    , dataHelper = require('../dataHelper')
    , queryBuilder = require('../queryBuilder')
    , logger = require('../../../../../logger');

// generate query template ***only once*** !!!

const paymentByInsuranceCompanyDataSetQueryTemplate = _.template(`
WITH paymentsByInsCompany as (
    SELECT
        bp.id AS payment_id,
        ip.insurance_code AS insurance_code,
        ip.insurance_name AS insurance_name,
        f.facility_name AS facility_name,
        f.id AS facility_id,
        SUM((SELECT payment_balance_total FROM billing.get_payment_totals(bp.id))) as payment_balance,
        SUM((SELECT payments_applied_total FROM billing.get_payment_totals(bp.id))) as payment_applied_amount,
        SUM(bp.amount) as amount,
        bp.card_number AS cheque_card_number,
        bp.mode AS payment_mode,
        timezone(f.time_zone,bp.payment_dt) AS payment_date
    FROM
        billing.payments bp
        INNER JOIN public.insurance_providers ip ON ip.id = bp.insurance_provider_id
        LEFT JOIN public.facilities f ON f.id = bp.facility_id
        <% if (billingProID) { %> INNER JOIN billing.providers bp ON bp.id = bc.billing_provider_id <% } %>
    WHERE 1=1
    AND <%= companyId %>
    AND <%= paymentDate %>
    <% if (facilityIds) { %>AND <% print(facilityIds); } %>        
    <% if(billingProID) { %> AND <% print(billingProID); } %>
    GROUP BY 
      grouping sets( (ip.insurance_name) ,
       (payment_id,insurance_code, ip.insurance_name,facility_name, f.id, bp.card_number, bp.mode,payment_date),())
  ORDER BY
    ip.insurance_name,
    bp.id    
)
    SELECT 
        payment_id AS "Payment Id",
        insurance_name AS "Insurance Name",
        COALESCE(facility_name, 'TOTAL') AS "Facility Name",
        amount AS "Amount",
        payment_applied_amount AS "Applied",
        payment_balance AS "Balance",
        cheque_card_number AS "Cheque/Card #",
        payment_mode AS "Payment Mode",
        payment_date AS "Payment Date"
    FROM
         paymentsByInsCompany
`);

const api = {

    /**
     * STAGE 2
     * This method is called by controller pipline after report data is initialized (common lookups are available).
     */
    getReportData: (initialReportData) => {
        return Promise.join(
            api.createpaymentByInsuranceCompanyDataSet(initialReportData.report.params),
            // other data sets could be added here...
            (paymentByInsuranceCompanyDataSet) => {
                // add report filters                
                initialReportData.filters = api.createReportFilters(initialReportData);

                // add report specific data sets
                initialReportData.dataSets.push(paymentByInsuranceCompanyDataSet);
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
        return filtersUsed;
    },

    // ================================================================================================================
    // --- DATA SET - paymentByInsuranceCompany count

    createpaymentByInsuranceCompanyDataSet: (reportParams) => {
        // 1 - build the query context. Each report will 'know' how to do this, based on report params and query/queries to be executed...
        const queryContext = api.getpaymentByInsuranceCompanyDataSetQueryContext(reportParams);
        console.log('context__', queryContext)
        // 2 - geenrate query to execute
        const query = paymentByInsuranceCompanyDataSetQueryTemplate(queryContext.templateData);
        // 3a - get the report data and return a promise
        return db.queryForReportData(query, queryContext.queryParams);
    },

    // query context is all about query building: 1 - query parameters and 2 - query template data
    // every report and/or query may have a different logic to build a query context...
    getpaymentByInsuranceCompanyDataSetQueryContext: (reportParams) => {
        const params = [];
        const filters = {
            companyId: null,
            paymentDate: null,
            facilityIds: null,
            billingProID: null

        };

        // company id
        params.push(reportParams.companyId);
        filters.companyId = queryBuilder.where('bp.company_id', '=', [params.length]);

        //claim facilities
        if (!reportParams.allFacilities && reportParams.facilityIds) {
            params.push(reportParams.facilityIds);
            filters.facilityIds = queryBuilder.whereIn('bp.facility_id', [params.length]);
        }

        //  scheduled_dt
        if (reportParams.fromDate === reportParams.toDate) {
            params.push(reportParams.fromDate);
            filters.paymentDate = queryBuilder.whereDate('bp.accounting_dt', '=', [params.length], 'f.time_zone');
        } else {
            params.push(reportParams.fromDate);
            params.push(reportParams.toDate);
            filters.paymentDate = queryBuilder.whereDateBetween('bp.accounting_dt', [params.length - 1, params.length], 'f.time_zone');
        }

        // billingProvider single or multiple
        // if (reportParams.billingProvider) {
        //     params.push(reportParams.billingProvider);
        //     filters.billingProID = queryBuilder.whereIn('bp.id', [params.length]);
        // }

        return {
            queryParams: params,
            templateData: filters
        }

        return {
            queryParams: params,
            templateData: filters
        }
    }
}

module.exports = api;
