const _ = require('lodash')
    , Promise = require('bluebird')
    , db = require('../db')
    , dataHelper = require('../dataHelper')
    , queryBuilder = require('../queryBuilder')
    , logger = require('../../../../../logger');

// generate query template ***only once*** !!!

const claimInquiryDataSetQueryTemplate = _.template(`
with claim_data as (
    SELECT
    bc.id as claim_id,
      get_full_name(pp.last_name,pp.first_name) as patient_name,
     pp.patient_info->'c1AddressLine1' AS address1,
           pp.patient_info->'c1AddressLine2' AS address2,
           pp.patient_info->'c1City' AS city,
           pp.patient_info->'c1State' AS state,
           pp.patient_info->'c1Zip' AS zip,
      pp.account_no,
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
      (SELECT claim_balance_total FROM billing.get_claim_totals(bc.id)) As claim_balance,
      (SELECT payments_applied_total FROM billing.get_claim_totals(bc.id)) As applied,
      to_char(bc.claim_dt,'MM/DD/YYYY'),
      bp.name,
      bp.address_line1,
      bp.city,
      bp.state,
      bp.zip_code,
      bp.federal_tax_id,
      bp.npi_no,
      pm1.code                                             	AS "M1"
      , pm2.code                                              AS "M2"
      , pm3.code                                              AS "M3"
      , pm4.code                                              AS "M4"
      , bch.units
      , pcc.display_code
      , pcc.display_description
      ,  billing.get_charge_icds(bch.id)
      , pp.id
      , (bch.bill_fee*bch.units)								AS "Charge"
   FROM billing.claims bc
   INNER JOIN billing.charges bch on bch.claim_id = bc.id
   INNER JOIN  public.cpt_codes pcc ON pcc.id = bch.cpt_id
   INNER JOIN public.patients pp ON pp.id = bc.patient_id
   INNER JOIN public.facilities pf ON pf.id = bc.facility_id
   INNER JOIN public.companies pc ON pc.id = bc.company_id
   INNER JOIN billing.providers bp ON bp.id = bc.billing_provider_id
   LEFT JOIN public.modifiers pm1 on pm1.id = bch.modifier1_id
LEFT JOIN public.modifiers pm2 on pm2.id = bch.modifier2_id
LEFT JOIN public.modifiers pm3 on pm3.id = bch.modifier3_id
LEFT JOIN public.modifiers pm4 on pm4.id = bch.modifier4_id
   where 1=1 AND <%= companyId %> AND  <%= claimIds %>
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
