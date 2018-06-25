const _ = require('lodash')
    , Promise = require('bluebird')
    , db = require('../db')
    , dataHelper = require('../dataHelper')
    , queryBuilder = require('../queryBuilder')
    , logger = require('../../../../../logger');

// generate query template ***only once*** !!!

const InsuranceVSLOPDataSetQueryTemplate = _.template(`
WITH study_cte AS (
    SELECT
	bc.id AS claim_id,
        ps.id AS study_id, 
	ps.modality_id,
        bc.primary_patient_insurance_id,
	bc.secondary_patient_insurance_id,
	bc.tertiary_patient_insurance_id
    FROM public.studies AS ps
    INNER JOIN billing.charges_studies bcs on bcs.study_id = ps.id
    INNER JOIN billing.charges bch on bch.id = bcs.charge_id
    INNER JOIN billing.claims bc on bc.id = bch.id 
    WHERE
          ( ps.company_id = 1 )
      AND NOT ps.has_deleted
      AND ps.accession_no NOT ILIKE '%.c')
    , insurance_flag_cte AS (
    SELECT
        s.study_id,
        s.modality_id,
        s.study_dt,
        -- this will be selected AS max
        CASE
        WHEN s.patient_insurance_id IS NULL THEN -1 -- no insurance is assigned, counted as not_assigned
        WHEN ac.code IS NULL THEN 0 -- none of the insurance assigned has provider type, counted as other
        WHEN ac.code != 'PI' THEN 1 -- none of the insurance is PI, but one is other than PI, counted as insurance
        WHEN ac.code = 'PI' THEN 2 -- one of the insurance is PI, counted as lop
        END AS flag
    FROM study_cte AS s
    LEFT JOIN patient_insuarances AS pi ON s.patient_insurance_id = pi.id
    LEFT JOIN insurance_providers AS ip ON pi.insurance_provider_id = ip.id
    LEFT JOIN adjustment_codes    AS ac ON ac.id::text = ip.insurance_info->'providerType'
    WHERE 1=1 
    AND  <%= companyId %>
    AND <%= claimDate %>
    )
`);

const api = {

    /**
     * STAGE 2
     * This method is called by controller pipline after report data is initialized (common lookups are available).
     */
    getReportData: (initialReportData) => {
        return Promise.join(
            api.createInsuranceVSLOPDataSet(initialReportData.report.params),
            // other data sets could be added here...
            (InsuranceVSLOPDataSet) => {
                // add report filters                
                initialReportData.filters = api.createReportFilters(initialReportData);

                // add report specific data sets
                initialReportData.dataSets.push(InsuranceVSLOPDataSet);
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
    // --- DATA SET - InsuranceVSLOP count

    createInsuranceVSLOPDataSet: (reportParams) => {
        // 1 - build the query context. Each report will 'know' how to do this, based on report params and query/queries to be executed...
        const queryContext = api.getInsuranceVSLOPDataSetQueryContext(reportParams);
        console.log('context__', queryContext)
        // 2 - geenrate query to execute
        const query = InsuranceVSLOPDataSetQueryTemplate(queryContext.templateData);
        // 3a - get the report data and return a promise
        return db.queryForReportData(query, queryContext.queryParams);
    },

    // query context is all about query building: 1 - query parameters and 2 - query template data
    // every report and/or query may have a different logic to build a query context...
    getInsuranceVSLOPDataSetQueryContext: (reportParams) => {
        const params = [];
        const filters = {
            companyId: null,
            claimDate: null
        };

        // company id
        params.push(reportParams.companyId);
        filters.companyId = queryBuilder.where('bc.company_id', '=', [params.length]);

        //  scheduled_dt
        if (reportParams.fromDate === reportParams.toDate) {
            params.push(reportParams.fromDate);
            filters.claimDate = queryBuilder.whereDate('bc.claim_dt', '=', [params.length], 'f.time_zone');
        } else {
            params.push(reportParams.fromDate);
            params.push(reportParams.toDate);
            filters.claimDate = queryBuilder.whereDateBetween('bc.claim_dt', [params.length - 1, params.length], 'f.time_zone');
        }

        return {
            queryParams: params,
            templateData: filters
        }
    }
}

module.exports = api;
