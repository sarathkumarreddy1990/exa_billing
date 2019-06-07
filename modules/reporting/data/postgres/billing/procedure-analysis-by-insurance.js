const _ = require('lodash');
const Promise = require('bluebird');
const db = require('../db');
const dataHelper = require('../dataHelper');
const queryBuilder = require('../queryBuilder');
const logger = require('../../../../../logger');
const moment = require('moment');

// generate query template ***only once*** !!!

const ProcedureAnalysisInsuranceDataSetQueryTemplate = _.template(`
WITH claim_details AS (
    WITH payment_details AS (
     SELECT
         CASE WHEN bpa.amount_type = 'payment' THEN bpa.amount END payment_amount,
         CASE WHEN bpa.amount_type = 'adjustment' THEN bpa.amount END adjustment,
         CASE WHEN bp.payer_type = 'patient' THEN 'P'
              WHEN (bp.payer_type = 'insurance' and (bp.insurance_provider_id = ppi.insurance_provider_id))  THEN 'I'
              ELSE 'O' END pymt_tag,
         bpa.charge_id
     FROM
        billing.payments bp
     INNER JOIN billing.payment_applications bpa on bpa.payment_id = bp.id
     INNER JOIN billing.charges bch on bch.id = bpa.charge_id
     INNER JOIN billing.claims bc on bc.id = bch.claim_id
     INNER JOIN public.patient_insurances ppi ON ppi.id =  bc.primary_patient_insurance_id
     ORDER BY payment_id
    ),
    payment_summary AS (
     SELECT
         COALESCE (SUM(payment_amount) FILTER ( WHERE pymt_tag = 'P'), 0::MONEY) AS pmt_p,
         COALESCE (SUM(adjustment) FILTER ( WHERE pymt_tag = 'P'), 0::MONEY) AS adj_p,
         COALESCE (SUM(payment_amount) FILTER ( WHERE pymt_tag = 'I'), 0::MONEY) AS pmt_i,
         COALESCE (SUM(adjustment) FILTER ( WHERE pymt_tag = 'I'), 0::MONEY) AS adj_i,
         COALESCE (SUM(payment_amount) FILTER ( WHERE pymt_tag = 'O'), 0::MONEY) AS pmt_o,
         COALESCE (SUM(adjustment) FILTER ( WHERE pymt_tag = 'O'), 0::MONEY) AS adj_o,
         charge_id,
         SUM( COALESCE(COALESCE(NULLIF(payment_amount::numeric, 'NaN'),'0')::MONEY, 0::MONEY) + COALESCE(COALESCE(NULLIF(adjustment::numeric, 'NaN'),'0')::MONEY, 0::MONEY)) AS cpt_pymt_adj
     FROM
         payment_details
     GROUP BY
          charge_id
     HAVING
          SUM(COALESCE(NULLIF(payment_amount::numeric, 'NaN'),'0')::MONEY)::numeric > 0
          OR SUM(COALESCE(NULLIF(adjustment::numeric, 'NaN'),'0')::MONEY)::numeric > 0
    )
     SELECT
         pip.insurance_name AS "Insurance",
         bp.name AS "Billing Provider",
         pippt.description AS "Payer Type",
         get_full_name (pp.last_name, pp.first_name, pp.middle_name, pp.prefix_name, pp.suffix_name) AS "Patient",
         pp.account_no AS "Account #",
         f.facility_name AS "Facility",
         bc.id AS "Encounter ID",
         to_char(timezone(f.time_zone, bc.claim_dt)::date, '<%= dateFormat %>') AS "<%= dateHeader %>",
         pcc.display_code AS "<%= codeHeader %>",
         pcc.display_description AS "Study Description",
         pm.modality_code AS "Modality",
         SUM((bch.bill_fee * bch.units)) AS "Charges",
         SUM((bch.allowed_amount * bch.units)) AS "Allowed Amount",
         SUM(COALESCE (ps.pmt_i, 0::MONEY)) AS "Ins Pay",
         SUM(COALESCE (ps.adj_i, 0::MONEY)) AS "Ins Adj",
         SUM(COALESCE (ps.pmt_p, 0::MONEY)) AS "Patient Pay",
         SUM(COALESCE (ps.adj_p, 0::MONEY)) AS "Patient Adj",
         SUM(COALESCE (ps.pmt_o, 0::MONEY)) AS "Others Pay",
         SUM(COALESCE (ps.adj_o, 0::MONEY)) AS "Others Adj",
         SUM((bch.bill_fee * bch.units ) - COALESCE (cpt_pymt_adj , 0::MONEY)) AS "Balance"
         <% if ( refProviderFlagValue === 'true' ) { %>
           , ppr.full_name   AS "Referring Physician"
         <% } %>
     FROM
        billing.claims bc
     INNER JOIN public.patients pp ON pp.id = bc.patient_id
     INNER JOIN public.facilities AS f ON f.id = bc.facility_id
     INNER JOIN billing.charges bch ON bch.claim_id = bc.id
     INNER JOIN public.cpt_codes pcc ON pcc.id = bch.cpt_id
     INNER JOIN billing.providers bp ON bp.id = bc.billing_provider_id
     INNER JOIN billing.charges_studies bcs ON bcs.charge_id = bch.id
     INNER JOIN public.studies pss on pss.id = bcs.study_id
     INNER JOIN public.patient_insurances AS ppi ON ppi.id =  bc.primary_patient_insurance_id
     LEFT JOIN payment_summary ps ON ps.charge_id = bch.id
     LEFT JOIN public.insurance_providers pip ON pip.id = ppi.insurance_provider_id
     LEFT JOIN public.insurance_provider_payer_types pippt ON pippt.id = pip.provider_payer_type_id
     LEFT JOIN public.modalities pm on pm.id = pss.modality_id
     <% if ( refProviderFlagValue === 'true' ) { %>
        LEFT JOIN public.provider_contacts ppc ON ppc.id = bc.referring_provider_contact_id
        LEFT JOIN public.providers as ppr ON ppr.id = ppc.provider_id
     <% } %>
     WHERE
        <%= companyId %>
        AND <%= claimDate %>
        <% if (facilityIds) { %> AND <% print(facilityIds); } %>
        <% if(billingProID) { %> AND <% print(billingProID); } %>
        <% if(insuranceProviderIds) { %>AND <% print(insuranceProviderIds);} %>
        <% if(cptIds) { %>AND <% print(cptIds);} %>
        <% if(referringProID) { %>AND <% print(referringProID);} %>
        <% if(providerGroupID) { %>AND <% print(providerGroupID);} %>
        <% if(payerIds) { %>AND <% print(payerIds);} %>
     GROUP BY
        GROUPING SETS
            (
              ( <% if (refProviderFlagValue === 'true') { %>
                    "Referring Physician"
                <% } else { %>
                    "Insurance"
                <% } %>
              ),
              (
                 "Insurance"
               , "Billing Provider"
               , "Payer Type"
               , "Patient"
               , "Account #"
               , "Facility"
               , "Encounter ID"
               , "CPT Date"
               , "CPT Code"
               , "Study Description"
               , "Modality"
               <% if ( refProviderFlagValue === 'true' ) { %>
                  , "Referring Physician"
               <% } %>
               , cpt_pymt_adj),
              ())
  )
    SELECT
        *
    FROM
       claim_details
`);

const api = {

    /**
     * STAGE 2
     * This method is called by controller pipline after report data is initialized (common lookups are available).
     */
    getReportData: (initialReportData) => {
        initialReportData.report.params.codeHeader = initialReportData.report.vars.columnHeader.cpt[initialReportData.report.params.country_alpha_3_code];
        initialReportData.report.params.dateHeader = initialReportData.report.vars.columnHeader.cptDate[initialReportData.report.params.country_alpha_3_code];
        if (initialReportData.report.params.cptIds) {
            initialReportData.report.params.cptIds = initialReportData.report.params.cptIds.map(Number);
        }
        //convert array of insuranceProviderIds array of string to integer
        if (initialReportData.report.params.insuranceProviderIds) {
            initialReportData.report.params.insuranceProviderIds = initialReportData.report.params.insuranceProviderIds.map(Number);
        }
        // convert Array of insurance payer type Ids String to Integer
        if(initialReportData.report.params.referringDocList) {
            initialReportData.report.params.referringDocList =  initialReportData.report.params.referringDocList.map(Number);
        }
        // convert Array of  provider group Ids String to Integer
        if(initialReportData.report.params.payerTypeList) {
            initialReportData.report.params.payerTypeList =  initialReportData.report.params.payerTypeList.map(Number);
        }
        // convert Array of Referring provider Ids String to Integer
        if(initialReportData.report.params.refProviderGroupList) {
            initialReportData.report.params.refProviderGroupList =  initialReportData.report.params.refProviderGroupList.map(Number);
        }

        return Promise.join(

            dataHelper.getCptCodesInfo(initialReportData.report.params.companyId, initialReportData.report.params.cptIds),
            dataHelper.getInsuranceProvidersInfo(initialReportData.report.params.companyId, initialReportData.report.params.insuranceProviderIds),
            dataHelper.getBillingProviderInfo(initialReportData.report.params.companyId,initialReportData.report.params.billingProvider),
            dataHelper.getReferringPhysicianInfo(initialReportData.report.params.companyId,initialReportData.report.params.referringDocList),
            dataHelper.getProviderGroupInfo(initialReportData.report.params.companyId,initialReportData.report.params.refProviderGroupList),
            dataHelper.getAdjustmentCodeInfo(initialReportData.report.params.companyId,initialReportData.report.params.payerTypeList),

            api.createProcedureAnalysisInsuranceDataSet(initialReportData.report.params),
            // other data sets could be added here...
            (cptCodesInfo,insuranceProvidersInfo,providerInfo,referProviderInfo,providerGroupList,payerTypeList,procAnalysisByInsDataSet ) => {
                // add report specific data sets
                initialReportData.lookups.cptCodes = cptCodesInfo || [];
                initialReportData.lookups.insuranceProviders= insuranceProvidersInfo || [];
                initialReportData.lookups.billingProviderInfo = providerInfo || [];
                initialReportData.lookups.referringProviderInfo = referProviderInfo || [];
                initialReportData.lookups.providerGroupList = providerGroupList || [];
                initialReportData.lookups.payerTypeList = payerTypeList || [];
                initialReportData.filters = api.createReportFilters(initialReportData);
                initialReportData.dataSets.push(procAnalysisByInsDataSet);
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
        let rawReportDataSet = rawReportData.dataSets[0];
        if (rawReportDataSet && rawReportDataSet.rowCount === 0) {
            return Promise.resolve(rawReportData);
        }
        return new Promise((resolve, reject) => {
            let procedureAnlayseColumns = rawReportDataSet.columns;
            const rowIndexes = {
                charges: _.findIndex(procedureAnlayseColumns, ['name', 'Charges']),
                allowedAmount: _.findIndex(procedureAnlayseColumns, ['name', 'Allowed Amount']),
                insurancePayment: _.findIndex(procedureAnlayseColumns, ['name', 'Ins Pay']),
                insuranceAdjustment: _.findIndex(procedureAnlayseColumns, ['name', 'Ins Adj']),
                patientPayment: _.findIndex(procedureAnlayseColumns, ['name', 'Patient Pay']),
                patientAdjustment: _.findIndex(procedureAnlayseColumns, ['name', 'Patient Adj']),
                othersPayment: _.findIndex(procedureAnlayseColumns, ['name', 'Others Pay']),
                othersAdjustment: _.findIndex(procedureAnlayseColumns, ['name', 'Others Adj']),
                balance: _.findIndex(procedureAnlayseColumns, ['name', 'Balance']),

            }
            procedureAnlayseColumns[rowIndexes.charges].cssClass = 'text-right';
            procedureAnlayseColumns[rowIndexes.allowedAmount].cssClass = 'text-right';
            procedureAnlayseColumns[rowIndexes.insurancePayment].cssClass = 'text-right';
            procedureAnlayseColumns[rowIndexes.insuranceAdjustment].cssClass = 'text-right';
            procedureAnlayseColumns[rowIndexes.patientPayment].cssClass = 'text-right';
            procedureAnlayseColumns[rowIndexes.patientAdjustment].cssClass = 'text-right';
            procedureAnlayseColumns[rowIndexes.othersPayment].cssClass = 'text-right';
            procedureAnlayseColumns[rowIndexes.othersAdjustment].cssClass = 'text-right';
            procedureAnlayseColumns[rowIndexes.balance].cssClass = 'text-right';
            return resolve(rawReportData);
        });
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

        if (params.cptIds) {
            const cptCode = _(lookups.cptCodes).map(f => f.code).value();
            filtersUsed.push({ name: 'cptCode', label: 'Cpt Codes', value: cptCode });
        }
        else
            filtersUsed.push({ name: 'cptCode', label: 'cpt Codes', value: 'All' });

        // insurance Providers
         if(params.allRefProList == 'false') {
        if (params.insuranceProviderIds) {
            const insuranceProviderNames = _(lookups.insuranceProviders).map(f => f.name).value();
            filtersUsed.push({ name: 'insuranceProviderNames', label: 'Insurance Provider', value: insuranceProviderNames });
        }
        else
            filtersUsed.push({ name: 'insuranceProviderNames', label: 'Insurance Provider', value: 'All' });
         }

           // Referring Provider Filter
       if(params.allRefProList == 'true'){
        if(params.referringDocList)  {
            const referringProviderNames = _(lookups.referringProviderInfo).map(f => f.name).value();
            filtersUsed.push({name: 'referringProviderInfo', label: 'Referring Provider', value: referringProviderNames });
        }
        else {
            filtersUsed.push({name: 'referringProviderInfo', label: 'Referring Provider', value: 'All'});
        }
       }
        //   Provider Group Filter
        if(params.refProviderGroupList)  {
            const refProviderGroupNames = _(lookups.providerGroupList).map(f => f.name).value();
            filtersUsed.push({name: 'providerGroupList', label: 'Provider Group', value: refProviderGroupNames });
        }
        else {
            filtersUsed.push({name: 'providerGroupList', label: 'Provider Group', value: 'All'});
        }

        filtersUsed.push({ name: 'fromDate', label: 'Date From', value: moment(params.fromDate).format(params.dateFormat) });
        filtersUsed.push({ name: 'toDate', label: 'Date To', value: moment(params.toDate).format(params.dateFormat) });
        return filtersUsed;
    },

    // ================================================================================================================
    // --- DATA SET - ProcedureAnalysisInsurance count

    createProcedureAnalysisInsuranceDataSet: (reportParams) => {
        // 1 - build the query context. Each report will 'know' how to do this, based on report params and query/queries to be executed...
        const queryContext = api.getProcedureAnalysisInsuranceDataSetQueryContext(reportParams);
        console.log('context__', queryContext)
        // 2 - geenrate query to execute
        const query = ProcedureAnalysisInsuranceDataSetQueryTemplate(queryContext.templateData);
        // 3a - get the report data and return a promise
        return db.queryForReportData(query, queryContext.queryParams);
    },

    // query context is all about query building: 1 - query parameters and 2 - query template data
    // every report and/or query may have a different logic to build a query context...
    getProcedureAnalysisInsuranceDataSetQueryContext: (reportParams) => {
        const params = [];
        const filters = {
            companyId: null,
            claimDate: null,
            facilityIds: null,
            billingProID: null,
            insuranceProviderIds: null,
            cptIds:null,
            refProviderFlagValue : null,
            referringProID: null,
            providerGroupID: null,
            payerIds: null

        };

        // Referring Provider Flag
         filters.refProviderFlagValue  = reportParams.refProviderFlag;

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
            filters.claimDate = queryBuilder.whereDateInTz('bc.claim_dt', '=', [params.length], 'f.time_zone');
        } else {
            params.push(reportParams.fromDate);
            params.push(reportParams.toDate);
            filters.claimDate = queryBuilder.whereDateInTzBetween('bc.claim_dt', [params.length - 1, params.length], 'f.time_zone');
        }

        // billingProvider single or multiple
        if (reportParams.billingProvider) {
            params.push(reportParams.billingProvider);
            filters.billingProID = queryBuilder.whereIn('bp.id', [params.length]);
        }

         //InsuranceProvider filter
         if (reportParams.insuranceProviderIds) {
            params.push(reportParams.insuranceProviderIds);
            filters.insuranceProviderIds = queryBuilder.whereIn('pip.id', [params.length]);
        }

        //cptCodes filter
        if (reportParams.cptIds) {
            params.push(reportParams.cptIds);
            filters.cptIds = queryBuilder.whereIn('pcc.id', [params.length]);
        }

        // Referring Provider Single or Multiple
        if(reportParams.referringDocList)  {
            params.push(reportParams.referringDocList);
            filters.referringProID = queryBuilder.whereIn('ppr.id', [params.length]);
        }
        //  Provider Group Single or Multiple
        if(reportParams.refProviderGroupList)  {
            params.push(reportParams.refProviderGroupList);
            filters.providerGroupID = queryBuilder.whereIn('ppc.provider_group_id', [params.length]);
        }

        //Payer Type List
        if (reportParams.payerTypeList && reportParams.payerTypeList.length > 0) {
            params.push(reportParams.payerTypeList);
            filters.payerIds = queryBuilder.whereIn(`pippt.id`, [params.length]);
        }

        filters.dateFormat = reportParams.dateFormat;
        filters.codeHeader = reportParams.codeHeader;
        filters.dateHeader = reportParams.dateHeader;
        return {
            queryParams: params,
            templateData: filters
        }
    }
}

module.exports = api;
