const _ = require('lodash')
    , Promise = require('bluebird')
    , db = require('../db')
    , dataHelper = require('../dataHelper')
    , queryBuilder = require('../queryBuilder')
    , logger = require('../../../../../logger');

// generate query template ***only once*** !!!

const readingProviderFeesDataSetQueryTemplate = _.template(`
    WITH reading_provider_fees AS( 
        SELECT 
            bc.id as claim_id
            , pcc.display_description
            , pcc.display_code
            , bpa.amount
            , to_char(bp.accounting_dt, 'MM/DD/YYYY') as accounting_dt
            , to_char(bp.payment_dt, 'MM/DD/YYYY') as payment_dt
            , CASE bp.payer_type 
                WHEN 'patient' THEN get_full_name(pp.last_name, pp.first_name, pp.middle_name,pp.prefix_name, pp.suffix_name)
                WHEN 'insurance' THEN pip.insurance_name
                WHEN 'ordering_provider' THEN ppr.full_name
                WHEN 'ordering_facility' THEN ppg.group_name END AS payer_name
            , cppg.group_name AS group_name
            , COALESCE(pplc.reading_provider_percent_level,0) AS reading_provider_percent_level
            , to_char(bc.claim_dt, 'MM/DD/YYYY') as claim_dt
        FROM billing.claims bc
        INNER JOIN billing.charges bch ON  bch.claim_id = bc.id
        INNER JOIN public.cpt_codes pcc ON pcc.id = bch.cpt_id
        INNER JOIN billing.payment_applications bpa ON bpa.charge_id = bch.id AND bpa.amount_type = 'payment'
        INNER JOIN billing.payments bp ON bp.id = bpa.payment_id
        LEFT JOIN public.patients pp ON pp.id = bp.patient_id
        LEFT JOIN public.insurance_providers pip ON pip.id = bp.insurance_provider_id
        LEFT JOIN public.provider_contacts ppc ON ppc.id = bp.provider_contact_id
        LEFT JOIN public.providers ppr ON ppr.id = ppc.provider_id
        LEFT JOIN public.provider_groups ppg ON ppg.id = bp.provider_group_id
        LEFT JOIN public.provider_contacts cppc ON cppc.id = bc.referring_provider_contact_id
        LEFT JOIN public.provider_groups cppg ON cppg.id = cppc.provider_group_id
        LEFT JOIN public.cpt_code_provider_level_codes pccplc ON pccplc.cpt_code_id = pcc.id
        LEFT JOIN public.provider_level_codes pplc ON pplc.id = pccplc.provider_level_code_id
        INNER JOIN facilities f on f.id = bc.facility_id
        <% if (billingProID) { %> INNER JOIN billing.providers bpr ON bpr.id = bc.billing_provider_id <% } %>
        WHERE 1=1 
        AND  <%= companyId %>
        AND <%= claimDate %>
        <% if (facilityIds) { %>AND <% print(facilityIds); } %>        
        <% if(billingProID) { %> AND <% print(billingProID); } %>
    )
    SELECT
        claim_id AS "Claim ID",
        CASE
            WHEN rpf.display_code !='' THEN
                COALESCE(rpf.group_name, '- No Group Assigned -' )
            ELSE '' 
            END AS "Group_name"
        , COALESCE(rpf.display_code, 'Total') AS "CPT Code"
        , COALESCE(rpf.display_description,'---') AS "Description" 
        , claim_dt AS "Claim Date"
        , rpf.payer_name AS "Payer Name"
        , SUM(rpf.amount ) AS "Amount"
        , rpf.accounting_dt AS "Accounting Date"
        , rpf.payment_dt AS "Payment Date"
        , round(rpf.reading_provider_percent_level,2) AS "Reading Fee %"
        , round(SUM((rpf.amount::numeric/100) * rpf.reading_provider_percent_level),2) AS "Reading Fee"
    FROM     
        reading_provider_fees rpf
    GROUP BY
    GROUPING SETS (
        (group_name),
        (group_name,
         claim_id,
         claim_dt,
         display_code,
         display_description,
         payer_name,
         amount,
         accounting_dt,
         payment_dt,
         reading_provider_percent_level ),
        ()
    )
`);

const api = {

    /**
     * STAGE 2
     * This method is called by controller pipline after report data is initialized (common lookups are available).
     */
    getReportData: (initialReportData) => {
        return Promise.join(
            api.createreadingProviderFeesDataSet(initialReportData.report.params),
            dataHelper.getBillingProviderInfo(initialReportData.report.params.companyId, initialReportData.report.params.billingProvider),
            // other data sets could be added here...
            (readingProviderFeesDataSet, providerInfo) => {
                // add report filters  
                initialReportData.lookups.billingProviderInfo = providerInfo || [];
                initialReportData.filters = api.createReportFilters(initialReportData);

                // add report specific data sets
                initialReportData.dataSets.push(readingProviderFeesDataSet);
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
            filtersUsed.push({ name: 'facilities', label: 'Facility', value: 'All' });
        else {
            const facilityNames = _(lookups.facilities).filter(f => params.facilityIds && params.facilityIds.map(Number).indexOf(parseInt(f.id, 10)) > -1).map(f => f.name).value();
            filtersUsed.push({ name: 'facilities', label: 'Facility', value: facilityNames });
        }
      

        filtersUsed.push({ name: 'fromDate', label: 'From', value: params.fromDate });
        filtersUsed.push({ name: 'toDate', label: 'To', value: params.toDate });
        return filtersUsed;
    },

    // ================================================================================================================
    // --- DATA SET - readingProviderFees count

    createreadingProviderFeesDataSet: (reportParams) => {
        // 1 - build the query context. Each report will 'know' how to do this, based on report params and query/queries to be executed...
        const queryContext = api.getreadingProviderFeesDataSetQueryContext(reportParams);
        console.log('context__', queryContext)
        // 2 - geenrate query to execute
        const query = readingProviderFeesDataSetQueryTemplate(queryContext.templateData);
        // 3a - get the report data and return a promise
        return db.queryForReportData(query, queryContext.queryParams);
    },

    // query context is all about query building: 1 - query parameters and 2 - query template data
    // every report and/or query may have a different logic to build a query context...
    getreadingProviderFeesDataSetQueryContext: (reportParams) => {
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
            filters.claimDate = queryBuilder.whereDate('bp.accounting_dt', '=', [params.length], 'f.time_zone');
        } else {
            params.push(reportParams.fromDate);
            params.push(reportParams.toDate);
            filters.claimDate = queryBuilder.whereDateBetween('bp.accounting_dt', [params.length - 1, params.length], 'f.time_zone');
        }

        // billingProvider single or multiple
        if (reportParams.billingProvider) {
            params.push(reportParams.billingProvider);
            filters.billingProID = queryBuilder.whereIn('bpr.id', [params.length]);
        }

        return {
            queryParams: params,
            templateData: filters
        }
    }
}

module.exports = api;
