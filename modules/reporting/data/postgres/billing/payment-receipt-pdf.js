const _ = require('lodash')
    , Promise = require('bluebird')
    , db = require('../db')
    , dataHelper = require('../dataHelper')
    , queryBuilder = require('../queryBuilder')
    , logger = require('../../../../../logger');

// generate query template ***only once*** !!!

const paymentsPrintPDFDataSetQueryTemplate = _.template(`
WITH pymt_application_id AS (
    SELECT 
      min(bpa.id) AS application_id
    FROM billing.payments bp
    INNER JOIN billing.payment_applications bpa ON bpa.payment_id = bp.id 
    where  <%= paymentId %>
    ),
    get_claim_id As (
    select 
       bch.claim_id as claim_id 
    from billing.payment_applications bpa 
    INNER JOIN pymt_application_id pai on pai.application_id = bpa.id 
    INNER JOIN billing.charges bch on bch.id = bpa.charge_id 
    ),
    get_claim_details AS(SELECT 
       get_full_name(pp.last_name, pp.first_name) AS patient_name,
       pp.account_no as account_no,
       (pp.patient_info->'c1AddressLine1'::text) || ' , ' || (pp.patient_info->'c1AddressLine2'::text) ||' , '|| (pp.patient_info->'c1City'::text) As address,
       (pp.patient_info->'c1HomePhone'::text)  As phone_number,
       to_char(bc.claim_dt,'MM/DD/YYYY') as claim_dt,
       pcc.display_code,
       pcc.display_description,
       billing.get_charge_icds(bch.id),
       (bch.bill_fee * bch.units) as charge_bill_fee,
       bgct.adjustments_applied_total as adjustmet,
       bgct.claim_balance_total as balance,
       bgct.charges_allowed_amount_total as allowed_amount,
       bhcpop.patient_paid as patient_paid,
       bhcpop.others_paid as others_paid
    FROM billing.claims bc
    INNER JOIN get_claim_id gci on gci.claim_id = bc.id 
    INNER JOIN billing.charges bch on bch.claim_id = bc.id 
    INNER JOIN public.cpt_codes pcc on pcc.id = bch.cpt_id
    INNER JOIN public.patients pp on bc.patient_id = pp.id 
    INNER JOIN lateral billing.get_claim_totals(bc.id) bgct ON true
    INNER JOIN lateral billing.get_claim_patient_other_payment(bc.id) bhcpop ON true
    ),
    get_payment_details AS (
    SELECT 
      bp.id as payment_id,
      bp.mode as payment_mode,
      get_full_name(pp.last_name, pp.first_name) AS payer,
      to_char(bp.payment_dt,'MM/DD/YYYY') as payment_date,
      bp.amount as payment_amount,
      bgpt.payments_applied_total,
      (select sum(charge_bill_fee) from get_claim_details) as total_bill_fee
    FROM billing.payments bp
    INNER JOIN lateral billing.get_payment_totals(bp.id) bgpt ON true
    left JOIN public.patients pp on pp.id = bp.patient_id  
    
    where <%= paymentId %>
    )
    select * FROM get_claim_details,get_payment_details
    
    
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

        };
        params.push(reportParams.pamentIds);
        filters.paymentId = queryBuilder.where('bp.id', '=', [params.length]);


        return {
            queryParams: params,
            templateData: filters
        }
    }
}

module.exports = api;
