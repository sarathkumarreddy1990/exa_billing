const _ = require('lodash')
    , Promise = require('bluebird')
    , db = require('../db')
    , dataHelper = require('../dataHelper')
    , queryBuilder = require('../queryBuilder')
    , logger = require('../../../../../logger');

// generate query template ***only once*** !!!

const paymentsPrintPDFDataSetQueryTemplate = _.template(`

WITH payment_details AS(
    SELECT
          bp.id
        , mode AS payment_mode
        , card_name AS cardname
        , card_number AS cardnumber
        , payer_type AS payertype
        , bp.amount AS amount
        , patients.id AS patient_id
        , payment_balance_total AS available_balance
        , payments_applied_total AS applied
        , adjustments_applied_total AS adjustment_amount
        , to_char(bp.payment_dt,'MM/DD/YYYY') AS payment_dt
        , (CASE payer_type
                WHEN 'insurance' THEN insurance_providers.insurance_name
	            WHEN 'ordering_facility' THEN provider_groups.group_name
	            WHEN 'ordering_provider' THEN ref_provider.full_name
                WHEN 'patient' THEN patients.full_name
          END) AS payer_name
     FROM
        billing.payments bp
    INNER JOIN billing.get_payment_totals(bp.id) ON true
    INNER JOIN billing.payment_applications bpa ON  bpa.payment_id = bp.id
    LEFT JOIN public.patients ON patients.id = bp.patient_id
    LEFT JOIN public.provider_groups ON provider_groups.id = bp.provider_group_id
    LEFT JOIN public.provider_contacts ON provider_contacts.id = bp.provider_contact_id
    LEFT JOIN public.providers ref_provider ON provider_contacts.provider_id = ref_provider.id
    LEFT JOIN public.insurance_providers  ON insurance_providers.id = bp.insurance_provider_id
    LEFT JOIN public.facilities ON facilities.id = bp.facility_id
    WHERE
        <%= paymentId %> AND bpa.amount_type = 'payment' LIMIT 1
    ),
    patient_details AS(
    SELECT
        to_char(claim_dt,'MM/DD/YYYY') AS claim_date,
        pp.id AS patient_id,
        coalesce(pp.account_no, '─ ─ Total ─ ─') AS account_no,
        pp.full_name AS full_name,
        SUM(amount) AS pay_amount,
        bc.claim_dt
    FROM
        billing.claims bc
    INNER JOIN public.patients pp ON pp.id = bc.patient_id
    INNER JOIN billing.charges bch ON bch.claim_id = bc.id
    INNER JOIN billing.payment_applications bpa on bpa.charge_id = bch.id
    WHERE
        <%= paymentApplicationId %> AND bpa.amount_type = 'payment'
    GROUP BY
        GROUPING SETS ( (pp.full_name,pp.account_no,bc.claim_dt,pp.id),())
    )
    SELECT
        id,
        cardname,
        cardnumber,
        payment_mode,
        payertype,
        payer_name,
        amount,
        available_balance,
        applied,
        adjustment_amount,
        payment_dt,
        pd.account_no,
        pd.full_name ,
        claim_date,
        pay_amount
    FROM payment_details
    FULL JOIN patient_details pd ON pd.patient_id = payment_details.patient_id
    WHERE 1 != (SELECT count(1) FROM patient_details)
    ORDER BY
        pd.account_no DESC

`);

const api = {

    /**
     * STAGE 2
     * This method is called by controller pipline after report data is initialized (common lookups are available).
     */
    getReportData: (initialReportData) => {
        return Promise.join(
            api.createpaymentsPrintPDFDataSet(initialReportData.report.params),
            // other data sets could be added here...
            (paymentsPrintPDFDataSet) => {
                // add report filters
                initialReportData.filters = api.createReportFilters(initialReportData);

                // add report specific data sets
                initialReportData.dataSets.push(paymentsPrintPDFDataSet);
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
        return filtersUsed;
    },

    // ================================================================================================================
    // --- DATA SET - paymentsPrintPDF count

    createpaymentsPrintPDFDataSet: (reportParams) => {
        // 1 - build the query context. Each report will 'know' how to do this, based on report params and query/queries to be executed...
        const queryContext = api.getpaymentsPrintPDFDataSetQueryContext(reportParams);
        console.log('context__', queryContext)
        // 2 - geenrate query to execute
        const query = paymentsPrintPDFDataSetQueryTemplate(queryContext.templateData);
        // 3a - get the report data and return a promise
        return db.queryForReportData(query, queryContext.queryParams);
    },

    // query context is all about query building: 1 - query parameters and 2 - query template data
    // every report and/or query may have a different logic to build a query context...
    getpaymentsPrintPDFDataSetQueryContext: (reportParams) => {
        const params = [];
        const filters = {
            paymentId: null,
            paymentApplicationId: null

        };
        params.push(reportParams.pamentIds);
        filters.paymentId = queryBuilder.where('bp.id', '=', [params.length]);
        filters.paymentApplicationId = queryBuilder.where('bpa.payment_id', '=', [params.length]);


        return {
            queryParams: params,
            templateData: filters
        }
    }
}

module.exports = api;
