const _ = require('lodash')
    , Promise = require('bluebird')
    , db = require('../db')
    , dataHelper = require('../dataHelper')
    , queryBuilder = require('../queryBuilder')
    , logger = require('../../../../../logger');

// generate query template ***only once*** !!!

const patientsByInsCompanyDataSetQueryTemplate = _.template(`
with patientByInsCompanyDetailQuery as (
    SELECT
        ip.insurance_code                                                                                     AS "Code",
        pi.coverage_level                                                                                     AS "Level",
        get_full_name(p.last_name, p.first_name, p.middle_name, p.prefix_name, p.suffix_name)                 AS "Patient",
        to_char(p.birth_date, 'MM/DD/YYYY')                                                                   AS "DOB",
        CASE lower(substring(p.gender, 1, 1)) WHEN 'f' THEN 'Female' WHEN 'm' THEN 'Male' ELSE 'Unknown' END  AS "Gender",
   	    policy_number                                                                                         AS "Policy",
        ip.insurance_name                                                                                     AS "Insurance",
	    group_number					                                                                      AS "Group"
    FROM 
        public.patients AS p
    INNER JOIN public.patient_insurances AS pi ON pi.patient_id = p.id
    INNER JOIN billing.claims bc ON bc.patient_id = p.id
    INNER JOIN insurance_providers AS ip ON ip.id = pi.insurance_provider_id
    INNER JOIN facilities f on f.id = bc.facility_id
    WHERE  1 = 1
         AND <%= companyId %>
         AND <%= claimDate %>
         <% if (facilityIds) { %>AND <% print(facilityIds); } %>    
         <% if(insuranceProviderIds) { %>AND <% print(insuranceProviderIds);} %>
    GROUP BY ip.insurance_code,pi.coverage_level,"Patient","DOB","Gender",policy_number,ip.insurance_name,group_number
    ORDER BY 
        "Patient","Level"
)
SELECT * FROM patientByInsCompanyDetailQuery 
`);

const api = {

    /**
     * STAGE 2
     * This method is called by controller pipline after report data is initialized (common lookups are available).
     */
    getReportData: (initialReportData) => {
        //convert array of insuranceProviderIds array of string to integer
        if (initialReportData.report.params.insuranceProviderIds) {
            initialReportData.report.params.insuranceProviderIds = initialReportData.report.params.insuranceProviderIds.map(Number);
        }

        return Promise.join(
            api.createpatientsByInsCompanyDataSet(initialReportData.report.params),
            dataHelper.getBillingProviderInfo(initialReportData.report.params.companyId, initialReportData.report.params.billingProvider),
            dataHelper.getInsuranceProvidersInfo(initialReportData.report.params.companyId, initialReportData.report.params.insuranceProviderIds),
            // other data sets could be added here...
            (patientsByInsCompanyDataSet, providerInfo, insuranceProvidersInfo) => {
                // add report filters  
                initialReportData.lookups.billingProviderInfo = providerInfo || [];
                initialReportData.lookups.insuranceProviders = insuranceProvidersInfo || [];
                initialReportData.filters = api.createReportFilters(initialReportData);

                // add report specific data sets
                initialReportData.dataSets.push(patientsByInsCompanyDataSet);
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

        // insurance Providers
        if (params.allRefProList == 'false') {
            if (params.insuranceProviderIds) {
                const insuranceProviderNames = _(lookups.insuranceProviders).map(f => f.name).value();
                filtersUsed.push({ name: 'insuranceProviderNames', label: 'Insurance Provider', value: insuranceProviderNames });
            }
            else
                filtersUsed.push({ name: 'insuranceProviderNames', label: 'Insurance Provider', value: 'All' });
        }

        // Billing provider Filter
        // if (params.allBillingProvider == 'true')
        //     filtersUsed.push({ name: 'billingProviderInfo', label: 'Billing Provider', value: 'All' });
        // else {
        //     const billingProviderInfo = _(lookups.billingProviderInfo).map(f => f.name).value();
        //     filtersUsed.push({ name: 'billingProviderInfo', label: 'Billing Provider', value: billingProviderInfo });
        // }

        filtersUsed.push({ name: 'fromDate', label: 'Date From', value: params.fromDate });
        filtersUsed.push({ name: 'toDate', label: 'Date To', value: params.toDate });
        return filtersUsed;
    },

    // ================================================================================================================
    // --- DATA SET - patientsByInsCompany count

    createpatientsByInsCompanyDataSet: (reportParams) => {
        // 1 - build the query context. Each report will 'know' how to do this, based on report params and query/queries to be executed...
        const queryContext = api.getpatientsByInsCompanyDataSetQueryContext(reportParams);
        console.log('context__', queryContext)
        // 2 - geenrate query to execute
        const query = patientsByInsCompanyDataSetQueryTemplate(queryContext.templateData);
        // 3a - get the report data and return a promise
        return db.queryForReportData(query, queryContext.queryParams);
    },

    // query context is all about query building: 1 - query parameters and 2 - query template data
    // every report and/or query may have a different logic to build a query context...
    getpatientsByInsCompanyDataSetQueryContext: (reportParams) => {
        const params = [];
        const filters = {
            companyId: null,
            claimDate: null,
            facilityIds: null,
            insuranceProviderIds: null

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

        //InsuranceProvider filter
        if (reportParams.insuranceProviderIds) {
            params.push(reportParams.insuranceProviderIds);
            filters.insuranceProviderIds = queryBuilder.whereIn('ip.id', [params.length]);
        }
        return {
            queryParams: params,
            templateData: filters
        }
    }
}

module.exports = api;
