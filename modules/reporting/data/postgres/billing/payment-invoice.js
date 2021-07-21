const _ = require('lodash')
    , Promise = require('bluebird')
    , db = require('../db')
    , dataHelper = require('../dataHelper')
    , queryBuilder = require('../queryBuilder')
    , logger = require('../../../../../logger');

// generate query template ***only once*** !!!

const claimInquiryDataSetQueryTemplate = _.template(`
WITH claim_data AS (
    SELECT
        bc.id                                      AS claim_id
      , get_full_name(pp.last_name,pp.first_name)  AS patient_name
      , pp.patient_info->'c1AddressLine1'          AS address1
      , pp.patient_info->'c1AddressLine2'          AS address2
      , pp.patient_info->'c1City'                  AS city
      , pp.patient_info->'c1State'                 AS state
      , pp.patient_info->'c1Zip'                   AS zip
      , pp.account_no                              AS account_no
      , pc.company_name                            AS company_name
      , pf.facility_name                           AS facility_name
      , bc.facility_id                             AS facility_id
      , pf.facility_info->'facility_address1'      AS facility_address1
      , pf.facility_info->'facility_city'          AS facility_city
      , pf.facility_info->'facility_state'         AS facility_state
      , pf.facility_info->'facility_zip'           AS facility_zip
      , pf.facility_info->'federal_tax_id'         AS tax_id
      , pf.facility_info->'abbreviated_receipt'    AS abbreviated_receipt
      , to_char(timezone(pf.time_zone, bc.claim_dt)::date, 'MM/DD/YYYY')
                                                   AS  claim_date
      , bp.name                                    AS billing_pro_name
      , bp.address_line1                           AS billing_pro_address
      , bp.city                                    AS billing_pro_city
      , bp.state                                   AS billing_pro_state
      , bp.zip_code                                AS billing_pro_zip
      , bp.federal_tax_id                          AS federal_tax_id
      , bp.npi_no                                  AS npi_no
      , pm1.code                                   AS m1
      , pm2.code                                   AS m2
      , pm3.code                                   AS m3
      , pm4.code                                   AS m4
      , bch.units                                  AS units
      , pcc.display_code                           AS display_code
      , pcc.display_description                    AS display_description
      , billing.get_charge_icds(bch.id)            AS charge_icds
      , pp.id                                      AS patient_id
      , (bch.bill_fee*bch.units)		           AS Charge
      , gcd.claim_balance_total                    AS total_balance
      , gcd.adjustments_applied_total              AS adjustmet
      , gcd.charges_bill_fee_total                 AS total_charges
      , payments_applied_total                     AS total_payments
      , total_claim_details.claim_balance_total    AS total_account_balance
   FROM
        billing.claims bc
   INNER JOIN billing.get_claim_totals (bc.id) gcd ON true
   INNER JOIN billing.charges bch ON bch.claim_id = bc.id
   INNER JOIN  public.cpt_codes pcc ON pcc.id = bch.cpt_id
   INNER JOIN public.patients pp ON pp.id = bc.patient_id
   INNER JOIN public.facilities pf ON pf.id = bc.facility_id
   INNER JOIN public.companies pc ON pc.id = bc.company_id
   INNER JOIN billing.providers bp ON bp.id = bc.billing_provider_id
   INNER JOIN LATERAL  (
    SELECT
        SUM(gct.claim_balance_total) as claim_balance_total
    FROM billing.claims
    INNER JOIN patients ON claims.patient_id = patients.id
    INNER JOIN  billing.get_claim_totals(claims.id) gct ON true
    WHERE
        patients.id = bc.patient_id
   ) total_claim_details ON true
   LEFT JOIN public.modifiers pm1 ON pm1.id = bch.modifier1_id
   LEFT JOIN public.modifiers pm2 ON pm2.id = bch.modifier2_id
   LEFT JOIN public.modifiers pm3 ON pm3.id = bch.modifier3_id
   LEFT JOIN public.modifiers pm4 ON pm4.id = bch.modifier4_id
   WHERE
      <%= companyId %> AND
      <%= claimIds %>
    )
    select * from claim_data
`);

const api = {

    /**
     * STAGE 2
     * This method is called by controller pipline after report data is initialized (common lookups are available).
     */
    getReportData: (initialReportData) => {
        return Promise.join(
            api.createclaimInquiryDataSet(initialReportData.report.params),
            // other data sets could be added here...
            (claimInquiryDataSet) => {
                // add report filters
                initialReportData.filters = api.createReportFilters(initialReportData);

                // add report specific data sets
                initialReportData.dataSets.push(claimInquiryDataSet);
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
    // --- DATA SET - claimInquiry count

    createclaimInquiryDataSet: (reportParams) => {
        // 1 - build the query context. Each report will 'know' how to do this, based on report params and query/queries to be executed...
        const queryContext = api.getclaimInquiryDataSetQueryContext(reportParams);
        console.log('context__', queryContext)
        // 2 - geenrate query to execute
        const query = claimInquiryDataSetQueryTemplate(queryContext.templateData);
        // 3a - get the report data and return a promise
        return db.queryForReportData(query, queryContext.queryParams);
    },

    // query context is all about query building: 1 - query parameters and 2 - query template data
    // every report and/or query may have a different logic to build a query context...
    getclaimInquiryDataSetQueryContext: (reportParams) => {
        const params = [];
        const filters = {
            companyId: null,
            claimIds: null

        };

        // company id
        params.push(reportParams.companyId);
        filters.companyId = queryBuilder.where('bc.company_id', '=', [params.length]);

        params.push(reportParams.claimIds);
        filters.claimIds = queryBuilder.where('bc.id', '=', [params.length]);

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
