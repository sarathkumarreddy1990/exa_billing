const _ = require('lodash')
    , Promise = require('bluebird')
    , db = require('../db')
    , dataHelper = require('../dataHelper')
    , queryBuilder = require('../queryBuilder')
    , config = require('../../../../../server/config')
    , logger = require('../../../../../logger');

// generate query template ***only once*** !!!

const paymentsPDFDataSetQueryTemplate = _.template(`
WITH paymentsPDF as (
    SELECT
    bp.id AS payment_id,
    get_full_name(pu.first_name,pu.last_name) as user_full_name,
    get_full_name(pp.first_name,pp.last_name) as patient_full_name,
    get_full_name(ppr.first_name,ppr.last_name) as provider_full_name,
    pip.insurance_name,
    pip.insurance_code,
    bp.alternate_payment_id,
    bp.facility_id,
    bp.payment_dt,
    to_char(bp.accounting_dt, 'MM/DD/YYYY') as accounting_dt,
    bp.payer_type,
    bp.invoice_no,
    bp.amount AS amount,
    bp.notes as notes,
bp.card_number AS cheque_card_number,
    pp.account_no as account_no,
    (SELECT payments_applied_total FROM billing.get_payment_totals(bp.id)) AS applied,
    (SELECT adjustments_applied_total FROM billing.get_payment_totals(bp.id)) AS adjustments,
    (SELECT payment_balance_total FROM billing.get_payment_totals(bp.id)) AS balance,
    (SELECT payment_status FROM billing.get_payment_totals(bp.id)) AS status,
    CASE WHEN payer_type = 'patient' THEN  get_full_name(pp.first_name,pp.last_name)
         WHEN payer_type = 'insurance' THEN pip.insurance_name
         WHEN payer_type = 'ordering_facility' THEN ppg.group_name
         WHEN payer_type = 'ordering_provider' THEN get_full_name(ppr.first_name,ppr.last_name)
    END payer_name,
    pf.facility_name as facility_name,
    to_char(bp.payment_dt,'MM/DD/YYYY') as payment_date
FROM billing.payments bp
INNER JOIN public.users pu ON pu.id = bp.created_by
LEFT JOIN public.patients pp ON pp.id = bp.patient_id
LEFT JOIN public.insurance_providers pip ON pip.id = bp.insurance_provider_id
LEFT JOIN public.provider_groups ppg ON ppg.id = bp.provider_group_id
LEFT JOIN public.provider_contacts ppc ON ppc.id = bp.provider_contact_id
LEFT JOIN public.providers ppr ON ppr.id = ppc.provider_id
LEFT JOIN public.facilities pf ON pf.id = bp.facility_id
  )
  SELECT
    facility_name AS "Facility Name",
    payment_id AS "Payment ID",    
    patient_full_name AS "Patient Name",
    account_no AS "MRN #", 
     notes AS "Note",    
    cheque_card_number AS "CHK/CC#",
    payment_date AS "Payment Date",
    accounting_dt  AS "Accounting Date",
    COALESCE(status, 'TOTAL') AS "Payment Status" ,  
    SUM(amount) AS "Payment"
  FROM
        paymentsPDF
     WHERE  1=1      
    <% if (paymentStatus) { %>AND <% print(paymentStatus); } %>    
      
         
  GROUP BY
     grouping sets(
        ( facility_name),
            (
              facility_name,
              payment_id, 
              patient_full_name, 
              account_no,              
              cheque_card_number,
              payment_date,
              accounting_dt ,
              notes,
              status)
           )

           UNION ALL

           SELECT
           NULL AS "Facility Name",
           NULL AS "Payment ID",    
           NULL AS "Patient Name",
           NULL AS "MRN #", 
           NULL AS "Note",    
           NULL AS "CHK/CC#",
           NULL AS "Payment Date",
           NULL AS "Accounting Date",   
           'GRAND TOTAL'::TEXT AS "Payment Status" , 
         SUM(amount) AS "Payment"
         FROM
               paymentsPDF
         LIMIT <%=  pageSize %> 
        

`);

const api = {

    /**
     * STAGE 2
     * This method is called by controller pipline after report data is initialized (common lookups are available).
     */
    getReportData: (initialReportData) => {
        return Promise.join(
            api.createpaymentsPDFDataSet(initialReportData.report.params),
            // other data sets could be added here...
            (paymentsPDFDataSet) => {
                // add report filters                
                initialReportData.filters = api.createReportFilters(initialReportData);

                // add report specific data sets
                initialReportData.dataSets.push(paymentsPDFDataSet);
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

    },

    // ================================================================================================================
    // --- DATA SET - paymentsPDF count

    createpaymentsPDFDataSet: (reportParams) => {
        // 1 - build the query context. Each report will 'know' how to do this, based on report params and query/queries to be executed...
        const queryContext = api.getpaymentsPDFDataSetQueryContext(reportParams);
        console.log('context__', queryContext)
        // 2 - geenrate query to execute
        const query = paymentsPDFDataSetQueryTemplate(queryContext.templateData);
        // 3a - get the report data and return a promise
        return db.queryForReportData(query, queryContext.queryParams);
    },

    // query context is all about query building: 1 - query parameters and 2 - query template data
    // every report and/or query may have a different logic to build a query context...
    getpaymentsPDFDataSetQueryContext: (reportParams) => {
        const params = [];
        const filters = {
          paymentDate : null,
          paymentStatus : null,
          pageSize : null
        };    
        
        
        //  scheduled_dt
        // if (reportParams.fromDate === reportParams.toDate) {
        //     params.push(reportParams.fromDate);
        //     filters.paymentDate = queryBuilder.whereDate('bp.payment_dt', '=', [params.length], 'f.time_zone');
        // } else {
        //     params.push(reportParams.fromDate);
        //     params.push(reportParams.toDate);
        //     filters.paymentDate = queryBuilder.whereDateBetween('bp.payment_dt', [params.length - 1, params.length], 'f.time_zone');
        // }


        if (reportParams.paymentStatus) {
            params.push(reportParams.paymentStatus);
            filters.paymentStatus = queryBuilder.whereIn('status', [params.length]);
        }       

        if (reportParams.filterFlag === 'paymentsExportPDFFlag') {
            if (config.get('paymentsExportRecordsCount')) {
                filters.pageSize = config.get('paymentsExportRecordsCount');
            } else {
                filters.pageSize = 1000;
            }
         }
      
        
        return {
            queryParams: params,
            templateData: filters
        }
    }
}

module.exports = api;
