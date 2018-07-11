const _ = require('lodash')
    , Promise = require('bluebird')
    , db = require('../db')
    , dataHelper = require('../dataHelper')
    , queryBuilder = require('../queryBuilder')
    , logger = require('../../../../../logger');

// generate query template ***only once*** !!!

const claimActivityDataSetQueryTemplate = _.template(`
WITH agg_claim AS(
    SELECT 
         pippt.code AS provider_type
	    , f.facility_name as facility_name
    	, f.id as facility_id
        , bc.id AS claim_id
        , payer_type
    	, (SELECT claim_balance_total FROM billing.get_claim_totals(bc.id)) as claim_balance
    FROM
    	billing.claims bc
    INNER JOIN public.facilities f ON f.id = bc.facility_id
    LEFT JOIN public.patient_insurances ppi ON ppi.id = CASE WHEN payer_type = 'primary_insurance' THEN primary_patient_insurance_id
                                                            WHEN payer_type = 'secondary_insurance' THEN secondary_patient_insurance_id
                                                            WHEN payer_type = 'tertiary_insurance' THEN tertiary_patient_insurance_id END
    LEFT JOIN public.insurance_providers pip ON pip.id = ppi.insurance_provider_id
    LEFT JOIN public.insurance_provider_payer_types pippt ON pippt.id = pip.provider_payer_type_id
    <% if (billingProID) { %> INNER JOIN billing.providers bp ON bp.id = bc.billing_provider_id <% } %>
     WHERE 1 = 1
     AND <%= companyId %>
     AND <%= claimDate %>
     <% if (facilityIds) { %>AND <% print(facilityIds); } %>        
     <% if(billingProID) { %> AND <% print(billingProID); } %>
  )
,
charge_details AS(
	SELECT       
        SUM(ch.bill_fee * ch.units) AS total_bill_fee
      , SUM(ch.allowed_amount * ch.units) AS expected_amount
      , SUM(ch.units) AS units
      , COUNT(cpt_id) AS cpt_count
      , agg_claim.claim_id
   FROM agg_claim 
   INNER JOIN billing.charges ch ON ch.claim_id = agg_claim.claim_id 
    GROUP BY 
    agg_claim.claim_id    	
 ),
 pri_ins_payment AS (
	SELECT 
    	agg_claim.claim_id ,
    	SUM(CASE WHEN amount_type = 'payment' THEN bpa.amount ELSE 0::money  END) pri_payment,
    	SUM(CASE WHEN amount_type = 'adjustment' THEN bpa.amount  ELSE 0::money END) pri_adjustment 
    FROM agg_claim  
    INNER JOIN billing.charges ch ON ch.claim_id = agg_claim.claim_id 
    INNER JOIN billing.payment_applications bpa ON bpa.charge_id = ch.id
    WHERE agg_claim.payer_type = 'primary_insurance'
    GROUP BY agg_claim.claim_id
),
sec_ins_payment AS (
	SELECT 
    	SUM(CASE WHEN amount_type = 'payment' THEN bpa.amount ELSE 0::money  END) sec_payment
    	, agg_claim.claim_id
    FROM agg_claim  
    INNER JOIN billing.charges ch ON ch.claim_id = agg_claim.claim_id 
	INNER JOIN billing.payment_applications bpa ON bpa.charge_id = ch.id
    WHERE agg_claim.payer_type = 'secondary_insurance'
    GROUP BY agg_claim.claim_id
),
ter_ins_payment AS (
	SELECT 
    	agg_claim.claim_id ,
    	SUM(CASE WHEN amount_type = 'payment' THEN bpa.amount ELSE 0::money  END) ter_payment
    FROM agg_claim 
    INNER JOIN billing.charges ch ON ch.claim_id = agg_claim.claim_id 
    INNER JOIN billing.payment_applications bpa ON bpa.charge_id = ch.id
    WHERE agg_claim.payer_type = 'tertiary_insurance'
    GROUP BY agg_claim.claim_id
),
payment_details AS (
	SELECT 
    	SUM(CASE WHEN amount_type = 'payment' THEN bpa.amount ELSE 0::money END) payment,
    	SUM(CASE WHEN amount_type = 'adjustment' THEN bpa.amount ELSE 0::money END) adjustment ,
    	agg_claim.claim_id 
    FROM agg_claim 
    INNER JOIN billing.charges ch ON ch.claim_id = agg_claim.claim_id
    INNER JOIN billing.payment_applications bpa ON bpa.charge_id = ch.id
    GROUP BY agg_claim.claim_id
),
total_credit AS(
	SELECT 
    	payment_details.claim_id ,
    	SUM(payment + adjustment) AS tot_credit
    FROM payment_details
    GROUP BY payment_details.claim_id
),
patient_payment AS(
	SELECT 
         SUM(bpa.amount) AS patient_pay
    	, agg_claim.claim_id
    FROM agg_claim 
    INNER JOIN billing.charges ch ON ch.claim_id = agg_claim.claim_id 
    INNER JOIN billing.payment_applications bpa ON bpa.charge_id = ch.id AND bpa.amount_type = 'payment'
    GROUP BY agg_claim.claim_id
)
SELECT
    provider_type  AS "Ins Class"
    , COALESCE(agg_claim.facility_name, 'Total')  AS "Facility Name"    
    , SUM(charge_details.total_bill_fee) AS "Charges"
    , SUM(COALESCE(pri_ins_payment.pri_adjustment,0::money)) AS "Adjustments"
    , SUM(agg_claim.claim_balance) AS "Balance"
    , SUM(charge_details.expected_amount) AS "Expected Payments"
    , SUM(COALESCE(total_credit.tot_credit,0::money)) AS "All Credits"
    , SUM(COALESCE(pri_ins_payment.pri_payment,0::money)) AS "Ins1 Pay"
    , SUM(COALESCE(sec_ins_payment.sec_payment,0::money)) AS "Ins2 Pay"
    , SUM(COALESCE(ter_ins_payment.ter_payment,0::money)) AS "Ins3 Pay"
    , SUM(COALESCE(patient_payment.patient_pay,0::money)) AS "Patient Payment"
    , SUM(COALESCE(charge_details.units,0::numeric)) AS "Units"
    , SUM(charge_details.cpt_count) AS "Num Process."
FROM agg_claim
LEFT JOIN pri_ins_payment ON agg_claim.claim_id = pri_ins_payment.claim_id
LEFT JOIN sec_ins_payment ON  agg_claim.claim_id = sec_ins_payment.claim_id
LEFT JOIN ter_ins_payment ON agg_claim.claim_id = ter_ins_payment.claim_id
LEFT JOIN total_credit ON agg_claim.claim_id = total_credit.claim_id
LEFT JOIN charge_details ON agg_claim.claim_id = charge_details.claim_id
LEFT JOIN patient_payment ON agg_claim.claim_id = patient_payment.claim_id
GROUP BY GROUPING SETS(
    ( "Ins Class"), ("Ins Class","Facility Name"),())
ORDER BY "Ins Class"
`);

const api = {

    /**
     * STAGE 2
     * This method is called by controller pipline after report data is initialized (common lookups are available).
     */
    getReportData: (initialReportData) => {
        return Promise.join(
            api.createclaimActivityDataSet(initialReportData.report.params),
            dataHelper.getBillingProviderInfo(initialReportData.report.params.companyId, initialReportData.report.params.billingProvider),
            // other data sets could be added here...
            (claimActivityDataSet, providerInfo) => {
                // add report filters  
                initialReportData.lookups.billingProviderInfo = providerInfo || [];
                initialReportData.filters = api.createReportFilters(initialReportData);

                // add report specific data sets
                initialReportData.dataSets.push(claimActivityDataSet);
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
    // --- DATA SET - claimActivity count

    createclaimActivityDataSet: (reportParams) => {
        // 1 - build the query context. Each report will 'know' how to do this, based on report params and query/queries to be executed...
        const queryContext = api.getclaimActivityDataSetQueryContext(reportParams);
        console.log('context__', queryContext)
        // 2 - geenrate query to execute
        const query = claimActivityDataSetQueryTemplate(queryContext.templateData);
        // 3a - get the report data and return a promise
        return db.queryForReportData(query, queryContext.queryParams);
    },

    // query context is all about query building: 1 - query parameters and 2 - query template data
    // every report and/or query may have a different logic to build a query context...
    getclaimActivityDataSetQueryContext: (reportParams) => {
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

        // //  Claim Date
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
