const _ = require('lodash')
    , Promise = require('bluebird')
    , db = require('../db')
    , dataHelper = require('../dataHelper')
    , queryBuilder = require('../queryBuilder')
    , logger = require('../../../../../logger');

// generate query template ***only once*** !!!

const paymentsPrintPDFDataSetQueryTemplate = _.template(`
with payment_details as (
    SELECT
        bc.id as claim_id,
        bp.id as payment_id,
        bp.mode,
        pp.account_no,
        bp.payment_dt,
        bp.amount,
        COALESCE(sum(bpa.amount) FILTER(where bp.payer_type = 'patient' and 
    bpa.amount_type = 'payment'),0::money) AS patient_paid,
        COALESCE(sum(bpa.amount) FILTER(where bp.payer_type != 'patient' 
    and bpa.amount_type = 'payment'),0::money) AS others_paid,
        (select charges_bill_fee_total FROM 
    billing.get_claim_totals(bc.id)) as bill_fee,
        (select charges_allowed_amount_total FROM 
    billing.get_claim_totals(bc.id)) as allowed_amount,
        (select adjustments_applied_total FROM 
    billing.get_claim_totals(bc.id)) as adjustment,
        (select claim_balance_total FROM billing.get_claim_totals(bc.id)) 
    as balance
    FROM billing.payments bp
    INNER JOIN billing.payment_applications bpa ON bpa.payment_id = bp.id
    INNER JOIN billing.charges bch on bch.id = bpa.charge_id
    INNER JOIN billing.claims bc on bc.id = bch.claim_id
    INNER JOIN public.patients pp ON pp.id = bc.patient_id
    where  <%= paymentId %>
    group by  bc.id,bp.id,bp.mode, 
    pp.account_no,bp.payment_dt,bill_fee,bp.amount
    ),
    claim_details As(
    SELECT
    bc.id,
       get_full_name(pp.last_name,pp.last_name) as patient_name,
       pp.account_no as account_no,
       pc.company_name as company_name,
       bc.id as claim_no,
       pf.facility_name,
       bc.facility_id as facility_id,
       pf.facility_info->'facility_address1' as facility_address1,
       pf.facility_info->'facility_city' as facility_city,
       pf.facility_info->'facility_state' as facility_state,
       pf.facility_info->'facility_zip' as facility_zip,
       pf.facility_info->'federal_tax_id' as tax_id,
       pf.facility_info->'abbreviated_receipt' as abbreviated_receipt,
       (SELECT claim_balance_total FROM billing.get_claim_totals(bc.id)) As 
    claim_balance,
       (SELECT payments_applied_total FROM billing.get_claim_totals(bc.id)) 
    As applied,
       bc.claim_dt,
       bp.name,
       bp.address_line1,
       bp.city,
       bp.state,
       bp.zip_code,
       bp.federal_tax_id,
       bp.npi_no
    FROM billing.claims bc
    INNER JOIN public.patients pp ON pp.id = bc.patient_id
    INNER JOIN public.facilities pf ON pf.id = bc.facility_id
    INNER JOIN public.companies pc ON pc.id = bc.company_id
    INNER JOIN billing.providers bp ON bp.id = bc.billing_provider_id
    where bc.id in (SELECT claim_id from payment_details)
    ),
    charge_details as(
    SELECT
       pcc.display_code,
       pcc.display_description,
       billing.get_charge_icds(bch.id) as icd_code,
       bch.charge_dt as charge_dt,
       (bch.units * bch.bill_fee) As bill_fee
    FROM  billing.charges bch
    INNER JOIN  public.cpt_codes pcc ON pcc.id = bch.cpt_id
    WHERE bch.claim_id in (SELECT claim_id from payment_details)
    )
    
    

 
select (SELECT json_agg(row_to_json(claim_details)) AS claim_details FROM (SELECT * FROM claim_details) AS claim_details),
        (SELECT json_agg(row_to_json(charge_details)) AS charge_details FROM (SELECT * FROM charge_details) AS charge_details),
       (SELECT json_agg(row_to_json(payment_details)) AS payment_details FROM (SELECT * FROM payment_details) AS payment_details)
    
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
