const _ = require('lodash')
    , Promise = require('bluebird')
    , db = require('../db')
    , dataHelper = require('../dataHelper')
    , queryBuilder = require('../queryBuilder')
    , logger = require('../../../../../logger');

// generate query template ***only once*** !!!

const agedARDetailsDataSetQueryTemplate = _.template(`
WITH get_claim_details AS(
    SELECT 
        bc.id as claim_id,
          date_part('day', (<%= claimDate %> - bc.claim_dt)) as age,
       (SELECT coalesce(claim_balance_total,0::money) FROM billing.get_claim_totals(bc.id)) AS balance
    FROM billing.claims bc
    INNER JOIN billing.charges bch ON bch.claim_id = bc.id
 )
 SELECT
 bc.id as claim_id,
 now() AS cut_off_date,
 bpr.name AS billing_pro_name,
 get_full_name(pp.last_name,pp.first_name) AS patient_name,
 bc.claim_dt AS service_date,
 pp.account_no as account_no,
 CASE WHEN payer_type = 'primary_insurance' THEN 'Insurance'
      WHEN payer_type = 'secondary_insurance' THEN 'Insurance'
      WHEN payer_type = 'tertiary_insurance' THEN 'Insurance'
      WHEN payer_type = 'referring_provider' THEN 'Provider'
      WHEN payer_type = 'patient' THEN 'Patient'
      WHEN payer_type = 'ordering_facility' THEN 'Ordering Facility'
 END AS responsinble_party,
 CASE WHEN payer_type = 'primary_insurance' THEN pip.insurance_name
      WHEN payer_type = 'secondary_insurance' THEN pip.insurance_name
      WHEN payer_type = 'tertiary_insurance' THEN pip.insurance_name
      WHEN payer_type = 'referring_provider' THEN  ppr.full_name
      WHEN payer_type = 'patient' THEN get_full_name(pp.last_name,pp.first_name)
      WHEN payer_type = 'ordering_facility' THEN ppg.group_name
 END AS payer_name,
 
 COALESCE(CASE WHEN gcd.age <= 30 THEN gcd.balance END,0::money) AS "0.-30 Sum",
COALESCE(CASE WHEN gcd.age > 30 and gcd.age <=60  THEN gcd.balance END,0::money) AS "30-60 Sum",
COALESCE(CASE WHEN gcd.age > 60 and gcd.age <=90  THEN gcd.balance END,0::money) AS "60-90 Sum",
COALESCE(CASE WHEN gcd.age > 90 and gcd.age <=120 THEN gcd.balance END,0::money) AS "90-120 SUm",

  <% if(excelExtented == 'true') { %>    
COALESCE(CASE WHEN gcd.age > 120 and gcd.age <=150  THEN gcd.balance END,0::money) AS "120-150 Sum",
COALESCE(CASE WHEN gcd.age > 150 and gcd.age <=180  THEN gcd.balance END,0::money) AS "150-180 Sum",
COALESCE(CASE WHEN gcd.age > 180 and gcd.age <=210 THEN gcd.balance END,0::money) AS "180-210 Sum",
COALESCE(CASE WHEN gcd.age > 210 and gcd.age <=240 THEN gcd.balance END,0::money) AS "210-240 Sum",
COALESCE(CASE WHEN gcd.age > 240 and gcd.age <=270 THEN gcd.balance END,0::money) AS "240-270 Sum",
COALESCE(CASE WHEN gcd.age > 270 and gcd.age <=300 THEN gcd.balance END,0::money) AS "270-300 Sum",
COALESCE(CASE WHEN gcd.age > 300 and gcd.age <=330 THEN gcd.balance END,0::money) AS "300-330 Sum",
COALESCE(CASE WHEN gcd.age > 330 and gcd.age <=360 THEN gcd.balance END,0::money) AS "330-360 Sum",
COALESCE(CASE WHEN gcd.age > 360 and gcd.age <=450 THEN gcd.balance END,0::money) AS "360-450 Sum (Q4)",
COALESCE(CASE WHEN gcd.age > 450 and gcd.age <=540 THEN gcd.balance END,0::money) AS"450-540 Sum (Q3)",
COALESCE(CASE WHEN gcd.age > 540 and gcd.age <=630 THEN gcd.balance END,0::money) AS "540-630 Sum (Q3)",
COALESCE(CASE WHEN gcd.age > 630 and gcd.age <=730 THEN gcd.balance END,0::money) AS "630-730 Sum (Q1)",
COALESCE(CASE WHEN gcd.age > 730 THEN gcd.balance END,0::money) AS "730+ Sum"
 
 
     <% } else { %> 
        COALESCE(CASE WHEN gcd.age > 120 THEN gcd.balance END,0::money) AS "120+ Sum"

     <%}%>  
 FROM billing.claims bc
 INNER JOIN get_claim_details gcd ON gcd.claim_id = bc.id
 INNER JOIN public.patients pp ON pp.id = bc.patient_id
 INNER JOIN public.facilities pf ON pf.id = bc.facility_id
 INNER JOIN billing.providers bpr ON bpr.id = bc.billing_provider_id
 LEFT JOIN public.patient_insurances ppi ON ppi.id = CASE WHEN payer_type = 'primary_insurance' THEN primary_patient_insurance_id
                                                 WHEN payer_type = 'secondary_insurance' THEN secondary_patient_insurance_id
                                                 WHEN payer_type = 'tertiary_insurance' THEN tertiary_patient_insurance_id
                                            END
 LEFT JOIN public.insurance_providers pip ON pip.id = ppi.insurance_provider_id
 LEFT JOIN public.provider_groups ppg ON ppg.id = bc.ordering_facility_id
 LEFT JOIN public.provider_contacts ppc ON ppc.id = bc.referring_provider_contact_id
 LEFT JOIN public.providers ppr ON ppr.id = ppc.provider_id
  <% if (billingProID) { %> INNER JOIN billing.providers bp ON bp.id = bc.billing_provider_id <% } %>
      WHERE 1 = 1
      AND <%=companyId%>
      <% if (facilityIds) { %>AND <% print(facilityIds); } %>        
      <% if(billingProID) { %> AND <% print(billingProID); } %>
      <% if(excCreditBal == 'true'){ %> AND  gcd.balance::money > '0' <% } %>
`);

const api = {

    /**
     * STAGE 2
     * This method is called by controller pipline after report data is initialized (common lookups are available).
     */
    getReportData: (initialReportData) => {
        return Promise.join(
            api.createagedARDetailsDataSet(initialReportData.report.params),
            // other data sets could be added here...
            (agedARDetailsDataSet) => {
                // add report filters                
                initialReportData.filters = api.createReportFilters(initialReportData);

                // add report specific data sets
                initialReportData.dataSets.push(agedARDetailsDataSet);
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

        // // Billing provider Filter
        if (params.allBillingProvider == 'true')
            filtersUsed.push({ name: 'billingProviderInfo', label: 'Billing Provider', value: 'All' });
        else {
            const billingProviderInfo = _(lookups.billingProviderInfo).map(f => f.name).value();
            filtersUsed.push({ name: 'billingProviderInfo', label: 'Billing Provider', value: billingProviderInfo });
        }

        filtersUsed.push({ name: 'Cut Off Date', label: 'Date From', value: params.fromDate });

        return filtersUsed;
    },

    // ================================================================================================================
    // --- DATA SET - agedARDetails count

    createagedARDetailsDataSet: (reportParams) => {
        // 1 - build the query context. Each report will 'know' how to do this, based on report params and query/queries to be executed...
        const queryContext = api.getagedARDetailsDataSetQueryContext(reportParams);
        console.log('context__', queryContext)
        // 2 - geenrate query to execute
        const query = agedARDetailsDataSetQueryTemplate(queryContext.templateData);
        // 3a - get the report data and return a promise
        return db.queryForReportData(query, queryContext.queryParams);
    },

    // query context is all about query building: 1 - query parameters and 2 - query template data
    // every report and/or query may have a different logic to build a query context...
    getagedARDetailsDataSetQueryContext: (reportParams) => {
        const params = [];
        const filters = {
            companyId: null,
            claimDate: null,
            facilityIds: null,
            billingProID: null,
            excCreditBal: null
        };

        // company id
        params.push(reportParams.companyId);
        filters.companyId = queryBuilder.where('bc.company_id', '=', [params.length]);

        //claim facilities
        if (!reportParams.allFacilities && reportParams.facilityIds) {
            params.push(reportParams.facilityIds);
            filters.facilityIds = queryBuilder.whereIn('bc.facility_id', [params.length]);
        }

        //  claim_dt

        params.push(reportParams.fromDate);
        filters.claimDate = `$${params.length}::date`;

        // billingProvider single or multiple
        if (reportParams.billingProvider) {
            params.push(reportParams.billingProvider);
            filters.billingProID = queryBuilder.whereIn('bp.id', [params.length]);
        }

        filters.excelExtented = reportParams.excelExtended;
        filters.excCreditBal = reportParams.excCreditBal

        return {
            queryParams: params,
            templateData: filters
        }
    }
}

module.exports = api;
