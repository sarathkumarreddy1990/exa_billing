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
              ch.cpt_id
            , pa.amount
            , pay.accounting_dt 
            , pay.payment_dt
            , CASE pay.payer_type 
                WHEN 'patient' THEN get_full_name(p.last_name, p.first_name, p.middle_name, p.prefix_name, p.suffix_name)
                WHEN 'insurance' THEN ip.insurance_name
                WHEN 'ordering_provider' THEN pr.full_name
                WHEN 'ordering_facility' THEN pg.group_name END AS payer_name
            , pg_rp.group_name
        , plc.reading_provider_percent_level
        FROM
            billing.claims bc
        INNER JOIN billing.charges ch ON  ch.claim_id = bc.id
        INNER JOIN public.patients p ON p.id = bc.patient_id
        INNER JOIN billing.payment_applications pa ON pa.charge_id = ch.id AND amount_type = 'payment'
        INNER JOIN billing.payments pay ON pay.id = pa.payment_id
        LEFT JOIN public.insurance_providers ip ON ip.id = pay.insurance_provider_id
        LEFT JOIN public.provider_contacts pc ON pc.id = pay.provider_contact_id
        LEFT JOIN public.providers pr ON pr.id = pc.provider_id
        LEFT JOIN public.provider_groups pg ON pg.id = pay.provider_group_id
        LEFT JOIN public.provider_contacts pc_rp ON pc_rp.id = bc.rendering_provider_contact_id
        LEFT JOIN public.provider_groups pg_rp ON pg_rp.id = pc_rp.provider_group_id
        LEFT JOIN public.cpt_code_provider_level_codes cpt_plc ON cpt_plc.cpt_code_id = ch.cpt_id
        LEFT JOIN public.provider_level_codes plc ON plc.id = cpt_plc.provider_level_code_id
        INNER JOIN facilities f on f.id = bc.facility_id
        <% if (billingProID) { %> INNER JOIN billing.providers bp ON bp.id = bc.billing_provider_id <% } %>
        WHERE 1=1 
        AND  <%= companyId %>
        AND <%= claimDate %>
        <% if (facilityIds) { %>AND <% print(facilityIds); } %>        
        <% if(billingProID) { %> AND <% print(billingProID); } %>
    )
    SELECT
         CASE
            WHEN display_code !=' ' THEN
                COALESCE(rpf.group_name, '- No Group Assigned -' )
            ELSE '' 
            END AS "Group_name"
        , COALESCE(cpt.display_code, 'Total') AS "CPT Code"
        , COALESCE(cpt.display_description,'---') AS "Description" 
        , rpf.payer_name AS "Payer Name"
        , SUM(rpf.amount ) AS "Amount"
        , rpf.accounting_dt AS "Accounting Date"
        , rpf.payment_dt AS "Payment Date"
        , rpf.reading_provider_percent_level AS "Reading Fee %"
        , SUM(((rpf.amount::numeric * rpf.reading_provider_percent_level)/100)) AS "Reading Fee"
    FROM     
        reading_provider_fees rpf
    INNER JOIN public.cpt_codes cpt ON cpt.id = rpf.cpt_id
    GROUP BY
    GROUPING SETS (
        (group_name),
        (group_name,
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
